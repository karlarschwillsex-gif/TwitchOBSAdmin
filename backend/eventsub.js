// eventsub.js
import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BROADCASTER_ID = process.env.BROADCASTER_ID;
const EVENTSUB_SECRET = process.env.EVENTSUB_SECRET;
const CALLBACK_URL = process.env.TWITCH_EVENTSUB_CALLBACK;

const TWITCH_API = "https://api.twitch.tv/helix/eventsub/subscriptions";

const router = express.Router();

// ===============================
// HELPER: APP TOKEN HOLEN
// ===============================
async function getAppToken() {
    const res = await fetch(`https://id.twitch.tv/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "client_credentials"
        })
    });

    const data = await res.json();
    return data.access_token;
}

// ===============================
// HELPER: SUBSCRIPTION ANLEGEN
// ===============================
async function createSubscription(type, condition) {
    const token = await getAppToken();

    const body = {
        type,
        version: "1",
        condition,
        transport: {
            method: "webhook",
            callback: CALLBACK_URL,
            secret: EVENTSUB_SECRET
        }
    };

    const res = await fetch(TWITCH_API, {
        method: "POST",
        headers: {
            "Client-ID": CLIENT_ID,
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log("EventSub created:", data);
    return data;
}

// ===============================
// SIGNATUR VERIFIZIEREN
// ===============================
function verifySignature(req) {
    const messageId = req.header("Twitch-Eventsub-Message-Id");
    const timestamp = req.header("Twitch-Eventsub-Message-Timestamp");
    const signature = req.header("Twitch-Eventsub-Message-Signature");

    const message = messageId + timestamp + req.rawBody;
    const computed = "sha256=" + crypto.createHmac("sha256", EVENTSUB_SECRET).update(message).digest("hex");

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
}

// ===============================
// CALLBACK ENDPOINT
// ===============================
router.post("/eventsub", express.raw({ type: "application/json" }), (req, res) => {
    if (!verifySignature(req)) {
        console.log("❌ EventSub Signature invalid!");
        return res.status(403).send("Invalid signature");
    }

    const msgType = req.header("Twitch-Eventsub-Message-Type");
    const body = JSON.parse(req.body);

    // CHALLENGE
    if (msgType === "webhook_callback_verification") {
        console.log("✔ EventSub verified");
        return res.status(200).send(body.challenge);
    }

    // NOTIFICATION
    if (msgType === "notification") {
        console.log("📨 EventSub Event:", body);

        // Hier kannst du Events weiterleiten:
        // z.B. channel points → economy
        // z.B. subs → overlay
        // z.B. follows → credits

        return res.status(200).send("OK");
    }

    res.status(200).send("OK");
});

// ===============================
// SUBSCRIPTIONS REGISTRIEREN
// ===============================
export async function registerEventSubs() {
    console.log("🔄 Registriere EventSub Subscriptions…");

    await createSubscription("channel.channel_points_custom_reward_redemption.add", {
        broadcaster_user_id: BROADCASTER_ID
    });

    await createSubscription("channel.follow", {
        broadcaster_user_id: BROADCASTER_ID
    });

    await createSubscription("channel.subscribe", {
        broadcaster_user_id: BROADCASTER_ID
    });

    console.log("✔ EventSub Subscriptions registriert.");
}

export default router;
