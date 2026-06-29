// File: specs/100-Infrastructures/141-server-consolidation/quickstart.md
// Change Log:
// - 2026-06-20: Initial quickstart guide for Single-Host Server Consolidation

# Quickstart: Single-Host Server Consolidation

**Branch**: `141-server-consolidation` | **Date**: 2026-06-20

## Prerequisites

- New host with Ubuntu 22.04 LTS or Debian 12 installed
- Ryzen 5 5600 / 32GB RAM / RTX 5060 Ti 16GB
- Network access to VLAN 10 (192.168.10.x)
- ASUSTOR NAS accessible at 192.168.10.9 with CIFS share `np-dms-as`
- SSH access to QNAP (192.168.10.8) for data migration
- Gitea CI/CD access for deploy target update

## Step 1: Provision Host

```bash
# Run on new host (as root or sudo user)
cd /opt/lcbp3
bash specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/scripts/provision-host.sh
```

This script:
1. Installs Docker Engine + Docker Compose v2
2. Installs NVIDIA drivers + nvidia-container-toolkit
3. Creates CIFS mount for ASUSTOR at `/mnt/uploads`
4. Creates Docker volume directories
5. Verifies GPU access with `nvidia-smi`

## Step 2: Prepare .env

```bash
cd /opt/lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host
cp .env.template .env
# Edit .env with real values:
# - ASUSTOR_USER, ASUSTOR_PASS (CIFS credentials)
# - DB_PASSWORD, DB_ROOT_PASSWORD (from QNAP .env)
# - REDIS_PASSWORD (from QNAP .env)
# - JWT_SECRET, JWT_REFRESH_SECRET (from QNAP .env)
# - AUTH_SECRET (from QNAP .env)
# - ELASTICSEARCH_PASSWORD (from QNAP .env)
```

## Step 3: Migrate Data

```bash
# Migrate MariaDB (from QNAP to new host)
bash scripts/migrate-mariadb.sh

# Migrate Elasticsearch (from QNAP to new host)
bash scripts/migrate-elasticsearch.sh

# Verify parity
bash scripts/verify-data-parity.sh
```

## Step 4: Deploy Services

```bash
# Pull latest images from Gitea registry
docker compose --env-file .env -f docker-compose.new-host.yml pull

# Start all services
docker compose --env-file .env -f docker-compose.new-host.yml up -d

# Check health
docker compose -f docker-compose.new-host.yml ps
docker compose -f docker-compose.new-host.yml logs --tail=50
```

## Step 5: Smoke Test

```bash
# Run smoke tests
bash scripts/smoke-test.sh
```

Smoke tests verify:
- Backend health check (`GET http://localhost:3001/health`)
- Frontend accessible (`GET http://localhost:3000/`)
- Login flow (POST /api/auth/login)
- Document list (GET /api/correspondences)
- OCR endpoint (POST /api/ai/sandbox/ocr)
- AI inference (POST /api/ai/sandbox/extract)
- Full-text search (GET /api/search)

## Step 6: Update CI/CD

Update Gitea secrets:
- `HOST` → new host IP (e.g., `192.168.10.50`)
- `COMPOSE_FILE` → `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/docker-compose.new-host.yml`

## Step 7: Cutover DNS

Update NPM (Nginx Proxy Manager) on QNAP:
- `lcbp3.np-dms.work` → new host IP
- `backend.np-dms.work` → new host IP

## Step 8: Remove X-API-Key (ADR-040 D5)

After verifying Docker-internal network isolation:
1. Remove `OCR_SIDECAR_API_KEY` from sidecar environment
2. Remove API key validation from `app.py`
3. Remove `X-API-Key` header from backend `ocr.service.ts`
4. Rebuild and redeploy sidecar + backend

## Step 9: Monitor (24-48 hours)

```bash
# Monitor RAM usage
docker stats --no-stream

# Monitor VRAM usage
nvidia-smi --query-gpu=memory.used,memory.total --format=csv -l 60

# Monitor container health
watch -n 30 'docker compose -f docker-compose.new-host.yml ps'
```

## Step 10: Decommission Old Hosts

After 24-48 hours of stable operation:

```bash
# Stop QNAP services (retain data for backup)
ssh admin@192.168.10.8 'cd /share/np-dms/app && docker compose down'
ssh admin@192.168.10.8 'cd /share/np-dms/services && docker compose down'

# Power off Desk-5439
ssh user@192.168.10.100 'sudo shutdown -h now'
```

## Rollback (Emergency)

```bash
# Stop new host services
docker compose -f docker-compose.new-host.yml down

# Restore QNAP services
ssh admin@192.168.10.8 'cd /share/np-dms/app && docker compose up -d'
ssh admin@192.168.10.8 'cd /share/np-dms/services && docker compose up -d'

# Restore Desk-5439 services
ssh user@192.168.10.100 'cd /opt/ocr-sidecar && docker compose up -d'

# Revert DNS
# Update NPM to point back to QNAP (192.168.10.8)

# Revert CI/CD
# Update Gitea secrets HOST back to 192.168.10.8
```
