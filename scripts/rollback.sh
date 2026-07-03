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

API_URL="http://192.168.10.11:3000/api"
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

# [0/4] Ownership guard — ตรวจสอบว่า runtime compose files เป็นของ np-dms
# ป้องกัน Permission denied จากไฟล์ที่ root เป็นเจ้าของ (เกิดจาก initial setup โดย root)
echo "[0/4] Checking runtime file ownership..."
RUNTIME_DIRS=("/opt/np-dms/01-infrastructure" "/opt/np-dms/02-platform" "$COMPOSE_RUNTIME_DIR")
OWNERSHIP_OK=true
for dir in "${RUNTIME_DIRS[@]}"; do
    if [ -f "$dir/docker-compose.yml" ]; then
        FILE_OWNER=$(stat -c '%U' "$dir/docker-compose.yml" 2>/dev/null || echo "unknown")
        if [ "$FILE_OWNER" != "$(whoami)" ]; then
            echo "  ⚠️  $dir/docker-compose.yml owned by '$FILE_OWNER' (expected: $(whoami))"
            OWNERSHIP_OK=false
        fi
    fi
done
if [ "$OWNERSHIP_OK" = false ]; then
    echo "  ❌ Runtime files have wrong ownership — run: sudo chown $(whoami):$(whoami) /opt/np-dms/*/docker-compose.yml"
    exit 1
fi
echo "✓ Ownership OK"

# [1/4] Checkout previous deploy tag (or fallback to HEAD~1)
echo "[1/4] Rolling back to previous deploy..."
CURRENT_COMMIT=$(git rev-parse HEAD)

# ค้นหา deploy tag ล่าสุดก่อน HEAD
PREV_TAG=$(git tag --sort=-creatordate | grep '^deploy-' | head -1)
if [ -n "$PREV_TAG" ] && [ "$(git rev-parse "$PREV_TAG")" != "$CURRENT_COMMIT" ]; then
  echo "  Found deploy tag: $PREV_TAG"
  git checkout "$PREV_TAG"
else
  echo "  No deploy tag found, falling back to HEAD~1"
  git checkout HEAD~1
fi
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
