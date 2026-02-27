FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace files
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Copy backend app manifest + prisma first for dependency layer caching
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/backend/prisma ./apps/backend/prisma

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY apps/backend ./apps/backend

RUN cd apps/backend && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app/apps/backend

RUN npm install -g pnpm

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./package.json
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/node_modules /app/node_modules

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
