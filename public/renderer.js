// /home/fynn/TwitchOBSAdmin/public/renderer.js

var scrollY     = 0;
var scrollSpeed = 0.8;
var isRunning   = false;

async function loadAll() {
    try {
        var cfgRes  = await fetch('/credits_api/config?t=' + Date.now());
        var dataRes = await fetch('/credits_api/data?t='   + Date.now());
        var cfg     = await cfgRes.json();
        var data    = await dataRes.json();

        var wasRunning = isRunning;
        isRunning      = cfg.running || false;

        var viewport = document.getElementById('viewport');
        if (isRunning) {
            viewport.classList.add('active');
            if (!wasRunning) scrollY = window.innerHeight + 100;
        } else {
            viewport.classList.remove('active');
        }

        applyConfig(cfg, data);
    } catch (e) { console.error('Fehler:', e); }
}

function applyConfig(cfg, data) {
    var logo1H = cfg.logo1Height || 120;
    var logo2H = cfg.logo2Height || 120;

    document.body.style.color = cfg.textColor || '#ffffff';
    scrollSpeed = cfg.scrollSpeed || 0.8;

    var off = cfg.shadowOffset || 2;
	var sc  = cfg.shadowColor  || '#000000';
	var bl  = cfg.shadowBlur   || 6;
	var shadow = 
    '-' + off + 'px -' + off + 'px 0 ' + sc + ',' +
    off + 'px -' + off + 'px 0 ' + sc + ',' +
    '-' + off + 'px ' + off + 'px 0 ' + sc + ',' +
    off + 'px ' + off + 'px 0 ' + sc + ',' +
    '0px 4px ' + bl + 'px rgba(0,0,0,0.8)';

    var scroller = document.getElementById('scroll-content');
    if (!scroller) return;
    scroller.style.textShadow = shadow;
    scroller.innerHTML = '';

    // 1. Logo oben
    if (cfg.logo1) {
        var img1 = document.createElement('img');
        img1.src = cfg.logo1;
        img1.style.cssText = 'max-height:' + logo1H + 'px;width:auto;object-fit:contain;margin:0 auto 20px;display:block;';
        scroller.appendChild(img1);
        addSpacer(scroller, 10);
    }

    // 2. Headline
    if (cfg.headline) {
        var hl = document.createElement('div');
        hl.style.cssText = 'font-family:MAGNETOB,"Segoe UI",sans-serif;font-weight:normal;letter-spacing:2px;margin-bottom:10px;';
        hl.textContent = cfg.headline;
        hl.style.fontSize = (cfg.fontSizeHeadline || 64) + 'px';
        scroller.appendChild(hl);
    }

    // 3. Untertitel
    if (cfg.subtitle) {
        var sub = document.createElement('div');
        sub.style.cssText = 'font-family:MAGNETOB,"Segoe UI",sans-serif;font-weight:normal;opacity:0.85;white-space:pre-line;margin-bottom:40px;';
        sub.textContent = cfg.subtitle;
        sub.style.fontSize = (cfg.fontSizeSubtitle || 32) + 'px';
        scroller.appendChild(sub);
    }

    addSpacer(scroller, 30);

    // 4. Sektionen
    var sections = cfg.sections || [];
    sections.filter(function(s) { return s.enabled; }).forEach(function(section) {
        var names = data[section.id] || [];
        if (names.length === 0) return;

        addSpacer(scroller, 20);
        var block = document.createElement('div');
        block.style.cssText = 'margin:0 auto 20px;max-width:800px;text-align:center;';

        var title = document.createElement('div');
        title.style.cssText = 'font-family:MAGNETOB,"Segoe UI",sans-serif;font-weight:normal;color:#9b7fd4;letter-spacing:1px;margin-bottom:6px;';
        title.textContent = section.title;
        title.style.fontSize = (cfg.fontSizeCategory || 28) + 'px';
        block.appendChild(title);

        var hr = document.createElement('hr');
        hr.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.2);margin:6px auto;width:60%;';
        block.appendChild(hr);

        var nameList = document.createElement('div');
        nameList.style.cssText = 'font-family:"Segoe UI",sans-serif;line-height:2;opacity:0.9;';
        nameList.style.fontSize = (cfg.fontSizeNames || 22) + 'px';
        names.forEach(function(name) {
            var line = document.createElement('div');
            line.textContent = name;
            nameList.appendChild(line);
        });
        block.appendChild(nameList);
        scroller.appendChild(block);
    });

    // 5. Abschlusstext
    addSpacer(scroller, 40);
    if (cfg.farewell) {
        var far = document.createElement('div');
        far.style.cssText = 'font-family:MAGNETOB,"Segoe UI",sans-serif;font-weight:normal;opacity:0.9;white-space:pre-line;';
        far.textContent = cfg.farewell;
        far.style.fontSize = (cfg.fontSizeSubtitle || 32) + 'px';
        scroller.appendChild(far);
        addSpacer(scroller, 20);
    }

    // 6. Raid-Text
    if (cfg.raidTarget && cfg.raidText) {
        var raid = document.createElement('div');
        raid.style.cssText = 'font-family:MAGNETOB,"Segoe UI",sans-serif;font-weight:normal;opacity:0.9;white-space:pre-line;';
        raid.textContent = cfg.raidText.replace('[Twitchname]', cfg.raidTarget);
        raid.style.fontSize = (cfg.fontSizeSubtitle || 32) + 'px';
        scroller.appendChild(raid);
        addSpacer(scroller, 40);
    }

    // 7. Logo unten
    if (cfg.logo2) {
        var img2 = document.createElement('img');
        img2.src = cfg.logo2;
        img2.style.cssText = 'max-height:' + logo2H + 'px;width:auto;object-fit:contain;margin:0 auto 20px;display:block;';
        scroller.appendChild(img2);
        addSpacer(scroller, 60);
    }
}

function addSpacer(parent, h) {
    var s = document.createElement('div');
    s.style.height = h + 'px';
    parent.appendChild(s);
}

function tick() {
    if (isRunning) {
        var scroller = document.getElementById('scroll-content');
        var vh       = window.innerHeight;
        var contentH = scroller ? scroller.offsetHeight : 0;
        scrollY -= scrollSpeed;
        if (scrollY < -(contentH + 200)) scrollY = vh + 200;
        if (scroller) scroller.style.transform = 'translateY(' + scrollY + 'px)';
    }
    requestAnimationFrame(tick);
}

loadAll();
setInterval(loadAll, 5000);
requestAnimationFrame(tick);
