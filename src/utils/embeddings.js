// // src/utils/embeddings.js
// import OpenAI from "openai";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// /**
//  * Embed a single text
//  */
// export async function embedText(text) {
//   if (!text || typeof text !== "string") {
//     throw new Error("Text must be a non-empty string");
//   }

//   console.log(`🧠 Embedding single text (len=${text.length})...`);

//   const response = await openai.embeddings.create({
//     model: "text-embedding-3-large",
//     input: text,
//   });

//   const vector = response.data[0].embedding;
//   const literal = `[${vector.join(",")}]`;
//   return { vector, literal };
// }

// /**
//  * Embed many texts with batching + retry/backoff
//  */
// export async function embedTextBatch(texts, batchSize = 50) {
//   if (!Array.isArray(texts) || texts.length === 0) {
//     throw new Error("texts must be a non-empty array");
//   }

//   const startTime = Date.now();
//   const totalBatches = Math.ceil(texts.length / batchSize);
//   const results = [];

//   console.log(`🧠 Embedding ${texts.length} chunks in ${totalBatches} batch(es)...`);

//   for (let i = 0; i < texts.length; i += batchSize) {
//     const batch = texts.slice(i, i + batchSize);
//     const batchNo = Math.floor(i / batchSize) + 1;

//     console.log(`📦 Batch ${batchNo}/${totalBatches} → ${batch.length} items`);

//     let attempt = 0;
//     while (true) {
//       try {
//         const response = await openai.embeddings.create({
//           model: "text-embedding-3-large",
//           input: batch,
//         });

//         response.data.forEach((item) => {
//           const vector = item.embedding;
//           const literal = `[${vector.join(",")}]`;
//           results.push({ vector, literal });
//         });

//         console.log(`✅ Batch ${batchNo} completed`);
//         break;
//       } catch (err) {
//         attempt++;
//         if (err.code === "rate_limit_exceeded" || err.status === 429) {
//           const wait = Math.min(3000 * attempt, 15000); // exponential backoff with cap
//           console.warn(`⏳ Rate limited on batch ${batchNo}, attempt ${attempt}. Retrying in ${wait}ms...`);
//           await delay(wait);
//         } else {
//           console.error(`❌ Failed batch ${batchNo}:`, err.message);
//           throw err;
//         }
//       }
//     }
//   }

//   const elapsed = Date.now() - startTime;
//   console.log(`🎉 Completed embeddings: ${results.length} chunks in ${totalBatches} batch(es), ${elapsed}ms total`);

//   return results;
// }

// src/utils/embeddings.js

// If you're on Node 18+ you have global fetch.
// If not, uncomment and `npm i node-fetch`.
// import fetch from "node-fetch";

// const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
// const EMBED_MODEL = process.env.EMBED_MODEL || "bge-large";

// const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// /**
//  * Embed a single text using Ollama embeddings
//  */
// export async function embedText(text) {
//   try {
//     if (!text || typeof text !== "string") {
//     throw new Error("Text must be a non-empty string");
//   }

//   console.log(`🧠 Embedding single text (len=${text.length})...`);

//   const resp = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       model: EMBED_MODEL,
//       prompt: text,   // 👈 single string
//     }),
//   });

//   if (!resp.ok) {
//     const body = await resp.text();
//     console.error("[embedText] Ollama HTTP error:", resp.status, body);
//     throw new Error(`Ollama embeddings error: ${resp.status}`);
//   }

//   const data = await resp.json();
//   const vector = data.embedding || data.embeddings?.[0];

//   if (!vector) {
//     throw new Error("No embedding returned from Ollama");
//   }

//   const literal = `[${vector.join(",")}]`;
//   return { vector, literal };

    
//   } catch (e) {
//   console.error("[ask] Embedding failed:", e.message);
//   return res.status(503).json({
//     ok: false,
//     error: "embedding_unavailable",
//     details: "Could not connect to local embedding model. Is Ollama running on OLLAMA_BASE_URL?"
//   });
// }
// }

// /**
//  * Embed many texts with retry/backoff.
//  * NOTE: We now embed ONE TEXT PER REQUEST because Ollama expects `prompt` to be a string, not an array.
//  */
// export async function embedTextBatch(texts, batchSize = 50) {
//   if (!Array.isArray(texts) || texts.length === 0) {
//     throw new Error("texts must be a non-empty array");
//   }

//   const startTime = Date.now();
//   const results = [];

//   console.log(`🧠 Embedding ${texts.length} chunks (1 request per chunk)...`);

//   for (let i = 0; i < texts.length; i++) {
//     const text = texts[i];
//     const idx = i + 1;

//     let attempt = 0;
//     while (true) {
//       try {
//         // console.log(`📦 Embedding chunk ${idx}/${texts.length}`);
//         const { vector, literal } = await embedText(text);
//         results.push({ vector, literal });
//         break;
//       } catch (err) {
//         attempt++;
//         const wait = Math.min(3000 * attempt, 15000);
//         console.warn(
//           `⏳ Error embedding chunk ${idx}/${texts.length}, attempt ${attempt}. Retrying in ${wait}ms...`,
//           err.message
//         );
//         await delay(wait);
//       }
//     }

//     // Optional: progress log every batchSize items
//     if (idx % batchSize === 0 || idx === texts.length) {
//       console.log(`✅ Progress: ${idx}/${texts.length} chunks embedded`);
//     }
//   }

//   const elapsed = Date.now() - startTime;
//   console.log(
//     `🎉 Completed embeddings: ${results.length} chunks in ${elapsed}ms`
//   );

//   return results;
// }

// src/utils/embeddings.js
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBED_MODEL = process.env.EMBED_MODEL || "bge-large";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Embed a single text using Ollama embeddings
 */
export async function embedText(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Text must be a non-empty string");
  }

  console.log(`🧠 Embedding single text (len=${text.length})...`);
  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBED_MODEL,
        prompt: text, // single string
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("[embedText] Ollama HTTP error:", resp.status, body);
      throw new Error(`Ollama embeddings error: ${resp.status}`);
    }

    const data = await resp.json();
    const vector = data.embedding || data.embeddings?.[0];

    if (!vector) {
      throw new Error("No embedding returned from Ollama");
    }

    const literal = `[${vector.join(",")}]`;
    return { vector, literal };
  } catch (e) {
    console.error("[embedText] Embedding failed:", e.message);
    // IMPORTANT: rethrow so the caller (ask.js) can handle it
    throw e;
  }
}

/**
 * Embed many texts with retry/backoff.
 * NOTE: We embed ONE TEXT PER REQUEST because Ollama expects `prompt` to be a string.
 */
export async function embedTextBatch(texts, batchSize = 50) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("texts must be a non-empty array");
  }

  const startTime = Date.now();
  const results = [];

  console.log(`🧠 Embedding ${texts.length} chunks (1 request per chunk)...`);

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const idx = i + 1;

    let attempt = 0;
    // retry with backoff
    while (true) {
      try {
        const { vector, literal } = await embedText(text);
        results.push({ vector, literal });
        break;
      } catch (err) {
        attempt++;
        const wait = Math.min(3000 * attempt, 15000);
        console.warn(
          `⏳ Error embedding chunk ${idx}/${texts.length}, attempt ${attempt}. Retrying in ${wait}ms...`,
          err.message
        );
        await delay(wait);
      }
    }

    if (idx % batchSize === 0 || idx === texts.length) {
      console.log(`✅ Progress: ${idx}/${texts.length} chunks embedded`);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `🎉 Completed embeddings: ${results.length} chunks in ${elapsed}ms`
  );

  return results;
}