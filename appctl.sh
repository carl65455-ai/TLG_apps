#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"
WEB_PID_FILE="$PID_DIR/web.pid"
API_PID_FILE="$PID_DIR/api.pid"

mkdir -p "$PID_DIR"

compose() {
  # Prefer the Docker CLI plugin (`docker compose`) so we don't depend on snap-packaged `docker-compose`.
  docker compose "$@"
}

load_env() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    # shellcheck disable=SC1090
    source "$ROOT_DIR/.env"
  fi

  local api_port="${API_PORT:-4000}"
  local web_port="${WEB_PORT:-5173}"
  local use_converter="${USE_CONVERTER:-1}"

  export PORT="${PORT:-$api_port}"
  export WEB_PORT="${WEB_PORT:-$web_port}"
  export USE_CONVERTER="${USE_CONVERTER:-$use_converter}"

  if [[ -n "${LAN_IP:-}" ]]; then
    export CORS_ORIGIN="${CORS_ORIGIN:-http://$LAN_IP:$web_port}"
    export CONVERTER_URL="${CONVERTER_URL:-http://$LAN_IP:7070}"
    export VITE_API_BASE="${VITE_API_BASE:-http://$LAN_IP:$api_port}"
  fi
}

start_bg() {
  # Start a command as its own process group so stop() can reliably terminate it.
  # Usage: start_bg <pid_file> <log_file> <command...>
  local pid_file="$1"
  local log_file="$2"
  shift 2

  rm -f "$pid_file"
  setsid "$@" >"$log_file" 2>&1 &
  echo $! >"$pid_file"
}

stop_bg() {
  # Stop a process group started by start_bg().
  local pid_file="$1"

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  rm -f "$pid_file"

  if [[ -z "$pid" ]]; then
    return 0
  fi

  if ps -p "$pid" >/dev/null 2>&1; then
    kill -- "-$pid" 2>/dev/null || true
    # Give it a moment to exit, then force kill if needed.
    sleep 0.8
    if ps -p "$pid" >/dev/null 2>&1; then
      kill -9 -- "-$pid" 2>/dev/null || true
    fi
  fi
}

start() {
  load_env
  if [[ "${USE_CONVERTER:-1}" == "1" ]]; then
    echo "Starting converter (docker compose)..."
    (cd "$ROOT_DIR" && compose up -d)
  else
    echo "Skipping converter (USE_CONVERTER=0)"
  fi

  echo "Starting API..."
  start_bg "$API_PID_FILE" "$PID_DIR/api.log" bash -lc "cd \"$ROOT_DIR\" && npm run dev:api"

  echo "Starting Web..."
  start_bg "$WEB_PID_FILE" "$PID_DIR/web.log" bash -lc "cd \"$ROOT_DIR\" && npm run dev:web"

  echo "Started. Logs in $PID_DIR"
}

stop() {
  set +e
  echo "Stopping web..."
  stop_bg "$WEB_PID_FILE"

  echo "Stopping API..."
  stop_bg "$API_PID_FILE"

  load_env
  if [[ "${USE_CONVERTER:-1}" == "1" ]]; then
    echo "Stopping converter (docker compose)..."
    (cd "$ROOT_DIR" && compose down)
  else
    echo "Skipping converter stop (USE_CONVERTER=0)"
  fi

  echo "Stopped."
}

status() {
  load_env
  echo "Web:"
  if [[ -f "$WEB_PID_FILE" ]] && ps -p "$(cat "$WEB_PID_FILE")" >/dev/null 2>&1; then
    echo "  running (pid $(cat "$WEB_PID_FILE"))"
  else
    echo "  stopped"
  fi

  echo "API:"
  if [[ -f "$API_PID_FILE" ]] && ps -p "$(cat "$API_PID_FILE")" >/dev/null 2>&1; then
    echo "  running (pid $(cat "$API_PID_FILE"))"
  else
    echo "  stopped"
  fi

  echo "Converter:"
  if [[ "${USE_CONVERTER:-1}" != "1" ]]; then
    echo "  disabled (USE_CONVERTER=0)"
    return 0
  fi

  if compose ps -q converter >/dev/null 2>&1; then
    if [[ -n "$(compose ps -q converter)" ]]; then
      echo "  running"
    else
      echo "  stopped"
    fi
  else
    echo "  stopped"
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
 esac
