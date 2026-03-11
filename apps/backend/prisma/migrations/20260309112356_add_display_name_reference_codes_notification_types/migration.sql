/*
  Warnings:

  - A unique constraint covering the columns `[referenceCode]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referenceCode]` on the table `Quote` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referenceCode]` on the table `RFQ` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'VENDOR_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'VENDOR_REJECTED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "referenceCode" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "referenceCode" TEXT;

-- AlterTable
ALTER TABLE "RFQ" ADD COLUMN     "referenceCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "displayName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_referenceCode_key" ON "Order"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_referenceCode_key" ON "Quote"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "RFQ_referenceCode_key" ON "RFQ"("referenceCode");
