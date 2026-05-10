const auth = require("../middleware/auth");
const express = require("express");
const multer = require("multer");
const supabase = require("../config/cloudinary");
const Document = require("../models/Document");
const { extractText } = require("../services/extractText.service");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const BUCKET_NAME = "Documente";

// Upload document
router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Lipsește fișierul (field: file).",
      });
    }

    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const text = await extractText({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    const doc = await Document.create({
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: publicData.publicUrl,
        publicId: filePath,
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
router.get("/", auth, async (req, res) => {
  const docs = await Document.find().sort({ createdAt: -1 }).limit(50);
  res.json({ ok: true, documents: docs });
});

// Preview document
router.get("/:id/preview", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({
        ok: false,
        error: "Document inexistent.",
      });
    }

    return res.redirect(doc.file.url);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

// Get one document
router.get("/:id", auth, async (req, res) => {
  const doc = await Document.findById(req.params.id);

  if (!doc) {
    return res.status(404).json({
      ok: false,
      error: "Document inexistent.",
    });
  }

  res.json({ ok: true, document: doc });
});

// Delete document
router.delete("/:id", auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({
        ok: false,
        error: "Document inexistent.",
      });
    }

    if (doc.file?.publicId) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([doc.file.publicId]);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    await Document.findByIdAndDelete(req.params.id);

    res.json({
      ok: true,
      message: "Document șters cu succes.",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

module.exports = router;