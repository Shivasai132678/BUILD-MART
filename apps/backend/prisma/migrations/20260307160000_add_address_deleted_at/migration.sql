-- AlterTable
ALTER TABLE "Address" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Address_deletedAt_idx" ON "Address"("deletedAt");
