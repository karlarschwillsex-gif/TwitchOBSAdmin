// twitchApi.js
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const USER_TOKEN = process.env.TWITCH_USER_TOKEN;
const BROADCASTER_ID = process.env.BROADCASTER_ID;

const TWITCH_API = "https://api.twitch.tv/helix";

async function twitchRequest(endpoint, method = "GET", body = null) {
    const headers = {
        "Client-ID": CLIENT_ID,
        "Authorization": `Bearer ${USER_TOKEN}`,
        "Content-Type": "application/json"
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${TWITCH_API}${endpoint}`, options);

    if (!res.ok) {
        const err = await res.text();
        console.error("Twitch API Error:", err);
        throw new Error(err);
    }

    return res.json();
}

// ===============================
// CHANNEL POINTS
// ===============================

export async function getRedemptions() {
    return twitchRequest(`/channel_points/custom_rewards?broadcaster_id=${BROADCASTER_ID}`);
}

export async function createRedemption(data) {
    return twitchRequest(`/channel_points/custom_rewards?broadcaster_id=${BROADCASTER_ID}`, "POST", data);
}

export async function updateRedemption(rewardId, data) {
    return twitchRequest(`/channel_points/custom_rewards?broadcaster_id=${BROADCASTER_ID}&id=${rewardId}`, "PATCH", data);
}

// ===============================
// SUBSCRIBERS
// ===============================

export async function getSubscribers() {
    return twitchRequest(`/subscriptions?broadcaster_id=${BROADCASTER_ID}`);
}

// ===============================
// CHATTERS
// ===============================

export async function getChatters() {
    return twitchRequest(`/chat/chatters?broadcaster_id=${BROADCASTER_ID}&moderator_id=${BROADCASTER_ID}`);
}

console.log("Twitch API ready.");
