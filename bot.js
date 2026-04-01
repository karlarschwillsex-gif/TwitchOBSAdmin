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
} else {
  writeLog('WARNUNG: bot_config.json nicht gefunden.');
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
   BIT-SOUNDS LADEN
   ============================================================ */
const BIT_SOUNDS_FILE = path.join(ROOT, 'data', 'bit_sounds.json');

function loadBitSounds() {
  try {
    if (!fs.existsSync(BIT_SOUNDS_FILE)) return [];
    return JSON.parse(fs.readFileSync(BIT_SOUNDS_FILE, 'utf8'));
  } catch (e) { return []; }
}

function findBitSound(bits) {
  const list = loadBitSounds();
  return list.find(b => bits >= b.from && bits <= b.to) || null;
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
    const port = parseInt(process.env.BOT_HEALTH_PORT || '9090', 10);
    app.listen(port, () => writeLog(`[bot] Health endpoint läuft auf http://localhost:${port}`));
  } catch (e) { }

  try {
    const cmdFile = path.join(ROOT, 'bot_cmd.json');
    fs.writeFileSync(cmdFile, JSON.stringify({ last: null }, null, 2), { flag: 'a' });
    fs.watchFile(cmdFile, { interval: 1000 }, () => { });
  } catch (e) { }

  process.on('SIGINT',  () => { writeLog('[bot] SIGINT, beende STUB');  process.exit(0); });
  process.on('SIGTERM', () => { writeLog('[bot] SIGTERM, beende STUB'); process.exit(0); });
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
   ANTWORT HELPER — Whisper oder Chat
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
  } catch (e) {
    writeLog('[bot] Broadcast Fehler:', e.message);
  }
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
      catch (err) { return 0; }
    },

    async addBalance(user, amount) {
      if (!economy) return false;
      try {
        const data    = economy.readCredits(user);
        data.credits  = Math.max(0, (data.credits || 0) + amount);
        data.username = user;
        economy.writeCredits(user, data);
        return true;
      } catch (err) { return false; }
    },

    async getUserInfo(user) {
      return {
        isVIP: false, isMod: false, isSub: false,
        isAdmin: user === (botConfig.owner || '').toLowerCase()
      };
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

  // ── F$ vergeben ──
  if (economy) {
    try { economy.onChatMessage({ username, message, isAdmin, isMod, isVIP, isSub }); }
    catch (e) { writeLog('[bot] Economy Fehler:', e.message); }
  }

  // ── Commands ──
  const prefix = botConfig.prefix || '+';
  if (!message || !message.startsWith(prefix)) return;

  const args = message.slice(prefix.length).trim().split(/\s+/);
  const cmd  = (args.shift() || '').toLowerCase();

  writeLog('[bot] Command:', cmd, 'von', username);

  try {
    if (cmd === 'ping') {
      await reply(channel, username, cmd, 'pong 🦊');

    } else if (cmd === 'guthaben' || cmd === 'fd' || cmd === 'fuchsdollar') {
      if (economy) {
        const data = economy.readCredits(username);
        const bal  = isAdmin ? '∞' : (data.credits || 0);
        await reply(channel, username, cmd, `Du hast ${bal} F$ 🦊`);
      }

    } else if (cmd === 'top') {
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
            await reply(channel, username, cmd, 'Noch keine F$ Daten vorhanden.');
          } else {
            const text = all.map((d, i) => `${i + 1}. ${d.username}: ${d.credits} F$`).join(' | ');
            await reply(channel, username, cmd, `🏆 Top F$: ${text}`);
          }
        } catch (e) { writeLog('[bot] Fehler bei +top:', e.message); }
      }

    } else if (cmd === 'gift' || cmd === 'give' || cmd === 'spende') {
      if (economy) {
        const target = (args[0] || '').replace('@', '').toLowerCase();
        const amount = parseInt(args[1] || '0', 10);

        if (!target || amount <= 0) {
          await reply(channel, username, cmd, 'Nutzung: +gift <User> <Betrag>');
          return;
        }

        const senderData = economy.readCredits(username);
        const senderBal  = isAdmin ? economy.ADMIN_BALANCE : (senderData.credits || 0);

        if (!isAdmin && senderBal < amount) {
          await reply(channel, username, cmd, `Nicht genug F$! Dein Guthaben: ${senderBal} F$`);
          return;
        }

        if (!isAdmin) {
          senderData.credits = senderBal - amount;
          economy.writeCredits(username, senderData);
        }

        const targetData    = economy.readCredits(target);
        targetData.credits  = (targetData.credits || 0) + amount;
        targetData.username = target;
        economy.writeCredits(target, targetData);

        await client.say(channel, `@${username} hat ${amount} F$ an @${target} verschenkt! 🦊`);
      }

    } else if (cmd === 'uptime') {
      await reply(channel, username, cmd, 'Bot läuft 🦊');

    } else if (cmd === 'owner' && (username === (botConfig.owner || '').toLowerCase() || isMod)) {
      await client.say(channel, `@${username} Owner-Befehl ausgeführt`);
    }

  } catch (e) { writeLog('[bot] Fehler bei Command:', e && e.stack ? e.stack : e); }
});

/* ============================================================
   BIT-SPENDEN → F$ + BIT-SOUND
   ============================================================ */
client.on('cheer', async (channel, userstate, message) => {
  const username = (userstate.username || '').toLowerCase();
  const bits     = parseInt(userstate.bits || '0', 10);

  if (bits <= 0) return;

  writeLog(`[bot] Cheer: ${username} spendete ${bits} Bits`);

  // ── F$ für Bits vergeben ──
  if (economy) {
    try {
      const result = economy.onBitDonation({ username, bits });
      if (result.delta > 0) {
        await client.say(channel,
          `@${username} Danke für ${bits} Bits! 🎉 Du bekommst ${result.delta} F$ (×${result.factor}) 🦊`
        );
      }
    } catch (e) { writeLog('[bot] Fehler bei Bit F$:', e.message); }
  }

  // ── Bit-Sound suchen und abspielen ──
  const bitSound = findBitSound(bits);
  if (bitSound) {
    writeLog(`[bot] Bit-Sound gefunden: ${bitSound.file} für ${bits} Bits`);
    await broadcastSound(bitSound.file, bitSound.volume || 80);
  }
});

/* ============================================================
   KEEPALIVE & SHUTDOWN
   ============================================================ */
setInterval(() => writeLog('[bot] alive (tmi.js)'), 60_000);

const shutdown = async () => {
  writeLog('[bot] Beende Verbindung...');
  try { await client.disconnect(); writeLog('[bot] Verbindung beendet'); }
  catch (e) { writeLog('[bot] Fehler beim Disconnect:', e.message || e); }
  process.exit(0);
};

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

module.exports = { mode: 'tmi', client };
