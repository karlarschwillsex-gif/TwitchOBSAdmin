const els = {
  status: document.getElementById("status"),

  minBet: document.getElementById("minBet"),
  maxBet: document.getElementById("maxBet"),
  cooldown: document.getElementById("cooldown"),
  acceptTimeout: document.getElementById("acceptTimeout"),

  vipWinChance: document.getElementById("vipWinChance"),
  vipLoseBonus: document.getElementById("vipLoseBonus"),

  modWinChance: document.getElementById("modWinChance"),
  modLoseBonus: document.getElementById("modLoseBonus"),

  adminLoseBonus: document.getElementById("adminLoseBonus"),

  subBonus: document.getElementById("subBonus"),

  saveBtn: document.getElementById("saveDuelsBtn"),
  resetStatsBtn: document.getElementById("resetStatsBtn"),
  abortDuelsBtn: document.getElementById("abortDuelsBtn"),
};

function setStatus(msg, isError = false) {
  els.status.textContent = msg || "";
  els.status.classList.toggle("error", !!isError);
}

function getPinHeader() {
  return { "x-admin-pin": localStorage.getItem("adminPin") || "" };
}

/* -----------------------------------------
   DUELL-EINSTELLUNGEN LADEN
------------------------------------------*/

async function loadDuels() {
  setStatus("Lade Duell-Einstellungen…");

  try {
    const res = await fetch("/api/admin/duels", {
      headers: {
        ...getPinHeader()
      }
    });

    if (!res.ok) {
      setStatus("Fehler beim Laden: " + res.statusText, true);
      return;
    }

    const cfg = await res.json();

    // Grundregeln
    els.minBet.value = cfg.minBet ?? 10;
    els.maxBet.value = cfg.maxBet ?? 1000;
    els.cooldown.value = cfg.cooldown ?? 30;
    els.acceptTimeout.value = cfg.acceptTimeout ?? 30;

    // VIP
    els.vipWinChance.value = cfg.vipWinChance ?? 0.25;
    els.vipLoseBonus.value = cfg.vipLoseBonus ?? 2.0;

    // MOD
    els.modWinChance.value = cfg.modWinChance ?? 0.25;
    els.modLoseBonus.value = cfg.modLoseBonus ?? 2.0;

    // Admin
    els.adminLoseBonus.value = cfg.adminLoseBonus ?? 3.0;

    // SUB
    els.subBonus.value = cfg.subBonus ?? 2.0;

    setStatus("Duell-Einstellungen geladen.");
  } catch (err) {
    console.error(err);
    setStatus("Duell-Einstellungen konnten nicht geladen werden.", true);
  }
}

/* -----------------------------------------
   DUELL-EINSTELLUNGEN SPEICHERN
------------------------------------------*/

async function saveDuels() {
  const payload = {
    minBet: Number(els.minBet.value || 0),
    maxBet: Number(els.maxBet.value || 0),
    cooldown: Number(els.cooldown.value || 0),
    acceptTimeout: Number(els.acceptTimeout.value || 0),

    vipWinChance: Number(els.vipWinChance.value || 0),
    vipLoseBonus: Number(els.vipLoseBonus.value || 1),

    modWinChance: Number(els.modWinChance.value || 0),
    modLoseBonus: Number(els.modLoseBonus.value || 1),

    adminLoseBonus: Number(els.adminLoseBonus.value || 1),

    subBonus: Number(els.subBonus.value || 1),
  };

  // Validierung
  if (payload.minBet < 0 || payload.maxBet < 1) {
    return setStatus("Einsatzwerte sind ungültig.", true);
  }

  if (payload.maxBet < payload.minBet) {
    return setStatus("Maximal-Einsatz darf nicht kleiner als Mindest-Einsatz sein.", true);
  }

  if (payload.cooldown < 0 || payload.acceptTimeout < 5) {
    return setStatus("Cooldown oder Timeout ungültig.", true);
  }

  if (payload.vipLoseBonus < 1 || payload.modLoseBonus < 1 || payload.adminLoseBonus < 1) {
    return setStatus("Bonus-Multiplikatoren müssen mindestens 1 sein.", true);
  }

  if (payload.subBonus < 1) {
    return setStatus("SUB-Bonus muss mindestens 1 sein.", true);
  }

  setStatus("Speichere Duell-Einstellungen…");

  try {
    const res = await fetch("/api/admin/duels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getPinHeader()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      setStatus("Fehler beim Speichern: " + res.statusText, true);
      return;
    }

    const json = await res.json();

    if (json.ok) {
      setStatus("Duell-Einstellungen gespeichert.");
    } else {
      setStatus(json.error || "Duell-Einstellungen konnten nicht gespeichert werden.", true);
    }
  } catch (err) {
    console.error(err);
    setStatus("Fehler beim Speichern der Duell-Einstellungen.", true);
  }
}

/* -----------------------------------------
   RESET-FUNKTIONEN
------------------------------------------*/

async function resetStats() {
  if (!confirm("Duell-Statistik wirklich zurücksetzen?")) return;

  try {
    const res = await fetch("/api/admin/duels/reset-stats", {
      method: "POST",
      headers: {
        ...getPinHeader()
      }
    });

    if (!res.ok) {
      setStatus("Fehler beim Zurücksetzen.", true);
      return;
    }

    setStatus("Duell-Statistik zurückgesetzt.");
  } catch (err) {
    console.error(err);
    setStatus("Fehler beim Zurücksetzen.", true);
  }
}

async function abortDuels() {
  if (!confirm("Alle offenen Duelle abbrechen?")) return;

  try {
    const res = await fetch("/api/admin/duels/abort", {
      method: "POST",
      headers: {
        ...getPinHeader()
      }
    });

    if (!res.ok) {
      setStatus("Fehler beim Abbrechen.", true);
      return;
    }

    setStatus("Alle offenen Duelle wurden abgebrochen.");
  } catch (err) {
    console.error(err);
    setStatus("Fehler beim Abbrechen.", true);
  }
}

/* -----------------------------------------
   INIT
------------------------------------------*/

function initDuels() {
  els.saveBtn.addEventListener("click", saveDuels);
  els.resetStatsBtn.addEventListener("click", resetStats);
  els.abortDuelsBtn.addEventListener("click", abortDuels);

  loadDuels();
}

document.addEventListener("DOMContentLoaded", initDuels);

// ---------------------------------------------
// DUELL-SYSTEM UI
// ---------------------------------------------

async function loadDuelStatus() {
    try {
        const res = await fetch('/api/admin/duels', {
            headers: { 'x-admin-pin': localStorage.getItem('adminPin') }
        });
        const json = await res.json();
        document.getElementById('duel-status').textContent =
            JSON.stringify(json, null, 2);
    } catch (err) {
        document.getElementById('duel-status').textContent =
            'Fehler beim Laden der Duell-Daten.';
    }
}

document.getElementById('duel-reset-stats').addEventListener('click', async () => {
    await fetch('/api/admin/duels/reset-stats', {
        method: 'POST',
        headers: { 'x-admin-pin': localStorage.getItem('adminPin') }
    });
    loadDuelStatus();
});

document.getElementById('duel-abort').addEventListener('click', async () => {
    await fetch('/api/admin/duels/abort', {
        method: 'POST',
        headers: { 'x-admin-pin': localStorage.getItem('adminPin') }
    });
    loadDuelStatus();
});

// Beim Laden der Seite direkt Status anzeigen
loadDuelStatus();

