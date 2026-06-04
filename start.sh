#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-local}"
BACKEND_HOST="127.0.0.1"
FRONTEND_HOST="127.0.0.1"
DISPLAY_HOST="127.0.0.1"

if [[ "$MODE" == "--lan" || "$MODE" == "lan" ]]; then
  BACKEND_HOST="0.0.0.0"
  FRONTEND_HOST="0.0.0.0"
  DISPLAY_HOST="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo localhost)"
fi

cleanup_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
  fi
}

cleanup_children() {
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
}

trap cleanup_children EXIT INT TERM

cleanup_port 5003
cleanup_port 5173
sleep 1

cd "$ROOT_DIR/backend"
NODE_ENV=development HOST="$BACKEND_HOST" APP_URL="http://$DISPLAY_HOST:5173" npm start &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

cd "$ROOT_DIR/frontend"
npm run dev -- --host "$FRONTEND_HOST" --port 5173 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "Backend:  http://$DISPLAY_HOST:5003"
echo "Frontend: http://$DISPLAY_HOST:5173"
echo ""
echo "Use './start.sh --lan' when another PC on the same network needs access."
echo "Press Ctrl+C to stop both servers"

wait
