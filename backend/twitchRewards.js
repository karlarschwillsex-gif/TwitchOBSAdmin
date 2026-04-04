// /home/fynn/TwitchOBSAdmin/backend/twitchRewards.js
/**
 * Twitch Channel Points Rewards API
 * - Rewards abrufen
 * - Reward erstellen
 * - Reward aktualisieren (Kosten, Name etc.)
 * - Reward löschen
 */
require('dotenv').config();
const fetch = require('node-fetch');

const CLIENT_ID      = process.env.CLIENT_ID;
const USER_TOKEN     = process.env.TWITCH_USER_TOKEN;
const BROADCASTER_ID = process.env.BROADCASTER_ID;
const API_BASE       = 'https://api.twitch.tv/helix';

function headers() {
  return {
    'Client-ID':     CLIENT_ID,
    'Authorization': `Bearer ${USER_TOKEN}`,
    'Content-Type':  'application/json'
  };
}

// Alle Rewards abrufen
async function getRewards() {
  const res  = await fetch(
    `${API_BASE}/channel_points/custom_rewards?broadcaster_id=${BROADCASTER_ID}&only_manageable_rewards=true`,
    { headers: headers() }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Fehler beim Abrufen der Rewards');
  return data.data || [];
}

// Reward erstellen
async function createReward(params) {
  const res  = await fetch(
    `${API_BASE}/channel_points/custom_rewards?broadcaster_id=${BROADCASTER_ID}`,
    { method: 'POST', headers: headers(), body: JSON.stringify(params) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Fehler beim Erstellen des Rewards');
  return data.data?.[0] || null;
}

// Reward aktualisieren
async function updateReward(rewardId, params) {
  const res  = await fetch(
    `${API_BASE}/channel_points/custom_rewards?broadcaster_id=${BROADCASTER_ID}&id=${rewardId}`,
    { method: 'PATCH', headers: headers(), body: JSON.stringify(params) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Fehler beim Aktualisieren des Rewards');
  return data.data?.[0] || null;
}

// Reward löschen
async function deleteReward(rewardId) {
  const res = await fetch(
    `${API_BASE}/channel_points/custom_rewards?broadcaster_id=${BROADCASTER_ID}&id=${rewardId}`,
    { method: 'DELETE', headers: headers() }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Fehler beim Löschen des Rewards');
  }
  return true;
}

module.exports = { getRewards, createReward, updateReward, deleteReward };
