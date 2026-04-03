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
