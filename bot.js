// /home/fynn/TwitchOBSAdmin/bot.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const LOGDIR = path.join(ROOT, 'logs');
if (!fs.existsSync(LOGDIR)) fs.mkdirSync(LOGDIR, { recursive: true });

const LOGFILE = path.join(LOGDIR, 'bot.log');
function writeLog(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
  try { fs.appendFileSync(LOGFILE, line); } catch (e) { /* ignore */ }
  console.log(...parts);
}

/* Load bot config safely */
const cfgPath = path.join(ROOT, 'bot_config.json');
let botConfig = { botName: 'stubBot', prefix: '!', owner: 'owner', channel: null };
if (fs.existsSync(cfgPath)) {
  try {
    botConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    writeLog('bot_config.json geladen:', botConfig.botName || 'unnamed');
  } catch (err) {
    writeLog('Fehler beim Lesen bot_config.json:', err.message);
  }
} else {
  writeLog('WARNUNG: bot_config.json nicht gefunden, Default-Konfig wird verwendet.');
}

/* Env / credentials */
const TWITCH_BOT_TOKEN = process.env.TWITCH_BOT_TOKEN || null;
const TWITCH_BOT_USERNAME = botConfig.botName || process.env.TWITCH_BOT_USERNAME || null;
const CHANNEL = process.env.TWITCH_CHANNEL || botConfig.channel || null;

/* Decide mode */
const useTmi = !!(TWITCH_BOT_TOKEN && TWITCH_BOT_USERNAME && CHANNEL);

if (!useTmi) {
  writeLog('INFO: Starte Bot im STUB-Modus (keine Twitch-Credentials gefunden).');

  /* Keepalive */
  setInterval(() => writeLog('[bot] STUB alive'), 60_000);

  /* Health endpoint */
  try {
    const express = require('express');
    const app = express();
    app.get('/', (req, res) => res.send('Bot STUB läuft'));
    const port = parseInt(process.env.BOT_HEALTH_PORT || '9090', 10);
    app.listen(port, () => writeLog(`[bot] Health endpoint läuft auf http://localhost:${port}`));
  } catch (e) {
    writeLog('[bot] express nicht installiert, Health endpoint übersprungen');
  }

  /* Minimal simulated command interface via file watch (optional) */
  try {
    const cmdFile = path.join(ROOT, 'bot_cmd.json');
    fs.writeFileSync(cmdFile, JSON.stringify({ last: null }, null, 2), { flag: 'a' });
    fs.watchFile(cmdFile, { interval: 1000 }, (curr, prev) => {
      try {
        const data = JSON.parse(fs.readFileSync(cmdFile, 'utf8'));
        if (data && data.last && data.last !== prev.mtimeMs) {
          writeLog('[bot] Simulierter Befehl erkannt:', data.last);
        }
      } catch (e) { /* ignore parse errors */ }
    });
  } catch (e) {
    writeLog('[bot] Simulierter Befehl Watcher konnte nicht angelegt werden', e.message);
  }

  /* Graceful shutdown */
  process.on('SIGINT', () => {
    writeLog('[bot] SIGINT empfangen, beende STUB');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    writeLog('[bot] SIGTERM empfangen, beende STUB');
    process.exit(0);
  });

  module.exports = { mode: 'stub' };
  return;
}

/* Real bot mode using tmi.js */
let tmi;
try {
  tmi = require('tmi.js');
} catch (err) {
  writeLog('ERROR: tmi.js nicht installiert. Installiere mit: npm install tmi.js');
  process.exit(1);
}

const client = new tmi.Client({
  options: { debug: false },
  identity: {
    username: TWITCH_BOT_USERNAME,
    password: TWITCH_BOT_TOKEN
  },
  channels: [CHANNEL]
});

/* Connect and handle events */
client.connect()
  .then(() => writeLog(`[bot] Verbunden als ${TWITCH_BOT_USERNAME} in Channel ${CHANNEL}`))
  .catch(err => {
    writeLog('[bot] Verbindung fehlgeschlagen:', err.message || err);
    process.exit(1);
  });

// Duell-System anbinden
try {
  const duels = require('./backend/duels');
  const fetch = require('node-fetch');

  const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;

  duels.attachBot({
    say: (msg) => client.say(CHANNEL, msg),
    whisper: (user, msg) => client.whisper(user, msg),

    onMessage: (handler) => {
      client.on('message', (channel, userstate, message, self) => {
        if (self) return;
        handler({
          user: userstate['display-name'] || userstate.username,
          username: userstate.username,
          text: message,
          isMod: userstate.mod || false,
          isVIP: userstate.badges?.vip === '1',
          isSub: userstate.subscriber || false,
          isAdmin: userstate.username === botConfig.owner
        });
      });
    },

    // ECHTE FUCHSDUKATEN (Credits)
    async getBalance(user) {
      try {
        const res = await fetch(`${serverUrl}/api/admin/credits/${user}`);
        if (!res.ok) return 0;
        const json = await res.json();
        return json.credits || 0;
      } catch (err) {
        writeLog('[duels] Fehler getBalance:', err.message);
        return 0;
      }
    },

    async addBalance(user, amount) {
      try {
        const res = await fetch(`${serverUrl}/api/admin/credits/${user}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delta: amount })
        });
        return res.ok;
      } catch (err) {
        writeLog('[duels] Fehler addBalance:', err.message);
        return false;
      }
    },

    async getUserInfo(user) {
      // Twitch-Rollen aus userstate kommen bereits oben rein
      // Hier können wir später erweitern (Follower-Check, etc.)
      return {
        isVIP: false,
        isMod: false,
        isSub: false,
        isAdmin: user === botConfig.owner
      };
    }
  });

  writeLog('[bot] Duell-System erfolgreich angebunden');
} catch (err) {
  writeLog('[bot] Fehler beim Laden von duels.js:', err.message || err);
}

/* Basic command handling */
client.on('message', async (channel, userstate, message, self) => {
  if (self) return;
  const prefix = botConfig.prefix || '!';
  if (!message || !message.startsWith(prefix)) return;

  const args = message.slice(prefix.length).trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();
  const user = userstate['display-name'] || userstate.username;

  writeLog('[bot] Command empfangen:', cmd, 'von', user);

  try {
    if (cmd === 'ping') {
      await client.say(channel, `@${userstate.username} pong`);
    } else if (cmd === 'uptime') {
      await client.say(channel, `@${userstate.username} Bot läuft`);
    } else if (cmd === 'credits') {
      try {
        const fetch = require('node-fetch');
        const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
        const res = await fetch(`${serverUrl}/api/admin/credits/${userstate.username}`);
        if (res.ok) {
          const json = await res.json();
          await client.say(channel, `@${userstate.username} Credits: ${json.credits || 0}`);
        } else {
          await client.say(channel, `@${userstate.username} Credits nicht verfügbar`);
        }
      } catch (e) {
        writeLog('[bot] Fehler beim Abfragen der Credits API', e.message || e);
        await client.say(channel, `@${userstate.username} Fehler beim Abrufen der Credits`);
      }
    } else if (cmd === 'owner' && (userstate.username === botConfig.owner || userstate.mod)) {
      await client.say(channel, `@${userstate.username} Owner-Befehl ausgeführt`);
    } else {
      // Unknown command - ignore
    }
  } catch (e) {
    writeLog('[bot] Fehler bei Command Verarbeitung', e && e.stack ? e.stack : e);
  }
});

/* Keepalive logging */
setInterval(() => writeLog('[bot] alive (tmi.js)'), 60_000);

/* Graceful shutdown */
const shutdown = async () => {
  writeLog('[bot] Beende Verbindung...');
  try {
    await client.disconnect();
    writeLog('[bot] Verbindung beendet');
  } catch (e) {
    writeLog('[bot] Fehler beim Disconnect:', e.message || e);
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { mode: 'tmi', client };

