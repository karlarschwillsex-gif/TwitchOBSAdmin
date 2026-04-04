// backend/eventsub.js
const express  = require("express");
const crypto   = require("crypto");
const fetch    = require("node-fetch");
const fs       = require("fs");
const path     = require("path");
require("dotenv").config();

const CLIENT_ID      = process.env.CLIENT_ID;
const CLIENT_SECRET  = process.env.CLIENT_SECRET;
const BROADCASTER_ID = process.env.BROADCASTER_ID;
const EVENTSUB_SECRET = process.env.EVENTSUB_SECRET;
const CALLBACK_URL   = process.env.TWITCH_EVENTSUB_CALLBACK;

const TWITCH_API = "https://api.twitch.tv/helix/eventsub/subscriptions";
const ROOT       = path.join(__dirname, "..");
const DATA_DIR   = path.join(ROOT, "data");
const SESSION_FILE = path.join(DATA_DIR, "session.json");

const router = express.Router();

// ── Session Tracking ──
// Speichert alle Events des aktuellen Streams
function readSession() {
    try {
        if (!fs.existsSync(SESSION_FILE)) return defaultSession();
        return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    } catch { return defaultSession(); }
}

function defaultSession() {
    return {
        startTime:    null,
        viewers:      [],   // alle heutigen Zuschauer
        newSubs:      [],   // heutige neue Subs
        resubs:       [],   // heutige Resubs
        giftSubs:     {},   // Schenker → Anzahl
        bitDonors:    {},   // User → Bits
        chatCount:    {},   // User → Nachrichtenanzahl
        iconCount:    {},   // Emote/Icon → Anzahl
        followers:    []    // heutige neue Follower
    };
}

function writeSession(s) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2));
    } catch(e) { console.error("[eventsub] Session write error:", e.message); }
}

// Session starten (beim ersten Event des Tages)
function ensureSessionStarted() {
    const s = readSession();
    if (!s.startTime) {
        // Auf volle Stunde aufrunden
        const now  = new Date();
        const full = new Date(now);
        if (now.getMinutes() > 0 || now.getSeconds() > 0) {
            full.setHours(now.getHours() + 1, 0, 0, 0);
        }
        s.startTime = full.toISOString();
        writeSession(s);
        console.log("[eventsub] Session gestartet, Sendezeit ab:", full.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    }
    return s;
}

// ── Viewer tracken (aus chat) ──
function trackViewer(username) {
    const s = ensureSessionStarted();
    if (!s.viewers.includes(username)) {
        s.viewers.push(username);
        writeSession(s);
    }
}

// ── Chat tracken ──
function trackChat(username, message) {
    const s = ensureSessionStarted();
    trackViewer(username);
    s.chatCount[username] = (s.chatCount[username] || 0) + 1;

    // FaireWelt Icons/Emotes tracken (fairewelt*)
    const emotes = message.match(/fairewelt\w*/gi) || [];
    emotes.forEach(e => {
        const key = e.toLowerCase();
        s.iconCount[key] = (s.iconCount[key] || 0) + 1;
    });

    writeSession(s);
}

// ── API: Session Daten lesen (für credits_api) ──
router.get("/session", (req, res) => {
    res.json(readSession());
});

// ── API: Session zurücksetzen (Stream-Ende) ──
router.post("/session/reset", (req, res) => {
    writeSession(defaultSession());
    res.json({ ok: true });
});

// ===============================
// HELPER: APP TOKEN HOLEN
// ===============================
async function getAppToken() {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id:     CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type:    "client_credentials"
        })
    });
    const data = await res.json();
    return data.access_token;
}

// ===============================
// HELPER: SUBSCRIPTION ANLEGEN
// ===============================
async function createSubscription(type, condition, version = "1") {
    if (!CLIENT_ID || !CLIENT_SECRET || !CALLBACK_URL || !EVENTSUB_SECRET || !BROADCASTER_ID) {
        console.warn("[eventsub] Fehlende Umgebungsvariablen, Subscription übersprungen:", type);
        return null;
    }
    try {
        const token = await getAppToken();
        const res = await fetch(TWITCH_API, {
            method: "POST",
            headers: {
                "Client-ID":     CLIENT_ID,
                "Authorization": `Bearer ${token}`,
                "Content-Type":  "application/json"
            },
            body: JSON.stringify({
                type, version, condition,
                transport: { method: "webhook", callback: CALLBACK_URL, secret: EVENTSUB_SECRET }
            })
        });
        const data = await res.json();
        console.log("[eventsub] Subscription erstellt:", type, data.data?.[0]?.status || data.error || "ok");
        return data;
    } catch (err) {
        console.error("[eventsub] createSubscription Fehler:", type, err.message || err);
        return null;
    }
}

// ===============================
// SIGNATUR VERIFIZIEREN
// ===============================
function verifySignature(req) {
    if (!EVENTSUB_SECRET) return true;
    const messageId = req.header("Twitch-Eventsub-Message-Id")        || "";
    const timestamp = req.header("Twitch-Eventsub-Message-Timestamp") || "";
    const signature = req.header("Twitch-Eventsub-Message-Signature") || "";
    const rawBody   = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body || {});
    const computed  = "sha256=" + crypto.createHmac("sha256", EVENTSUB_SECRET).update(messageId + timestamp + rawBody).digest("hex");
    try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed)); }
    catch { return false; }
}

// ===============================
// EVENT HANDLER
// ===============================
function handleRewardEvent(event) {
    try {
        const rewardFile = path.join(ROOT, "data", "cam_rewards.json");
        const soundFile  = path.join(ROOT, "data", "sound_rewards.json");

        const camRewards   = fs.existsSync(rewardFile) ? JSON.parse(fs.readFileSync(rewardFile,  "utf8")) : [];
        const soundRewards = fs.existsSync(soundFile)  ? JSON.parse(fs.readFileSync(soundFile,   "utf8")) : [];

        const rewardId   = event.reward?.id;
        const rewardTitle = event.reward?.title || "";
        const username   = event.user_login || event.user_name || "";

        // Viewer tracken
        if (username) trackViewer(username);

        // Cam-Filter prüfen
        const cam = camRewards.find(r => r.rewardId === rewardId || r.rewardName === rewardTitle);
        if (cam) {
            fetch(`http://localhost:${process.env.PORT || 3000}/api/admin/cam-filter/trigger`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ filterName: cam.filterName, duration: cam.duration || 10 })
            }).catch(e => console.error("[eventsub] Cam-Filter Fehler:", e.message));
        }

        // Sound prüfen
        const sound = soundRewards.find(r => r.rewardId === rewardId || r.rewardName === rewardTitle);
        if (sound) {
            fetch(`http://localhost:${process.env.PORT || 3000}/api/admin/play-sound`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ file: sound.file, volume: sound.volume || 80, name: sound.rewardName, user: username })
            }).catch(e => console.error("[eventsub] Sound Fehler:", e.message));
        }
    } catch(e) { console.error("[eventsub] handleRewardEvent Fehler:", e.message); }
}

// ===============================
// CALLBACK ENDPOINT
// ===============================
router.post("/eventsub", (req, res) => {
    if (!verifySignature(req)) {
        console.warn("[eventsub] Ungültige Signatur");
        return res.status(403).send("Invalid signature");
    }

    const msgType = req.header("Twitch-Eventsub-Message-Type") || "";
    let body;
    try {
        body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
    } catch { return res.status(400).send("Bad JSON"); }

    // CHALLENGE
    if (msgType === "webhook_callback_verification") {
        console.log("[eventsub] Challenge beantwortet");
        return res.status(200).send(body.challenge);
    }

    // NOTIFICATION
    if (msgType === "notification") {
        const type  = body?.subscription?.type || "";
        const event = body?.event || {};
        const user  = (event.user_login || event.user_name || "").toLowerCase();

        console.log("[eventsub] Event:", type, user || "");

        switch (type) {

            // Channel Points
            case "channel.channel_points_custom_reward_redemption.add":
                handleRewardEvent(event);
                break;

            // Neuer Follower
            case "channel.follow":
                if (user) {
                    const s = ensureSessionStarted();
                    if (!s.followers.includes(user)) { s.followers.push(user); writeSession(s); }
                    trackViewer(user);
                }
                break;

            // Neuer Sub
            case "channel.subscribe":
                if (user && !event.is_gift) {
                    const s = ensureSessionStarted();
                    if (!s.newSubs.includes(user)) { s.newSubs.push(user); writeSession(s); }
                    trackViewer(user);
                }
                break;

            // Resub
            case "channel.subscription.message":
                if (user) {
                    const s = ensureSessionStarted();
                    if (!s.resubs.includes(user)) { s.resubs.push(user); writeSession(s); }
                    trackViewer(user);
                }
                break;

            // Gift Sub
            case "channel.subscription.gift":
                if (user) {
                    const s = ensureSessionStarted();
                    s.giftSubs[user] = (s.giftSubs[user] || 0) + (event.total || 1);
                    writeSession(s);
                    trackViewer(user);
                }
                break;

            // Bits / Cheer
            case "channel.cheer":
                if (user) {
                    const s = ensureSessionStarted();
                    s.bitDonors[user] = (s.bitDonors[user] || 0) + (event.bits || 0);
                    writeSession(s);
                    trackViewer(user);
                }
                break;

            // Chat Message
            case "channel.chat.message":
                if (user) {
                    trackChat(user, event.message?.text || "");
                }
                break;
        }
    }

    res.status(200).send("OK");
});

// ===============================
// SUBSCRIPTIONS REGISTRIEREN
// ===============================
async function registerEventSubs() {
    if (!BROADCASTER_ID) {
        console.warn("[eventsub] BROADCASTER_ID fehlt — Subscriptions übersprungen");
        return;
    }
    console.log("[eventsub] Registriere EventSub Subscriptions…");

    await createSubscription("channel.channel_points_custom_reward_redemption.add", { broadcaster_user_id: BROADCASTER_ID });
    await createSubscription("channel.follow",              { broadcaster_user_id: BROADCASTER_ID, moderator_user_id: BROADCASTER_ID }, "2");
    await createSubscription("channel.subscribe",           { broadcaster_user_id: BROADCASTER_ID });
    await createSubscription("channel.subscription.message",{ broadcaster_user_id: BROADCASTER_ID });
    await createSubscription("channel.subscription.gift",   { broadcaster_user_id: BROADCASTER_ID });
    await createSubscription("channel.cheer",               { broadcaster_user_id: BROADCASTER_ID });
    await createSubscription("channel.chat.message",        { broadcaster_user_id: BROADCASTER_ID, user_id: BROADCASTER_ID }, "1");

    console.log("[eventsub] Subscriptions abgeschlossen.");
}

module.exports = { router, registerEventSubs, trackChat, trackViewer, readSession };
