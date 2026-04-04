// /home/fynn/TwitchOBSAdmin/backend/obs-connection.js
const OBSWebSocket = require('obs-websocket-js').default;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });const obs = new OBSWebSocket();

let connected       = false;
let reconnectInterval = null;

const OBS_PASSWORD = process.env.OBS_PASSWORD || '';
const SOUNDS_PATH  = path.join(__dirname, '..', 'public', 'sounds');

// ============================================================
// VERBINDUNG
// ============================================================
async function connectObs() {
  if (connected) return;

  try {
    await obs.connect('ws://127.0.0.1:4455', OBS_PASSWORD);
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

// Beim Start direkt verbinden
connectObs();

// ============================================================
// FILTER DER V_CAM HOLEN
// ============================================================
async function getVirtualCamFilters() {
  await connectObs();
  if (!connected) return [];

  try {
    const res = await obs.call('GetSourceFilterList', { sourceName: 'V_Cam' });
    return (res.filters || []).map(f => ({ filterName: f.filterName }));
  } catch (err) {
    console.error('[OBS] GetSourceFilterList Fehler:', err.message || err);
    return [];
  }
}

// ============================================================
// FILTER EIN/AUS
// ============================================================
async function setFilterState(filterName, enabled) {
  await connectObs();
  if (!connected) return false;

  try {
    await obs.call('SetSourceFilterEnabled', {
      sourceName:    'V_Cam',
      filterName,
      filterEnabled: enabled
    });
    return true;
  } catch (err) {
    console.error('[OBS] SetSourceFilterEnabled Fehler:', err.message || err);
    return false;
  }
}

// ============================================================
// SOUND ABSPIELEN ÜBER OBS MEDIAQUELLE
// ============================================================
async function playSound(file, volume = 0.8) {
  await connectObs();
  if (!connected) {
    console.warn('[OBS] Nicht verbunden — Sound kann nicht abgespielt werden');
    return false;
  }

  const sourceName  = `_sound_${Date.now()}`;
  const soundFile   = path.join(SOUNDS_PATH, file);
  const obsVolume   = Math.round(Math.min(1, Math.max(0, volume)) * 100); // 0-100

  try {
    // Mediaquelle erstellen
    await obs.call('CreateInput', {
      sceneName:   '_Admin-Panel',
      inputName:   sourceName,
      inputKind:   'ffmpeg_source',
      inputSettings: {
        local_file:     soundFile,
        is_local_file:  true,
        looping:        false,
        restart_on_activate: true
      },
      sceneItemEnabled: true
    });

	await obs.call('SetInputAudioMonitorType', {
	  inputName:   sourceName,
	  monitorType: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
	});

    console.log(`[OBS] Sound Quelle erstellt: ${sourceName}`);

    // Lautstärke setzen (OBS nutzt Multiplikator 0.0-1.0)
    await obs.call('SetInputVolume', {
      inputName:        sourceName,
      inputVolumeMul:   volume
    });

    // Warte bis Sound fertig ist (basierend auf Dateiname schätzen wir 10s max)
    // Dann Quelle löschen
    setTimeout(async () => {
      try {
        await obs.call('RemoveInput', { inputName: sourceName });
        console.log(`[OBS] Sound Quelle gelöscht: ${sourceName}`);
      } catch (e) {
        // Quelle existiert vielleicht schon nicht mehr
      }
    }, 15000);

    return true;
  } catch (err) {
    console.error('[OBS] playSound Fehler:', err.message || err);

    // Aufräumen falls nötig
    try { await obs.call('RemoveInput', { inputName: sourceName }); } catch { }

    return false;
  }
}

// ============================================================
// EXPORT
// ============================================================
module.exports = {
  getVirtualCamFilters,
  setFilterState,
  playSound,
  connectObs
};
