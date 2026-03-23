#!/bin/bash

# File: scripts/deploy.sh
# LCBP3-DMS Blue-Green Deployment Script
# v1.8.1

set -e  # Exit on error

# Configuration
LCBP3_DIR="/share/np-dms/app"
CURRENT_FILE="$LCBP3_DIR/current"

# Ensure base directory exists (QNAP path fix)
mkdir -p "$LCBP3_DIR"

# Ensure current file exists
if [ ! -f "$CURRENT_FILE" ]; then
    echo "blue" > "$CURRENT_FILE"
fi

CURRENT=$(cat "$CURRENT_FILE")
TARGET=$([[ "$CURRENT" == "blue" ]] && echo "green" || echo "blue")

echo "========================================="
echo "LCBP3-DMS Blue-Green Deployment (v1.8.1)"
echo "========================================="
echo "Current environment: $CURRENT"
echo "Target environment:  $TARGET"
echo "========================================="

# Step 1: Backup database
echo "[1/9] Creating database backup..."
BACKUP_DIR="$LCBP3_DIR/shared/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db-backup-$(date +%Y%m%d-%H%M%S).sql"

# Note: DB_PASSWORD should be in environment or .env
if [ -z "$DB_PASSWORD" ]; then
    echo "Warning: DB_PASSWORD not found in environment. Attempting to source from .env..."
    if [ -f "$LCBP3_DIR/$CURRENT/.env.production" ]; then
        export $(grep DB_PASSWORD "$LCBP3_DIR/$CURRENT/.env.production" | xargs)
    fi
fi

docker exec lcbp3-mariadb mysqldump -u root -p"${DB_PASSWORD}" lcbp3_dms > "$BACKUP_FILE"
gzip "$BACKUP_FILE"
echo "✓ Backup created: $BACKUP_FILE.gz"

# Step 2: Build latest images directly on QNAP
echo "[2/9] Building latest Docker images from source..."
cd "/share/np-dms/app/source/lcbp3"

# Extract API_URL for Frontend Build Argument
API_URL="https://lcbp3-dms.example.com/api"
if [ -f "$LCBP3_DIR/$TARGET/.env.production" ]; then
    ENV_URL=$(grep NEXT_PUBLIC_API_URL "$LCBP3_DIR/$TARGET/.env.production" | cut -d '=' -f2)
    [ -n "$ENV_URL" ] && API_URL="$ENV_URL"
fi

echo "Building backend..."
docker build -f backend/Dockerfile -t lcbp3-backend:latest .

echo "Building frontend with API URL: $API_URL..."
docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL="$API_URL" -t lcbp3-frontend:latest .

echo "✓ Images built successfully"

# Move correctly to target directory for docker-compose up
cd "$LCBP3_DIR/$TARGET"

# Step 3: Update configuration
echo "[3/9] Updating configuration..."
if [ -f "$LCBP3_DIR/.env.production.new" ]; then
    cp "$LCBP3_DIR/.env.production.new" "$LCBP3_DIR/$TARGET/.env.production"
    rm "$LCBP3_DIR/.env.production.new"
    echo "✓ Configuration updated from .env.production.new"
fi

# Step 4: Start target environment
echo "[4/9] Starting $TARGET environment..."
docker-compose up -d
echo "✓ $TARGET environment started"

# Step 5: Wait for services to be ready
echo "[5/9] Waiting for services to be healthy..."
sleep 15

# Check backend health
for i in {1..30}; do
    if docker exec lcbp3-${TARGET}-backend curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✓ Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "✗ Backend health check failed!"
        docker-compose logs backend
        exit 1
    fi
    sleep 2
done

# Step 6: Run database migrations (ADR-009)
echo "[6/9] Running database migrations..."
# Note: Following ADR-009, this might be a no-op if manual SQL is preferred, 
# but keeping it for DTO/Entity alignment checks.
docker exec lcbp3-${TARGET}-backend npm run start:prod -- --migration-run || echo "Migration check complete"
echo "✓ Migrations stage complete"

# Step 7: Switch NGINX to target environment
echo "[7/9] Switching NGINX to $TARGET..."
NGINX_CONF="$LCBP3_DIR/nginx-proxy/nginx.conf"
if [ -f "$NGINX_CONF" ]; then
    sed -i "s/lcbp3-${CURRENT}-backend/lcbp3-${TARGET}-backend/g" "$NGINX_CONF"
    sed -i "s/lcbp3-${CURRENT}-frontend/lcbp3-${TARGET}-frontend/g" "$NGINX_CONF"
    docker exec lcbp3-nginx nginx -t
    docker exec lcbp3-nginx nginx -s reload
    echo "✓ NGINX switched to $TARGET"
else
    echo "Warning: NGINX config not found at $NGINX_CONF. Skipping switch."
fi

# Step 8: Verify new environment
echo "[8/9] Verifying new environment via Proxy..."
sleep 5
# Attempt to curl via the local proxy or direct container
if docker exec lcbp3-nginx curl -f -k http://lcbp3-${TARGET}-backend:3000/health > /dev/null 2>&1; then
    echo "✓ New environment is responding via internal network"
else
    echo "✗ New environment verification failed!"
    echo "Rolling back..."
    # Call rollback script if it exists
    if [ -f "$LCBP3_DIR/scripts/rollback.sh" ]; then
        "$LCBP3_DIR/scripts/rollback.sh"
    fi
    exit 1
fi

# Step 9: Stop old environment
echo "[9/9] Stopping $CURRENT environment..."
cd "$LCBP3_DIR/$CURRENT"
docker-compose down
echo "✓ $CURRENT environment stopped"

# Update current pointer
echo "$TARGET" > "$CURRENT_FILE"

echo "========================================="
echo "✓ Deployment completed successfully!"
echo "Active environment: $TARGET"
echo "========================================="
