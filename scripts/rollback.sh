#!/bin/bash

# File: scripts/rollback.sh
# LCBP3-DMS Rollback Script v3.0
# New Server (np-dms-lcbp3 / 192.168.10.11) — ADR-041 Server Consolidation
# Rollback flow: checkout previous commit → rebuild images → restart Layer 3
# ไม่มี blue-green/NGINX แล้ว — ใช้ docker compose --force-recreate แทน

set -e

SOURCE_DIR="/opt/np-dms-lcbp3"
COMPOSE_RUNTIME_DIR="/opt/np-dms/03-application"
ENV_FILE="/opt/np-dms/.env"

API_URL="https://backend.np-dms.work/api"
AUTH_URL="https://lcbp3.np-dms.work"

echo "========================================="
echo "LCBP3-DMS Rollback v3.0"
echo "Target: np-dms-lcbp3 (192.168.10.11)"
echo "========================================="

# Read overrides from .env if present
if [ -f "$ENV_FILE" ]; then
    ENV_URL=$(grep NEXT_PUBLIC_API_URL "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    [ -n "$ENV_URL" ] && API_URL="$ENV_URL"
    ENV_AUTH=$(grep AUTH_URL "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    [ -n "$ENV_AUTH" ] && AUTH_URL="$ENV_AUTH"
fi

cd "$SOURCE_DIR"

# [1/4] Checkout previous commit
echo "[1/4] Rolling back to previous commit..."
CURRENT_COMMIT=$(git rev-parse HEAD)
git checkout HEAD~1
PREVIOUS_COMMIT=$(git rev-parse HEAD)
echo "  Current:  $CURRENT_COMMIT"
echo "  Previous: $PREVIOUS_COMMIT"

# [2/4] Rebuild images from previous commit
export DOCKER_BUILDKIT=1
echo "[2/4] Rebuilding Docker images from previous commit..."

echo "  Building backend..."
docker build -f backend/Dockerfile -t lcbp3-backend:latest . || { echo "✗ Backend build failed!"; exit 1; }

echo "  Building frontend..."
docker build -f frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
    --build-arg AUTH_URL="$AUTH_URL" \
    -t lcbp3-frontend:latest . || { echo "✗ Frontend build failed!"; exit 1; }

echo "✓ Images rebuilt"

# [3/4] Restart Layer 3 (application) with rolled-back images
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
echo "✓ Rollback completed successfully!"
echo "Active commit: $PREVIOUS_COMMIT"
echo "========================================="
