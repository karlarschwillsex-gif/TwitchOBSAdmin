#!/usr/bin/env bash
set -euo pipefail

# Units schreiben
sudo tee /etc/systemd/system/server.service > /dev/null <<'UNIT'
[Unit]
Description=TwitchOBSAdmin Server
After=network.target

[Service]
Type=simple
User=fynn
WorkingDirectory=/home/fynn/TwitchOBSAdmin
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /home/fynn/TwitchOBSAdmin/server.js
Restart=on-failure
RestartSec=5
StandardOutput=append:/home/fynn/TwitchOBSAdmin/logs/server.log
StandardError=append:/home/fynn/TwitchOBSAdmin/logs/server.log

[Install]
WantedBy=multi-user.target
UNIT

sudo tee /etc/systemd/system/eventsub.service > /dev/null <<'UNIT'
[Unit]
Description=TwitchOBSAdmin EventSub Listener
After=network.target

[Service]
Type=simple
User=fynn
WorkingDirectory=/home/fynn/TwitchOBSAdmin
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /home/fynn/TwitchOBSAdmin/eventsub.js
Restart=on-failure
RestartSec=5
StandardOutput=append:/home/fynn/TwitchOBSAdmin/logs/eventsub.log
StandardError=append:/home/fynn/TwitchOBSAdmin/logs/eventsub.log

[Install]
WantedBy=multi-user.target
UNIT

sudo tee /etc/systemd/system/credits.service > /dev/null <<'UNIT'
[Unit]
Description=Twitch Credits Service
After=network.target

[Service]
Type=simple
User=fynn
WorkingDirectory=/home/fynn/TwitchOBSAdmin
Environment=NODE_ENV=production
Environment=CREDITS_PORT=4000
ExecStart=/usr/bin/node /home/fynn/TwitchOBSAdmin/twitch-credits/index.mjs
Restart=always
RestartSec=5
StandardOutput=append:/home/fynn/TwitchOBSAdmin/logs/credits.log
StandardError=append:/home/fynn/TwitchOBSAdmin/logs/credits.log

[Install]
WantedBy=multi-user.target
UNIT

sudo tee /etc/systemd/system/bot.service > /dev/null <<'UNIT'
[Unit]
Description=Twitch Bot
After=network.target

[Service]
Type=simple
User=fynn
WorkingDirectory=/home/fynn/TwitchOBSAdmin
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /home/fynn/TwitchOBSAdmin/bot.js
Restart=on-failure
RestartSec=5
StandardOutput=append:/home/fynn/TwitchOBSAdmin/logs/bot.log
StandardError=append:/home/fynn/TwitchOBSAdmin/logs/bot.log

[Install]
WantedBy=multi-user.target
UNIT

# Rechte setzen
sudo chown root:root /etc/systemd/system/*.service
sudo chmod 644 /etc/systemd/system/*.service

# systemd neu laden und Dienste aktivieren
sudo systemctl daemon-reload
sudo systemctl enable --now server.service eventsub.service credits.service bot.service

echo "Units installiert und gestartet."
