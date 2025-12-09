// // // src/routes/ask.js
// // import express from "express";
// // import { prisma } from "../prisma.js";
// // import { embedText } from "../utils/embeddings.js";

// // const router = express.Router();

// // // If you're on Node 18+ you have global fetch.
// // // If not, uncomment this line and `npm i node-fetch` and use it.
// // // import fetch from "node-fetch";

// // const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
// // const LLM_MODEL = process.env.LLM_MODEL || "llama3.2:3b";

// // // Cosine distance threshold: lower = more similar.
// // // If the *best* score is higher than this, we treat it as "no relevant docs".
// // const SCORE_THRESHOLD = parseFloat(process.env.SCORE_THRESHOLD || "0.2");

// // // --------------------
// // // Safe JSON Parse (with auto-repair)
// // // --------------------
// // function safeJSONParse(raw, label = "unknown") {
// //   if (!raw) return null;
// //   try {
// //     return JSON.parse(raw);
// //   } catch (err) {
// //     console.warn(`[safeJSONParse] Failed initial parse for ${label}:`, err.message);
// //     try {
// //       const fixed = raw
// //         .replace(/,\s*]/g, "]")
// //         .replace(/,\s*}/g, "}")
// //         .replace(/\n/g, " ")
// //         .trim();
// //       return JSON.parse(fixed);
// //     } catch (err2) {
// //       console.error(`[safeJSONParse] Second attempt failed for ${label}:`, err2.message);
// //       return null;
// //     }
// //   }
// // }

// // // --------------------
// // // Single LLM call - Answer generation (Ollama)
// // // --------------------
// // async function answerWithLLM(question, expanded) {
// //   const context = expanded
// //     .map(
// //       (h, i) =>
// //         `Source ${i + 1}${h.documentTitle ? ` [${h.documentTitle}]` : ""}:\n${h.content}`
// //     )
// //     .join("\n\n");

// //   const SYSTEM_PROMPT = `
// // You are a helpful Workday specialist having a conversation with an HRIS professional.
// // Your goal is to provide clear, practical answers in a conversational but professional tone.

// // CRITICAL GROUNDING RULES:
// // - You MUST treat the provided "Context from Workday documentation" as the ONLY source of truth.
// // - You MUST NOT use any Workday knowledge outside this context (no world knowledge, no training data, no memory).
// // - You MUST NOT invent:
// //   - Workday task names
// //   - Navigation paths (like "Edit Tenant Setup - Security > ...")
// //   - Checkbox/field names
// //   - Document titles or report names
// // - You may only mention:
// //   - Task names, fields, checkboxes, and navigation paths that appear VERBATIM in the context.
// // - If the context doesn't show an exact path or task name, speak GENERICALLY (e.g., "from the authentication policy configuration") instead of fabricating a path.

// // PARTIAL COVERAGE RULE:
// // - If the context covers ONLY PART of the user's question:
// //   - Answer the parts that ARE covered by the context.
// //   - For anything NOT covered (for example, specific numbers like "every 12 months" or fields that are not shown), you MUST explicitly say: "The provided documentation does not specify <X>."
// // - You MUST NOT guess missing values or behaviors.
// // - You MUST NEVER use outside knowledge (for example, general Workday experience or world facts).

// // REFUSAL RULE:
// // - If the retrieved context is clearly unrelated to the question, or contains no information you can reasonably use:
// //   - You MUST NOT try to answer the question.
// //   - You MUST respond that you cannot answer based on the provided documentation.
// // `;

// //   const USER_PROMPT = `
// // User question:
// // """${question}"""

// // Context from Workday documentation:
// // ${context}

// // Return STRICTLY valid JSON with this schema (no extra keys):

// // {
// //   "answer": "3-4 sentences that directly address their question in a conversational way. Use 'you' and 'your'. Explain what this does and when they'd use it. Be specific about what happens in Workday, but ONLY based on what appears in the context. If some aspect of the question is not covered by the context, explicitly say that the documentation excerpt does not specify that part.",
  
// //   "main_steps": [
// //     "4-6 key steps, each 1-2 sentences. Only include Workday task names or navigation paths if they appear VERBATIM in the context text above.",
// //     "If the context doesn't show an exact task or path, describe the step generically (for example: 'From the authentication policy configuration, select the Network Denylist field...') without naming a specific task that isn't in the context."
// //   ],
  
// //   "prerequisites": [
// //     "List any required security permissions, business process configurations, or settings that are explicitly mentioned in the context. Use the exact wording from the doc where possible. If none mentioned, return empty array."
// //   ],
  
// //   "important_notes": [
// //     "3-7 critical limitations, restrictions, or behaviors that are explicitly in the context. Focus on things that would surprise them or block their work.",
// //     "If none found in the context, return empty array."
// //   ],
  
// //   "related_topics": [
// //     "2-5 related Workday features, tasks, or business processes that are explicitly named in the context. Format as: 'Task/Feature Name - Brief description of how it relates'.",
// //     "If none found, return empty array."
// //   ],
  
// //   "clarification_note": "If the question is ambiguous or could mean different things, provide a brief 1-2 sentence note explaining the ambiguity. If no ambiguity based on the context, return empty string.",
  
// //   "for_admins": true,
  
// //   "confidence": {
// //     "level": "high|medium|low",
// //     "reason": "1 sentence explaining confidence. High = context fully covers question. Medium = covers main points but missing details. Low = context is incomplete or only partially relevant."
// //   }
// // }

// // ADDITIONAL RULES:
// // - Respond with ONLY a single JSON object.
// // - Do NOT wrap the JSON in backticks.
// // - Do NOT add any explanation before or after the JSON.
// // - Every field must be present.
// // - Arrays must be valid JSON arrays.
// // - Do NOT mention any document titles or sources in this JSON. The caller will handle sources separately.
// // `;

// //   try {
// //     const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
// //       method: "POST",
// //       headers: { "Content-Type": "application/json" },
// //       body: JSON.stringify({
// //         model: LLM_MODEL,
// //         stream: false,
// //         format: "json", // force JSON output from Ollama
// //         messages: [
// //           { role: "system", content: SYSTEM_PROMPT },
// //           { role: "user", content: USER_PROMPT },
// //         ],
// //         options: {
// //           temperature: 0.2,
// //           num_predict: 600,
// //         },
// //       }),
// //     });

// //     if (!resp.ok) {
// //       const text = await resp.text();
// //       console.error("[Answer error] Ollama HTTP error:", resp.status, text);
// //       throw new Error(`Ollama error: ${resp.status}`);
// //     }

// //     const data = await resp.json();

// //     let raw = data?.message?.content;
// //     let parsed;

// //     if (typeof raw === "string") {
// //       parsed = safeJSONParse(raw, "answer");
// //     } else if (typeof raw === "object" && raw !== null) {
// //       parsed = raw;
// //     }

// //     if (!parsed) {
// //       console.error("[Answer error] Could not parse JSON from LLM:", raw);
// //       return {
// //         answer:
// //           "I found relevant information in the Workday documentation, but had trouble formatting the response. Please try again.",
// //         main_steps: [],
// //         prerequisites: [],
// //         important_notes: [],
// //         related_topics: [],
// //         clarification_note: "",
// //         for_admins: false,
// //         confidence: { level: "low", reason: "Response formatting error" },
// //       };
// //     }

// //     return {
// //       answer: parsed.answer || "",
// //       main_steps: parsed.main_steps || [],
// //       prerequisites: parsed.prerequisites || [],
// //       important_notes: parsed.important_notes || [],
// //       related_topics: parsed.related_topics || [],
// //       clarification_note: parsed.clarification_note || "",
// //       for_admins:
// //         typeof parsed.for_admins === "boolean" ? parsed.for_admins : true,
// //       confidence:
// //         parsed.confidence || {
// //           level: "low",
// //           reason: "No confidence provided",
// //         },
// //     };
// //   } catch (err) {
// //     console.error("[Answer error]", err);
// //     return {
// //       answer:
// //         "I encountered an error processing your question based on the loaded Workday documentation. Please try again or rephrase it.",
// //       main_steps: [],
// //       prerequisites: [],
// //       important_notes: [],
// //       related_topics: [],
// //       clarification_note: "",
// //       for_admins: false,
// //       confidence: { level: "low", reason: "Generation error" },
// //     };
// //   }
// // }

// // // --------------------
// // // Main Ask route
// // // --------------------
// // router.post("/", async (req, res) => {
// //   const start = Date.now();
// //   try {
// //     const { question } = req.body;
// //     if (!question) {
// //       return res
// //         .status(400)
// //         .json({ ok: false, error: "question_required" });
// //     }

// //     console.log(`🧠 Question: "${question}"`);
// //     const qEmbed = await embedText(question);

// //     // 1️⃣ Retrieve top 5 chunks with cosine distance score
// //     // NOTE: score here is cosine *distance* (`<=>`), so LOWER = more similar.
// //     const hits = await prisma.$queryRaw`
// //       SELECT 
// //         c.id,
// //         c.content,
// //         c."documentId",
// //         d.title      AS "documentTitle",
// //         d."sourceUri",
// //         c."orderIndex",
// //         (c."embeddingVec" <=> ${qEmbed.literal}::vector) AS "score"
// //       FROM "Chunk" c
// //       JOIN "Document" d ON c."documentId" = d.id
// //       ORDER BY "score" ASC
// //       LIMIT 5;
// //     `;

// //     console.log(`📚 Retrieved ${hits.length} chunks`);

// //     // Normalize/shape hits for client
// //     const hitsWithScores = hits.map((h) => ({
// //       id: h.id,
// //       content: h.content,
// //       documentId: h.documentId,
// //       documentTitle: h.documentTitle,
// //       sourceUri: h.sourceUri,
// //       orderIndex: h.orderIndex,
// //       score: Number(h.score),
// //     }));

// //     // 2️⃣ Apply similarity threshold: if even the BEST score is above threshold,
// //     // treat this as "no relevant docs" and DO NOT call the LLM.
// //     let bestScore = Infinity;
// //     if (hitsWithScores.length > 0) {
// //       bestScore = Math.min(...hitsWithScores.map((h) => h.score));
// //     }

// //     console.log(`🔍 Best cosine distance score: ${bestScore}`);

// //     const hasRelevantDocs = hitsWithScores.length > 0 && bestScore <= SCORE_THRESHOLD;

// //     let expanded = [];
// //     let sources = [];

// //     if (hasRelevantDocs) {
// //       // 3️⃣ Build doc metadata map from hits
// //       const docMetaById = new Map();
// //       hitsWithScores.forEach((h) => {
// //         docMetaById.set(h.documentId, {
// //           documentTitle: h.documentTitle,
// //           sourceUri: h.sourceUri,
// //         });
// //       });

// //       // 4️⃣ Expand around the top 3 hits (neighbors by orderIndex)
// //       const seenChunkIds = new Set();
// //       const topHits = hitsWithScores.slice(0, 3);

// //       for (const h of topHits) {
// //         const neighbors = await prisma.chunk.findMany({
// //           where: { documentId: h.documentId },
// //           orderBy: { orderIndex: "asc" },
// //           skip: Math.max(h.orderIndex - 1, 0),
// //           take: 3, // previous + current + next
// //           select: {
// //             id: true,
// //             content: true,
// //             documentId: true,
// //             orderIndex: true,
// //           },
// //         });

// //         neighbors.forEach((chunk) => {
// //           if (!seenChunkIds.has(chunk.id)) {
// //             seenChunkIds.add(chunk.id);
// //             const meta = docMetaById.get(chunk.documentId) || {};
// //             expanded.push({
// //               id: chunk.id,
// //               content: chunk.content,
// //               documentId: chunk.documentId,
// //               orderIndex: chunk.orderIndex,
// //               documentTitle: meta.documentTitle || null,
// //               sourceUri: meta.sourceUri || null,
// //             });
// //           }
// //         });
// //       }

// //       console.log(`📚 Expanded to ${expanded.length} chunks`);

// //       // 5️⃣ Build sources list from actual chunks
// //       const sourcesMap = new Map();
// //       expanded.forEach((c) => {
// //         const key = c.documentId;
// //         if (!sourcesMap.has(key)) {
// //           sourcesMap.set(key, {
// //             documentId: c.documentId,
// //             title: c.documentTitle,
// //             sourceUri: c.sourceUri,
// //           });
// //         }
// //       });
// //       sources = Array.from(sourcesMap.values());
// //     } else {
// //       console.log(
// //         `🚫 No chunks passed similarity threshold (bestScore=${bestScore}, threshold=${SCORE_THRESHOLD}).`
// //       );
// //     }

// //     const elapsed = Date.now() - start;

// //     // 6️⃣ If we have NO relevant docs, refuse gracefully WITHOUT calling the LLM
// //     if (!hasRelevantDocs || expanded.length === 0) {
// //       return res.json({
// //         ok: true,
// //         // Very explicit, no hallucinations:
// //         answer:
// //           "I'm only allowed to answer using the Workday documentation that has been indexed for this assistant. For your question, the retrieval step did not find any content that is similar enough, so I can't answer this without guessing.",
// //         main_steps: [],
// //         prerequisites: [],
// //         important_notes: [],
// //         related_topics: [],
// //         clarification_note:
// //           "This question appears to be outside the scope of the loaded Workday documentation, or it doesn't closely match any indexed content.",
// //         for_admins: false,
// //         confidence: {
// //           level: "low",
// //           reason:
// //             "No retrieved chunks passed the cosine similarity threshold; answering would require hallucinating beyond the documentation.",
// //         },

// //         // Retrieval info for TA review
// //         hits: hitsWithScores,
// //         expanded: [],
// //         sources,
// //         time: `${elapsed}ms`,
// //       });
// //     }

// //     // 7️⃣ Generate answer from LLM with RAG context (STRICTLY grounded)
// //     const answer = await answerWithLLM(question, expanded);

// //     // 8️⃣ Return everything (answer + retrieved chunks) for explainability & citations
// //     res.json({
// //       ok: true,

// //       // LLM answer
// //       answer: answer.answer,
// //       main_steps: answer.main_steps,
// //       prerequisites: answer.prerequisites,
// //       important_notes: answer.important_notes,
// //       related_topics: answer.related_topics,
// //       clarification_note: answer.clarification_note,
// //       for_admins: answer.for_admins,
// //       confidence: answer.confidence,

// //       // Retrieval info for frontend / TA explainability
// //       hits: hitsWithScores,
// //       expanded,
// //       sources,

// //       time: `${elapsed}ms`,
// //     });
// //   } catch (err) {
// //     console.error("[ask error]", err);
// //     res.status(500).json({
// //       ok: false,
// //       error: "ask_failed",
// //       details: err.message,
// //     });
// //   }
// // });

// // export default router;


// // src/routes/ask.js
// import express from "express";
// import { prisma } from "../prisma.js";
// import { embedText } from "../utils/embeddings.js";

// const router = express.Router();

// // =============================================================================
// // Configuration
// // =============================================================================
// const CONFIG = {
//   ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
//   llmModel: process.env.LLM_MODEL || "llama3.2:3b",
//   scoreThreshold: parseFloat(process.env.SCORE_THRESHOLD || "0.2"),
//   maxQuestionLength: parseInt(process.env.MAX_QUESTION_LENGTH || "2000", 10),
//   llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10),
//   topHitsForExpansion: 3,
//   maxRetrievedChunks: 5,
// };

// // =============================================================================
// // Simple In-Memory Cache (consider Redis for production)
// // =============================================================================
// class SimpleCache {
//   constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
//     this.cache = new Map();
//     this.maxSize = maxSize;
//     this.ttlMs = ttlMs;
//   }

//   get(key) {
//     const entry = this.cache.get(key);
//     if (!entry) return null;
//     if (Date.now() > entry.expiresAt) {
//       this.cache.delete(key);
//       return null;
//     }
//     return entry.value;
//   }

//   set(key, value) {
//     // Evict oldest if at capacity
//     if (this.cache.size >= this.maxSize) {
//       const oldestKey = this.cache.keys().next().value;
//       this.cache.delete(oldestKey);
//     }
//     this.cache.set(key, {
//       value,
//       expiresAt: Date.now() + this.ttlMs,
//     });
//   }
// }

// const embeddingCache = new SimpleCache(100, 10 * 60 * 1000); // 10 min TTL

// // =============================================================================
// // Logger (swap for winston/pino in production)
// // =============================================================================
// const logger = {
//   info: (...args) => console.log(`[INFO]`, ...args),
//   warn: (...args) => console.warn(`[WARN]`, ...args),
//   error: (...args) => console.error(`[ERROR]`, ...args),
//   debug: process.env.NODE_ENV === "development" 
//     ? (...args) => console.log(`[DEBUG]`, ...args)
//     : () => {},
// };

// // =============================================================================
// // Input Validation
// // =============================================================================
// function validateQuestion(question) {
//   if (!question || typeof question !== "string") {
//     return { valid: false, error: "question_required" };
//   }

//   const trimmed = question.trim();
//   if (trimmed.length === 0) {
//     return { valid: false, error: "question_empty" };
//   }

//   if (trimmed.length > CONFIG.maxQuestionLength) {
//     return { 
//       valid: false, 
//       error: "question_too_long",
//       message: `Question exceeds ${CONFIG.maxQuestionLength} characters`,
//     };
//   }

//   return { valid: true, question: trimmed };
// }

// // =============================================================================
// // Safe JSON Parse (with auto-repair)
// // =============================================================================
// function safeJSONParse(raw, label = "unknown") {
//   if (!raw) return null;

//   // If already an object, return it
//   if (typeof raw === "object") return raw;

//   try {
//     return JSON.parse(raw);
//   } catch (err) {
//     logger.warn(`[safeJSONParse] Failed initial parse for ${label}:`, err.message);

//     try {
//       // Attempt basic repairs
//       let fixed = raw
//         .replace(/,\s*]/g, "]")       // trailing commas in arrays
//         .replace(/,\s*}/g, "}")       // trailing commas in objects
//         .replace(/[\r\n]+/g, " ")     // newlines to spaces
//         .replace(/\t/g, " ")          // tabs to spaces
//         .trim();

//       // Try to extract JSON if wrapped in markdown code blocks
//       const jsonMatch = fixed.match(/```(?:json)?\s*([\s\S]*?)```/);
//       if (jsonMatch) {
//         fixed = jsonMatch[1].trim();
//       }

//       return JSON.parse(fixed);
//     } catch (err2) {
//       logger.error(`[safeJSONParse] Repair failed for ${label}:`, err2.message);
//       logger.debug(`[safeJSONParse] Raw content:`, raw.substring(0, 500));
//       return null;
//     }
//   }
// }

// // =============================================================================
// // Embedding Service
// // =============================================================================
// async function getQuestionEmbedding(question) {
//   // Check cache first
//   const cached = embeddingCache.get(question);
//   if (cached) {
//     logger.debug("Using cached embedding");
//     return cached;
//   }

//   const embedding = await embedText(question);
//   embeddingCache.set(question, embedding);
//   return embedding;
// }

// // =============================================================================
// // Retrieval Service
// // =============================================================================
// async function retrieveChunks(embedding) {
//   // Using parameterized query properly
//   // Ensure embedding is an array of numbers
//   const vectorArray = Array.isArray(embedding) ? embedding : embedding.vector;
  
//   if (!vectorArray || !Array.isArray(vectorArray)) {
//     throw new Error("Invalid embedding format");
//   }

//   const vectorString = `[${vectorArray.join(",")}]`;

//   const hits = await prisma.$queryRaw`
//     SELECT 
//       c.id,
//       c.content,
//       c."documentId",
//       d.title AS "documentTitle",
//       d."sourceUri",
//       c."orderIndex",
//       (c."embeddingVec" <=> ${vectorString}::vector) AS "score"
//     FROM "Chunk" c
//     JOIN "Document" d ON c."documentId" = d.id
//     ORDER BY "score" ASC
//     LIMIT ${CONFIG.maxRetrievedChunks};
//   `;

//   return hits.map((h) => ({
//     id: h.id,
//     content: h.content,
//     documentId: h.documentId,
//     documentTitle: h.documentTitle,
//     sourceUri: h.sourceUri,
//     orderIndex: h.orderIndex,
//     score: Number(h.score),
//   }));
// }

// // =============================================================================
// // Chunk Expansion Service
// // =============================================================================
// async function expandChunks(hits, docMetaById) {
//   const seenChunkIds = new Set();
//   const expanded = [];
//   const topHits = hits.slice(0, CONFIG.topHitsForExpansion);

//   for (const h of topHits) {
//     // Fixed: Use proper range query instead of skip/take
//     const neighbors = await prisma.chunk.findMany({
//       where: {
//         documentId: h.documentId,
//         orderIndex: {
//           gte: Math.max(h.orderIndex - 1, 0),
//           lte: h.orderIndex + 1,
//         },
//       },
//       orderBy: { orderIndex: "asc" },
//       select: {
//         id: true,
//         content: true,
//         documentId: true,
//         orderIndex: true,
//       },
//     });

//     for (const chunk of neighbors) {
//       if (!seenChunkIds.has(chunk.id)) {
//         seenChunkIds.add(chunk.id);
//         const meta = docMetaById.get(chunk.documentId) || {};
//         expanded.push({
//           id: chunk.id,
//           content: chunk.content,
//           documentId: chunk.documentId,
//           orderIndex: chunk.orderIndex,
//           documentTitle: meta.documentTitle || null,
//           sourceUri: meta.sourceUri || null,
//         });
//       }
//     }
//   }

//   return expanded;
// }

// // =============================================================================
// // LLM Prompts
// // =============================================================================
// const SYSTEM_PROMPT = `
// You are a helpful Workday specialist having a conversation with an HRIS professional.
// Your goal is to provide clear, practical answers in a conversational but professional tone.

// CRITICAL GROUNDING RULES:
// - You MUST treat the provided "Context from Workday documentation" as the ONLY source of truth.
// - You MUST NOT use any Workday knowledge outside this context.
// - You MUST NOT invent task names, navigation paths, checkbox/field names, or document titles.
// - You may only mention items that appear VERBATIM in the context.
// - If the context doesn't show an exact path or task name, speak GENERICALLY.

// PARTIAL COVERAGE RULE:
// - If the context covers ONLY PART of the question, answer what IS covered.
// - For anything NOT covered, explicitly say: "The provided documentation does not specify <X>."
// - NEVER guess missing values or use outside knowledge.

// REFUSAL RULE:
// - If the context is clearly unrelated or contains no usable information, refuse to answer.
// `.trim();

// function buildUserPrompt(question, context) {
//   return `
// User question:
// """${question}"""

// Context from Workday documentation:
// ${context}

// Return STRICTLY valid JSON with this schema (no extra keys):

// {
//   "answer": "3-4 sentences that directly address their question. Use 'you' and 'your'. Be specific but ONLY based on context. If something isn't covered, say so explicitly.",
  
//   "main_steps": [
//     "4-6 key steps, each 1-2 sentences. Only include task names/paths if they appear VERBATIM in context."
//   ],
  
//   "prerequisites": [
//     "Required permissions or configurations explicitly mentioned. Empty array if none."
//   ],
  
//   "important_notes": [
//     "3-7 critical limitations or behaviors from the context. Empty array if none."
//   ],
  
//   "related_topics": [
//     "2-5 related features explicitly named in context. Format: 'Name - Brief description'. Empty array if none."
//   ],
  
//   "clarification_note": "If ambiguous, explain in 1-2 sentences. Empty string if clear.",
  
//   "for_admins": true,
  
//   "confidence": {
//     "level": "high|medium|low",
//     "reason": "1 sentence. High = fully covered. Medium = partial. Low = incomplete."
//   }
// }

// RULES:
// - Respond with ONLY valid JSON, no backticks or explanation.
// - Every field must be present.
// - Arrays must be valid JSON arrays.
// `.trim();
// }

// // =============================================================================
// // LLM Service
// // =============================================================================
// async function callLLM(question, expanded) {
//   const context = expanded
//     .map(
//       (h, i) =>
//         `Source ${i + 1}${h.documentTitle ? ` [${h.documentTitle}]` : ""}:\n${h.content}`
//     )
//     .join("\n\n");

//   const userPrompt = buildUserPrompt(question, context);

//   // Create abort controller for timeout
//   const controller = new AbortController();
//   const timeoutId = setTimeout(() => controller.abort(), CONFIG.llmTimeoutMs);

//   try {
//     const resp = await fetch(`${CONFIG.ollamaBaseUrl}/api/chat`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       signal: controller.signal,
//       body: JSON.stringify({
//         model: CONFIG.llmModel,
//         stream: false,
//         format: "json",
//         messages: [
//           { role: "system", content: SYSTEM_PROMPT },
//           { role: "user", content: userPrompt },
//         ],
//         options: {
//           temperature: 0.2,
//           num_predict: 1200, // Increased from 600
//         },
//       }),
//     });

//     clearTimeout(timeoutId);

//     if (!resp.ok) {
//       const text = await resp.text();
//       logger.error("[LLM] HTTP error:", resp.status, text);
//       throw new Error(`Ollama error: ${resp.status}`);
//     }

//     const data = await resp.json();
//     const raw = data?.message?.content;
//     const parsed = safeJSONParse(raw, "llm_response");

//     if (!parsed) {
//       logger.error("[LLM] Could not parse response:", raw?.substring(0, 500));
//       return createErrorResponse("formatting");
//     }

//     return normalizeResponse(parsed);
//   } catch (err) {
//     clearTimeout(timeoutId);

//     if (err.name === "AbortError") {
//       logger.error("[LLM] Request timed out");
//       return createErrorResponse("timeout");
//     }

//     logger.error("[LLM] Error:", err);
//     return createErrorResponse("generation");
//   }
// }

// function normalizeResponse(parsed) {
//   return {
//     answer: parsed.answer || "",
//     main_steps: Array.isArray(parsed.main_steps) ? parsed.main_steps : [],
//     prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites : [],
//     important_notes: Array.isArray(parsed.important_notes) ? parsed.important_notes : [],
//     related_topics: Array.isArray(parsed.related_topics) ? parsed.related_topics : [],
//     clarification_note: parsed.clarification_note || "",
//     for_admins: typeof parsed.for_admins === "boolean" ? parsed.for_admins : true,
//     confidence: parsed.confidence || { level: "low", reason: "No confidence provided" },
//   };
// }

// function createErrorResponse(type) {
//   const messages = {
//     formatting: "I found relevant information but had trouble formatting the response. Please try again.",
//     timeout: "The request took too long to process. Please try a simpler question or try again later.",
//     generation: "I encountered an error processing your question. Please try again or rephrase it.",
//   };

//   return {
//     answer: messages[type] || messages.generation,
//     main_steps: [],
//     prerequisites: [],
//     important_notes: [],
//     related_topics: [],
//     clarification_note: "",
//     for_admins: false,
//     confidence: { level: "low", reason: `${type} error` },
//   };
// }

// function createNoResultsResponse() {
//   return {
//     answer: "I'm only allowed to answer using the Workday documentation that has been indexed. For your question, I couldn't find any content that's similar enough, so I can't answer without guessing.",
//     main_steps: [],
//     prerequisites: [],
//     important_notes: [],
//     related_topics: [],
//     clarification_note: "This question appears to be outside the scope of the loaded Workday documentation.",
//     for_admins: false,
//     confidence: {
//       level: "low",
//       reason: "No retrieved chunks passed the similarity threshold.",
//     },
//   };
// }

// // =============================================================================
// // Main Route Handler
// // =============================================================================
// router.post("/", async (req, res) => {
//   const start = Date.now();

//   try {
//     // 1. Validate input
//     const validation = validateQuestion(req.body?.question);
//     if (!validation.valid) {
//       return res.status(400).json({
//         ok: false,
//         error: validation.error,
//         message: validation.message,
//       });
//     }

//     const question = validation.question;
//     logger.info(`Question: "${question.substring(0, 100)}${question.length > 100 ? "..." : ""}"`);

//     // 2. Get embedding (with caching)
//     const embedding = await getQuestionEmbedding(question);

//     // 3. Retrieve chunks
//     const hits = await retrieveChunks(embedding);
//     logger.info(`Retrieved ${hits.length} chunks`);

//     // 4. Check similarity threshold
//     const bestScore = hits.length > 0 
//       ? Math.min(...hits.map((h) => h.score)) 
//       : Infinity;
    
//     logger.debug(`Best cosine distance: ${bestScore.toFixed(4)}, threshold: ${CONFIG.scoreThreshold}`);

//     const hasRelevantDocs = hits.length > 0 && bestScore <= CONFIG.scoreThreshold;

//     // 5. If no relevant docs, return early without LLM call
//     if (!hasRelevantDocs) {
//       logger.info("No chunks passed similarity threshold");
//       return res.json({
//         ok: true,
//         ...createNoResultsResponse(),
//         hits,
//         expanded: [],
//         sources: [],
//         time: `${Date.now() - start}ms`,
//       });
//     }

//     // 6. Build document metadata map
//     const docMetaById = new Map();
//     hits.forEach((h) => {
//       docMetaById.set(h.documentId, {
//         documentTitle: h.documentTitle,
//         sourceUri: h.sourceUri,
//       });
//     });

//     // 7. Expand chunks with neighbors
//     const expanded = await expandChunks(hits, docMetaById);
//     logger.info(`Expanded to ${expanded.length} chunks`);

//     if (expanded.length === 0) {
//       return res.json({
//         ok: true,
//         ...createNoResultsResponse(),
//         hits,
//         expanded: [],
//         sources: [],
//         time: `${Date.now() - start}ms`,
//       });
//     }

//     // 8. Build sources list
//     const sourcesMap = new Map();
//     expanded.forEach((c) => {
//       if (!sourcesMap.has(c.documentId)) {
//         sourcesMap.set(c.documentId, {
//           documentId: c.documentId,
//           title: c.documentTitle,
//           sourceUri: c.sourceUri,
//         });
//       }
//     });
//     const sources = Array.from(sourcesMap.values());

//     // 9. Call LLM
//     const answer = await callLLM(question, expanded);

//     // 10. Return response
//     res.json({
//       ok: true,
//       ...answer,
//       hits,
//       expanded,
//       sources,
//       time: `${Date.now() - start}ms`,
//     });

//   } catch (err) {
//     logger.error("[ask] Unhandled error:", err);
//     res.status(500).json({
//       ok: false,
//       error: "ask_failed",
//       message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
//     });
//   }
// });

// export default router;

// src/routes/ask.js
import express from "express";
import { prisma } from "../prisma.js";
import { embedText } from "../utils/embeddings.js";

const router = express.Router();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const LLM_MODEL = process.env.LLM_MODEL || "llama3.2:3b";

// Tune this to be as strict as you want
// cosine_distance in [0, 2], with 0 = identical
// For cosine distance, similarity ≈ 1 - distance (when vectors are normalized)
const DISTANCE_MAX = 0.35; // smaller is better; ~0.35 ⇒ similarity ≈ 0.65

// --------------------
// Helpers
// --------------------
function safeJSONParse(raw, label = "unknown") {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[safeJSONParse] Initial parse failed for ${label}:`, err.message);
    try {
      const fixed = raw
        .replace(/,\s*]/g, "]")
        .replace(/,\s*}/g, "}")
        .replace(/\n/g, " ")
        .trim();
      return JSON.parse(fixed);
    } catch (err2) {
      console.error(`[safeJSONParse] Second parse failed for ${label}:`, err2.message);
      return null;
    }
  }
}

function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// --------------------
// LLM call (non-streaming from Ollama)
// --------------------
async function answerWithLLM(question, expandedChunks) {
  const context = expandedChunks
    .map(
      (c, i) =>
        `Source ${i + 1}${
          c.documentTitle ? ` [${c.documentTitle}]` : ""
        } (orderIndex=${c.orderIndex ?? "?"}):\n${c.content}`
    )
    .join("\n\n");

  const SYSTEM_PROMPT = `
You are a helpful Workday specialist answering questions for HRIS and Admin users.

CRITICAL GROUNDING RULES:
- You MUST treat the provided "Context from Workday documentation" as the ONLY source of truth.
- You MUST NOT use any Workday knowledge outside this context.
- You MUST NOT invent:
  - Workday task names
  - Navigation paths
  - Checkbox / field names
  - Document titles
- Only mention task names, fields, or navigation paths that appear VERBATIM in the context.
- If the context doesn't show an exact path or task name, speak GENERICALLY (e.g., "from the authentication policy configuration") instead of fabricating a path.
`;

  const USER_PROMPT = `
User question:
"""${question}"""

Context from Workday documentation:
${context}

Respond in plain text (no JSON, no markdown). Requirements:
- 3–6 sentences.
- Directly answer their question in a conversational but professional tone.
- ONLY say things that are clearly supported by the context.
- If the context does NOT contain enough information to answer, say:
  "I’m only allowed to answer using the provided Workday documentation, and nothing in the retrieved excerpts directly answers this question without guessing."
- Do NOT suggest anything that isn't grounded in the context.
`;

  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: USER_PROMPT },
        ],
        options: {
          temperature: 0.1,
          num_predict: 512,
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[answerWithLLM] Ollama HTTP error:", resp.status, text);
      throw new Error(`Ollama error: ${resp.status}`);
    }

    const data = await resp.json();
    const rawContent = data?.message?.content;

    if (!rawContent || typeof rawContent !== "string") {
      console.error("[answerWithLLM] Unexpected LLM response:", data);
      return (
        "I tried to generate an answer from the uploaded Workday documentation, " +
        "but something went wrong formatting the response. Please try rephrasing your question."
      );
    }

    return rawContent.trim();
  } catch (err) {
    console.error("[answerWithLLM] Error:", err);
    return (
      "I encountered an error while processing your question. " +
      "I’m only allowed to answer based on the uploaded Workday documentation, " +
      "so I can’t safely answer this right now."
    );
  }
}

// --------------------
// Main Ask route (SSE streaming)
// --------------------
router.post("/", async (req, res) => {
  const start = Date.now();

  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // In case of proxies
  res.flushHeaders && res.flushHeaders();

  try {
    const { question } = req.body || {};

    if (!question || typeof question !== "string" || !question.trim()) {
      sendSSE(res, "error", {
        ok: false,
        error: "question_required",
      });
      return res.end();
    }

    const trimmedQuestion = question.trim();
    console.log(`🧠 Question: "${trimmedQuestion}"`);

    // 1) Embed question
    const qEmbed = await embedText(trimmedQuestion);

    // 2) Retrieve top chunks with distance
const rawHits = await prisma.$queryRaw`
  SELECT
    c.id,
    c.content,
    c."documentId",
    d.title      AS "documentTitle",
    d."sourceUri",
    c."orderIndex",
    (c."embeddingVec" <=> ${qEmbed.literal}::vector) AS "distance" -- COSINE distance
  FROM "Chunk" c
  JOIN "Document" d ON c."documentId" = d.id
  ORDER BY "distance" ASC
  LIMIT 8;
`;

    if (!rawHits || rawHits.length === 0) {
      console.log("📚 No chunks found at all");
      sendSSE(res, "chunks", {
        ok: true,
        hits: [],
        expanded: [],
        sources: [],
        time: `${Date.now() - start}ms`,
      });
      // No docs ⇒ no answer
      sendSSE(res, "answer", {
        ok: true,
        answer:
          "I’m only allowed to answer using the Workday documentation that’s been uploaded, " +
          "and I couldn’t retrieve anything relevant for this question.",
        done: true,
        confidence: {
          level: "low",
          reason: "No chunks were retrieved from the vector store.",
        },
      });
      return res.end();
    }

    // Normalize scores: compute similarity too
const hitsWithScores = rawHits.map((h) => {
  const distance = Number(h.distance); // cosine distance in [0, 2]
  let similarity = 1 - distance;       // similarity ~ [ -1, 1 ]

  // Clamp to [0, 1] for sanity
  if (similarity < 0) similarity = 0;
  if (similarity > 1) similarity = 1;

  return {
    id: h.id,
    content: h.content,
    documentId: h.documentId,
    documentTitle: h.documentTitle,
    sourceUri: h.sourceUri,
    orderIndex: h.orderIndex,
    distance,
    similarity,
  };
});

    const best = hitsWithScores[0];
    const bestDistance = best.distance;
    const bestSimilarity = best.similarity;

    console.log(
      `📚 Retrieved ${hitsWithScores.length} chunks. Best distance=${bestDistance.toFixed(
        4
      )}, similarity≈${bestSimilarity.toFixed(4)}`
    );

    // 3) Build doc metadata + expanded context
    const docMetaById = new Map();
    hitsWithScores.forEach((h) => {
      docMetaById.set(h.documentId, {
        documentTitle: h.documentTitle,
        sourceUri: h.sourceUri,
      });
    });

    const expanded = [];
    const seenChunkIds = new Set();

    // expand around top 3 hits
    const topForExpansion = hitsWithScores.slice(0, 3);
    for (const h of topForExpansion) {
      const neighbors = await prisma.chunk.findMany({
        where: { documentId: h.documentId },
        orderBy: { orderIndex: "asc" },
        skip: Math.max(h.orderIndex - 1, 0),
        take: 3, // previous + current + next
        select: {
          id: true,
          content: true,
          documentId: true,
          orderIndex: true,
        },
      });

      neighbors.forEach((chunk) => {
        if (!seenChunkIds.has(chunk.id)) {
          seenChunkIds.add(chunk.id);
          const meta = docMetaById.get(chunk.documentId) || {};
          expanded.push({
            id: chunk.id,
            content: chunk.content,
            documentId: chunk.documentId,
            orderIndex: chunk.orderIndex,
            documentTitle: meta.documentTitle || null,
            sourceUri: meta.sourceUri || null,
          });
        }
      });
    }

    // Sources: unique per document
    const sourcesMap = new Map();
    expanded.forEach((c) => {
      if (!sourcesMap.has(c.documentId)) {
        sourcesMap.set(c.documentId, {
          documentId: c.documentId,
          title: c.documentTitle,
          sourceUri: c.sourceUri,
        });
      }
    });
    const sources = Array.from(sourcesMap.values());

    // 4) Send chunks immediately to client so TAs can see them
    sendSSE(res, "chunks", {
      ok: true,
      hits: hitsWithScores,
      expanded,
      sources,
      time: `${Date.now() - start}ms`,
    });

    // 5) Retrieval gating: DO NOT CALL LLM if similarity is too low
    if (bestDistance > DISTANCE_MAX) {
      console.log(
        `❌ Retrieval below threshold. Best distance=${bestDistance.toFixed(
          4
        )} > ${DISTANCE_MAX}`
      );

      const msg =
        "I’m only allowed to answer questions using the Workday documentation your organization uploaded. " +
        "For this question, none of the retrieved passages were similar enough, so I can’t answer it without guessing.";

      sendSSE(res, "answer", {
        ok: true,
        answer: msg,
        done: true,
        confidence: {
          level: "low",
          reason: `Top chunk distance ${bestDistance.toFixed(
            3
          )} exceeded threshold ${DISTANCE_MAX}. Answering would require hallucinating.`,
        },
      });

      return res.end();
    }

    // 6) We have good enough retrieval ⇒ call LLM (still fully grounded)
    const fullAnswer = await answerWithLLM(trimmedQuestion, expanded);

    // 7) Stream the answer text in small chunks
    const words = fullAnswer.split(/\s+/);
    let buffer = "";

    for (let i = 0; i < words.length; i++) {
      buffer += (buffer ? " " : "") + words[i];

      // send every ~12 words or on last word
      if (buffer.length > 0 && (i % 12 === 0 || i === words.length - 1)) {
        sendSSE(res, "answer_delta", {
          chunk: buffer,
        });
        buffer = "";
      }
    }

    // 8) Final "done" event with light metadata
    sendSSE(res, "answer", {
      ok: true,
      done: true,
      confidence: {
        level: "high",
        reason:
          "Top retrieved chunks were above the similarity threshold and the answer was generated strictly from those excerpts.",
      },
    });

    return res.end();
  } catch (err) {
    console.error("[ask] Fatal error:", err);
    try {
      sendSSE(res, "error", {
        ok: false,
        error: "ask_failed",
        details: err.message,
      });
    } catch (_) {
      // ignore secondary error
    }
    return res.end();
  }
});

export default router;