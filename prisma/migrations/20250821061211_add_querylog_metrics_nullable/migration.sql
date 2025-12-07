/*
  Warnings:

  - You are about to drop the column `latencyMs` on the `QueryLog` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `QueryLog` table. All the data in the column will be lost.
  - Made the column `userId` on table `QueryLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `answer` on table `QueryLog` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."QueryLog" DROP CONSTRAINT "QueryLog_userId_fkey";

-- DropIndex
DROP INDEX "public"."QueryLog_createdAt_idx";

-- DropIndex
DROP INDEX "public"."QueryLog_tenantId_idx";

-- AlterTable
ALTER TABLE "public"."QueryLog" DROP COLUMN "latencyMs",
DROP COLUMN "tenantId",
ADD COLUMN     "llmTimeMs" INTEGER,
ADD COLUMN     "resultsFound" INTEGER,
ADD COLUMN     "searchTimeMs" INTEGER,
ADD COLUMN     "totalTimeMs" INTEGER,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "answer" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."QueryLog" ADD CONSTRAINT "QueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
