const express = require("express");
const Document = require("../models/Document");

const router = express.Router();

// Căutare clasică (fără AI): caută în extractedText + nume fișier
router.post("/text", async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    if (!query) return res.status(400).json({ ok: false, error: "Lipsește query." });

    // regex simplu pentru demo (case-insensitive)
    const regex = new RegExp(query, "i");

    const results = await Document.find({
      $or: [
        { extractedText: regex },
        { "file.originalName": regex },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;