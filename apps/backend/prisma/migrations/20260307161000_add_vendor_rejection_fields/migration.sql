-- AlterTable
ALTER TABLE "VendorProfile" ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;
