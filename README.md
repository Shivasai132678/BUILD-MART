# BuildMart — Construction Procurement Platform

## Overview
BuildMart is a construction procurement platform for Hyderabad contractors and homeowners that streamlines material sourcing through a quote-driven workflow: buyers create RFQs, matched vendors submit quotes, buyers place orders from selected quotes, and both sides track delivery and payment progress in one system.

## Tech Stack
- Backend: NestJS, Prisma 6, PostgreSQL, JWT (HTTP-only cookie)
- Frontend: Next.js (App Router), TailwindCSS, React Query, Zustand
- Infra: Docker, GitHub Actions CI, Render (backend), Vercel (frontend)

## Local Development

### Prerequisites
- Node.js v20.x
- pnpm v8+
- Docker + Docker Compose

### Setup
```bash
git clone https://github.com/Shivasai132678/BUILD-MART.git
cd BUILD-MART
pnpm install
cp apps/backend/.env.example apps/backend/.env
# Fill in apps/backend/.env values (see ENV.md)
docker-compose up -d db
cd apps/backend && npx prisma migrate deploy && npx prisma db seed
pnpm --filter backend start:dev
pnpm --filter frontend dev
```

Run the backend and frontend dev commands in separate terminals after migrations/seed complete.

## Demo Credentials (Seed Data)
Use OTP login with these seeded phone numbers (OTP is logged by the backend in local/dev mode):

- Admin: `+919000000001`
- Buyer: `+919000000002`, `+919000000003`
- Vendor: `+919000000004`, `+919000000005`, `+919000000006`

See `SEED.md` for complete seeded products, vendor mappings, and demo assumptions.

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

## API Usage & Swagger Policy
- Backend API routes are versioned under `/api/v1/*` with a health route at `/api/health`.
- Authentication is cookie-based (`access_token` HTTP-only cookie). Frontend requests must send credentials.
- Swagger/OpenAPI should only be enabled in non-production environments (staging/dev), never in production.

## Notes
- Frontend date rendering should use only `apps/frontend/lib/utils/date.ts#formatIST()` (Rule 18).
- JWT auth is cookie-only (HTTP-only); never store tokens in localStorage.
