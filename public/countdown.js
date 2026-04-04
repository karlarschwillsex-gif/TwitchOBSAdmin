// /home/fynn/TwitchOBSAdmin/public/countdown.js

function initCountdown() {
    var statusEl = document.getElementById('countdownStatus');

    function setStatus(msg, isError) {
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#f66' : '#9f9';
        if (msg) setTimeout(function() { statusEl.textContent = ''; }, 5000);
    }

    // ── Modus Toggle ──
    var modeCountdown = document.getElementById('cd_mode_countdown');
    var modeTimer     = document.getElementById('cd_mode_timer');

    function updateModeUI() {
        var isTimer = modeTimer.checked;
        document.getElementById('cd_countdown_settings').style.display = isTimer ? 'none' : 'block';
        document.getElementById('cd_timer_settings').style.display     = isTimer ? 'block' : 'none';
        document.getElementById('lbl_countdown').style.borderColor = isTimer ? '#444' : '#6441a5';
        document.getElementById('lbl_timer').style.borderColor     = isTimer ? '#6441a5' : '#444';
    }
    modeCountdown.onchange = updateModeUI;
    modeTimer.onchange     = updateModeUI;

    // ── Color Sync ──
    function syncColor(pickerId, textId) {
        document.getElementById(pickerId).oninput = function() { document.getElementById(textId).value = this.value; };
        document.getElementById(textId).oninput   = function() { try { document.getElementById(pickerId).value = this.value; } catch(e){} };
    }
    syncColor('cd_colorPicker',        'cd_color');
    syncColor('cd_shadowPicker',       'cd_shadow');
    syncColor('cd_timerColorPicker',   'cd_timerColor');
    syncColor('cd_urgentColorPicker',  'cd_urgentColor');

    // ── Werte lesen ──
    function getValues() {
        return {
            mode:         modeTimer.checked ? 'timer' : 'countdown',
            time:         document.getElementById('cd_time').value         || '20:00',
            timerMin:     Number(document.getElementById('cd_timerMin').value) || 30,
            timerSec:     Number(document.getElementById('cd_timerSec').value) || 0,
            labelTop:     document.getElementById('cd_labelTop').value     || '',
            labelSub:     document.getElementById('cd_labelSub').value     || '',
            labelBottom:  document.getElementById('cd_labelBottom').value  || '',
            doneText:     document.getElementById('cd_doneText').value     || 'Los geht\'s! 🎉',
            color:        document.getElementById('cd_color').value        || '#FFAA00',
            shadow:       document.getElementById('cd_shadow').value       || '#800080',
            sizeTop:      Number(document.getElementById('cd_sizeTop').value)    || 70,
            borderTop:    Number(document.getElementById('cd_borderTop').value)  || 3,
            sizeSub:      Number(document.getElementById('cd_sizeSub').value)    || 50,
            borderSub:    Number(document.getElementById('cd_borderSub').value)  || 2,
            sizeTimer:    Number(document.getElementById('cd_sizeTimer').value)  || 80,
            timerStyle:   document.getElementById('cd_timerStyle').value   || 'fire',
            timerColor:   document.getElementById('cd_timerColor').value   || '#ffffff',
            urgent:       Number(document.getElementById('cd_urgent').value)     || 30,
            urgentColor:  document.getElementById('cd_urgentColor').value  || '#ff4444'
        };
    }

    // ── Timer CSS je Style ──
    function getTimerCSS(v) {
        var base = 'font-family: "Orbitron", monospace; font-weight: 900; font-size: ' + v.sizeTimer + 'px; line-height: 1;';
        switch(v.timerStyle) {
            case 'custom':
                var b = v.borderTop;
                var s = v.shadow;
                var shadow = '-'+b+'px -'+b+'px 0 '+s+', '+b+'px -'+b+'px 0 '+s+', -'+b+'px '+b+'px 0 '+s+', '+b+'px '+b+'px 0 '+s;
                return base + ' color: ' + v.timerColor + '; text-shadow: ' + shadow + ';';
            case 'fire':
                return base + ' color: #ffffff; text-shadow: 0 0 10px rgba(255,200,50,0.9), 0 0 30px rgba(255,120,0,0.8), 0 0 60px rgba(200,0,0,0.5);';
            case 'ice':
                return base + ' color: #e0f7ff; text-shadow: 0 0 10px rgba(100,220,255,0.9), 0 0 30px rgba(0,150,255,0.7), 0 0 60px rgba(0,50,200,0.4);';
            case 'glow':
                return base + ' color: #fff8e7; text-shadow: 0 0 10px rgba(255,240,150,0.9), 0 0 30px rgba(255,200,50,0.7), 0 0 60px rgba(255,150,0,0.4);';
            case 'purple':
                return base + ' color: #f0e0ff; text-shadow: 0 0 10px rgba(200,100,255,0.9), 0 0 30px rgba(150,0,255,0.7), 0 0 60px rgba(100,0,200,0.4);';
            case 'green':
                return base + ' color: #e0ffe0; text-shadow: 0 0 10px rgba(100,255,100,0.9), 0 0 30px rgba(0,200,50,0.7), 0 0 60px rgba(0,150,0,0.4);';
            default:
                return base + ' color: #ffffff; text-shadow: 0 0 10px rgba(255,200,50,0.9), 0 0 30px rgba(255,120,0,0.8), 0 0 60px rgba(200,0,0,0.5);';
        }
    }

    function getUrgentCSS(v) {
        return 'animation: pulse 0.5s ease-in-out infinite; color: ' + v.urgentColor + '; text-shadow: 0 0 10px ' + v.urgentColor + ', 0 0 40px ' + v.urgentColor + ';';
    }

    // ── HTML bauen ──
    function buildHtml(v) {
        var bTop = v.borderTop;
        var bSub = v.borderSub;
        var sc   = v.shadow;
        var shadowTop = '-'+bTop+'px -'+bTop+'px 0 '+sc+', '+bTop+'px -'+bTop+'px 0 '+sc+', -'+bTop+'px '+bTop+'px 0 '+sc+', '+bTop+'px '+bTop+'px 0 '+sc;
        var shadowSub = '-'+bSub+'px -'+bSub+'px 0 '+sc+', '+bSub+'px -'+bSub+'px 0 '+sc+', -'+bSub+'px '+bSub+'px 0 '+sc+', '+bSub+'px '+bSub+'px 0 '+sc;

        var timerCSS  = getTimerCSS(v);
        var urgentCSS = getUrgentCSS(v);

        var scriptPart = v.mode === 'timer' ?
'  var remaining = ' + ((v.timerMin * 60) + v.timerSec) + ';\n' +
'  var URGENT = ' + v.urgent + ';\n' +
'  var iv = null;\n' +
'  var tEl = document.getElementById("timer");\n' +
'  var dEl = document.getElementById("done");\n' +
'  var t1  = document.querySelector(".label-top");\n' +
'  var t2  = document.querySelector(".label-clocksub");\n' +
'  var t3  = document.querySelector(".label-bottom");\n' +
'  function fmt(s){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;if(h>0)return h+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");return String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");}\n' +
'  function tick(){\n' +
'    if(remaining<=0){clearInterval(iv);tEl.style.display="none";t1.style.display="none";t2.style.display="none";t3.style.display="none";dEl.style.display="block";return;}\n' +
'    tEl.textContent=fmt(remaining);\n' +
'    if(remaining<=URGENT)tEl.className="timer urgent";else tEl.className="timer";\n' +
'    remaining--;\n' +
'  }\n' +
'  tick();iv=setInterval(tick,1000);\n'
:
'  var TARGET="' + v.time + '";\n' +
'  var URGENT=' + v.urgent + ';\n' +
'  function getRem(){var now=new Date(),parts=TARGET.split(":"),t=new Date();t.setHours(parseInt(parts[0]),parseInt(parts[1]),0,0);if(t<=now)t.setDate(t.getDate()+1);return Math.max(0,Math.floor((t-now)/1000));}\n' +
'  var iv=null;\n' +
'  var tEl=document.getElementById("timer");\n' +
'  var dEl=document.getElementById("done");\n' +
'  var t1=document.querySelector(".label-top");\n' +
'  var t2=document.querySelector(".label-clocksub");\n' +
'  var t3=document.querySelector(".label-bottom");\n' +
'  function fmt(s){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;if(h>0)return h+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");return String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");}\n' +
'  function tick(){var rem=getRem();if(rem<=0){clearInterval(iv);tEl.style.display="none";t1.style.display="none";t2.style.display="none";t3.style.display="none";dEl.style.display="block";return;}tEl.textContent=fmt(rem);if(rem<=URGENT)tEl.className="timer urgent";else tEl.className="timer";}\n' +
'  tick();iv=setInterval(tick,1000);\n';

        return '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="UTF-8">\n<title>Countdown</title>\n<style>\n' +
'  * { margin:0; padding:0; box-sizing:border-box; }\n' +
'  body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden; }\n' +
'  .container { text-align: center; padding: 30px 50px; }\n' +
'  .label-top {\n' +
'    color: ' + v.color + ';\n' +
'    font-family: "Magneto", sans-serif;\n' +
'    font-size: ' + v.sizeTop + 'px;\n' +
'    font-weight: bold;\n' +
'    text-shadow: ' + shadowTop + ';\n' +
'    margin-bottom: 10px;\n' +
'  }\n' +
'  .label-clocksub {\n' +
'    color: ' + v.color + ';\n' +
'    font-family: "Magneto", sans-serif;\n' +
'    font-size: ' + v.sizeSub + 'px;\n' +
'    font-weight: bold;\n' +
'    text-shadow: ' + shadowSub + ';\n' +
'    margin-bottom: 6px;\n' +
'  }\n' +
'  .label-bottom {\n' +
'    color: ' + v.color + ';\n' +
'    font-family: "Magneto", sans-serif;\n' +
'    font-size: ' + v.sizeSub + 'px;\n' +
'    font-weight: bold;\n' +
'    text-shadow: ' + shadowSub + ';\n' +
'    margin-top: 10px;\n' +
'  }\n' +
'  .timer { ' + timerCSS + ' }\n' +
'  .timer.urgent { ' + urgentCSS + ' }\n' +
'  .done-text { display:none; font-family:"Orbitron",monospace; font-weight:700; font-size:48px; color:#ffffff; text-shadow:0 0 10px rgba(255,200,50,0.9),0 0 30px rgba(255,120,0,0.8); }\n' +
'  @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }\n' +
'</style>\n</head>\n<body>\n' +
'<div class="container">\n' +
'  <div class="label-top">' + v.labelTop + '</div>\n' +
'  <div class="label-clocksub">' + v.labelSub + '</div>\n' +
'  <div class="timer" id="timer">00:00</div>\n' +
'  <div class="done-text" id="done">' + v.doneText + '</div>\n' +
'  <div class="label-bottom">' + v.labelBottom + '</div>\n' +
'</div>\n<script>\n' + scriptPart + '<\/script>\n</body>\n</html>';
    }

    // ── Laden ──
    function loadFromServer() {
        fetch('/api/admin/countdown').then(function(r) { return r.json(); }).then(function(d) {
            if (!d || !d.mode) return;
            if (d.mode === 'timer') modeTimer.checked = true;
            else modeCountdown.checked = true;
            updateModeUI();
            var set = function(id, val) { if (val !== undefined && val !== null) { var el = document.getElementById(id); if (el) el.value = val; } };
            set('cd_time', d.time); set('cd_timerMin', d.timerMin); set('cd_timerSec', d.timerSec);
            set('cd_labelTop', d.labelTop); set('cd_labelSub', d.labelSub);
            set('cd_labelBottom', d.labelBottom); set('cd_doneText', d.doneText);
            set('cd_color', d.color); set('cd_shadow', d.shadow);
            set('cd_sizeTop', d.sizeTop); set('cd_borderTop', d.borderTop);
            set('cd_sizeSub', d.sizeSub); set('cd_borderSub', d.borderSub);
            set('cd_sizeTimer', d.sizeTimer); set('cd_timerStyle', d.timerStyle);
            set('cd_timerColor', d.timerColor); set('cd_urgent', d.urgent);
            set('cd_urgentColor', d.urgentColor);
            // Color Pickers sync
            ['cd_color','cd_shadow','cd_timerColor','cd_urgentColor'].forEach(function(id) {
                var el = document.getElementById(id);
                var pk = document.getElementById(id + 'Picker');
                if (el && pk) try { pk.value = el.value; } catch(e){}
            });
            setStatus('Geladen ✅');
        }).catch(function() {});
    }

    // ── Speichern ──
    document.getElementById('cd_saveBtn').onclick = function() {
        var v    = getValues();
        var html = buildHtml(v);
        setStatus('Speichere…');
        fetch('/api/admin/countdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: v, html: html })
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.ok) setStatus('✅ Countdown gespeichert!');
            else setStatus('Fehler: ' + (d.error || 'unbekannt'), true);
        }).catch(function(e) { setStatus('Fehler: ' + e.message, true); });
    };

    document.getElementById('cd_loadBtn').onclick = loadFromServer;

    loadFromServer();
    updateModeUI();
}
