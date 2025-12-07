// src/scripts/backfillEmbeddings.js
import { prisma } from '../prisma.js';
import { embedText } from '../utils/embeddings.js';

const BATCH = 500;

async function backfillBatch() {
  // 1) Pull a batch of chunks missing vectors (raw SQL because Unsupported("vector"))
  const rows = await prisma.$queryRaw`
    SELECT id, content
    FROM "Chunk"
    WHERE "embeddingVec" IS NULL
    ORDER BY "createdAt" ASC
    LIMIT ${BATCH};
  `;

  if (!rows.length) return 0;

  // 2) Write vectors (use ::vector cast on string literal "[...,...]")
  await Promise.all(
    rows.map(async (r) => {
      const { literal } = embedText(r.content); // returns "[0.123,0.456,...]"
      await prisma.$executeRaw`
        UPDATE "Chunk"
        SET "embeddingVec" = ${literal}::vector
        WHERE id = ${r.id};
      `;
    })
  );

  return rows.length;
}

async function main() {
  let total = 0;
  // optional: bump probes for recall while we’re at it
  await prisma.$executeRawUnsafe(`SET ivfflat.probes = 10;`);

  // loop until no rows left
  // (keep batches small to avoid long transactions)
  for (;;) {
    const n = await backfillBatch();
    if (n === 0) break;
    total += n;
    console.log(`Backfilled ${n} chunks (total=${total})`);
  }

  // analyze for planner stats
  await prisma.$executeRawUnsafe(`ANALYZE "Chunk";`);
  console.log(`Done. Total backfilled: ${total}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });