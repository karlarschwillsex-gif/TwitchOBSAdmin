function loadDuels() {
    // Warte bis HTML wirklich im DOM ist
    var check = setInterval(function() {
        if (document.getElementById('duelMinBet')) {
            clearInterval(check);
            initDuelAdmin();
        }
    }, 50);
}

function initDuelAdmin() {

    // ── +/- Buttons ──
    document.querySelectorAll('.num-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var inp  = document.getElementById(btn.dataset.target);
            if (!inp) return;
            var step = parseFloat(btn.dataset.step) || 1;
            var dir  = btn.dataset.dir === '+' ? 1 : -1;
            var min  = parseFloat(inp.min);
            var max  = parseFloat(inp.max);
            var val  = parseFloat(inp.value) || 0;
            val      = Math.round((val + step * dir) * 100) / 100;
            if (!isNaN(min)) val = Math.max(min, val);
            if (!isNaN(max)) val = Math.min(max, val);
            inp.value = val;
            clearCheck(btn.dataset.target);
        });
    });

    // ── Input Änderung → Haken löschen ──
    document.querySelectorAll('.num-input').forEach(function(inp) {
        inp.addEventListener('input', function() { clearCheck(inp.id); });
    });

    // ── Haken ──
    function showCheck(id) {
        var el = document.getElementById('check_' + id);
        if (el) el.textContent = '✅';
    }
    function clearCheck(id) {
        var el = document.getElementById('check_' + id);
        if (el) el.textContent = '';
    }

    // ── Status ──
    var statusEl = document.getElementById('duelStatus');
    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#f66' : '#9f9';
        if (msg) setTimeout(function() { statusEl.textContent = ''; }, 5000);
    }

    // ── Config laden ──
    function loadConfig() {
        fetch('/api/admin/duels').then(function(res) {
            return res.json();
        }).then(function(cfg) {
            document.getElementById('duelMinBet').value    = cfg.minBet        || 10;
            document.getElementById('duelMaxBet').value    = cfg.maxBet        || 100000;
            document.getElementById('duelCooldown').value  = cfg.cooldown      || 30;
            document.getElementById('duelTimeout').value   = cfg.acceptTimeout || 30;
            document.getElementById('duelMaxActive').value = cfg.maxActive     || 3;
            document.getElementById('duelSubBonus').value  = cfg.subBonus      || 1.5;

            // Siegchance: Migration von Kommazahl auf Prozent
            var aw = cfg.adminWinChance || 25;
            var mw = cfg.modWinChance   || 15;
            var vw = cfg.vipWinChance   || 10;
            var sw = cfg.subWinChance   || 5;
            if (aw < 1) aw = Math.round(aw * 100);
            if (mw < 1) mw = Math.round(mw * 100);
            if (vw < 1) vw = Math.round(vw * 100);
            if (sw < 1) sw = Math.round(sw * 100);

            document.getElementById('duelAdminWin').value  = aw;
            document.getElementById('duelModWin').value    = mw;
            document.getElementById('duelVipWin').value    = vw;
            document.getElementById('duelSubWin').value    = sw;
            document.getElementById('duelAdminLose').value = cfg.adminLoseBonus || 3.0;
            document.getElementById('duelModLose').value   = cfg.modLoseBonus   || 2.0;
            document.getElementById('duelVipLose').value   = cfg.vipLoseBonus   || 1.5;

            loadStats(cfg.stats || {});
        }).catch(function(e) {
            setStatus('Fehler beim Laden: ' + e.message, true);
        });
    }

    // ── Einstellungen speichern ──
    var saveSettingsBtn = document.getElementById('saveDuelSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = function() {
            var ids = ['duelMinBet','duelMaxBet','duelCooldown','duelTimeout','duelMaxActive','duelSubBonus'];
            fetch('/api/admin/duels').then(function(res) { return res.json(); }).then(function(cfg) {
                cfg.minBet        = Number(document.getElementById('duelMinBet').value);
                cfg.maxBet        = Number(document.getElementById('duelMaxBet').value);
                cfg.cooldown      = Number(document.getElementById('duelCooldown').value);
                cfg.acceptTimeout = Number(document.getElementById('duelTimeout').value);
                cfg.maxActive     = Number(document.getElementById('duelMaxActive').value);
                cfg.subBonus      = Number(document.getElementById('duelSubBonus').value);
                return fetch('/api/admin/duels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cfg)
                });
            }).then(function(res) { return res.json(); }).then(function(d) {
                if (d.ok) { ids.forEach(showCheck); setStatus('✅ Einstellungen gespeichert!'); }
                else setStatus('Fehler!', true);
            }).catch(function(e) { setStatus('Fehler: ' + e.message, true); });
        };
    }

    // ── Boni speichern ──
    var saveBoniBtn = document.getElementById('saveDuelBoniBtn');
    if (saveBoniBtn) {
        saveBoniBtn.onclick = function() {
            var ids = ['duelAdminWin','duelAdminLose','duelModWin','duelModLose','duelVipWin','duelVipLose','duelSubWin'];
            fetch('/api/admin/duels').then(function(res) { return res.json(); }).then(function(cfg) {
                cfg.adminWinChance = Number(document.getElementById('duelAdminWin').value);
                cfg.modWinChance   = Number(document.getElementById('duelModWin').value);
                cfg.vipWinChance   = Number(document.getElementById('duelVipWin').value);
                cfg.subWinChance   = Number(document.getElementById('duelSubWin').value);
                cfg.adminLoseBonus = Number(document.getElementById('duelAdminLose').value);
                cfg.modLoseBonus   = Number(document.getElementById('duelModLose').value);
                cfg.vipLoseBonus   = Number(document.getElementById('duelVipLose').value);
                return fetch('/api/admin/duels', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cfg)
                });
            }).then(function(res) { return res.json(); }).then(function(d) {
                if (d.ok) { ids.forEach(showCheck); setStatus('✅ Boni gespeichert!'); }
                else setStatus('Fehler!', true);
            }).catch(function(e) { setStatus('Fehler: ' + e.message, true); });
        };
    }

    // ── Laufende Duelle ──
    function loadActiveDuels() {
        var el = document.getElementById('activeDuelsList');
        if (!el) return;
        fetch('/api/admin/duels/active').then(function(res) { return res.json(); }).then(function(data) {
            var list = data.pending || [];
            if (list.length === 0) { el.innerHTML = '<span style="opacity:0.5;">Keine laufenden Duelle.</span>'; return; }
            el.innerHTML = '';
            list.forEach(function(d) {
                var div = document.createElement('div');
                div.style.cssText = 'padding:8px;border-bottom:1px solid #333;display:flex;align-items:center;gap:12px;';
                var badge = d.type === 'offen'
                    ? '<span style="background:#6441a5;padding:2px 8px;border-radius:10px;font-size:0.8em;">offen</span>'
                    : '<span style="background:#444;padding:2px 8px;border-radius:10px;font-size:0.8em;">direkt</span>';
                div.innerHTML = badge + '<span>⚔️ <strong>@' + d.challenger + '</strong> vs <strong>@' + d.target + '</strong></span><span style="color:#9f9;">' + d.bet + ' F$</span><span style="opacity:0.5;font-size:0.85em;">vor ' + d.since + 's</span>';
                el.appendChild(div);
            });
        }).catch(function() { el.textContent = 'Fehler beim Laden.'; });
    }

    var refreshBtn = document.getElementById('refreshDuelsBtn');
    if (refreshBtn) refreshBtn.onclick = loadActiveDuels;

    var abortBtn = document.getElementById('abortAllDuelsBtn');
    if (abortBtn) {
        abortBtn.onclick = function() {
            if (!confirm('Alle laufenden Duelle wirklich abbrechen?')) return;
            fetch('/api/admin/duels/abort', { method: 'POST' }).then(function() {
                setStatus('Alle Duelle abgebrochen.');
                loadActiveDuels();
            });
        };
    }

    // ── Stats ──
    function loadStats(stats) {
        var body = document.getElementById('duelStatsBody');
        if (!body) return;
        var entries = Object.keys(stats).map(function(user) {
            return Object.assign({ user: user }, stats[user]);
        }).filter(function(s) {
            return (s.wins||0) + (s.losses||0) + (s.draws||0) > 0;
        }).sort(function(a, b) { return (b.earned||0) - (a.earned||0); });

        if (entries.length === 0) {
            body.innerHTML = '<tr><td colspan="7" style="padding:12px;color:#888;text-align:center;">Noch keine Stats vorhanden.</td></tr>';
            return;
        }
        body.innerHTML = '';
        entries.forEach(function(s) {
            var bilanz = (s.earned||0) - (s.lost||0);
            var color  = bilanz >= 0 ? '#9f9' : '#f66';
            var tr     = document.createElement('tr');
            tr.style.borderBottom = '1px solid #333';
            tr.innerHTML =
                '<td style="padding:8px;"><strong>@' + s.user + '</strong></td>' +
                '<td style="padding:8px;text-align:center;color:#9f9;">'  + (s.wins||0)   + '</td>' +
                '<td style="padding:8px;text-align:center;color:#f66;">'  + (s.losses||0) + '</td>' +
                '<td style="padding:8px;text-align:center;color:#aaa;">'  + (s.draws||0)  + '</td>' +
                '<td style="padding:8px;text-align:center;">'             + (s.earned||0) + '</td>' +
                '<td style="padding:8px;text-align:center;">'             + (s.lost||0)   + '</td>' +
                '<td style="padding:8px;text-align:center;color:' + color + ';font-weight:bold;">' + (bilanz >= 0 ? '+' : '') + bilanz + '</td>';
            body.appendChild(tr);
        });
    }

    var resetBtn = document.getElementById('resetDuelStatsBtn');
    if (resetBtn) {
        resetBtn.onclick = function() {
            if (!confirm('Alle Duell-Stats wirklich löschen?')) return;
            fetch('/api/admin/duels/reset-stats', { method: 'POST' }).then(function() {
                setStatus('Stats gelöscht.');
                loadConfig();
                loadActiveDuels();
            });
        };
    }

    // ── Auto-Refresh alle 10s ──
    var interval = setInterval(loadActiveDuels, 10000);
    var duelTab  = document.getElementById('duel');
    if (duelTab) {
        var observer = new MutationObserver(function() {
            if (duelTab.style.display === 'none') {
                clearInterval(interval);
                observer.disconnect();
            }
        });
        observer.observe(duelTab, { attributes: true, attributeFilter: ['style'] });
    }

    // ── Init ──
    loadConfig();
    loadActiveDuels();
}
