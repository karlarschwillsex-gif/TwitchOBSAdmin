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

    const statsBox = document.getElementById("economyStats");

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
            fields.bitFactor1.value        = data.bitFactor1        ?? 1;
            fields.bitFactor2.value        = data.bitFactor2        ?? 2;
            fields.bitFactor3.value        = data.bitFactor3        ?? 3;
            fields.bitFactor4.value        = data.bitFactor4        ?? 4;
            fields.bitFactor5.value        = data.bitFactor5        ?? 5;

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
                    ab 10 ×${data.bitFactor1 ?? 1} /
                    ab 100 ×${data.bitFactor2 ?? 2} /
                    ab 1.000 ×${data.bitFactor3 ?? 3} /
                    ab 10.000 ×${data.bitFactor4 ?? 4} /
                    ab 100.000 ×${data.bitFactor5 ?? 5}
                </li>
                <li><strong>Admin:</strong> ∞ F$ 🦊</li>
            </ul>
        `;
    }

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
}
