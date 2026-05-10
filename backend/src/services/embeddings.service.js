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
module.exports = {
  embedText,
  cosineSimilarity,
};

