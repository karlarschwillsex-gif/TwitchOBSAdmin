const express = require('express');
const router = express.Router();
const { getVirtualCamFilters, connectObs } = require('../obs-connection');

// OBS-Filter auslesen
router.get('/', async (req, res) => {
  try {
    await connectObs();
    const filters = await getVirtualCamFilters();
    res.json({ ok: true, filters });
  } catch (err) {
    console.error('[API] OBS-Filter Fehler:', err);
    res.json({ ok: false, filters: [] });
  }
});

module.exports = router;
