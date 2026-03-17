# BuildMart — B2B Construction Procurement Platform

> Hyderabad's construction materials marketplace. Buyers post RFQs, vendors submit competing quotes, orders are confirmed and tracked end-to-end.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Dev Scripts](#dev-scripts)
- [Demo Accounts](#demo-accounts)
- [Project Structure](#project-structure)
- [Core Workflows](#core-workflows)
- [Deployment](#deployment)

---

## Overview

BuildMart is a **B2B construction materials procurement platform** connecting buyers and verified vendors in Hyderabad.

- **Buyers** browse the catalog, create Requests for Quote (RFQ), compare vendor submissions, and track orders + payments.
- **Vendors** receive matched RFQs based on their product catalog, submit quotes, and manage fulfilment.
- **Admins** approve vendor onboarding and monitor platform metrics.

Payment processing via **Razorpay** · OTP delivery via **MSG91** · File storage via **Cloudinary**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, Prisma 6, PostgreSQL 16, JWT (HTTP-only cookie) |
| Frontend | Next.js 16 (App Router), React 19, TailwindCSS v4, TanStack Query v5, Zustand |
| Auth | OTP via MSG91, SHA-256 hashed storage, JWT cookie sessions |
| Payments | Razorpay (order create + idempotent webhook) |
| Files | Cloudinary (vendor documents) |
| Infra | Docker Compose (local DB), GitHub Actions (CI), Render (backend), Vercel (frontend) |

---

## Quick Start

### Prerequisites

- **Node.js** v20+
- **pnpm** v8+
- **Docker Desktop** (for local Postgres)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env — set DATABASE_URL and any required secrets
# For local dev: Cloudinary/MSG91/Razorpay are optional (OTPs print to console)

# Frontend
cp apps/frontend/.env.example apps/frontend/.env.local
# Set: NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start the database

```bash
docker compose up -d db   # Postgres on port 5433
```

### 4. Run migrations + seed

```bash
pnpm db:reset   # migrate + seed in one command
```

### 5. Start the app

```bash
# Run BOTH backend and frontend simultaneously (recommended)
pnpm dev

# — or — run them separately if you prefer two terminals:
pnpm dev:backend    # Terminal 1  →  http://localhost:3001
pnpm dev:frontend   # Terminal 2  →  http://localhost:3000
```

Open **http://localhost:3000** in your browser.

> **Getting OTPs in dev mode:** OTPs are printed to the backend console as:
> `[DEV] OTP for +91XXXXXXXXXX: 123456`
> They are never logged in production.

---

## Dev Scripts

All scripts run from the **repo root**.

| Command | Description |
|---------|-------------|
| `pnpm dev` | **Start backend + frontend together** (recommended) |
| `pnpm dev:backend` | Backend only — NestJS in watch mode on :3001 |
| `pnpm dev:frontend` | Frontend only — Next.js dev server on :3000 |
| `pnpm db:reset` | Reset DB + run all migrations + reseed |
| `pnpm db:seed` | Run seed script only (no reset) |
| `pnpm lint:all` | Lint backend and frontend |
| `pnpm test:backend` | Run backend Jest test suite |
| `pnpm build:all` | Production build for both apps |

---

## E2E Coverage

Core E2E suites now enforce:

- Fresh onboarding journeys from auth to dashboard for both buyer and vendor.
- Vendor approval workflows (API and UI) without flaky onboarding-data collisions.
- Pending vendor policy: dashboard/read access to `/vendor/*` is allowed, while mutating actions
  (for example quote submission and vendor product mutations) are denied with `403`.

Run locally:

```bash
pnpm --dir apps/backend test:e2e
pnpm --dir apps/frontend test:e2e
```

Set `E2E_TEST_OTP=123456` in backend env for deterministic OTP flows in automation.

---

## Demo Accounts

Seed data creates these accounts (use the phone number to receive an OTP via console):

| Phone | Role | Notes |
|-------|------|-------|
| +919000000001 | Admin | Platform admin — vendor approval, metrics |
| +919000000002 | Buyer | Demo buyer account |
| +919000000003 | Buyer | Second demo buyer |
| +919000000004 | Vendor | Lakshmi Cement Stores (approved) |
| +919000000005 | Vendor | Hyderabad Paints Hub (approved) |
| +919000000006 | Vendor | Telangana Steel Works (approved) |

---

## Project Structure

```
apps/
├── backend/                        # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma           # 16 models, Decimal(10,2) money fields
│   │   ├── seed.ts
│   │   └── migrations/
│   └── src/
│       ├── auth/                   # OTP flow, JWT strategy, guards
│       ├── vendors/                # Vendor profiles + admin approval
│       ├── products/               # Catalog CRUD
│       ├── rfq/                    # RFQ creation + vendor matching
│       ├── quotes/                 # Quote submission + comparison
│       ├── orders/                 # State machine (CONFIRMED → DELIVERED)
│       ├── payments/               # Razorpay + idempotent webhook
│       ├── notifications/          # All alerts route through here only
│       ├── addresses/              # Buyer delivery addresses
│       ├── admin/                  # Metrics + vendor approval queue
│       └── common/                 # Guards, filters, interceptors
└── frontend/                       # Next.js App Router
    ├── app/
    │   ├── (auth)/                 # /login
    │   ├── (buyer)/                # /buyer/dashboard, /catalog, /rfq/*, /orders/*
    │   ├── (vendor)/               # /vendor/onboarding, /rfq/*, /orders/*
    │   └── (admin)/                # /admin/dashboard, /admin/vendors
    ├── lib/
    │   ├── api.ts                  # Axios base client
    │   ├── buyer-api.ts
    │   ├── vendor-api.ts
    │   └── admin-api.ts
    └── components/ui/              # Shared UI components
```

---

## Core Workflows

### RFQ Lifecycle
```
OPEN → QUOTED   (first vendor quote received)
OPEN → EXPIRED  (validUntil datetime reached)
QUOTED → CLOSED (buyer accepts a quote → order created)
```

### Order Lifecycle
```
CONFIRMED → OUT_FOR_DELIVERY → DELIVERED
CONFIRMED → CANCELLED
```
Any invalid transition throws a `400 Bad Request` with a descriptive message.

### Notification Events

All notifications are persisted in the DB and delivered via the `NotificationsService` exclusively.

| Event | Type | Recipient(s) |
|-------|------|--------------|
| RFQ created | `RFQ_CREATED` | Matched vendors (product-level) |
| Quote received | `QUOTE_RECEIVED` | Buyer |
| Order confirmed | `ORDER_CONFIRMED` | Buyer |
| Order status changed | `STATUS_UPDATED` | Buyer (OUT_FOR_DELIVERY / DELIVERED); Buyer + Vendor (CANCELLED) |
| Payment initiated | `PAYMENT_INITIATED` | Vendor |
| Payment succeeded | `PAYMENT_SUCCESS` | Buyer + Vendor |
| Payment failed | `PAYMENT_FAILED` | Buyer + Vendor |
| Vendor approved | `VENDOR_APPROVED` | Vendor |
| Vendor rejected | `VENDOR_REJECTED` | Vendor |

The `NotificationBell` component polls unread count every 30 s and shows a live dropdown.

### Payment Flow
1. Buyer hits **Pay Now** → backend creates a Razorpay order, upserts `Payment` record with `status: INITIATED`, and notifies the vendor.
2. Razorpay checkout modal opens in the browser.
3. On success, Razorpay fires a signed webhook → backend verifies HMAC, marks `Payment.status = SUCCESS` (idempotent: returns HTTP 200 immediately if already `SUCCESS`), notifies buyer + vendor.
4. Frontend polls `payment.status` every 3 s (60 s cap) and redirects on confirmation.
5. COD path: `paymentMethod: COD` stored on the Order; no Razorpay order is created.

1. Buyer/Vendor submits phone number
2. Backend sends OTP via MSG91 (or prints to console in dev)
3. OTP stored as SHA-256 hash with 5-minute expiry and `isUsed` guard
4. On verify: check expiry → check `isUsed=false` → mark used atomically → issue JWT as HTTP-only cookie

---

## Deployment

### Backend — Render

1. Deploy using `apps/backend/render.yaml` as the Render blueprint.
2. The Dockerfile at `apps/backend/Dockerfile` is used for the build.
3. Production start command runs `npx prisma migrate deploy` before NestJS starts.
4. Set all secrets from `apps/backend/.env.example` in the Render dashboard.
5. Set `FRONTEND_URL` to your Vercel frontend URL (CORS).

### Frontend — Vercel

1. Deploy the `apps/frontend` directory as a Next.js project.
2. Set env vars: `NEXT_PUBLIC_API_URL` (Render backend URL), `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
3. Update `apps/frontend/vercel.json` — replace `YOUR_RENDER_BACKEND_URL` with the actual Render URL.


## Staging Smoke Test Checklist
After deploying backend (Render) and frontend (Vercel), run this minimum staging validation:

### 1. Backend health + auth
- `GET /api/health` returns `200` with `{ status: "ok", timestamp: ... }`
- `POST /api/v1/auth/send-otp` returns success for a seeded phone (for example `+919000000001`)
- `POST /api/v1/auth/verify-otp` sets the HTTP-only auth cookie and returns the user profile

### 2. Frontend login + route guards
- `/login` loads and completes phone + OTP flow
- Buyer/Vendor/Admin users redirect to their respective dashboards after login
- Unauthorized role access redirects back to `/login`

### 3. Core feature sanity checks
- Buyer dashboard, RFQ pages, and orders pages render without crashes
- Vendor RFQ feed and order management pages render without crashes
- Admin dashboard loads (metrics/approval queue should fail gracefully if an endpoint/config mismatch exists)

### 4. Seed/demo data verification (staging DB)
- Run Prisma seed once after migrations if the staging DB is empty:
  - `cd apps/backend && npx prisma db seed`
- Confirm seeded counts roughly match local demo expectations (users, categories, products, vendor profiles)

## CI/CD
- GitHub Actions CI runs on pushes to `develop` and PRs targeting `main` via `.github/workflows/ci.yml`.
- CI uses PostgreSQL service containers and `prisma migrate deploy` (not `migrate dev`).

## Known Limitations
- WhatsApp/SMS delivery requires real provider credentials (`WHATSAPP_API_KEY`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`) in `apps/backend/.env`.
- Cloudinary uploads require valid `CLOUDINARY_*` keys in `apps/backend/.env`. In dev mode, missing keys are handled gracefully.
- Vendor document file upload UI (multipart upload from frontend) is Phase 2; current onboarding uses URL fields.
- New phone numbers are stored with `role: BUYER` in the DB during OTP send. The frontend redirects them to `/onboarding` (role selection) because `user.name` is null at that point. A dedicated `PENDING` role state is a planned but deferred schema change.
- RFQ cards do not display a free-text `title` field — the model uses `referenceCode` + item list as the primary identifier. A `title` field can be added via a named migration when needed.
- `VendorProfile.isApproved` is a boolean (not an enum). The `SUSPENDED` vendor state is not yet implemented.

## API Usage & Swagger Policy
- Backend API routes are versioned under `/api/v1/*` with a health route at `/api/health`.
- Authentication is cookie-based (`access_token` HTTP-only cookie). Frontend requests must send credentials.
- Swagger/OpenAPI should only be enabled in non-production environments (staging/dev), never in production.

## Notes
- Frontend date rendering should use only `apps/frontend/lib/utils/date.ts#formatIST()` (Rule 18).
- JWT auth is cookie-only (HTTP-only); never store tokens in localStorage.
