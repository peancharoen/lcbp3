#!/bin/bash

# File: scripts/deploy.sh
# LCBP3-DMS Deployment Script v3.0
# New Server (np-dms-lcbp3 / 192.168.10.11) — ADR-041 Server Consolidation
# 4-layer docker-compose:
#   Layer 1: Infrastructure (mariadb, redis, es, qdrant, pma)
#   Layer 2: Platform (gitea, n8n, n8n-db, docker-socket-proxy)
#   Layer 3: Application (clamav, backend, frontend) ← deploy target
#   Layer 4: AI (ocr-sidecar, ollama-metrics — Ollama = native systemd)
# Deploy flow: sync compose files → build images → restart Layer 3

set -e

SOURCE_DIR="/opt/np-dms-lcbp3"
COMPOSE_SRC_DIR="$SOURCE_DIR/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3"
COMPOSE_RUNTIME_DIR="/opt/np-dms/03-application"
ENV_FILE="/opt/np-dms/.env"

API_URL="http://192.168.10.11:3000/api"
AUTH_URL="https://lcbp3.np-dms.work"

echo "========================================="
echo "LCBP3-DMS Deployment v3.0"
echo "Target: np-dms-lcbp3 (192.168.10.11)"
echo "========================================="

# Read overrides from .env if present
if [ -f "$ENV_FILE" ]; then
    ENV_URL=$(grep -E '^NEXT_PUBLIC_API_URL=' "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    [ -n "$ENV_URL" ] && API_URL="$ENV_URL"
    ENV_AUTH=$(grep -E '^AUTH_URL=' "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    [ -n "$ENV_AUTH" ] && AUTH_URL="$ENV_AUTH"
fi

if [ ! -f "$COMPOSE_SRC_DIR/03-application/docker-compose.yml" ]; then
    echo "✗ Compose file not found: $COMPOSE_SRC_DIR/03-application/docker-compose.yml"
    exit 1
fi

cd "$SOURCE_DIR"

# เปิด BuildKit เพื่อ layer cache
export DOCKER_BUILDKIT=1

# [1/4] Sync compose files from source repo to runtime dirs
# อัปเดตเฉพาะ Layer 3 (application) — Layer 1/2/4 ไม่เปลี่ยนตาม code deploy
echo "[1/4] Syncing compose files to runtime dirs..."
mkdir -p "$COMPOSE_RUNTIME_DIR"
rm -f "$COMPOSE_RUNTIME_DIR/docker-compose.yml"
cp "$COMPOSE_SRC_DIR/03-application/docker-compose.yml" "$COMPOSE_RUNTIME_DIR/docker-compose.yml"
echo "✓ Layer 3 compose file synced"

# [2/4] Build images (sequential to reduce resource contention)
echo "[2/4] Building Docker images (sequential)..."

echo "  Building backend..."
docker build -f backend/Dockerfile -t lcbp3-backend:latest . || { echo "✗ Backend build failed!"; exit 1; }

echo "  Building frontend..."
docker build -f frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
    --build-arg AUTH_URL="$AUTH_URL" \
    -t lcbp3-frontend:latest . || { echo "✗ Frontend build failed!"; exit 1; }

echo "✓ Images built"

# [3/4] Restart Layer 3 (application) with new images
# Layer 1/2/4 ไม่ต้อง restart — ไม่ได้เปลี่ยนแปลงตาม code deploy
echo "[3/4] Restarting application stack (Layer 3)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_RUNTIME_DIR/docker-compose.yml" up -d --force-recreate
echo "✓ Stack restarted"

# [4/4] Health check
echo "[4/4] Waiting for backend to be healthy..."
for i in $(seq 1 30); do
    if docker exec backend curl -sf http://localhost:3000/health > /dev/null 2>&1 || \
       docker exec backend curl -sf http://localhost:3000/ping > /dev/null 2>&1; then
        echo "✓ Backend is healthy"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "✗ Backend health check failed after 60s"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_RUNTIME_DIR/docker-compose.yml" logs backend --tail=50
        exit 1
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

echo "========================================="
echo "✓ Deployment completed successfully!"
echo "========================================="
