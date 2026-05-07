FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:1

RUN apt-get update && apt-get install -y \
    xvfb x11vnc novnc websockify fluxbox dbus-x11 \
    pulseaudio alsa-utils libasound2 libasound2-plugins libdbus-glib-1-2 curl \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libgtk-3-0 libgbm1 libxss1 fonts-liberation ffmpeg pulseaudio-utils \
    pulseaudio-module-bluetooth \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x /app/start.sh

# Настройка DBus
RUN mkdir -p /var/run/dbus && chown messagebus:messagebus /var/run/dbus

EXPOSE 10000
CMD ["/app/start.sh"]
