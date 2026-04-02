// /home/fynn/TwitchOBSAdmin/public/renderer.js

let scrollY     = 0;
let scrollSpeed = 0.8;
let isRunning   = false;
let creditsData = {};

// ── Config + Daten laden ──
async function loadAll() {
    try {
        const [cfgRes, dataRes] = await Promise.all([
            fetch('/credits_api/config'),
            fetch('/credits_api/data')
        ]);
        const cfg  = await cfgRes.json();
        const data = await dataRes.json();

        creditsData = data;

        const wasRunning = isRunning;
        isRunning        = cfg.running || false;

        const viewport = document.getElementById('viewport');
        if (isRunning) {
            viewport.classList.add('active');
            if (!wasRunning) scrollY = window.innerHeight + 100;
        } else {
            viewport.classList.remove('active');
        }

        applyConfig(cfg, data);
    } catch (e) { console.error('Fehler:', e); }
}

// ── Config anwenden ──
function applyConfig(cfg, data) {
    // Hintergrund
    const body = document.body;
    if (cfg.background && cfg.background.trim()) {
        body.style.background = `url('${cfg.background}') center center / cover no-repeat`;
    } else {
        body.style.background = 'transparent';
    }

    // Schrift
    body.style.color      = cfg.textColor  || '#ffffff';
    body.style.fontFamily = cfg.fontFamily || 'Segoe UI';

    scrollSpeed = cfg.scrollSpeed || 0.8;

    const shadow = `${cfg.shadowOffset||2}px ${cfg.shadowOffset||2}px ${cfg.shadowBlur||6}px ${cfg.shadowColor||'#000'}`;

    const scroller = document.getElementById('scroll-content');
    if (!scroller) return;
    scroller.style.textShadow = shadow;

    // Inhalt aufbauen
    scroller.innerHTML = '';

    // 1. Logo oben
    if (cfg.logo1) {
        const img = document.createElement('img');
        img.src             = cfg.logo1;
        img.className       = 'credits-logo';
        scroller.appendChild(img);
        addSpacer(scroller, 30);
    }

    // 2. Headline
    if (cfg.headline) {
        const el       = document.createElement('div');
        el.className   = 'credits-headline';
        el.textContent = cfg.headline;
        el.style.fontSize = (cfg.fontSizeHeadline || 64) + 'px';
        scroller.appendChild(el);
        addSpacer(scroller, 16);
    }

    // 3. Untertitel
    if (cfg.subtitle) {
        const el       = document.createElement('div');
        el.className   = 'credits-subtitle';
        el.textContent = cfg.subtitle;
        el.style.fontSize = (cfg.fontSizeSubtitle || 32) + 'px';
        scroller.appendChild(el);
        addSpacer(scroller, 50);
    }

    // 4+5. Sektionen (Twitch + F$) in konfigurierter Reihenfolge
    const sections = cfg.sections || [];
    sections.filter(s => s.enabled).forEach(section => {
        const names = data[section.id] || [];
        if (names.length === 0) return;

        addSpacer(scroller, 20);

        const block    = document.createElement('div');
        block.className = 'credits-section';

        const title       = document.createElement('div');
        title.className   = 'credits-section-title';
        title.textContent = section.title;
        title.style.fontSize = (cfg.fontSizeCategory || 28) + 'px';
        block.appendChild(title);

        addLine(block);

        const nameList       = document.createElement('div');
        nameList.className   = 'credits-names';
        nameList.style.fontSize = (cfg.fontSizeNames || 22) + 'px';
        names.forEach(name => {
            const line       = document.createElement('div');
            line.textContent = name;
            nameList.appendChild(line);
        });
        block.appendChild(nameList);
        scroller.appendChild(block);
        addSpacer(scroller, 30);
    });

    // 6. Abschlusstext
    addSpacer(scroller, 40);
    if (cfg.farewell) {
        const el       = document.createElement('div');
        el.className   = 'credits-farewell';
        el.textContent = cfg.farewell;
        el.style.fontSize = (cfg.fontSizeSubtitle || 32) + 'px';
        scroller.appendChild(el);
        addSpacer(scroller, 20);
    }

    // 7. Raid-Text
    if (cfg.raidTarget && cfg.raidText) {
        const el       = document.createElement('div');
        el.className   = 'credits-raid';
        el.textContent = cfg.raidText.replace('[Twitchname]', cfg.raidTarget);
        el.style.fontSize = (cfg.fontSizeSubtitle || 32) + 'px';
        scroller.appendChild(el);
        addSpacer(scroller, 40);
    }

    // 8. Logo unten
    if (cfg.logo2) {
        const img = document.createElement('img');
        img.src       = cfg.logo2;
        img.className = 'credits-logo';
        scroller.appendChild(img);
        addSpacer(scroller, 60);
    }
}

function addSpacer(parent, height) {
    const s        = document.createElement('div');
    s.style.height = height + 'px';
    parent.appendChild(s);
}

function addLine(parent) {
    const hr        = document.createElement('hr');
    hr.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.2);margin:8px auto;width:60%;';
    parent.appendChild(hr);
}

// ── Scroll ──
function tick() {
    if (isRunning) {
        const scroller       = document.getElementById('scroll-content');
        const viewportHeight = window.innerHeight;
        const contentHeight  = scroller ? scroller.offsetHeight : 0;

        scrollY -= scrollSpeed;
        if (scrollY < -(contentHeight + 200)) scrollY = viewportHeight + 200;
        if (scroller) scroller.style.transform = `translateY(${scrollY}px)`;
    }
    requestAnimationFrame(tick);
}

// ── Start ──
loadAll();
setInterval(loadAll, 5000);
requestAnimationFrame(tick);
