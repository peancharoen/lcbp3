#!/bin/bash

# File: scripts/rollback.sh
# LCBP3-DMS Rollback Script
# v1.8.1

set -e

LCBP3_DIR="/volume1/lcbp3"
CURRENT_FILE="$LCBP3_DIR/current"
CURRENT=$(cat "$CURRENT_FILE")
PREVIOUS=$([[ "$CURRENT" == "blue" ]] && echo "green" || echo "blue")

echo "========================================="
echo "LCBP3-DMS Rollback (v1.8.1)"
echo "========================================="
echo "Current: $CURRENT"
echo "Rolling back to: $PREVIOUS"
echo "========================================="

# Switch NGINX back
echo "[1/3] Switching NGINX to $PREVIOUS..."
NGINX_CONF="$LCBP3_DIR/nginx-proxy/nginx.conf"
if [ -f "$NGINX_CONF" ]; then
    sed -i "s/lcbp3-${CURRENT}-backend/lcbp3-${PREVIOUS}-backend/g" "$NGINX_CONF"
    sed -i "s/lcbp3-${CURRENT}-frontend/lcbp3-${PREVIOUS}-frontend/g" "$NGINX_CONF"
    docker exec lcbp3-nginx nginx -s reload
    echo "✓ NGINX switched back to $PREVIOUS"
fi

# Start previous environment if stopped
echo "[2/3] Ensuring $PREVIOUS environment is running..."
cd "$LCBP3_DIR/$PREVIOUS"
docker-compose up -d
sleep 15
echo "✓ $PREVIOUS environment is running"

# Verify
echo "[3/3] Verifying rollback..."
if docker exec lcbp3-nginx curl -f -k http://lcbp3-${PREVIOUS}-backend:3000/health > /dev/null 2>&1; then
    echo "✓ Rollback successful"
    echo "$PREVIOUS" > "$CURRENT_FILE"
else
    echo "✗ Rollback verification failed!"
    exit 1
fi

echo "========================================="
echo "✓ Rollback completed"
echo "Active environment: $PREVIOUS"
echo "========================================="
