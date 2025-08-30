const express = require('express');
const path = require('path');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const os = require('os');

const app = express();

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'supersecretkey'; // replace with strong secret in production

app.use(express.json()); // for parsing JSON bodies

const LOG_FILE = path.join(__dirname, 'conversion_logs.json');
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
const OUTPUT_DIR = path.resolve(__dirname, 'outputs');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// --- Hard-coded users ---
const users = [
  { username: 'user1', passwordHash: bcrypt.hashSync('pass', 10), role: 'user' },
  { username: 'admin', passwordHash: bcrypt.hashSync('adminpass', 10), role: 'admin' }
];

// --- JWT middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Middleware to check admin role
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admins only' });
  next();
}


// --- Logs ---
// Utility to append log
function appendLog(entry) {
  const logEntry = JSON.stringify(entry) + '\n'; // one JSON object per line
  fs.appendFile(LOG_FILE, logEntry, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
}


// GET /logs - only admin
app.get('/logs', authenticateToken, requireAdmin, (req, res) => {
  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read logs' });

    // Each line is a JSON object
    const logs = data.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

    const cores = os.cpus().length;
    const loadAvg = os.loadavg(); // [1min, 5min, 15min]
    const cpuUsagePercent = loadAvg.map(avg => Math.min((avg / cores) * 100, 100)); // capped at 100%

    const cpuInfo = os.cpus().map(cpu => ({
      model: cpu.model,
      speed: cpu.speed,
      times: cpu.times
    }));

    res.json({ logs, cpuUsagePercent, cpuInfo });
  });
});


// --- Login route ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const payload = { username: user.username, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  res.json({ token });
});



const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${id}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit (adjust)
  fileFilter: (req, file, cb) => {
    // basic mime check (allow common video types)
    if (/^video\/(mp4|x-matroska|quicktime|x-msvideo|webm|x-ms-wmv)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only video files allowed'), false);
  }
});

app.use('/outputs', express.static(OUTPUT_DIR, { index: false }));

// Helper: build ffmpeg args for scale preserving aspect ratio if ? used.
// Accepts resolution like "1280x720", "1280x?", "?x720"
function buildScaleArg(res) {
  if (!res) return null;
  const match = res.match(/^(\d+|\?)x(\d+|\?)$/);
  if (!match) return null;
  const w = match[1], h = match[2];
  if (w === '?' && h === '?') return null; // nothing to do
  // If one side is ?, use -1 in ffmpeg to preserve aspect
  const width = w === '?' ? -1 : parseInt(w, 10);
  const height = h === '?' ? -1 : parseInt(h, 10);
  return `scale=${width}:${height}`;
}

app.post('/convert', authenticateToken, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const resolution = (req.body.resolution || '').trim();
  const scaleArg = buildScaleArg(resolution);

  const inputPath = req.file.path;
  const outName = path.basename(req.file.filename, path.extname(req.file.filename)) + '-converted.mp4';
  const outputPath = path.join(OUTPUT_DIR, outName);

  const startedAt = new Date().toISOString();

  // === Log when file upload is complete ===
  console.log(`[${startedAt}] File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

  const args = ['-i', inputPath, '-y', '-hide_banner', '-loglevel', 'error'];
  if (scaleArg) args.push('-vf', scaleArg);
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', outputPath);

  // === Log when FFmpeg starts ===
  console.log(`[${new Date().toISOString()}] Starting FFmpeg conversion for ${req.file.originalname} -> ${outName}`);
  const ff = spawn('ffmpeg', args);

  let ffErr = '';

  ff.stderr.on('data', (d) => { ffErr += d.toString(); });

  ff.on('close', (code) => {
    try { fs.unlinkSync(inputPath); } catch {}

    const completedAt = new Date().toISOString();
    const logEntry = {
      input: req.file.filename,
      output: outName,
      resolution,
      startedAt,
      completedAt,
      user: req.user.username
    };

    appendLog(logEntry); // write to log file

    if (code === 0 && fs.existsSync(outputPath)) {
      console.log(`[${completedAt}] FFmpeg finished conversion: ${outName}`);
      res.json({ ok: true, download: `/outputs/${outName}` });
    } else {
      console.error(`[${completedAt}] FFmpeg failed for ${outName}:`, ffErr);
      res.status(500).json({ error: 'FFmpeg failed', details: ffErr });
    }
  });
});


// health
app.get('/health', (req, res) => res.send('ok'));

app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on ${PORT}`));
