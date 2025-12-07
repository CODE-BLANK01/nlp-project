// src/utils/embeddings.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Embed a single text
 */
export async function embedText(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string");
  }

  console.log(`🧠 Embedding single text (len=${text.length})...`);

  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });

  const vector = response.data[0].embedding;
  const literal = `[${vector.join(",")}]`;
  return { vector, literal };
}

/**
 * Embed many texts with batching + retry/backoff
 */
export async function embedTextBatch(texts, batchSize = 50) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("texts must be a non-empty array");
  }

  const startTime = Date.now();
  const totalBatches = Math.ceil(texts.length / batchSize);
  const results = [];

  console.log(`🧠 Embedding ${texts.length} chunks in ${totalBatches} batch(es)...`);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNo = Math.floor(i / batchSize) + 1;

    console.log(`📦 Batch ${batchNo}/${totalBatches} → ${batch.length} items`);

    let attempt = 0;
    while (true) {
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-large",
          input: batch,
        });

        response.data.forEach((item) => {
          const vector = item.embedding;
          const literal = `[${vector.join(",")}]`;
          results.push({ vector, literal });
        });

        console.log(`✅ Batch ${batchNo} completed`);
        break;
      } catch (err) {
        attempt++;
        if (err.code === "rate_limit_exceeded" || err.status === 429) {
          const wait = Math.min(3000 * attempt, 15000); // exponential backoff with cap
          console.warn(`⏳ Rate limited on batch ${batchNo}, attempt ${attempt}. Retrying in ${wait}ms...`);
          await delay(wait);
        } else {
          console.error(`❌ Failed batch ${batchNo}:`, err.message);
          throw err;
        }
      }
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`🎉 Completed embeddings: ${results.length} chunks in ${totalBatches} batch(es), ${elapsed}ms total`);

  return results;
}