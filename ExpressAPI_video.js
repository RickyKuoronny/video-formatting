const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const os = require('os-utils');

ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
const app = express();
const PORT = 3000;
const SECRET = 'mysecretkey'; // keep it secret in production

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // serve index.html

const upload = multer({ dest: 'uploads/' });
const LOG_FILE = path.join(__dirname, 'transcodeLogs.json');

if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]', 'utf8');

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
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const inputPath = req.file.path;
  const outputDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const outputFileName = `${Date.now()}-${req.file.originalname}`;
  const outputPath = path.join(outputDir, outputFileName);


  ffmpeg(inputPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputOptions('-preset', 'fast')
    .save(outputPath)
    .on('start', cmd => console.log('FFmpeg command:', cmd))
    .on('end', () => {
      fs.unlinkSync(inputPath);
      const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      logs.push({ user: req.user.username, file: outputFileName, timestamp: new Date().toISOString() });
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
      res.json({ message: 'File transcoded successfully', file: outputFileName });
    })
    .on('error', (err) => {
      fs.unlinkSync(inputPath);
      res.status(500).json({ error: 'Transcoding failed', details: err.message });
    });
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

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
