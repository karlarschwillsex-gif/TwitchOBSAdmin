// /home/fynn/TwitchOBSAdmin/bot.js
require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const ROOT   = __dirname;
const LOGDIR = path.join(ROOT, 'logs');
if (!fs.existsSync(LOGDIR)) fs.mkdirSync(LOGDIR, { recursive: true });

const LOGFILE = path.join(LOGDIR, 'bot.log');
function writeLog(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
  try { fs.appendFileSync(LOGFILE, line); } catch (e) { }
  console.log(...parts);
}

/* ============================================================
   BOT CONFIG
   ============================================================ */
const cfgPath = path.join(ROOT, 'bot_config.json');
let botConfig = { botName: 'BottyFoxy', prefix: '+', owner: 'fairewelt', channel: 'fairewelt', whisperCommands: [] };
if (fs.existsSync(cfgPath)) {
  try {
    botConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    writeLog('bot_config.json geladen:', botConfig.botName || 'unnamed');
  } catch (err) { writeLog('Fehler beim Lesen bot_config.json:', err.message); }
}

/* ============================================================
   F$ ECONOMY ENGINE
   ============================================================ */
let economy = null;
try {
  economy = require('./backend/economy.js');
  writeLog('[bot] F$ Economy-Engine geladen');
} catch (err) { writeLog('[bot] WARNUNG: Economy-Engine nicht geladen:', err.message); }

/* ============================================================
   COMMANDS ENGINE
   ============================================================ */
let commands = null;
try {
  commands = require('./backend/commands.js');
  writeLog('[bot] Commands-Engine geladen');
} catch (err) { writeLog('[bot] WARNUNG: Commands-Engine nicht geladen:', err.message); }

/* ============================================================
   F$-BANK (Bits + SUB Kurse)
   ============================================================ */
const FDBANK_FILE = path.join(ROOT, 'data', 'fdbank.json');

function loadFDBank() {
  try {
    if (!fs.existsSync(FDBANK_FILE)) return { bits: [], subs: [] };
    return JSON.parse(fs.readFileSync(FDBANK_FILE, 'utf8'));
  } catch (e) { return { bits: [], subs: [] }; }
}

// Bits → F$ berechnen
function calcBitsFD(bits) {
  const bank = loadFDBank();
  const stufe = (bank.bits || []).find(b => bits >= b.from && bits <= b.to);
  if (!stufe) return { fd: bits, rate: 1.0 }; // Fallback 1:1
  return { fd: Math.ceil(bits * stufe.rate), rate: stufe.rate };
}

// SUB → F$ berechnen
function calcSubFD(tier, isResub, isGift) {
  const bank = loadFDBank();
  const subs = bank.subs || [];

  const tierMap = { '1000': 'tier1', '2000': 'tier2', '3000': 'tier3', 'Prime': 'tier1' };
  const tierId  = tierMap[String(tier)] || 'tier1';

  const tierRow    = subs.find(s => s.id === tierId);
  const resubRow   = subs.find(s => s.resub === true);
  const giftRow    = subs.find(s => s.gift  === true);

  if (isGift) return giftRow ? giftRow.fd : 600;

  let fd = tierRow ? tierRow.fd : 500;
  if (isResub && resubRow) fd += resubRow.fd;
  return fd;
}

/* ============================================================
   BIT-SOUNDS
   ============================================================ */
const BIT_SOUNDS_FILE = path.join(ROOT, 'data', 'bit_sounds.json');

function findBitSound(bits) {
  try {
    if (!fs.existsSync(BIT_SOUNDS_FILE)) return null;
    const list = JSON.parse(fs.readFileSync(BIT_SOUNDS_FILE, 'utf8'));
    return list.find(b => bits >= b.from && bits <= b.to) || null;
  } catch (e) { return null; }
}

/* ============================================================
   CREDENTIALS
   ============================================================ */
const TWITCH_BOT_TOKEN    = process.env.TWITCH_BOT_TOKEN    || null;
const TWITCH_BOT_USERNAME = botConfig.botName               || process.env.TWITCH_BOT_USERNAME || null;
const CHANNEL             = process.env.TWITCH_CHANNEL      || botConfig.channel               || null;
const SERVER_URL          = process.env.SERVER_URL          || `http://localhost:${process.env.PORT || 3000}`;

const useTmi = !!(TWITCH_BOT_TOKEN && TWITCH_BOT_USERNAME && CHANNEL);

/* ============================================================
   STUB MODUS
   ============================================================ */
if (!useTmi) {
  writeLog('INFO: Starte Bot im STUB-Modus.');
  setInterval(() => writeLog('[bot] STUB alive'), 60_000);
  try {
    const express = require('express');
    const app = express();
    app.get('/', (req, res) => res.send('Bot STUB läuft'));
    app.listen(parseInt(process.env.BOT_HEALTH_PORT || '9090', 10));
  } catch (e) { }
  process.on('SIGINT',  () => { process.exit(0); });
  process.on('SIGTERM', () => { process.exit(0); });
  module.exports = { mode: 'stub' };
  return;
}

/* ============================================================
   TMI.JS
   ============================================================ */
let tmi;
try {
  tmi = require('tmi.js');
} catch (err) {
  writeLog('ERROR: tmi.js nicht installiert.');
  process.exit(1);
}

const client = new tmi.Client({
  options: { debug: false },
  identity: { username: TWITCH_BOT_USERNAME, password: TWITCH_BOT_TOKEN },
  channels: [CHANNEL]
});

client.connect()
  .then(() => writeLog(`[bot] Verbunden als ${TWITCH_BOT_USERNAME} in Channel ${CHANNEL}`))
  .catch(err => { writeLog('[bot] Verbindung fehlgeschlagen:', err.message || err); process.exit(1); });

/* ============================================================
   ANTWORT HELPER
   ============================================================ */
async function reply(channel, username, cmd, message) {
  const whisperCmds = botConfig.whisperCommands || [];
  if (whisperCmds.includes(cmd)) {
    try { await client.whisper(username, message); }
    catch (e) { await client.say(channel, `@${username} ${message}`); }
  } else {
    await client.say(channel, `@${username} ${message}`);
  }
}

/* ============================================================
   BROADCAST AN OVERLAY
   ============================================================ */
async function broadcastSound(file, volume) {
  try {
    const fetch = require('node-fetch');
    await fetch(`${SERVER_URL}/api/overlay/broadcast`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type: 'sound:play', file, volume: volume / 100 })
    });
  } catch (e) { writeLog('[bot] Broadcast Fehler:', e.message); }
}

/* ============================================================
   F$ VERGEBEN HELPER
   ============================================================ */
function giveFD(username, amount) {
  if (!economy || amount <= 0) return;
  try {
    const data    = economy.readCredits(username);
    data.credits  = (data.credits || 0) + amount;
    data.username = username;
    economy.writeCredits(username, data);
    writeLog(`[bank] ${username} +${amount} F$`);
  } catch (e) { writeLog('[bank] Fehler:', e.message); }
}

/* ============================================================
   DUELL-SYSTEM
   ============================================================ */
try {
  const duels = require('./backend/duels');

  duels.attachBot({
    say:     (msg)       => client.say(CHANNEL, msg),
    whisper: (user, msg) => client.whisper(user, msg),

    onMessage: (handler) => {
      client.on('message', (channel, userstate, message, self) => {
        if (self) return;
        handler({
          user:     userstate['display-name'] || userstate.username,
          username: userstate.username,
          text:     message,
          isMod:    userstate.mod || false,
          isVIP:    userstate.badges?.vip === '1',
          isSub:    userstate.subscriber || false,
          isAdmin:  userstate.username === (botConfig.owner || '').toLowerCase()
        });
      });
    },

    async getBalance(user) {
      if (!economy) return 0;
      try { return economy.readCredits(user).credits || 0; }
      catch { return 0; }
    },

    async addBalance(user, amount) {
      if (!economy) return false;
      try {
        const data    = economy.readCredits(user);
        data.credits  = Math.max(0, (data.credits || 0) + amount);
        data.username = user;
        economy.writeCredits(user, data);
        return true;
      } catch { return false; }
    },

    async getUserInfo(user) {
      return { isVIP: false, isMod: false, isSub: false, isAdmin: user === (botConfig.owner || '').toLowerCase() };
    }
  });

  writeLog('[bot] Duell-System erfolgreich angebunden');
} catch (err) { writeLog('[bot] Fehler beim Laden von duels.js:', err.message || err); }

/* ============================================================
   CHAT-NACHRICHTEN → F$ + COMMANDS
   ============================================================ */
client.on('message', async (channel, userstate, message, self) => {
  if (self) return;

  const username = (userstate.username || '').toLowerCase();
  const isAdmin  = username === (botConfig.owner || '').toLowerCase();
  const isMod    = userstate.mod || false;
  const isVIP    = userstate.badges?.vip === '1';
  const isSub    = userstate.subscriber || false;

  // ── F$ für Chatnachricht ──
  if (economy) {
    try { economy.onChatMessage({ username, message, isAdmin, isMod, isVIP, isSub }); }
    catch (e) { writeLog('[bot] Economy Fehler:', e.message); }
  }

  // ── Commands ──
  const prefix = botConfig.prefix || '+';
  if (!message || !message.startsWith(prefix)) return;

  const parts = message.slice(prefix.length).trim().split(/\s+/);
  const cmd   = (parts[0] || '').toLowerCase();
  const args  = parts.slice(1);

  writeLog('[bot] Command:', cmd, 'von', username);

  try {

    if (cmd === 'ping') {
      await reply(channel, username, cmd, 'pong 🦊');
      return;
    }

    if (cmd === 'guthaben' || cmd === 'fd' || cmd === 'fuchsdollar') {
      if (economy) {
        const data = economy.readCredits(username);
        const bal  = isAdmin ? '∞' : (data.credits || 0);
        await reply(channel, username, cmd, `Du hast ${bal} F$ 🦊`);
      }
      return;
    }

    if (cmd === 'top') {
      if (economy) {
        try {
          const creditsDir = path.join(ROOT, 'data', 'credits');
          const files = fs.readdirSync(creditsDir).filter(f => f.endsWith('.json'));
          const all = files
            .map(f => { try { return JSON.parse(fs.readFileSync(path.join(creditsDir, f), 'utf8')); } catch { return null; } })
            .filter(d => d && d.username && typeof d.credits === 'number')
            .filter(d => d.credits < economy.ADMIN_BALANCE)
            .sort((a, b) => b.credits - a.credits)
            .slice(0, 5);
          if (all.length === 0) {
            await reply(channel, username, cmd, 'Noch keine F$ Daten.');
          } else {
            const text = all.map((d, i) => `${i + 1}. ${d.username}: ${d.credits} F$`).join(' | ');
            await reply(channel, username, cmd, `🏆 Top F$: ${text}`);
          }
        } catch (e) { writeLog('[bot] Fehler bei +top:', e.message); }
      }
      return;
    }

    if (cmd === 'gift' || cmd === 'give' || cmd === 'spende') {
      if (economy) {
        const target = (args[0] || '').replace('@', '').toLowerCase();
        const amount = parseInt(args[1] || '0', 10);
        if (!target || amount <= 0) { await reply(channel, username, cmd, 'Nutzung: +gift <User> <Betrag>'); return; }

        const senderData = economy.readCredits(username);
        const senderBal  = isAdmin ? economy.ADMIN_BALANCE : (senderData.credits || 0);
        if (!isAdmin && senderBal < amount) { await reply(channel, username, cmd, `Nicht genug F$! Dein Guthaben: ${senderBal} F$`); return; }

        if (!isAdmin) { senderData.credits = senderBal - amount; economy.writeCredits(username, senderData); }
        const targetData    = economy.readCredits(target);
        targetData.credits  = (targetData.credits || 0) + amount;
        targetData.username = target;
        economy.writeCredits(target, targetData);
        await client.say(channel, `@${username} hat ${amount} F$ an @${target} verschenkt! 🦊`);
      }
      return;
    }

    if (cmd === 'info') {
      await client.say(channel, `🦊 Alle Infos zum Fuchsbau: https://chatterinfo.fynnlogan.de`);
      return;
    }

    if (cmd === 'info') {
      await client.say(channel, `🦊 Alle Infos zum Fuchsbau: https://chatterinfo.fynnlogan.de`);
      return;
    }

    if (cmd === 'uptime') {
      await reply(channel, username, cmd, 'Bot läuft 🦊');
      return;
    }

	if (cmd === 'info') {
	  const tunnel = process.env.CLOUDFLARE_TUNNEL_URL || `http://localhost:${process.env.PORT || 3000}`;
	  await client.say(channel, `🦊 Alle Infos zum Fuchsbau findest du hier: ${tunnel}/chatterinfo/`);
	  return;
	}

    if (cmd === 'owner' && (username === (botConfig.owner || '').toLowerCase() || isMod)) {
      await client.say(channel, `@${username} Owner-Befehl ausgeführt`);
      return;
    }

    // ── Dynamische +Befehle ──
    if (commands) {
      const result = await commands.handleCommand({
        cmd, args, username, isAdmin, isMod, isVIP, isSub,
        economy, botConfig
      });

      if (result) {
        if (result.blocked) {
          if (result.reason === 'cooldown') {
            await reply(channel, username, cmd, `Noch ${result.rest}s warten! ⏳`);
          }
          return;
        }
        if (result.text) await client.say(channel, result.text);
        if (result.fdReward > 0 && economy) {
          giveFD(username, result.fdReward);
          writeLog(`[bot] F$ Belohnung: ${username} +${result.fdReward} F$ für +${cmd}`);
        }
      }
    }

  } catch (e) { writeLog('[bot] Fehler bei Command:', e && e.stack ? e.stack : e); }
});

/* ============================================================
   BIT-SPENDEN → F$-BANK + BIT-SOUND
   ============================================================ */
client.on('cheer', async (channel, userstate, message) => {
  const username = (userstate.username || '').toLowerCase();
  const bits     = parseInt(userstate.bits || '0', 10);
  if (bits <= 0) return;

  writeLog(`[bot] Cheer: ${username} spendete ${bits} Bits`);

  // F$-Bank Kurs anwenden
  const { fd, rate } = calcBitsFD(bits);
  giveFD(username, fd);
  await client.say(channel, `@${username} Danke für ${bits} Bits! 🎉 Du bekommst ${fd} F$ (×${rate}) 🦊`);

  // Bit-Sound abspielen
  const bitSound = findBitSound(bits);
  if (bitSound) {
    writeLog(`[bot] Bit-Sound: ${bitSound.file} für ${bits} Bits`);
    await broadcastSound(bitSound.file, bitSound.volume || 80);
  }
});

/* ============================================================
   SUB-EVENTS → F$-BANK
   ============================================================ */

// Neuer Sub (Tier 1/2/3 oder Prime)
client.on('subscription', async (channel, username, method, message, userstate) => {
  const user = (username || '').toLowerCase();
  const tier = method?.plan || '1000';
  const fd   = calcSubFD(tier, false, false);

  writeLog(`[bot] SUB: ${user} Tier ${tier} → ${fd} F$`);
  giveFD(user, fd);
  await client.say(channel, `@${username} Willkommen im Fuchsbau! 🦊 Du bekommst ${fd} F$ für deinen Sub!`);
});

// Resub
client.on('resub', async (channel, username, months, message, userstate, methods) => {
  const user = (username || '').toLowerCase();
  const tier = methods?.plan || userstate?.['msg-param-sub-plan'] || '1000';
  const fd   = calcSubFD(tier, true, false);

  writeLog(`[bot] RESUB: ${user} Monat ${months} Tier ${tier} → ${fd} F$`);
  giveFD(user, fd);
  await client.say(channel, `@${username} Danke für ${months} Monate! 🦊 Du bekommst ${fd} F$ (inkl. Treue-Bonus)!`);
});

// Geschenk-SUB (Schenker bekommt F$, Empfänger nicht)
client.on('subgift', async (channel, username, streakMonths, recipient, methods, userstate) => {
  const gifter = (username || '').toLowerCase();
  const tier   = methods?.plan || '1000';
  const fd     = calcSubFD(tier, false, true);

  writeLog(`[bot] GIFT-SUB: ${gifter} → ${recipient} Tier ${tier} → Schenker bekommt ${fd} F$`);
  giveFD(gifter, fd);
  await client.say(channel, `@${username} hat @${recipient} ein Sub geschenkt! 🎁 ${username} bekommt ${fd} F$ für die Großzügigkeit! 🦊`);
});

// Massen-Geschenk-SUBs
client.on('submysterygift', async (channel, username, numbOfSubs, methods, userstate) => {
  const gifter = (username || '').toLowerCase();
  const tier   = methods?.plan || '1000';
  const fdPro  = calcSubFD(tier, false, true);
  const fdGes  = fdPro * numbOfSubs;

  writeLog(`[bot] MYSTERY-GIFT: ${gifter} verschenkt ${numbOfSubs}x Tier ${tier} → ${fdGes} F$`);
  giveFD(gifter, fdGes);
  await client.say(channel, `@${username} verschenkt ${numbOfSubs} Subs! 🎁 ${username} bekommt ${fdGes} F$ (${numbOfSubs}× ${fdPro} F$)! 🦊`);
});

/* ============================================================
   KEEPALIVE & SHUTDOWN
   ============================================================ */
setInterval(() => writeLog('[bot] alive (tmi.js)'), 60_000);

const shutdown = async () => {
  writeLog('[bot] Beende Verbindung...');
  try { await client.disconnect(); } catch (e) { }
  process.exit(0);
};

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

module.exports = { mode: 'tmi', client };
