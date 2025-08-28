const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const os = require('os-utils');

// Use system-installed ffmpeg on EC2/Linux
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

const app = express();
const PORT = 3000;
const SECRET = 'mysecretkey'; // keep it secret in production

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ensure uploads and outputs directories exist
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'outputs');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const LOG_FILE = path.join(__dirname, 'transcodeLogs.json');
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, JSON.stringify([]));

// Safe filename handler for uploads
const upload = multer({
    dest: UPLOAD_DIR,
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^\w.-]/g, '_');
        cb(null, safeName);
    }
});

// Simple user database
const users = [
    { username: 'user1', password: 'pass1', role: 'standard' },
    { username: 'admin', password: 'adminpass', role: 'admin' }
];

// LOGIN endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ username: user.username, role: user.role }, SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// Middleware to protect routes
function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
}

// UPLOAD + TRANSCODE (protected)
app.post('/upload', authenticate, upload.single('video'), (req, res) => {
    const { resolution } = req.body;
    if (!req.file || !resolution) return res.status(400).json({ error: 'Missing file or resolution' });

    const inputPath = path.join(UPLOAD_DIR, req.file.filename);
    const outputFile = `output_${Date.now()}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFile);

    console.log(`Starting transcoding for ${inputPath} to resolution ${resolution}...`);

    const startTime = new Date().toISOString();

    ffmpeg(inputPath)
        .videoCodec('libx264')
        .size(resolution)
        .on('start', commandLine => {
            console.log('FFmpeg command:', commandLine);
        })
        .on('progress', progress => {
            const percent = progress.percent ? progress.percent.toFixed(2) : 0;
            process.stdout.write(`Processing: ${percent}%\r`); // live progress
        })
        .on('stderr', line => {
            console.log(line); // show FFmpeg logs
        })
        .on('error', err => {
            console.error('Transcoding error:', err.message);
            res.status(500).json({ error: 'Transcoding failed: ' + err.message });
        })
        .on('end', () => {
            const endTime = new Date().toISOString();
            console.log('Transcoding finished successfully.');

            // Save log
            const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
            logs.push({
                input: inputPath,
                output: outputPath,
                resolution,
                startedAt: startTime,
                completedAt: endTime,
                user: req.user.username
            });
            fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

            res.json({ message: 'Transcoding completed!', outputFile: `/download/${outputFile}` });
        })
        .save(outputPath);
});

// Admin-only CPU endpoint
app.get('/cpu', authenticate, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admins only.' });
    }

    os.cpuUsage(v => {
        res.json({ cpuUsage: (v * 100).toFixed(2) + '%' });
    });
});

// Admin-only Logs
app.get('/logs', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    try {
        const logs = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Download endpoint
app.get('/download/:fileName', (req, res) => {
    const filePath = path.join(OUTPUT_DIR, req.params.fileName);
    res.download(filePath);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
