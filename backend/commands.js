// /home/fynn/TwitchOBSAdmin/backend/commands.js
require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');

const ROOT          = path.join(__dirname, '..');
const COMMANDS_FILE = path.join(ROOT, 'data', 'commands.json');

// In-Memory Cooldowns
const cooldowns = new Map();

// Twitch API Config
const CLIENT_ID      = process.env.CLIENT_ID;
const USER_TOKEN     = process.env.TWITCH_USER_TOKEN;
const BROADCASTER_ID = process.env.BROADCASTER_ID;
const API_BASE       = 'https://api.twitch.tv/helix';

function twitchHeaders() {
  return {
    'Client-ID':     CLIENT_ID,
    'Authorization': `Bearer ${USER_TOKEN}`
  };
}

// ============================================================
// HELPERS
// ============================================================

function loadCommands() {
  try {
    if (!fs.existsSync(COMMANDS_FILE)) return [];
    return JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
  } catch (e) {
    console.error('[commands] Fehler beim Laden:', e.message);
    return [];
  }
}

function saveCommands(cmds) {
  try {
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(cmds, null, 2));
    return true;
  } catch (e) {
    console.error('[commands] Fehler beim Speichern:', e.message);
    return false;
  }
}

// ============================================================
// TWITCH API CALLS
// ============================================================

// Stream-Info (Titel, Spiel, Zuschauer)
async function getStreamInfo() {
  try {
    const res  = await fetch(`${API_BASE}/streams?user_id=${BROADCASTER_ID}`, { headers: twitchHeaders() });
    const data = await res.json();
    return data.data?.[0] || null;
  } catch (e) { return null; }
}

// Spiel-Name per ID
async function getGameName(gameId) {
  if (!gameId) return 'unbekannt';
  try {
    const res  = await fetch(`${API_BASE}/games?id=${gameId}`, { headers: twitchHeaders() });
    const data = await res.json();
    return data.data?.[0]?.name || 'unbekannt';
  } catch (e) { return 'unbekannt'; }
}

// Sub-Info eines Users
async function getSubInfo(username) {
  try {
    // Erst User-ID holen
    const userRes  = await fetch(`${API_BASE}/users?login=${username}`, { headers: twitchHeaders() });
    const userData = await userRes.json();
    const userId   = userData.data?.[0]?.id;
    if (!userId) return null;

    const subRes  = await fetch(`${API_BASE}/subscriptions/user?broadcaster_id=${BROADCASTER_ID}&user_id=${userId}`, { headers: twitchHeaders() });
    if (!subRes.ok) return null;
    const subData = await subRes.json();
    return subData.data?.[0] || null;
  } catch (e) { return null; }
}

// Follower-Info eines Users
async function getFollowInfo(username) {
  try {
    const userRes  = await fetch(`${API_BASE}/users?login=${username}`, { headers: twitchHeaders() });
    const userData = await userRes.json();
    const userId   = userData.data?.[0]?.id;
    if (!userId) return null;

    const followRes  = await fetch(`${API_BASE}/channels/followers?broadcaster_id=${BROADCASTER_ID}&user_id=${userId}`, { headers: twitchHeaders() });
    if (!followRes.ok) return null;
    const followData = await followRes.json();
    return followData.data?.[0] || null;
  } catch (e) { return null; }
}

// Bits-Gesamt eines Users
async function getUserBits(username) {
  try {
    const userRes  = await fetch(`${API_BASE}/users?login=${username}`, { headers: twitchHeaders() });
    const userData = await userRes.json();
    const userId   = userData.data?.[0]?.id;
    if (!userId) return null;

    const bitsRes  = await fetch(`${API_BASE}/bits/leaderboard?user_id=${userId}&broadcaster_id=${BROADCASTER_ID}`, { headers: twitchHeaders() });
    if (!bitsRes.ok) return null;
    const bitsData = await bitsRes.json();
    return bitsData.data?.[0]?.score || 0;
  } catch (e) { return null; }
}

// Datum formatieren
function formatDate(isoString) {
  if (!isoString) return 'unbekannt';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  } catch (e) { return 'unbekannt'; }
}

// Monate seit Datum berechnen
function monthsSince(isoString) {
  if (!isoString) return '?';
  try {
    const start = new Date(isoString);
    const now   = new Date();
    return String(
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())
    );
  } catch (e) { return '?'; }
}

// ============================================================
// ROLLEN-CHECK
// ============================================================

function hasRole(roles, isAdmin, isMod, isVIP, isSub) {
  if (!roles || roles.includes('everyone') || roles.length === 0) return true;
  if (roles.includes('admin') && isAdmin) return true;
  if (roles.includes('mod')   && isMod)   return true;
  if (roles.includes('vip')   && isVIP)   return true;
  if (roles.includes('sub')   && isSub)   return true;
  return false;
}

function getRoleLabel(isAdmin, isMod, isVIP, isSub) {
  if (isAdmin) return 'Admin';
  if (isMod)   return 'MOD';
  if (isVIP)   return 'VIP';
  if (isSub)   return 'SUB';
  return 'Chatter';
}

// ============================================================
// VARIABLEN ERSETZEN
// ============================================================

async function resolveVariables(text, { username, args, economy, botConfig, isAdmin, isMod, isVIP, isSub }) {
  let result = text;

  // ── Einfache Variablen (kein API Call) ──

  // [user]
  result = result.replace(/\[user\]/gi, username);

  // [empfaenger]
  const empfaenger = (args[0] || '').replace('@', '') || 'niemanden';
  result = result.replace(/\[empfaenger\]/gi, empfaenger);

  // [channel]
  result = result.replace(/\[channel\]/gi, botConfig?.channel || 'fairewelt');

  // [user.role]
  result = result.replace(/\[user\.role\]/gi, getRoleLabel(isAdmin, isMod, isVIP, isSub));

  // [empfaenger.role] — ohne Live-Daten, Fallback
  result = result.replace(/\[empfaenger\.role\]/gi, 'Chatter');

  // [user.vip]
  result = result.replace(/\[user\.vip\]/gi, isVIP ? 'VIP' : '');

  // [random: a|b|c]
  result = result.replace(/\[random:\s*([^\]]+)\]/gi, (_, options) => {
    const list = options.split('|').map(o => o.trim()).filter(Boolean);
    return list[Math.floor(Math.random() * list.length)] || '';
  });

  // [link: url name]
  result = result.replace(/\[link:\s*(\S+)\s+([^\]]+)\]/gi, (_, url, name) => `${name} → ${url}`);

  // [emote: name]
  result = result.replace(/\[emote:\s*([^\]]+)\]/gi, (_, emote) => emote.trim());

  // ── F$ Variablen ──

  if (economy) {
    // [fd]
    if (result.includes('[fd]')) {
      const data = economy.readCredits(username);
      result = result.replace(/\[fd\]/gi, `${data.credits || 0} F$`);
    }

    // [empfaenger.fd]
    if (result.includes('[empfaenger.fd]')) {
      const target = (args[0] || '').replace('@', '').toLowerCase();
      if (target) {
        const data = economy.readCredits(target);
        result = result.replace(/\[empfaenger\.fd\]/gi, `${data.credits || 0} F$`);
      }
    }

    // [top]
    if (result.includes('[top]')) {
      try {
        const creditsDir = path.join(ROOT, 'data', 'credits');
        const files = fs.readdirSync(creditsDir).filter(f => f.endsWith('.json'));
        const all = files
          .map(f => { try { return JSON.parse(fs.readFileSync(path.join(creditsDir, f), 'utf8')); } catch { return null; } })
          .filter(d => d && d.username && typeof d.credits === 'number')
          .filter(d => d.credits < 999999999)
          .sort((a, b) => b.credits - a.credits);
        const top = all[0];
        result = result.replace(/\[top\]/gi, top ? `${top.username} (${top.credits} F$)` : 'niemand');
      } catch (e) {
        result = result.replace(/\[top\]/gi, 'unbekannt');
      }
    }
  }

  // ── Twitch API Variablen (async) ──

  // [user.followage]
  if (result.includes('[user.followage]')) {
    const follow = await getFollowInfo(username);
    const since  = follow?.followed_at ? formatDate(follow.followed_at) : 'unbekannt';
    result = result.replace(/\[user\.followage\]/gi, `seit ${since}`);
  }

  // [user.sub.since]
  if (result.includes('[user.sub.since]')) {
    const sub   = await getSubInfo(username);
    const since = sub?.created_at ? formatDate(sub.created_at) : 'nicht subscribed';
    result = result.replace(/\[user\.sub\.since\]/gi, since);
  }

  // [user.sub.months]
  if (result.includes('[user.sub.months]')) {
    const sub    = await getSubInfo(username);
    const months = sub?.created_at ? monthsSince(sub.created_at) : '0';
    result = result.replace(/\[user\.sub\.months\]/gi, months);
  }

  // [user.bits.total]
  if (result.includes('[user.bits.total]')) {
    const bits = await getUserBits(username);
    result = result.replace(/\[user\.bits\.total\]/gi, bits !== null ? String(bits) : '0');
  }

  // [viewers]
  if (result.includes('[viewers]')) {
    const stream = await getStreamInfo();
    result = result.replace(/\[viewers\]/gi, stream ? String(stream.viewer_count) : '0');
  }

  // [game]
  if (result.includes('[game]')) {
    const stream   = await getStreamInfo();
    const gameName = stream ? await getGameName(stream.game_id) : 'unbekannt';
    result = result.replace(/\[game\]/gi, gameName);
  }

  // [title]
  if (result.includes('[title]')) {
    const stream = await getStreamInfo();
    result = result.replace(/\[title\]/gi, stream?.title || 'kein Titel');
  }

  return result;
}

// ============================================================
// HAUPT-FUNKTION
// ============================================================

async function handleCommand({ cmd, args, username, isAdmin, isMod, isVIP, isSub, economy, botConfig }) {
  const commands = loadCommands();
  const cmdLower = cmd.toLowerCase();

  const found = commands.find(c =>
    c.name === cmdLower ||
    (Array.isArray(c.aliases) && c.aliases.includes(cmdLower))
  );

  if (!found) return null;

  // Rollen-Check (unterstützt altes minRole und neues roles Array)
  const roles = found.roles || (found.minRole ? [found.minRole] : ['everyone']);
  if (!hasRole(roles, isAdmin, isMod, isVIP, isSub)) {
    return { text: null, blocked: true, reason: 'role' };
  }

  // Cooldown-Check
  const cooldownKey = `${username}:${found.name}`;
  const cooldownMs  = (Number(found.cooldown) || 0) * 1000;
  if (cooldownMs > 0) {
    const last = cooldowns.get(cooldownKey) || 0;
    const diff = Date.now() - last;
    if (diff < cooldownMs) {
      const rest = Math.ceil((cooldownMs - diff) / 1000);
      return { text: null, blocked: true, reason: 'cooldown', rest };
    }
  }

  cooldowns.set(cooldownKey, Date.now());

  // Zähler erhöhen
  found.count = (found.count || 0) + 1;
  saveCommands(commands);

  // Variablen ersetzen
  let text = found.response || '';
  text = text.replace(/\[count\]/gi, String(found.count));
  text = await resolveVariables(text, { username, args, economy, botConfig, isAdmin, isMod, isVIP, isSub });

  const fdReward = Number(found.fd) || 0;

  return { text, fdReward, cmd: found };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = { handleCommand, loadCommands, saveCommands };
