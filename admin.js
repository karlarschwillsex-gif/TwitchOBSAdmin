// /home/fynn/TwitchOBSAdmin/public/admin.js

// ---------------------------------------------------------
//  API WRAPPER
// ---------------------------------------------------------
async function api(url, method = "GET", data = null) {
  const headers = {};
  const opt = { method, headers };

  if (data) {
    headers["Content-Type"] = "application/json";
    opt.body = JSON.stringify(data);
  }

  const res = await fetch(url, opt);
  if (!res.ok) {
    const text = await res.text().catch(() => null);
    const err = new Error("API Fehler");
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json();
}

// ---------------------------------------------------------
//  INIT
// ---------------------------------------------------------
window.onload = () => {
  setupTabs();
};

// ---------------------------------------------------------
//  TAB SYSTEM
// ---------------------------------------------------------
async function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const tabs    = document.querySelectorAll(".tab");

  buttons.forEach(btn => {
    btn.onclick = async () => {
      const tabId = btn.dataset.tab;

      buttons.forEach(b => b.classList.remove("active"));
      tabs.forEach(t => t.style.display = "none");
      btn.classList.add("active");

      const target = document.getElementById(tabId);
      if (target) {
        target.style.display = "block";


        if (target.innerHTML.trim() === "") {
          try {
            const htmlFile = tabId === 'credits-editor' ? 'credits-admin.html' : `${tabId}.html`;
            const res = await fetch(htmlFile);
            if (res.ok) {
              target.innerHTML = await res.text();

              if (tabId === 'economy'       && typeof initEconomy     === 'function') initEconomy();
              if (tabId === 'sound'         && typeof loadSounds       === 'function') loadSounds();
              if (tabId === 'duel'          && typeof loadDuels        === 'function') loadDuels();
              if (tabId === 'befehle'       && typeof initCmdAdmin     === 'function') initCmdAdmin();
              if (tabId === 'credits-editor' && typeof initCreditsAdmin === 'function') initCreditsAdmin();
        if (tabId === 'overlay-admin' && typeof initOverlayAdmin === 'function') initOverlayAdmin();
              if (tabId === 'security'      && typeof initSecurity     === 'function') initSecurity();
            }
          } catch (e) {
            console.error("Fehler beim Laden von " + tabId, e);
          }
        }
      }
    };
  });
}

// ---------------------------------------------------------
//  LOAD ALL DATA
// ---------------------------------------------------------
function loadAllTabs() {
  loadSoundAlias().catch(() => {});
  loadCamFilters().catch(() => {});
}

// ---------------------------------------------------------
//  SOUND ALIAS
// ---------------------------------------------------------
async function loadSoundAlias() {
  let alias = [];
  try { alias = await api("/api/admin/sound-alias"); }
  catch (e) { alias = []; }

  const body = document.getElementById("aliasBody");
  if (!body) return;
  body.innerHTML = "";

  alias.forEach((f, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input value="${f.alias || ''}" data-i="${i}" data-k="alias"></td>
      <td><input value="${f.file || ''}" data-i="${i}" data-k="file"></td>
      <td><input type="number" value="${f.volume ?? 1}" data-i="${i}" data-k="volume"></td>
      <td><input type="number" value="${f.cost ?? 0}" data-i="${i}" data-k="cost"></td>
      <td><button data-del="${i}" style="background: var(--danger);">Löschen</button></td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = async () => {
      const index = Number(btn.dataset.del);
      alias.splice(index, 1);
      await api("/api/admin/sound-alias", "POST", alias);
      loadSoundAlias();
      const msg = document.getElementById("aliasMsg");
      if (msg) msg.textContent = "Alias gelöscht!";
    };
  });

  body.querySelectorAll("input").forEach(inp => {
    inp.onchange = () => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      alias[i][k] = (k === "volume" || k === "cost") ? Number(inp.value) : inp.value;
    };
  });

  const addBtn = document.getElementById("addAliasBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      alias.push({ alias: "neu", file: "sound.mp3", volume: 1, cost: 0 });
      await api("/api/admin/sound-alias", "POST", alias);
      loadSoundAlias();
      const msg = document.getElementById("aliasMsg");
      if (msg) msg.textContent = "Alias hinzugefügt!";
    };
  }
}

// ---------------------------------------------------------
//  CAM FILTER
// ---------------------------------------------------------
async function loadCamFilters() {
  let filters = [];
  try { filters = await api("/api/admin/camfilter-settings"); }
  catch (e) { filters = []; }

  const body = document.getElementById("camFilterBody");
  if (!body) return;
  body.innerHTML = "";

  filters.forEach((f, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input value="${f.name || ''}" data-i="${i}" data-k="name"></td>
      <td><input value="${f.file || ''}" data-i="${i}" data-k="file"></td>
      <td><input type="number" value="${f.cost ?? 0}" data-i="${i}" data-k="cost"></td>
      <td><button data-del="${i}" style="background: var(--danger);">Löschen</button></td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = async () => {
      const index = Number(btn.dataset.del);
      filters.splice(index, 1);
      await api("/api/admin/camfilter-settings", "POST", filters);
      loadCamFilters();
      const msg = document.getElementById("camFilterMsg");
      if (msg) msg.textContent = "Filter gelöscht!";
    };
  });

  body.querySelectorAll("input").forEach(inp => {
    inp.onchange = () => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      filters[i][k] = (k === "cost") ? Number(inp.value) : inp.value;
    };
  });

  const addBtn = document.getElementById("addCamFilterBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      filters.push({ name: "neu", file: "filter.png", cost: 0 });
      await api("/api/admin/camfilter-settings", "POST", filters);
      loadCamFilters();
      const msg = document.getElementById("camFilterMsg");
      if (msg) msg.textContent = "Filter hinzugefügt!";
    };
  }
}

// ---------------------------------------------------------
//  openTab
// ---------------------------------------------------------
function openTab(tabId) {
  const buttons = document.querySelectorAll(".tab-btn");
  const tabs    = document.querySelectorAll(".tab");

  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  tabs.forEach(tab => {
    tab.style.display = (tab.id === tabId) ? "block" : "none";
  });

  const target = document.getElementById(tabId);
  if (target && target.innerHTML.trim() === "") {
    fetch(`${tabId}.html`)
      .then(res => res.ok ? res.text() : "")
      .then(html => {
        target.innerHTML = html;

        if (tabId === 'economy'       && typeof initEconomy     === 'function') initEconomy();
        if (tabId === 'sound'         && typeof loadSounds       === 'function') loadSounds();
              if (tabId === 'duel'          && typeof loadDuels        === 'function') loadDuels();
        if (tabId === 'befehle'       && typeof initCmdAdmin     === 'function') initCmdAdmin();
        if (tabId === 'credits-editor' && typeof initCreditsAdmin === 'function') initCreditsAdmin();
        if (tabId === 'overlay-admin' && typeof initOverlayAdmin === 'function') initOverlayAdmin();
        if (tabId === 'security'      && typeof initSecurity     === 'function') initSecurity();
      });
  }
}
