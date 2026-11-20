#!/usr/bin/env bash
# Boots a virtual Linux desktop with a system tray and runs cu-exchange in it.
#   TRAY_MODE=sni     xfce4-panel systray plugin (StatusNotifierItem over D-Bus, like GNOME AppIndicator / KDE)
#   TRAY_MODE=xembed  trayer (legacy XEmbed tray, no StatusNotifierWatcher on the bus)
#   PANEL_POS=top|bottom
set -euo pipefail

TRAY_MODE="${TRAY_MODE:-sni}"
PANEL_POS="${PANEL_POS:-top}"
SCREEN_W=1440
SCREEN_H=900

log() { echo "[linux-tray] $*"; }

prepare_sources() {
  log "Syncing sources into /work"
  rsync -a --delete \
    --exclude node_modules --exclude app/node_modules --exclude dist --exclude release \
    --exclude .git --exclude .angular --exclude 'app/main.js' --exclude 'app/tray-linux.js' --exclude 'app/providers/*.js' --exclude '*.js.map' \
    /src/ /work/
  if [ ! -x node_modules/.bin/electron ] || ! cmp -s package-lock.json node_modules/.package-lock.stamp; then
    log "Installing Linux dependencies"
    npm ci --no-audit --no-fund
    cp package-lock.json node_modules/.package-lock.stamp
  fi
  if [ ! -d app/node_modules/menubar ] || ! cmp -s app/package-lock.json app/node_modules/.package-lock.stamp; then
    npm ci --no-audit --no-fund --prefix app
    cp app/package-lock.json app/node_modules/.package-lock.stamp
  fi
  log "Building renderer and main process"
  npm run build:prod >/tmp/build.log 2>&1 || { tail -40 /tmp/build.log; exit 1; }
}

start_desktop() {
  log "Starting Xvfb ${SCREEN_W}x${SCREEN_H}"
  Xvfb :99 -screen 0 "${SCREEN_W}x${SCREEN_H}x24" -ac -nolisten tcp >/tmp/xvfb.log 2>&1 &
  for _ in $(seq 1 50); do xdpyinfo >/dev/null 2>&1 && break; sleep 0.1; done

  eval "$(dbus-launch --sh-syntax)"
  echo "export DBUS_SESSION_BUS_ADDRESS='${DBUS_SESSION_BUS_ADDRESS}'" > /tmp/dbus.env
  echo "export DISPLAY=:99" >> /tmp/dbus.env

  xsetroot -solid '#1f2430' 2>/dev/null || true
  xfwm4 --compositor=off >/tmp/xfwm4.log 2>&1 &

  if [ "$TRAY_MODE" = "xembed" ]; then
    log "Starting trayer (XEmbed) at $PANEL_POS"
    trayer --edge "$PANEL_POS" --align right --widthtype request --height 28 --iconspacing 2 \
      --SetDockType true --SetPartialStrut true --transparent false --tint 0x303030 >/tmp/tray.log 2>&1 &
  else
    local position="p=6;x=$((SCREEN_W / 2));y=14"
    [ "$PANEL_POS" = "bottom" ] && position="p=8;x=$((SCREEN_W / 2));y=$((SCREEN_H - 14))"
    mkdir -p ~/.config/xfce4/xfconf/xfce-perchannel-xml
    sed "s/__POSITION__/${position}/" /opt/linux-tray/xfce4-panel.xml \
      > ~/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml
    log "Starting xfce4-panel systray (SNI) at $PANEL_POS"
    xfce4-panel >/tmp/tray.log 2>&1 &
  fi
  sleep 2
}

start_cdp_proxy() {
  # Chromium only binds CDP to 127.0.0.1; expose it on 9223 so the host can map it to localhost:9222.
  socat TCP-LISTEN:9223,fork,reuseaddr TCP:127.0.0.1:9222 >/tmp/socat.log 2>&1 &
}

prepare_sources
start_desktop
start_cdp_proxy
/usr/local/bin/app.sh start
log "Ready (TRAY_MODE=$TRAY_MODE PANEL_POS=$PANEL_POS)"
sleep infinity
