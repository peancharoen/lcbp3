#!/bin/sh

# File: scripts/registry-gc.sh
# Registry Garbage Collection — ASUSTOR Private Registry (192.168.10.9:5000)
# ADR-041: artifact separation — registry storage cleanup policy
#
# หลักการ:
#   - Docker Registry เก็บ blobs ใน filesystem; การลบ tag ผ่าน API จะ unreference blob
#     แต่ไม่คืนพื้นที่ดิสก์จนกว่าจะรัน garbage collection
#   - Script นี้รันบน ASUSTOR (เจ้าของ registry container)
#   - ต้องหยุด registry ชั่วคราว (read-only mode) เพื่อ GC ที่ปลอดภัย
#
# Usage:
#   ssh asustor
#   source /volume1/np-dms/registry/.env
#   /volume1/np-dms/scripts/registry-gc.sh
#
# Schedule (cron — ทุกวันอาทิตย์ 04:00):
#   0 4 * * 0 /volume1/np-dms/scripts/registry-gc.sh >> /volume1/np-dms/registry/gc.log 2>&1

set -e

REGISTRY_CONTAINER="registry"
REGISTRY_DATA_DIR="/volume1/np-dms/registry/data"
REGISTRY_URL="http://localhost:5000"
REGISTRY_USER="${REGISTRY_ADMIN_USER:-admin}"
REGISTRY_PASS="${REGISTRY_ADMIN_PASSWORD:-}"
RETENTION_TAGS=5

echo "========================================="
echo "Registry Garbage Collection"
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================="

# ตรวจสอบว่ารันบน ASUSTOR (มี registry container)
if ! docker ps --format '{{.Names}}' | grep -q "^${REGISTRY_CONTAINER}$"; then
    echo "✗ Registry container '${REGISTRY_CONTAINER}' not found — ต้องรันบน ASUSTOR"
    exit 1
fi

if [ -z "$REGISTRY_PASS" ]; then
    echo "✗ REGISTRY_ADMIN_PASSWORD not set — source .env first:"
    echo "  source /volume1/np-dms/registry/.env"
    exit 1
fi

# ── [1/4] ลบ manifest ที่เก่ากว่า retention ──────────────────────
echo "[1/4] Pruning old tags (retention=${RETENTION_TAGS})..."

CATALOG=$(curl -sf -u "${REGISTRY_USER}:${REGISTRY_PASS}" "${REGISTRY_URL}/v2/_catalog" 2>/dev/null | \
    sed 's/[][]//g' | tr -d '"' | tr ',' '\n' | sed 's/^ *//')

PRUNED=0
for REPO in $CATALOG; do
    [ -z "$REPO" ] && continue

    # ดึง tags และนับ
    TAGS=$(curl -sf -u "${REGISTRY_USER}:${REGISTRY_PASS}" \
        "${REGISTRY_URL}/v2/${REPO}/tags/list" 2>/dev/null | \
        sed 's/.*"tags":\[//' | sed 's/\].*//' | tr ',' '\n' | \
        tr -d '"' | sed 's/^ *//' | grep -v '^$')

    TAG_COUNT=$(echo "$TAGS" | wc -l)
    TAG_COUNT=$(echo "$TAG_COUNT" | tr -d ' ')

    if [ "$TAG_COUNT" -le "$RETENTION_TAGS" ]; then
        echo "  ${REPO}: ${TAG_COUNT} tags (within retention) — skip"
        continue
    fi

    # ลบ tags ที่เกิน retention (เก็บ RETENTION_TAGS แรก)
    DELETE_COUNT=0
    for TAG in $TAGS; do
        DELETE_COUNT=$((DELETE_COUNT + 1))
        if [ "$DELETE_COUNT" -le "$RETENTION_TAGS" ]; then
            continue
        fi

        echo "  Deleting ${REPO}:${TAG}..."
        DIGEST=$(curl -sf -u "${REGISTRY_USER}:${REGISTRY_PASS}" \
            -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
            -o /dev/null -w "%{header_json}" \
            "${REGISTRY_URL}/v2/${REPO}/manifests/${TAG}" 2>/dev/null | \
            grep -o 'docker-content-digest":"[^"]*' | cut -d'"' -f3)

        if [ -n "$DIGEST" ]; then
            curl -sf -u "${REGISTRY_USER}:${REGISTRY_PASS}" -X DELETE \
                "${REGISTRY_URL}/v2/${REPO}/manifests/${DIGEST}" 2>/dev/null && \
                PRUNED=$((PRUNED + 1)) || true
        fi
    done
done

echo "✓ Pruned ${PRUNED} tag(s)"

# ── [2/4] หยุด registry (read-only mode) ──────────────────────
echo "[2/4] Stopping registry for garbage collection..."
docker stop "$REGISTRY_CONTAINER" > /dev/null
echo "✓ Registry stopped"

# ── [3/4] รัน garbage collection ──────────────────────
echo "[3/4] Running garbage collection..."
docker run --rm \
    -v "${REGISTRY_DATA_DIR}:/var/lib/registry" \
    registry:2 garbage-collect \
    /etc/docker/registry/config.yml 2>&1 || echo "⚠️  GC failed — restarting registry anyway"

echo "✓ Garbage collection complete"

# ── [4/4] รัน registry ใหม่ ──────────────────────
echo "[4/4] Restarting registry..."
docker start "$REGISTRY_CONTAINER" > /dev/null
sleep 3

# ตรวจสอบว่า registry กลับมาใช้งานได้
if curl -sf -u "${REGISTRY_USER}:${REGISTRY_PASS}" -o /dev/null \
    "${REGISTRY_URL}/v2/" 2>/dev/null; then
    echo "✓ Registry is healthy"
else
    echo "✗ Registry health check failed — check logs: docker logs ${REGISTRY_CONTAINER}"
    exit 1
fi

echo "========================================="
echo "✓ Registry GC completed"
echo "  Pruned: ${PRUNED} tag(s)"
echo "  $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================="
