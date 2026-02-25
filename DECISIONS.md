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
