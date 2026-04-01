function initEconomy() {
    const apiUrl = "/api/admin/economy";

    const fields = {
        startCapital:             document.getElementById("startCapital"),
        watchMultiplier:          document.getElementById("watchMultiplier"),
        watchActivateAfterMin:    document.getElementById("watchActivateAfterMin"),
        watchDeactivateAfterHours:document.getElementById("watchDeactivateAfterHours"),
        costChatNormal:           document.getElementById("costChatNormal"),
        costChatModVip:           document.getElementById("costChatModVip"),
        vipMultiplier:            document.getElementById("vipMultiplier")
    };

    const statsBox = document.getElementById("economyStats");

    async function loadEconomy() {
        try {
            const res  = await fetch(apiUrl);
            const data = await res.json();

            fields.startCapital.value              = data.startCapital              ?? 0;
            fields.watchMultiplier.value           = data.watchMultiplier           ?? 1;
            fields.watchActivateAfterMin.value     = data.watchActivateAfterMin     ?? 0;
            fields.watchDeactivateAfterHours.value = data.watchDeactivateAfterHours ?? 0;
            fields.costChatNormal.value            = data.costChatNormal            ?? 1;
            fields.costChatModVip.value            = data.costChatModVip            ?? 0;
            fields.vipMultiplier.value             = data.vipMultiplier             ?? 1;

            renderStats(data);
        } catch (err) {
            console.error("Fehler beim Laden der Economy:", err);
        }
    }

    function renderStats(data) {
        statsBox.innerHTML = `
            <h3>Aktuell gespeicherte Economy-Daten</h3>
            <ul>
                <li><strong>Startkapital:</strong> ${data.startCapital}</li>
                <li><strong>Watchtime-Multiplikator:</strong> ${data.watchMultiplier}</li>
                <li><strong>Aktivierung nach Minuten:</strong> ${data.watchActivateAfterMin}</li>
                <li><strong>Deaktivierung nach Stunden:</strong> ${data.watchDeactivateAfterHours}</li>
                <li><strong>Kosten Normaluser:</strong> ${data.costChatNormal}</li>
                <li><strong>Kosten Mod/VIP:</strong> ${data.costChatModVip}</li>
                <li><strong>VIP-Multiplikator:</strong> ${data.vipMultiplier}</li>
            </ul>
        `;
    }

    document.getElementById("saveEconomyBtn").addEventListener("click", async () => {
        const payload = {
            startCapital:              Number(fields.startCapital.value),
            watchMultiplier:           Number(fields.watchMultiplier.value),
            watchActivateAfterMin:     Number(fields.watchActivateAfterMin.value),
            watchDeactivateAfterHours: Number(fields.watchDeactivateAfterHours.value),
            costChatNormal:            Number(fields.costChatNormal.value),
            costChatModVip:            Number(fields.costChatModVip.value),
            vipMultiplier:             Number(fields.vipMultiplier.value)
        };

        try {
            const res    = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
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
