async function initSecurity() {
  const changeBtn = document.getElementById("changePinBtn");
  const msgEl = document.getElementById("changePinMsg");

  if (!changeBtn) return;

  changeBtn.onclick = async () => {
    msgEl.textContent = "";

    const oldPin = document.getElementById("oldPin")?.value?.trim();
    const newPin = document.getElementById("newPin")?.value?.trim();
    const repeat = document.getElementById("newPinRepeat")?.value?.trim();

    // Validierung
    if (!oldPin || !newPin || !repeat) {
      msgEl.textContent = "Bitte alle Felder ausfüllen.";
      return;
    }

    if (newPin !== repeat) {
      msgEl.textContent = "Neue PINs stimmen nicht überein.";
      return;
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      msgEl.textContent = "Neue PIN muss 4 Ziffern haben.";
      return;
    }

    try {
      const res = await fetch("/api/admin/change-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": localStorage.getItem("adminPin") || ""
        },
        body: JSON.stringify({ oldPin, newPin })
      });

      if (res.ok) {
        msgEl.textContent = "PIN erfolgreich geändert!";
        localStorage.setItem("adminPin", newPin);
      } else {
        msgEl.textContent = "Fehler: Alte PIN falsch.";
      }
    } catch (e) {
      msgEl.textContent = "Server-Fehler!";
    }
  };
}

