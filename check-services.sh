#!/usr/bin/env bash
services=(server eventsub credits bot)
for s in "${services[@]}"; do
  if ! systemctl is-active --quiet "${s}.service"; then
    echo "$(date) - ${s} down, restarting" >> /home/fynn/TwitchOBSAdmin/logs/health.log
    sudo systemctl restart "${s}.service"
  fi
done
