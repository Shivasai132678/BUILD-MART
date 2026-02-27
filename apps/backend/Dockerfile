FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace files
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./

# Copy backend app manifest + prisma for layer caching
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/backend/prisma ./apps/backend/prisma

RUN npm install -g pnpm && pnpm install --frozen-lockfile --shamefully-hoist

# Copy the full backend source
COPY apps/backend ./apps/backend

# Switch to backend directory for generate + build
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN rm -f tsconfig.build.tsbuildinfo
RUN pnpm build

# ── Runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app/apps/backend

ENV NODE_ENV=production

# Copy built output, prisma schema (for migrate), and dependencies
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/package.json ./package.json
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/node_modules /app/node_modules

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
