// /home/fynn/TwitchOBSAdmin/backend/duels.js

const fs      = require('fs');
const path    = require('path');
const express = require('express');
const router  = express.Router();

const DUEL_CONFIG_FILE = path.join(__dirname, '..', 'data', 'duels.json');

const DEFAULT_CONFIG = {
    minBet:         10,
    maxBet:         100000,
    cooldown:       30,
    acceptTimeout:  30,
    maxActive:      3,

    // Siegchance in Prozent (wird intern /100 gerechnet)
    vipWinChance:   10,
    modWinChance:   15,
    subWinChance:   5,
    adminWinChance: 25,

    // Verlier-Bonus als Faktor
    vipLoseBonus:   1.5,
    modLoseBonus:   2.0,
    adminLoseBonus: 3.0,
    subBonus:       1.5,

    stats: {}
};

if (!fs.existsSync(DUEL_CONFIG_FILE)) {
    fs.mkdirSync(path.dirname(DUEL_CONFIG_FILE), { recursive: true });
    fs.writeFileSync(DUEL_CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

function loadConfig() {
    try {
        const cfg = JSON.parse(fs.readFileSync(DUEL_CONFIG_FILE, 'utf8'));
        // Migration: alte Kommazahlen auf Prozent umrechnen
        ['vipWinChance','modWinChance','subWinChance','adminWinChance'].forEach(k => {
            if (cfg[k] !== undefined && cfg[k] < 1) cfg[k] = Math.round(cfg[k] * 100);
        });
        return cfg;
    } catch (e) {
        return { ...DEFAULT_CONFIG };
    }
}

function saveConfig(cfg) {
    fs.writeFileSync(DUEL_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getStatsEntry(cfg, user) {
    if (!cfg.stats[user]) {
        cfg.stats[user] = { wins: 0, losses: 0, draws: 0, earned: 0, lost: 0 };
    }
    return cfg.stats[user];
}

const pendingDuels = new Map();
const activeDuels  = new Map();
const cooldowns    = new Map();
let bot = null;

// ============================================================
// API ROUTES
// ============================================================

router.get('/', (req, res) => {
    const cfg = loadConfig();
    res.json({
        ...cfg,
        activeCount:  Math.floor(activeDuels.size / 2),
        pendingCount: pendingDuels.size
    });
});

router.post('/', (req, res) => {
    const cfg       = loadConfig();
    const body      = req.body || {};
    const keepStats = cfg.stats || {};
    Object.assign(cfg, body);
    if (!body.stats) cfg.stats = keepStats;
    saveConfig(cfg);
    res.json({ ok: true });
});

router.post('/reset-stats', (req, res) => {
    const cfg = loadConfig();
    cfg.stats = {};
    saveConfig(cfg);
    res.json({ ok: true });
});

router.post('/abort', (req, res) => {
    for (const duel of pendingDuels.values()) {
        if (duel.timeout) clearTimeout(duel.timeout);
    }
    pendingDuels.clear();
    activeDuels.clear();
    say('Alle laufenden Duelle wurden vom Admin abgebrochen.');
    res.json({ ok: true });
});

router.get('/active', (req, res) => {
    const pending = [...pendingDuels.values()].map(d => ({
        type:       d.target ? 'direkt' : 'offen',
        challenger: d.challenger,
        target:     d.target || '(offen)',
        bet:        d.bet,
        since:      Math.floor((Date.now() - d.createdAt) / 1000)
    }));
    res.json({ pending });
});

// ============================================================
// HELPERS
// ============================================================

function say(msg) {
    if (!bot) return;
    try { bot.say(msg); } catch (e) { }
}

function countActiveDuels() {
    return Math.floor(activeDuels.size / 2) + pendingDuels.size;
}

function isInDuel(user) {
    return activeDuels.has(user) ||
        [...pendingDuels.values()].some(d => d.challenger === user || d.target === user);
}

// ============================================================
// BOT
// ============================================================

function attachBot(twitchBot) {
    bot = twitchBot;
    bot.onMessage(async (msg) => {
        const user    = (msg.username || msg.user || '').toLowerCase();
        const text    = (msg.text || '').trim();
        const isAdmin = msg.isAdmin || false;
        if (!text.startsWith('+')) return;
        const lower = text.toLowerCase();
        if (lower.startsWith('+duel'))  { await handleDuelCommand(user, text, isAdmin); return; }
        if (lower === '+j')             { await handleAccept(user, isAdmin);             return; }
        if (lower === '+n')             { await handleDecline(user);                     return; }
        if (lower === '+duelstats')     { await handleDuelStats(user);                   return; }
    });
}

// ============================================================
// +duel
// ============================================================

async function handleDuelCommand(user, text, isAdmin) {
    const cfg = loadConfig();
    const now = Date.now();

    if (countActiveDuels() >= cfg.maxActive) {
        say(`@${user} Gerade laufen bereits ${cfg.maxActive} Duelle — warte kurz! ⚔️`); return;
    }
    if (isInDuel(user)) {
        say(`@${user} Du bist bereits in einem Duell!`); return;
    }
    if (cooldowns.has(user)) {
        const diff = now - cooldowns.get(user);
        if (diff < cfg.cooldown * 1000) {
            const rest = Math.ceil((cfg.cooldown * 1000 - diff) / 1000);
            say(`@${user} Noch ${rest}s Cooldown! ⏳`); return;
        }
    }

    const parts  = text.split(/\s+/);
    const bet    = Number(parts[1]);
    const target = parts[2] ? parts[2].replace('@', '').toLowerCase() : null;

    if (!bet || isNaN(bet) || bet < cfg.minBet || bet > cfg.maxBet) {
        say(`@${user} Ungültiger Einsatz. Erlaubt: ${cfg.minBet}–${cfg.maxBet} F$ 🦊`); return;
    }

    if (!isAdmin) {
        const bal = await bot.getBalance(user);
        if (bal < bet) { say(`@${user} Nicht genug F$! Du hast ${bal} F$. 🦊`); return; }
    }

    if (target && target === user) {
        say(`@${user} Du kannst dich nicht selbst herausfordern! 🦊`); return;
    }

    cooldowns.set(user, now);

    if (!target) {
        const duel = { id: `${user}_${now}`, challenger: user, bet, target: null, createdAt: now, isAdminDuel: isAdmin, timeout: null };
        duel.timeout = setTimeout(() => {
            pendingDuels.delete(user);
            say(`@${user} Niemand hat dein Duell angenommen. Abgebrochen. ⚔️`);
        }, cfg.acceptTimeout * 1000);
        pendingDuels.set(user, duel);
        say(`⚔️ Offenes Duell von @${user} über ${bet} F$! Wer nimmt es an? → +j (${cfg.acceptTimeout}s)`);
        return;
    }

    const targetBal = await bot.getBalance(target);
    if (targetBal < bet) { say(`@${user} @${target} hat nicht genug F$!`); return; }

    const duel = { id: `${user}_${now}`, challenger: user, bet, target, createdAt: now, isAdminDuel: isAdmin, timeout: null };
    duel.timeout = setTimeout(() => {
        pendingDuels.delete(target);
        say(`@${user} @${target} hat dein Duell nicht angenommen. ⚔️`);
    }, cfg.acceptTimeout * 1000);
    pendingDuels.set(target, duel);
    say(`⚔️ @${target} wurde von @${user} zu einem Duell über ${bet} F$ herausgefordert! → +j annehmen | +n ablehnen (${cfg.acceptTimeout}s)`);
}

// ============================================================
// +j
// ============================================================

async function handleAccept(user, isAdmin) {
    if (isAdmin) { say(`@${user} Als Admin kannst du keine Duelle annehmen — nur herausfordern! 👑`); return; }

    let duel = pendingDuels.get(user);
    if (!duel) {
        for (const [key, d] of pendingDuels.entries()) {
            if (!d.target && d.challenger !== user) { duel = d; pendingDuels.delete(key); break; }
        }
    } else {
        pendingDuels.delete(user);
    }

    if (!duel) { say(`@${user} Kein Duell verfügbar. ⚔️`); return; }

    const bal = await bot.getBalance(user);
    if (bal < duel.bet) {
        say(`@${user} Nicht genug F$! (${bal} / ${duel.bet} F$)`);
        pendingDuels.set(duel.target || duel.challenger, duel);
        return;
    }

    clearTimeout(duel.timeout);
    duel.opponent = user;
    activeDuels.set(duel.challenger, duel);
    activeDuels.set(duel.opponent,   duel);
    say(`⚔️ @${duel.challenger} vs @${user} — Duell beginnt! Einsatz: ${duel.bet} F$ 🦊`);
    await startDuel(duel);
}

// ============================================================
// +n
// ============================================================

async function handleDecline(user) {
    const duel = pendingDuels.get(user);
    if (!duel) return;
    clearTimeout(duel.timeout);
    pendingDuels.delete(user);
    say(`@${user} hat das Duell von @${duel.challenger} abgelehnt.`);
}

// ============================================================
// DUELL AUSWERTEN
// ============================================================

async function startDuel(duel) {
    const cfg        = loadConfig();
    const challenger = duel.challenger;
    const opponent   = duel.opponent;
    const bet        = duel.bet;

    const cInfo = await bot.getUserInfo(challenger);
    const oInfo = await bot.getUserInfo(opponent);

    // Siegchance: Prozent → Dezimal
    let cChance = 0.5 + (cInfo.isAdmin ? cfg.adminWinChance/100 : 0) + (cInfo.isMod ? cfg.modWinChance/100 : 0) + (cInfo.isVIP ? cfg.vipWinChance/100 : 0) + (cInfo.isSub ? cfg.subWinChance/100 : 0);
    let oChance = 0.5 + (oInfo.isAdmin ? cfg.adminWinChance/100 : 0) + (oInfo.isMod ? cfg.modWinChance/100 : 0) + (oInfo.isVIP ? cfg.vipWinChance/100 : 0) + (oInfo.isSub ? cfg.subWinChance/100 : 0);

    const total  = cChance + oChance;
    cChance     /= total;
    oChance     /= total;

    // Unentschieden: gleiche Chancen + 15% Zufallschance
    const isDraw = Math.abs(cChance - oChance) < 0.001 && Math.random() < 0.15;
    if (isDraw) {
        activeDuels.delete(challenger);
        activeDuels.delete(opponent);
        const cfg2 = loadConfig();
        getStatsEntry(cfg2, challenger).draws = (cfg2.stats[challenger]?.draws || 0) + 1;
        getStatsEntry(cfg2, opponent).draws   = (cfg2.stats[opponent]?.draws   || 0) + 1;
        saveConfig(cfg2);
        say(`⚔️ Unentschieden! @${challenger} und @${opponent} bekommen ihren Einsatz zurück. 🤝`);
        return;
    }

    const winner     = Math.random() < cChance ? challenger : opponent;
    const loser      = winner === challenger ? opponent : challenger;
    const winnerInfo = winner === challenger ? cInfo : oInfo;
    const loserInfo  = winner === challenger ? oInfo : cInfo;

    let winAmount = bet;
    if (winnerInfo.isSub)  winAmount *= cfg.subBonus;
    if (loserInfo.isVIP)   winAmount *= cfg.vipLoseBonus;
    if (loserInfo.isMod)   winAmount *= cfg.modLoseBonus;
    if (loserInfo.isAdmin) winAmount *= cfg.adminLoseBonus;
    winAmount = Math.ceil(winAmount);

    await bot.addBalance(winner,  winAmount);
    await bot.addBalance(loser,  -bet);

    const cfg2        = loadConfig();
    const wStats      = getStatsEntry(cfg2, winner);
    const lStats      = getStatsEntry(cfg2, loser);
    wStats.wins       = (wStats.wins   || 0) + 1;
    wStats.earned     = (wStats.earned || 0) + winAmount;
    lStats.losses     = (lStats.losses || 0) + 1;
    lStats.lost       = (lStats.lost   || 0) + bet;
    saveConfig(cfg2);

    activeDuels.delete(challenger);
    activeDuels.delete(opponent);
    say(`🏆 @${winner} gewinnt das Duell gegen @${loser} und erhält ${winAmount} F$! 🦊`);
}

// ============================================================
// +duelstats
// ============================================================

async function handleDuelStats(user) {
    const cfg   = loadConfig();
    const stats = cfg.stats?.[user];
    if (!stats || (stats.wins === 0 && stats.losses === 0 && stats.draws === 0)) {
        say(`@${user} Du hast noch keine Duelle bestritten. ⚔️`); return;
    }
    const total = (stats.wins || 0) + (stats.losses || 0) + (stats.draws || 0);
    say(`⚔️ @${user} — ${total} Duelle | 🏆 ${stats.wins||0} Siege | 💀 ${stats.losses||0} Niederlagen | 🤝 ${stats.draws||0} Unentschieden | +${stats.earned||0} F$ / -${stats.lost||0} F$`);
}

module.exports = { router, attachBot };
