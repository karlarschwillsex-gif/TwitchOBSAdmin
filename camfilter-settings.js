const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const filePath = path.join(__dirname, '../../data/camfilters.json');

// Liste holen
router.get('/', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (err) {
    console.error('[API] Camfilter lesen Fehler:', err);
    res.json([]);
  }
});

// Liste speichern
router.post('/', (req, res) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] Camfilter speichern Fehler:', err);
    res.json({ ok: false });
  }
});

// Neuen Filter hinzufügen
router.post('/add', (req, res) => {
  try {
    const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const { fileBase, cost, duration } = req.body;

    list.push({
      name: fileBase,
      file: fileBase + '.shader',
      cost: Number(cost) || 0,
      duration: Number(duration) || 5,
      command: '!'+fileBase
    });

    fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] Camfilter add Fehler:', err);
    res.json({ ok: false });
  }
});

module.exports = router;
