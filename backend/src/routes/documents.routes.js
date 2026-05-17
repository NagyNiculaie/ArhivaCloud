const auth = require("../middleware/auth");
const express = require("express");
const multer = require("multer");
const supabase = require("../config/cloudinary");
const Document = require("../models/Document");
const { extractText } = require("../services/extractText.service");
const {
  embedText,
  cosineSimilarity,
} = require("../services/embeddings.service");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const filePath = `${req.user.userId}/${Date.now()}-${safeName}`;

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
      owner: req.user.userId,

      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: publicData.publicUrl,
        publicId: filePath,
      },

      extractedText: text,
      embedding: await embedText(text),
    });

    res.json({ ok: true, document: doc });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List documents - doar documentele userului logat
router.get("/", auth, async (req, res) => {
  try {
    const docs = await Document.find({ owner: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ ok: true, documents: docs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Preview document - doar dacă documentul aparține userului
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
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      owner: req.user.userId,
    });

    if (!doc) {
      return res.status(404).json({
        ok: false,
        error: "Document inexistent.",
      });
    }

    res.json({ ok: true, document: doc });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete document
router.delete("/:id", auth, async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      owner: req.user.userId,
    });

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

    await Document.deleteOne({
      _id: req.params.id,
      owner: req.user.userId,
    });

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

// Semantic search - doar în documentele userului logat
router.post("/semantic-search", auth, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: "Lipsește query.",
      });
    }

    const queryEmbedding = await embedText(query);

    const docs = await Document.find({
      owner: req.user.userId,
      embedding: { $exists: true, $ne: [] },
    });

    const results = docs
      .map((doc) => ({
        document: doc,
        score: cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({
      ok: true,
      results,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});
// Ask AI about user's documents
router.post("/ask", auth, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Lipsește întrebarea.",
      });
    }

    const questionEmbedding = await embedText(question);

    const docs = await Document.find({
      owner: req.user.userId,
      embedding: { $exists: true, $ne: [] },
    });

    if (docs.length === 0) {
      return res.json({
        ok: true,
        answer:
          "Nu am găsit documente procesate pentru acest cont. Încarcă un document nou pentru a putea pune întrebări pe baza lui.",
        sources: [],
      });
    }

    const rankedDocs = docs
      .map((doc) => ({
        doc,
        score: cosineSimilarity(questionEmbedding, doc.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const context = rankedDocs
      .map((item, index) => {
        const text = item.doc.extractedText || "";

        return `
DOCUMENT ${index + 1}
Nume fișier: ${item.doc.file?.originalName}
Scor relevanță: ${item.score.toFixed(3)}
Text extras:
${text.slice(0, 6000)}
`;
      })
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ești un asistent pentru analizarea documentelor financiare. Răspunde strict pe baza contextului primit. Dacă informația nu există în documente, spune clar că nu ai găsit-o. Răspunde în română, concis și organizat.",
        },
        {
          role: "user",
          content: `
Întrebare:
${question}

Context din documentele utilizatorului:
${context}
`,
        },
      ],
      temperature: 0.2,
    });

    res.json({
      ok: true,
      answer: completion.choices[0].message.content,
      sources: rankedDocs.map((item) => ({
        id: item.doc._id,
        fileName: item.doc.file?.originalName,
        score: item.score,
        url: item.doc.file?.url,
      })),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

module.exports = router;