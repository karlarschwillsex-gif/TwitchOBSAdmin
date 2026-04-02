// /home/fynn/TwitchOBSAdmin/server.js
require('dotenv').config();
const express    = require('express');
const morgan     = require('morgan');
const fs         = require('fs');
const path       = require('path');
const http       = require('http');
const WebSocket  = require('ws');
const fetch      = require('node-fetch');
const duels      = require('./backend/duels');
const obsConn    = require('./backend/obs-connection');
const { getVirtualCamFilters, setFilterState } = obsConn;
const { router: eventsubRouter, registerEventSubs } = require('./backend/eventsub.js');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = __dirname;

/* ============================================================
   HTTP SERVER + WEBSOCKET
   ============================================================ */
const server    = http.createServer(app);
const wss       = new WebSocket.Server({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log('[ws] Client verbunden, gesamt:', wsClients.size);
  ws.on('close', () => { wsClients.delete(ws); });
  ws.on('error', () => { wsClients.delete(ws); });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wsClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(msg); } catch (e) { }
    }
  });
}

/* ============================================================
   RAW BODY FÜR EVENTSUB
   ============================================================ */
app.use('/eventsub', express.raw({ type: 'application/json' }));

/* ============================================================
   MIDDLEWARE
   ============================================================ */
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, 'public')));

/* ============================================================
   CONFIG PATHS
   ============================================================ */
const CONFIG = {
  coins:        path.join(ROOT, 'config.json'),
  soundSettings: path.join(ROOT, 'sound_settings.json'),
  soundAlias:   path.join(ROOT, 'sound_alias.json'),
  bannerFolder: path.join(ROOT, 'public', 'banner')
};

const CAMFILTER_FILE     = path.join(ROOT, 'data', 'camfilters.json');
const ECONOMY_FILE       = path.join(ROOT, 'data', 'economy.json');
const CREDITS_DIR        = path.join(ROOT, 'data', 'credits');
const SOUND_REWARDS_FILE = path.join(ROOT, 'data', 'sound_rewards.json');
const BIT_SOUNDS_FILE    = path.join(ROOT, 'data', 'bit_sounds.json');
const CAM_REWARDS_FILE   = path.join(ROOT, 'data', 'cam_rewards.json');
const SOUNDS_DIR         = path.join(ROOT, 'public', 'sounds');

/* ============================================================
   DIRECTORY SETUP
   ============================================================ */
try {
  [path.join(ROOT, 'public'), CONFIG.bannerFolder, path.join(ROOT, 'data'), CREDITS_DIR, SOUNDS_DIR]
    .forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
} catch (err) {
  console.error('[server] Fehler beim Anlegen von Verzeichnissen', err);
}

/* ============================================================
   HELPERS
   ============================================================ */
function safeReadJson(filePath, defaultObj = {}) {
  try {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultObj, null, 2));
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) { return defaultObj; }
}

function safeWriteJson(filePath, obj) {
  try { fs.writeFileSync(filePath, JSON.stringify(obj, null, 2)); return true; }
  catch (err) { return false; }
}

function creditsFile(username) {
  const safe = String(username || 'unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return path.join(CREDITS_DIR, `${safe}.json`);
}

function readCredits(username) {
  const fp = creditsFile(username);
  try {
    if (!fs.existsSync(fp)) return { username, credits: 0 };
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) { return { username, credits: 0 }; }
}

function writeCredits(username, obj) {
  try { fs.writeFileSync(creditsFile(username), JSON.stringify(obj, null, 2)); return true; }
  catch (e) { return false; }
}

function loadCamfilterSettings() {
  try {
    if (!fs.existsSync(CAMFILTER_FILE)) fs.writeFileSync(CAMFILTER_FILE, '[]');
    return JSON.parse(fs.readFileSync(CAMFILTER_FILE, 'utf8'));
  } catch (err) { return []; }
}

function saveCamfilterSettings(filters) {
  try { fs.writeFileSync(CAMFILTER_FILE, JSON.stringify(filters, null, 2), 'utf8'); }
  catch (err) { console.error('[server] camfilters Fehler:', err); }
}

function loadEconomy() {
  try {
    if (!fs.existsSync(ECONOMY_FILE)) {
      fs.writeFileSync(ECONOMY_FILE, JSON.stringify({
        basePerMessage: 1, cooldownSeconds: 5, spamCheckMessages: 3,
        factorMod: 1.5, factorVip: 1.5, factorSub: 2.0,
        bitFactor1: 1.0, bitFactor2: 1.5, bitFactor3: 2.0,
        bitFactor4: 2.5, bitFactor5: 3.0
      }, null, 2));
    }
    return JSON.parse(fs.readFileSync(ECONOMY_FILE, 'utf8'));
  } catch (err) { return {}; }
}

function saveEconomy(cfg) {
  try { fs.writeFileSync(ECONOMY_FILE, JSON.stringify(cfg, null, 2)); return true; }
  catch (err) { return false; }
}

/* ============================================================
   BASIC ENDPOINTS
   ============================================================ */
app.get('/', (req, res) => {
  const adminHtml = path.join(ROOT, 'public', 'admin.html');
  if (fs.existsSync(adminHtml)) return res.sendFile(adminHtml);
  res.type('text').send('Admin-Backend läuft');
});

app.get('/_status', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), wsClients: wsClients.size });
});

/* ============================================================
   EVENTSUB ROUTER
   ============================================================ */
app.use('/', eventsubRouter);

/* ============================================================
   OVERLAY BROADCAST
   ============================================================ */
app.post('/api/overlay/broadcast', (req, res) => {
  broadcast(req.body || {});
  res.json({ ok: true });
});

/* ============================================================
   SOUND ABSPIELEN
   ============================================================ */
app.post('/api/admin/play-sound', async (req, res) => {
  const { file, volume, name, user } = req.body || {};
  if (!file) return res.status(400).json({ ok: false, error: 'file fehlt' });

  console.log(`[server] Sound abspielen: ${file} für ${user}`);

  broadcast({ type: 'sound:play', file, volume: volume || 0.8, name: name || file, user });

  try {
    const ok = await obsConn.playSound(file, volume || 0.8);
    return res.json({ ok: true, method: ok ? 'obs' : 'broadcast' });
  } catch (e) {
    return res.json({ ok: true, method: 'broadcast', error: e.message });
  }
});

/* ============================================================
   CAM-FILTER TRIGGERN
   ============================================================ */
app.post('/api/admin/cam-filter/trigger', async (req, res) => {
  const { filterName, duration } = req.body || {};
  if (!filterName) return res.status(400).json({ ok: false, error: 'filterName fehlt' });

  const durationMs = (Number(duration) || 10) * 1000;
  console.log(`[server] CamFilter: ${filterName} für ${duration}s`);

  try {
    // Filter aktivieren
    await setFilterState(filterName, true);

    // Visuelles Feedback ans Overlay
    broadcast({ type: 'filter:apply', name: filterName, duration: durationMs });

    // Nach X Sekunden deaktivieren
    setTimeout(async () => {
      try {
        await setFilterState(filterName, false);
        console.log(`[server] CamFilter deaktiviert: ${filterName}`);
      } catch (e) {
        console.error('[server] Filter deaktivieren Fehler:', e.message);
      }
    }, durationMs);

    res.json({ ok: true });
  } catch (e) {
    console.error('[server] cam-filter/trigger Fehler:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

/* ============================================================
   CAM-REWARDS API
   ============================================================ */
app.get('/api/admin/cam-rewards', (req, res) => {
  res.json(safeReadJson(CAM_REWARDS_FILE, []));
});

app.post('/api/admin/cam-rewards', (req, res) => {
  const rewards = Array.isArray(req.body) ? req.body : [];
  res.json({ ok: safeWriteJson(CAM_REWARDS_FILE, rewards) });
});

app.post('/api/admin/cam-rewards/create', async (req, res) => {
  const { filterName, cost, duration } = req.body || {};
  if (!filterName) return res.status(400).json({ ok: false, error: 'filterName fehlt' });

  const rewardName = `${filterName} [Cam]`;

  try {
    const twitchRewards = require('./backend/twitchRewards.js');
    const reward = await twitchRewards.createReward({
      title:                  rewardName,
      cost:                   Number(cost) || 300,
      is_enabled:             true,
      is_user_input_required: false
    });

    const rewards = safeReadJson(CAM_REWARDS_FILE, []);
    rewards.push({
      rewardName,
      filterName,
      duration: Number(duration) || 10,
      cost:     Number(cost)     || 300,
      rewardId: reward?.id       || null
    });
    safeWriteJson(CAM_REWARDS_FILE, rewards);
    res.json({ ok: true, reward });
  } catch (e) {
    console.error('[server] cam-rewards/create Fehler:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/admin/cam-rewards/update-twitch', async (req, res) => {
  const { rewardId, cost } = req.body || {};
  if (!rewardId) return res.status(400).json({ ok: false, error: 'rewardId fehlt' });
  try {
    const twitchRewards = require('./backend/twitchRewards.js');
    await twitchRewards.updateReward(rewardId, { cost: Number(cost) });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/cam-rewards/delete-twitch', async (req, res) => {
  const { rewardId } = req.body || {};
  if (!rewardId) return res.status(400).json({ ok: false, error: 'rewardId fehlt' });
  try {
    const twitchRewards = require('./backend/twitchRewards.js');
    await twitchRewards.deleteReward(rewardId);
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

/* ============================================================
   DUELS
   ============================================================ */
app.use('/api/admin/duels', duels.router);

/* ============================================================
   SOUND-DATEIEN
   ============================================================ */
app.get('/api/admin/sound-files', (req, res) => {
  try {
    const files = fs.readdirSync(SOUNDS_DIR)
      .filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f))
      .sort();
    res.json({ files });
  } catch (e) { res.json({ files: [] }); }
});

/* ============================================================
   SOUND-REWARDS
   ============================================================ */
app.get('/api/admin/sound-rewards', (req, res) => {
  res.json(safeReadJson(SOUND_REWARDS_FILE, []));
});

app.post('/api/admin/sound-rewards', (req, res) => {
  res.json({ ok: safeWriteJson(SOUND_REWARDS_FILE, Array.isArray(req.body) ? req.body : []) });
});

app.post('/api/admin/sound-rewards/create', async (req, res) => {
  const { rewardName, file, cost, volume } = req.body || {};
  if (!rewardName || !file) return res.status(400).json({ ok: false, error: 'rewardName und file erforderlich' });
  try {
    const twitchRewards = require('./backend/twitchRewards.js');
    const reward = await twitchRewards.createReward({
      title: `${rewardName} [Sound]`, cost: Number(cost) || 100,
      is_enabled: true, is_user_input_required: false
    });
    const rewards = safeReadJson(SOUND_REWARDS_FILE, []);
    rewards.push({ rewardName: `${rewardName} [Sound]`, file, volume: Number(volume) || 80, cost: Number(cost) || 100, rewardId: reward?.id || null });
    safeWriteJson(SOUND_REWARDS_FILE, rewards);
    res.json({ ok: true, reward });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/sound-rewards/update-twitch', async (req, res) => {
  const { rewardId, cost } = req.body || {};
  if (!rewardId) return res.status(400).json({ ok: false, error: 'rewardId fehlt' });
  try {
    const twitchRewards = require('./backend/twitchRewards.js');
    await twitchRewards.updateReward(rewardId, { cost: Number(cost) });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/sound-rewards/delete-twitch', async (req, res) => {
  const { rewardId } = req.body || {};
  if (!rewardId) return res.status(400).json({ ok: false, error: 'rewardId fehlt' });
  try {
    const twitchRewards = require('./backend/twitchRewards.js');
    await twitchRewards.deleteReward(rewardId);
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

/* ============================================================
   BIT-SOUNDS
   ============================================================ */
app.get('/api/admin/bit-sounds',  (req, res) => res.json(safeReadJson(BIT_SOUNDS_FILE, [])));
app.post('/api/admin/bit-sounds', (req, res) => res.json({ ok: safeWriteJson(BIT_SOUNDS_FILE, Array.isArray(req.body) ? req.body : []) }));

/* ============================================================
   CREDITS API
   ============================================================ */
app.get('/api/admin/credits', (req, res) => {
  try {
    const files = fs.readdirSync(CREDITS_DIR).filter(f => f.endsWith('.json'));
    const all   = files.map(f => { try { return JSON.parse(fs.readFileSync(path.join(CREDITS_DIR, f), 'utf8')); } catch { return null; } }).filter(Boolean);
    res.json(all);
  } catch (e) { res.json([]); }
});

app.get('/api/admin/credits/:username',    (req, res) => res.json(readCredits(req.params.username)));

app.post('/api/admin/credits/:username', (req, res) => {
  const username = req.params.username;
  const body     = req.body || {};
  const data     = readCredits(username);
  if (typeof body.credits === 'number')    data.credits = body.credits;
  else if (typeof body.delta === 'number') data.credits = (data.credits || 0) + body.delta;
  else return res.status(400).json({ error: 'Bitte {credits: n} oder {delta: n} senden' });
  data.username = username;
  return writeCredits(username, data) ? res.json({ ok: true, credits: data.credits }) : res.status(500).json({ error: 'Schreibfehler' });
});

app.delete('/api/admin/credits/:username', (req, res) => {
  const data = readCredits(req.params.username);
  data.credits = 0;
  return writeCredits(req.params.username, data) ? res.json({ ok: true, credits: 0 }) : res.status(500).json({ error: 'Schreibfehler' });
});

/* ============================================================
   BANNER
   ============================================================ */
app.get('/api/admin/banner', (req, res) => res.json({ exists: fs.existsSync(path.join(CONFIG.bannerFolder, 'banner.png')) }));

app.post('/api/admin/banner', (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 fehlt' });
    fs.writeFileSync(path.join(CONFIG.bannerFolder, 'banner.png'), Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    return res.json({ ok: true });
  } catch (err) { return res.status(500).json({ error: 'Speicherfehler' }); }
});

app.delete('/api/admin/banner', (req, res) => {
  try {
    const p = path.join(CONFIG.bannerFolder, 'banner.png');
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return res.json({ ok: true });
  } catch (err) { return res.status(500).json({ error: 'Löschfehler' }); }
});

/* ============================================================
   OBS FILTER
   ============================================================ */
app.get('/api/admin/obs-filters', async (req, res) => {
  try { res.json({ filters: await getVirtualCamFilters() }); }
  catch (err) { res.json({ filters: [] }); }
});

/* ============================================================
   CAMFILTER SETTINGS (alt)
   ============================================================ */
app.get('/api/admin/camfilter-settings',      (req, res) => res.json(loadCamfilterSettings()));
app.post('/api/admin/camfilter-settings',     (req, res) => { saveCamfilterSettings(Array.isArray(req.body) ? req.body : []); res.json({ ok: true }); });
app.post('/api/admin/camfilter-settings/add', (req, res) => {
  const { filterName, cost, duration } = req.body || {};
  if (!filterName) return res.status(400).json({ ok: false, error: 'filterName fehlt' });
  const filters = loadCamfilterSettings();
  filters.push({ filterName, cost: Number(cost) || 0, duration: Number(duration) || 5 });
  saveCamfilterSettings(filters);
  res.json({ ok: true });
});

/* ============================================================
   CONFIG / SOUND ALIAS
   ============================================================ */
app.get('/api/admin/config',          (req, res) => res.json(safeReadJson(CONFIG.coins, {})));
app.post('/api/admin/config',         (req, res) => { safeWriteJson(CONFIG.coins, req.body || {}); res.json({ ok: true }); });
app.get('/api/admin/sound-settings',  (req, res) => res.json(safeReadJson(CONFIG.soundSettings, {})));
app.post('/api/admin/sound-settings', (req, res) => { safeWriteJson(CONFIG.soundSettings, req.body || {}); res.json({ ok: true }); });
app.get('/api/admin/sound-alias',     (req, res) => res.json(safeReadJson(CONFIG.soundAlias, [])));
app.post('/api/admin/sound-alias',    (req, res) => { safeWriteJson(CONFIG.soundAlias, req.body || []); res.json({ ok: true }); });

/* ============================================================
   ECONOMY API
   ============================================================ */
app.get('/api/admin/economy',  (req, res) => res.json(loadEconomy()));
app.post('/api/admin/economy', (req, res) => res.json({ ok: saveEconomy(req.body || {}) }));

/* ============================================================
   ERROR HANDLER
   ============================================================ */
app.use((err, req, res, next) => {
  console.error('[server] Fehler:', err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* ============================================================
   SERVER START
   ============================================================ */
server.listen(PORT, async () => {
  console.log(`Admin-Backend läuft auf http://localhost:${PORT}`);
  console.log(`WebSocket läuft auf ws://localhost:${PORT}`);
  await registerEventSubs();
});

/* ============================================================
   SHUTDOWN
   ============================================================ */
function shutdown() {
  console.log('[server] Beende Server...');
  server.close(() => { console.log('[server] HTTP Server beendet'); process.exit(0); });
  setTimeout(() => { process.exit(1); }, 5000).unref();
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
