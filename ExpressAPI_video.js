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

// --- Paths for folders ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');

// Create folders if they don't exist
[UPLOADS_DIR, OUTPUTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created folder: ${dir}`);
  }
});

// ✅ CORS setup
const corsOptions = {
  origin: '*', // Or restrict to your front-end domain
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Handle preflight for /upload specifically
app.options('/upload', cors(corsOptions));

const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max upload
  },
  fileFilter: (req, file, cb) => {
    // Only allow videos
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'), false);
    }
    cb(null, true);
  }
});
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

// --- UPLOAD + TRANSCODE ---
app.post('/upload', authenticate, upload.single('video'), (req, res) => {
  console.log('UPLOAD ROUTE HIT ✅', req.file);

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const inputPath = req.file.path;
  const outputFileName = `${Date.now()}-${req.file.originalname}`;
  const outputPath = path.join(OUTPUTS_DIR, outputFileName);

  ffmpeg(inputPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputOptions('-preset', 'fast')
    .save(outputPath)
    .on('start', cmd => console.log('FFmpeg command:', cmd))
    .on('end', () => {
      try { fs.unlinkSync(inputPath); } catch(e){ console.error(e); }

      const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      logs.push({ 
        user: req.user.username, 
        file: outputFileName, 
        input: req.file.originalname,
        resolution: req.body.resolution || 'original',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

      res.json({ file: outputFileName });
    })
    .on('error', (err) => {
      try { fs.unlinkSync(inputPath); } catch(e){ console.error(e); }
      res.status(500).json({ error: 'Transcoding failed', details: err.message });
    });
});


// --- OTHER ENDPOINTS ---
app.get('/download/:fileName', (req, res) => res.download(path.join(__dirname, 'outputs', req.params.fileName)));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
