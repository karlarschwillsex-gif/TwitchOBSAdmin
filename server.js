// /home/fynn/TwitchOBSAdmin/server.js
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const duels = require('./backend/duels');
const { getVirtualCamFilters } = require('./backend/obs-connection');

// EventSub (ESM import)
const { router: eventsubRouter, registerEventSubs } = require('./backend/eventsub.js');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = __dirname;

/* ============================================================
   RAW BODY FÜR EVENTSUB (MUSS GANZ OBEN SEIN!)
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
  coins: path.join(ROOT, 'config.json'),
  soundSettings: path.join(ROOT, 'sound_settings.json'),
  soundAlias: path.join(ROOT, 'sound_alias.json'),
  bannerFolder: path.join(ROOT, 'public', 'banner')
};

const CAMFILTER_FILE = path.join(ROOT, 'data', 'camfilters.json');
const ECONOMY_FILE = path.join(ROOT, 'data', 'economy.json');

/* ============================================================
   DIRECTORY SETUP
   ============================================================ */
try {
  if (!fs.existsSync(path.join(ROOT, 'public'))) fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
  if (!fs.existsSync(CONFIG.bannerFolder)) fs.mkdirSync(CONFIG.bannerFolder, { recursive: true });
  if (!fs.existsSync(path.join(ROOT, 'data'))) fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
} catch (err) {
  console.error('[server] Fehler beim Anlegen von Verzeichnissen', err);
}

/* ============================================================
   CAMFILTER JSON HELPERS
   ============================================================ */
function loadCamfilterSettings() {
  try {
    if (!fs.existsSync(CAMFILTER_FILE)) {
      fs.writeFileSync(CAMFILTER_FILE, '[]');
    }
    return JSON.parse(fs.readFileSync(CAMFILTER_FILE, 'utf8'));
  } catch (err) {
    console.error('[server] camfilters.json lesen Fehler:', err);
    return [];
  }
}

function saveCamfilterSettings(filters) {
  try {
    fs.writeFileSync(CAMFILTER_FILE, JSON.stringify(filters, null, 2), 'utf8');
  } catch (err) {
    console.error('[server] camfilters.json schreiben Fehler:', err);
  }
}

/* ============================================================
   ECONOMY JSON HELPERS
   ============================================================ */
function loadEconomy() {
  try {
    if (!fs.existsSync(ECONOMY_FILE)) {
      fs.writeFileSync(ECONOMY_FILE, JSON.stringify({
        costChatNormal: 1,
        costChatModVip: 0,
        vipMultiplier: 1,
        watchMultiplier: 1,
        watchActivateAfterMin: 0,
        watchDeactivateAfterHours: 0,
        startCapital: 0
      }, null, 2));
    }
    return JSON.parse(fs.readFileSync(ECONOMY_FILE, 'utf8'));
  } catch (err) {
    console.error('[server] economy.json lesen Fehler:', err);
    return {};
  }
}

function saveEconomy(cfg) {
  try {
    fs.writeFileSync(ECONOMY_FILE, JSON.stringify(cfg, null, 2));
    return true;
  } catch (err) {
    console.error('[server] economy.json schreiben Fehler:', err);
    return false;
  }
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
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    env: {
      port: PORT,
      eventsub_callback: process.env.TWITCH_EVENTSUB_CALLBACK || null
    }
  });
});

/* ============================================================
   EVENTSUB ROUTER (NEU)
   ============================================================ */
app.use("/", eventsubRouter);

/* ============================================================
   DUELS
   ============================================================ */
app.use('/api/admin/duels', duels.router);

/* ============================================================
   BANNER
   ============================================================ */
app.get('/api/admin/banner', (req, res) => {
  const bannerPath = path.join(CONFIG.bannerFolder, 'banner.png');
  res.json({ exists: fs.existsSync(bannerPath) });
});

app.post('/api/admin/banner', (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 fehlt' });
    const data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(path.join(CONFIG.bannerFolder, 'banner.png'), Buffer.from(data, 'base64'));
    return res.json({ ok: true });
  } catch (err) {
    console.error('[server] banner upload error', err);
    return res.status(500).json({ error: 'Speicherfehler' });
  }
});

app.delete('/api/admin/banner', (req, res) => {
  try {
    const bannerPath = path.join(CONFIG.bannerFolder, 'banner.png');
    if (fs.existsSync(bannerPath)) fs.unlinkSync(bannerPath);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[server] banner delete error', err);
    return res.status(500).json({ error: 'Löschfehler' });
  }
});

/* ============================================================
   OBS FILTER
   ============================================================ */
app.get('/api/admin/obs-filters', async (req, res) => {
  try {
    const filters = await getVirtualCamFilters();
    res.json({ filters });
  } catch (err) {
    console.error('[server] /api/admin/obs-filters Fehler:', err);
    res.json({ filters: [] });
  }
});

/* ============================================================
   CAMFILTER SETTINGS
   ============================================================ */
app.get('/api/admin/camfilter-settings', (req, res) => {
  res.json(loadCamfilterSettings());
});

app.post('/api/admin/camfilter-settings', (req, res) => {
  const filters = Array.isArray(req.body) ? req.body : [];
  saveCamfilterSettings(filters);
  res.json({ ok: true });
});

app.post('/api/admin/camfilter-settings/add', (req, res) => {
  const { filterName, cost, duration } = req.body || {};

  if (!filterName) {
    return res.status(400).json({ ok: false, error: 'filterName fehlt' });
  }

  const filters = loadCamfilterSettings();

  const filter = {
    filterName,
    cost: Number(cost) || 0,
    duration: Number(duration) || 5
  };

  filters.push(filter);
  saveCamfilterSettings(filters);

  res.json({ ok: true, filter });
});

/* ============================================================
   CONFIG (Coins, Sound, Alias)
   ============================================================ */
function safeReadJson(filePath, defaultObj = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultObj, null, 2));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error('[server] safeReadJson Fehler', err);
    return defaultObj;
  }
}

function safeWriteJson(filePath, obj) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    return true;
  } catch (err) {
    console.error('[server] safeWriteJson Fehler', err);
    return false;
  }
}

app.get('/api/admin/config', (req, res) => {
  res.json(safeReadJson(CONFIG.coins, {}));
});

app.post('/api/admin/config', (req, res) => {
  safeWriteJson(CONFIG.coins, req.body || {});
  res.json({ ok: true });
});

app.get('/api/admin/sound-settings', (req, res) => {
  res.json(safeReadJson(CONFIG.soundSettings, {}));
});

app.post('/api/admin/sound-settings', (req, res) => {
  safeWriteJson(CONFIG.soundSettings, req.body || {});
  res.json({ ok: true });
});

app.get('/api/admin/sound-alias', (req, res) => {
  res.json(safeReadJson(CONFIG.soundAlias, []));
});

app.post('/api/admin/sound-alias', (req, res) => {
  safeWriteJson(CONFIG.soundAlias, req.body || []);
  res.json({ ok: true });
});

/* ============================================================
   ECONOMY API
   ============================================================ */
app.get('/api/admin/economy', (req, res) => {
  res.json(loadEconomy());
});

app.post('/api/admin/economy', (req, res) => {
  const ok = saveEconomy(req.body || {});
  res.json({ ok });
});

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
const server = app.listen(PORT, async () => {
  console.log(`Admin-Backend läuft auf http://localhost:${PORT}`);

  // EventSub registrieren
  await registerEventSubs();
});

/* ============================================================
   SHUTDOWN
   ============================================================ */
function shutdown() {
  console.log('[server] Beende Server...');
  server.close(() => {
    console.log('[server] HTTP Server beendet');
    process.exit(0);
  });
  setTimeout(() => {
    console.warn('[server] Forciertes Beenden');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
