// /home/fynn/TwitchOBSAdmin/eventsub.js
/**
 * Robust EventSub listener
 * - Verifiziert Twitch EventSub Signaturen (wenn EVENTSUB_SECRET gesetzt)
 * - Behandelt webhook_callback_verification (Challenge)
 * - Delegiert Reward-Events an handleRewardEvent.js (sicher geladen)
 * - Optionales Forwarding an EVENTSUB_FORWARD
 * - Loggt in logs/eventsub.log
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');

const ROOT = __dirname;
const LOGDIR = path.join(ROOT, 'logs');
if (!fs.existsSync(LOGDIR)) fs.mkdirSync(LOGDIR, { recursive: true });
const LOGFILE = path.join(LOGDIR, 'eventsub.log');

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
  try { fs.appendFileSync(LOGFILE, line); } catch (e) { /* ignore */ }
  console.log('[eventsub]', ...parts);
}
function warn(...parts) { log('WARN', ...parts); }
function error(...parts) { log('ERROR', ...parts); }

const CREDITS_DIR = path.join(ROOT, 'twitch-credits');
const DEFAULT_PORT = 8080;

/**
 * Load twitch-credits/.env into process.env if present
 */
try {
  const creditsEnvPath = path.join(CREDITS_DIR, '.env');
  if (fs.existsSync(creditsEnvPath)) {
    const envLines = fs.readFileSync(creditsEnvPath, 'utf8')
      .split(/\r?\n/)
      .filter(l => l && !l.trim().startsWith('#'));
    envLines.forEach(line => {
      const [k, ...rest] = line.split('=');
      if (k) process.env[k.trim()] = rest.join('=').trim();
    });
    log('twitch-credits/.env geladen');
  }
} catch (err) {
  warn('Fehler beim Laden twitch-credits/.env', err && err.message ? err.message : err);
}

/**
 * Safe require for handleRewardEvent
 */
let handleRewardEvent = async () => {
  warn('handleRewardEvent stub: keine Aktion');
};

const handlerPath = path.join(ROOT, 'handleRewardEvent.js');
if (fs.existsSync(handlerPath)) {
  try {
    handleRewardEvent = require(handlerPath);
    log('handleRewardEvent geladen');
  } catch (err) {
    error('Fehler beim Laden handleRewardEvent.js', err && err.stack ? err.stack : err);
  }
} else {
  warn('handleRewardEvent.js nicht gefunden — stub aktiv');
}

/**
 * Express app with raw body capture for signature verification
 */
const app = express();

// capture raw body for signature verification
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

/**
 * Signature verification helper
 * Twitch HMAC: sha256 of (messageId + messageTimestamp + body) using EVENTSUB_SECRET
 */
function verifyTwitchSignature(req) {
  const secret = process.env.EVENTSUB_SECRET;
  if (!secret) {
    // No secret configured -> skip verification (warn)
    warn('EVENTSUB_SECRET nicht gesetzt, Signaturprüfung übersprungen');
    return true;
  }

  const msgId = req.headers['twitch-eventsub-message-id'];
  const msgTs = req.headers['twitch-eventsub-message-timestamp'];
  const sigHeader = req.headers['twitch-eventsub-message-signature'] || '';
  if (!msgId || !msgTs || !sigHeader) {
    warn('Fehlende EventSub Header für Signaturprüfung');
    return false;
  }

  const expectedPrefix = 'sha256=';
  if (!sigHeader.startsWith(expectedPrefix)) {
    warn('Unbekanntes Signaturformat', sigHeader);
    return false;
  }

  const signature = sigHeader.slice(expectedPrefix.length);
  const hmac = crypto.createHmac('sha256', secret);
  const body = req.rawBody ? req.rawBody.toString('utf8') : '';
  hmac.update(msgId + msgTs + body);
  const computed = hmac.digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const compBuf = Buffer.from(computed, 'hex');
    if (sigBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, compBuf);
  } catch (e) {
    warn('Fehler beim Vergleichen der Signaturen', e && e.message ? e.message : e);
    return false;
  }
}

/**
 * Health endpoint
 */
app.get('/', (req, res) => {
  res.type('text').send(`EventSub Listener läuft (port ${process.env.EVENTSUB_PORT || DEFAULT_PORT})`);
});

/**
 * Main EventSub endpoint
 * - Handles verification challenge
 * - Verifies signature (if secret configured)
 * - Delegates to handleRewardEvent (non-blocking)
 * - Optionally forwards to EVENTSUB_FORWARD
 */
app.post('/eventsub', async (req, res) => {
  try {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
    const msgType = (req.headers['twitch-eventsub-message-type'] || '').toLowerCase();
    const subType = req.body?.subscription?.type || 'unknown';

    log('Event empfangen:', { msgType, subType });

    // Handle verification challenge
    if (msgType === 'webhook_callback_verification' || req.body?.challenge) {
      const challenge = req.body.challenge || (req.body?.challenge === '' ? '' : null);
      if (challenge) {
        log('Challenge empfangen, antworte mit challenge');
        res.status(200).send(challenge);
        return;
      }
    }

    // Verify signature if secret present
    if (!verifyTwitchSignature(req)) {
      error('Signaturprüfung fehlgeschlagen, Event abgelehnt');
      return res.status(403).send('forbidden');
    }

    // Delegate to reward handler (do not block on errors)
    (async () => {
      try {
        await Promise.resolve(handleRewardEvent(req.body));
        log('handleRewardEvent ausgeführt');
      } catch (handlerErr) {
        error('Fehler im Reward-Handler', handlerErr && handlerErr.stack ? handlerErr.stack : handlerErr);
      }
    })();

    // Optional forwarding to configured backend/listener
    const forwardTo = process.env.EVENTSUB_FORWARD || process.env.TWITCH_EVENTSUB_FORWARD;
    if (forwardTo) {
      (async () => {
        try {
          await fetch(forwardTo, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: raw
          });
          log('Event weitergeleitet an', forwardTo);
        } catch (fwdErr) {
          warn('Weiterleitung fehlgeschlagen', fwdErr && fwdErr.message ? fwdErr.message : fwdErr);
        }
      })();
    }

    // Acknowledge
    res.status(200).send('ok');
  } catch (err) {
    error('Fehler beim Verarbeiten', err && err.stack ? err.stack : err);
    res.status(500).send('error');
  }
});

/**
 * Start listener and graceful shutdown
 */
const port = parseInt(process.env.EVENTSUB_PORT || DEFAULT_PORT, 10);
const server = app.listen(port, () => {
  log(`Listener läuft auf http://localhost:${port}`);
});

function shutdown() {
  log('Beende EventSub Listener...');
  server.close(() => {
    log('HTTP Server beendet');
    process.exit(0);
  });
  setTimeout(() => {
    warn('Forciertes Beenden des EventSub Listeners');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Export for tests or require usage (optional)
module.exports = { app, server };

