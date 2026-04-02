function initCmdAdmin() {
    setupRoleCheckboxes('newCmdRoles');
    loadCmds();
}

// ── Checkbox Logik ──
function setupRoleCheckboxes(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allBox   = container.querySelector('input[value="everyone"]');
    const otherBoxes = Array.from(container.querySelectorAll('input.roleCheck')).filter(c => c.value !== 'everyone');

    if (allBox) {
        allBox.addEventListener('change', () => {
            if (allBox.checked) {
                otherBoxes.forEach(c => c.checked = true);
            }
        });
    }

    otherBoxes.forEach(box => {
        box.addEventListener('change', () => {
            if (!box.checked && allBox) {
                allBox.checked = false;
            }
            // Wenn alle anderen angehakt → Alle automatisch setzen
            if (allBox && otherBoxes.every(c => c.checked)) {
                allBox.checked = true;
            }
        });
    });
}

function getRolesFromContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return ['everyone'];
    const checked = Array.from(container.querySelectorAll('input.roleCheck:checked')).map(c => c.value);
    if (checked.includes('everyone') || checked.length === 0) return ['everyone'];
    return checked.filter(r => r !== 'everyone');
}

function setRolesToContainer(containerId, roles) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const isAll = !roles || roles.includes('everyone') || roles.length === 0;
    container.querySelectorAll('input.roleCheck').forEach(c => {
        if (isAll) {
            c.checked = true;
        } else {
            c.checked = roles.includes(c.value);
        }
    });
}

function rolesToDisplay(roles) {
    if (!roles || roles.includes('everyone') || roles.length === 0) return 'Alle';
    return roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ');
}

// ── Befehle laden ──
async function loadCmds() {
    const statusEl  = document.getElementById('cmdStatus');
    const tableBody = document.getElementById('cmdTable');

    function setStatus(msg, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#f66' : '#9f9';
        if (msg) setTimeout(() => statusEl.textContent = '', 5000);
    }

    try {
        const res  = await fetch('/api/admin/commands');
        const cmds = await res.json();

        tableBody.innerHTML = '';

        if (!Array.isArray(cmds) || cmds.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="padding:12px; color:#888; text-align:center;">Noch keine Befehle angelegt.</td></tr>`;
            return;
        }

        cmds.forEach((cmd, idx) => {
            const tr      = document.createElement('tr');
            tr.style.borderBottom = '1px solid #333';
            const aliases = Array.isArray(cmd.aliases) && cmd.aliases.length > 0
                ? `<br><span style="opacity:0.6;font-size:0.85em;">auch: +${cmd.aliases.join(', +')}</span>`
                : '';

            // Rollen-Checkboxen für diese Zeile
            const rowRoleId = `rowRoles_${idx}`;
            const rolesHtml = `
                <div id="${rowRoleId}" style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.85em;">
                    <label style="cursor:pointer;"><input type="checkbox" value="admin"    class="roleCheck"> Admin</label>
                    <label style="cursor:pointer;"><input type="checkbox" value="mod"      class="roleCheck"> MOD</label>
                    <label style="cursor:pointer;"><input type="checkbox" value="vip"      class="roleCheck"> VIP</label>
                    <label style="cursor:pointer;"><input type="checkbox" value="sub"      class="roleCheck"> SUB</label>
                    <label style="cursor:pointer;"><input type="checkbox" value="everyone" class="roleCheck"> Alle</label>
                </div>
            `;

            tr.innerHTML = `
                <td style="padding:8px;">
                    <strong style="color:#9f9;">+${cmd.name}</strong>${aliases}
                </td>
                <td style="padding:8px;">
                    <input type="text" value="${(cmd.response || '').replace(/"/g, '&quot;')}"
                           data-idx="${idx}" data-field="response"
                           style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:240px;">
                </td>
                <td style="padding:8px;">
                    <input type="number" value="${cmd.fd ?? 0}" min="0"
                           data-idx="${idx}" data-field="fd"
                           style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:60px;">
                </td>
                <td style="padding:8px;">
                    <input type="number" value="${cmd.cooldown ?? 0}" min="0"
                           data-idx="${idx}" data-field="cooldown"
                           style="background:#222;border:1px solid #444;color:#eee;padding:4px 8px;border-radius:4px;width:60px;">
                    <span style="opacity:0.6;"> s</span>
                </td>
                <td style="padding:8px;">${rolesHtml}</td>
                <td style="padding:8px;">
                    <button class="saveCmdBtn" data-idx="${idx}"
                            style="background:#6441a5;border:none;color:#eee;padding:4px 8px;border-radius:4px;cursor:pointer;margin-bottom:4px;display:block;">
                        💾 Speichern
                    </button>
                    <button class="deleteCmdBtn" data-idx="${idx}"
                            style="background:var(--danger);border:none;color:#eee;padding:4px 8px;border-radius:4px;cursor:pointer;display:block;">
                        🗑 Löschen
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);

            // Rollen setzen + Checkbox-Logik aktivieren
            setRolesToContainer(rowRoleId, cmd.roles || (cmd.minRole ? [cmd.minRole] : ['everyone']));
            setupRoleCheckboxes(rowRoleId);
        });

        // Speichern
        tableBody.querySelectorAll('.saveCmdBtn').forEach(btn => {
            btn.onclick = async () => {
                const idx    = Number(btn.dataset.idx);
                const rowRoleId = `rowRoles_${idx}`;

                const responseInp = tableBody.querySelector(`input[data-idx="${idx}"][data-field="response"]`);
                const fdInp       = tableBody.querySelector(`input[data-idx="${idx}"][data-field="fd"]`);
                const cooldownInp = tableBody.querySelector(`input[data-idx="${idx}"][data-field="cooldown"]`);

                cmds[idx].response = responseInp?.value || '';
                cmds[idx].fd       = Number(fdInp?.value       || 0);
                cmds[idx].cooldown = Number(cooldownInp?.value  || 0);
                cmds[idx].roles    = getRolesFromContainer(rowRoleId);

                await saveCmds(cmds);
                setStatus(`✅ Befehl "+${cmds[idx].name}" gespeichert!`);
            };
        });

        // Löschen
        tableBody.querySelectorAll('.deleteCmdBtn').forEach(btn => {
            btn.onclick = async () => {
                const idx = Number(btn.dataset.idx);
                if (!confirm(`Befehl "+${cmds[idx].name}" wirklich löschen?`)) return;
                cmds.splice(idx, 1);
                await saveCmds(cmds);
                setStatus('Befehl gelöscht.');
                await loadCmds();
            };
        });

    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="6" style="color:#f66;padding:12px;">Fehler: ${e.message}</td></tr>`;
    }
}

// ── Speichern ──
async function saveCmds(cmds) {
    await fetch('/api/admin/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmds)
    });
}

// ── Neuen Befehl anlegen ──
document.addEventListener('click', async (e) => {
    if (!e.target || e.target.id !== 'addCmdBtn') return;

    const statusEl = document.getElementById('cmdStatus');
    function setStatus(msg, isError = false) {
        if (!statusEl) return;
        statusEl.textContent = msg || '';
        statusEl.style.color = isError ? '#f66' : '#9f9';
        if (msg) setTimeout(() => statusEl.textContent = '', 5000);
    }

    const nameEl     = document.getElementById('cmdName');
    const responseEl = document.getElementById('cmdResponse');
    const aliasesEl  = document.getElementById('cmdAliases');
    const fdEl       = document.getElementById('cmdFD');
    const cooldownEl = document.getElementById('cmdCooldown');

    const name     = (nameEl?.value || '').trim().toLowerCase().replace(/^\+/, '');
    const response = (responseEl?.value || '').trim();
    const aliases  = (aliasesEl?.value || '').split(',').map(a => a.trim().toLowerCase().replace(/^\+/, '')).filter(Boolean);
    const fd       = Number(fdEl?.value       || 0);
    const cooldown = Number(cooldownEl?.value  || 0);
    const roles    = getRolesFromContainer('newCmdRoles');

    if (!name)     { setStatus('Bitte einen Befehlsnamen eingeben.', true); return; }
    if (!response) { setStatus('Bitte einen Antworttext eingeben.', true);  return; }

    try {
        const res  = await fetch('/api/admin/commands');
        const cmds = await res.json();
        const list = Array.isArray(cmds) ? cmds : [];

        if (list.find(c => c.name === name)) {
            setStatus(`Befehl "+${name}" existiert bereits!`, true);
            return;
        }

        list.push({ name, response, aliases, fd, cooldown, roles, count: 0 });
        await saveCmds(list);

        if (nameEl)     nameEl.value     = '';
        if (responseEl) responseEl.value = '';
        if (aliasesEl)  aliasesEl.value  = '';
        if (fdEl)       fdEl.value       = '0';
        if (cooldownEl) cooldownEl.value = '0';

        // Alle Checkboxen zurücksetzen
        document.querySelectorAll('#newCmdRoles input.roleCheck').forEach(c => c.checked = false);

        await loadCmds();
        setStatus(`✅ Befehl "+${name}" angelegt!`);
    } catch (e) {
        setStatus('Fehler: ' + e.message, true);
    }
});
