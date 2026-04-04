function initEconomy() {
    const apiUrl = "/api/admin/economy";

    const fields = {
        basePerMessage:    document.getElementById("basePerMessage"),
        cooldownSeconds:   document.getElementById("cooldownSeconds"),
        spamCheckMessages: document.getElementById("spamCheckMessages"),
        factorMod:         document.getElementById("factorMod"),
        factorVip:         document.getElementById("factorVip"),
        factorSub:         document.getElementById("factorSub"),
        bitFactor1:        document.getElementById("bitFactor1"),
        bitFactor2:        document.getElementById("bitFactor2"),
        bitFactor3:        document.getElementById("bitFactor3"),
        bitFactor4:        document.getElementById("bitFactor4"),
        bitFactor5:        document.getElementById("bitFactor5")
    };

    const statsBox     = document.getElementById("economyStats");
    const sessionInfo  = document.getElementById("sessionInfo");
    const sessionStatus = document.getElementById("sessionStatus");

    async function loadEconomy() {
        try {
            const res  = await fetch(apiUrl);
            const data = await res.json();

            fields.basePerMessage.value    = data.basePerMessage    ?? 1;
            fields.cooldownSeconds.value   = data.cooldownSeconds   ?? 5;
            fields.spamCheckMessages.value = data.spamCheckMessages ?? 3;
            fields.factorMod.value         = data.factorMod         ?? 1.5;
            fields.factorVip.value         = data.factorVip         ?? 1.5;
            fields.factorSub.value         = data.factorSub         ?? 2.0;
            fields.bitFactor1.value        = data.bitFactor1        ?? 1.0;
            fields.bitFactor2.value        = data.bitFactor2        ?? 1.5;
            fields.bitFactor3.value        = data.bitFactor3        ?? 2.0;
            fields.bitFactor4.value        = data.bitFactor4        ?? 2.5;
            fields.bitFactor5.value        = data.bitFactor5        ?? 3.0;

            renderStats(data);
        } catch (err) {
            console.error("Fehler beim Laden der F$ Einstellungen:", err);
        }
    }

    function renderStats(data) {
        statsBox.innerHTML = `
            <h3>Aktuell gespeicherte F$ Einstellungen</h3>
            <ul>
                <li><strong>F$ pro Nachricht:</strong> ${data.basePerMessage ?? 1}</li>
                <li><strong>Cooldown:</strong> ${data.cooldownSeconds ?? 5} Sekunden</li>
                <li><strong>Spam-Schutz:</strong> letzte ${data.spamCheckMessages ?? 3} Nachrichten</li>
                <li><strong>MOD-Faktor:</strong> ×${data.factorMod ?? 1.5}</li>
                <li><strong>VIP-Faktor:</strong> ×${data.factorVip ?? 1.5}</li>
                <li><strong>SUB-Faktor:</strong> ×${data.factorSub ?? 2.0}</li>
                <li><strong>Bit-Staffeln:</strong>
                    &lt;10 ×1.0 (fest) /
                    ab 10 ×${data.bitFactor1 ?? 1.0} /
                    ab 100 ×${data.bitFactor2 ?? 1.5} /
                    ab 1.000 ×${data.bitFactor3 ?? 2.0} /
                    ab 10.000 ×${data.bitFactor4 ?? 2.5} /
                    ab 100.000 ×${data.bitFactor5 ?? 3.0}
                </li>
                <li><strong>Admin:</strong> ∞ F$ 🦊</li>
            </ul>
        `;
    }

    // ── Session Info laden ──
    async function loadSessionInfo() {
        try {
            const res  = await fetch('/eventsub/session');
            const data = await res.json();

            if (!data.startTime) {
                sessionInfo.innerHTML = '⚫ Keine aktive Session — noch kein Stream gestartet.';
                return;
            }

            const start    = new Date(data.startTime);
            const now      = new Date();
            const diffMin  = Math.floor((now - start) / 1000 / 60);
            const h        = Math.floor(diffMin / 60);
            const m        = diffMin % 60;
            const laufzeit = h > 0 ? `${h}h ${m}min` : `${m} Minuten`;

            const viewers  = (data.viewers  || []).length;
            const newSubs  = (data.newSubs  || []).length;
            const resubs   = (data.resubs   || []).length;
            const chatters = Object.keys(data.chatCount || {}).length;
            const bits     = Object.values(data.bitDonors || {}).reduce((s, v) => s + v, 0);
            const gifts    = Object.values(data.giftSubs || {}).reduce((s, v) => s + v, 0);

            sessionInfo.innerHTML = `
                🟢 <strong>Stream läuft seit ${laufzeit}</strong> (ab ${start.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})} Uhr)<br>
                👥 Zuschauer: <strong>${viewers}</strong> &nbsp;|&nbsp;
                💬 Aktive Chatter: <strong>${chatters}</strong> &nbsp;|&nbsp;
                ⭐ Neue Subs: <strong>${newSubs}</strong> &nbsp;|&nbsp;
                🔄 Resubs: <strong>${resubs}</strong><br>
                🎁 Gift-Subs: <strong>${gifts}</strong> &nbsp;|&nbsp;
                🎯 Bits heute: <strong>${bits}</strong>
            `;
        } catch {
            sessionInfo.innerHTML = '<span style="color:#888;">Session-Info nicht verfügbar.</span>';
        }
    }

    // ── Session Reset ──
    document.getElementById("resetSessionBtn").addEventListener("click", async () => {
        if (!confirm('Session wirklich zurücksetzen? Alle heutigen Stream-Daten werden gelöscht!')) return;
        try {
            const res    = await fetch('/eventsub/session/reset', { method: 'POST' });
            const result = await res.json();
            if (result.ok) {
                sessionStatus.textContent = '✅ Session zurückgesetzt!';
                sessionStatus.style.color = '#9f9';
                loadSessionInfo();
                setTimeout(() => { sessionStatus.textContent = ''; }, 4000);
            } else {
                sessionStatus.textContent = '❌ Fehler beim Zurücksetzen!';
                sessionStatus.style.color = '#f66';
            }
        } catch {
            sessionStatus.textContent = '❌ Verbindungsfehler!';
            sessionStatus.style.color = '#f66';
        }
    });

    // ── Speichern ──
    document.getElementById("saveEconomyBtn").addEventListener("click", async () => {
        const payload = {
            basePerMessage:    Number(fields.basePerMessage.value),
            cooldownSeconds:   Number(fields.cooldownSeconds.value),
            spamCheckMessages: Number(fields.spamCheckMessages.value),
            factorMod:         Number(fields.factorMod.value),
            factorVip:         Number(fields.factorVip.value),
            factorSub:         Number(fields.factorSub.value),
            bitFactor1:        Number(fields.bitFactor1.value),
            bitFactor2:        Number(fields.bitFactor2.value),
            bitFactor3:        Number(fields.bitFactor3.value),
            bitFactor4:        Number(fields.bitFactor4.value),
            bitFactor5:        Number(fields.bitFactor5.value)
        };

        try {
            const res    = await fetch(apiUrl, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.ok) {
                renderStats(payload);
            } else {
                console.error("Speichern fehlgeschlagen:", result);
            }
        } catch (err) {
            console.error("Fehler beim Speichern:", err);
        }
    });

    loadEconomy();
    loadSessionInfo();
    setInterval(loadSessionInfo, 30000);
}
