-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "rfqId" DROP NOT NULL,
ALTER COLUMN "quoteId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DirectOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DirectOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectOrderItem_orderId_idx" ON "DirectOrderItem"("orderId");

-- AddForeignKey
ALTER TABLE "DirectOrderItem" ADD CONSTRAINT "DirectOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectOrderItem" ADD CONSTRAINT "DirectOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
