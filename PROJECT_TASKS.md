# BuildMart Project Tasks

Each task is scoped to ~1-3 hours. For every task: implement, verify, commit atomically, update checkbox, and append `AGENT_HANDOFF.md`.

## SETUP
- [x] Backend runtime bootstrap hardening | Files: `apps/backend/src/main.ts`, `apps/backend/src/app.module.ts`, `apps/backend/src/common/filters/global-exception.filter.ts`, `apps/backend/src/common/interceptors/response.interceptor.ts` | Expected outcome: NestJS boots with `/api/v1` prefixing, versioning, Helmet, CORS whitelist, and global response/error handling.
- [x] Shared status constants and frontend IST date utility | Files: `apps/backend/src/common/constants/status.enums.ts`, `apps/backend/src/common/constants/status-transitions.ts`, `apps/frontend/lib/utils/date.ts` | Expected outcome: Canonical status enums/transitions and the only allowed `formatIST()` frontend formatter exist.
- [x] Prisma initial migration + health check endpoint | Files: `apps/backend/prisma/migrations/*`, `apps/backend/src/health/*`, `apps/backend/src/app.module.ts` | Expected outcome: `init` migration applied, Prisma connected, and `GET /api/health` returns service/db health.
- [ ] Env example files and workspace scripts alignment | Files: `apps/backend/.env.example`, `apps/frontend/.env.local.example`, `apps/backend/package.json`, `apps/frontend/package.json` | Expected outcome: Required env variables documented in example files with blank values and local scripts aligned.

## BACKEND — Auth
- [x] Auth module skeleton + DTO validation | Files: `apps/backend/src/auth/auth.module.ts`, `apps/backend/src/auth/auth.controller.ts`, `apps/backend/src/auth/dto/send-otp.dto.ts`, `apps/backend/src/auth/dto/verify-otp.dto.ts` | Expected outcome: Versioned auth endpoints exist with class-validator DTOs and request validation pipe support.
- [x] OTP send flow with SHA-256 persistence and throttling | Files: `apps/backend/src/auth/auth.service.ts`, `apps/backend/src/auth/providers/msg91.adapter.ts`, `apps/backend/src/otp/*`, `apps/backend/prisma/schema.prisma` (read-only), `apps/backend/src/auth/auth.controller.ts` | Expected outcome: `/auth/send-otp` stores hashed OTP in `OTPRecord`, sets 5-minute expiry, and uses `@Throttle(5, 60)`.
- [x] OTP verify flow + JWT HTTP-only cookie login/logout | Files: `apps/backend/src/auth/auth.service.ts`, `apps/backend/src/auth/jwt.strategy.ts`, `apps/backend/src/auth/guards/*`, `apps/backend/src/auth/auth.controller.ts` | Expected outcome: `/auth/verify-otp` validates hash/expiry/isUsed atomically and issues cookie-only JWT; `/auth/logout` clears cookie.
- [x] Role guards/decorators for protected routes | Files: `apps/backend/src/common/auth/roles.decorator.ts`, `apps/backend/src/common/auth/roles.guard.ts`, `apps/backend/src/common/auth/jwt-auth.guard.ts` | Expected outcome: Reusable JWT + role authorization guards enforce BUYER/VENDOR/ADMIN access.

## BACKEND — Vendor Onboarding
- [x] Vendor onboarding DTOs + GST validation rules | Files: `apps/backend/src/vendors/dto/onboard-vendor.dto.ts`, `apps/backend/src/vendors/dto/update-vendor-profile.dto.ts`, `apps/backend/src/vendors/vendors.controller.ts` | Expected outcome: Vendor onboarding/update requests are validated (including GST regex) with clear error messages.
- [x] Vendor profile service + Cloudinary document upload adapter | Files: `apps/backend/src/vendors/vendors.service.ts`, `apps/backend/src/files/cloudinary.adapter.ts`, `apps/backend/src/vendors/vendors.module.ts` | Expected outcome: Vendor docs upload flow persists URLs and creates/updates `VendorProfile` safely.
- [x] Vendor profile endpoints (GET/PATCH) with ownership checks | Files: `apps/backend/src/vendors/vendors.controller.ts`, `apps/backend/src/vendors/vendors.service.ts` | Expected outcome: Vendors can fetch and edit only their own profile; soft-deleted profiles are excluded.
- [x] Admin vendor approval endpoint + audit log entry | Files: `apps/backend/src/admin/admin-vendors.controller.ts`, `apps/backend/src/vendors/vendors.service.ts`, `apps/backend/src/audit/*` | Expected outcome: ADMIN can approve vendor profiles and approval action is recorded in audit log.

## BACKEND — Products & Categories
- [x] Category CRUD endpoints (ADMIN) with pagination for list | Files: `apps/backend/src/categories/categories.controller.ts`, `apps/backend/src/categories/categories.service.ts`, `apps/backend/src/categories/dto/*` | Expected outcome: Admin category create/update/delete and paginated list/read endpoints are available.
- [x] Product CRUD endpoints (ADMIN) with Decimal-safe pricing | Files: `apps/backend/src/products/products.controller.ts`, `apps/backend/src/products/products.service.ts`, `apps/backend/src/products/dto/*` | Expected outcome: Product management supports category binding and uses Prisma Decimal for all prices.
- [ ] Read-only product/category browsing for BUYER/VENDOR | Files: `apps/backend/src/categories/categories.controller.ts`, `apps/backend/src/products/products.controller.ts`, `apps/backend/src/common/auth/*` | Expected outcome: BUYER/VENDOR can list and read active catalog data with pagination filters.
- [ ] VendorProduct mapping management for vendor sellable items | Files: `apps/backend/src/vendor-products/vendor-products.controller.ts`, `apps/backend/src/vendor-products/vendor-products.service.ts`, `apps/backend/src/vendor-products/dto/*` | Expected outcome: Vendors can maintain product mappings used for RFQ matching query logic.

## BACKEND — RFQ Module
- [x] RFQ create endpoint + DTOs + throttle guard | Files: `apps/backend/src/rfq/rfq.controller.ts`, `apps/backend/src/rfq/rfq.service.ts`, `apps/backend/src/rfq/dto/create-rfq.dto.ts` | Expected outcome: BUYER can create RFQs via `/api/v1/rfq` with `@Throttle(10, 60)` and validated multi-item payloads.
- [ ] Product-level vendor matching query + notification trigger | Files: `apps/backend/src/rfq/rfq.service.ts`, `apps/backend/src/rfq/queries/vendor-matching.query.ts`, `apps/backend/src/notifications/notifications.service.ts` | Expected outcome: Matching uses product-level logic only and emits notification events through `NotificationsService`.
- [x] Buyer RFQ list/detail/close endpoints (paginated) | Files: `apps/backend/src/rfq/rfq.controller.ts`, `apps/backend/src/rfq/rfq.service.ts`, `apps/backend/src/rfq/dto/list-rfq.dto.ts` | Expected outcome: Buyers can paginate their RFQs, inspect details, and close eligible RFQs.
- [x] Vendor available RFQ feed endpoint with filters | Files: `apps/backend/src/rfq/rfq.controller.ts`, `apps/backend/src/rfq/rfq.service.ts` | Expected outcome: Vendors see only matching open RFQs in a paginated endpoint.

## BACKEND — Quote Module
- [x] Quote create endpoint + quote item persistence | Files: `apps/backend/src/quotes/quotes.controller.ts`, `apps/backend/src/quotes/quotes.service.ts`, `apps/backend/src/quotes/dto/create-quote.dto.ts` | Expected outcome: Vendors can submit quotes with line items and totals for eligible RFQs.
- [x] Enforce quote uniqueness and quote validity rules | Files: `apps/backend/src/quotes/quotes.service.ts`, `apps/backend/src/quotes/repositories/quotes.repository.ts` | Expected outcome: Duplicate `(rfqId, vendorId)` quotes are rejected and invalid/expired quote submissions are blocked.
- [x] Buyer quote comparison list sorted by total amount | Files: `apps/backend/src/quotes/quotes.controller.ts`, `apps/backend/src/quotes/quotes.service.ts` | Expected outcome: Buyer can fetch RFQ quotes sorted ascending by `totalAmount`.
- [x] Vendor quote update/delete constraints | Files: `apps/backend/src/quotes/quotes.controller.ts`, `apps/backend/src/quotes/quotes.service.ts`, `apps/backend/src/quotes/dto/update-quote.dto.ts` | Expected outcome: Vendor can edit before `validUntil`; delete only when no order exists.

## BACKEND — Order Module
- [x] Order creation from accepted quote + RFQ close transaction | Files: `apps/backend/src/orders/orders.controller.ts`, `apps/backend/src/orders/orders.service.ts`, `apps/backend/src/orders/dto/create-order.dto.ts` | Expected outcome: Buyer accepts quote, order is created transactionally, RFQ status closes, and duplicate acceptance is prevented.
- [x] Order list/detail endpoints with role-aware filtering and pagination | Files: `apps/backend/src/orders/orders.controller.ts`, `apps/backend/src/orders/orders.service.ts`, `apps/backend/src/orders/dto/list-orders.dto.ts` | Expected outcome: BUYER and VENDOR can list orders (filter by status) and read accessible details.
- [x] Order status state machine enforcement in service | Files: `apps/backend/src/orders/orders.service.ts`, `apps/backend/src/common/constants/status-transitions.ts` | Expected outcome: Vendor status updates are validated against allowed transitions and invalid transitions return descriptive `BadRequestException`.
- [x] Order cancellation endpoint for CONFIRMED state only | Files: `apps/backend/src/orders/orders.controller.ts`, `apps/backend/src/orders/orders.service.ts`, `apps/backend/src/orders/dto/cancel-order.dto.ts` | Expected outcome: Buyer/Vendor cancellation allowed only in `CONFIRMED`, with reason captured.

## BACKEND — Payment Module
- [x] Razorpay create-order endpoint (sandbox) | Files: `apps/backend/src/payments/payments.controller.ts`, `apps/backend/src/payments/payments.service.ts`, `apps/backend/src/payments/adapters/razorpay.adapter.ts` | Expected outcome: Backend creates Razorpay sandbox orders and persists `Payment` in `INITIATED` state.
- [x] Razorpay webhook signature verification + idempotency | Files: `apps/backend/src/payments/payments.controller.ts`, `apps/backend/src/payments/payments.service.ts` | Expected outcome: Webhook HMAC is verified, duplicate SUCCESS callbacks return HTTP 200 without reprocessing (Rule 14).
- [ ] Payment-order status synchronization and failure handling | Files: `apps/backend/src/payments/payments.service.ts`, `apps/backend/src/orders/orders.service.ts`, `apps/backend/src/notifications/notifications.service.ts` | Expected outcome: Payment success/failure updates persist correctly and trigger notifications via NotificationsService only.

## BACKEND — Notifications Module
- [ ] Notifications module skeleton + adapter interfaces | Files: `apps/backend/src/notifications/notifications.module.ts`, `apps/backend/src/notifications/notifications.service.ts`, `apps/backend/src/notifications/adapters/*` | Expected outcome: Central NotificationsService orchestrates in-app/WhatsApp/email adapters (Rule 15).
- [x] In-app notification persistence + list/read endpoints | Files: `apps/backend/src/notifications/notifications.controller.ts`, `apps/backend/src/notifications/notifications.service.ts`, `apps/backend/src/notifications/dto/*` | Expected outcome: Users can fetch unread-first paginated notifications and mark one/all as read.
- [ ] External adapter integrations with TODO-safe placeholders | Files: `apps/backend/src/notifications/adapters/whatsapp.adapter.ts`, `apps/backend/src/notifications/adapters/email.adapter.ts`, `apps/backend/src/notifications/adapters/sms.adapter.ts` | Expected outcome: Provider calls are isolated, env-driven, and unknown API formats are marked with TODOs (no hallucinated payloads).
- [ ] Event wiring from auth/RFQ/quote/order/payment modules | Files: `apps/backend/src/*/*.service.ts`, `apps/backend/src/notifications/notifications.service.ts` | Expected outcome: All user-facing notifications route through NotificationsService and no direct provider calls exist elsewhere.

## BACKEND — Admin Metrics
- [ ] Admin metrics summary endpoint (users/vendors/RFQs/orders/GMV) | Files: `apps/backend/src/admin/admin-metrics.controller.ts`, `apps/backend/src/admin/admin-metrics.service.ts` | Expected outcome: ADMIN can fetch dashboard metric cards from aggregated Prisma queries.
- [ ] Admin vendor approval queue list endpoint (paginated) | Files: `apps/backend/src/admin/admin-vendors.controller.ts`, `apps/backend/src/admin/admin-vendors.service.ts` | Expected outcome: ADMIN can list pending vendor approvals with pagination and filters.
- [ ] Admin auth/role protection + DTOs for metrics filters | Files: `apps/backend/src/admin/dto/*`, `apps/backend/src/common/auth/*`, `apps/backend/src/admin/*.controller.ts` | Expected outcome: Admin endpoints are protected and support validated date-range/filter params.

## FRONTEND — Auth Flows
- [ ] Login page (phone + OTP steps) | Files: `apps/frontend/app/login/page.tsx`, `apps/frontend/components/auth/*`, `apps/frontend/lib/api/auth.ts` | Expected outcome: User can request OTP, verify OTP, and continue authenticated via cookie-based API calls.
- [ ] Auth middleware + protected route groups | Files: `apps/frontend/middleware.ts`, `apps/frontend/app/(buyer)/*`, `apps/frontend/app/(vendor)/*`, `apps/frontend/app/(admin)/*` | Expected outcome: Buyer/vendor/admin route groups are protected and redirect unauthenticated users.
- [ ] Zustand user store + Axios client with credentials | Files: `apps/frontend/lib/store/user-store.ts`, `apps/frontend/lib/api/client.ts` | Expected outcome: Frontend stores session/user metadata and sends cookie credentials for API requests.

## FRONTEND — Buyer Flows
- [ ] Catalog browsing pages with category/product filters | Files: `apps/frontend/app/(buyer)/catalog/page.tsx`, `apps/frontend/components/catalog/*`, `apps/frontend/lib/api/products.ts` | Expected outcome: Buyer can browse active categories/products with pagination/filter UI.
- [ ] Multi-item RFQ creation form | Files: `apps/frontend/app/(buyer)/rfq/new/page.tsx`, `apps/frontend/components/rfq/rfq-form.tsx`, `apps/frontend/lib/api/rfq.ts` | Expected outcome: Buyer can create RFQs with multiple products, quantities, and delivery address.
- [ ] RFQ detail page with quote polling every 15s | Files: `apps/frontend/app/(buyer)/rfq/[id]/page.tsx`, `apps/frontend/components/quotes/*` | Expected outcome: Quote list auto-refreshes with `refetchInterval: 15000` and sorts vendor quotes for comparison.
- [ ] Quote acceptance + buyer order timeline UI | Files: `apps/frontend/app/(buyer)/orders/[id]/page.tsx`, `apps/frontend/components/orders/order-timeline.tsx`, `apps/frontend/lib/api/orders.ts` | Expected outcome: Buyer can accept quote and view order status progression in a timeline.

## FRONTEND — Vendor Portal
- [ ] Vendor onboarding/profile management UI | Files: `apps/frontend/app/(vendor)/onboarding/page.tsx`, `apps/frontend/app/(vendor)/profile/page.tsx`, `apps/frontend/components/vendor/*` | Expected outcome: Vendor can submit onboarding docs and manage profile details.
- [ ] Available RFQs list + quote submission form | Files: `apps/frontend/app/(vendor)/rfqs/page.tsx`, `apps/frontend/app/(vendor)/rfqs/[id]/quote/page.tsx`, `apps/frontend/components/vendor-quote/*` | Expected outcome: Vendor sees matching RFQs and can submit valid quotes with totals.
- [ ] Vendor orders list + status update controls | Files: `apps/frontend/app/(vendor)/orders/page.tsx`, `apps/frontend/app/(vendor)/orders/[id]/page.tsx` | Expected outcome: Vendor can filter orders and perform allowed status transitions only.

## FRONTEND — Admin Dashboard
- [ ] Admin dashboard layout + navigation shell | Files: `apps/frontend/app/(admin)/layout.tsx`, `apps/frontend/app/(admin)/page.tsx`, `apps/frontend/components/admin/nav.tsx` | Expected outcome: Admin area has protected layout and navigable dashboard shell.
- [ ] Vendor approval queue UI (approve/reject actions) | Files: `apps/frontend/app/(admin)/vendors/page.tsx`, `apps/frontend/components/admin/vendor-queue.tsx`, `apps/frontend/lib/api/admin.ts` | Expected outcome: Admin can review pending vendors and approve/reject from UI.
- [ ] Metrics cards for users/vendors/RFQs/orders/GMV | Files: `apps/frontend/components/admin/metric-cards.tsx`, `apps/frontend/app/(admin)/page.tsx` | Expected outcome: Admin dashboard renders live metric summaries from backend endpoint.

## DEVOPS — Docker & CI/CD
- [ ] Backend Dockerfile for NestJS production build | Files: `apps/backend/Dockerfile`, `apps/backend/.dockerignore` | Expected outcome: Backend can be containerized and run in production mode for Render/Railway.
- [ ] Docker Compose local workflow validation | Files: `docker-compose.yml`, `apps/backend/.env.example`, `README.md` | Expected outcome: Local DB + backend startup flow is documented and reproducible.
- [ ] GitHub Actions CI pipeline (lint/test/build/migrate) | Files: `.github/workflows/ci.yml` | Expected outcome: CI runs on `develop` pushes and PRs to `main`, using `prisma migrate deploy` (not `migrate dev`).

## TESTING
- [ ] Auth module unit tests (OTP expiry/hash/cookie flows) | Files: `apps/backend/src/auth/*.spec.ts`, `apps/backend/test/auth.e2e-spec.ts` | Expected outcome: OTP edge cases and login/logout behavior are covered.
- [ ] Order state machine + cancellation tests | Files: `apps/backend/src/orders/orders.service.spec.ts` | Expected outcome: Valid and invalid order transitions are enforced by tests.
- [ ] RFQ/quote integration tests for vendor matching and sorting | Files: `apps/backend/test/rfq-quotes.e2e-spec.ts` | Expected outcome: Product-level vendor matching and quote sorting behavior are verified.
- [ ] Frontend smoke tests for key buyer/vendor/admin flows | Files: `apps/frontend/tests/*` | Expected outcome: Critical page rendering and API interaction regressions are caught early.

## DEPLOYMENT
- [ ] Backend staging deployment configuration | Files: `README.md`, `ENV.md`, `apps/backend/Dockerfile` | Expected outcome: Render/Railway deployment steps and environment setup are documented and executable.
- [ ] Frontend staging deployment configuration | Files: `README.md`, `apps/frontend/vercel.json` (if needed), `ENV.md` | Expected outcome: Vercel deployment variables and build settings are documented.
- [ ] Post-deploy verification checklist + seed run procedure | Files: `README.md`, `SEED.md` | Expected outcome: Staging demo flow can be validated end-to-end after deployment and seed execution.

## DOCUMENTATION POLISH
- [ ] README setup guide + local development instructions + demo credentials | Files: `README.md`, `ENV.md`, `SEED.md` | Expected outcome: New developers can bootstrap locally and run the demo flow without ambiguity.
- [ ] API usage and Swagger access policy documentation | Files: `README.md`, `ARCHITECTURE.md`, `CLAUDE.md` | Expected outcome: API versioning, staging-only Swagger, and route conventions are clearly documented.
- [ ] Cross-document consistency review (architecture/decisions/env/seed/handoff/tasks) | Files: `ARCHITECTURE.md`, `DECISIONS.md`, `ENV.md`, `SEED.md`, `AGENT_HANDOFF.md`, `PROJECT_TASKS.md` | Expected outcome: Terminology, status names, and lifecycle rules are consistent across docs.

## STRICT NON-GOALS (do not build these in this phase)
- WebSockets (use polling instead)
- Refresh token rotation (Phase 2)
- Razorpay Route / vendor split payments (Phase 2)
- Redis caching (Phase 2)
- Native mobile app (Phase 2)
- Multi-city support (Phase 2)
- AI NL RFQ helper (optional — only if all must-haves are complete)
- Microservices (Phase 3)
- Contractor credit line (Phase 3)

STATUS: APPROVED
