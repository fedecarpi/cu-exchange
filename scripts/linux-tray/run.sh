#!/usr/bin/env bash
# Linux tray harness: runs cu-exchange on a virtual Linux desktop (Docker) and exposes CDP on localhost:9222
# so the Electron MCP can drive the renderer, while the native tray is driven with xdotool.
#
#   run.sh up [sni|xembed] [top|bottom]   build the image and start the desktop + app
#   run.sh shot [file.png]                screenshot of the whole X display
#   run.sh click-tray [1|3]               click the tray icon (1 = left, 3 = right)
#   run.sh click X Y [button]             click anywhere on the display
#   run.sh windows                        visible cu-exchange windows with geometry
#   run.sh logs [lines]                   main process output
#   run.sh app start|stop                 restart only the app
#   run.sh deb                            build the .deb, install it and run the installed app
#   run.sh sh                             shell inside the container
#   run.sh down                           stop and remove the container
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE=cu-exchange-linux-tray
NAME=cu-exchange-linux-tray
SCREEN_W=1440
SCREEN_H=900

in_container() { docker exec "$NAME" bash -c "source /tmp/dbus.env; $*"; }

tray_icon_position() {
  local mode pos
  mode="$(docker exec "$NAME" printenv TRAY_MODE)"
  pos="$(docker exec "$NAME" printenv PANEL_POS)"
  local y=14
  [ "$pos" = "bottom" ] && y=$((SCREEN_H - 14))
  if [ "$mode" = "xembed" ]; then
    echo "$((SCREEN_W - 13)) $y"
  else
    echo "$((SCREEN_W - 16)) $y"
  fi
}

case "${1:-}" in
  up)
    mode="${2:-sni}"
    pos="${3:-top}"
    docker build -q -t "$IMAGE" "$ROOT/scripts/linux-tray" >/dev/null
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" --shm-size 1g \
      -e TRAY_MODE="$mode" -e PANEL_POS="$pos" \
      -p 127.0.0.1:9222:9223 \
      -v "$ROOT":/src:ro \
      -v cu-exchange-linux-nm:/work/node_modules \
      -v cu-exchange-linux-app-nm:/work/app/node_modules \
      -v cu-exchange-linux-cache:/home/node/.cache \
      "$IMAGE" >/dev/null
    for _ in $(seq 1 600); do
      if docker logs "$NAME" 2>&1 | grep -q '\[linux-tray\] Ready'; then
        docker logs "$NAME" 2>&1 | grep '\[linux-tray\]'
        exit 0
      fi
      if ! docker ps -q -f name="^${NAME}$" | grep -q .; then
        docker logs "$NAME" 2>&1 | tail -40
        exit 1
      fi
      sleep 2
    done
    echo "Timed out waiting for the desktop" >&2
    exit 1
    ;;
  shot)
    out="${2:-$ROOT/tmp/linux-tray.png}"
    mkdir -p "$(dirname "$out")"
    in_container "import -window root /tmp/shot.png"
    docker cp "$NAME":/tmp/shot.png "$out" >/dev/null
    echo "$out"
    ;;
  click-tray)
    read -r x y < <(tray_icon_position)
    in_container "xdotool mousemove $x $y click ${2:-1}"
    echo "clicked tray at $x,$y (button ${2:-1})"
    ;;
  click)
    in_container "xdotool mousemove $2 $3 click ${4:-1}"
    ;;
  windows)
    in_container 'for w in $(xdotool search --onlyvisible --class cu-exchange 2>/dev/null); do
      echo "$w \"$(xdotool getwindowname $w)\" $(xdotool getwindowgeometry $w | tr "\n" " ")"; done'
    ;;
  logs)
    in_container "tail -n ${2:-80} /tmp/app.log"
    ;;
  app)
    in_container "/usr/local/bin/app.sh ${2:-start}"
    ;;
  deb)
    in_container "cd /work && npx electron-builder build --linux deb --arm64 --publish=never >/tmp/deb.log 2>&1 || { tail -40 /tmp/deb.log; exit 1; }"
    docker exec -u root "$NAME" bash -c 'apt-get update -qq && apt-get install -y -qq /work/release/*.deb >/tmp/deb-install.log 2>&1 || { tail -20 /tmp/deb-install.log; exit 1; }'
    in_container "/usr/local/bin/app.sh stop && APP_MODE=deb /usr/local/bin/app.sh start"
    ;;
  sh)
    docker exec -it "$NAME" bash
    ;;
  down)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    ;;
  *)
    sed -n '2,15p' "$0"
    exit 1
    ;;
esac
