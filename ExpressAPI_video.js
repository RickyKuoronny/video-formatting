const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const os = require("os-utils");
const { spawn } = require("child_process");

const app = express();
const PORT = 3000;
const SECRET_KEY = "supersecretkey"; // Change in production
const UPLOADS_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "output");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Middlewares
app.use(express.json());
app.use(cors());
app.use("/download", express.static(OUTPUT_DIR));

// Multer setup
const storage = multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });

// Dummy users
const users = [
    { username: "admin", password: bcrypt.hashSync("admin123", 10), role: "admin" },
    { username: "user", password: bcrypt.hashSync("user123", 10), role: "user" }
];

// Transcoding logs
const logs = [];

// Middleware: Verify JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
};

// Middleware: Admin only
const verifyAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied" });
    }
    next();
};

// ==================== ROUTES ====================

// Login
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ username, role: user.role }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ token });
});

// Upload + Transcode
app.post("/upload", verifyToken, upload.single("video"), async (req, res) => {
    try {
        const resolution = req.body.resolution || "1280x720";
        const inputPath = req.file.path;
        const outputFile = `${Date.now()}-${resolution}.mp4`;
        const outputPath = path.join(OUTPUT_DIR, outputFile);

        const startTime = new Date();
        const ffmpeg = spawn("ffmpeg", ["-i", inputPath, "-s", resolution, "-c:a", "copy", outputPath]);

        ffmpeg.on("close", code => {
            fs.unlinkSync(inputPath);

            if (code !== 0) {
                return res.status(500).json({ error: "Transcoding failed" });
            }

            logs.push({
                user: req.user.username,
                input: req.file.originalname,
                output: outputFile,
                resolution,
                startedAt: startTime.toISOString(),
                completedAt: new Date().toISOString()
            });

            res.json({ file: outputFile });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Download
app.get("/download/:file", (req, res) => {
    const filePath = path.join(OUTPUT_DIR, req.params.file);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }
    res.download(filePath);
});

// Get CPU usage (Admin only)
app.get("/cpu", verifyToken, verifyAdmin, (req, res) => {
    os.cpuUsage(cpu => {
        res.json({ cpuUsage: (cpu * 100).toFixed(2) });
    });
});

// Get transcoding logs (Admin only)
app.get("/logs", verifyToken, verifyAdmin, (req, res) => {
    res.json(logs);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
