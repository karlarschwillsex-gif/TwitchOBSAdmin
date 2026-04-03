// /home/fynn/TwitchOBSAdmin/backend/credits_api.js
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();
router.use(express.json({ limit: '5mb' }));

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'credits_config.json');

const DEFAULT_CONFIG = {
    headline:          'FaireWelt',
    subtitle:          'Danke für einen wunderbaren Stream!',
    farewell:          'Bis zum nächsten Mal 🦊',
    raidText:          'Wir raiden heute @[Twitchname] — kommt alle mit!',
    raidTarget:        '',
    recentRaidTargets: [],
    logo1:             '',
    logo2:             '',
    fontFamily:        'Segoe UI',
    textColor:         '#ffffff',
    fontSizeHeadline:  48,
    fontSizeSubtitle:  28,
    fontSizeCategory:  24,
    fontSizeNames:     20,
    shadowColor:       '#000000',
    shadowBlur:        4,
    shadowOffset:      2,
    scrollSpeed:       0.5,
    logoHeight:        120,
    categories:        ['Subscriber', 'VIP', 'Moderator', 'Cheerer', 'Top Chatters'],
    running:           false
};

function ensureConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
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

// GET /credits_api/config
router.get('/config', (req, res) => res.json(readConfig()));

// POST /credits_api/config
router.post('/config', (req, res) => {
    const cfg = readConfig();
    const b   = req.body || {};
    Object.assign(cfg, b);
    res.json({ ok: writeConfig(cfg) });
});

// POST /credits_api/raid — Raid-Ziel setzen
router.post('/raid', (req, res) => {
    const cfg    = readConfig();
    const target = (req.body?.raidTarget || '').trim();

    cfg.raidTarget = target;

    // Letzte 5 merken
    if (target) {
        cfg.recentRaidTargets = [target, ...(cfg.recentRaidTargets || []).filter(n => n !== target)].slice(0, 5);
    }

    res.json({ ok: writeConfig(cfg) });
});

// POST /credits_api/start
router.post('/start', (req, res) => {
    const cfg  = readConfig();
    cfg.running = true;
    res.json({ ok: writeConfig(cfg) });
});

// POST /credits_api/stop
router.post('/stop', (req, res) => {
    const cfg   = readConfig();
    cfg.running = false;
    res.json({ ok: writeConfig(cfg) });
});

// GET /credits_api/status
router.get('/status', (req, res) => {
    const cfg = readConfig();
    res.json({ running: cfg.running || false });
});

router.get('/data', async (req, res) => { try { res.json(await collectCreditsData()); } catch(e) { res.json({}); } });
module.exports = router;

// ── Hilfsfunktionen ──
const CREDITS_DIR = path.join(__dirname, '..', 'data', 'credits');
const FDBANK_FILE = path.join(__dirname, '..', 'data', 'fdbank.json');

function readAllCredits() {
    try {
        if (!fs.existsSync(CREDITS_DIR)) return [];
        return fs.readdirSync(CREDITS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => { try { return JSON.parse(fs.readFileSync(path.join(CREDITS_DIR, f), 'utf8')); } catch { return null; } })
            .filter(Boolean);
    } catch { return []; }
}

async function collectCreditsData() {
    const all = readAllCredits();
    const result = {};

    // F$ Top 5
    result['fd_top5'] = all
        .filter(u => u.credits > 0)
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 5)
        .map(u => u.username);

    // Duell-König (meiste Siege)
    result['fd_duel_king'] = all
        .filter(u => u.duelWins > 0)
        .sort((a, b) => b.duelWins - a.duelWins)
        .slice(0, 3)
        .map(u => u.username);

    // Tapferster Verlierer (meiste Niederlagen)
    result['fd_brave_loser'] = all
        .filter(u => u.duelLosses > 0)
        .sort((a, b) => b.duelLosses - a.duelLosses)
        .slice(0, 3)
        .map(u => u.username);

    // Großzügigster (meiste verschenkte F$)
    result['fd_generous'] = all
        .filter(u => u.gifted > 0)
        .sort((a, b) => b.gifted - a.gifted)
        .slice(0, 3)
        .map(u => u.username);

    // Aktivster (meiste Nachrichten)
    result['fd_active'] = all
        .filter(u => u.messages > 0)
        .sort((a, b) => b.messages - a.messages)
        .slice(0, 5)
        .map(u => u.username);

    return result;
}

router.get('/fonts', (req, res) => {
    try {
        const FONTS_DIR = path.join(__dirname, '..', 'public', 'fonts');
        if (!fs.existsSync(FONTS_DIR)) return res.json({ localFonts: [] });
        const localFonts = fs.readdirSync(FONTS_DIR)
            .filter(f => /\.(ttf|otf|woff|woff2)$/i.test(f))
            .map(f => ({ name: f.replace(/\.[^.]+$/, ''), file: f }));
        res.json({ localFonts });
    } catch { res.json({ localFonts: [] }); }
});

router.get('/data', async (req, res) => {
    try { res.json(await collectCreditsData()); }
    catch(e) { res.json({}); }
});
