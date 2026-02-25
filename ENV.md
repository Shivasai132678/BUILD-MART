# Environment Variables Reference

# ── Backend (.env in apps/backend/) ──────────────────────
DATABASE_URL=postgresql://buildmart:buildmart@localhost:5432/buildmart_dev?connection_limit=5&pool_timeout=10
JWT_SECRET=<generate-strong-32-char-secret>
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ── MSG91 OTP ─────────────────────────────────────────────
MSG91_AUTH_KEY=<from-msg91-dashboard>
MSG91_TEMPLATE_ID=<from-msg91-dashboard>

# ── WhatsApp Business API ─────────────────────────────────
WHATSAPP_API_KEY=<from-interakt-or-aisensy>
WHATSAPP_SENDER_NUMBER=<whatsapp-business-number>

# ── Razorpay (sandbox) ────────────────────────────────────
RAZORPAY_KEY_ID=<from-razorpay-test-dashboard>
RAZORPAY_KEY_SECRET=<from-razorpay-test-dashboard>
RAZORPAY_WEBHOOK_SECRET=<from-razorpay-test-dashboard>

# ── Cloudinary ────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=<from-cloudinary-dashboard>
CLOUDINARY_API_KEY=<from-cloudinary-dashboard>
CLOUDINARY_API_SECRET=<from-cloudinary-dashboard>
CLOUDINARY_PRIVATE_FOLDER=buildmart-vendor-docs

# ── Monitoring ────────────────────────────────────────────
SENTRY_DSN=<from-sentry-dashboard>

# ── Frontend (.env.local in apps/frontend/) ───────────────
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_RAZORPAY_KEY_ID=<same as RAZORPAY_KEY_ID>

RULE: Never commit .env files. Only commit .env.example with blank values.
