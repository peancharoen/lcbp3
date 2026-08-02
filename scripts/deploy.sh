#!/bin/bash

# File: scripts/deploy.sh
# LCBP3-DMS Deployment Script v4.0
# New Server (np-dms-lcbp3 / 192.168.10.11) — ADR-041 Server Consolidation
# 4-layer docker-compose:
#   Layer 1: Infrastructure (mariadb, redis, es, qdrant, pma)
#   Layer 2: Platform (gitea, n8n, n8n-db, docker-socket-proxy)
#   Layer 3: Application (clamav, backend, frontend) ← deploy target
#   Layer 4: AI (ocr-sidecar, ollama-metrics — Ollama = native systemd)
# Deploy flow: sync compose files → build images (tagged with git SHA) → restart Layer 3
#
# ADR-015 Compliance:
#   - Image tagging with git SHA (rollback ได้)
#   - Auto-rollback เมื่อ health check fail
#   - Image retention: เก็บ 3 versions ล่าสุด

set -e

SOURCE_DIR="/opt/np-dms-lcbp3"
COMPOSE_SRC_DIR="$SOURCE_DIR/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3"
COMPOSE_RUNTIME_DIR="/opt/np-dms/03-application"
ENV_FILE="/opt/np-dms/.env"
DEPLOY_HISTORY="/opt/np-dms/.deploy-history"
IMAGE_RETENTION=3

API_URL="http://192.168.10.11:3000/api"
AUTH_URL="https://lcbp3.np-dms.work"

echo "========================================="
echo "LCBP3-DMS Deployment v4.0"
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

# ── ADR-015: บันทึก git SHA สำหรับ image tagging ──────────────────────
GIT_SHA=$(git rev-parse --short=12 HEAD)
GIT_SHA_FULL=$(git rev-parse HEAD)
DEPLOY_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "  Git SHA: $GIT_SHA"
echo "  Commit:  $GIT_SHA_FULL"

# [0/5] Ownership guard — ตรวจสอบว่า runtime compose files เป็นของ np-dms
# ป้องกัน Permission denied จากไฟล์ที่ root เป็นเจ้าของ (เกิดจาก initial setup โดย root)
echo "[0/5] Checking runtime file ownership..."
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

# [1/5] Sync compose files from source repo to runtime dirs
# อัปเดตเฉพาะ Layer 3 (application) — Layer 1/2/4 ไม่เปลี่ยนตาม code deploy
# ใช้ install แทน cp เพื่อสร้างไฟล์ใหม่เสมอ (ป้องกัน Permission denied จาก root-owned file)
echo "[1/5] Syncing compose files to runtime dirs..."
mkdir -p "$COMPOSE_RUNTIME_DIR"
install -m 644 "$COMPOSE_SRC_DIR/03-application/docker-compose.yml" "$COMPOSE_RUNTIME_DIR/docker-compose.yml"
echo "✓ Layer 3 compose file synced"

# [2/5] Build images (sequential to reduce resource contention)
# ADR-015: tag ด้วย git SHA + :latest เพื่อให้ rollback ได้
echo "[2/5] Building Docker images (tagged with git SHA: $GIT_SHA)..."

echo "  Building backend..."
docker build -f backend/Dockerfile \
    -t "lcbp3-backend:${GIT_SHA}" \
    -t "lcbp3-backend:latest" \
    . || { echo "✗ Backend build failed!"; exit 1; }

echo "  Building frontend..."
docker build -f frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
    --build-arg AUTH_URL="$AUTH_URL" \
    -t "lcbp3-frontend:${GIT_SHA}" \
    -t "lcbp3-frontend:latest" \
    . || { echo "✗ Frontend build failed!"; exit 1; }

echo "✓ Images built (tags: $GIT_SHA + latest)"

# [3/5] Restart Layer 3 (application) with new images
# ใช้ BACKEND_IMAGE_TAG/FRONTEND_IMAGE_TAG env var เพื่อระบุ version ที่จะรัน
# Layer 1/2/4 ไม่ต้อง restart — ไม่ได้เปลี่ยนแปลงตาม code deploy
echo "[3/5] Restarting application stack (Layer 3)..."
export BACKEND_IMAGE_TAG="$GIT_SHA"
export FRONTEND_IMAGE_TAG="$GIT_SHA"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_RUNTIME_DIR/docker-compose.yml" up -d --force-recreate
echo "✓ Stack restarted (image: $GIT_SHA)"

# [4/5] Health check with auto-rollback
# ADR-015: ถ้า health check fail ให้ rollback อัตโนมัติ
echo "[4/5] Waiting for backend to be healthy..."
HEALTH_OK=false
for i in $(seq 1 30); do
    if docker exec backend curl -sf http://localhost:3000/health > /dev/null 2>&1 || \
       docker exec backend curl -sf http://localhost:3000/ping > /dev/null 2>&1; then
        echo "✓ Backend is healthy"
        HEALTH_OK=true
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "✗ Backend health check failed after 60s"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_RUNTIME_DIR/docker-compose.yml" logs backend --tail=50
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

if [ "$HEALTH_OK" = false ]; then
    echo ""
    echo "⚠️  Health check failed — initiating auto-rollback (ADR-015)..."
    # อ่าน previous SHA จาก deploy history
    PREV_SHA=$(tail -1 "$DEPLOY_HISTORY" 2>/dev/null | cut -d'|' -f1)
    if [ -z "$PREV_SHA" ] || [ "$PREV_SHA" = "$GIT_SHA" ]; then
        # หา previous จาก history บรรทัดก่อนหน้า
        PREV_SHA=$(tail -2 "$DEPLOY_HISTORY" 2>/dev/null | head -1 | cut -d'|' -f1)
    fi

    if [ -z "$PREV_SHA" ]; then
        echo "✗ No previous deploy found in history — cannot auto-rollback"
        echo "  Manual rollback: ./scripts/rollback.sh"
        exit 1
    fi

    echo "  Rolling back to: $PREV_SHA"
    if docker image inspect "lcbp3-backend:${PREV_SHA}" > /dev/null 2>&1 && \
       docker image inspect "lcbp3-frontend:${PREV_SHA}" > /dev/null 2>&1; then
        # Tag previous image เป็น latest แล้ว restart
        docker tag "lcbp3-backend:${PREV_SHA}" lcbp3-backend:latest
        docker tag "lcbp3-frontend:${PREV_SHA}" lcbp3-frontend:latest
        export BACKEND_IMAGE_TAG="latest"
        export FRONTEND_IMAGE_TAG="latest"
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_RUNTIME_DIR/docker-compose.yml" up -d --force-recreate
        echo "  Waiting for rollback to stabilize..."
        sleep 10
        if docker exec backend curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            echo "✓ Auto-rollback successful — system restored to $PREV_SHA"
            exit 1  # ยังคง exit 1 เพื่อแจ้ง CI ว่า deploy นี้ fail
        else
            echo "✗ Auto-rollback also failed — manual intervention required"
            exit 1
        fi
    else
        echo "✗ Previous image ($PREV_SHA) not found — cannot auto-rollback"
        echo "  Manual rollback: ./scripts/rollback.sh"
        exit 1
    fi
fi

# [5/5] Post-deploy: บันทึก deploy history + prune old images
# ADR-015: เก็บ deploy history และ image retention 3 versions
echo "[5/5] Post-deploy cleanup..."
# บันทึก deploy history (format: SHA|timestamp|commit_full)
echo "${GIT_SHA}|${DEPLOY_TIMESTAMP}|${GIT_SHA_FULL}" >> "$DEPLOY_HISTORY"
echo "✓ Deploy history updated ($DEPLOY_HISTORY)"

# Prune old images — เก็บ $IMAGE_RETENTION versions ล่าสุด
# หา SHA tags ทั้งหมดของ backend, เรียงตามวันสร้าง, ลบของเก่ากว่า retention
PRUNE_COUNT=0
for REPO in lcbp3-backend lcbp3-frontend; do
    # หา image tags ที่เป็น SHA (12 hex chars) ไม่ใช่ latest
    # ใช้ awk แทน grep -P เพื่อความ portable (รองรับ busybox/alpine)
    OLD_TAGS=$(docker images --format "{{.Tag}}\t{{.CreatedAt}}" "$REPO" 2>/dev/null \
        | awk -F'\t' '$1 ~ /^[0-9a-f]{12}$/' \
        | sort -t$'\t' -k2 -r \
        | tail -n +$((IMAGE_RETENTION + 1)) \
        | cut -f1)
    if [ -n "$OLD_TAGS" ]; then
        for TAG in $OLD_TAGS; do
            echo "  Pruning $REPO:$TAG (older than retention=$IMAGE_RETENTION)"
            docker rmi "$REPO:$TAG" > /dev/null 2>&1 || true
            PRUNE_COUNT=$((PRUNE_COUNT + 1))
        done
    fi
done
if [ "$PRUNE_COUNT" -gt 0 ]; then
    echo "✓ Pruned $PRUNE_COUNT old image(s) — kept last $IMAGE_RETENTION versions"
else
    echo "✓ No old images to prune (retention=$IMAGE_RETENTION)"
fi

echo "========================================="
echo "✓ Deployment completed successfully!"
echo "  Image: $GIT_SHA (also tagged :latest)"
echo "  History: $DEPLOY_HISTORY"
echo "========================================="
