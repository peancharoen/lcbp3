// File: specs/100-Infrastructures/141-server-consolidation/plan.md
// Change Log:
// - 2026-06-20: Initial implementation plan for Single-Host Server Consolidation

# Implementation Plan: Single-Host Server Consolidation

**Branch**: `141-server-consolidation` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/100-Infrastructures/141-server-consolidation/spec.md`
**Related ADRs**: [ADR-041](../../06-Decision-Records/ADR-041-server-consolidation.md), [ADR-040](../../06-Decision-Records/ADR-040-ocr-sidecar-refactor.md)

## Summary

Consolidate all LCBP3-DMS services from a 2-host architecture (QNAP NAS + Desk-5439) onto a single Docker host (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB). ASUSTOR becomes primary NAS for file storage via CIFS. Docker internal bridge network isolates Ollama and OCR Sidecar from LAN, enabling removal of X-API-Key auth (ADR-040 D5). QNAP becomes backup server; Desk-5439 is retired.

## Technical Context

**Language/Version**: Docker Compose v2 (YAML), Bash scripts, PowerShell provisioning
**Primary Dependencies**: Docker Engine 24+, Docker Compose v2, NVIDIA Container Toolkit, CIFS Utils
**Storage**: MariaDB 11.8 (Docker volume), Elasticsearch 8.11 (Docker volume), Redis 7 (Docker volume), Qdrant v1.16 (Docker volume), ASUSTOR CIFS for file uploads
**Testing**: Smoke tests (manual + scripted), health check endpoints, data parity verification scripts
**Target Platform**: Linux (Ubuntu 22.04 LTS or Debian 12) on Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB
**Project Type**: Infrastructure (Docker Compose stack + provisioning scripts)
**Performance Goals**: Backend-to-Ollama latency <50ms (localhost vs ~2ms LAN), all containers healthy within 5 min
**Constraints**: 32GB RAM total (target <28GB usage), 16GB VRAM (target <15GB usage), CIFS mount reliability
**Scale/Scope**: 8 containers (Ollama, OCR Sidecar, Backend, Frontend, Redis, MariaDB, ES, Qdrant) + ClamAV + ollama-metrics

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
|-----------|--------|-------|
| ADR-016 Security | ✅ Pass | Network isolation replaces API key; no ports published for internal services |
| ADR-019 UUID | ✅ Pass | No UUID changes — infrastructure only |
| ADR-009 Schema | ✅ Pass | No schema changes — data migration via dump/restore |
| ADR-023/023A AI Boundary | ✅ Pass | Ollama isolated on Docker internal network; no direct DB/storage access |
| ADR-040 D5 Network Auth | ✅ Pass | Docker bridge isolation enables X-API-Key removal |
| ADR-008 BullMQ | ✅ Pass | Redis co-located on same host; queue behavior unchanged |
| ADR-002 Document Numbering | ✅ Pass | Redis Redlock unchanged; co-located reduces lock latency |
| SPOF Risk | ⚠️ Acknowledged | Single host = SPOF; mitigated by QNAP backup + DR plan |

**Gate Result**: PASS — no violations. SPOF risk is acknowledged in ADR-041 with mitigation plan.

## Project Structure

### Documentation (this feature)

```text
specs/100-Infrastructures/141-server-consolidation/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output — research findings
├── data-model.md        # Phase 1 output — infrastructure data model
├── quickstart.md        # Phase 1 output — deployment guide
├── contracts/           # Phase 1 output — docker-compose contracts
│   └── docker-compose.new-host.yml
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
specs/04-Infrastructure-OPS/04-00-docker-compose/
├── New-Host/                         # NEW — consolidated host
│   ├── docker-compose.new-host.yml   # Unified compose for all 8+ services
│   ├── .env.template                  # Environment template for new host
│   ├── ocr-sidecar/                   # Sidecar (copied from Desk-5439, adapted)
│   │   ├── Dockerfile
│   │   ├── app.py
│   │   └── requirements.txt
│   ├── scripts/
│   │   ├── provision-host.sh          # OS prep + Docker + NVIDIA toolkit
│   │   ├── migrate-mariadb.sh         # Dump from QNAP → restore to new host
│   │   ├── migrate-elasticsearch.sh   # Snapshot from QNAP → restore to new host
│   │   ├── smoke-test.sh              # Post-cutover verification
│   │   └── rollback.sh                # Emergency rollback to QNAP + Desk-5439
│   └── README.md                      # Deployment guide for new host
├── QNAP/                             # EXISTING — becomes backup
├── Desk-5439/                        # EXISTING — retired after cutover
└── ASUSTOR/                          # EXISTING — Gitea runner stays
```

**Structure Decision**: New `New-Host/` directory under existing `04-00-docker-compose/` follows the established per-host directory pattern (QNAP/, Desk-5439/, ASUSTOR/). The unified compose file replaces the split QNAP/app + QNAP/service + QNAP/mariadb + Desk-5439/ocr-sidecar pattern with a single stack.

## Complexity Tracking

> No constitution check violations — table not needed.

## Implementation Phases

### Phase 1: Provision New Host (T001-T002)
- Install Ubuntu 22.04 LTS / Debian 12
- Install Docker Engine + Docker Compose v2
- Install NVIDIA drivers + nvidia-container-toolkit
- Mount ASUSTOR CIFS share to `/mnt/uploads`
- Create directory structure for Docker volumes

### Phase 2: Create Unified Docker Compose (T003-T005)
- Write `docker-compose.new-host.yml` with all services
- Configure `dms-internal` bridge network (no LAN publish for Ollama/sidecar)
- Configure `dms-frontend` bridge network (Frontend + Backend published)
- Copy OCR sidecar code from Desk-5439, adapt for Docker-internal Ollama URL
- Configure per-container memory limits per ADR-041 D5

### Phase 3: Migrate Data (T006-T007)
- Dump MariaDB from QNAP → restore to new host container
- Snapshot Elasticsearch from QNAP → restore to new host container
- Verify row count + document count parity
- Verify CIFS file access from backend container

### Phase 4: Cutover (T008-T010)
- Update Gitea CI/CD deploy target to new host
- Deploy services on new host
- Run smoke tests (login, document CRUD, OCR, AI, search)
- Remove X-API-Key from sidecar + backend (ADR-040 D5)
- Update DNS/NPM to point to new host

### Phase 5: Decommission (T011-T012)
- Stop services on QNAP (retain data for backup)
- Retire Desk-5439 (power off or repurpose)
- Monitor RAM/VRAM for 24-48 hours
- Document rollback procedure
