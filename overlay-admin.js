document.addEventListener('DOMContentLoaded', () => {

  const els = {
    obsFilterName: document.getElementById('obsFilterName'),
    newFilterCost: document.getElementById('newFilterCost'),
    newFilterDuration: document.getElementById('newFilterDuration'),
    addObsFilterBtn: document.getElementById('addObsFilterBtn'),

    camFilterBody: document.getElementById('camFilterBody'),
    saveCamFiltersBtn: document.getElementById('saveCamFiltersBtn'),

    bannerPreview: document.getElementById('bannerPreview'),
    bannerUpload: document.getElementById('bannerUpload'),
    saveBannerBtn: document.getElementById('saveBannerBtn'),
    deleteBannerBtn: document.getElementById('deleteBannerBtn'),

    status: document.getElementById('status')
  };

  function setStatus(msg, isError = false) {
    els.status.textContent = msg;
    els.status.style.color = isError ? '#f66' : '#9f9';
    if (msg) setTimeout(() => els.status.textContent = '', 3000);
  }

  async function loadCamFilters() {
    try {
      const res = await fetch('/api/admin/camfilter-settings');
      const list = await res.json();

      els.camFilterBody.innerHTML = '';

      (list || []).forEach((f, idx) => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
          <td>${f.filterName}</td>
          <td>—</td>
          <td><input type="number" value="${f.cost}" data-index="${idx}" data-field="cost" style="width:70px;"></td>
          <td><input type="number" value="${f.duration}" data-index="${idx}" data-field="duration" style="width:70px;"></td>
          <td>${f.filterName}</td>
          <td><button class="deleteBtn" data-index="${idx}">X</button></td>
        `;

        els.camFilterBody.appendChild(tr);
      });

      els.camFilterBody.querySelectorAll('.deleteBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = Number(btn.dataset.index);
          const current = await (await fetch('/api/admin/camfilter-settings')).json();
          current.splice(idx, 1);

          await fetch('/api/admin/camfilter-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(current)
          });

          loadCamFilters();
        });
      });

    } catch (err) {
      console.error(err);
      setStatus('Camfilter konnten nicht geladen werden', true);
    }
  }

  async function saveCamFilters() {
    try {
      const res = await fetch('/api/admin/camfilter-settings');
      const list = await res.json();

      const inputs = els.camFilterBody.querySelectorAll('input');

      inputs.forEach(inp => {
        const idx = Number(inp.dataset.index);
        const field = inp.dataset.field;
        list[idx][field] = Number(inp.value);
      });

      await fetch('/api/admin/camfilter-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(list)
      });

      setStatus('Camfilter gespeichert');
      loadCamFilters();

    } catch (err) {
      console.error(err);
      setStatus('Fehler beim Speichern der Camfilter', true);
    }
  }

  async function addObsFilter() {
    const filterName = els.obsFilterName.value.trim();
    const cost = Number(els.newFilterCost.value);
    const duration = Number(els.newFilterDuration.value);

    if (!filterName) {
      setStatus('Bitte einen Filternamen eingeben', true);
      return;
    }

    try {
      const res = await fetch('/api/admin/camfilter-settings/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterName, cost, duration })
      });

      const data = await res.json();
      if (!data.ok) {
        setStatus('Filter konnte nicht hinzugefügt werden', true);
        return;
      }

      setStatus('Filter hinzugefügt');
      els.obsFilterName.value = '';
      loadCamFilters();

    } catch (err) {
      console.error(err);
      setStatus('Fehler beim Hinzufügen', true);
    }
  }

  async function saveBanner() {
    const file = els.bannerUpload.files[0];
    if (!file) return setStatus('Keine Datei ausgewählt', true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await fetch('/api/admin/banner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: reader.result })
        });

        setStatus('Banner gespeichert');
        els.bannerPreview.src = '/banner/banner.png?' + Date.now();

      } catch (err) {
        console.error(err);
        setStatus('Fehler beim Speichern des Banners', true);
      }
    };

    reader.readAsDataURL(file);
  }

  async function deleteBanner() {
    try {
      await fetch('/api/admin/banner', { method: 'DELETE' });
      setStatus('Banner gelöscht');
      els.bannerPreview.src = '';
    } catch (err) {
      console.error(err);
      setStatus('Fehler beim Löschen des Banners', true);
    }
  }

  els.addObsFilterBtn.addEventListener('click', addObsFilter);
  els.saveCamFiltersBtn.addEventListener('click', saveCamFilters);
  els.saveBannerBtn.addEventListener('click', saveBanner);
  els.deleteBannerBtn.addEventListener('click', deleteBanner);

  loadCamFilters();
});
