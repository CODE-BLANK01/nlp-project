// src/utils/documentProcessor.js
import { prisma } from "../prisma.js";
import { embedTextBatch } from "./embeddings.js";
import { extractTextFromFile } from "./extractText.js";

/** Debug/Logger */
function log(stage, msg, extra = {}) {
  const time = new Date().toISOString();
  console.log(`[${time}] 📄 [${stage}] ${msg}`, Object.keys(extra).length ? extra : "");
}

/** Chunker with overlap & word boundary awareness */
function chunkText(s, size = 800, overlap = 100, hardCap = 20000) {
  const text = (s ?? "").toString();
  const len = text.length;
  if (!len) return [];
  const chunks = [];
  let start = 0;
  let safety = 0;
  while (start < len && ++safety <= hardCap) {
    let end = Math.min(start + size, len);
    // Try to break at a space/punctuation near the end
    const slice = text.slice(start, end + 100);
    const lastSpace = slice.lastIndexOf(" ");
    const lastPeriod = slice.lastIndexOf(".");
    const breakAt = Math.max(lastSpace, lastPeriod);
    if (breakAt > size * 0.6) {
      end = start + breakAt + 1;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= len) break;
    start = end - overlap;
  }
  return chunks;
}

/**
 * Process a document:
 * - extract text
 * - chunk
 * - save chunks (with tenantId)
 * - embed in batches with retry for failures
 */
export async function processDocumentAsync({
  documentId,
  tenantId, // 👈 added
  buffer,
  mimeType,
  filename,
}) {
  const start = Date.now();
  log("INIT", `Processing started`, { documentId, tenantId, filename });
  try {
    // 1️⃣ Extract text
    const extracted = await extractTextFromFile(buffer, mimeType, filename);
    const text = Array.isArray(extracted) ? extracted.join("\n\n") : extracted;
    log("EXTRACT", `Extracted ${text.length} characters`);

    // 2️⃣ Chunk
    const chunks = chunkText(text);
    log("CHUNK", `Created ${chunks.length} chunks`);

    // 3️⃣ Save chunks in DB (with tenantId)
    const savedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const ch = await prisma.chunk.create({
        data: {
          documentId,
          tenantId, // 👈 ensure tenantId is stored
          content: chunks[i],
          orderIndex: i,
        },
        select: { id: true, content: true },
      });
      savedChunks.push(ch);
    }
    log("DB", `Inserted ${savedChunks.length} chunks into DB`, { documentId, tenantId });

    // 4️⃣ Batch embeddings with retry only for failed chunks
    const batchSize = 50;
    let remaining = savedChunks.slice(); // queue of unembedded
    let attempt = 1;
    while (remaining.length > 0) {
      log("EMBED", `Embedding initialized. Remaining=${remaining.length}, Attempt=${attempt}`);

      const failed = [];
      for (let i = 0; i < remaining.length; i += batchSize) {
        const batch = remaining.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(remaining.length / batchSize);

        log("BATCH", `Processing batch ${batchNum}/${totalBatches} (${batch.length} items)`);

        try {
          const embeddings = await embedTextBatch(
            batch.map((c) => c.content),
            batchSize
          );
          for (let j = 0; j < batch.length; j++) {
            const ch = batch[j];
            const emb = embeddings[j];
            if (emb?.literal) {
              await prisma.$executeRaw`
                UPDATE "Chunk"
                SET "embeddingVec" = ${emb.literal}::vector
                WHERE id = ${ch.id};
              `;
            } else {
              failed.push(ch); // mark as failed
            }
          }
          log("BATCH", `✅ Batch ${batchNum} completed`);
        } catch (err) {
          log("ERROR", `❌ Batch ${batchNum} failed.`, { error: err.message });
          failed.push(...batch);
        }
      }
      if (failed.length > 0) {
        log("RETRY", `Retrying failed chunks after backoff`, {
          failed: failed.length,
          attempt,
        });
        await new Promise((r) => setTimeout(r, 5000 * attempt)); // exponential-ish backoff
      }
      remaining = failed;
      attempt++;
    }

    // 5️⃣ Optimize DB after inserts
    await prisma.$executeRawUnsafe(`ANALYZE "Chunk";`);
    const elapsed = Date.now() - start;
    log("DONE", `Document ${documentId} Tenant ${tenantId} processed successfully in ${elapsed}ms with ${chunks.length} chunks`);

    return { ok: true, chunks: chunks.length, timeMs: elapsed };
  } catch (err) {
    log("FATAL", `Processing failed`, { documentId, tenantId, error: err.message });
    return { ok: false, error: err.message };
  }
}