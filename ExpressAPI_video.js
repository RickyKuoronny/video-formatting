const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const os = require('os-utils');

ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();
const PORT = 3000;
const SECRET = 'mysecretkey'; // keep it secret in production

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // serve index.html

const upload = multer({ dest: 'uploads/' });
const LOG_FILE = path.join(__dirname, 'transcodeLogs.json');

if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, JSON.stringify([]));

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

    const inputPath = req.file.path;
    const outputFile = `output_${Date.now()}.mp4`;
    const outputDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    const outputPath = path.join(outputDir, outputFile);

    console.log(`Starting transcoding for ${inputPath} to resolution ${resolution}...`);

    const startTime = new Date().toISOString();

    ffmpeg(inputPath)
        .setFfmpegPath(ffmpegPath)
        .videoCodec('libx264')
        .size(resolution)
        .on('start', commandLine => {
            console.log('FFmpeg command:', commandLine);
        })
        .on('progress', progress => {
            // Sometimes progress.percent is undefined, handle safely
            const percent = progress.percent ? progress.percent.toFixed(2) : 0;
            console.log(`Processing: ${percent}% done`);
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
  // Only allow admins
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }

  os.cpuUsage((v) => {
    res.json({ cpuUsage: (v * 100).toFixed(2) + '%' });
  });
});


// Admin-only Log endpoint 
app.get('/logs', authenticate, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Admins only' });
    }

    try {
        const logs = fs.existsSync(LOG_FILE) ? JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) : [];
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});


app.get('/download/:fileName', (req, res) => res.download(path.join(__dirname, 'outputs', req.params.fileName)));
app.get('/logs', authenticate, (req, res) => res.json(JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'))));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
