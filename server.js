const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const CONVERTED_DIR = path.join(UPLOAD_DIR, "converted");
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(CONVERTED_DIR, { recursive: true });

app.use(cors());
app.use(express.static("public"));
app.use("/uploads", express.static(UPLOAD_DIR));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w\-]+/g, "_");
    cb(null, `${base}__${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

let isProcessing = false;

app.post("/upload", upload.single("video"), async (req, res) => {
  try {
    if (isProcessing) {
      return res.status(429).json({ error: "Server is processing another video, try again later." });
    }

    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const resolution = req.body.resolution || "720";
    const inputPath = req.file.path;
    const ext = path.extname(req.file.originalname) || ".mp4";
    const base = path.basename(req.file.originalname, ext).replace(/[^\w\-]+/g, "_");
    const outputFilename = `${base}_${resolution}p__${Date.now()}.mp4`;
    const outputPath = path.join(CONVERTED_DIR, outputFilename);

    isProcessing = true;

    // Convert video
    ffmpeg(inputPath)
      .output(outputPath)
      .size(`?x${resolution}`)
      .videoCodec("libx264")
      .audioCodec("aac")
      .on("end", () => {
        isProcessing = false;
        // Delete original uploaded file after converting
        fs.unlink(inputPath, () => {});
        return res.json({ filename: outputFilename, url: `/uploads/converted/${outputFilename}` });
      })
      .on("error", (err) => {
        console.error(err);
        isProcessing = false;
        return res.status(500).json({ error: "Video conversion failed" });
      })
      .run();
  } catch (err) {
    isProcessing = false;
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
