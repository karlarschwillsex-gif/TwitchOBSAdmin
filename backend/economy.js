// /home/fynn/TwitchOBSAdmin/backend/economy.js
const fs   = require('fs');
const path = require('path');

const ROOT         = path.join(__dirname, '..');
const ECONOMY_FILE = path.join(ROOT, 'data', 'economy.json');
const CREDITS_DIR  = path.join(ROOT, 'data', 'credits');

[CREDITS_DIR, path.join(ROOT, 'data')].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const spamGuard     = new Map();
const ADMIN_BALANCE = 999999999;

function loadEconomy() {
  try {
    if (!fs.existsSync(ECONOMY_FILE)) return getDefaultEconomy();
    return JSON.parse(fs.readFileSync(ECONOMY_FILE, 'utf8'));
  } catch (e) {
    console.error('[economy] loadEconomy Fehler:', e.message);
    return getDefaultEconomy();
  }
}

function getDefaultEconomy() {
  return {
    basePerMessage:    1,
    cooldownSeconds:   5,
    spamCheckMessages: 3,
    factorMod:         1.5,
    factorVip:         1.5,
    factorSub:         2.0,
    bitFactor1:        1.0,
    bitFactor2:        1.5,
    bitFactor3:        2.0,
    bitFactor4:        2.5,
    bitFactor5:        3.0
  };
}

function creditsFile(username) {
  const safe = String(username).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return path.join(CREDITS_DIR, `${safe}.json`);
}

function readCredits(username) {
  const fp = creditsFile(username);
  try {
    if (!fs.existsSync(fp)) return { username, credits: 0 };
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    return { username, credits: 0 };
  }
}

function writeCredits(username, obj) {
  try {
    fs.writeFileSync(creditsFile(username), JSON.stringify(obj, null, 2));
    return true;
  } catch (e) {
    console.error('[economy] writeCredits Fehler:', username, e.message);
    return false;
  }
}

function checkSpamGuard(username, message, economy) {
  const now            = Date.now();
  const cooldownMs     = (Number(economy.cooldownSeconds)   || 5) * 1000;
  const spamCheckCount =  Number(economy.spamCheckMessages) || 3;

  if (!spamGuard.has(username)) {
    spamGuard.set(username, { lastReward: 0, lastMessages: [] });
  }

  const guard = spamGuard.get(username);
  if (now - guard.lastReward < cooldownMs) return false;

  const msgLower = (message || '').trim().toLowerCase();
  if (guard.lastMessages.includes(msgLower)) return false;

  guard.lastReward = now;
  guard.lastMessages.push(msgLower);
  if (guard.lastMessages.length > spamCheckCount) guard.lastMessages.shift();

  return true;
}

function getBestFactor(isMod, isVIP, isSub, economy) {
  const factors = [1];
  if (isMod) factors.push(Number(economy.factorMod) || 1);
  if (isVIP) factors.push(Number(economy.factorVip) || 1);
  if (isSub) factors.push(Number(economy.factorSub) || 1);
  return Math.max(...factors);
}

function getBitFactor(bits, economy) {
  const b = Number(bits) || 0;
  if (b < 10)      return 1.0;  // unter 10 Bits → fest 1.0
  if (b >= 100000) return Number(economy.bitFactor5) || 3.0;
  if (b >= 10000)  return Number(economy.bitFactor4) || 2.5;
  if (b >= 1000)   return Number(economy.bitFactor3) || 2.0;
  if (b >= 100)    return Number(economy.bitFactor2) || 1.5;
  return Number(economy.bitFactor1) || 1.0;
}

function onChatMessage({ username, message, isAdmin, isMod, isVIP, isSub }) {
  if (isAdmin) {
    const data = readCredits(username);
    if (data.credits !== ADMIN_BALANCE) {
      data.credits  = ADMIN_BALANCE;
      data.username = username;
      writeCredits(username, data);
    }
    return { credits: ADMIN_BALANCE, delta: 0, isAdmin: true };
  }

  const economy = loadEconomy();
  if (!checkSpamGuard(username, message, economy)) {
    return { credits: readCredits(username).credits, delta: 0, blocked: true };
  }

  const base   = Number(economy.basePerMessage) || 1;
  const factor = getBestFactor(isMod, isVIP, isSub, economy);
  const delta  = Math.floor(base * factor);

  const data    = readCredits(username);
  data.credits  = (data.credits || 0) + delta;
  data.username = username;
  writeCredits(username, data);

  return { credits: data.credits, delta };
}

function onBitDonation({ username, bits }) {
  const economy = loadEconomy();
  const factor  = getBitFactor(bits, economy);
  const delta   = Math.floor(bits * factor);

  const data    = readCredits(username);
  data.credits  = (data.credits || 0) + delta;
  data.username = username;
  writeCredits(username, data);

  console.log(`[economy] ${username} spendete ${bits} Bits → +${delta} F$ (×${factor})`);
  return { credits: data.credits, delta, factor };
}

module.exports = { onChatMessage, onBitDonation, readCredits, writeCredits, getDefaultEconomy, ADMIN_BALANCE };
