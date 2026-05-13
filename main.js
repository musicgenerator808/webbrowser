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
let isRestarting = false;

function createWindow() {
    console.log('[Electron] Creating window...');
    
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

    // Логирование ошибок загрузки страницы
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('[Electron] Page load failed:', errorCode, errorDescription, validatedURL);
    });

    mainWindow.webContents.on('crashed', (event, killed) => {
        console.error('[Electron] Renderer process crashed. Killed:', killed);
        if (!isRestarting) {
            isRestarting = true;
            setTimeout(() => {
                console.log('[Electron] Restarting window after crash...');
                if (mainWindow) {
                    mainWindow.close();
                }
                createWindow();
                isRestarting = false;
            }, 2000);
        }
    });

    mainWindow.on('unresponsive', () => {
        console.error('[Electron] Window became unresponsive');
    });

    mainWindow.on('responsive', () => {
        console.log('[Electron] Window became responsive again');
    });

    console.log('[Electron] Window created successfully');
}

// Обработка падения процесса рендеринга
app.on('render-process-gone', (event, webContents, details) => {
    console.error('[Electron] Render process gone:', details);
    if (details.reason === 'crashed' || details.reason === 'killed') {
        if (!isRestarting) {
            isRestarting = true;
            console.log('[Electron] Will restart window in 3 seconds...');
            setTimeout(() => {
                if (mainWindow) {
                    mainWindow.close();
                }
                createWindow();
                isRestarting = false;
            }, 3000);
        }
    }
});

// Обработка непойманных исключений
app.on('uncaughtException', (error) => {
    console.error('[Electron] Uncaught exception:', error);
});

// Логирование когда все окна закрыты
app.on('window-all-closed', () => {
    console.log('[Electron] All windows closed');
    if (process.platform !== 'darwin') {
        console.log('[Electron] Quitting app');
        app.quit();
    }
});

app.whenReady().then(() => {
    console.log('[Electron] App ready, creating window...');
    createWindow();
});
