// /home/fynn/TwitchOBSAdmin/backend/credits_api.js
require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const fetch   = require('node-fetch');
const router  = express.Router();

const ROOT        = path.join(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'data', 'credits_config.json');
const CREDITS_DIR = path.join(ROOT, 'data', 'credits');
const FONTS_DIR   = path.join(ROOT, 'public', 'fonts');

const CLIENT_ID      = process.env.CLIENT_ID;
const USER_TOKEN     = process.env.TWITCH_USER_TOKEN;
const BROADCASTER_ID = process.env.BROADCASTER_ID;

const DEFAULT_SECTIONS = [
    { id: 'twitch_subs',      title: 'Subscriber',              type: 'twitch', enabled: true  },
    { id: 'twitch_vips',      title: 'VIPs',                    type: 'twitch', enabled: true  },
    { id: 'twitch_mods',      title: 'Moderatoren',             type: 'twitch', enabled: true  },
    { id: 'twitch_bits',      title: 'Top Bits-Spender',        type: 'twitch', enabled: true  },
    { id: 'twitch_followers', title: 'Neue Follower',           type: 'twitch', enabled: false },
    { id: 'fd_top5',          title: '🏆 Top 5 Füchse',         type: 'fd',     enabled: true  },
    { id: 'fd_duel_king',     title: '⚔️ Duell-König',          type: 'fd',     enabled: true  },
    { id: 'fd_brave_loser',   title: '💀 Tapferster Verlierer', type: 'fd',     enabled: true  },
    { id: 'fd_generous',      title: '🎁 Großzügigster Fuchs',  type: 'fd',     enabled: true  },
    { id: 'fd_active',        title: '🗣️ Aktivster Fuchs',      type: 'fd',     enabled: true  },
];

const DEFAULT_CONFIG = {
    headline: 'FaireWelt', subtitle: 'Danke für einen wunderbaren Stream!',
    farewell: 'Bis zum nächsten Mal 🦊',
    raidText: 'Wir raiden heute @[Twitchname] — kommt alle mit!',
    raidTarget: '', recentRaidTargets: [],
    logo1: '', logo2: '', background: '',
    fontFamily: 'Segoe UI', textColor: '#ffffff',
    fontSizeHeadline: 64, fontSizeSubtitle: 32, fontSizeCategory: 28, fontSizeNames: 22,
    shadowColor: '#000000', shadowBlur: 6, shadowOffset: 2, scrollSpeed: 0.8,
    sections: DEFAULT_SECTIONS, running: false
};

function ensureConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
}

function readConfig() {
    ensureConfig();
    try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (!cfg.sections) cfg.sections = DEFAULT_SECTIONS;
        return cfg;
    } catch { return { ...DEFAULT_CONFIG }; }
}

function writeConfig(cfg) {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); return true; }
    catch { return false; }
}

function twitchHeaders() {
    return { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${USER_TOKEN}` };
}

async function twitchGet(url) {
    try {
        const res = await fetch(url, { headers: twitchHeaders() });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

async function getAllPages(url) {
    const results = []; let cursor = null; let pages = 0;
    do {
        const data = await twitchGet(cursor ? `${url}&after=${cursor}` : url);
        if (!data?.data) break;
        results.push(...data.data);
        cursor = data.pagination?.cursor;
        pages++;
    } while (cursor && pages < 5);
    return results;
}

function getFDData() {
    try {
        if (!fs.existsSync(CREDITS_DIR)) return [];
        return fs.readdirSync(CREDITS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => { try { return JSON.parse(fs.readFileSync(path.join(CREDITS_DIR, f), 'utf8')); } catch { return null; } })
            .filter(d => d && d.username && typeof d.credits === 'number' && d.credits < 999999999)
            .sort((a, b) => b.credits - a.credits);
    } catch { return []; }
}

function getDuelStats() {
    try {
        const file = path.join(ROOT, 'data', 'duels.json');
        if (!fs.existsSync(file)) return {};
        return JSON.parse(fs.readFileSync(file, 'utf8')).stats || {};
    } catch { return {}; }
}

async function collectCreditsData() {
    const result = {};

    try {
        const data = await twitchGet(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${BROADCASTER_ID}&first=100`);
        result.twitch_subs = (data?.data || []).filter(s => s.user_id !== BROADCASTER_ID).map(s => s.user_name);
    } catch { result.twitch_subs = []; }

    try {
        const data = await getAllPages(`https://api.twitch.tv/helix/channels/vips?broadcaster_id=${BROADCASTER_ID}&first=100`);
        result.twitch_vips = data.map(v => v.user_name);
    } catch { result.twitch_vips = []; }

    try {
        const data = await getAllPages(`https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${BROADCASTER_ID}&first=100`);
        result.twitch_mods = data.map(m => m.user_name);
    } catch { result.twitch_mods = []; }

    try {
        const data = await twitchGet(`https://api.twitch.tv/helix/bits/leaderboard?count=10&broadcaster_id=${BROADCASTER_ID}`);
        result.twitch_bits = (data?.data || []).map(b => `${b.user_name}: ${b.score.toLocaleString()} Bits`);
    } catch { result.twitch_bits = []; }

    try {
        const data = await twitchGet(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${BROADCASTER_ID}&first=20`);
        result.twitch_followers = (data?.data || []).map(f => f.user_name);
    } catch { result.twitch_followers = []; }

    const fdData = getFDData();
    result.fd_top5 = fdData.slice(0, 5).map((d, i) =>
        `${['🥇','🥈','🥉','4.','5.'][i]} ${d.username} — ${d.credits.toLocaleString()} F$`
    );

    const duelStats   = getDuelStats();
    const duelEntries = Object.entries(duelStats)
        .map(([user, s]) => ({ user, wins: s.wins||0, losses: s.losses||0, draws: s.draws||0, earned: s.earned||0 }))
        .filter(s => s.wins + s.losses + s.draws > 0);

    const duelKing = [...duelEntries].sort((a,b) => b.wins - a.wins)[0];
    result.fd_duel_king = duelKing
        ? [`@${duelKing.user} — ${duelKing.wins} Siege aus ${duelKing.wins+duelKing.losses+duelKing.draws} Duellen (+${duelKing.earned.toLocaleString()} F$)`]
        : ['Noch keine Duelle bestritten'];

    const braveLoser = [...duelEntries].sort((a,b) => b.losses - a.losses)[0];
    result.fd_brave_loser = (braveLoser && braveLoser.losses > 0)
        ? [`@${braveLoser.user} — ${braveLoser.losses} Niederlagen, aber immer wieder aufgestanden! 💪`]
        : ['Noch keine Niederlagen'];

    const generous = fdData.length >= 3 ? fdData[Math.floor(fdData.length/2)] : fdData[0];
    result.fd_generous = generous ? [`@${generous.username} — immer großzügig unterwegs 🎁`] : [];

    const active = fdData[0];
    result.fd_active = active ? [`@${active.username} ist der aktivste Fuchs im Bau! 🦊`] : [];

    return result;
}

// ── Fonts: gibt Name + Dateiname zurück ──
function getAvailableFonts() {
    const systemFonts = [
        'Segoe UI','Arial','Verdana','Tahoma','Georgia',
        'Times New Roman','Courier New','Impact','Comic Sans MS',
        'Trebuchet MS','Palatino','Garamond'
    ];

    const localFonts = [];
    if (fs.existsSync(FONTS_DIR)) {
        fs.readdirSync(FONTS_DIR)
            .filter(f => /\.(ttf|otf|woff|woff2)$/i.test(f))
            .forEach(f => {
                localFonts.push({
                    name: f.replace(/\.(ttf|otf|woff|woff2)$/i, ''),
                    file: f   // <-- kompletter Dateiname mit Extension
                });
            });
    }
    return { systemFonts, localFonts };
}

// ── Routes ──
router.get('/config',  (req, res) => res.json(readConfig()));
router.post('/config', (req, res) => { const cfg = readConfig(); Object.assign(cfg, req.body||{}); res.json({ ok: writeConfig(cfg) }); });

router.post('/raid', (req, res) => {
    const cfg = readConfig();
    const target = (req.body?.raidTarget || '').trim();
    cfg.raidTarget = target;
    if (target) cfg.recentRaidTargets = [target, ...(cfg.recentRaidTargets||[]).filter(n=>n!==target)].slice(0,5);
    res.json({ ok: writeConfig(cfg) });
});

router.post('/start',  (req, res) => { const cfg = readConfig(); cfg.running = true;  res.json({ ok: writeConfig(cfg) }); });
router.post('/stop',   (req, res) => { const cfg = readConfig(); cfg.running = false; res.json({ ok: writeConfig(cfg) }); });
router.get('/status',  (req, res) => res.json({ running: readConfig().running || false }));
router.get('/fonts',   (req, res) => res.json(getAvailableFonts()));
router.get('/data',    async (req, res) => { try { res.json(await collectCreditsData()); } catch(e) { res.json({}); } });
router.post('/sections',(req, res) => { const cfg = readConfig(); cfg.sections = req.body||DEFAULT_SECTIONS; res.json({ ok: writeConfig(cfg) }); });

module.exports = router;
