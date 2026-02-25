# BuildMart Architecture

## System Components
- Buyer/Vendor Browser -> Next.js (Vercel)
- Next.js -> NestJS API (Render/Railway)
- NestJS -> PostgreSQL (hosted DB)
- NestJS -> MSG91 (OTP delivery)
- NestJS -> WhatsApp Business API (Interakt/AiSensy)
- NestJS -> Razorpay (payment processing)
- NestJS -> Cloudinary (file/image storage)

## RFQ Lifecycle
- OPEN -> QUOTED (on first vendor quote received)
- OPEN -> EXPIRED (when `validUntil` is reached)
- QUOTED -> CLOSED (when buyer accepts a quote -> order created)

## Order Lifecycle
- CONFIRMED -> OUT_FOR_DELIVERY -> DELIVERED
- CONFIRMED -> CANCELLED
- No other transitions permitted

## Valid Order Status Transitions (State Machine)
- CONFIRMED: ["OUT_FOR_DELIVERY", "CANCELLED"]
- OUT_FOR_DELIVERY: ["DELIVERED"]
- DELIVERED: []
- CANCELLED: []

## Vendor-RFQ Matching Query (Product-level)
```sql
SELECT vp.* FROM VendorProfile vp
WHERE vp.city = :rfqCity
  AND vp.isApproved = true
  AND vp.deletedAt IS NULL
  AND EXISTS (
    SELECT 1 FROM VendorProduct vpr
    WHERE vpr.vendorId = vp.id
      AND vpr.productId IN (:rfqItemProductIds)
  )
```
