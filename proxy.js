const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
// Railway sets PORT, default to 10000 if not set.
// We must make sure this PORT is not 8080 (which is used by websockify).
const PORT = process.env.PORT || 10000;

// Proxy /audio to the audio server
app.use('/audio', createProxyMiddleware({ 
    target: 'http://localhost:8000', 
    pathRewrite: {'^/audio' : ''},
    changeOrigin: true
}));

// Proxy everything else to websockify
const WEBSOCKIFY_PORT = process.env.WEBSOCKIFY_PORT || 8080;
// We need to redirect root / to /vnc.html
app.get('/', (req, res) => {
    res.redirect('/vnc.html');
});

app.use('/', createProxyMiddleware({ 
    target: `http://localhost:${WEBSOCKIFY_PORT}`, 
    ws: true,
    changeOrigin: true
}));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Main proxy server listening on port ${PORT}`);
});
