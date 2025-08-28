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
const SECRET = 'mysecretkey';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ✅ CORS setup (full preflight support)
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight for all routes

const upload = multer({ dest: 'uploads/' });
const LOG_FILE = path.join(__dirname, 'transcodeLogs.json');
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]', 'utf8');

// --- Users ---
const users = [
  { username: 'user1', password: 'pass1', role: 'standard' },
  { username: 'admin', password: 'adminpass', role: 'admin' }
];

// --- LOGIN ---
app.post('/login', (req, res) => {
  console.log('login HIT ✅');
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ username: user.username, role: user.role }, SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// --- AUTH MIDDLEWARE ---
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

// --- UPLOAD + TRANSCODE (any file field) ---
app.post('/upload', authenticate, upload.any(), (req, res) => {
  console.log('UPLOAD ROUTE HIT ✅', req.files);

  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'No file uploaded' });

  const file = req.files[0]; // take the first uploaded file
  const inputPath = file.path;

  const outputDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const outputFileName = `${Date.now()}-${file.originalname}`;
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
      res.json({ file: outputFileName });
    })
    .on('error', (err) => {
      fs.unlinkSync(inputPath);
      res.status(500).json({ error: 'Transcoding failed', details: err.message });
    });
});

// --- DOWNLOAD ---
app.get('/download/:fileName', (req, res) => {
  const filePath = path.join(__dirname, 'outputs', req.params.fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
