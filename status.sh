#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "=== Prozessstatus ==="
pgrep -af "eventsub.js" || echo "eventsub.js: nicht laufend"
pgrep -af "bot.js" || echo "bot.js: nicht laufend"
pgrep -af "server.js" || echo "server.js: nicht laufend"
pgrep -af "index.mjs" || echo "credits/index.mjs: nicht laufend"
pgrep -af "electron" || echo "Electron: nicht laufend"

echo
echo "=== Healthchecks ==="

# Backend (Port 3000)
if curl -sSf "http://localhost:${PORT:-3000}/" >/dev/null 2>&1; then
  echo "Backend (http://localhost:${PORT:-3000}) : OK"
else
  echo "Backend (http://localhost:${PORT:-3000}) : NICHT ERREICHBAR"
fi

# EventSub (Port 8080)
if nc -z localhost "${EVENTSUB_PORT:-8080}" >/dev/null 2>&1; then
  echo "EventSub Listener (Port ${EVENTSUB_PORT:-8080}) : OK"
else
  echo "EventSub Listener (Port ${EVENTSUB_PORT:-8080}) : NICHT ERREICHBAR"
fi

