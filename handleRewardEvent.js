// /home/fynn/TwitchOBSAdmin/handleRewardEvent.js
const fs   = require('fs');
const path = require('path');

const ROOT              = __dirname;
const LOGDIR            = path.join(ROOT, 'logs');
const SOUND_REWARDS_FILE = path.join(ROOT, 'data', 'sound_rewards.json');

if (!fs.existsSync(LOGDIR)) fs.mkdirSync(LOGDIR, { recursive: true });

const logFile = path.join(LOGDIR, 'handleRewardEvent.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore */ }
  console.log('[handleRewardEvent]', ...args);
}

// WebSocket-Broadcast Funktion — wird von server.js gesetzt
let broadcastFn = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(data) {
  if (typeof broadcastFn === 'function') {
    broadcastFn(data);
  } else {
    log('WARN: Kein Broadcast verfügbar');
  }
}

// Sound-Rewards laden
function loadSoundRewards() {
  try {
    if (!fs.existsSync(SOUND_REWARDS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SOUND_REWARDS_FILE, 'utf8'));
  } catch (e) {
    log('Fehler beim Laden der Sound-Rewards:', e.message);
    return [];
  }
}

// Hauptfunktion
module.exports = async function handleRewardEvent(event) {
  try {
    const type        = event?.subscription?.type || 'unknown';
    const rewardTitle = event?.event?.reward?.title || event?.event?.title || null;
    const userLogin   = event?.event?.user_login || event?.event?.user_name || 'unknown';

    log('Event empfangen:', { type, rewardTitle, userLogin });

    if (!type.includes('channel.channel_points_custom_reward')) {
      log('Kein Reward-Event, übersprungen:', type);
      return true;
    }

    if (!rewardTitle) {
      log('Kein Reward-Titel gefunden');
      return true;
    }

    // Sound-Zuordnung suchen
    const rewards = loadSoundRewards();
    const match   = rewards.find(r =>
      r.rewardName.toLowerCase() === rewardTitle.toLowerCase()
    );

    if (match) {
      log(`Sound gefunden: "${match.file}" für Belohnung "${rewardTitle}"`);
      broadcast({
        type:   'sound:play',
        file:   match.file,
        volume: (match.volume || 80) / 100,
        name:   rewardTitle,
        user:   userLogin
      });
    } else {
      log(`Keine Sound-Zuordnung für Belohnung: "${rewardTitle}"`);
    }

    return true;
  } catch (err) {
    log('Fehler:', err && err.stack ? err.stack : err);
    throw err;
  }
};

module.exports.setBroadcast = setBroadcast;
