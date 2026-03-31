// /home/fynn/TwitchOBSAdmin/handleRewardEvent.js
/**
 * Überarbeiteter Reward-Handler
 * - Schreibt Credits in dateibasierte Storage (CREDITS_DATA_DIR)
 * - Benachrichtigt optional Overlay/Service via CREDITS_NOTIFY_URL
 * - Loggt in logs/handleRewardEvent.log
 *
 * Erwartet ein Event-Objekt (Twitch EventSub Payload)
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const ROOT = __dirname;
const LOGDIR = path.join(ROOT, 'logs');
if (!fs.existsSync(LOGDIR)) fs.mkdirSync(LOGDIR, { recursive: true });

const logFile = path.join(LOGDIR, 'handleRewardEvent.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore logging errors */ }
  console.log('[handleRewardEvent]', ...args);
}
function warn(...args) { log('WARN', ...args); }
function error(...args) { log('ERROR', ...args); }

/** Credits storage dir (env or default) */
const CREDITS_DATA_DIR = process.env.CREDITS_DATA_DIR
  ? path.resolve(process.env.CREDITS_DATA_DIR)
  : path.join(ROOT, 'twitch-credits', 'data', 'credits');

if (!fs.existsSync(CREDITS_DATA_DIR)) {
  try { fs.mkdirSync(CREDITS_DATA_DIR, { recursive: true }); } catch (e) { error('Konnte CREDITS_DATA_DIR nicht anlegen', e); }
}

/** Safe file helpers */
function safeFilePath(id = 'global') {
  const safe = String(id || 'global').replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(CREDITS_DATA_DIR, `${safe}.json`);
}
function readCredits(id = 'global') {
  const fp = safeFilePath(id);
  try {
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify({ credits: 0 }, null, 2));
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    error('readCredits Fehler', fp, e);
    return { credits: 0 };
  }
}
function writeCredits(id = 'global', obj = { credits: 0 }) {
  const fp = safeFilePath(id);
  try {
    fs.writeFileSync(fp, JSON.stringify(obj, null, 2));
    return true;
  } catch (e) {
    error('writeCredits Fehler', fp, e);
    return false;
  }
}

/** Notify overlay/service if configured */
async function notifyCreditsService(id, data) {
  const notifyUrl = process.env.CREDITS_NOTIFY_URL;
  if (!notifyUrl) return;
  try {
    await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data })
    });
    log('Credits notify gesendet an', notifyUrl, 'id', id, 'data', data);
  } catch (e) {
    warn('Credits notify fehlgeschlagen', e && e.message ? e.message : e);
  }
}

/**
 * Hauptfunktion: verarbeitet ein EventSub Payload
 * - erkennt channel.channel_points_custom_reward_redemption.add
 * - erhöht Credits (delta) oder führt andere Aktionen aus
 *
 * Verhalten ist bewusst einfach und deterministisch:
 * - Wenn event.event.user_login oder event.event.user_name vorhanden ist, wird dieser als id genutzt.
 * - Wenn reward amount / cost vorhanden ist, wird das als delta verwendet (fallback: +1).
 */
module.exports = async function handleRewardEvent(event) {
  try {
    const type = event?.subscription?.type || 'unknown';
    const reward = event?.event?.reward || null;
    const userLogin = event?.event?.user_login || event?.event?.user?.login || event?.event?.user_name || null;
    const userId = userLogin || 'global';
    const rewardTitle = reward?.title || reward?.prompt || null;

    log('Empfangen', { type, userId, rewardTitle });

    // Nur Channel Points Rewards behandeln
    if (!type.includes('channel.channel_points_custom_reward')) {
      log('Nicht-reward Event, übersprungen:', type);
      return true;
    }

    // Bestimme delta: wenn cost vorhanden, nutze cost als delta, sonst +1
    let delta = 1;
    if (typeof reward?.cost === 'number') delta = reward.cost;
    // Manche Payloads liefern amount in event.amount
    if (typeof event?.event?.amount === 'number') delta = event.event.amount;

    // Lese aktuelle Credits, addiere delta
    const current = readCredits(userId);
    const newCredits = (current.credits || 0) + delta;
    const ok = writeCredits(userId, { credits: newCredits });

    if (!ok) {
      error('Konnte Credits nicht schreiben für', userId);
      return false;
    }

    log('Credits aktualisiert', { id: userId, old: current.credits || 0, delta, new: newCredits });

    // Notify overlay/service (nicht blockierend)
    try {
      await notifyCreditsService(userId, { credits: newCredits });
    } catch (e) {
      warn('notifyCreditsService Fehler', e);
    }

    // Optional: Trigger lokale Aktionen (z.B. Sound) via filesystem flag
    try {
      const triggerDir = path.join(ROOT, 'twitch-credits', 'triggers');
      if (!fs.existsSync(triggerDir)) fs.mkdirSync(triggerDir, { recursive: true });
      const triggerFile = path.join(triggerDir, `${Date.now()}_${userId}.json`);
      fs.writeFileSync(triggerFile, JSON.stringify({ id: userId, rewardTitle, delta, credits: newCredits }, null, 2));
      log('Trigger-Datei geschrieben', triggerFile);
    } catch (e) {
      warn('Trigger-Datei konnte nicht geschrieben werden', e && e.message ? e.message : e);
    }

    return true;
  } catch (err) {
    error('handleRewardEvent Fehler', err && err.stack ? err.stack : err);
    throw err;
  }
};

