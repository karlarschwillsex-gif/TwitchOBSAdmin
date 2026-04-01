function loadSounds() {
    initSoundAdmin();
}

async function initSoundAdmin() {
    const statusEl        = document.getElementById('soundStatus');
    const selectEl        = document.getElementById('soundFileSelect');
    const bitSoundSelect  = document.getElementById('bitSoundSelect');
    const tableBody       = document.getElementById('soundRewardTable');
    const bitTableBody    = document.getElementById('bitSoundTable');
    const fileListEl      = document.getElementById('soundFileList');
    const addBtn          = document.getElementById('addSoundRewardBtn');
    const addBitBtn       = document.getElementById('addBitSoundBtn');
    const previewBtn      = document.getElementById('previewBtn');
    const previewBitBtn   = document.getElementById('previewBitBtn');
    const rewardNameInput = document.getElementById('rewardNameInput');
    const rewardCostInput = document.getElementById('rewardCostInput');
    const volumeInput     = document.getElementById('volumeInput');
    const bitFromInput    = document.getElementById('bitFromInput');
    const bitToInput      = document.getElementById('bitToInput');
    const bitVolumeInput  = document.getElementById('bitVolumeInput');

    function setStatus(msg, isError = false) {
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#f66' : '#9f9';
        if (msg) setTimeout(() => statusEl.textContent = '', 5000);
    }

    // ── Verfügbare Sound-Dateien laden ──
    async function loadAvailableFiles() {
        try {
            const res   = await fetch('/api/admin/sound-files');
            const data  = await res.json();
            const files = Array.isArray(data.files) ? data.files : [];

            // Beide Dropdowns befüllen
            [selectEl, bitSoundSelect].forEach(sel => {
                sel.innerHTML = '<option value="">-- Bitte wählen --</option>';
                files.forEach(f => {
                    const opt       = document.createElement('option');
                    opt.value       = f;
                    opt.textContent = f;
                    sel.appendChild(opt);
                });
            });

            // Datei-Chips anzeigen
            fileListEl.innerHTML = '';
            files.forEach(f => {
                const chip         = document.createElement('span');
                chip.textContent   = f;
                chip.style.cssText = 'background:#333; padding:4px 10px; border-radius:12px; font-size:0.85em; cursor:pointer; border:1px solid #555;';
                chip.onclick       = () => { selectEl.value = f; bitSoundSelect.value = f; };
                fileListEl.appendChild(chip);
            });
        } catch (e) {
            console.error('Fehler beim Laden der Sound-Dateien:', e);
        }
    }

    // ── FoxChatPoints Rewards laden ──
    async function loadRewards() {
        try {
            const res     = await fetch('/api/admin/sound-rewards');
            const rewards = await res.json();

            tableBody.innerHTML = '';

            if (!Array.isArray(rewards) || rewards.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="6" style="padding:12px; color:#888; text-align:center;">Noch keine Sound-Belohnungen angelegt.</td></tr>`;
                return;
            }

            const filesRes  = await fetch('/api/admin/sound-files');
            const filesData = await filesRes.json();
            const allFiles  = Array.isArray(filesData.files) ? filesData.files : [];

            rewards.forEach((r, idx) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';

                const fileOptions = allFiles.map(f =>
                    `<option value="${f}" ${f === r.file ? 'selected' : ''}>${f}</option>`
                ).join('');

                tr.innerHTML = `
                    <td style="padding:8px;">
                        <input type="text" value="${r.rewardName || ''}"
                               data-idx="${idx}" data-field="rewardName"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:160px;">
                    </td>
                    <td style="padding:8px;">
                        <select data-idx="${idx}" data-field="file"
                                style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:150px;">
                            ${fileOptions}
                        </select>
                    </td>
                    <td style="padding:8px;">
                        <input type="number" value="${r.volume ?? 80}" min="0" max="100"
                               data-idx="${idx}" data-field="volume"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:55px;">
                        <span style="opacity:0.6;"> %</span>
                    </td>
                    <td style="padding:8px;">
                        <input type="number" value="${r.cost ?? 100}" min="1"
                               data-idx="${idx}" data-field="cost"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:70px;">
                        <button class="saveCostBtn" data-idx="${idx}"
                                style="background:#6441a5;border:none;color:#eee;padding:4px 8px;border-radius:4px;cursor:pointer;margin-left:4px;">
                            💾
                        </button>
                    </td>
                    <td style="padding:8px;">
                        <button class="previewRowBtn" data-file="${r.file}" data-volume="${r.volume ?? 80}"
                                style="background:#444;border:none;color:#eee;padding:4px 10px;border-radius:4px;cursor:pointer;">
                            ▶
                        </button>
                    </td>
                    <td style="padding:8px;">
                        <button class="deleteBtn" data-idx="${idx}" data-reward-id="${r.rewardId || ''}"
                                style="background:var(--danger);border:none;color:#eee;padding:4px 10px;border-radius:4px;cursor:pointer;">
                            Löschen
                        </button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });

            // Events
            tableBody.querySelectorAll('.previewRowBtn').forEach(btn => {
                btn.onclick = () => playPreview(btn.dataset.file, Number(btn.dataset.volume));
            });

            tableBody.querySelectorAll('.saveCostBtn').forEach(btn => {
                btn.onclick = async () => {
                    const idx     = Number(btn.dataset.idx);
                    const costInp = tableBody.querySelector(`input[data-idx="${idx}"][data-field="cost"]`);
                    const newCost = Number(costInp?.value || 100);
                    rewards[idx].cost = newCost;
                    await saveRewards(rewards);
                    if (rewards[idx].rewardId) {
                        const res  = await fetch('/api/admin/sound-rewards/update-twitch', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rewardId: rewards[idx].rewardId, cost: newCost })
                        });
                        const data = await res.json();
                        data.ok
                            ? setStatus(`✅ Kosten für "${rewards[idx].rewardName}" auf ${newCost} FCP gesetzt!`)
                            : setStatus(`⚠ Lokal gespeichert, Twitch-Update fehlgeschlagen: ${data.error}`, true);
                    } else {
                        setStatus('Lokal gespeichert.');
                    }
                };
            });

            tableBody.querySelectorAll('.deleteBtn').forEach(btn => {
                btn.onclick = async () => {
                    const idx      = Number(btn.dataset.idx);
                    const rewardId = btn.dataset.rewardId;
                    if (!confirm(`Belohnung "${rewards[idx].rewardName}" löschen? Wird auch bei Twitch entfernt!`)) return;
                    if (rewardId) {
                        await fetch('/api/admin/sound-rewards/delete-twitch', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rewardId })
                        });
                    }
                    rewards.splice(idx, 1);
                    await saveRewards(rewards);
                    await loadRewards();
                    setStatus('Belohnung gelöscht.');
                };
            });

            tableBody.querySelectorAll('input[data-field="volume"], select[data-field="file"]').forEach(inp => {
                inp.onchange = async () => {
                    const idx   = Number(inp.dataset.idx);
                    const field = inp.dataset.field;
                    rewards[idx][field] = field === 'volume' ? Number(inp.value) : inp.value;
                    await saveRewards(rewards);
                    setStatus('Gespeichert.');
                };
            });

        } catch (e) {
            tableBody.innerHTML = `<tr><td colspan="6" style="color:#f66;padding:12px;">Fehler: ${e.message}</td></tr>`;
        }
    }

    // ── Bit-Sounds laden ──
    async function loadBitSounds() {
        try {
            const res      = await fetch('/api/admin/bit-sounds');
            const bitSounds = await res.json();

            bitTableBody.innerHTML = '';

            if (!Array.isArray(bitSounds) || bitSounds.length === 0) {
                bitTableBody.innerHTML = `<tr><td colspan="6" style="padding:12px; color:#888; text-align:center;">Noch keine Bit-Sounds angelegt.</td></tr>`;
                return;
            }

            const filesRes  = await fetch('/api/admin/sound-files');
            const filesData = await filesRes.json();
            const allFiles  = Array.isArray(filesData.files) ? filesData.files : [];

            bitSounds.forEach((b, idx) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';

                const fileOptions = allFiles.map(f =>
                    `<option value="${f}" ${f === b.file ? 'selected' : ''}>${f}</option>`
                ).join('');

                tr.innerHTML = `
                    <td style="padding:8px;">
                        <input type="number" value="${b.from ?? 1}" min="1"
                               data-idx="${idx}" data-field="from"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:80px;">
                    </td>
                    <td style="padding:8px;">
                        <input type="number" value="${b.to ?? 99}" min="1"
                               data-idx="${idx}" data-field="to"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:80px;">
                    </td>
                    <td style="padding:8px;">
                        <select data-idx="${idx}" data-field="file"
                                style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:150px;">
                            ${fileOptions}
                        </select>
                    </td>
                    <td style="padding:8px;">
                        <input type="number" value="${b.volume ?? 80}" min="0" max="100"
                               data-idx="${idx}" data-field="volume"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:55px;">
                        <span style="opacity:0.6;"> %</span>
                    </td>
                    <td style="padding:8px;">
                        <button class="previewBitRowBtn" data-file="${b.file}" data-volume="${b.volume ?? 80}"
                                style="background:#444;border:none;color:#eee;padding:4px 10px;border-radius:4px;cursor:pointer;">
                            ▶
                        </button>
                    </td>
                    <td style="padding:8px;">
                        <button class="deleteBitBtn" data-idx="${idx}"
                                style="background:var(--danger);border:none;color:#eee;padding:4px 10px;border-radius:4px;cursor:pointer;">
                            Löschen
                        </button>
                    </td>
                `;
                bitTableBody.appendChild(tr);
            });

            // Vorschau
            bitTableBody.querySelectorAll('.previewBitRowBtn').forEach(btn => {
                btn.onclick = () => playPreview(btn.dataset.file, Number(btn.dataset.volume));
            });

            // Löschen
            bitTableBody.querySelectorAll('.deleteBitBtn').forEach(btn => {
                btn.onclick = async () => {
                    const idx = Number(btn.dataset.idx);
                    bitSounds.splice(idx, 1);
                    await saveBitSounds(bitSounds);
                    await loadBitSounds();
                    setStatus('Bit-Sound gelöscht.');
                };
            });

            // Inline Änderungen
            bitTableBody.querySelectorAll('input, select').forEach(inp => {
                inp.onchange = async () => {
                    const idx   = Number(inp.dataset.idx);
                    const field = inp.dataset.field;
                    bitSounds[idx][field] = (field === 'from' || field === 'to' || field === 'volume')
                        ? Number(inp.value) : inp.value;
                    await saveBitSounds(bitSounds);
                    setStatus('Gespeichert.');
                };
            });

        } catch (e) {
            bitTableBody.innerHTML = `<tr><td colspan="6" style="color:#f66;padding:12px;">Fehler: ${e.message}</td></tr>`;
        }
    }

    // ── Speichern ──
    async function saveRewards(rewards) {
        await fetch('/api/admin/sound-rewards', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rewards)
        });
    }

    async function saveBitSounds(bitSounds) {
        await fetch('/api/admin/bit-sounds', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bitSounds)
        });
    }

    // ── Vorschau ──
    function playPreview(file, volume) {
        if (!file) { setStatus('Bitte eine Sound-Datei auswählen.', true); return; }
        const audio  = new Audio(`/sounds/${file}`);
        audio.volume = Math.min(1, Math.max(0, (volume || 80) / 100));
        audio.play().catch(e => setStatus('Vorschau fehlgeschlagen: ' + e.message, true));
    }

    // ── FoxChatPoints Reward anlegen ──
    addBtn.onclick = async () => {
        const rewardName = (rewardNameInput.value || '').trim();
        const file       = selectEl.value;
        const cost       = Number(rewardCostInput.value || 100);
        const volume     = Number(volumeInput.value || 80);

        if (!rewardName) { setStatus('Bitte einen Belohnungsnamen eingeben.', true); return; }
        if (!file)       { setStatus('Bitte eine Sound-Datei auswählen.', true);    return; }

        setStatus('Erstelle Belohnung bei Twitch…');
        try {
            const res  = await fetch('/api/admin/sound-rewards/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rewardName, file, cost, volume })
            });
            const data = await res.json();
            if (!data.ok) { setStatus('Fehler: ' + (data.error || 'Unbekannt'), true); return; }
            rewardNameInput.value = '';
            selectEl.value        = '';
            rewardCostInput.value = '100';
            volumeInput.value     = '80';
            await loadRewards();
            setStatus(`✅ "${rewardName}" bei Twitch angelegt!`);
        } catch (e) { setStatus('Fehler: ' + e.message, true); }
    };

    // ── Bit-Sound hinzufügen ──
    addBitBtn.onclick = async () => {
        const from   = Number(bitFromInput.value   || 1);
        const to     = Number(bitToInput.value     || 99);
        const file   = bitSoundSelect.value;
        const volume = Number(bitVolumeInput.value || 80);

        if (!file)   { setStatus('Bitte eine Sound-Datei auswählen.', true); return; }
        if (from < 1){ setStatus('"Von" muss mindestens 1 sein.', true);     return; }
        if (to < from){ setStatus('"Bis" muss größer als "Von" sein.', true); return; }

        try {
            const res      = await fetch('/api/admin/bit-sounds');
            const bitSounds = await res.json();
            const list     = Array.isArray(bitSounds) ? bitSounds : [];
            list.push({ from, to, file, volume });
            await saveBitSounds(list);
            bitFromInput.value   = '1';
            bitToInput.value     = '99';
            bitSoundSelect.value = '';
            bitVolumeInput.value = '80';
            await loadBitSounds();
            setStatus(`✅ Bit-Sound (${from}-${to} Bits) hinzugefügt!`);
        } catch (e) { setStatus('Fehler: ' + e.message, true); }
    };

    // ── Vorschau-Buttons oben ──
    previewBtn.onclick    = () => playPreview(selectEl.value,       Number(volumeInput.value    || 80));
    previewBitBtn.onclick = () => playPreview(bitSoundSelect.value, Number(bitVolumeInput.value || 80));

    // ── Init ──
    await loadAvailableFiles();
    await loadRewards();
    await loadBitSounds();
}
