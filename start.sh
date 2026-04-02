#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

LOGDIR="$SCRIPT_DIR/logs"
PIDDIR="$LOGDIR/pids"
mkdir -p "$LOGDIR" "$PIDDIR"

# Alte PID-Dateien löschen
rm -f "$PIDDIR"/*.pid

# Helper
write_pid() {
  local name="$1"; local pid="$2"
  echo "$pid" > "$PIDDIR/$name.pid"
}

read_env_file() {
  local envfile="$1"
  if [[ -f "$envfile" ]]; then
    set -o allexport
    eval "$(grep -v '^\s*#' "$envfile" | sed '/^\s*$/d' | awk -F= '{ gsub(/"/,"\\\"",$2); printf("export %s=\"%s\"\n",$1,$2) }')"
    set +o allexport
  fi
}

echo "=== START $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===" | tee -a "$LOGDIR/start.log"

# Load root .env
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  echo "Lade .env" | tee -a "$LOGDIR/start.log"
  read_env_file "$SCRIPT_DIR/.env"
else
  echo "WARNUNG: Root .env nicht gefunden." | tee -a "$LOGDIR/start.log"
fi

# Starte Cloudflare Tunnel
echo "Starte Cloudflare Tunnel..." | tee -a "$LOGDIR/start.log"
nohup cloudflared tunnel run acdf5827-bd64-4be3-be18-d11a9dbee3dd > "$LOGDIR/cloudflared.log" 2>&1 &
CLOUDFLARED_PID=$!
write_pid "cloudflared" "$CLOUDFLARED_PID"
sleep 3
echo "Cloudflare Tunnel läuft (PID $CLOUDFLARED_PID)" | tee -a "$LOGDIR/start.log"

# Basic checks
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "ERROR: node nicht gefunden im PATH." | tee -a "$LOGDIR/start.log"
  exit 1
fi

PORT="${PORT:-3000}"
EVENTSUB_PORT="${EVENTSUB_PORT:-8080}"
CREDITS_DIR="$SCRIPT_DIR/public/twitch-credits"
ELECTRON_DIR="$SCRIPT_DIR/electron-app"

# Start server
echo "Starte server.js..." | tee -a "$LOGDIR/start.log"
nohup "$NODE_BIN" server.js > "$LOGDIR/server.log" 2>&1 &
SERVER_PID=$!
write_pid "server" "$SERVER_PID"
sleep 2

# Start eventsub
echo "Starte eventsub.js..." | tee -a "$LOGDIR/start.log"
nohup "$NODE_BIN" eventsub.js > "$LOGDIR/eventsub.log" 2>&1 &
EVENTSUB_PID=$!
write_pid "eventsub" "$EVENTSUB_PID"
sleep 2

# Start bot
echo "Starte bot.js..." | tee -a "$LOGDIR/start.log"
nohup "$NODE_BIN" bot.js > "$LOGDIR/bot.log" 2>&1 &
BOT_PID=$!
write_pid "bot" "$BOT_PID"
sleep 2

# Start credits (optional)
CREDITS_PID=""
if [[ -d "$CREDITS_DIR" ]]; then
  if [[ -f "$CREDITS_DIR/.env" ]]; then
    echo "Lade twitch-credits/.env" | tee -a "$LOGDIR/start.log"
    read_env_file "$CREDITS_DIR/.env"
  fi
  echo "Starte twitch-credits/index.mjs..." | tee -a "$LOGDIR/start.log"
  nohup "$NODE_BIN" "$CREDITS_DIR/index.mjs" > "$LOGDIR/credits.log" 2>&1 &
  CREDITS_PID=$!
  write_pid "credits" "$CREDITS_PID"
  sleep 1
else
  echo "WARNUNG: twitch-credits Verzeichnis nicht gefunden, übersprungen." | tee -a "$LOGDIR/start.log"
fi

# Prüfe Prozesse (nur warnen, nicht abbrechen)
check_pid_alive() {
  local pidfile="$1"; local name="$2"; local logfile="$3"
  if [[ -f "$pidfile" ]]; then
    local pid; pid="$(cat "$pidfile")"
    if ps -p "$pid" >/dev/null 2>&1; then
      echo "$name läuft (PID $pid)" | tee -a "$LOGDIR/start.log"
      return 0
    else
      echo "FEHLER: $name nicht mehr laufend. Log: $logfile" | tee -a "$LOGDIR/start.log"
      tail -n 20 "$logfile" 2>/dev/null || true
      return 1
    fi
  else
    echo "FEHLER: PID-Datei für $name fehlt ($pidfile)" | tee -a "$LOGDIR/start.log"
    return 1
  fi
}

check_pid_alive "$PIDDIR/server.pid"   "server.js"   "$LOGDIR/server.log"   || true
check_pid_alive "$PIDDIR/eventsub.pid" "eventsub.js" "$LOGDIR/eventsub.log" || true
check_pid_alive "$PIDDIR/bot.pid"      "bot.js"      "$LOGDIR/bot.log"      || true
if [[ -n "$CREDITS_PID" ]]; then
  check_pid_alive "$PIDDIR/credits.pid" "credits/index.mjs" "$LOGDIR/credits.log" || true
fi

# Warte bis Backend erreichbar (max 30 Sekunden)
echo "Warte auf Backend (http://localhost:$PORT)..." | tee -a "$LOGDIR/start.log"
WAIT=0
until curl -sSf "http://localhost:$PORT/" >/dev/null 2>&1; do
  sleep 1
  WAIT=$((WAIT + 1))
  if [[ $WAIT -ge 30 ]]; then
    echo "WARNUNG: Backend nach 30s nicht erreichbar — starte Electron trotzdem." | tee -a "$LOGDIR/start.log"
    break
  fi
done
echo "Backend erreichbar." | tee -a "$LOGDIR/start.log"

# Start Electron
if [[ -d "$ELECTRON_DIR" ]]; then
  echo "Starte Electron-App..." | tee -a "$LOGDIR/start.log"
  cd "$ELECTRON_DIR"

  npm start > "$LOGDIR/electron.log" 2>&1 &
  ELECTRON_PID=$!
  write_pid "electron" "$ELECTRON_PID"
  echo "Electron läuft (PID $ELECTRON_PID)" | tee -a "$LOGDIR/start.log"

  sleep 1
  check_pid_alive "$PIDDIR/electron.pid" "electron" "$LOGDIR/electron.log" || true
else
  echo "Electron-App Verzeichnis nicht gefunden, übersprungen." | tee -a "$LOGDIR/start.log"
fi

echo "=== START abgeschlossen ===" | tee -a "$LOGDIR/start.log"
echo "PIDs:" | tee -a "$LOGDIR/start.log"
for f in "$PIDDIR"/*.pid; do
  [[ -f "$f" ]] || continue
  name="$(basename "$f" .pid)"
  pid="$(cat "$f")"
  echo "$name: $pid" | tee -a "$LOGDIR/start.log"
done
