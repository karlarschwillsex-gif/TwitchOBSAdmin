function initOverlayAdmin() {
    loadCamFilterAdmin();
}

async function loadCamFilterAdmin() {
    const statusEl        = document.getElementById('camStatus');
    const filterSelect    = document.getElementById('obsFilterSelect');
    const filterCost      = document.getElementById('filterCostInput');
    const filterDuration  = document.getElementById('filterDurationInput');
    const addBtn          = document.getElementById('addCamFilterRewardBtn');
    const previewBtn      = document.getElementById('previewFilterBtn');
    const tableBody       = document.getElementById('camFilterRewardTable');
    const filterListEl    = document.getElementById('obsFilterList');

    function setStatus(msg, isError = false) {
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#f66' : '#9f9';
        if (msg) setTimeout(() => statusEl.textContent = '', 5000);
    }

    // ── OBS Filter laden ──
    async function loadOBSFilters() {
        try {
            const res     = await fetch('/api/admin/obs-filters');
            const data    = await res.json();
            const filters = Array.isArray(data.filters) ? data.filters : [];

            filterSelect.innerHTML = '<option value="">-- Bitte wählen --</option>';
            filters.forEach(f => {
                const opt       = document.createElement('option');
                opt.value       = f.filterName;
                opt.textContent = f.filterName;
                filterSelect.appendChild(opt);
            });

            // Chips anzeigen
            filterListEl.innerHTML = '';
            if (filters.length === 0) {
                filterListEl.textContent = 'Keine Filter gefunden — OBS verbunden?';
                return;
            }
            filters.forEach(f => {
                const chip         = document.createElement('span');
                chip.textContent   = f.filterName;
                chip.style.cssText = 'background:#333; padding:4px 10px; border-radius:12px; font-size:0.85em; cursor:pointer; border:1px solid #555;';
                chip.onclick       = () => { filterSelect.value = f.filterName; };
                filterListEl.appendChild(chip);
            });
        } catch (e) {
            filterListEl.textContent = 'Fehler beim Laden der OBS-Filter.';
            console.error(e);
        }
    }

    // ── Aktive CamFilter-Belohnungen laden ──
    async function loadCamRewards() {
        try {
            const res     = await fetch('/api/admin/cam-rewards');
            const rewards = await res.json();

            tableBody.innerHTML = '';

            if (!Array.isArray(rewards) || rewards.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="6" style="padding:12px; color:#888; text-align:center;">Noch keine CamFilter-Belohnungen angelegt.</td></tr>`;
                return;
            }

            // OBS Filter für Dropdowns
            const obsRes     = await fetch('/api/admin/obs-filters');
            const obsData    = await obsRes.json();
            const allFilters = Array.isArray(obsData.filters) ? obsData.filters : [];

            rewards.forEach((r, idx) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';

                const filterOptions = allFilters.map(f =>
                    `<option value="${f.filterName}" ${f.filterName === r.filterName ? 'selected' : ''}>${f.filterName}</option>`
                ).join('');

                tr.innerHTML = `
                    <td style="padding:8px;">
                        <input type="text" value="${r.rewardName || ''}"
                               data-idx="${idx}" data-field="rewardName"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:160px;">
                    </td>
                    <td style="padding:8px;">
                        <select data-idx="${idx}" data-field="filterName"
                                style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:120px;">
                            ${filterOptions}
                        </select>
                    </td>
                    <td style="padding:8px;">
                        <input type="number" value="${r.duration ?? 10}" min="1"
                               data-idx="${idx}" data-field="duration"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:60px;">
                        <span style="opacity:0.6;"> s</span>
                    </td>
                    <td style="padding:8px;">
                        <input type="number" value="${r.cost ?? 300}" min="1"
                               data-idx="${idx}" data-field="cost"
                               style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:70px;">
                        <button class="saveCostBtn" data-idx="${idx}"
                                style="background:#6441a5;border:none;color:#eee;padding:4px 8px;border-radius:4px;cursor:pointer;margin-left:4px;">
                            💾
                        </button>
                    </td>
                    <td style="padding:8px;">
                        <button class="previewCamBtn" data-filter="${r.filterName}" data-duration="${r.duration ?? 10}"
                                style="background:#444;border:none;color:#eee;padding:4px 10px;border-radius:4px;cursor:pointer;">
                            ▶
                        </button>
                    </td>
                    <td style="padding:8px;">
                        <button class="deleteCamBtn" data-idx="${idx}" data-reward-id="${r.rewardId || ''}"
                                style="background:var(--danger);border:none;color:#eee;padding:4px 10px;border-radius:4px;cursor:pointer;">
                            Löschen
                        </button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });

            // Vorschau
            tableBody.querySelectorAll('.previewCamBtn').forEach(btn => {
                btn.onclick = () => previewFilter(btn.dataset.filter, Number(btn.dataset.duration));
            });

            // Kosten speichern
            tableBody.querySelectorAll('.saveCostBtn').forEach(btn => {
                btn.onclick = async () => {
                    const idx     = Number(btn.dataset.idx);
                    const costInp = tableBody.querySelector(`input[data-idx="${idx}"][data-field="cost"]`);
                    const newCost = Number(costInp?.value || 300);
                    rewards[idx].cost = newCost;
                    await saveCamRewards(rewards);
                    if (rewards[idx].rewardId) {
                        const res  = await fetch('/api/admin/cam-rewards/update-twitch', {
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

            // Löschen
            tableBody.querySelectorAll('.deleteCamBtn').forEach(btn => {
                btn.onclick = async () => {
                    const idx      = Number(btn.dataset.idx);
                    const rewardId = btn.dataset.rewardId;
                    if (!confirm(`Belohnung "${rewards[idx].rewardName}" löschen? Wird auch bei Twitch entfernt!`)) return;
                    if (rewardId) {
                        await fetch('/api/admin/cam-rewards/delete-twitch', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rewardId })
                        });
                    }
                    rewards.splice(idx, 1);
                    await saveCamRewards(rewards);
                    await loadCamRewards();
                    setStatus('Belohnung gelöscht.');
                };
            });

            // Inline Änderungen
            tableBody.querySelectorAll('input[data-field="duration"], select[data-field="filterName"]').forEach(inp => {
                inp.onchange = async () => {
                    const idx   = Number(inp.dataset.idx);
                    const field = inp.dataset.field;
                    rewards[idx][field] = field === 'duration' ? Number(inp.value) : inp.value;
                    await saveCamRewards(rewards);
                    setStatus('Gespeichert.');
                };
            });

        } catch (e) {
            tableBody.innerHTML = `<tr><td colspan="6" style="color:#f66;padding:12px;">Fehler: ${e.message}</td></tr>`;
        }
    }

    // ── Speichern ──
    async function saveCamRewards(rewards) {
        await fetch('/api/admin/cam-rewards', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rewards)
        });
    }

    // ── Filter Vorschau ──
    async function previewFilter(filterName, duration) {
        if (!filterName) { setStatus('Bitte einen Filter auswählen.', true); return; }
        setStatus(`▶ Filter "${filterName}" aktiv für ${duration}s...`);
        try {
            await fetch('/api/admin/cam-filter/trigger', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filterName, duration })
            });
        } catch (e) {
            setStatus('Fehler beim Testen: ' + e.message, true);
        }
    }

    // ── Neue Belohnung anlegen ──
    addBtn.onclick = async () => {
        const filterName = filterSelect.value;
        const cost       = Number(filterCost.value   || 300);
        const duration   = Number(filterDuration.value || 10);

        if (!filterName) { setStatus('Bitte einen OBS-Filter auswählen.', true); return; }

        setStatus('Erstelle Belohnung bei Twitch…');
        try {
            const res  = await fetch('/api/admin/cam-rewards/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filterName, cost, duration })
            });
            const data = await res.json();
            if (!data.ok) { setStatus('Fehler: ' + (data.error || 'Unbekannt'), true); return; }
            filterSelect.value   = '';
            filterCost.value     = '300';
            filterDuration.value = '10';
            await loadCamRewards();
            setStatus(`✅ "${filterName} [Cam]" bei Twitch angelegt!`);
        } catch (e) { setStatus('Fehler: ' + e.message, true); }
    };

    // ── Vorschau-Button oben ──
    previewBtn.onclick = () => previewFilter(filterSelect.value, Number(filterDuration.value || 10));

    // ── Init ──
    await loadOBSFilters();
    await loadCamRewards();
}
