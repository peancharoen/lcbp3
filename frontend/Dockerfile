# ============================================================
# LCBP3 Frontend — Next.js Production Dockerfile
# Multi-stage build: deps → build → production (standalone)
# Target: QNAP TS-473A (Container Station)
# ============================================================
# Build context: workspace root (nap-dms.lcbp3/)
# Usage: docker build -f frontend/Dockerfile -t lcbp3-frontend:latest .
# ============================================================

# =========================
# Stage 1: Install Dependencies
# =========================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/

# Install frontend deps only
RUN pnpm install --frozen-lockfile --filter lcbp3-frontend...

# =========================
# Stage 2: Build Application
# =========================
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules

# Copy frontend source
COPY frontend/ ./frontend/

# NEXT_PUBLIC_* vars must be set at BUILD TIME (baked into client bundle)
ARG NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js → frontend/.next/standalone
RUN cd frontend && pnpm run build

# =========================
# Stage 3: Production Runtime
# =========================
FROM node:22-alpine AS production

WORKDIR /app

ENV TZ=Asia/Bangkok
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nextjs && \
    adduser -S nextjs -u 1001

# Copy standalone output from build
COPY --from=build --chown=nextjs:nextjs /app/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/frontend/.next/static ./frontend/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "frontend/server.js"]
