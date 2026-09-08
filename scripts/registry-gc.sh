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
#   - ใช้ sudo สำหรับ docker commands (ASUSTOR user ไม่มีสิทธิ์ Docker socket)
#
# Usage:
#   ssh asustor
#   source /volume1/np-dms/registry/.env
#   sudo /volume1/np-dms/scripts/registry-gc.sh
#
# Schedule (ADM Task Scheduler — ทุกวันอาทิตย์ 04:00):
#   sudo /volume1/np-dms/scripts/registry-gc.sh

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
if ! sudo docker ps --format '{{.Names}}' | grep -q "^${REGISTRY_CONTAINER}$"; then
    echo "ERROR: Registry container '${REGISTRY_CONTAINER}' not found"
    exit 1
fi

if [ -z "$REGISTRY_PASS" ]; then
    echo "ERROR: REGISTRY_ADMIN_PASSWORD not set"
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

    TAGS=$(curl -sf -u "${REGISTRY_USER}:${REGISTRY_PASS}" \
        "${REGISTRY_URL}/v2/${REPO}/tags/list" 2>/dev/null | \
        sed 's/.*"tags":\[//' | sed 's/\].*//' | tr ',' '\n' | \
        tr -d '"' | sed 's/^ *//' | grep -v '^$')

    TAG_COUNT=$(echo "$TAGS" | wc -l)
    TAG_COUNT=$(echo "$TAG_COUNT" | tr -d ' ')

    if [ "$TAG_COUNT" -le "$RETENTION_TAGS" ]; then
        echo "  ${REPO}: ${TAG_COUNT} tags (within retention) - skip"
        continue
    fi

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

echo "  Pruned ${PRUNED} tag(s)"

# ── [2/4] หยุด registry ──────────────────────
echo "[2/4] Stopping registry for garbage collection..."
sudo docker stop "$REGISTRY_CONTAINER" > /dev/null
echo "  Registry stopped"

# ── [3/4] รัน garbage collection ──────────────────────
echo "[3/4] Running garbage collection..."
sudo docker run --rm \
    -v "${REGISTRY_DATA_DIR}:/var/lib/registry" \
    registry:2 garbage-collect \
    /etc/docker/registry/config.yml 2>&1 || echo "  WARNING: GC failed - restarting registry anyway"

echo "  Garbage collection complete"

# ── [4/4] รัน registry ใหม่ ──────────────────────
echo "[4/4] Restarting registry..."
sudo docker start "$REGISTRY_CONTAINER" > /dev/null
sleep 3

if curl -sf -u "${REGISTRY_USER}:${REGISTRY_PASS}" -o /dev/null \
    "${REGISTRY_URL}/v2/" 2>/dev/null; then
    echo "  Registry is healthy"
else
    echo "  ERROR: Registry health check failed"
    echo "  Check: sudo docker logs ${REGISTRY_CONTAINER}"
    exit 1
fi

echo "========================================="
echo "Registry GC completed"
echo "  Pruned: ${PRUNED} tag(s)"
echo "  $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================="
