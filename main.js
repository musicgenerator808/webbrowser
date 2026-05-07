const { app, BrowserWindow, session } = require('electron');

// Настройки для работы в Docker и автоплея звука
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-gpu');
// Заставляем Electron использовать PulseAudio
app.commandLine.appendSwitch('alsa-output-device', 'pulse');
// Критично для звука: разрешаем играть без клика
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow;

function createWindow() {
// ... внутри createWindow()
mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    frame: false,
    webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
        // Критически важно:
        audioMuted: false,
        autoplayPolicy: 'no-user-gesture-required',
        offscreen: false 
    }
});

    // Устанавливаем современный User-Agent
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    mainWindow.loadFile('index.html');
    
    // Принудительно разворачиваем на весь экран
    mainWindow.maximize();
    mainWindow.setFullScreen(true);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
