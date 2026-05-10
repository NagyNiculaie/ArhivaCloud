const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function embedText(text) {
  const input = (text || "").slice(0, 8000); // limit simplu pt MVP
  if (!input.trim()) return [];

  const resp = await client.embeddings.create({
    model: "text-embedding-3-small",
    input,
  });

  return resp.data?.[0]?.embedding || [];
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
module.exports = {
  embedText,
  cosineSimilarity,
};
