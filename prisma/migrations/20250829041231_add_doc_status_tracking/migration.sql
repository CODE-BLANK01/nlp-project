-- CreateEnum
CREATE TYPE "public"."DocStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."Document" ADD COLUMN     "chunksCount" INTEGER,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processingTimeMs" INTEGER,
ADD COLUMN     "status" "public"."DocStatus" NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN     "textLength" INTEGER;
