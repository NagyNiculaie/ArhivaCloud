const auth = require("../middleware/auth");
const express = require("express");
const multer = require("multer");
const supabase = require("../config/cloudinary");
const Document = require("../models/Document");
const DocumentChunk = require("../models/DocumentChunk");
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

function splitTextIntoChunks(text, maxLength = 1200) {
  if (!text) return [];

  const cleanText = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  for (let i = 0; i < cleanText.length; i += maxLength) {
    chunks.push(cleanText.slice(i, i + maxLength));
  }

  return chunks;
}

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

    const embedding = await embedText(text);

    console.log("TEXT EXTRAS LENGTH:", text.length);
    console.log("EMBEDDING LENGTH:", embedding.length);

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
      embedding,
    });

    const chunks = splitTextIntoChunks(text);

    console.log("CHUNKS CREATED:", chunks.length);

    for (let i = 0; i < chunks.length; i++) {
  const chunkEmbedding = await embedText(chunks[i]);

  const createdChunk = await DocumentChunk.create({
    owner: req.user.userId,
    document: doc._id,
    chunkIndex: i,
    text: chunks[i],
    embedding: chunkEmbedding,
  });

  console.log("CHUNK SAVED:", createdChunk._id.toString());
}

    res.json({
      ok: true,
      document: doc,
      chunksCreated: chunks.length,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List documents
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

    await DocumentChunk.deleteMany({
      document: doc._id,
      owner: req.user.userId,
    });

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

// Semantic search pe chunk-uri
router.post("/semantic-search", auth, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Lipsește query.",
      });
    }

    const queryEmbedding = await embedText(query);

    const chunks = await DocumentChunk.find({
      owner: req.user.userId,
      embedding: { $exists: true, $ne: [] },
    }).populate("document");

    const results = chunks
      .map((chunk) => ({
        chunk,
        document: chunk.document,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter((item) => item.document)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => ({
        document: item.document,
        chunk: {
          id: item.chunk._id,
          text: item.chunk.text,
          chunkIndex: item.chunk.chunkIndex,
        },
        score: item.score,
      }));

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

// Ask AI about user's documents using chunks
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

    const chunks = await DocumentChunk.find({
      owner: req.user.userId,
      embedding: { $exists: true, $ne: [] },
    }).populate("document");

    if (chunks.length === 0) {
      return res.json({
        ok: true,
        answer:
          "Nu există documente procesate pentru acest cont. Încarcă documente noi pentru a putea pune întrebări pe baza lor.",
        sources: [],
      });
    }

    const rankedChunks = chunks
      .map((chunk) => ({
        chunk,
        document: chunk.document,
        score: cosineSimilarity(questionEmbedding, chunk.embedding),
      }))
      .filter((item) => item.document)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const context = rankedChunks
      .map((item, index) => {
        return `
FRAGMENT ${index + 1}
Document: ${item.document.file?.originalName}
Fragment index: ${item.chunk.chunkIndex}
Scor relevanță: ${item.score.toFixed(3)}

Text fragment:
${item.chunk.text}
`;
      })
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ești un asistent AI pentru analizarea documentelor. Răspunde strict pe baza fragmentelor primite. Dacă informația nu există în fragmente, spune clar că nu ai găsit-o. Răspunde în română, clar și organizat. Dacă utilizatorul cere calcule și datele există în fragmente, calculează rezultatul.",
        },
        {
          role: "user",
          content: `
Întrebare:
${question}

Fragmente relevante din documentele utilizatorului:
${context}
`,
        },
      ],
      temperature: 0.2,
    });

    const uniqueSources = [];
    const seen = new Set();

    for (const item of rankedChunks) {
      const id = item.document._id.toString();

      if (!seen.has(id)) {
        seen.add(id);
        uniqueSources.push({
          id: item.document._id,
          fileName: item.document.file?.originalName,
          url: item.document.file?.url,
          score: item.score,
        });
      }
    }

    res.json({
      ok: true,
      answer: completion.choices[0].message.content,
      sources: uniqueSources,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

module.exports = router;