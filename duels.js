// backend/duels.js
// Komplettes Duell-System für TwitchOBSAdmin (FULL POWER)

const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();

const DUEL_CONFIG_FILE = path.join(__dirname, "..", "data", "duels.json");

// Falls Datei fehlt → Standardwerte erzeugen
if (!fs.existsSync(DUEL_CONFIG_FILE)) {
    fs.writeFileSync(
        DUEL_CONFIG_FILE,
        JSON.stringify({
            minBet: 10,
            maxBet: 100000,
            cooldown: 30,        // Sekunden zwischen Duellen pro User
            acceptTimeout: 30,   // Sekunden zum Annehmen

            vipWinChance: 0.15,
            modWinChance: 0.20,
            subWinChance: 0.10,
            adminWinChance: 0.30,

            vipLoseBonus: 1.5,
            modLoseBonus: 2.0,
            adminLoseBonus: 3.0,
            subBonus: 1.5,

            stats: {}
        }, null, 2)
    );
}

function loadConfig() {
    return JSON.parse(fs.readFileSync(DUEL_CONFIG_FILE, "utf8"));
}

function saveConfig(cfg) {
    fs.writeFileSync(DUEL_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getStatsEntry(cfg, user) {
    if (!cfg.stats[user]) {
        cfg.stats[user] = {
            wins: 0,
            losses: 0,
            earned: 0,
            lost: 0
        };
    }
    return cfg.stats[user];
}

// Aktive Duelle / Cooldowns
const pendingDuels = new Map(); // key: targetUser → duelData
const activeDuels = new Map();  // key: challenger/opponent → duelData
const cooldowns = new Map();    // key: user → timestamp

let bot = null;

// ------------------------------------------------------------
// API ROUTES
// ------------------------------------------------------------

// GET Einstellungen + Stats
router.get("/", (req, res) => {
    const cfg = loadConfig();
    res.json(cfg);
});

// POST Einstellungen speichern (ohne stats überschreiben, wenn nicht mitgeschickt)
router.post("/", (req, res) => {
    const cfg = loadConfig();
    const body = req.body || {};
    const keepStats = cfg.stats || {};
    Object.assign(cfg, body);
    if (!body.stats) cfg.stats = keepStats;
    saveConfig(cfg);
    res.json({ ok: true });
});

// Reset Stats
router.post("/reset-stats", (req, res) => {
    const cfg = loadConfig();
    cfg.stats = {};
    saveConfig(cfg);
    res.json({ ok: true });
});

// Offene Duelle abbrechen
router.post("/abort", (req, res) => {
    for (const duel of pendingDuels.values()) {
        if (duel.timeout) clearTimeout(duel.timeout);
    }
    pendingDuels.clear();
    activeDuels.clear();
    res.json({ ok: true });
});

// ------------------------------------------------------------
// BOT ANBINDUNG
// ------------------------------------------------------------

function attachBot(twitchBot) {
    bot = twitchBot;

    bot.onMessage(async (msg) => {
        const user = msg.user;
        const text = (msg.text || "").trim();

        if (!text.startsWith("+")) return; // nur + Befehle interessieren uns

        // +duel
        if (text.toLowerCase().startsWith("+duel")) {
            handleDuelCommand(user, text);
            return;
        }

        // +j (annehmen)
        if (text.toLowerCase() === "+j") {
            handleAccept(user);
            return;
        }

        // +n (ablehnen)
        if (text.toLowerCase() === "+n") {
            handleDecline(user);
            return;
        }
    });
}

// ------------------------------------------------------------
// DUELL-LOGIK
// ------------------------------------------------------------

async function handleDuelCommand(user, text) {
    const cfg = loadConfig();
    const now = Date.now();

    // Cooldown prüfen
    if (cooldowns.has(user)) {
        const diff = now - cooldowns.get(user);
        if (diff < cfg.cooldown * 1000) {
            const rest = Math.ceil((cfg.cooldown * 1000 - diff) / 1000);
            whisper(user, `Du musst noch ${rest}s warten, bevor du erneut ein Duell starten kannst.`);
            return;
        }
    }
    cooldowns.set(user, now);

    const parts = text.split(/\s+/);
    const bet = Number(parts[1]);
    const targetRaw = parts[2] || null;
    const target = targetRaw ? targetRaw.replace("@", "").toLowerCase() : null;

    // Einsatz prüfen
    if (!bet || bet < cfg.minBet || bet > cfg.maxBet) {
        whisper(user, `Ungültiger Einsatz. Erlaubt: ${cfg.minBet} - ${cfg.maxBet} Fuchsdukaten.`);
        return;
    }

    const userBalance = await bot.getBalance(user);
    if (userBalance < bet) {
        whisper(user, `Du hast nicht genug Fuchsdukaten. Aktuell: ${userBalance}, benötigt: ${bet}.`);
        return;
    }

    // Offenes Duell (kein Ziel angegeben)
    if (!target) {
        const duel = {
            challenger: user,
            bet,
            target: null,
            createdAt: now,
            timeout: null
        };

        duel.timeout = setTimeout(() => {
            pendingDuels.delete(user);
            whisper(user, "Niemand hat dein offenes Duell angenommen. Duell abgebrochen.");
        }, cfg.acceptTimeout * 1000);

        pendingDuels.set(user, duel);
        bot.say(`Offenes Duell von ${user} über ${bet} Fuchsdukaten! Der erste Follower, der +j schreibt, nimmt teil!`);
        return;
    }

    // Direktes Duell
    const targetBalance = await bot.getBalance(target);
    if (targetBalance < bet) {
        whisper(user, `Der Gegner hat nicht genug Fuchsdukaten für dieses Duell.`);
        return;
    }

    const duel = {
        challenger: user,
        bet,
        target,
        createdAt: now,
        timeout: null
    };

    duel.timeout = setTimeout(() => {
        pendingDuels.delete(target);
        whisper(user, `Der Gegner (${target}) hat dein Duell nicht rechtzeitig angenommen.`);
    }, cfg.acceptTimeout * 1000);

    pendingDuels.set(target, duel);
    whisper(target, `${user} hat dich zu einem Duell über ${bet} Fuchsdukaten herausgefordert! Antworte mit +j (annehmen) oder +n (ablehnen).`);
}

async function handleAccept(user) {
    const duel = pendingDuels.get(user);

    if (!duel) {
        whisper(user, "Es liegt kein Duell für dich vor oder die Zeit ist abgelaufen.");
        return;
    }

    clearTimeout(duel.timeout);
    pendingDuels.delete(user);

    duel.accepted = true;
    duel.opponent = user;

    activeDuels.set(duel.challenger, duel);
    activeDuels.set(duel.opponent, duel);

    await startDuel(duel);
}

async function handleDecline(user) {
    const duel = pendingDuels.get(user);
    if (!duel) return;

    clearTimeout(duel.timeout);
    pendingDuels.delete(user);

    whisper(duel.challenger, `${user} hat dein Duell abgelehnt.`);
    whisper(user, `Du hast das Duell von ${duel.challenger} abgelehnt.`);
}

async function startDuel(duel) {
    const cfg = loadConfig();

    const challenger = duel.challenger;
    const opponent = duel.opponent;
    const bet = duel.bet;

    // Siegchance berechnen
    let challengerChance = 0.5;
    let opponentChance = 0.5;

    const challengerInfo = await bot.getUserInfo(challenger);
    const opponentInfo = await bot.getUserInfo(opponent);

    // Rollen-Boni auf Siegchance
    if (challengerInfo.isVIP) challengerChance += cfg.vipWinChance;
    if (challengerInfo.isMod) challengerChance += cfg.modWinChance;
    if (challengerInfo.isSub) challengerChance += cfg.subWinChance;
    if (challengerInfo.isAdmin) challengerChance += cfg.adminWinChance;

    if (opponentInfo.isVIP) opponentChance += cfg.vipWinChance;
    if (opponentInfo.isMod) opponentChance += cfg.modWinChance;
    if (opponentInfo.isSub) opponentChance += cfg.subWinChance;
    if (opponentInfo.isAdmin) opponentChance += cfg.adminWinChance;

    // Normalisieren
    const total = challengerChance + opponentChance;
    challengerChance /= total;
    opponentChance /= total;

    const rnd = Math.random();
    const winner = rnd < challengerChance ? challenger : opponent;
    const loser = winner === challenger ? opponent : challenger;

    let winAmount = bet;

    // SUB Bonus
    const winnerInfo = winner === challenger ? challengerInfo : opponentInfo;
    const loserInfo = winner === challenger ? opponentInfo : challengerInfo;

    if (winnerInfo.isSub) {
        winAmount *= cfg.subBonus;
    }

    // Bonus gegen VIP/MOD/Admin
    if (loserInfo.isVIP) winAmount *= cfg.vipLoseBonus;
    if (loserInfo.isMod) winAmount *= cfg.modLoseBonus;
    if (loserInfo.isAdmin) winAmount *= cfg.adminLoseBonus;

    // Auszahlung
    await bot.addBalance(winner, winAmount);
    await bot.addBalance(loser, -bet);

    // Stats aktualisieren
    const cfgAfter = loadConfig();
    const winnerStats = getStatsEntry(cfgAfter, winner);
    const loserStats = getStatsEntry(cfgAfter, loser);

    winnerStats.wins += 1;
    winnerStats.earned += winAmount;

    loserStats.losses += 1;
    loserStats.lost += bet;

    saveConfig(cfgAfter);

    // Aktive Duelle aufräumen
    activeDuels.delete(challenger);
    activeDuels.delete(opponent);

    bot.say(`${winner} gewinnt das Duell gegen ${loser} und erhält ${winAmount} Fuchsdukaten!`);
}

// ------------------------------------------------------------
// WHISPER HELFER
// ------------------------------------------------------------

function whisper(user, msg) {
    if (!bot) return;
    try {
        bot.whisper(user, msg);
    } catch (e) {
        // Fallback: im Chat markieren
        try {
            bot.say(`@${user} ${msg}`);
        } catch {
            // ignore
        }
    }
}

// ------------------------------------------------------------

module.exports = {
    router,
    attachBot
};


