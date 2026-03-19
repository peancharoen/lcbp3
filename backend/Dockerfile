# ============================================================
# LCBP3 Backend — NestJS Production Dockerfile
# Multi-stage build: deps → build → production
# Target: QNAP TS-473A (Container Station)
# ============================================================
# Build context: workspace root (nap-dms.lcbp3/)
# Usage: docker build -f backend/Dockerfile -t lcbp3-backend:latest .
# ============================================================

# =========================
# Stage 1: Install Dependencies
# =========================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Copy workspace root manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/

# Install backend deps only using pnpm workspace filter
RUN pnpm install --frozen-lockfile --filter backend...

# =========================
# Stage 2: Build Application
# =========================
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Enable build cache for better performance
ENV PNPM_STORE_DIR=/root/.local/share/pnpm/store

# Copy workspace structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy backend source
COPY backend/ ./backend/

# Build NestJS → backend/dist (with optimizations)
RUN cd backend && \
    NODE_OPTIONS="--max-old-space-size=4096" \
    pnpm run build

# Deploy with production deps only (pnpm workspace isolation)
RUN pnpm --filter backend deploy --prod --shamefully-hoist --legacy /app/backend-prod

# Clean up unnecessary files to reduce size
RUN find /app/backend-prod/node_modules -name "*.md" -delete \
    && find /app/backend-prod/node_modules -name "*.txt" -delete \
    && find /app/backend-prod/node_modules -name "LICENSE*" -delete \
    && find /app/backend-prod/node_modules -name "README*" -delete \
    && find /app/backend-prod/node_modules -name "CHANGELOG*" -delete

# =========================
# Stage 3: Production Runtime
# =========================
FROM node:22-alpine AS production

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

ENV TZ=Asia/Bangkok
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001

# Copy backend dist and node_modules (optimized)
COPY --from=build --chown=nestjs:nestjs /app/backend/dist ./dist
COPY --from=build --chown=nestjs:nestjs /app/backend-prod/package.json ./
# Copy node_modules with compression flag
COPY --from=build --chown=nestjs:nestjs /app/backend-prod/node_modules ./node_modules

# Create uploads directory (Two-Phase Storage)
RUN mkdir -p /app/uploads/temp /app/uploads/permanent && \
    chown -R nestjs:nestjs /app/uploads

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:3000/ping || exit 1

CMD ["node", "dist/main"]
