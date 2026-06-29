// File: specs/100-Infrastructures/141-server-consolidation/research.md
// Change Log:
// - 2026-06-20: Initial research for Single-Host Server Consolidation

# Research: Single-Host Server Consolidation

**Branch**: `141-server-consolidation` | **Date**: 2026-06-20

## R1: Docker Network Isolation Strategy

**Decision**: Use two Docker bridge networks — `dms-internal` (all services) and `dms-frontend` (Frontend + Backend only, for LAN publish).

**Rationale**: Docker bridge networks provide L2 isolation. Services on `dms-internal` without `ports` mapping are unreachable from LAN. Only Frontend (3000) and Backend (3000) need LAN access. This replaces VLAN/firewall ACL reliance with Docker-native isolation.

**Alternatives Considered**:
- Single bridge network + iptables rules — more complex, error-prone
- Docker Swarm overlay network — overkill for single host
- Host network mode — no isolation, security risk

## R2: CIFS Mount Strategy for ASUSTOR

**Decision**: Use Docker named volume with CIFS driver to mount ASUSTOR share `//192.168.10.9/np-dms-as/data/uploads` as `asustor_uploads` volume, mounted at `/mnt/uploads` in sidecar and `/app/uploads` in backend.

**Rationale**: Docker CIFS volume driver handles mount lifecycle with container start/stop. Credentials in `.env` (gitignored). Both backend and sidecar see the same files via the same CIFS mount point.

**Alternatives Considered**:
- Host-level `mount -t cifs` then bind mount — requires host OS config, not portable
- SSHFS — slower than CIFS for file operations
- Sync files to local SSD — adds complexity, storage duplication

**Key Consideration**: Previous Desk-5439 setup had issues with Docker Desktop WSL2 + CIFS (see memory). On Linux host, CIFS volume driver works natively without WSL2 layer.

## R3: MariaDB Migration Strategy

**Decision**: Use `mariadb-dump` (logical dump) from QNAP MariaDB 11.8, pipe directly to new host MariaDB 11.8 container.

**Rationale**: Same MariaDB version (11.8) on both hosts → logical dump is safest. Database is small enough (<10GB estimated) that dump/restore completes within maintenance window.

**Alternatives Considered**:
- `mariabackup` (physical backup) — faster but requires same filesystem layout
- Replication (binlog) — overkill for one-time migration
- Copy raw data files — risky, requires same version + config

**Migration Command**:
```bash
# From QNAP (source) — dump all databases
mariadb-dump --single-transaction --routines --triggers \
  -h 127.0.0.1 -u root -p"$DB_ROOT_PASSWORD" \
  --all-databases > qnap-full-dump.sql

# On new host — restore
docker exec -i lcbp3-mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" < qnap-full-dump.sql
```

## R4: Elasticsearch Migration Strategy

**Decision**: Use ES snapshot/restore API — create snapshot on QNAP ES, transfer to new host, restore.

**Rationale**: ES snapshot API is the official migration path. Handles index mappings, settings, and data. Works across same ES version (8.11.x).

**Alternatives Considered**:
- Copy raw data directory — risky, requires identical ES config
- Re-index from MariaDB — slow, loses search index tuning
- Logstash pipeline — overkill for one-time migration

**Migration Steps**:
1. Register shared filesystem repo on QNAP ES
2. Create snapshot of all indices
3. Copy snapshot files to new host ES data volume
4. Register repo on new host ES
5. Restore snapshot

## R5: GPU VRAM Management on Single Host

**Decision**: Rely on ADR-040 D3 (Adaptive OCR Residency via `calculate_ocr_residency()`) and ADR-040 D4 (CPU Fallback Retrieval). LLM-First GPU Ownership from CONTEXT.md.

**Rationale**: RTX 5060 Ti 16GB must serve:
- np-dms-ai (Typhoon-2.5 ~7-8B): ~6-8GB VRAM
- np-dms-ocr (Typhoon OCR): ~5GB VRAM
- nomic-embed-text: ~0.5GB VRAM
- CUDA overhead: ~1.5GB
- Total: ~13-15GB → tight but feasible with adaptive residency

**Key Policy**: When LLM (np-dms-ai) needs to load, OCR model is unloaded first (`keep_alive=0` for OCR). BGE-M3 + Reranker use CPU fallback when GPU is occupied.

**Alternatives Considered**:
- Force GPU-resident for all models — OOM risk (15.5GB > 16GB with overhead)
- CPU-only for all AI — too slow for production
- Second GPU — not available on new host

## R6: RAM Budget Allocation

**Decision**: Per-container memory limits in Docker Compose:

| Service | Memory Limit | Notes |
|---------|-------------|-------|
| MariaDB | 8G | Largest consumer, tune innodb_buffer_pool |
| Elasticsearch | 4G | ES_JAVA_OPTS=-Xms2g -Xmx2g |
| Backend (NestJS) | 2G | Node.js + BullMQ workers |
| Frontend (Next.js) | 1G | Standalone mode |
| Redis | 1G | In-memory + AOF |
| Qdrant | 1G | Vector DB |
| OCR Sidecar | 1G | Python + PyMuPDF |
| Ollama | 2G | Model loading + inference |
| ClamAV | 2G | Virus definitions |
| ollama-metrics | 256M | Lightweight proxy |
| **Total** | **~22.3G** | Leaves ~9.7G for OS + swap |

**Rationale**: 32GB total - 22.3GB containers = ~9.7GB for OS kernel + page cache + swap. Comfortable margin.

**Alternatives Considered**:
- No limits — risk of OOM killer affecting critical services
- Tighter limits — may cause ES/MariaDB instability

## R7: CI/CD Pipeline Update

**Decision**: Update Gitea Actions `ci-deploy.yml` to SSH-deploy to new host IP instead of QNAP IP. ASUSTOR Gitea runner stays unchanged.

**Rationale**: Gitea runner on ASUSTOR (192.168.10.9) can reach new host via VLAN 10. Only the deploy target IP changes. `deploy.sh` path to compose file updates to `New-Host/docker-compose.new-host.yml`.

**Alternatives Considered**:
- Move Gitea runner to new host — unnecessary, runner works remotely
- Manual deployment — not sustainable for ongoing releases

## R8: Rollback Strategy

**Decision**: Multi-step rollback plan documented in `rollback.sh`:
1. Stop services on new host (`docker compose down`)
2. Restore services on QNAP (start existing containers with old data)
3. Restore services on Desk-5439 (start Ollama + sidecar)
4. Revert DNS/NPM to point to QNAP
5. Revert Gitea CI/CD deploy target to QNAP
6. Re-enable X-API-Key in sidecar + backend

**Rationale**: QNAP retains all data (MariaDB, ES, Redis, files) until verified stable. Rollback is fast (<2 hours) because old infrastructure is intact.

**Alternatives Considered**:
- No rollback (accept SPOF) — too risky for production DMS
- Hot failover with replication — overkill for current scale
