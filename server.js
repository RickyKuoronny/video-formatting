const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const CONVERTED_DIR = path.join(__dirname, "converted");
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB default

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(CONVERTED_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

app.disable("x-powered-by");
app.use(cors({ origin: true }));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/converted", express.static(CONVERTED_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const base = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, "_").slice(0, 120);
    cb(null, `${base}__${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if ((file.mimetype && file.mimetype.startsWith("video/")) || path.extname(file.originalname)) cb(null, true);
    else cb(new Error("Only video uploads are allowed."));
  },
});

// Upload + convert endpoint
app.post("/upload", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const format = req.query.format || "mp4"; // default MP4
  const inputPath = path.join(UPLOAD_DIR, req.file.filename);
  const outputName = `${path.parse(req.file.filename).name}.${format}`;
  const outputPath = path.join(CONVERTED_DIR, outputName);

  // Spawn FFmpeg for conversion
  const ffmpeg = spawn("ffmpeg", [
    "-i", inputPath,
    "-c:v", "libx264",  // H.264 for compatibility
    "-c:a", "aac",
    "-strict", "experimental",
    outputPath
  ]);

  ffmpeg.stderr.on("data", (data) => console.log(`FFmpeg: ${data}`));

  ffmpeg.on("close", (code) => {
    if (code === 0) {
      // Remove original file to save space
      fs.unlinkSync(inputPath);
      return res.json({
        success: true,
        convertedFile: outputName,
        url: `/converted/${outputName}`,
      });
    } else {
      console.error(`FFmpeg failed with code ${code}`);
      return res.status(500).json({ error: "Video conversion failed" });
    }
  });
});

app.get("/files", async (req, res) => {
  try {
    const files = await fs.promises.readdir(CONVERTED_DIR);
    const stats = await Promise.all(files.map(async (name) => {
      const p = path.join(CONVERTED_DIR, name);
      const s = await fs.promises.stat(p);
      return { name, size: s.size, url: `/converted/${encodeURIComponent(name)}`, mtime: s.mtime };
    }));
    stats.sort((a, b) => b.mtime - a.mtime);
    res.json({ files: stats.slice(0, 100) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list files" });
  }
});

app.use((err, req, res, next) => {
  console.error("Error:", err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `File too large. Max ${Math.round(MAX_FILE_SIZE/1048576)} MB` });
  }
  res.status(400).json({ error: err.message || "Upload error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
