#!/bin/bash
export DISPLAY=:1
# Переменная для связи с DBus
export DBUS_SESSION_BUS_ADDRESS=$(dbus-daemon --config-file=/usr/share/dbus-1/system.conf --print-address --fork)

# Указываем PulseAudio сервер для всех приложений
export PULSE_SERVER=unix:/tmp/runtime-root/pulse/native
export PULSE_RUNTIME_PATH=/tmp/runtime-root/pulse

# Очистка локов
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1

echo "Starting Xvfb..."
Xvfb :1 -screen 0 1280x800x24 &

sleep 2

echo "Starting PulseAudio..."
# Создаем необходимых пользователей и группы
groupadd --system pulse 2>/dev/null || true
useradd --system -g pulse -d /var/run/pulse pulse 2>/dev/null || true
groupadd --system pulse-access 2>/dev/null || true
usermod -aG pulse-access root

# Настройка директорий
mkdir -p /var/run/pulse /var/lib/pulse /root/.config/pulse
chown -R pulse:pulse /var/run/pulse /var/lib/pulse
chmod 777 /var/run/pulse

# Создаем системный конфиг для PulseAudio
cat > /etc/pulse/system.pa << 'EOF'
load-module module-native-protocol-unix auth-anonymous=1 socket=/var/run/pulse/native
load-module module-null-sink sink_name=remote sink_properties=device.description="Virtual_Audio_Sink"
load-module module-always-sink
load-module module-rescue-streams
#load-module module-suspend-on-idle
set-default-sink remote
EOF

# Запускаем PulseAudio в системном режиме
pulseaudio --system --daemonize --disallow-exit --disallow-module-loading=0 --realtime=no

sleep 2

# Глобально объявляем сервер звука для всех последующих процессов (включая Electron)
export PULSE_SERVER=unix:/var/run/pulse/native

# Выкручиваем громкость на 100% и снимаем Mute
pactl set-sink-mute @DEFAULT_SINK@ false 2>/dev/null || true
pactl set-sink-volume @DEFAULT_SINK@ 100% 2>/dev/null || true

echo "Starting DBus..."
mkdir -p /var/run/dbus
rm -f /var/run/dbus/pid
dbus-uuidgen --ensure
dbus-daemon --system --fork

echo "Starting window manager and Electron..."
# Запускаем fluxbox и electron в рамках одной dbus-сессии
export $(dbus-launch)
fluxbox &

sleep 2

echo "Starting Electron App..."
npm start &

sleep 2

echo "Starting Audio Streamer..."
node /app/audio-server.js &

echo "Injecting audio player into noVNC..."
# Проверяем где находится noVNC
NOVNC_HTML=$(find /usr/share/novnc -name "vnc.html" 2>/dev/null | head -1)
if [ -z "$NOVNC_HTML" ]; then
    NOVNC_HTML=$(find /usr/share -name "vnc.html" 2>/dev/null | head -1)
fi

if [ -n "$NOVNC_HTML" ]; then
    echo "Found noVNC at: $NOVNC_HTML"
    # Создаем бэкап
    cp "$NOVNC_HTML" "${NOVNC_HTML}.bak" 2>/dev/null || true
    # Вставляем аудио плеер и скрипт автозапуска перед </body>
    sed -i '/<\/body>/i\<audio id="audiostream" controls style="position:fixed;bottom:10px;right:10px;z-index:9999;background:#fff;border-radius:5px;padding:5px;" src="/audio/"></audio><script>(function(){var a=document.getElementById("audiostream");a.load();a.muted=true;var p=a.play();if(p)p.then(function(){a.muted=false;}).catch(function(){var e=["click","mousedown","touchstart","keydown"],h=function(){a.muted=false;a.play();e.forEach(function(x){document.removeEventListener(x,h);});};e.forEach(function(x){document.addEventListener(x,h,{once:true});});});})();</script>' "$NOVNC_HTML" || true
else
    echo "WARNING: noVNC HTML not found, skipping audio injection"
fi

echo "Starting VNC & noVNC..."
# x11vnc на 5900 (добавляем -noxdamage для стабильности в Docker)
x11vnc -display :1 -nopw -forever -shared -rfbport 5900 -noxdamage &

# websockify на внутренний порт 9080 (не конфликтует с PORT Railway)
WEBSOCKIFY_PORT=9080
websockify --web=/usr/share/novnc/ $WEBSOCKIFY_PORT localhost:5900 &

sleep 2

echo "Starting Proxy Server..."
# Railway задает PORT через переменную окружения.
# Proxy.js использует process.env.PORT, и мы передаем WEBSOCKIFY_PORT для проксирования
env WEBSOCKIFY_PORT=$WEBSOCKIFY_PORT node /app/proxy.js
