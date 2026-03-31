// /home/fynn/TwitchOBSAdmin/backend/obs-connection.js
const OBSWebSocket = require('obs-websocket-js').default;
const obs = new OBSWebSocket();

let connected = false;
let reconnectInterval = null;

const OBS_PASSWORD = process.env.OBS_PASSWORD || "in .env";

// Verbindung herstellen
async function connectObs() {
  if (connected) return;

  try {
    await obs.connect('ws://127.0.0.1:4455', {
      password: OBS_PASSWORD
    });

    connected = true;
    console.log('[OBS] Verbunden (WebSocket 5.x)');

    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }

  } catch (err) {
    console.error('[OBS] Verbindung fehlgeschlagen:', err.message || err);
    startReconnectLoop();
  }
}

function startReconnectLoop() {
  if (reconnectInterval) return;

  console.log('[OBS] Starte Auto-Reconnect…');

  reconnectInterval = setInterval(() => {
    if (!connected) {
      console.log('[OBS] Reconnect-Versuch…');
      connectObs();
    }
  }, 3000);
}

obs.on('ConnectionClosed', () => {
  console.log('[OBS] Verbindung verloren!');
  connected = false;
  startReconnectLoop();
});

// Filter der Quelle V_Cam holen (nur Namen)
async function getVirtualCamFilters() {
  await connectObs();
  if (!connected) return [];

  try {
    const res = await obs.call('GetSourceFilterList', {
      sourceName: 'V_Cam'
    });

    return (res.filters || []).map(f => ({
      filterName: f.filterName
    }));

  } catch (err) {
    console.error('[OBS] GetSourceFilterList Fehler:', err.message || err);
    return [];
  }
}

// Filter ein-/ausschalten
async function setFilterState(filterName, enabled) {
  await connectObs();
  if (!connected) return false;

  try {
    await obs.call('SetSourceFilterEnabled', {
      sourceName: 'V_Cam',
      filterName,
      filterEnabled: enabled
    });

    return true;

  } catch (err) {
    console.error('[OBS] SetSourceFilterEnabled Fehler:', err.message || err);
    return false;
  }
}

module.exports = {
  getVirtualCamFilters,
  setFilterState,
  connectObs
};
