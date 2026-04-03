// /home/fynn/TwitchOBSAdmin/chatterinfo/server.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path    = require('path');
const fetch   = require('node-fetch');

const PORT = 3001;
const MAIN = 'http://localhost:' + (process.env.PORT || 3000);
const app  = express();

// API Requests an Hauptserver weiterleiten — VOR static!
app.use('/api', function(req, res) {
  fetch(MAIN + '/api' + req.url)
    .then(function(r) { return r.json(); })
    .then(function(data) { res.json(data); })
    .catch(function(e) { res.status(500).json({ error: e.message }); });
});

// Statische Dateien aus chatterinfo/
app.use(express.static(path.join(__dirname)));

// Fallback → index.html
app.use(function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function() {
  console.log('[chatterinfo] Server läuft auf http://localhost:' + PORT);
});
