-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_COUNTER_OFFER';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_COUNTER_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_COUNTER_REJECTED';

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "counterOfferNote" TEXT,
ADD COLUMN     "counterOfferPrice" DECIMAL(10,2),
ADD COLUMN     "counterStatus" TEXT;
