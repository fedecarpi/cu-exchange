FROM node:18-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb xfwm4 xfce4-panel xfconf trayer \
      dbus-x11 at-spi2-core xdotool x11-utils x11-xserver-utils imagemagick socat rsync procps \
      libgtk-3-0 libnss3 libasound2 libgbm1 libxss1 libxtst6 libdrm2 libayatana-appindicator3-1 \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# electron-builder only bundles an x86 fpm; packaging the .deb on arm64 needs the system one.
RUN apt-get update && apt-get install -y --no-install-recommends ruby binutils \
    && gem install fpm --no-document \
    && rm -rf /var/lib/apt/lists/*
ENV USE_SYSTEM_FPM=true

COPY entrypoint.sh app.sh /usr/local/bin/
COPY xfce4-panel.xml /opt/linux-tray/xfce4-panel.xml
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/app.sh \
    && mkdir -p /work/node_modules /work/app/node_modules /home/node/.cache \
    && chown -R node:node /work /home/node/.cache

ENV DISPLAY=:99
USER node
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
