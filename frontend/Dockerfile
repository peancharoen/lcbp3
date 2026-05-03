# ============================================================
# LCBP3 Frontend — Next.js Production Dockerfile
# Multi-stage build: deps → build → production (pnpm deploy)
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

# Install frontend deps only (--ignore-scripts เพื่อข้าม postinstall ที่อาจ fail ใน CI)
RUN pnpm install --frozen-lockfile --ignore-scripts --filter lcbp3-frontend...

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

# Ensure public directory exists and has content
RUN ls -la /w/frontend/public/ || (echo "WARNING: public directory not found, creating empty one" && mkdir -p /w/frontend/public)

# Copy Monaco Editor assets สำหรับ self-hosting (ไม่ต้องพึ่ง cdn.jsdelivr.net)
# เพื่อผ่าน CSP directive: style-src 'self' 'unsafe-inline'
RUN node -e "\
  const fs=require('fs'); \
  const path=require('path'); \
  const dst='/w/frontend/public/monaco-vs'; \
  const searchPaths=['/w/frontend/node_modules','/w/node_modules']; \
  try { \
    const pkgJson=require.resolve('monaco-editor/package.json',{paths:searchPaths}); \
    const src=path.join(path.dirname(pkgJson),'min','vs'); \
    if(!fs.existsSync(dst)){fs.cpSync(src,dst,{recursive:true});console.log('Monaco assets copied from: '+src)} \
    else{console.log('Monaco assets already exist at '+dst)} \
  } catch(e) { \
    console.error('ERROR: monaco-editor not found in',searchPaths,e.message); \
    process.exit(1); \
  } \
"

# NEXT_PUBLIC_* vars must be set at BUILD TIME (baked into client bundle)
ARG NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# AUTH_URL for NextAuth redirects
ARG AUTH_URL=https://lcbp3.np-dms.work
ENV AUTH_URL=${AUTH_URL}

# Prevent OOMs during build by limiting Node memory to 2GB and disabling telemetry
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NEXT_TELEMETRY_DISABLED=1

# Disable Turbopack to avoid "No child process" panic in Docker container
ENV NEXT_TURBOPACK=0

# WORKAROUND: QNAP overlayfs fails with "Unknown system error -10" on deeply
# nested App Router paths. Redirect .next output to ultra-short root path /n
# to minimise overlay nesting depth, then move back after build completes.
RUN mkdir /n && ln -s /n .next && \
    pnpm run build && \
    rm .next && mv /n .next

# Verify build was created
RUN ls -la /w/frontend/.next/ || (echo "ERROR: Build not found!" && exit 1)

# Create a self-contained deployment with flat node_modules (no pnpm symlinks)
# pnpm deploy resolves all workspace symlinks into real files that Docker COPY can handle
WORKDIR /w
RUN pnpm --filter lcbp3-frontend deploy /deploy --prod --legacy


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

# Copy flat node_modules from pnpm deploy (no symlinks, Docker-safe)
COPY --from=build --chown=nextjs:nextjs /deploy/node_modules ./node_modules
# Copy build output and public assets
COPY --from=build --chown=nextjs:nextjs /w/frontend/.next ./.next
COPY --from=build --chown=nextjs:nextjs /w/frontend/public ./public
COPY --from=build --chown=nextjs:nextjs /w/frontend/package.json ./

# Verify files exist
RUN ls -la ./node_modules/next/dist/bin/next && ls -la ./.next/ && ls -la ./public/ || (echo "ERROR: Required files not found!" && exit 1)

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "node_modules/next/dist/bin/next", "start"]

