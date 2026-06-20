# Docker Compose Contract: New Host

**Branch**: `141-server-consolidation` | **Date**: 2026-06-20

This contract defines the service topology for the consolidated single-host deployment.
The actual `docker-compose.new-host.yml` will be created at:
`specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/docker-compose.new-host.yml`

## Service Topology

| Service | Image | Networks | LAN Ports | Internal Port | Memory Limit | Depends On |
|---------|-------|----------|-----------|---------------|--------------|------------|
| ollama | ollama/ollama:latest | dms-internal | none | 11434 | 2G (host) | — |
| ocr-sidecar | build (local) | dms-internal | none | 8765 | 1G | ollama |
| backend | lcbp3-backend:latest | dms-internal, dms-frontend | 3001→3000 | 3000 | 2G | ollama, ocr-sidecar, redis, mariadb, elasticsearch, qdrant, clamav |
| frontend | lcbp3-frontend:latest | dms-frontend | 3000 | 3000 | 1G | backend |
| redis | redis:7-alpine | dms-internal | none | 6379 | 1G | — |
| mariadb | mariadb:11.8 | dms-internal | none | 3306 | 8G | — |
| elasticsearch | elasticsearch:8.11.1 | dms-internal | none | 9200 | 4G | — |
| qdrant | qdrant/qdrant:v1.16.1 | dms-internal | none | 6333 | 1G | — |
| clamav | clamav/clamav:1.4.4 | dms-internal | none | 3310 | 2G | — |
| ollama-metrics | ghcr.io/norskhelsenett/ollama-metrics:latest | dms-internal | 9924 | 9924 | 256M | ollama |

## Network Topology

```
dms-internal (bridge, no LAN access)
  ├── ollama:11434
  ├── ocr-sidecar:8765
  ├── backend:3000 (also on dms-frontend)
  ├── redis:6379
  ├── mariadb:3306
  ├── elasticsearch:9200
  ├── qdrant:6333
  ├── clamav:3310
  └── ollama-metrics:9924

dms-frontend (bridge, LAN published)
  ├── frontend:3000 → LAN:3000
  ├── backend:3000 → LAN:3001 (NPM routes backend.np-dms.work → :3001)
  └── ollama-metrics:9924 → LAN:9924 (Prometheus scrape target)
```

## Environment Variables (New)

| Variable | Default | Description |
|----------|---------|-------------|
| ASUSTOR_USER | (required) | CIFS share username |
| ASUSTOR_PASS | (required) | CIFS share password |
| NEW_HOST_IP | (required) | New host LAN IP for CI/CD deploy target |

## Environment Variables (Changed from QNAP)

| Variable | Old Value (QNAP) | New Value (New Host) |
|----------|------------------|---------------------|
| DB_HOST | mariadb | mariadb (unchanged — Docker DNS) |
| REDIS_HOST | cache | redis (service name change) |
| ELASTICSEARCH_HOST | search | elasticsearch (service name change) |
| QDRANT_HOST | qdrant | qdrant (unchanged) |
| OCR_API_URL | http://192.168.10.100:8765 | http://ocr-sidecar:8765 |
| OLLAMA_API_URL | http://192.168.10.100:11434 | http://ollama:11434 |
| CLAMAV_HOST | clamav | clamav (unchanged) |

## Removed Environment Variables

| Variable | Reason |
|----------|--------|
| OCR_SIDECAR_API_KEY | ADR-040 D5 — network-only auth, no API key needed |
| OCR_SIDECAR_UPLOAD_BASE | Still needed but value changes to /mnt/uploads (same) |
