const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Функция для логирования с таймстампом
const log = (message) => {
    console.log(`[Proxy ${new Date().toISOString()}] ${message}`);
};

const errorLog = (message) => {
    console.error(`[Proxy ERROR ${new Date().toISOString()}] ${message}`);
};

const app = express();
// Railway sets PORT, default to 10000 if not set.
// We must make sure this PORT is not 8080 (which is used by websockify).
const PORT = process.env.PORT || 10000;

// Proxy /audio to the audio server
app.use('/audio', createProxyMiddleware({ 
    target: 'http://localhost:8000', 
    pathRewrite: {'^/audio' : ''},
    changeOrigin: true,
    onError: (err, req, res) => {
        errorLog(`Audio proxy error: ${err.message}`);
        res.status(500).send('Audio proxy error');
    }
}));

// Proxy everything else to websockify
const WEBSOCKIFY_PORT = process.env.WEBSOCKIFY_PORT || 8080;
// We need to redirect root / to /vnc.html
app.get('/', (req, res) => {
    log('Redirecting to /vnc.html');
    res.redirect('/vnc.html');
});

app.use('/', createProxyMiddleware({ 
    target: `http://localhost:${WEBSOCKIFY_PORT}`, 
    ws: true,
    changeOrigin: true,
    onError: (err, req, res) => {
        errorLog(`Websockify proxy error: ${err.message}`);
        if (!res.headersSent) {
            res.status(502).send('Websockify proxy error');
        }
    }
}));

// Обработка ошибок Express
app.use((err, req, res, next) => {
    errorLog(`Express error: ${err.message}`);
    res.status(500).send('Internal server error');
});

// Логирование запуска
log(`Starting proxy server on port ${PORT}`);
log(`Proxying websockify on port ${WEBSOCKIFY_PORT}`);

const server = app.listen(PORT, '0.0.0.0', () => {
    log(`Main proxy server listening on port ${PORT}`);
});

server.on('error', (err) => {
    errorLog(`Server error: ${err.message}`);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    log('Received SIGINT, shutting down gracefully...');
    server.close(() => {
        log('Server closed');
        process.exit(0);
    });
});
