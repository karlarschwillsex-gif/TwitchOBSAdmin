// /home/fynn/TwitchOBSAdmin/public/security.js

function initSecurity() {
    var statusEl = document.getElementById('bankStatus');

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#f66' : '#9f9';
        if (msg) setTimeout(function() { statusEl.textContent = ''; }, 5000);
    }

    // ── Standard Bits-Stufen ──
    var DEFAULT_BITS = [
        { label: '1 – 99 Bits',       from: 1,     to: 99,    rate: 1.0 },
        { label: '100 – 499 Bits',     from: 100,   to: 499,   rate: 1.5 },
        { label: '500 – 999 Bits',     from: 500,   to: 999,   rate: 2.0 },
        { label: '1.000 – 4.999 Bits', from: 1000,  to: 4999,  rate: 2.5 },
        { label: '5.000 – 9.999 Bits', from: 5000,  to: 9999,  rate: 3.0 },
        { label: '10.000+ Bits',       from: 10000, to: 999999,rate: 4.0 }
    ];

    // ── Standard SUB-Belohnungen ──
    var DEFAULT_SUBS = [
        { id: 'tier1',    label: 'Tier 1 (Erstsub)',          fd: 500,  resub: false, gift: false },
        { id: 'tier2',    label: 'Tier 2 (Erstsub)',          fd: 1000, resub: false, gift: false },
        { id: 'tier3',    label: 'Tier 3 (Erstsub)',          fd: 2000, resub: false, gift: false },
        { id: 'resubBonus',label: 'Resub-Bonus (alle Tiers)', fd: 200,  resub: true,  gift: false },
        { id: 'gift',     label: 'Geschenk-SUB (Schenker)',   fd: 600,  resub: false, gift: true  }
    ];

    var bitsData = [];
    var subsData = [];

    // ── Bits Tabelle rendern ──
    function renderBitsTable(data) {
        var tbody = document.getElementById('bitsTable');
        tbody.innerHTML = '';
        data.forEach(function(row, idx) {
            var exampleBits = row.from === 1 ? 50 : row.from;
            var exampleFD   = Math.ceil(exampleBits * row.rate);
            var tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #333';
            tr.innerHTML =
                '<td style="padding:8px;color:#aaa;">' + row.label + '</td>' +
                '<td style="padding:8px;">' +
                  '<input type="number" id="bits_rate_' + idx + '" value="' + row.rate + '" ' +
                  'min="0.1" step="0.1" style="background:#222;border:1px solid #444;color:#eee;' +
                  'padding:4px 8px;border-radius:4px;width:80px;" data-idx="' + idx + '">' +
                '</td>' +
                '<td style="padding:8px;color:#9f9;" id="bits_example_' + idx + '">' +
                  exampleBits + ' Bits × ' + row.rate + ' = <strong>' + exampleFD + ' F$</strong>' +
                '</td>' +
                '<td style="padding:8px;"><span class="cr-haken" id="bits_haken_' + idx + '"></span></td>';
            tbody.appendChild(tr);
        });

        // Live-Berechnung bei Änderung
        data.forEach(function(row, idx) {
            var inp = document.getElementById('bits_rate_' + idx);
            inp.addEventListener('input', function() {
                var rate        = parseFloat(this.value) || 1;
                var exampleBits = row.from === 1 ? 50 : row.from;
                var exampleFD   = Math.ceil(exampleBits * rate);
                document.getElementById('bits_example_' + idx).innerHTML =
                    exampleBits + ' Bits × ' + rate + ' = <strong>' + exampleFD + ' F$</strong>';
                document.getElementById('bits_haken_' + idx).textContent = '';
                bitsData[idx].rate = rate;
            });
        });
    }

    // ── SUB Tabelle rendern ──
    function renderSubsTable(data) {
        var tbody = document.getElementById('subsTable');
        tbody.innerHTML = '';
        data.forEach(function(row, idx) {
            var ergebnis = '';
            if (row.resub) {
                ergebnis = 'Tier 1: ' + (data[0].fd + row.fd) + ' F$ | Tier 2: ' + (data[1].fd + row.fd) + ' F$ | Tier 3: ' + (data[2].fd + row.fd) + ' F$';
            } else if (row.gift) {
                ergebnis = row.fd + ' F$ pro verschenktem SUB';
            } else {
                ergebnis = row.fd + ' F$ beim ersten Sub';
            }

            var tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #333';
            tr.innerHTML =
                '<td style="padding:8px;">' + row.label + '</td>' +
                '<td style="padding:8px;">' +
                  '<input type="number" id="sub_fd_' + idx + '" value="' + row.fd + '" ' +
                  'min="0" step="50" style="background:#222;border:1px solid #444;color:#eee;' +
                  'padding:4px 8px;border-radius:4px;width:90px;" data-idx="' + idx + '">' +
                  ' F$' +
                '</td>' +
                '<td style="padding:8px;color:#9f9;font-size:0.85em;" id="sub_result_' + idx + '">' + ergebnis + '</td>' +
                '<td style="padding:8px;"><span class="cr-haken" id="sub_haken_' + idx + '"></span></td>';
            tbody.appendChild(tr);
        });

        // Live-Berechnung
        data.forEach(function(row, idx) {
            var inp = document.getElementById('sub_fd_' + idx);
            inp.addEventListener('input', function() {
                subsData[idx].fd = Number(this.value) || 0;
                document.getElementById('sub_haken_' + idx).textContent = '';
                // Ergebnis neu berechnen
                var resubRow  = subsData.find(function(r) { return r.resub; });
                var resubBonus = resubRow ? resubRow.fd : 200;
                subsData.forEach(function(r, i) {
                    var res = '';
                    if (r.resub) {
                        res = 'Tier 1: ' + (subsData[0].fd + r.fd) + ' F$ | Tier 2: ' + (subsData[1].fd + r.fd) + ' F$ | Tier 3: ' + (subsData[2].fd + r.fd) + ' F$';
                    } else if (r.gift) {
                        res = r.fd + ' F$ pro verschenktem SUB';
                    } else {
                        res = r.fd + ' F$ beim ersten Sub';
                    }
                    var el = document.getElementById('sub_result_' + i);
                    if (el) el.innerHTML = res;
                });
            });
        });
    }

    // ── Laden ──
    function loadBank() {
        fetch('/api/admin/fdbank').then(function(r) { return r.json(); }).then(function(data) {
            bitsData = data.bits  || DEFAULT_BITS;
            subsData = data.subs  || DEFAULT_SUBS;
            renderBitsTable(bitsData);
            renderSubsTable(subsData);
            // Haken setzen
            bitsData.forEach(function(_, i) { document.getElementById('bits_haken_' + i).textContent = '✅'; });
            subsData.forEach(function(_, i) { document.getElementById('sub_haken_'  + i).textContent = '✅'; });
        }).catch(function() {
            bitsData = DEFAULT_BITS.map(function(r) { return Object.assign({}, r); });
            subsData = DEFAULT_SUBS.map(function(r) { return Object.assign({}, r); });
            renderBitsTable(bitsData);
            renderSubsTable(subsData);
        });
    }

    // ── Bits speichern ──
    document.getElementById('saveBitsBtn').onclick = function() {
        bitsData.forEach(function(row, idx) {
            row.rate = parseFloat(document.getElementById('bits_rate_' + idx).value) || 1.0;
        });
        fetch('/api/admin/fdbank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bits: bitsData, subs: subsData })
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.ok) {
                bitsData.forEach(function(_, i) { document.getElementById('bits_haken_' + i).textContent = '✅'; });
                setStatus('✅ Bits-Kurse gespeichert!');
            } else setStatus('Fehler!', true);
        }).catch(function(e) { setStatus('Fehler: ' + e.message, true); });
    };

    // ── SUBs speichern ──
    document.getElementById('saveSubsBtn').onclick = function() {
        subsData.forEach(function(row, idx) {
            row.fd = Number(document.getElementById('sub_fd_' + idx).value) || 0;
        });
        fetch('/api/admin/fdbank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bits: bitsData, subs: subsData })
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.ok) {
                subsData.forEach(function(_, i) { document.getElementById('sub_haken_' + i).textContent = '✅'; });
                setStatus('✅ SUB-Belohnungen gespeichert!');
            } else setStatus('Fehler!', true);
        }).catch(function(e) { setStatus('Fehler: ' + e.message, true); });
    };

    loadBank();
}
