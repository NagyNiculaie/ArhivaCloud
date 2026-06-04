const auth = require("../middleware/auth");
const express = require("express");
const multer = require("multer");
const supabase = require("../config/supabase");
const Document = require("../models/Document");
const DocumentChunk = require("../models/DocumentChunk");
const { extractText } = require("../services/extractText.service");
const { classifyDocument } = require("../services/classifyDocument.service");
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
const MIN_TEXT_LENGTH_FOR_AI = 40;
const EMBEDDING_CONCURRENCY = Number(process.env.EMBEDDING_CONCURRENCY || 3);

function splitTextIntoChunks(text, maxLength = 1200) {
  if (!text) return [];

  const cleanText = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  for (let i = 0; i < cleanText.length; i += maxLength) {
    chunks.push(cleanText.slice(i, i + maxLength));
  }

  return chunks;
}

function normalizeForSearch(value = "") {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9., -]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchTerms(question = "") {
  const stopWords = new Set([
    "care",
    "este",
    "sunt",
    "din",
    "pentru",
    "factura",
    "facturi",
    "document",
    "documente",
    "spune",
    "cauta",
    "vreau",
    "toate",
    "toata",
    "toti",
    "imi",
    "arata",
    "cu",
    "la",
    "de",
    "si",
    "in",
    "pe",
    "un",
    "o",
    "ale",
    "al",
    "ai",
    "le",
    "ce",
    "cat",
    "catre",
    "dupa",
    "sau",
    "fiecare",
    "gaseste",
    "extrage",
    "analizeaza",
  ]);

  const normalized = normalizeForSearch(question);

  return normalized
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .filter((term) => !stopWords.has(term));
}

function keywordMatchScore(questionTerms, text = "") {
  if (!questionTerms.length) return 0;

  const normalizedText = normalizeForSearch(text);

  let matches = 0;

  for (const term of questionTerms) {
    if (normalizedText.includes(term)) {
      matches++;
    }
  }

  return matches / questionTerms.length;
}

function getOpenAIResponseText(response) {
  if (response?.output_text) {
    return response.output_text.trim();
  }

  if (Array.isArray(response?.output)) {
    return response.output
      .flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("\n")
      .trim();
  }

  return "";
}

async function extractTextWithOpenAIOCR({ buffer, mimeType, fileName }) {
  try {
    if (!buffer || !mimeType) return "";

    const base64File = buffer.toString("base64");
    const model = process.env.OPENAI_OCR_MODEL || "gpt-4o-mini";

    if (mimeType === "application/pdf") {
      console.log("OPENAI OCR PDF START:", fileName);

      const response = await openai.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: fileName || "document.pdf",
                file_data: `data:application/pdf;base64,${base64File}`,
              },
              {
                type: "input_text",
                text:
                  "Extrage tot textul vizibil din acest PDF scanat. Răspunde doar cu textul extras, fără explicații, fără markdown.",
              },
            ],
          },
        ],
        max_output_tokens: 6000,
      });

      const extracted = getOpenAIResponseText(response);

      console.log("OPENAI OCR PDF LENGTH:", extracted.length);

      return extracted;
    }

    if (/^image\//.test(mimeType)) {
      console.log("OPENAI OCR IMAGE START:", fileName);

      const response = await openai.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Extrage tot textul vizibil din această imagine scanată. Răspunde doar cu textul extras, fără explicații, fără markdown.",
              },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${base64File}`,
              },
            ],
          },
        ],
        max_output_tokens: 4000,
      });

      const extracted = getOpenAIResponseText(response);

      console.log("OPENAI OCR IMAGE LENGTH:", extracted.length);

      return extracted;
    }

    return "";
  } catch (error) {
    console.error("OPENAI OCR ERROR:", error.message);
    return "";
  }
}

async function createChunksWithEmbeddings({ chunks, owner, documentId }) {
  if (!chunks.length) return 0;

  let totalCreated = 0;

  for (let start = 0; start < chunks.length; start += EMBEDDING_CONCURRENCY) {
    const batch = chunks.slice(start, start + EMBEDDING_CONCURRENCY);

    const chunkDocs = await Promise.all(
      batch.map(async (chunkText, batchIndex) => {
        const chunkIndex = start + batchIndex;

        console.log("PROCESSING CHUNK:", chunkIndex + 1, "/", chunks.length);

        const chunkEmbedding = await embedText(chunkText);

        if (!chunkEmbedding || !Array.isArray(chunkEmbedding)) {
          throw new Error(`Embedding invalid pentru chunk-ul ${chunkIndex}`);
        }

        return {
          owner,
          document: documentId,
          chunkIndex,
          text: chunkText,
          embedding: chunkEmbedding,
        };
      })
    );

    await DocumentChunk.insertMany(chunkDocs);
    totalCreated += chunkDocs.length;

    console.log(
      "CHUNK BATCH SAVED:",
      totalCreated,
      "/",
      chunks.length,
      "for document",
      documentId.toString()
    );
  }

  return totalCreated;
}

async function processDocumentInBackground({
  documentId,
  owner,
  buffer,
  mimeType,
  fileName,
}) {
  try {
    console.log("BACKGROUND PROCESS START:", documentId.toString());

    await Document.findOneAndUpdate(
      { _id: documentId, owner },
      {
        processingStatus: "processing",
        processingError: "",
        classificationStatus: "pending",
      }
    );

    let text = await extractText({
      buffer,
      mimeType,
    });

    console.log("TEXT EXTRAS LENGTH:", text?.length || 0);

    if (!text || !text.trim() || text.trim().length < MIN_TEXT_LENGTH_FOR_AI) {
      console.log("TEXT EMPTY OR TOO SHORT. TRYING OPENAI OCR...");

      const ocrText = await extractTextWithOpenAIOCR({
        buffer,
        mimeType,
        fileName,
      });

      if (ocrText && ocrText.trim()) {
        text = ocrText;
      }

      console.log("TEXT AFTER OPENAI OCR LENGTH:", text?.length || 0);
    }

    let classification = {
      category: "altul",
      documentDate: null,
      year: null,
      month: null,
      supplier: "",
      totalAmount: null,
      currency: "RON",
      tags: [],
      aiSummary: text?.trim()
        ? ""
        : "Document încărcat, dar nu s-a putut extrage text suficient pentru clasificare.",
      classificationConfidence: 0,
      classificationStatus: text?.trim() ? "pending" : "failed",
    };

    if (text && text.trim()) {
      console.log("CLASSIFYING DOCUMENT...");

      classification = await classifyDocument({
        text,
        fileName,
      });

      console.log("DOCUMENT CLASSIFICATION:", classification);
    } else {
      console.log("NO TEXT EXTRACTED. DOCUMENT WILL BE SAVED WITHOUT CHUNKS.");
    }

    const existingDoc = await Document.findOne({ _id: documentId, owner });

    if (!existingDoc) {
      console.log("DOCUMENT WAS DELETED BEFORE PROCESSING FINISHED:", documentId);
      return;
    }

    await Document.findOneAndUpdate(
      { _id: documentId, owner },
      {
        extractedText: text || "",
        category: classification.category,
        documentDate: classification.documentDate,
        year: classification.year,
        month: classification.month,
        supplier: classification.supplier,
        totalAmount: classification.totalAmount,
        currency: classification.currency,
        tags: classification.tags,
        aiSummary: classification.aiSummary,
        classificationConfidence: classification.classificationConfidence,
        classificationStatus: classification.classificationStatus,
      }
    );

    await DocumentChunk.deleteMany({
      document: documentId,
      owner,
    });

    const chunks = splitTextIntoChunks(text || "");

    console.log("CHUNKS CREATED:", chunks.length);

    if (chunks.length > 0) {
      await createChunksWithEmbeddings({
        chunks,
        owner,
        documentId,
      });
    }

    await Document.findOneAndUpdate(
      { _id: documentId, owner },
      {
        processingStatus: chunks.length > 0 || text?.trim() ? "done" : "failed",
        processingError:
          chunks.length > 0 || text?.trim()
            ? ""
            : "Nu s-a putut extrage text pentru procesarea AI.",
        processedAt: new Date(),
      }
    );

    console.log("BACKGROUND PROCESS DONE:", documentId.toString());
  } catch (error) {
    console.error("BACKGROUND PROCESS ERROR:", error);

    await Document.findOneAndUpdate(
      { _id: documentId, owner },
      {
        processingStatus: "failed",
        classificationStatus: "failed",
        processingError: error.message,
        processedAt: new Date(),
      }
    );
  }
}

// Upload document - rapid, cu procesare AI în fundal
router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "Lipsește fișierul (field: file).",
      });
    }

    console.log("UPLOAD START");
    console.log("FILE:", req.file.originalname, req.file.mimetype, req.file.size);
    console.log("USER:", req.user.userId);

    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${req.user.userId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("SUPABASE UPLOAD ERROR:", uploadError);
      throw new Error(uploadError.message);
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const doc = await Document.create({
      owner: req.user.userId,

      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: publicData.publicUrl,
        publicId: filePath,
      },

      extractedText: "",

      category: "altul",
      documentDate: null,
      year: null,
      month: null,
      supplier: "",
      totalAmount: null,
      currency: "RON",
      tags: [],
      aiSummary: "Documentul este în curs de procesare AI.",
      classificationConfidence: 0,
      classificationStatus: "pending",
      processingStatus: "processing",
      processingError: "",
      processedAt: null,
    });

    console.log("DOCUMENT SAVED QUICKLY:", doc._id.toString());

    res.status(202).json({
      ok: true,
      document: doc,
      processing: true,
      message:
        "Document încărcat cu succes. Analiza AI rulează în fundal și va apărea în arhivă când se finalizează.",
    });

    const bufferCopy = Buffer.from(req.file.buffer);

    setImmediate(() => {
      processDocumentInBackground({
        documentId: doc._id,
        owner: req.user.userId,
        buffer: bufferCopy,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
      }).catch((error) => {
        console.error("UNHANDLED BACKGROUND ERROR:", error);
      });
    });
  } catch (e) {
    console.error("UPLOAD ERROR:", e);

    res.status(500).json({
      ok: false,
      error: e.message,
    });
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

// Ask AI about user's documents using hybrid search
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
    const questionTerms = extractSearchTerms(question);

    const chunks = await DocumentChunk.find({
      owner: req.user.userId,
      embedding: { $exists: true, $ne: [] },
    }).populate("document");

    if (chunks.length === 0) {
      const processingCount = await Document.countDocuments({
        owner: req.user.userId,
        processingStatus: "processing",
      });

      if (processingCount > 0) {
        return res.json({
          ok: true,
          answer:
            "Documentele tale încă se procesează. Te rog așteaptă câteva momente și încearcă din nou.",
          sources: [],
        });
      }

      return res.json({
        ok: true,
        answer:
          "Nu există documente procesate pentru acest cont. Încarcă documente noi pentru a putea pune întrebări pe baza lor.",
        sources: [],
      });
    }

    const rankedAllChunks = chunks
      .map((chunk) => {
        const document = chunk.document;

        if (!document) return null;

        const searchableText = `
          ${document.file?.originalName || ""}
          ${document.category || ""}
          ${document.supplier || ""}
          ${document.year || ""}
          ${document.month || ""}
          ${document.totalAmount || ""}
          ${document.currency || ""}
          ${(document.tags || []).join(" ")}
          ${chunk.text || ""}
        `;

        const semanticScore = cosineSimilarity(
          questionEmbedding,
          chunk.embedding
        );

        const keywordScore = keywordMatchScore(questionTerms, searchableText);

        const finalScore = semanticScore * 0.65 + keywordScore * 0.35;

        return {
          chunk,
          document,
          semanticScore,
          keywordScore,
          score: finalScore,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const groupedByDocument = new Map();

    for (const item of rankedAllChunks) {
      const documentId = item.document._id.toString();

      if (!groupedByDocument.has(documentId)) {
        groupedByDocument.set(documentId, []);
      }

      const documentItems = groupedByDocument.get(documentId);

      if (documentItems.length < 4) {
        documentItems.push(item);
      }
    }

    const rankedChunks = Array.from(groupedByDocument.values())
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, 24);

    const context = rankedChunks
      .map((item, index) => {
        return `
FRAGMENT ${index + 1}
Document: ${item.document.file?.originalName}
Categorie: ${item.document.category || "necunoscut"}
Furnizor: ${item.document.supplier || "necunoscut"}
Data document: ${
          item.document.documentDate
            ? item.document.documentDate.toISOString().slice(0, 10)
            : "necunoscut"
        }
An: ${item.document.year || "necunoscut"}
Lună: ${item.document.month || "necunoscut"}
Total: ${item.document.totalAmount ?? "necunoscut"} ${
          item.document.currency || ""
        }
Fragment index: ${item.chunk.chunkIndex}
Scor final: ${item.score.toFixed(3)}
Scor semantic: ${item.semanticScore.toFixed(3)}
Scor potrivire exactă: ${item.keywordScore.toFixed(3)}

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
            "Ești un asistent AI pentru analizarea documentelor încărcate de utilizator. Răspunde strict pe baza fragmentelor și metadatelor primite. Dacă informația nu există în fragmente, spune clar că nu ai găsit-o. Răspunde în română, clar și organizat. Utilizatorul poate cere căutări de tip: facturi după furnizor, facturi după sumă, facturi după dată, comparații între facturi, totaluri sau extragere de date. Dacă întrebarea este despre facturi sau documente financiare, încearcă să extragi pentru fiecare document relevant: categoria, furnizorul, numărul facturii dacă apare, data, scadența dacă există, totalul fără TVA dacă există, TVA-ul dacă există, totalul de plată și moneda. Dacă sunt mai multe documente relevante, fă întâi analiza pe fiecare document, apoi o sinteză finală. Dacă utilizatorul cere calcule și datele există în fragmente sau metadate, calculează rezultatul. Nu inventa valori care nu apar în fragmente sau metadate.",
        },
        {
          role: "user",
          content: `
Întrebare:
${question}

Termeni extrași pentru căutare exactă:
${questionTerms.join(", ") || "Niciun termen extras"}

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
          category: item.document.category,
          supplier: item.document.supplier,
          year: item.document.year,
          month: item.document.month,
          totalAmount: item.document.totalAmount,
          currency: item.document.currency,
          processingStatus: item.document.processingStatus,
        });
      }
    }

    res.json({
      ok: true,
      answer: completion.choices[0].message.content,
      sources: uniqueSources,
    });
  } catch (err) {
    console.error("ASK AI ERROR:", err);

    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

module.exports = router;
