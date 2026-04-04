// actions.js
// Zentrale Aktions-Logik für Rewards

async function sendToOverlay(data) {
    try {
        await fetch("http://localhost:3000/api/overlay/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    } catch (err) {
        console.log("⚠ Fehler beim Senden an Overlay:", err.message);
    }
}

// SOUND
async function playSound(file, volume = 1.0) {
    console.log(`🔊 Spiele Sound: ${file} (Volume: ${volume})`);
    await sendToOverlay({ type: "playSound", url: `/sounds/${file}`, volume });
}

// FILTER
async function applyFilter(filter, duration) {
    console.log(`🎨 Filter aktiv: ${filter} für ${duration}ms`);
    await sendToOverlay({ type: "camFilter", file: filter, duration });
}

// TTS
async function speakTTS(text, voice, speed) {
    console.log(`🗣 TTS: "${text}" (Voice: ${voice}, Speed: ${speed})`);
    await sendToOverlay({ type: "tts", text, voice, speed });
}

// EFFECT
async function highlightMessage(color) {
    console.log(`✨ Highlight in Farbe: ${color}`);
    await sendToOverlay({ type: "highlight", color });
}

module.exports = {
    playSound,
    applyFilter,
    speakTTS,
    highlightMessage
};
