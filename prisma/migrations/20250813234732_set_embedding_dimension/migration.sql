-- This is an empty migration.
ALTER TABLE "Chunk"
  ALTER COLUMN "embeddingVec" TYPE vector(1024);