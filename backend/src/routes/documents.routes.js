const express = require("express");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const Document = require("../models/Document");
const { extractText } = require("../services/extractText.service");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload document (PDF/JPG/PNG) + extract text + save in MongoDB
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ ok: false, error: "Lipsește fișierul (field: file)." });
    }

    const isPdf = req.file.mimetype === "application/pdf";
    const resourceType = isPdf ? "raw" : "image";

    // 1) Upload în Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "arhiva-cloud",
          resource_type: resourceType,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    // 2) Extract text (PDF text / OCR)
    const text = await extractText({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    // 3) Save în MongoDB
    const doc = await Document.create({
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      },
      extractedText: text,
      embedding: [],
    });

    res.json({ ok: true, document: doc });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List documents
router.get("/", async (req, res) => {
  const docs = await Document.find().sort({ createdAt: -1 }).limit(50);
  res.json({ ok: true, documents: docs });
});

// Get one document
router.get("/:id", async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) {
    return res
      .status(404)
      .json({ ok: false, error: "Document inexistent." });
  }
  res.json({ ok: true, document: doc });
});

module.exports = router;