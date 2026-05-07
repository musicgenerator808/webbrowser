const http = require('http');
const { spawn } = require('child_process');

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*'
    });

    console.log('Client connected to audio stream');

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

    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on('data', (data) => {
        // Выводим ошибки ffmpeg в консоль Railway для отладки
        console.error(`ffmpeg: ${data}`); 
    });

    req.on('close', () => {
        console.log('Client disconnected from audio stream');
        ffmpeg.kill('SIGKILL');
    });
});

server.listen(8000, () => {
    console.log('Audio streaming server listening on port 8000');
});
