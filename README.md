# BuildMart — Construction Procurement Platform

## Quick Start (Local Dev)

### Prerequisites
- Node v20+, pnpm v8+, Docker Desktop

### Steps
1. `pnpm install`
2. `cp apps/backend/.env.example apps/backend/.env`
   Edit `.env` and set required values (see ENV.md)
   For Cloudinary/MSG91/Razorpay: leave blank — app works without them in dev
3. `cp apps/frontend/.env.example apps/frontend/.env.local`
   Set `NEXT_PUBLIC_API_URL=http://localhost:3001`
4. `docker compose up -d db`  ← starts Postgres on port **5433**
   Update DATABASE_URL to use port 5433 if needed
5. `cd apps/backend && npx prisma migrate deploy && npx prisma db seed`
6. Terminal 1: `pnpm dev:backend`
7. Terminal 2: `pnpm dev:frontend`
8. Open http://localhost:3000

### Demo Accounts (from seed)
| Phone | Role | Business |
|-------|------|----------|
| +919000000001 | Admin | Platform Admin |
| +919000000002 | Buyer | Demo Buyer |
| +919000000003 | Buyer | Demo Buyer 2 |
| +919000000004 | Vendor | Lakshmi Cement Stores |
| +919000000005 | Vendor | Hyderabad Paints Hub |
| +919000000006 | Vendor | Telangana Steel Works |

### Getting Your OTP in Dev Mode
OTPs are printed to the backend console:
`[DEV] OTP for +91XXXXXXXXXX: 123456`
(Never logged in production)

---

## Overview
BuildMart is a construction procurement platform for Hyderabad contractors and homeowners that streamlines material sourcing through a quote-driven workflow: buyers create RFQs, matched vendors submit quotes, buyers place orders from selected quotes, and both sides track delivery and payment progress in one system.

## What's Built
- Auth: OTP login (MSG91 adapter), JWT HTTP-only cookie sessions, role-protected buyer/vendor/admin portals.
- Buyer flows: catalog browsing with category/search filters, address management API integration, multi-item RFQ creation, quote comparison, quote acceptance, and order tracking.
- Vendor flows: onboarding form + profile management UI, available RFQ feed, quote submission, and order status management.
- Admin flows: metrics + vendor approval queue backed by admin endpoints.
- Backend integrations: notification event wiring across RFQ/quote/order/payment flows, Cloudinary adapter for vendor document URL upload handling, Razorpay payment order/webhook flow.
- Testing: backend Jest coverage for auth OTP lifecycle, order state machine transitions, and RFQ vendor matching logic.

## Tech Stack
- Backend: NestJS, Prisma 6, PostgreSQL, JWT (HTTP-only cookie)
- Frontend: Next.js (App Router), TailwindCSS, React Query, Zustand
- Infra: Docker, GitHub Actions CI, Render (backend), Vercel (frontend)

## Dev Scripts (Root)
| Script | Description |
|--------|-------------|
| `pnpm dev:backend` | Start backend in watch mode |
| `pnpm dev:frontend` | Start Next.js dev server |
| `pnpm db:reset` | Reset DB + run migrations + seed |
| `pnpm db:seed` | Run seed script only |
| `pnpm lint:all` | Lint backend + frontend |
| `pnpm test:backend` | Run backend tests |
| `pnpm build:all` | Build backend + frontend |

## Deployment

### Backend (Render)
- Use `apps/backend/render.yaml` as the Render blueprint.
- Render builds the backend Docker image using `apps/backend/Dockerfile`.
- Production startup runs `npx prisma migrate deploy` before starting NestJS (Rule 21: never `migrate dev` in production).
- Configure all secrets in Render using `apps/backend/.env.example` as the checklist.
- Set `FRONTEND_URL` to the deployed Vercel app URL so backend CORS allows browser requests.

### Frontend (Vercel)
- Deploy `apps/frontend` to Vercel as a Next.js app.
- Set env vars from `apps/frontend/.env.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`).
- `apps/frontend/vercel.json` includes a rewrite placeholder for backend API proxying.
- Replace `YOUR_RENDER_BACKEND_URL` with the actual Render backend URL after the first backend deployment.

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

## API Usage & Swagger Policy
- Backend API routes are versioned under `/api/v1/*` with a health route at `/api/health`.
- Authentication is cookie-based (`access_token` HTTP-only cookie). Frontend requests must send credentials.
- Swagger/OpenAPI should only be enabled in non-production environments (staging/dev), never in production.

## Notes
- Frontend date rendering should use only `apps/frontend/lib/utils/date.ts#formatIST()` (Rule 18).
- JWT auth is cookie-only (HTTP-only); never store tokens in localStorage.
