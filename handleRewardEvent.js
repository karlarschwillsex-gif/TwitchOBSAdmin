// /home/fynn/TwitchOBSAdmin/handleRewardEvent.js
const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');

const ROOT               = __dirname;
const LOGDIR             = path.join(ROOT, 'logs');
const SOUND_REWARDS_FILE = path.join(ROOT, 'data', 'sound_rewards.json');
const CAM_REWARDS_FILE   = path.join(ROOT, 'data', 'cam_rewards.json');
const SERVER_URL         = process.env.SERVER_URL || 'http://localhost:3000';

if (!fs.existsSync(LOGDIR)) fs.mkdirSync(LOGDIR, { recursive: true });

const logFile = path.join(LOGDIR, 'handleRewardEvent.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) { }
  console.log('[handleRewardEvent]', ...args);
}

let broadcastFn = null;
function setBroadcast(fn) { broadcastFn = fn; }

function loadSoundRewards() {
  try {
    if (!fs.existsSync(SOUND_REWARDS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SOUND_REWARDS_FILE, 'utf8'));
  } catch (e) { return []; }
}

function loadCamRewards() {
  try {
    if (!fs.existsSync(CAM_REWARDS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CAM_REWARDS_FILE, 'utf8'));
  } catch (e) { return []; }
}

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

    // ── Sound-Reward prüfen ──
    const soundRewards = loadSoundRewards();
    const soundMatch   = soundRewards.find(r =>
      r.rewardName.toLowerCase() === rewardTitle.toLowerCase()
    );

    if (soundMatch) {
      log(`Sound-Reward gefunden: "${soundMatch.file}" für "${rewardTitle}"`);
      try {
        const res  = await fetch(`${SERVER_URL}/api/admin/play-sound`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            file:   soundMatch.file,
            volume: (soundMatch.volume || 80) / 100,
            name:   rewardTitle,
            user:   userLogin
          })
        });
        const data = await res.json();
        log(`Sound abgespielt: ${soundMatch.file} (${data.method})`);
      } catch (e) {
        log('Sound HTTP-Call fehlgeschlagen:', e.message);
      }
      return true;
    }

    // ── CamFilter-Reward prüfen ──
    const camRewards = loadCamRewards();
    const camMatch   = camRewards.find(r =>
      r.rewardName.toLowerCase() === rewardTitle.toLowerCase()
    );

    if (camMatch) {
      log(`CamFilter-Reward gefunden: "${camMatch.filterName}" für "${rewardTitle}"`);
      try {
        const res  = await fetch(`${SERVER_URL}/api/admin/cam-filter/trigger`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            filterName: camMatch.filterName,
            duration:   camMatch.duration || 10
          })
        });
        const data = await res.json();
        log(`CamFilter aktiviert: ${camMatch.filterName} für ${camMatch.duration}s`);
      } catch (e) {
        log('CamFilter HTTP-Call fehlgeschlagen:', e.message);
      }
      return true;
    }

    log(`Keine Zuordnung für Belohnung: "${rewardTitle}"`);
    return true;

  } catch (err) {
    log('Fehler:', err && err.stack ? err.stack : err);
    throw err;
  }
};

module.exports.setBroadcast = setBroadcast;
