# BuildMart — AI Coding Instructions

> `CLAUDE.md` at the repo root takes precedence over this file on any conflict.
> These instructions provide operational context for AI-assisted coding sessions.

---

## 1. Project Overview

BuildMart is a **B2B construction materials procurement platform**.

- **Buyers** create Requests for Quote (RFQ) for building materials.
- **Vendors** receive matched RFQs, submit quotes, and fulfil orders.
- **Admins** approve vendor onboarding and view platform metrics.

Payments: Razorpay. OTP delivery: MSG91. File storage: Cloudinary.
All notifications (WhatsApp, SMS, in-app) route exclusively through `NotificationsService`.

---

## 2. Core Workflows

**Auth**
- Buyer/Vendor submits phone → backend sends OTP via MSG91 → user submits OTP.
- OTP stored as SHA-256 hash in `OTPRecord` with 5-min `expiresAt` and `isUsed` boolean.
- On verify: check expiry → check `isUsed=false` → set `isUsed=true` (atomic) → issue JWT.
- JWT issued as HTTP-only cookie named `access_token`. Never in response body.

**Vendor Onboarding**
- Vendor submits GST number, bank details, documents (Cloudinary URLs).
- Admin reviews queue at `/admin/vendors` and sets `VendorProfile.isApproved = true`.

**RFQ Lifecycle**
```
OPEN → QUOTED   (first vendor quote received)
OPEN → EXPIRED  (validUntil datetime reached)
QUOTED → CLOSED (buyer accepts a quote; order is created)
```

**Order Lifecycle — strict state machine, no exceptions**
```
CONFIRMED → OUT_FOR_DELIVERY → DELIVERED
CONFIRMED → CANCELLED
```
Any other transition throws `BadRequestException` with a descriptive message.
Transitions are validated against `apps/backend/src/common/constants/status-transitions.ts`.

**Payment**
- Online: Razorpay order created → frontend renders Razorpay modal → webhook fires.
- Webhook checks `Payment.status === SUCCESS` first; if already SUCCESS returns HTTP 200 immediately without re-processing.
- COD path: `PaymentMethod.COD` exists in schema; verify `payments.service.ts` before editing.

---

## 3. Architecture

**Monorepo layout**
```
apps/
├── backend/
│   ├── prisma/schema.prisma        # 16 models; all money as Decimal(10,2)
│   └── src/
│       ├── auth/                   # OTP flow, JWT strategy, JwtAuthGuard, RolesGuard
│       ├── vendors/                # VendorProfile + separate admin-vendor controller
│       ├── products/               # Catalog CRUD (admin), browsing (buyer/vendor)
│       ├── rfq/                    # RFQ creation; product-level vendor matching
│       ├── quotes/                 # Vendor quote submission and buyer comparison
│       ├── orders/                 # State machine enforcement
│       ├── payments/               # Razorpay; idempotent webhook handler
│       ├── notifications/          # ONLY entry point for all alert dispatch
│       ├── addresses/              # Buyer delivery addresses
│       ├── admin/                  # Metrics aggregation, vendor approval queue
│       ├── prisma/                 # PrismaModule (global); PrismaService
│       └── common/                 # Guards, filters, interceptors, decorators
└── frontend/
    ├── app/
    │   ├── (auth)/                 # /login — phone step + OTP step
    │   ├── (buyer)/                # /buyer/dashboard, /catalog, /rfq/*, /orders/*
    │   ├── (vendor)/               # /vendor/onboarding, /rfq/*, /orders/*
    │   └── (admin)/                # /admin/dashboard, /admin/vendors
    ├── lib/
    │   ├── api.ts                  # Base Axios client; sends credentials on every request
    │   ├── buyer-api.ts            # Buyer endpoint wrappers
    │   ├── vendor-api.ts           # Vendor endpoint wrappers
    │   ├── admin-api.ts            # Admin endpoint wrappers
    │   └── utils/date.ts           # formatIST() — the ONLY permitted date formatter
    └── middleware.ts               # Route protection via GET /api/v1/auth/me
```

**Tech stack**
- Backend: NestJS 11 (Express), Prisma 6 (locked — no v7 without explicit approval), PostgreSQL 16
- Frontend: Next.js App Router, React 19, TailwindCSS v4, TanStack Query v5, React Hook Form + Zod, Zustand, Axios
- Infra: Render (backend), Vercel (frontend), Neon (PostgreSQL), GitHub Actions (CI), Docker Compose (local dev)

**Global backend config (`main.ts`)**
- `app.setGlobalPrefix("api")` + URI versioning `defaultVersion: "1"` → all routes at `/api/v1/...`
- CORS origin: `process.env.FRONTEND_URL` only; credentials: true
- Global: `ValidationPipe` (whitelist + transform + forbidNonWhitelisted), `ResponseInterceptor`, `GlobalExceptionFilter`
- Swagger: enabled only when `NODE_ENV !== "production"` at `/api/docs`
- Razorpay webhook path receives raw body: `express.raw({ type: "application/json" })`

---

## 4. Coding Conventions

- **Controllers hold zero business logic.** All logic lives in services.
- **Services consume other services via NestJS constructor injection only.** Never `new SomeService()`.
- **All money and quantity fields: `Decimal(10,2)` in Prisma schema.** Never `Float`, never JS `number` type for arithmetic.
- **All DB timestamps stored as UTC.** Backend never converts timezones.
- **Frontend date display: `formatIST(date)` from `lib/utils/date.ts` exclusively.** No `toLocaleDateString`, `moment`, `date-fns`, or direct `Intl.DateTimeFormat` calls anywhere else.
- **DTOs use `class-validator` decorators.** `ValidationPipe` is global with `whitelist: true, transform: true, forbidNonWhitelisted: true`.
- **Every list/collection endpoint exposes `limit` and `offset` query params.** No exceptions.
- **Rate limits are decorator-level:** `@Throttle(5, 60)` on OTP endpoints; `@Throttle(10, 60)` on `POST /api/v1/rfq`. Global ThrottlerGuard default: 100 req/60 s.
- **Responses are standardised** via `ResponseInterceptor`. Do not return raw objects from controllers.
- **IDs use cuid** (`@default(cuid())`). Do not switch to uuid without a migration.

---

## 5. Critical Constraints

Violation of any of these requires immediate correction before committing.

| Rule | Constraint | Enforcement |
|---|---|---|
| 1 | Controllers contain zero business logic | All logic → service layer |
| 2 | Services use NestJS DI only | No direct service-to-service imports |
| 3–4 | All money = `Decimal(10,2)` | Schema type + no JS number arithmetic on amounts |
| 5 | Vendor-RFQ matching is product-level | `VendorProduct.productId IN (rfqItemProductIds)`; category-level matching is explicitly forbidden |
| 6–7 | OTP stored as SHA-256 hash; atomically consumed | `otpHash` field only; verify expiry → isUsed=false → set isUsed=true in one transaction |
| 8–9 | JWT via HTTP-only cookie only | Never in response body; never in localStorage |
| 10 | CORS origin = `process.env.FRONTEND_URL` | Never `"*"` |
| 11 | All list endpoints paginate | `limit` + `offset` required |
| 12–13 | `@Throttle()` decorators on OTP and RFQ | Must not be removed |
| 14 | Razorpay webhook idempotency | Return HTTP 200 immediately if `Payment.status === SUCCESS` |
| 15 | All notifications through `NotificationsService` | No direct WhatsApp/SMS/email calls in any other module |
| 16 | `DATABASE_URL` must include connection params | `?connection_limit=5&pool_timeout=10` |
| 17 | UTC in DB, IST on frontend | Backend: store UTC. Frontend: display via `formatIST()` |
| 19 | Order state machine enforced on every update | Validate against `status-transitions.ts`; throw `BadRequestException` on invalid transition |
| 21 | Prisma migrations: named files required | `migrate dev --name <name>` (dev); `migrate deploy` (CI). Never `migrate dev` in CI. Prisma locked at `^6`. |
| 22 | Swagger disabled in production | Gated by `process.env.NODE_ENV !== 'production'` in `main.ts` |

> **Note:** Rules 18 and 20 correspond to frontend-only constraints defined in `CLAUDE.md`
> (Rule 18: `formatIST()` as the only permitted date formatter; Rule 20: API version prefix).
> They are omitted from this table because they have no backend-enforcement counterpart.

---

## 6. Change Strategy

Before writing any code:

1. **Read the target file first.** Do not propose edits to unread code.
2. **Cross-check `CLAUDE.md`** whenever the change touches: auth, money fields, order transitions, RFQ matching, or notifications.
3. **Schema change?** Create a named migration: `cd apps/backend && npx prisma migrate dev --name <descriptive-name>`. Commit the migration file.
4. **New money or quantity field?** Use `Decimal(10,2)` in schema. Never store as Float or pass as JS number through service logic.
5. **New list endpoint?** Add `limit` and `offset` query params from the start.
6. **New notification trigger?** Call `NotificationsService` — never call MSG91, WhatsApp, or email APIs directly from another module.
7. **New order status or transition?** Update `status-transitions.ts` and `ARCHITECTURE.md`. Confirm the invalid-transition error path is tested.
8. **New rate-limited endpoint?** Apply `@Throttle()` decorator at the controller method level.
9. **Frontend date display?** Call `formatIST()` from `lib/utils/date.ts`. No other approach is permitted.

---

## 7. Validation

**After any backend change**
- `cd apps/backend && pnpm lint` — must pass with zero errors
- `cd apps/backend && pnpm test` — all Jest unit tests must pass
- If schema was changed: migration file must exist and be committed before pushing

**After any frontend change**
- `cd apps/frontend && pnpm lint` — must pass with zero errors
- All date formatting uses `formatIST()` exclusively
- No `localStorage` reads or writes for auth tokens

**CI pipeline** (triggers on push to `develop`; PR to `main`)
- Installs with frozen lockfile (`pnpm install --frozen-lockfile`)
- Lints backend and frontend
- Runs `npx prisma migrate deploy` (never `migrate dev`)
- Builds backend and frontend
- Runs backend Jest test suite
