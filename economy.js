const els = {
  status: document.getElementById("status"),

  costChatNormal: document.getElementById("costChatNormal"),
  costChatModVip: document.getElementById("costChatModVip"),

  vipMultiplier: document.getElementById("vipMultiplier"),

  watchMultiplier: document.getElementById("watchMultiplier"),
  watchActivateAfterMin: document.getElementById("watchActivateAfterMin"),
  watchDeactivateAfterHours: document.getElementById("watchDeactivateAfterHours"),

  startCapital: document.getElementById("startCapital"),

  saveBtn: document.getElementById("saveEconomyBtn"),
};

function setStatus(msg, isError = false) {
  // Kleiner Check, falls das Element im HTML fehlt
  if (!els.status) {
    console.log("Status-Update:", msg);
    return;
  }
  els.status.textContent = msg || "";
  els.status.classList.toggle("error", !!isError);
}

/* -----------------------------------------
   ECONOMY LADEN
------------------------------------------*/

async function loadEconomy() {
  setStatus("Lade Economy-Einstellungen…");

  try {
    const res = await fetch("/api/admin/economy");

    if (!res.ok) {
      setStatus("Fehler beim Laden: " + res.statusText, true);
      return;
    }

    const cfg = await res.json();

    // Felder setzen (mit Fallback auf Standardwerte)
    els.costChatNormal.value = cfg.costChatNormal ?? 0;
    els.costChatModVip.value = cfg.costChatModVip ?? 0;

    els.vipMultiplier.value = cfg.vipMultiplier ?? 1;

    els.watchMultiplier.value = cfg.watchMultiplier ?? 1;
    els.watchActivateAfterMin.value = cfg.watchActivateAfterMin ?? 0;
    els.watchDeactivateAfterHours.value = cfg.watchDeactivateAfterHours ?? 0;

    els.startCapital.value = cfg.startCapital ?? 0;

    setStatus("Economy-Einstellungen geladen.");
  } catch (err) {
    console.error(err);
    setStatus("Economy-Einstellungen konnten nicht geladen werden.", true);
  }
}

/* -----------------------------------------
   ECONOMY SPEICHERN
------------------------------------------*/

async function saveEconomy(event) {
  // WICHTIG: Stoppt das Neuladen der Seite!
  if (event) event.preventDefault();

  const payload = {
    costChatNormal: Number(els.costChatNormal.value || 0),
    costChatModVip: Number(els.costChatModVip.value || 0),

    vipMultiplier: Number(els.vipMultiplier.value || 1),

    watchMultiplier: Number(els.watchMultiplier.value || 1),
    watchActivateAfterMin: Number(els.watchActivateAfterMin.value || 0),
    watchDeactivateAfterHours: Number(els.watchDeactivateAfterHours.value || 0),

    startCapital: Number(els.startCapital.value || 0),
  };

  // Validierung
  if (payload.costChatNormal < 0 || payload.costChatModVip < 0) {
    return setStatus("Chat-Kosten dürfen nicht negativ sein.", true);
  }
  if (payload.vipMultiplier < 0) {
    return setStatus("VIP-Multiplikator darf nicht negativ sein.", true);
  }
  if (payload.watchMultiplier < 0) {
    return setStatus("Watchtime-Multiplikator darf nicht negativ sein.", true);
  }
  if (payload.startCapital < 0) {
    return setStatus("Startkapital darf nicht negativ sein.", true);
  }

  setStatus("Speichere Economy-Einstellungen…");

  try {
    const res = await fetch("/api/admin/economy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      setStatus("Fehler beim Speichern: " + res.statusText, true);
      return;
    }

    const json = await res.json();

    // Hier prüfen wir die Antwort vom Server
    if (json.ok === true) {
      setStatus("Economy-Einstellungen gespeichert.");
    } else {
      setStatus("Fehler beim Speichern in die Datei.", true);
    }
  } catch (err) {
    console.error("Save-Error:", err);
    setStatus("Fehler beim Speichern der Economy-Einstellungen.", true);
  }
}

/* -----------------------------------------
   INIT
------------------------------------------*/

function initEconomy() {
  if (els.saveBtn) {
    els.saveBtn.addEventListener("click", saveEconomy);
    console.log("Economy-Script: Save-Button bereit.");
  } else {
    console.error("Economy-Script: Save-Button nicht gefunden!");
  }
  loadEconomy();
}

// Starten, sobald das DOM bereit ist
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEconomy);
} else {
  initEconomy();
}
