/*
  Warnings:

  - You are about to drop the column `isApproved` on the `VendorProfile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PENDING';

-- DropIndex
DROP INDEX "VendorProfile_city_isApproved_idx";

-- AlterTable
ALTER TABLE "RFQ" ADD COLUMN     "title" TEXT;

-- AlterTable: add status column first, then migrate data, then drop isApproved
ALTER TABLE "VendorProfile" ADD COLUMN "status" "VendorStatus" NOT NULL DEFAULT 'PENDING';

-- Data migration: isApproved=true → APPROVED, isApproved=false + rejectedAt IS NOT NULL → REJECTED
UPDATE "VendorProfile" SET "status" = 'APPROVED' WHERE "isApproved" = true;
UPDATE "VendorProfile" SET "status" = 'REJECTED' WHERE "isApproved" = false AND "rejectedAt" IS NOT NULL;

-- Now drop the old column
ALTER TABLE "VendorProfile" DROP COLUMN "isApproved";

-- CreateIndex
CREATE INDEX "VendorProfile_city_status_idx" ON "VendorProfile"("city", "status");
