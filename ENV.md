# Environment Variables Reference

All values below are injected via Render (backend) and Vercel (frontend) dashboards
in production. Never commit real secrets. Only `.env.example` files with empty values
are tracked in git.

---

## Backend (`apps/backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (pooled). Must include `?connection_limit=5&pool_timeout=10` |
| `DIRECT_URL` | Yes | PostgreSQL direct (non-pooled) connection string. Used by Prisma Migrate. |
| `JWT_SECRET` | Yes | 32+ char secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | JWT expiry duration (default: `7d`) |
| `PORT` | No | HTTP listen port (default: `3001`) |
| `NODE_ENV` | No | `development` / `production` (default: `development`) |
| `FRONTEND_URL` | Yes | Full origin for CORS whitelist (e.g. `https://buildmart.vercel.app`) |
| `CLOUDINARY_CLOUD_NAME` | Prod | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Prod | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Prod | Cloudinary API secret |
| `CLOUDINARY_PRIVATE_FOLDER` | No | Upload folder (default: `buildmart-vendor-docs`) |
| `RAZORPAY_KEY_ID` | Prod | Razorpay key ID (sandbox or live) |
| `RAZORPAY_KEY_SECRET` | Prod | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Prod | Razorpay webhook signing secret |
| `MSG91_AUTH_KEY` | No | MSG91 auth key for OTP SMS delivery |
| `MSG91_TEMPLATE_ID` | No | MSG91 OTP template ID |
| `WHATSAPP_API_KEY` | No | Interakt/AiSensy WhatsApp Business API key |
| `WHATSAPP_SENDER_NUMBER` | No | WhatsApp sender phone number |

**Prod** = required in production, optional in development (graceful fallback).

---

## Frontend (`apps/frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL (e.g. `https://buildmart-api.onrender.com`) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Prod | Razorpay key ID for checkout widget |

In development, `NEXT_PUBLIC_API_URL` defaults to `http://localhost:3001`.
In production a missing value triggers a console error warning.

---

RULE: Never commit `.env` files. Only commit `.env.example` with blank values.
