#!/bin/bash

# File: scripts/rollback.sh
# LCBP3-DMS Rollback Script v4.0
# New Server (np-dms-lcbp3 / 192.168.10.11) — ADR-041 Server Consolidation
# Rollback flow: อ่าน deploy history → tag pre-built image เดิม → restart Layer 3
#
# ADR-015 Compliance:
#   - ใช้ pre-built image (เร็ว + ปลอดภัย — ไม่ต้อง rebuild ตอน rollback)
#   - อ่าน target version จาก deploy history หรือรับ parameter
#   - ถ้าไม่มี pre-built image ให้ fallback ไป rebuild จาก git checkout

set -e

SOURCE_DIR="/opt/np-dms-lcbp3"
COMPOSE_RUNTIME_DIR="/opt/np-dms/03-application"
ENV_FILE="/opt/np-dms/.env"
DEPLOY_HISTORY="/opt/np-dms/.deploy-history"

API_URL="http://192.168.10.11:3000/api"
AUTH_URL="https://lcbp3.np-dms.work"

# รับ parameter: rollback.sh [SHA] — ถ้าไม่ส่ง จะอ่านจาก deploy history
TARGET_SHA="${1:-}"

echo "========================================="
echo "LCBP3-DMS Rollback v4.0"
echo "Target: np-dms-lcbp3 (192.168.10.11)"
echo "========================================="

# Read overrides from .env if present
if [ -f "$ENV_FILE" ]; then
    ENV_URL=$(grep -E '^NEXT_PUBLIC_API_URL=' "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    [ -n "$ENV_URL" ] && API_URL="$ENV_URL"
    ENV_AUTH=$(grep -E '^AUTH_URL=' "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
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

# [1/4] หา target SHA สำหรับ rollback
echo "[1/4] Determining rollback target..."
CURRENT_SHA=$(git rev-parse --short=12 HEAD)

if [ -z "$TARGET_SHA" ]; then
    # อ่าน previous SHA จาก deploy history (บรรทัดล่าสุด = current, บรรทัดก่อนหน้า = previous)
    if [ -f "$DEPLOY_HISTORY" ]; then
        LATEST_SHA=$(tail -1 "$DEPLOY_HISTORY" | cut -d'|' -f1)
        if [ "$LATEST_SHA" = "$CURRENT_SHA" ]; then
            # current ตรงกับ history ล่าสุด → อ่านบรรทัดก่อนหน้า
            TARGET_SHA=$(tail -2 "$DEPLOY_HISTORY" | head -1 | cut -d'|' -f1)
        else
            TARGET_SHA="$LATEST_SHA"
        fi
    fi
fi

if [ -z "$TARGET_SHA" ]; then
    echo "✗ No rollback target found in deploy history"
    echo "  Usage: ./scripts/rollback.sh [SHA]"
    echo "  Or ensure $DEPLOY_HISTORY exists with at least 2 entries"
    exit 1
fi

echo "  Current:  $CURRENT_SHA"
echo "  Rollback: $TARGET_SHA"

# [2/4] ใช้ pre-built image (ถ้ามี) หรือ fallback ไป rebuild
echo "[2/4] Preparing rollback images..."
USE_PREBUILT=true

if ! docker image inspect "lcbp3-backend:${TARGET_SHA}" > /dev/null 2>&1; then
    echo "  ⚠️  lcbp3-backend:${TARGET_SHA} not found — fallback to rebuild"
    USE_PREBUILT=false
fi
if ! docker image inspect "lcbp3-frontend:${TARGET_SHA}" > /dev/null 2>&1; then
    echo "  ⚠️  lcbp3-frontend:${TARGET_SHA} not found — fallback to rebuild"
    USE_PREBUILT=false
fi

if [ "$USE_PREBUILT" = true ]; then
    # ADR-015: ใช้ pre-built image — เร็วและปลอดภัย (ไม่ต้อง rebuild ตอน rollback)
    echo "  Using pre-built images: $TARGET_SHA"
    docker tag "lcbp3-backend:${TARGET_SHA}" lcbp3-backend:latest
    docker tag "lcbp3-frontend:${TARGET_SHA}" lcbp3-frontend:latest
    echo "✓ Images tagged (:latest → $TARGET_SHA)"
else
    # Fallback: checkout commit + rebuild (กรณี image ถูก prune ไปแล้ว)
    echo "  Falling back to rebuild from git commit: $TARGET_SHA"
    export DOCKER_BUILDKIT=1
    git checkout "$TARGET_SHA" 2>/dev/null || {
        echo "✗ Cannot checkout $TARGET_SHA — commit not found"
        exit 1
    }
    echo "  Building backend..."
    docker build -f backend/Dockerfile \
        -t "lcbp3-backend:${TARGET_SHA}" \
        -t "lcbp3-backend:latest" \
        . || { echo "✗ Backend build failed!"; exit 1; }
    echo "  Building frontend..."
    docker build -f frontend/Dockerfile \
        --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
        --build-arg AUTH_URL="$AUTH_URL" \
        -t "lcbp3-frontend:${TARGET_SHA}" \
        -t "lcbp3-frontend:latest" \
        . || { echo "✗ Frontend build failed!"; exit 1; }
    echo "✓ Images rebuilt and tagged"
    # กลับไปที่ branch เดิม
    git checkout - 2>/dev/null || true
fi

# [3/4] Restart Layer 3 (application) with rolled-back images
echo "[3/4] Restarting application stack (Layer 3)..."
export BACKEND_IMAGE_TAG="$TARGET_SHA"
export FRONTEND_IMAGE_TAG="$TARGET_SHA"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_RUNTIME_DIR/docker-compose.yml" up -d --force-recreate
echo "✓ Stack restarted (image: $TARGET_SHA)"

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
echo "  Active image: $TARGET_SHA"
echo "  (also tagged :latest)"
echo "========================================="
