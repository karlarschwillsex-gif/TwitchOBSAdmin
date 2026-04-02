// /home/fynn/TwitchOBSAdmin/createEventSub.js
require('dotenv').config();
const fetch = require('node-fetch');

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CALLBACK = process.env.TWITCH_EVENTSUB_CALLBACK;
const BROADCASTER_ID = process.env.BROADCASTER_ID;
const SECRET = process.env.EVENTSUB_SECRET;

// Hole APP TOKEN (automatisch)
async function getAppToken() {
  const res = await fetch(`https://id.twitch.tv/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
  });

  const data = await res.json();
  return data.access_token;
}

// Subscription erstellen
async function createSubscription(appToken, type, version, condition) {
  const body = {
    type,
    version,
    condition,
    transport: {
      method: "webhook",
      callback: CALLBACK,
      secret: SECRET
    }
  };

  const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Client-ID": CLIENT_ID,
      "Authorization": `Bearer ${appToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  console.log(`Subscription (${type}) →`, JSON.stringify(data, null, 2));
}

(async () => {
  console.log("Hole App Token...");
  const appToken = await getAppToken();

  console.log("Erstelle EventSub Subscriptions...");

  await createSubscription(appToken, "stream.online", "1", {
    broadcaster_user_id: BROADCASTER_ID
  });

  await createSubscription(appToken, "stream.offline", "1", {
    broadcaster_user_id: BROADCASTER_ID
  });

  await createSubscription(appToken, "channel.follow", "2", {
    broadcaster_user_id: BROADCASTER_ID,
    moderator_user_id: BROADCASTER_ID
  });

  await createSubscription(appToken, "channel.subscribe", "1", {
    broadcaster_user_id: BROADCASTER_ID
  });

  console.log("Fertig.");
})();

