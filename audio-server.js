const http = require('http');
const { spawn } = require('child_process');

// Функция для логирования с таймстампом
const log = (message) => {
    console.log(`[AudioServer ${new Date().toISOString()}] ${message}`);
};

const errorLog = (message) => {
    console.error(`[AudioServer ERROR ${new Date().toISOString()}] ${message}`);
};

const server = http.createServer((req, res) => {
    log('Client connected to audio stream');
    
    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*'
    });

    // Record from PulseAudio virtual sink 'remote.monitor' - low latency with proper timestamps
    const ffmpeg = spawn('ffmpeg', [
        '-fflags', '+nobuffer+genpts',
        '-flags', 'low_delay',
        '-avioflags', 'direct',
        '-f', 'pulse',
        '-i', 'remote.monitor',
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        '-compression_level', '0',
        '-f', 'mp3',
        '-'
    ], {
        env: { ...process.env, PULSE_SERVER: 'unix:/var/run/pulse/native' }
    });

    ffmpeg.on('error', (err) => {
        errorLog(`FFmpeg spawn error: ${err.message}`);
        res.end();
    });

    ffmpeg.on('exit', (code, signal) => {
        if (code !== null && code !== 0) {
            errorLog(`FFmpeg exited with code ${code}, signal ${signal}`);
        }
    });

    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on('data', (data) => {
        // Выводим ошибки ffmpeg в консоль Railway для отладки
        errorLog(`FFmpeg stderr: ${data}`); 
    });

    req.on('close', () => {
        log('Client disconnected from audio stream');
        try {
            ffmpeg.kill('SIGKILL');
        } catch (err) {
            errorLog(`Error killing FFmpeg: ${err.message}`);
        }
    });

    req.on('error', (err) => {
        errorLog(`Request error: ${err.message}`);
    });
});

server.on('error', (err) => {
    errorLog(`Server error: ${err.message}`);
});

server.listen(8000, '0.0.0.0', () => {
    log('Audio streaming server listening on port 8000');
});
