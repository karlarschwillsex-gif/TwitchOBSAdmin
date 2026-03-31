#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "Beende Twitch OBS Admin Panel Prozesse..."

PROCESSES=(
  "eventsub.js"
  "bot.js"
  "server.js"
  "index.mjs"
  "electron"
  "Electron"
)

# sanft beenden
for PROC in "${PROCESSES[@]}"; do
  PIDS=$(pgrep -f "$PROC" || true)
  if [[ -n "$PIDS" ]]; then
    echo "Beende $PROC (PID: $PIDS)..."
    kill $PIDS 2>/dev/null || true
  fi
done

sleep 2

# hartnäckige Prozesse killen
for PROC in "${PROCESSES[@]}"; do
  PIDS=$(pgrep -f "$PROC" || true)
  if [[ -n "$PIDS" ]]; then
    echo "$PROC reagiert nicht – erzwinge Beenden (PID: $PIDS)..."
    kill -9 $PIDS 2>/dev/null || true
  fi
done

echo "Stop abgeschlossen."

