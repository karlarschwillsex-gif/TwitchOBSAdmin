#!/usr/bin/env bash
set -e
cd /home/fynn/TwitchOBSAdmin
git pull origin main
npm ci --production
sudo systemctl restart server.service eventsub.service credits.service bot.service
