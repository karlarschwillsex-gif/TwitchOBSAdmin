// /home/fynn/TwitchOBSAdmin/public/credits-admin.js

function initCreditsAdmin() {
    var cfg       = null;
    var savedVals = {};
    var statusEl  = document.getElementById('creditsStatus');

    function setStatus(msg, isError) {
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#f66' : '#9f9';
        if (msg) setTimeout(function() { statusEl.textContent = ''; }, 5000);
    }

    var TRACKED = [
        'headline','subtitle','farewell','raidText',
        'fontFamily','textColor','shadowColor',
        'fontSizeHeadline','fontSizeSubtitle','fontSizeCategory','fontSizeNames',
        'shadowBlur','shadowOffset','scrollSpeed','logo1Height','logo2Height','logo1','logo2'
    ];

    function setHaken(id, ok) {
        var el = document.getElementById('hk_' + id);
        if (el) el.textContent = ok ? '✅' : '';
    }

    function getVal(id) {
        var el = document.getElementById('cr_' + id);
        if (!el) return '';
        return el.value;
    }

    function checkAllHaken() {
        TRACKED.forEach(function(id) {
            setHaken(id, getVal(id) === String(savedVals[id] !== undefined ? savedVals[id] : ''));
        });
    }

    TRACKED.forEach(function(id) {
        var el = document.getElementById('cr_' + id);
        if (!el) return;
        var ev = (el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(ev, function() {
            setHaken(id, this.value === String(savedVals[id] !== undefined ? savedVals[id] : ''));
        });
    });

    // Color Sync
    document.getElementById('cr_textColorPicker').oninput = function() {
        document.getElementById('cr_textColor').value = this.value;
        setHaken('textColor', this.value === String(savedVals['textColor'] || ''));
    };
    document.getElementById('cr_textColor').oninput = function() {
        try { document.getElementById('cr_textColorPicker').value = this.value; } catch(e) {}
        setHaken('textColor', this.value === String(savedVals['textColor'] || ''));
    };
    document.getElementById('cr_shadowColorPicker').oninput = function() {
        document.getElementById('cr_shadowColor').value = this.value;
        setHaken('shadowColor', this.value === String(savedVals['shadowColor'] || ''));
    };
    document.getElementById('cr_shadowColor').oninput = function() {
        try { document.getElementById('cr_shadowColorPicker').value = this.value; } catch(e) {}
        setHaken('shadowColor', this.value === String(savedVals['shadowColor'] || ''));
    };

    // Logo URL Preview
    function bindLogoUrl(inputId, imgId) {
        document.getElementById(inputId).oninput = function() {
            var img = document.getElementById(imgId);
            if (this.value) { img.src = this.value; img.style.display = 'block'; }
            else img.style.display = 'none';
        };
    }
    bindLogoUrl('cr_logo1', 'cr_logo1Preview');
    bindLogoUrl('cr_logo2', 'cr_logo2Preview');

    // Logo File Upload
    function bindLogoFile(fileId, urlId, imgId) {
        document.getElementById(fileId).onchange = function() {
            var file = this.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById(urlId).value = e.target.result;
                var img = document.getElementById(imgId);
                img.src = e.target.result;
                img.style.display = 'block';
                var fieldId = urlId.replace('cr_', '');
                setHaken(fieldId, false);
            };
            reader.readAsDataURL(file);
        };
    }
    bindLogoFile('cr_logo1File', 'cr_logo1', 'cr_logo1Preview');
    bindLogoFile('cr_logo2File', 'cr_logo2', 'cr_logo2Preview');

    // Lokale Fonts nachladen
    function loadExtraFonts(currentFont) {
        fetch('/credits_api/fonts').then(function(r) { return r.json(); }).then(function(data) {
            var sel     = document.getElementById('cr_fontFamily');
            var myGroup = sel.querySelector('optgroup');
            (data.localFonts || []).filter(function(f) {
                return f.name.toUpperCase() !== 'MAGNETOB';
            }).forEach(function(f) {
                var s = document.createElement('style');
                s.textContent = "@font-face{font-family:'" + f.name + "';src:url('/fonts/" + f.file + "') format('truetype');}";
                document.head.appendChild(s);
                var o = document.createElement('option');
                o.value = f.name; o.textContent = f.name + ' ✦';
                myGroup.appendChild(o);
            });
            if (currentFont) sel.value = currentFont;
            checkAllHaken();
        }).catch(function() {});
    }

    // Sektionen
    function renderSections(sections) {
        var list = document.getElementById('cr_sectionList');
        list.innerHTML = '';
        sections.forEach(function(sec, idx) {
            var div = document.createElement('div'); div.className = 'section-item';
            var up  = document.createElement('button'); up.className = 'section-move'; up.textContent = '↑'; up.disabled = (idx === 0);
            up.onclick = function() {
                var t = sections[idx-1]; sections[idx-1] = sections[idx]; sections[idx] = t;
                renderSections(sections); if (cfg) cfg.sections = sections;
            };
            var dn = document.createElement('button'); dn.className = 'section-move'; dn.textContent = '↓'; dn.disabled = (idx === sections.length-1);
            dn.onclick = function() {
                var t = sections[idx+1]; sections[idx+1] = sections[idx]; sections[idx] = t;
                renderSections(sections); if (cfg) cfg.sections = sections;
            };
            var cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'section-check'; cb.checked = sec.enabled;
            cb.onchange = function() { sections[idx].enabled = this.checked; if (cfg) cfg.sections = sections; };
            var lbl = document.createElement('span'); lbl.className = 'section-label'; lbl.textContent = sec.title;
            var typ = document.createElement('span'); typ.className = 'section-type'; typ.textContent = sec.type === 'twitch' ? '📺' : '🦊';
            div.appendChild(up); div.appendChild(dn); div.appendChild(cb); div.appendChild(lbl); div.appendChild(typ);
            list.appendChild(div);
        });
    }

    function updateRunStatus(running) {
        var el = document.getElementById('creditsRunStatus');
        if (running) { el.textContent = '🔴 Credits laufen'; el.style.color = '#f99'; }
        else          { el.textContent = '⚫ Gestoppt';       el.style.color = '#888'; }
    }

    // Felder befüllen + savedVals setzen
    function applyConfig(data) {
        var fields = {
            headline:         data.headline         || '',
            subtitle:         data.subtitle         || '',
            farewell:         data.farewell         || '',
            raidText:         data.raidText         || '',
            logo1:            data.logo1            || '',
            logo2:            data.logo2            || '',
            textColor:        data.textColor        || '#ffffff',
            shadowColor:      data.shadowColor      || '#000000',
            fontFamily:       data.fontFamily       || 'MAGNETOB',
            fontSizeHeadline: data.fontSizeHeadline || 64,
            fontSizeSubtitle: data.fontSizeSubtitle || 32,
            fontSizeCategory: data.fontSizeCategory || 28,
            fontSizeNames:    data.fontSizeNames    || 22,
            shadowBlur:       data.shadowBlur       || 6,
            shadowOffset:     data.shadowOffset     || 2,
            scrollSpeed:      data.scrollSpeed      || 0.8,
            logo1Height:      data.logo1Height      || 120,
            logo2Height:      data.logo2Height      || 120
        };

        Object.keys(fields).forEach(function(id) {
            var el = document.getElementById('cr_' + id);
            if (el) el.value = fields[id];
            savedVals[id] = String(fields[id]);
        });

        try { document.getElementById('cr_textColorPicker').value   = data.textColor   || '#ffffff'; } catch(e) {}
        try { document.getElementById('cr_shadowColorPicker').value = data.shadowColor || '#000000'; } catch(e) {}

        if (data.logo1) { var i = document.getElementById('cr_logo1Preview'); i.src = data.logo1; i.style.display = 'block'; }
        if (data.logo2) { var i = document.getElementById('cr_logo2Preview'); i.src = data.logo2; i.style.display = 'block'; }

        var sel = document.getElementById('cr_recentRaids');
        sel.innerHTML = '<option value="">Letzte ▼</option>';
        (data.recentRaidTargets || []).forEach(function(name) {
            var o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o);
        });

        renderSections(data.sections || []);
        updateRunStatus(data.running || false);
        checkAllHaken();
    }

    // Config laden
    function loadConfig() {
        setStatus('Lade…');
        fetch('/credits_api/config').then(function(r) { return r.json(); }).then(function(data) {
            cfg = data;
            applyConfig(data);
            loadExtraFonts(data.fontFamily || 'MAGNETOB');
            setStatus('Geladen ✅');
        }).catch(function(e) { setStatus('Fehler: ' + e.message, true); });
    }

    // Speichern
    document.getElementById('cr_saveBtn').onclick = function() {
        if (!cfg) cfg = {};
        cfg.headline         = document.getElementById('cr_headline').value;
        cfg.subtitle         = document.getElementById('cr_subtitle').value;
        cfg.farewell         = document.getElementById('cr_farewell').value;
        cfg.raidText         = document.getElementById('cr_raidText').value;
        cfg.raidTarget       = document.getElementById('cr_raidTarget').value.trim();
        cfg.logo1            = document.getElementById('cr_logo1').value.trim();
        cfg.logo2            = document.getElementById('cr_logo2').value.trim();
        cfg.fontFamily       = document.getElementById('cr_fontFamily').value;
        cfg.textColor        = document.getElementById('cr_textColor').value;
        cfg.shadowColor      = document.getElementById('cr_shadowColor').value;
        cfg.fontSizeHeadline = Number(document.getElementById('cr_fontSizeHeadline').value);
        cfg.fontSizeSubtitle = Number(document.getElementById('cr_fontSizeSubtitle').value);
        cfg.fontSizeCategory = Number(document.getElementById('cr_fontSizeCategory').value);
        cfg.fontSizeNames    = Number(document.getElementById('cr_fontSizeNames').value);
        cfg.shadowBlur       = Number(document.getElementById('cr_shadowBlur').value);
        cfg.shadowOffset     = Number(document.getElementById('cr_shadowOffset').value);
        cfg.scrollSpeed      = Number(document.getElementById('cr_scrollSpeed').value);
        cfg.logo1Height      = Number(document.getElementById('cr_logo1Height').value);
        cfg.logo2Height      = Number(document.getElementById('cr_logo2Height').value);

        setStatus('Speichere…');
        fetch('/credits_api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg)
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.ok) {
                TRACKED.forEach(function(id) { savedVals[id] = getVal(id); });
                checkAllHaken();
                setStatus('✅ Gespeichert!');
            } else {
                setStatus('Fehler beim Speichern!', true);
            }
        }).catch(function(e) { setStatus('Fehler: ' + e.message, true); });
    };

    // Raid
    document.getElementById('cr_saveRaidBtn').onclick = function() {
        var target = document.getElementById('cr_raidTarget').value.trim();
        if (!target) { setStatus('Bitte Twitch-Name eingeben!', true); return; }
        fetch('/credits_api/raid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raidTarget: target })
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.ok) { setHaken('raid', true); setStatus('✅ Raid-Ziel gespeichert!'); loadConfig(); }
            else setStatus('Fehler!', true);
        });
    };

    document.getElementById('cr_recentRaids').onchange = function() {
        if (this.value) { document.getElementById('cr_raidTarget').value = this.value; this.value = ''; }
    };

    document.getElementById('creditsStartBtn').onclick = function() {
        fetch('/credits_api/start', { method: 'POST' }).then(function() {
            setStatus('▶ Credits gestartet!'); updateRunStatus(true);
        });
    };
    document.getElementById('creditsStopBtn').onclick = function() {
        fetch('/credits_api/stop', { method: 'POST' }).then(function() {
            setStatus('⏹ Credits gestoppt.'); updateRunStatus(false);
        });
    };
    document.getElementById('cr_reloadBtn').onclick = loadConfig;

    loadConfig();
}
