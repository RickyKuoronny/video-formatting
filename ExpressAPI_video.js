const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS & JSON
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload storage config
const upload = multer({ dest: 'uploads/' });

// Logs file path
const LOG_FILE = path.join(__dirname, 'transcodeLogs.json');

// Ensure logs file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([]));
}

// POST /upload → Upload a video
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ message: 'File uploaded successfully', filePath: req.file.path });
});

// POST /transcode → Transcode video to chosen resolution
app.post('/transcode', async (req, res) => {
  const { inputPath, resolution } = req.body;

  if (!inputPath || !resolution) {
    return res.status(400).json({ error: 'Input path and resolution are required' });
  }

  const outputFile = `output_${Date.now()}.mp4`;
  const outputPath = path.join(__dirname, outputFile);

  ffmpeg(inputPath)
    .setFfmpegPath(ffmpegPath)
    .videoCodec('libx264')
    .size(resolution)
    .on('start', () => {
      console.log(`Starting transcoding: ${inputPath} → ${resolution}`);
    })
    .on('end', () => {
      console.log('Transcoding completed:', outputPath);

      // Save log entry
      const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      logs.push({
        input: inputPath,
        output: outputPath,
        resolution,
        completedAt: new Date().toISOString()
      });
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

      res.json({ message: 'Transcoding completed', output: outputPath });
    })
    .on('error', (err) => {
      console.error('Transcoding error:', err);
      res.status(500).json({ error: 'Transcoding failed' });
    })
    .save(outputPath);
});

// GET /logs → View transcoding logs
app.get('/logs', (req, res) => {
  const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  res.json(logs);
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Video Transcoding API is running ✅');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
