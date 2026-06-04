const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeCategory(category) {
  const allowedCategories = [
    "factura",
    "bon",
    "nir",
    "contract",
    "extras_bancar",
    "declaratie",
    "stat_plata",
    "chitanta",
    "altul",
  ];

  if (!category || !allowedCategories.includes(category)) {
    return "altul";
  }

  return category;
}

function buildDateFields(documentDate) {
  if (!documentDate) {
    return {
      documentDate: null,
      year: null,
      month: null,
    };
  }

  const parsedDate = new Date(documentDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      documentDate: null,
      year: null,
      month: null,
    };
  }

  return {
    documentDate: parsedDate,
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth() + 1,
  };
}

async function classifyDocument({ text, fileName }) {
  try {
    if (!text || !text.trim()) {
      return {
        category: "altul",
        documentDate: null,
        year: null,
        month: null,
        supplier: "",
        totalAmount: null,
        currency: "RON",
        tags: [],
        aiSummary: "",
        classificationConfidence: 0,
        classificationStatus: "failed",
      };
    }

    const shortText = text.slice(0, 6000);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
Ești un sistem de clasificare pentru documente contabile românești.

Primești numele fișierului și textul extras din document.
Trebuie să întorci DOAR JSON valid, fără explicații, fără markdown.

Categorii permise:
- factura
- bon
- nir
- contract
- extras_bancar
- declaratie
- stat_plata
- chitanta
- altul

Reguli:
- Pentru facturi, furnizorul este de obicei emitentul documentului.
- Pentru bonuri, încearcă să identifici comerciantul.
- Pentru NIR, categoria este "nir".
- Dacă nu ești sigur, folosește "altul".
- documentDate trebuie să fie în format ISO YYYY-MM-DD sau null.
- totalAmount trebuie să fie număr, fără simbol de monedă, sau null.
- currency să fie "RON", "EUR", "USD" sau alt cod dacă apare clar.
- tags trebuie să fie listă scurtă de etichete utile.
- confidence trebuie să fie număr între 0 și 1.

Structură JSON obligatorie:
{
  "category": "factura",
  "documentDate": "2026-01-15",
  "supplier": "Nume furnizor",
  "totalAmount": 123.45,
  "currency": "RON",
  "tags": ["tva", "servicii"],
  "summary": "Rezumat scurt",
  "confidence": 0.9
}
          `,
        },
        {
          role: "user",
          content: `
Nume fișier:
${fileName || "necunoscut"}

Text extras:
${shortText}
          `,
        },
      ],
    });

    const rawContent = completion.choices[0].message.content || "";
    const parsed = safeJsonParse(rawContent);

    if (!parsed) {
      return {
        category: "altul",
        documentDate: null,
        year: null,
        month: null,
        supplier: "",
        totalAmount: null,
        currency: "RON",
        tags: [],
        aiSummary: "",
        classificationConfidence: 0,
        classificationStatus: "failed",
      };
    }

    const dateFields = buildDateFields(parsed.documentDate);

    return {
      category: normalizeCategory(parsed.category),
      ...dateFields,
      supplier: parsed.supplier || "",
      totalAmount:
        typeof parsed.totalAmount === "number" ? parsed.totalAmount : null,
      currency: parsed.currency || "RON",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
      aiSummary: parsed.summary || "",
      classificationConfidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0,
      classificationStatus: "classified",
    };
  } catch (error) {
    console.error("CLASSIFY DOCUMENT ERROR:", error.message);

    return {
      category: "altul",
      documentDate: null,
      year: null,
      month: null,
      supplier: "",
      totalAmount: null,
      currency: "RON",
      tags: [],
      aiSummary: "",
      classificationConfidence: 0,
      classificationStatus: "failed",
    };
  }
}

module.exports = { classifyDocument };