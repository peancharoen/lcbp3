#!/bin/bash

# File: scripts/deploy.sh
# LCBP3-DMS Deployment Script v2.0
# Simple direct deploy: build images → restart stack via docker compose

set -e

SOURCE_DIR="/share/np-dms/app/source/lcbp3"
COMPOSE_FILE="$SOURCE_DIR/specs/04-Infrastructure-OPS/04-00-docker-compose/docker-compose-app.yml"
ENV_FILE="/share/np-dms/app/.env"

API_URL="https://backend.np-dms.work/api"
AUTH_URL="https://lcbp3.np-dms.work"

echo "========================================="
echo "LCBP3-DMS Deployment v2.0"
echo "========================================="

# Read overrides from .env if present
if [ -f "$ENV_FILE" ]; then
    ENV_URL=$(grep NEXT_PUBLIC_API_URL "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    [ -n "$ENV_URL" ] && API_URL="$ENV_URL"
    ENV_AUTH=$(grep AUTH_URL "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    [ -n "$ENV_AUTH" ] && AUTH_URL="$ENV_AUTH"
fi

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "✗ Compose file not found: $COMPOSE_FILE"
    exit 1
fi

cd "$SOURCE_DIR"

# [1/3] Build images
echo "[1/3] Building Docker images..."
echo "  Building backend..."
docker build -f backend/Dockerfile -t lcbp3-backend:latest . || {
    echo "✗ Backend build failed!"
    exit 1
}

echo "  Building frontend (API: $API_URL)..."
docker build -f frontend/Dockerfile \
    --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
    --build-arg AUTH_URL="$AUTH_URL" \
    -t lcbp3-frontend:latest . || {
    echo "✗ Frontend build failed!"
    exit 1
}
echo "✓ Images built"

# [2/3] Start / restart stack with new images
echo "[2/3] Starting application stack..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate
echo "✓ Stack started"

# [3/3] Health check
echo "[3/3] Waiting for backend to be healthy..."
sleep 10
for i in $(seq 1 30); do
    if docker exec backend curl -sf http://localhost:3000/health > /dev/null 2>&1 || \
       docker exec backend curl -sf http://localhost:3000/ping > /dev/null 2>&1; then
        echo "✓ Backend is healthy"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "✗ Backend health check failed after 60s"
        docker compose -f "$COMPOSE_FILE" logs backend --tail=50
        exit 1
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

echo "========================================="
echo "✓ Deployment completed successfully!"
echo "========================================="
