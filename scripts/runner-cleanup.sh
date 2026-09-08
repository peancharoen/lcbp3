#!/bin/sh

# File: scripts/runner-cleanup.sh
# Gitea Runner Cleanup — ASUSTOR (192.168.10.9)
# ADR-041: artifact separation — runner cache/container cleanup policy
#
# หลักการ:
#   - act_runner สร้าง Docker containers/images ทุกครั้งที่รัน job
#   - ถ้าไม่ cleanup ดิสก์บน ASUSTOR จะเต็ม
#   - Script นี้รันบน ASUSTOR (เจ้าของ runner)
#
# Usage:
#   ssh asustor
#   /opt/np-dms-lcbp3/scripts/runner-cleanup.sh
#
# Schedule (cron — ทุกวัน 03:00):
#   0 3 * * * /opt/np-dms-lcbp3/scripts/runner-cleanup.sh >> /volume1/np-dms/gitea-runner/cleanup.log 2>&1

set -e

echo "========================================="
echo "Gitea Runner Cleanup"
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================="

# ── [1/4] ลบ stopped containers จาก act_runner ──────────────────────
echo "[1/4] Pruning stopped runner containers..."
STOPPED=$(docker ps -a --filter "name=act-" --format '{{.ID}}' | wc -l)
if [ "$STOPPED" -gt 0 ]; then
    docker container prune -f --filter "name=act-" > /dev/null 2>&1 || true
    echo "✓ Removed ${STOPPED} stopped runner container(s)"
else
    echo "✓ No stopped runner containers"
fi

# ── [2/4] ลบ dangling images ──────────────────────
echo "[2/4] Pruning dangling images..."
DANGLING=$(docker images -f "dangling=true" -q | wc -l)
if [ "$DANGLING" -gt 0 ]; then
    docker image prune -f > /dev/null 2>&1 || true
    echo "✓ Removed ${DANGLING} dangling image(s)"
else
    echo "✓ No dangling images"
fi

# ── [3/4] ลบ unused builder cache ──────────────────────
echo "[3/4] Pruning build cache..."
docker builder prune -f > /dev/null 2>&1 || true
echo "✓ Build cache pruned"

# ── [4/4] ตรวจสอบ disk usage ──────────────────────
echo "[4/4] Disk usage check..."
DISK_USAGE=$(df -h /volume1 | awk 'NR==2 {print $5}' | tr -d '%')
echo "  /volume1 usage: ${DISK_USAGE}%"
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "  ⚠️  Disk usage above 85% — consider aggressive cleanup"
    echo "  Run: docker system prune -a --volumes (caution: removes all unused)"
fi

echo "========================================="
echo "✓ Runner cleanup completed"
echo "  $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================="
