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

// Serve static frontend files
app.use(express.static('public'));

// Upload storage config
const upload = multer({ dest: 'uploads/' });

// Logs file path
const LOG_FILE = path.join(__dirname, 'transcodeLogs.json');

// Ensure logs file exists
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify([]));
}

// POST /upload → Upload + transcode directly
app.post('/upload', upload.single('video'), (req, res) => {
  const { resolution } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No video uploaded' });
  }

  if (!resolution) {
    return res.status(400).json({ error: 'Resolution is required' });
  }

  const inputPath = req.file.path;
  const outputFile = `output_${Date.now()}.mp4`;
  const outputPath = path.join(__dirname, 'outputs', outputFile);

  // Ensure outputs folder exists
  if (!fs.existsSync(path.join(__dirname, 'outputs'))) {
    fs.mkdirSync(path.join(__dirname, 'outputs'));
  }

  ffmpeg(inputPath)
    .setFfmpegPath(ffmpegPath)
    .videoCodec('libx264')
    .size(resolution)
    .on('start', () => console.log(`Transcoding started → ${resolution}`))
    .on('end', () => {
      console.log(`Transcoding completed → ${outputPath}`);

      // Save to logs
      const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      logs.push({
        input: inputPath,
        output: outputPath,
        resolution,
        completedAt: new Date().toISOString()
      });
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

      res.json({
        message: 'Transcoding completed successfully!',
        outputFile: `/download/${outputFile}`
      });
    })
    .on('error', (err) => {
      console.error('Transcoding failed:', err);
      res.status(500).json({ error: 'Transcoding failed' });
    })
    .save(outputPath);
});

// Allow downloading transcoded files
app.get('/download/:fileName', (req, res) => {
  const filePath = path.join(__dirname, 'outputs', req.params.fileName);
  res.download(filePath);
});

// GET /logs → View transcoding history
app.get('/logs', (req, res) => {
  const logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  res.json(logs);
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
