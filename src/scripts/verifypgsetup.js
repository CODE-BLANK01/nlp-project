import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const out = { ok: true, checks: [] };
  async function check(name, fn) {
    try {
      await fn();
      out.checks.push({ name, ok: true });
    } catch (e) {
      out.ok = false;
      out.checks.push({ name, ok: false, error: String(e) });
    }
  }

  await check("DB connect", async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  await check("pgvector extension", async () => {
    const rows = await prisma.$queryRaw`
      SELECT extname FROM pg_extension WHERE extname='vector';
    `;
    if (!rows.length) throw new Error("vector extension missing");
  });

  await check("Chunk table + vector dim", async () => {
    const rows = await prisma.$queryRaw`
      SELECT format_type(a.atttypid, a.atttypmod) AS type
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname='public' AND c.relname='Chunk' AND a.attname='embeddingVec' AND a.attnum > 0
    `;
    const typ = rows?.[0]?.type || "";
    if (!typ.startsWith("vector(")) throw new Error(`unexpected type: ${typ}`);
  });

  await check("Create doc + chunk (no embed write)", async () => {
    const doc = await prisma.document.create({
      data: { title: "verify-doc", visibility: "EMPLOYEE" },
    });
    await prisma.chunk.create({
      data: {
        documentId: doc.id,
        content: "This is a verification chunk about leave policy carry forward.",
        orderIndex: 0,
        visibility: "EMPLOYEE",
      },
    });
  });

  await check("Write vector to pgvector column", async () => {
    // fake 1024-dim vec; set dimension to your DB's dim
    const dim = 1024;
    const vec = Array(dim).fill(0);
    vec[0] = 0.5; vec[1] = 0.25;
    const vecLit = `[${vec.join(",")}]`;
    const row = await prisma.$queryRaw`
      SELECT id FROM "Chunk" ORDER BY "createdAt" DESC LIMIT 1;
    `;
    const id = row?.[0]?.id;
    if (!id) throw new Error("no chunk row");

    await prisma.$executeRawUnsafe(
  `UPDATE "Chunk"
   SET "embeddingVec" = $1::vector,
       "embeddingJson" = $2::jsonb
   WHERE id = $3`,
  vecLit,
  JSON.stringify(vec),
  id
);
  });

  await check("Vector search returns rows", async () => {
    const vecLit = `[0.5,0.25${",0".repeat(1024 - 2)}]`; // matches the write above
    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT c.id, d.title
      FROM "Chunk" c
      JOIN "Document" d ON d.id = c."documentId"
      ORDER BY c."embeddingVec" <=> $1::vector
      LIMIT 1;
      `,
      
      vecLit
    );
    if (!rows.length) throw new Error("no vector results");
  });

  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});