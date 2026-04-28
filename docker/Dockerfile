# KO Broker Platform — Production Dockerfile
# PRD-14: Multi-stage build for minimal container size
#
# Build: docker build -f docker/Dockerfile -t ko-platform .
# Run:   docker run -p 3000:3000 ko-platform

# ── Stage 1: Dependencies ──
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY tooling/eslint-config/package.json ./tooling/eslint-config/
RUN pnpm install --frozen-lockfile

# ── Stage 2: Builder ──
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @ko/db generate
RUN pnpm --filter @ko/web build

# ── Stage 3: Runner ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
