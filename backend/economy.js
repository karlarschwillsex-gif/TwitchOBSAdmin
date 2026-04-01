// /home/fynn/TwitchOBSAdmin/backend/economy.js
/**
 * F$ (Fuchsdollar) Economy Engine
 *
 * Regeln:
 * - Pro Chatnachricht gibt es X F$ (mit Cooldown + Nachrichten-Spam-Schutz)
 * - Admin hat unendlich F$ (999999999)
 * - MOD, VIP, SUB haben eigene Multiplikatoren — höchster gewinnt
 * - Bit-Spenden geben Bits × Staffel-Faktor als F$
 * - Staffeln: 10+ x1, 100+ x2, 1000+ x3, 10000+ x4, 100000 x5
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.join(__dirname, '..');
const ECONOMY_FILE = path.join(ROOT, 'data', 'economy.json');
const CREDITS_DIR  = path.join(ROOT, 'data', 'credits');

// Verzeichnisse sicherstellen
[CREDITS_DIR, path.join(ROOT, 'data')].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// In-Memory Spam-Schutz: { username: { lastReward: timestamp, lastMessages: [] } }
const spamGuard = new Map();

const ADMIN_BALANCE = 999999999;

// ============================================================
// HELPERS
// ============================================================

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
    basePerMessage:      1,      // F$ pro Nachricht (Basis)
    cooldownSeconds:     5,      // Cooldown zwischen Belohnungen
    spamCheckMessages:   3,      // Letzte X Nachrichten prüfen
    factorMod:           1.5,    // Multiplikator für MODs
    factorVip:           1.5,    // Multiplikator für VIPs
    factorSub:           2.0,    // Multiplikator für SUBs
    bitFactor1:          1,      // ab 10 Bits
    bitFactor2:          2,      // ab 100 Bits
    bitFactor3:          3,      // ab 1000 Bits
    bitFactor4:          4,      // ab 10000 Bits
    bitFactor5:          5       // ab 100000 Bits
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

// ============================================================
// SPAM-SCHUTZ
// ============================================================

/**
 * Prüft ob ein User gerade F$ bekommen darf.
 * - Cooldown muss abgelaufen sein
 * - Nachricht darf nicht unter den letzten X Nachrichten sein
 */
function checkSpamGuard(username, message, economy) {
  const now             = Date.now();
  const cooldownMs      = (Number(economy.cooldownSeconds)   || 5) * 1000;
  const spamCheckCount  =  Number(economy.spamCheckMessages) || 3;

  if (!spamGuard.has(username)) {
    spamGuard.set(username, { lastReward: 0, lastMessages: [] });
  }

  const guard = spamGuard.get(username);

  // Cooldown prüfen
  if (now - guard.lastReward < cooldownMs) {
    return false;
  }

  // Nachrichten-Duplikat prüfen
  const msgLower = (message || '').trim().toLowerCase();
  if (guard.lastMessages.includes(msgLower)) {
    return false;
  }

  // Alles OK — aktualisieren
  guard.lastReward = now;
  guard.lastMessages.push(msgLower);
  if (guard.lastMessages.length > spamCheckCount) {
    guard.lastMessages.shift();
  }

  return true;
}

// ============================================================
// FAKTOR BERECHNEN
// ============================================================

/**
 * Gibt den höchsten Faktor für einen User zurück.
 * Reihenfolge: SUB > MOD > VIP > 1
 */
function getBestFactor(isMod, isVIP, isSub, economy) {
  const factors = [1];
  if (isMod) factors.push(Number(economy.factorMod) || 1);
  if (isVIP) factors.push(Number(economy.factorVip) || 1);
  if (isSub) factors.push(Number(economy.factorSub) || 1);
  return Math.max(...factors);
}

// ============================================================
// BIT-STAFFEL BERECHNEN
// ============================================================

function getBitFactor(bits, economy) {
  const b = Number(bits) || 0;
  if (b >= 100000) return Number(economy.bitFactor5) || 5;
  if (b >= 10000)  return Number(economy.bitFactor4) || 4;
  if (b >= 1000)   return Number(economy.bitFactor3) || 3;
  if (b >= 100)    return Number(economy.bitFactor2) || 2;
  if (b >= 10)     return Number(economy.bitFactor1) || 1;
  return 0; // unter 10 Bits → keine F$
}

// ============================================================
// HAUPT-FUNKTION: onChatMessage
// ============================================================

/**
 * Bei jeder Chat-Nachricht aufrufen.
 * Gibt zurück wie viele F$ der User bekommen hat (0 wenn Spam/Cooldown).
 */
function onChatMessage({ username, message, isAdmin, isMod, isVIP, isSub }) {
  // Admin hat unendlich
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

  // Spam-Schutz
  if (!checkSpamGuard(username, message, economy)) {
    const data = readCredits(username);
    return { credits: data.credits, delta: 0, blocked: true };
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

// ============================================================
// BIT-SPENDE
// ============================================================

/**
 * Bei einer Bit-Spende aufrufen.
 * bits = Anzahl der gespendeten Bits
 */
function onBitDonation({ username, bits }) {
  const economy = loadEconomy();
  const factor  = getBitFactor(bits, economy);

  if (factor === 0) {
    return { credits: readCredits(username).credits, delta: 0, reason: 'unter 10 Bits' };
  }

  const delta   = Math.floor(bits * factor);
  const data    = readCredits(username);
  data.credits  = (data.credits || 0) + delta;
  data.username = username;
  writeCredits(username, data);

  console.log(`[economy] Bit-Spende: ${username} spendete ${bits} Bits → +${delta} F$ (Faktor x${factor})`);

  return { credits: data.credits, delta, factor };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  onChatMessage,
  onBitDonation,
  readCredits,
  writeCredits,
  getDefaultEconomy,
  ADMIN_BALANCE
};
