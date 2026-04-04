// /home/fynn/TwitchOBSAdmin/backend/credits_api.js
require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const fetch   = require('node-fetch');
const router  = express.Router();
router.use(express.json({ limit: '5mb' }));

const ROOT         = path.join(__dirname, '..');
const CONFIG_FILE  = path.join(ROOT, 'data', 'credits_config.json');
const CREDITS_DIR  = path.join(ROOT, 'data', 'credits');
const SESSION_FILE = path.join(ROOT, 'data', 'session.json');
const FONTS_DIR    = path.join(ROOT, 'public', 'fonts');

const CLIENT_ID      = process.env.CLIENT_ID;
const USER_TOKEN     = process.env.TWITCH_USER_TOKEN;
const BROADCASTER_ID = process.env.BROADCASTER_ID;
const OWNER          = (process.env.TWITCH_CHANNEL || process.env.OWNER || 'fairewelt').toLowerCase();

// Admin-Namen die nie in Listen erscheinen
const ADMIN_NAMES = [OWNER, 'fairewelt', 'bottyfoxy', 'streamelements', 'nightbot', 'moobot'];
function isAdmin(name) {
    return ADMIN_NAMES.includes((name || '').toLowerCase());
}

const DEFAULT_SECTIONS = [
    { id: 'twitch_subs',      title: 'Subscriber',           type: 'twitch', enabled: true  },
    { id: 'twitch_vips',      title: 'VIPs',                 type: 'twitch', enabled: true  },
    { id: 'twitch_mods',      title: 'Moderatoren',          type: 'twitch', enabled: true  },
    { id: 'twitch_bits',      title: 'Top Bits-Spender (heute)', type: 'twitch', enabled: true  },
    { id: 'twitch_bits30',    title: 'Top Bits-Spender (30 Tage)', type: 'twitch', enabled: false },
    { id: 'twitch_gifters',   title: 'Top SUB-Schenker (heute)', type: 'twitch', enabled: true  },
    { id: 'twitch_gifters30', title: 'Top SUB-Schenker (30 Tage)', type: 'twitch', enabled: false },
    { id: 'twitch_new_subs',  title: 'Neue Subscriber',      type: 'twitch', enabled: true  },
    { id: 'twitch_resubs',    title: 'Treue Subscriber',     type: 'twitch', enabled: true  },
    { id: 'twitch_viewers',   title: 'Heutige Zuschauer',    type: 'twitch', enabled: true  },
    { id: 'twitch_followers', title: 'Neue Follower',        type: 'twitch', enabled: false },
    { id: 'twitch_longest',   title: 'Längster aktiver SUB', type: 'twitch', enabled: true  },
    { id: 'fd_top5',          title: '🏆 Top 5 Füchse',      type: 'fd',     enabled: true  },
    { id: 'fd_duel_king',     title: '⚔️ Duell-König',       type: 'fd',     enabled: true  },
    { id: 'fd_brave_loser',   title: '💀 Tapferster Verlierer', type: 'fd',  enabled: true  },
    { id: 'fd_generous',      title: '🎁 Großzügigster Fuchs', type: 'fd',   enabled: true  },
    { id: 'fd_active',        title: '🗣️ Aktivster Fuchs',   type: 'fd',     enabled: true  }
];

const DEFAULT_CONFIG = {
    headline:          'FaireWelt',
    subtitle:          'Danke für einen wunderbaren Stream!',
    farewell:          'Bis zum nächsten Mal 🦊',
    raidText:          'Wir raiden heute @[Twitchname] — kommt alle mit!',
    raidTarget:        '',
    recentRaidTargets: [],
    logo1:             '',
    logo2:             '',
    logo1Height:       120,
    logo2Height:       120,
    fontFamily:        'MAGNETOB',
    textColor:         '#ffffff',
    fontSizeHeadline:  64,
    fontSizeSubtitle:  32,
    fontSizeCategory:  28,
    fontSizeNames:     22,
    shadowColor:       '#000000',
    shadowBlur:        6,
    shadowOffset:      2,
    scrollSpeed:       0.8,
    running:           false,
    sections:          DEFAULT_SECTIONS
};

// ── Config ──
function ensureConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
        return;
    }
    // Neue Sektionen zu bestehender Config hinzufügen
    try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const existingIds = (cfg.sections || []).map(s => s.id);
        let changed = false;
        DEFAULT_SECTIONS.forEach(s => {
            if (!existingIds.includes(s.id)) {
                cfg.sections = cfg.sections || [];
                cfg.sections.push(s);
                changed = true;
            }
        });
        if (changed) fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
    } catch {}
}

function readConfig() {
    ensureConfig();
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch { return { ...DEFAULT_CONFIG }; }
}

function writeConfig(cfg) {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); return true; }
    catch { return false; }
}

// ── Session lesen ──
function readSession() {
    try {
        if (!fs.existsSync(SESSION_FILE)) return {};
        return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    } catch { return {}; }
}

// ── Twitch API Helper ──
function twitchHeaders() {
    return { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${USER_TOKEN}` };
}
async function twitchGet(url) {
    try {
        const r = await fetch(url, { headers: twitchHeaders() });
        return await r.json();
    } catch { return { data: [] }; }
}

// ── Alle F$ Credits lesen ──
function readAllCredits() {
    try {
        if (!fs.existsSync(CREDITS_DIR)) return [];
        return fs.readdirSync(CREDITS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => { try { return JSON.parse(fs.readFileSync(path.join(CREDITS_DIR, f), 'utf8')); } catch { return null; } })
            .filter(Boolean)
            .filter(u => !isAdmin(u.username));
    } catch { return []; }
}

// ── Sendezeit berechnen (ab voller Stunde) ──
function calcBroadcastTime(startTimeISO) {
    if (!startTimeISO) return null;
    const start = new Date(startTimeISO);
    const now   = new Date();
    const diff  = Math.floor((now - start) / 1000 / 60);
    const h     = Math.floor(diff / 60);
    const m     = diff % 60;
    if (h > 0) return `${h}h ${m}min`;
    return `${m} Minuten`;
}

// ── 30 Tage Tracking Datei ──
const TRACKING_FILE = path.join(ROOT, 'data', 'tracking30.json');
function readTracking30() {
    try {
        if (!fs.existsSync(TRACKING_FILE)) return { bits: {}, gifters: {} };
        const data = JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
        // Einträge älter als 30 Tage entfernen
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        ['bits', 'gifters'].forEach(key => {
            Object.keys(data[key] || {}).forEach(user => {
                data[key][user] = (data[key][user] || []).filter(e => e.ts > cutoff);
                if (!data[key][user].length) delete data[key][user];
            });
        });
        return data;
    } catch { return { bits: {}, gifters: {} }; }
}

// ── collectCreditsData ──
async function collectCreditsData() {
    const result   = {};
    const session  = readSession();
    const all      = readAllCredits();
    const track30  = readTracking30();

    // ── Twitch API: Subs ──
    try {
        const subs = await twitchGet(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${BROADCASTER_ID}&first=100`);
        result['twitch_subs'] = (subs.data || [])
            .map(s => s.user_name)
            .filter(n => n && !isAdmin(n));
    } catch { result['twitch_subs'] = []; }

    // ── Twitch API: Längster aktiver SUB ──
    try {
        const subs = await twitchGet(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${BROADCASTER_ID}&first=100`);
        const sorted = (subs.data || [])
            .filter(s => s.user_name && !isAdmin(s.user_name))
            .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        result['twitch_longest'] = sorted.slice(0, 3).map(s => s.user_name).filter(Boolean);
    } catch { result['twitch_longest'] = []; }

    // ── Twitch API: VIPs ──
    try {
        const vips = await twitchGet(`https://api.twitch.tv/helix/channels/vips?broadcaster_id=${BROADCASTER_ID}&first=100`);
        result['twitch_vips'] = (vips.data || [])
            .map(v => v.user_name)
            .filter(n => n && !isAdmin(n));
    } catch { result['twitch_vips'] = []; }

    // ── Twitch API: Mods ──
    try {
        const mods = await twitchGet(`https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${BROADCASTER_ID}&first=100`);
        result['twitch_mods'] = (mods.data || [])
            .map(m => m.user_name)
            .filter(n => n && !isAdmin(n));
    } catch { result['twitch_mods'] = []; }

    // ── Twitch API: Neue Follower (24h) ──
    try {
        const follows = await twitchGet(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${BROADCASTER_ID}&first=20`);
        const cutoff  = Date.now() - 24 * 60 * 60 * 1000;
        result['twitch_followers'] = (follows.data || [])
            .filter(f => new Date(f.followed_at).getTime() > cutoff)
            .map(f => f.user_name)
            .filter(n => n && !isAdmin(n));
    } catch { result['twitch_followers'] = []; }

    // ── Session: Top Bits heute ──
    const bitDonors = session.bitDonors || {};
    result['twitch_bits'] = Object.entries(bitDonors)
        .filter(([u]) => !isAdmin(u))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([user, bits]) => `${user} (${bits} Bits)`);

    // ── 30 Tage: Top Bits ──
    const bits30 = track30.bits || {};
    result['twitch_bits30'] = Object.entries(bits30)
        .filter(([u]) => !isAdmin(u))
        .map(([user, events]) => [user, events.reduce((s, e) => s + (e.amount || 0), 0)])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([user, total]) => `${user} (${total} Bits)`);

    // ── Session: Top SUB-Schenker heute ──
    const giftSubs = session.giftSubs || {};
    result['twitch_gifters'] = Object.entries(giftSubs)
        .filter(([u]) => !isAdmin(u))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([user, count]) => `${user} (${count} Subs)`);

    // ── 30 Tage: Top SUB-Schenker ──
    const gifters30 = track30.gifters || {};
    result['twitch_gifters30'] = Object.entries(gifters30)
        .filter(([u]) => !isAdmin(u))
        .map(([user, events]) => [user, events.reduce((s, e) => s + (e.amount || 0), 0)])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([user, total]) => `${user} (${total} Subs)`);

    // ── Session: Neue Subs heute ──
    result['twitch_new_subs'] = (session.newSubs || []).filter(n => !isAdmin(n));

    // ── Session: Resubs heute ──
    result['twitch_resubs'] = (session.resubs || []).filter(n => !isAdmin(n));

    // ── Session: Alle Zuschauer heute ──
    result['twitch_viewers'] = (session.viewers || []).filter(n => !isAdmin(n));

    // ── Session: Aktivster Chatter ──
    const chatCount = session.chatCount || {};
    result['fd_active'] = Object.entries(chatCount)
        .filter(([u]) => !isAdmin(u))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1)
        .map(([user]) => user);

    // ── F$ Top 5 ──
    result['fd_top5'] = all
        .filter(u => u.credits > 0)
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 5)
        .map(u => `${u.username} (${u.credits} F$)`);

    // ── Duell-König ──
    result['fd_duel_king'] = all
        .filter(u => (u.duelWins || 0) > 0)
        .sort((a, b) => (b.duelWins || 0) - (a.duelWins || 0))
        .slice(0, 3)
        .map(u => `${u.username} (${u.duelWins} Siege)`);

    // ── Tapferster Verlierer ──
    result['fd_brave_loser'] = all
        .filter(u => (u.duelLosses || 0) > 0)
        .sort((a, b) => (b.duelLosses || 0) - (a.duelLosses || 0))
        .slice(0, 3)
        .map(u => `${u.username} (${u.duelLosses} Niederlagen)`);

    // ── Großzügigster ──
    result['fd_generous'] = all
        .filter(u => (u.gifted || 0) > 0)
        .sort((a, b) => (b.gifted || 0) - (a.gifted || 0))
        .slice(0, 3)
        .map(u => `${u.username} (${u.gifted} F$ verschenkt)`);

    // ── Sendezeit ──
    result['_broadcastTime'] = calcBroadcastTime(session.startTime);

    // ── Meist benutztes FaireWelt-Icon ──
    const iconCount = session.iconCount || {};
    const topIcon = Object.entries(iconCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1)
        .map(([icon, count]) => `${icon} (${count}×)`);
    result['_topIcon'] = topIcon[0] || null;

    return result;
}

// ── Routes ──
router.get('/config',  (req, res) => res.json(readConfig()));
router.post('/config', (req, res) => {
    try {
        const body = req.body || {};
        const cfg  = readConfig();
        Object.keys(body).forEach(k => { cfg[k] = body[k]; });
        res.json({ ok: writeConfig(cfg) });
    } catch(e) { res.json({ ok: false, error: e.message }); }
});

router.post('/raid', (req, res) => {
    const cfg    = readConfig();
    const target = (req.body?.raidTarget || '').trim();
    cfg.raidTarget = target;
    if (target) {
        cfg.recentRaidTargets = [target, ...(cfg.recentRaidTargets || []).filter(n => n !== target)].slice(0, 5);
    }
    res.json({ ok: writeConfig(cfg) });
});

router.post('/start',  (req, res) => { const cfg = readConfig(); cfg.running = true;  res.json({ ok: writeConfig(cfg) }); });
router.post('/stop',   (req, res) => { const cfg = readConfig(); cfg.running = false; res.json({ ok: writeConfig(cfg) }); });
router.get('/status',  (req, res) => res.json({ running: readConfig().running || false }));

router.get('/fonts', (req, res) => {
    try {
        if (!fs.existsSync(FONTS_DIR)) return res.json({ localFonts: [] });
        const localFonts = fs.readdirSync(FONTS_DIR)
            .filter(f => /\.(ttf|otf|woff|woff2)$/i.test(f))
            .map(f => ({ name: f.replace(/\.[^.]+$/, ''), file: f }));
        res.json({ localFonts });
    } catch { res.json({ localFonts: [] }); }
});

router.get('/data', async (req, res) => {
    try { res.json(await collectCreditsData()); }
    catch(e) { console.error('[credits_api] data error:', e.message); res.json({}); }
});

router.post('/sections', (req, res) => {
    const cfg = readConfig();
    cfg.sections = req.body || DEFAULT_SECTIONS;
    res.json({ ok: writeConfig(cfg) });
});

module.exports = router;
