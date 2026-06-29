// File: specs/100-Infrastructures/141-server-consolidation/spec.md
// Change Log:
// - 2026-06-20: Initial specification for Single-Host Server Consolidation (ADR-041)

# Feature Specification: Single-Host Server Consolidation

**Feature Branch**: `141-server-consolidation`
**Created**: 2026-06-20
**Status**: Draft
**Category**: 100-Infrastructures
**Input**: ADR-041 — Consolidate all LCBP3-DMS services onto a single Docker host with ASUSTOR as primary NAS.
**Related ADRs**: [ADR-041](../../06-Decision-Records/ADR-041-server-consolidation.md), [ADR-040](../../06-Decision-Records/ADR-040-ocr-sidecar-refactor.md), [ADR-016](../../06-Decision-Records/ADR-016-security-authentication.md), [ADR-023A](../../06-Decision-Records/ADR-023A-unified-ai-architecture.md), [ADR-034](../../06-Decision-Records/ADR-034-AI-model-change.md)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Provision and Deploy on New Host (Priority: P1)

System administrator provisions the new single host (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB), installs Docker, mounts CIFS share from ASUSTOR, and deploys all services (Ollama, OCR Sidecar, Backend, Frontend, Redis, MariaDB, Elasticsearch) using a single Docker Compose stack with internal bridge network isolation.

**Why this priority**: Without a running host, no other work can proceed. This is the foundation for all subsequent stories.

**Independent Test**: Can be fully tested by running `docker compose up` on the new host and verifying all containers are healthy via `docker ps` and health check endpoints.

**Acceptance Scenarios**:

1. **Given** a fresh OS installation on the new host, **When** the administrator runs the provisioning script, **Then** Docker Engine and Docker Compose are installed and verified with `docker --version`
2. **Given** Docker is installed, **When** the administrator mounts the ASUSTOR CIFS share, **Then** `/mnt/uploads/temp` and `/mnt/uploads/permanent` are accessible and writable by containers
3. **Given** CIFS mounts are ready, **When** the administrator runs `docker compose up -d`, **Then** all 7 service containers start and report healthy within 5 minutes
4. **Given** all containers are running, **When** the administrator checks network isolation, **Then** Ollama and OCR Sidecar ports are NOT accessible from LAN (only Frontend port 3000 and Backend port 3000 are published)

---

### User Story 2 - Migrate Data from QNAP to New Host (Priority: P2)

Database administrator migrates MariaDB data and Elasticsearch indices from QNAP to the new host, ensuring zero data loss and minimal downtime.

**Why this priority**: Data migration is the critical path for cutover. Without migrated data, the new host cannot serve production traffic.

**Independent Test**: Can be tested by comparing row counts and index document counts between source (QNAP) and destination (new host) after migration.

**Acceptance Scenarios**:

1. **Given** the new host is running with empty MariaDB, **When** the administrator performs a database dump-and-restore from QNAP, **Then** all tables and row counts match the source exactly
2. **Given** the new host is running with empty Elasticsearch, **When** the administrator migrates indices from QNAP, **Then** all index document counts match the source exactly
3. **Given** data migration is complete, **When** the administrator runs a data integrity check script, **Then** all critical tables pass checksum verification with zero discrepancies
4. **Given** file storage is on ASUSTOR CIFS mount, **When** the administrator verifies file access from the backend container, **Then** all existing uploaded files are accessible at the expected paths

---

### User Story 3 - Cutover and Smoke Test (Priority: P3)

Operations team performs the cutover from the old 2-host architecture (QNAP + Desk-5439) to the new single host, updates DNS/network routing, and runs smoke tests to verify all system functions work end-to-end.

**Why this priority**: Cutover is the final step that makes the new host production-active. It depends on P1 and P2 being complete.

**Independent Test**: Can be tested by accessing the application via the new host's IP/hostname and performing core DMS operations (login, document upload, search, AI inference).

**Acceptance Scenarios**:

1. **Given** data migration is verified, **When** the administrator updates DNS to point to the new host, **Then** users accessing the application URL reach the new host within the DNS TTL period
2. **Given** DNS is updated, **When** a user logs in and creates a new Correspondence, **Then** the document is saved successfully and visible in the list
3. **Given** the system is live on the new host, **When** a user uploads a PDF and triggers OCR, **Then** OCR text extraction completes successfully via the internal Docker network (sidecar → Ollama)
4. **Given** the system is live, **When** a user performs a full-text search, **Then** Elasticsearch returns results with the same accuracy as before migration
5. **Given** the system is live, **When** a user triggers AI metadata extraction, **Then** the AI inference completes successfully via the internal Docker network (backend → Ollama)

---

### User Story 4 - Remove X-API-Key and Verify Network-Only Auth (Priority: P4)

Security administrator removes the `X-API-Key` header authentication from the OCR Sidecar and Backend, relying solely on Docker-internal network isolation as per ADR-040 D5.

**Why this priority**: This is a key security improvement enabled by the consolidation. It simplifies the architecture but must be validated carefully.

**Independent Test**: Can be tested by attempting to access sidecar endpoints from outside the Docker network (should fail) and from within the Docker network (should succeed without API key).

**Acceptance Scenarios**:

1. **Given** all services are on the Docker internal bridge, **When** the backend calls the sidecar without `X-API-Key`, **Then** the sidecar processes the request successfully
2. **Given** the sidecar is not publishing ports to LAN, **When** an external client attempts to reach the sidecar directly, **Then** the connection is refused
3. **Given** the `X-API-Key` code is removed, **When** the administrator reviews the sidecar and backend configuration, **Then** no hardcoded API keys remain in the codebase

---

### User Story 5 - Decommission Old Hosts (Priority: P5)

Operations team stops services on QNAP (which becomes backup server) and retires Desk-5439, completing the consolidation.

**Why this priority**: Cleanup is the final step after the new host is verified stable. It frees up old hardware and reduces management complexity.

**Independent Test**: Can be tested by verifying that QNAP services are stopped (except backup-related) and Desk-5439 is powered off or repurposed.

**Acceptance Scenarios**:

1. **Given** the new host has been stable for 24-48 hours, **When** the administrator stops backend/frontend/Redis/DB/ES services on QNAP, **Then** QNAP remains available as a backup server with data intact
2. **Given** QNAP services are stopped, **When** the administrator powers off Desk-5439, **Then** no LCBP3-DMS services are affected on the new host
3. **Given** old hosts are decommissioned, **When** the administrator verifies monitoring dashboards, **Then** only the new host is tracked as the active production host

---

### Edge Cases

- **GPU OOM during concurrent AI + OCR load**: What happens when np-dms-ai and np-dms-ocr are loaded simultaneously and VRAM exceeds 16GB? ADR-040 D3 (Adaptive OCR Residency) must unload OCR model to make room for LLM.
- **RAM exhaustion under heavy load**: What happens when MariaDB + Elasticsearch + CPU-fallback tensors consume more than 32GB? System must have swap space configured and memory limits per container.
- **CIFS mount failure**: What happens when ASUSTOR NAS is unreachable? File upload/download will fail; system must degrade gracefully with clear error messages.
- **Single host hardware failure**: What happens when the new host crashes? SPOF mitigation requires backup data on QNAP and a disaster recovery plan.
- **Network misconfiguration**: What happens if Docker bridge network is accidentally exposed? Sidecar and Ollama would be accessible from LAN, breaking the security model.
- **Database migration partial failure**: What happens if MariaDB migration fails midway? Rollback plan must restore QNAP as the active database host.
- **Elasticsearch index corruption during migration**: What happens if ES indices are corrupted during transfer? Re-indexing from MariaDB data must be available as a fallback.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST co-locate all 7 services (Ollama, OCR Sidecar, Backend, Frontend, Redis, MariaDB, Elasticsearch) on a single Docker host with a unified `docker-compose.yml`
- **FR-002**: System MUST use ASUSTOR (192.168.10.9) as the primary NAS for file storage via CIFS mount at `/mnt/uploads`
- **FR-003**: System MUST isolate Ollama and OCR Sidecar on a Docker internal bridge network (`dms-internal`) with no ports published to LAN
- **FR-004**: System MUST publish only Frontend (port 3000) and Backend (port 3000) to the LAN
- **FR-005**: System MUST enable backend-to-sidecar and backend-to-Ollama communication via Docker service names (`http://ocr-sidecar:8765`, `http://ollama:11434`)
- **FR-006**: System MUST migrate MariaDB data from QNAP to the new host with zero data loss
- **FR-007**: System MUST migrate Elasticsearch indices from QNAP to the new host with zero data loss
- **FR-008**: System MUST remove `X-API-Key` authentication from sidecar and backend after confirming Docker-internal network isolation (ADR-040 D5)
- **FR-009**: System MUST enforce GPU VRAM management via Adaptive OCR Residency (ADR-040 D3) and CPU Fallback Retrieval (ADR-040 D4)
- **FR-010**: System MUST configure per-container memory limits to prevent any single service from exhausting 32GB RAM
- **FR-011**: System MUST retain QNAP as a backup server with database and file storage data intact after cutover
- **FR-012**: System MUST retire Desk-5439 after cutover is verified stable for 24-48 hours
- **FR-013**: System MUST provide a rollback plan to restore services on QNAP and Desk-5439 if the new host fails
- **FR-014**: System MUST verify all core DMS functions (login, document CRUD, OCR, AI inference, search) work end-to-end on the new host before decommissioning old hosts
- **FR-015**: System MUST monitor RAM and VRAM usage for 24-48 hours post-cutover to detect resource pressure

### Key Entities _(include if feature involves data)_

- **Docker Compose Stack**: Single `docker-compose.yml` defining all 7 services, 2 networks (`dms-internal`, `dms-frontend`), and volumes (CIFS, named volumes for data)
- **CIFS Volume Mount**: ASUSTOR network share mounted as Docker volume for file storage (`/mnt/uploads/temp`, `/mnt/uploads/permanent`)
- **Docker Internal Network**: Bridge network (`dms-internal`) isolating Ollama, Sidecar, Backend, Redis, MariaDB, and Elasticsearch from LAN access
- **GPU Resource Allocation**: NVIDIA GPU passthrough to Ollama container with VRAM management via adaptive residency policies

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All 7 service containers start and report healthy within 5 minutes of `docker compose up -d` on the new host
- **SC-002**: Database migration completes with 100% row count parity between QNAP and new host for all critical tables
- **SC-003**: Elasticsearch migration completes with 100% document count parity between QNAP and new host for all indices
- **SC-004**: Core DMS operations (login, document upload, search, OCR, AI inference) complete successfully on the new host with zero functional regressions
- **SC-005**: Ollama and OCR Sidecar are unreachable from LAN (port scan returns closed/refused for ports 11434 and 8765)
- **SC-006**: Backend-to-Ollama latency is reduced by at least 50% compared to cross-host LAN communication (measured via AI inference response time)
- **SC-007**: RAM usage remains below 28GB (87.5% of 32GB) under normal operational load for 24 hours post-cutover
- **SC-008**: VRAM usage remains below 15GB (93.7% of 16GB) during concurrent AI inference and OCR workloads
- **SC-009**: Rollback plan can be executed within 2 hours to restore services on QNAP and Desk-5439 if needed
- **SC-010**: QNAP backup server retains a valid database snapshot within 24 hours of cutover

### Assumptions

- The new host hardware (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB) is physically available and OS-installed before provisioning begins
- ASUSTOR NAS (192.168.10.9) has sufficient storage capacity for all file uploads (temp + permanent)
- Network connectivity between the new host and ASUSTOR is via VLAN 10 with CIFS/SMB 3.0 support
- NVIDIA drivers and Docker GPU runtime (nvidia-container-toolkit) are compatible with the RTX 5060 Ti
- QNAP data (MariaDB, Elasticsearch) is in a consistent state suitable for dump-and-restore migration
- ADR-040 (OCR Sidecar Refactor) is implemented concurrently or prior to cutover for network-only auth and adaptive residency
- Gitea CI/CD pipeline can be updated to target the new host for deployment
