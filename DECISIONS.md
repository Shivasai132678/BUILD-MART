# BuildMart Decisions

## 1. Modular Monolith (not microservices)
Reason: Faster MVP, easier debugging, lower cost.
Upgrade path: Module boundaries are defined so services can be extracted later.

## 2. RFQ-first scope
Reason: Core pain point is price discovery and vendor comparison.

## 3. Polling every 15s (not WebSockets)
Reason: Simpler, reliable, demo-safe.
Phase 2: WebSockets for real-time updates.

## 4. JWT 7-day stateless (no refresh tokens)
Reason: Reduces backend complexity for MVP.
Phase 2: Redis blacklist + refresh token rotation.

## 5. COD + Razorpay sandbox (no Route/split payments)
Reason: Razorpay Route requires compliance overhead not suitable for MVP.
Phase 2: Razorpay Route for vendor payouts.

## 6. `connection_limit=5` in `DATABASE_URL`
Reason: Render/Railway free tier caps at 10 DB connections.

## 7. UTC in DB, IST in UI
Reason: PostgreSQL stores UTC. Display layer handles timezone via `formatIST()`.

## 8. Product-level vendor matching (not category matching)
Reason: Prevents irrelevant RFQ notifications. A vendor selling cement should not receive steel RFQs.

## 9. Swagger disabled in production
Reason: Exposing API schema in production is a security risk.

## 10. No error-monitoring SDK wired (SENTRY_DSN removed)
Decision: `SENTRY_DSN` was present in `.env.example` and `ENV.md` but no
`@sentry/node` package was installed and no SDK init call existed. Keeping a
variable that references a missing dependency is misleading. The reference has
been removed. Before wiring Sentry (or any alternative):
- Install `@sentry/nestjs` and pin the version in `package.json`.
- Add `Sentry.init({ dsn: process.env.SENTRY_DSN })` as the first statement
  in `main.ts` (before `NestFactory.create`).
- Gate init: skip when `!process.env.SENTRY_DSN` so dev/test runs are clean.
- Re-add `SENTRY_DSN` to `.env.example` and `ENV.md` after the above is done.

## 11. Address soft-delete via `deletedAt`
Addresses are never hard-deleted. `DELETE /api/v1/addresses/:id` sets
`deletedAt = NOW()`. All list and read queries filter `WHERE deletedAt IS NULL`
(`visibleAddressWhere` helper in `AddressesService`). This preserves historical
references from orders without blocking re-use.

## 12. Vendor rejection flow
Rejection sets `rejectedAt` and optionally `rejectionReason` on the
`VendorProfile` row. An audit record is written to `VendorAudit`. The vendor is
not deleted; `isApproved` stays false. A rejected vendor cannot be re-rejected
(`isApproved` guard in `VendorService.rejectVendor`). The vendor must re-submit
to restart the flow (not yet implemented for MVP).

## 13. Razorpay payment flow
1. Buyer calls `POST /api/v1/payments/order` → PaymentsService creates a
   Razorpay order and a `Payment` row with status `PENDING`.
2. Frontend opens Razorpay checkout with the Razorpay order ID.
3. On success Razorpay POSTs to `POST /api/v1/payments/webhook`.
4. Webhook handler verifies HMAC-SHA256 signature with `RAZORPAY_WEBHOOK_SECRET`.
5. If `payment.captured` event and signature valid → Payment set to `SUCCESS`,
   Order status advances. If Payment already `SUCCESS` → returns HTTP 200
   immediately (idempotency, Rule 14).
6. On failure event Payment is set to `FAILED`.
All money stored as `Prisma.Decimal(10,2)` (Rule 3).

## 14. Admin order visibility (dispute resolution)
Admins can list all orders (`GET /api/v1/admin/orders`) and view a single order
(`GET /api/v1/admin/orders/:id`) via `AdminService`. These are read-only
endpoints; admins cannot mutate order status. Buyer and vendor order access
paths are unchanged.
