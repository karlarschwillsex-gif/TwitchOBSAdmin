const els = {
  status:      document.getElementById("status"),
  aliasInput:  document.getElementById("aliasInput"),
  soundFile:   document.getElementById("soundFile"),
  costInput:   document.getElementById("costInput"),
  volumeInput: document.getElementById("volumeInput"),
  addSoundBtn: document.getElementById("addSoundBtn"),
  soundTable:  document.getElementById("soundTable"),
};

function setStatus(msg, isError = false) {
  els.status.textContent = msg || "";
  els.status.classList.toggle("error", !!isError);
}

function getPinHeader() {
  return { "x-admin-pin": localStorage.getItem("adminPin") || "" };
}

/* -----------------------------------------
   SOUNDS LADEN & ANZEIGEN
------------------------------------------*/

async function loadSounds() {
  setStatus("Lade Sounds…");
  try {
    const res = await fetch("/api/admin/sounds", {
      headers: {
        ...getPinHeader()
      }
    });
    if (!res.ok) {
      setStatus("Fehler beim Laden der Sounds: " + res.statusText, true);
      return;
    }

    const data = await res.json();
    const sounds = Array.isArray(data.sounds) ? data.sounds : [];

    renderSoundTable(sounds);
    setStatus("Sounds geladen.");
  } catch (err) {
    console.error(err);
    setStatus("Sounds konnten nicht geladen werden.", true);
  }
}

function renderSoundTable(sounds) {
  els.soundTable.innerHTML = "";

  if (sounds.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Keine Sounds vorhanden.";
    td.style.color = "#888";
    tr.appendChild(td);
    els.soundTable.appendChild(tr);
    return;
  }

  sounds.forEach(sound => {
    const tr = document.createElement("tr");

    const tdAlias = document.createElement("td");
    tdAlias.textContent = sound.alias || "";
    tr.appendChild(tdAlias);

    const tdCost = document.createElement("td");
    tdCost.textContent = sound.cost != null ? sound.cost : "";
    tr.appendChild(tdCost);

    const tdVolume = document.createElement("td");
    tdVolume.textContent = sound.volume != null ? sound.volume + "%" : "";
    tr.appendChild(tdVolume);

    const tdFile = document.createElement("td");
    tdFile.textContent = sound.file || "";
    tr.appendChild(tdFile);

    const tdActions = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Löschen";
    delBtn.className = "btn-danger";
    delBtn.addEventListener("click", () => deleteSound(sound.alias));
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    els.soundTable.appendChild(tr);
  });
}

/* -----------------------------------------
   NEUEN SOUND HINZUFÜGEN
------------------------------------------*/

async function addSound() {
  const alias  = (els.aliasInput.value || "").trim();
  const file   = els.soundFile.files[0];
  const cost   = Number(els.costInput.value || 0);
  const volume = Number(els.volumeInput.value || 100);

  if (!alias) {
    setStatus("Bitte einen Alias angeben.", true);
    return;
  }
  if (!file) {
    setStatus("Bitte eine Sound-Datei auswählen.", true);
    return;
  }
  if (cost < 0) {
    setStatus("Kosten dürfen nicht negativ sein.", true);
    return;
  }
  if (volume < 0 || volume > 200) {
    setStatus("Lautstärke muss zwischen 0 und 200 liegen.", true);
    return;
  }

  const formData = new FormData();
  formData.append("alias", alias);
  formData.append("cost", String(cost));
  formData.append("volume", String(volume));
  formData.append("sound", file);

  setStatus("Füge Sound hinzu…");
  try {
    const res = await fetch("/api/admin/sounds", {
      method: "POST",
      headers: {
        ...getPinHeader()
      },
      body: formData
    });
    if (!res.ok) {
      setStatus("Fehler beim Hinzufügen des Sounds: " + res.statusText, true);
      return;
    }
    const json = await res.json();
    if (json.ok) {
      setStatus("Sound hinzugefügt.");
      els.aliasInput.value  = "";
      els.soundFile.value   = "";
      els.costInput.value   = "10";
      els.volumeInput.value = "100";
      await loadSounds();
    } else {
      setStatus(json.error || "Sound konnte nicht hinzugefügt werden.", true);
    }
  } catch (err) {
    console.error(err);
    setStatus("Fehler beim Hinzufügen des Sounds.", true);
  }
}

/* -----------------------------------------
   SOUND LÖSCHEN
------------------------------------------*/

async function deleteSound(alias) {
  if (!alias) return;
  if (!confirm(`Sound "${alias}" wirklich löschen?`)) return;

  setStatus("Lösche Sound…");
  try {
    const res = await fetch("/api/admin/sounds", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...getPinHeader()
      },
      body: JSON.stringify({ alias })
    });
    if (!res.ok) {
      setStatus("Fehler beim Löschen des Sounds: " + res.statusText, true);
      return;
    }
    const json = await res.json();
    if (json.ok) {
      setStatus("Sound gelöscht.");
      await loadSounds();
    } else {
      setStatus(json.error || "Sound konnte nicht gelöscht werden.", true);
    }
  } catch (err) {
    console.error(err);
    setStatus("Fehler beim Löschen des Sounds.", true);
  }
}

/* -----------------------------------------
   INIT
------------------------------------------*/

function initSoundAdmin() {
  els.addSoundBtn.addEventListener("click", addSound);
  loadSounds();
}

document.addEventListener("DOMContentLoaded", initSoundAdmin);

