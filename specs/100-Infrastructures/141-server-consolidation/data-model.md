// File: specs/100-Infrastructures/141-server-consolidation/data-model.md
// Change Log:
// - 2026-06-20: Initial data model for Single-Host Server Consolidation

# Data Model: Single-Host Server Consolidation

**Branch**: `141-server-consolidation` | **Date**: 2026-06-20

## Infrastructure Entities

### 1. Docker Network: dms-internal

| Attribute | Type | Description |
|-----------|------|-------------|
| name | string | `dms-internal` |
| driver | string | `bridge` |
| scope | string | local (single host) |
| published_ports | none | No ports published to LAN |

**Members**: ollama, ocr-sidecar, backend, redis, mariadb, elasticsearch, qdrant, clamav, ollama-metrics

### 2. Docker Network: dms-frontend

| Attribute | Type | Description |
|-----------|------|-------------|
| name | string | `dms-frontend` |
| driver | string | `bridge` |
| scope | string | local (single host) |
| published_ports | 3000 (frontend), 3001→3000 (backend), 9924 (ollama-metrics) | Only ports published to LAN |

**Members**: frontend, backend

### 3. Docker Volume: asustor_uploads

| Attribute | Type | Description |
|-----------|------|-------------|
| driver | string | `local` |
| type | string | `cifs` |
| device | string | `//192.168.10.9/np-dms-as/data/uploads` |
| mount_options | string | `username=${ASUSTOR_USER},password=${ASUSTOR_PASS},vers=3.0,uid=0,gid=0` |
| mount_point (sidecar) | string | `/mnt/uploads` (read-only) |
| mount_point (backend) | string | `/app/uploads` (read-write) |

### 4. Docker Volume: ollama_models

| Attribute | Type | Description |
|-----------|------|-------------|
| driver | string | `local` (named volume) |
| mount_point | string | `/root/.ollama` |
| content | string | Ollama model files (np-dms-ai, np-dms-ocr, nomic-embed-text) |

### 5. Docker Volume: mariadb_data

| Attribute | Type | Description |
|-----------|------|-------------|
| driver | string | `local` (named volume) |
| mount_point | string | `/var/lib/mysql` |
| content | string | MariaDB data files (migrated from QNAP) |

### 6. Docker Volume: es_data

| Attribute | Type | Description |
|-----------|------|-------------|
| driver | string | `local` (named volume) |
| mount_point | string | `/usr/share/elasticsearch/data` |
| content | string | Elasticsearch indices (migrated from QNAP) |

### 7. Docker Volume: redis_data

| Attribute | Type | Description |
|-----------|------|-------------|
| driver | string | `local` (named volume) |
| mount_point | string | `/data` |
| content | string | Redis AOF persistence + BullMQ queue data |

### 8. Docker Volume: qdrant_data

| Attribute | Type | Description |
|-----------|------|-------------|
| driver | string | `local` (named volume) |
| mount_point | string | `/qdrant/storage` |
| content | string | Qdrant vector collections |

## Service Definitions

### ollama

| Attribute | Value |
|-----------|-------|
| image | `ollama/ollama:latest` |
| GPU | NVIDIA RTX 5060 Ti 16GB (passthrough) |
| network | dms-internal only |
| ports | none (expose 11434 internal only) |
| volumes | ollama_models → /root/.ollama |
| depends_on | none |
| healthcheck | `ollama list` (verify API responsive) |

### ocr-sidecar

| Attribute | Value |
|-----------|-------|
| build | `./specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/ocr-sidecar` |
| network | dms-internal only |
| ports | none (expose 8765 internal only) |
| volumes | asustor_uploads → /mnt/uploads (read-only) |
| depends_on | ollama |
| env | OLLAMA_API_URL=http://ollama:11434, OCR_SIDECAR_UPLOAD_BASE=/mnt/uploads |
| healthcheck | `curl -f http://localhost:8765/health` |

### backend

| Attribute | Value |
|-----------|-------|
| image | `lcbp3-backend:${BACKEND_IMAGE_TAG:-latest}` |
| networks | dms-internal + dms-frontend |
| ports | 3001:3000 (published to LAN — NPM routes `backend.np-dms.work` → :3001) |
| volumes | asustor_uploads → /app/uploads (read-write) |
| depends_on | ollama, ocr-sidecar, redis, mariadb, elasticsearch, qdrant, clamav |
| env | OCR_API_URL=http://ocr-sidecar:8765, OLLAMA_API_URL=http://ollama:11434, DB_HOST=mariadb, REDIS_HOST=redis, ELASTICSEARCH_HOST=elasticsearch, QDRANT_HOST=qdrant |
| healthcheck | `curl -f http://localhost:3000/health` |
| memory_limit | 2G |

### frontend

| Attribute | Value |
|-----------|-------|
| image | `lcbp3-frontend:${FRONTEND_IMAGE_TAG:-latest}` |
| networks | dms-frontend only |
| ports | 3000:3000 (published to LAN) |
| depends_on | backend |
| env | INTERNAL_API_URL=http://backend:3000/api |
| healthcheck | `curl -f http://localhost:3000/` |
| memory_limit | 1G |

### redis

| Attribute | Value |
|-----------|-------|
| image | `redis:7-alpine` |
| network | dms-internal only |
| ports | none (expose 6379 internal only) |
| volumes | redis_data → /data |
| command | `redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes --maxmemory-policy noeviction` |
| healthcheck | `redis-cli -a ${REDIS_PASSWORD} --no-auth-warning ping` |
| memory_limit | 1G |

### mariadb

| Attribute | Value |
|-----------|-------|
| image | `mariadb:11.8` |
| network | dms-internal only |
| ports | none (expose 3306 internal only) |
| volumes | mariadb_data → /var/lib/mysql |
| env | MARIADB_ROOT_PASSWORD, MARIADB_DATABASE=lcbp3, MARIADB_USER=center |
| command | `--character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci` |
| healthcheck | `healthcheck.sh --connect --innodb_initialized` |
| memory_limit | 8G |

### elasticsearch

| Attribute | Value |
|-----------|-------|
| image | `elasticsearch:8.11.1` |
| network | dms-internal only |
| ports | none (expose 9200 internal only) |
| volumes | es_data → /usr/share/elasticsearch/data |
| env | discovery.type=single-node, xpack.security.enabled=false, ES_JAVA_OPTS=-Xms2g -Xmx2g |
| healthcheck | `curl -s http://localhost:9200/_cluster/health` |
| memory_limit | 4G |

### qdrant

| Attribute | Value |
|-----------|-------|
| image | `qdrant/qdrant:v1.16.1` |
| network | dms-internal only |
| ports | none (expose 6333 internal only) |
| volumes | qdrant_data → /qdrant/storage |
| healthcheck | TCP check on port 6333 |
| memory_limit | 1G |

### clamav

| Attribute | Value |
|-----------|-------|
| image | `clamav/clamav:1.4.4` |
| network | dms-internal only |
| ports | none (expose 3310 internal only) |
| healthcheck | `clamdcheck.sh` |
| memory_limit | 2G |

### ollama-metrics

| Attribute | Value |
|-----------|-------|
| image | `ghcr.io/norskhelsenett/ollama-metrics:latest` |
| network | dms-internal only |
| ports | 9924:9924 (published to LAN — Prometheus on ASUSTOR scrapes `http://<new-host-ip>:9924/metrics`) |
| env | OLLAMA_HOST=http://ollama:11434 |
| memory_limit | 256M |

## Service Communication Map

```
LAN (VLAN 10)
  │
  ├── :3000 (Frontend)     ──→ http://backend:3000/api (dms-frontend)
  ├── :3001 (Backend)       ──→ http://backend:3000/api (dms-frontend)
  └── :9924 (ollama-metrics) ──→ Prometheus scrape target
                           │
                           ├──→ mariadb:3306        (dms-internal)
                           ├──→ redis:6379          (dms-internal)
                           ├──→ elasticsearch:9200  (dms-internal)
                           ├──→ qdrant:6333         (dms-internal)
                           ├──→ clamav:3310         (dms-internal)
                           ├──→ ocr-sidecar:8765    (dms-internal)
                           └──→ ollama:11434        (dms-internal)
```

## Path Mapping

| Service | Container Path | Source |
|---------|---------------|--------|
| Backend | `/app/uploads/temp` | ASUSTOR CIFS `/data/uploads/temp` |
| Backend | `/app/uploads/permanent` | ASUSTOR CIFS `/data/uploads/permanent` |
| Sidecar | `/mnt/uploads/temp` (read-only) | ASUSTOR CIFS `/data/uploads/temp` |
| Sidecar | `/mnt/uploads/permanent` (read-only) | ASUSTOR CIFS `/data/uploads/permanent` |

**Note**: Backend uses `/app/uploads` (read-write), Sidecar uses `/mnt/uploads` (read-only). Both map to the same ASUSTOR CIFS share. Path remapping in `ocr.service.ts` (`remapPath()`) continues to work — strip `/app/uploads` and replace with `/mnt/uploads`.
