# ============================================================
# LCBP3 Frontend — Next.js Production Dockerfile
# Multi-stage build: deps → build → production (standalone)
# Target: QNAP TS-473A (Container Station)
# ============================================================
# Build context: workspace root (nap-dms.lcbp3/)
# Usage: docker build -f frontend/Dockerfile -t lcbp3-frontend:latest .
# ============================================================
# NOTE: Build stage uses short paths (/w = workspace, /b = build root)
# to avoid "Unknown system error -10" caused by QNAP overlayfs
# path-depth limits with deeply nested App Router routes like
# (admin)/admin/doc-control/drawings/contract/categories.
# ============================================================

# =========================
# Stage 1: Install Dependencies
# =========================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /w

# Copy workspace root manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/

# Install frontend deps only
RUN pnpm install --frozen-lockfile --filter lcbp3-frontend...

# =========================
# Stage 2: Build Application
# =========================
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# --- Workspace root at /w (holds pnpm manifests + root node_modules) ---
WORKDIR /w
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /w/node_modules ./node_modules

# --- Frontend source directly at /w/frontend ---
WORKDIR /w/frontend
COPY --from=deps /w/frontend/node_modules ./node_modules
COPY frontend/ ./

# NEXT_PUBLIC_* vars must be set at BUILD TIME (baked into client bundle)
ARG NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Prevent OOMs during build by limiting Node memory to 2GB and disabling telemetry
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NEXT_TELEMETRY_DISABLED=1

# WORKAROUND: QNAP overlayfs fails with "Unknown system error -10" on deeply
# nested App Router paths. Redirect .next output to ultra-short root path /n
# to minimise overlay nesting depth, then move back after build completes.
RUN mkdir /n && ln -s /n .next && \
    pnpm run build --webpack && \
    rm .next && mv /n .next


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

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy standalone output from build
COPY --from=build --chown=nextjs:nextjs /w/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /w/frontend/.next/static ./frontend/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "frontend/server.js"]

