-- This is an empty migration.

CREATE INDEX IF NOT EXISTS "chunk_embedding_idx"
  ON "Chunk" USING ivfflat ("embeddingVec" vector_cosine_ops)
  WITH (lists = 100);