#!/usr/bin/env bash
tar -czf /home/fynn/backups/twitchobsadmin-config-$(date +%F-%H%M).tar.gz /home/fynn/TwitchOBSAdmin --exclude='/home/fynn/TwitchOBSAdmin/node_modules'
find /home/fynn/backups -type f -mtime +30 -delete
