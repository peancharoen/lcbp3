// File: specs/100-Infrastructures/141-server-consolidation/tasks.md
// Change Log:
// - 2026-06-20: Initial task list for Single-Host Server Consolidation
// - 2026-06-20: Fix C1-C5 from analysis: backend env var update, port conflict, GPU residency, ollama-metrics port, n8n endpoints

# Tasks: Single-Host Server Consolidation

**Input**: Design documents from `/specs/100-Infrastructures/141-server-consolidation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Related ADRs**: ADR-041, ADR-040, ADR-016, ADR-023A, ADR-034

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure and initial files for the new host deployment

- [ ] T001 Create `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/` directory structure with subdirectories: `ocr-sidecar/`, `scripts/`
- [ ] T002 [P] Create `.env.template` at `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/.env.template` with all required env vars from contracts
- [ ] T003 [P] Create `README.md` at `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/README.md` with deployment overview

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provision the new host OS and create the unified Docker Compose stack — MUST be complete before any user story can proceed

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/scripts/provision-host.sh` — installs Docker Engine, Docker Compose v2, NVIDIA drivers, nvidia-container-toolkit, CIFS utils, creates directory structure
- [ ] T005 Create `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/docker-compose.new-host.yml` — unified compose with all 10 services, 2 networks (dms-internal, dms-frontend), CIFS volume, named volumes, memory limits per data-model.md. Backend publishes `3001:3000` to LAN (NPM routes `backend.np-dms.work` → :3001); Frontend publishes `3000:3000`; ollama-metrics publishes `9924:9924` to LAN for Prometheus scraping from ASUSTOR
- [ ] T006 [P] Copy OCR sidecar code from `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/` to `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/ocr-sidecar/` — adapt `OLLAMA_API_URL` to `http://ollama:11434` (Docker DNS), remove `ports` mapping, use `expose` only
- [ ] T007 [P] Update `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/ocr-sidecar/Dockerfile` — verify GPU access via nvidia-container-toolkit, ensure poppler-utils installed
- [ ] T008 [P] Update `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/ocr-sidecar/requirements.txt` — verify typhoon-ocr, PyMuPDF, httpx, fastapi versions match Desk-5439
- [ ] T008b Update backend environment variables for renamed service names: `REDIS_HOST=redis` (was `cache`), `ELASTICSEARCH_HOST=elasticsearch` (was `search`) in `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/.env.template` and `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/docker-compose.new-host.yml` backend environment section — these service names changed from QNAP compose where Redis was `cache` and ES was `search`

**Checkpoint**: New host directory structure and unified compose file ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Provision and Deploy on New Host (Priority: P1) 🎯 MVP

**Goal**: Administrator provisions the new host, mounts ASUSTOR CIFS, and deploys all services with Docker internal network isolation

**Independent Test**: Run `docker compose up -d` on the new host and verify all containers are healthy via `docker ps` and health check endpoints

### Implementation for User Story 1

- [ ] T009 [US1] Run `provision-host.sh` on new host — verify Docker, NVIDIA, CIFS mount at `/mnt/uploads`
- [ ] T010 [US1] Pull Ollama models on new host: `ollama pull np-dms-ai:latest`, `ollama pull np-dms-ocr:latest`, `ollama pull nomic-embed-text:latest` — verify with `ollama list`
- [ ] T011 [US1] Copy `.env.template` to `.env`, fill in all secrets from QNAP `.env` (DB passwords, JWT secrets, Redis password, ASUSTOR CIFS credentials)
- [ ] T012 [US1] Run `docker compose --env-file .env -f docker-compose.new-host.yml up -d` and verify all 10 containers start
- [ ] T013 [US1] Verify network isolation: `nmap -p 11434 <new-host-ip>` from another VLAN 10 machine should show closed/refused; `nmap -p 8765` should show closed/refused; `nmap -p 3000` (frontend) and `nmap -p 3001` (backend) should show open; `nmap -p 9924` (ollama-metrics) should show open for Prometheus
- [ ] T014 [US1] Verify health checks: `curl http://localhost:3001/health` (backend on published port 3001), `curl http://localhost:3000/` (frontend), `curl http://ocr-sidecar:8765/health` (from inside backend container via Docker DNS)

**Checkpoint**: All services running on new host with correct network isolation — MVP achieved

---

## Phase 4: User Story 2 - Migrate Data from QNAP to New Host (Priority: P2)

**Goal**: Migrate MariaDB and Elasticsearch data from QNAP to the new host with zero data loss

**Independent Test**: Compare row counts and index document counts between QNAP (source) and new host (destination) after migration

### Implementation for User Story 2

- [ ] T015 [P] [US2] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/scripts/migrate-mariadb.sh` — dump from QNAP MariaDB 11.8 via `mariadb-dump --single-transaction --routines --triggers`, pipe to new host container
- [ ] T016 [P] [US2] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/scripts/migrate-elasticsearch.sh` — create snapshot on QNAP ES, transfer files, register repo on new host, restore
- [ ] T017 [US2] Run `migrate-mariadb.sh` — verify all table row counts match between QNAP and new host
- [ ] T018 [US2] Run `migrate-elasticsearch.sh` — verify all index document counts match between QNAP and new host
- [ ] T019 [US2] Create and run `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/scripts/verify-data-parity.sh` — automated row count + document count comparison script
- [ ] T020 [US2] Verify CIFS file access: list files in `/app/uploads/temp` and `/app/uploads/permanent` from backend container, compare with ASUSTOR share

**Checkpoint**: All data migrated and verified — new host has complete production data

---

## Phase 5: User Story 3 - Cutover and Smoke Test (Priority: P3)

**Goal**: Perform production cutover from old 2-host architecture to new single host, verify all DMS functions work end-to-end

**Independent Test**: Access application via new host IP, perform core DMS operations (login, document upload, search, AI inference)

### Implementation for User Story 3

- [ ] T021 [P] [US3] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/scripts/smoke-test.sh` — automated tests for: backend health, frontend accessible, login flow, document list, OCR endpoint, AI inference, full-text search
- [ ] T022 [US3] Update Gitea secrets: `HOST` → new host IP, `COMPOSE_FILE` → `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/docker-compose.new-host.yml`
- [ ] T023 [US3] Update `scripts/deploy.sh` — change `COMPOSE_FILE` path to New-Host directory
- [ ] T024 [US3] Update NPM (Nginx Proxy Manager) on QNAP: `lcbp3.np-dms.work` → new host IP:3000 (frontend), `backend.np-dms.work` → new host IP:3001 (backend)
- [ ] T024b [US3] Update n8n workflow endpoints on QNAP: change all backend API URLs from `http://192.168.10.8:3000/api` (QNAP) to `http://<new-host-ip>:3001/api` (new host) — n8n stays on QNAP but must reach backend on new host via LAN port 3001
- [ ] T025 [US3] Run `smoke-test.sh` on new host — verify all 7 smoke tests pass
- [ ] T026 [US3] Verify from external machine on VLAN 10: access `https://lcbp3.np-dms.work`, login, create a test Correspondence, upload a PDF, trigger OCR, perform search

**Checkpoint**: New host is production-active — all DMS functions verified end-to-end

---

## Phase 6: User Story 4 - Remove X-API-Key and Verify Network-Only Auth (Priority: P4)

**Goal**: Remove `X-API-Key` authentication from sidecar and backend, relying solely on Docker-internal network isolation per ADR-040 D5

**Independent Test**: Attempt to access sidecar from outside Docker network (should fail); verify backend calls sidecar without API key (should succeed)

### Implementation for User Story 4

- [ ] T027 [P] [US4] Remove `OCR_SIDECAR_API_KEY` from `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/docker-compose.new-host.yml` ocr-sidecar environment
- [ ] T028 [P] [US4] Remove API key validation from `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/ocr-sidecar/app.py` — remove `X-API-Key` header check middleware
- [ ] T029 [US4] Remove `X-API-Key` header from `backend/src/modules/ai/services/ocr.service.ts` — remove API key from HTTP client headers
- [ ] T030 [US4] Remove `OCR_SIDECAR_API_KEY` from `backend/.env.example` and any backend config that sets it
- [ ] T031 [US4] Rebuild and redeploy sidecar + backend containers — verify backend can call sidecar without API key
- [ ] T032 [US4] Verify external access blocked: `curl http://<new-host-ip>:8765/health` from VLAN 10 machine should fail (connection refused)

**Checkpoint**: Network-only auth verified — no API key needed, Docker isolation sufficient

---

## Phase 7: User Story 5 - Decommission Old Hosts (Priority: P5)

**Goal**: Stop services on QNAP (becomes backup) and retire Desk-5439, completing the consolidation

**Independent Test**: Verify QNAP services stopped (except backup), Desk-5439 powered off, new host unaffected

### Implementation for User Story 5

- [ ] T033 [P] [US5] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/scripts/rollback.sh` — emergency rollback: stop new host, restore QNAP + Desk-5439 services, revert DNS, revert CI/CD
- [ ] T034 [US5] Monitor new host for 24-48 hours: RAM usage (`docker stats`), VRAM usage (`nvidia-smi`), container health, application logs
- [ ] T034b [US5] Verify Adaptive OCR Residency (ADR-040 D3) on new RTX 5060 Ti: load `np-dms-ai` and `np-dms-ocr` concurrently, confirm `calculate_ocr_residency()` unloads OCR model when LLM needs VRAM; verify CPU Fallback Retrieval (ADR-040 D4) activates for BGE-M3/Reranker when GPU is occupied by LLM
- [ ] T035 [US5] Stop QNAP app services: `ssh admin@192.168.10.8 'cd /share/np-dms/app && docker compose down'`
- [ ] T036 [US5] Stop QNAP service stack: `ssh admin@192.168.10.8 'cd /share/np-dms/services && docker compose down'`
- [ ] T037 [US5] Retire Desk-5439: `ssh user@192.168.10.100 'sudo shutdown -h now'` (or repurpose)
- [ ] T038 [US5] Verify new host still fully operational after old hosts decommissioned — re-run `smoke-test.sh`
- [ ] T039 [US5] Take QNAP backup snapshot: `mariadb-dump` on QNAP MariaDB (if still running) or verify existing backup is current

**Checkpoint**: Consolidation complete — single host is sole production, old hosts decommissioned

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, monitoring, and final verification

- [ ] T040 [P] Update `specs/04-Infrastructure-OPS/04-00-docker-compose/README.md` — add New-Host section, mark QNAP as backup, mark Desk-5439 as retired
- [ ] T041 [P] Update `CONTEXT.md` — update infrastructure topology to reflect single-host architecture
- [ ] T042 [P] Update `AGENTS.md` — update infrastructure references (Desk-5439 → New Host, QNAP → backup)
- [ ] T043 Update `specs/04-Infrastructure-OPS/04-00-docker-compose/.env.template` — add ASUSTOR_USER, ASUSTOR_PASS, NEW_HOST_IP variables
- [ ] T044 [P] Update Prometheus/Grafana scrape config on ASUSTOR — update ollama-metrics target from `192.168.10.100:9924` to new host internal or host-published port
- [ ] T045 Run `quickstart.md` validation — follow all steps end-to-end on a fresh provision
- [ ] T046 [P] Document disaster recovery procedure — backup schedule, restore from QNAP backup, estimated RTO/RPO

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — requires physical access to new host
- **US2 (Phase 4)**: Depends on US1 (services must be running to receive migrated data)
- **US3 (Phase 5)**: Depends on US1 + US2 (services running + data migrated for cutover)
- **US4 (Phase 6)**: Depends on US3 (cutover complete, network isolation verified)
- **US5 (Phase 7)**: Depends on US3 + US4 (stable production before decommissioning)
- **Polish (Phase 8)**: Can start after US3; some tasks depend on US5

### User Story Dependencies

- **US1 (P1)**: Foundational → US1 — no dependencies on other stories
- **US2 (P2)**: US1 → US2 — needs running services to receive data
- **US3 (P3)**: US1 + US2 → US3 — needs running services + migrated data
- **US4 (P4)**: US3 → US4 — needs cutover complete to verify network isolation in production
- **US5 (P5)**: US3 + US4 → US5 — needs stable production before decommissioning

### Parallel Opportunities

- T002, T003 can run in parallel (different files)
- T006, T007, T008 can run in parallel (sidecar files, no dependencies)
- T015, T016 can run in parallel (different migration scripts)
- T027, T028 can run in parallel (different files: compose vs app.py)
- T040, T041, T042, T044 can run in parallel (different doc files)
- T027, T028, T030 can run in parallel (different files: compose, app.py, .env.example)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (create directory structure)
2. Complete Phase 2: Foundational (provision host + create compose)
3. Complete Phase 3: User Story 1 (deploy services)
4. **STOP and VALIDATE**: All containers healthy, network isolation verified
5. Demo to stakeholders if ready

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add US1 → Services deployed → Validate (MVP!)
3. Add US2 → Data migrated → Validate parity
4. Add US3 → Cutover complete → Validate end-to-end
5. Add US4 → Security hardened → Validate network-only auth
6. Add US5 → Old hosts retired → Validate stability
7. Polish → Documentation updated → Final validation

---

## Notes

- This is an infrastructure task — most work is shell scripts, Docker Compose YAML, and manual operations
- Physical access to the new host is required for US1
- Data migration (US2) requires SSH access to QNAP
- Cutover (US3) requires DNS/NPM access and coordination with users
- Decommission (US5) should only proceed after 24-48 hours of stable monitoring
- Rollback plan must be tested before cutover
- All env secrets must come from `.env` (gitignored) — never commit real secrets
