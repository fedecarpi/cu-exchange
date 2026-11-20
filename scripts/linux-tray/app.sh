#!/usr/bin/env bash
# Starts or stops cu-exchange inside the linux-tray container.
#   APP_MODE=dev  runs /work with the Linux Electron from node_modules (default)
#   APP_MODE=deb  runs the installed package from /opt/cu-exchange
set -euo pipefail
source /tmp/dbus.env

APP_MODE="${APP_MODE:-$(cat /tmp/app-mode 2>/dev/null || echo dev)}"
FLAGS=(--no-sandbox --disable-gpu --remote-debugging-port=9222)

case "${1:-start}" in
  start)
    echo "$APP_MODE" > /tmp/app-mode
    if [ "$APP_MODE" = "deb" ]; then
      nohup /opt/cu-exchange/cu-exchange "${FLAGS[@]}" >/tmp/app.log 2>&1 &
    else
      cd /work
      nohup ./node_modules/.bin/electron . "${FLAGS[@]}" >/tmp/app.log 2>&1 &
    fi
    for _ in $(seq 1 100); do
      curl -fs http://127.0.0.1:9222/json/version >/dev/null 2>&1 && break
      sleep 0.2
    done
    echo "cu-exchange started ($APP_MODE)"
    ;;
  stop)
    pkill -f 'electron \. --no-sandbox' 2>/dev/null || true
    pkill -f '/opt/cu-exchange/cu-exchange' 2>/dev/null || true
    sleep 1
    echo "cu-exchange stopped"
    ;;
  *)
    echo "usage: app.sh start|stop" >&2
    exit 1
    ;;
esac
