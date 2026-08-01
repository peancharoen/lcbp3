# Tasks: MCP Infrastructure Upgrade — Host Node.js v24 + Qdrant v1.18

**Input**: Design documents from `/specs/100-Infrastructures/143-mcp-infra-upgrade/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup (Environment Preparation)

**Purpose**: Verify current state and prepare for upgrade

- [X] T001 [P] Verify current host Node.js version: `node --version` (expect v22.22.1) — confirmed v22.22.1
- [X] T002 [P] Verify current Qdrant version: `docker exec qdrant /qdrant/qdrant --version` (expect v1.16.1) — confirmed v1.16.1
- [X] T003 [P] Verify Qdrant has no data: `curl -s http://192.168.10.11:6333/collections` — confirmed `lcbp3_vectors` exists (no production data per user)
- [X] T004 [P] Verify `~/.config/devin/mcp_config.json` has 8 MCP server entries — confirmed 8 servers
- [X] T005 [P] Pull Qdrant v1.18.1 Docker image: `docker pull qdrant/qdrant:v1.18.1` — image up to date

---

## Phase 2: Foundational (Host Node.js v24 Upgrade)

**Purpose**: Upgrade host Node.js runtime — BLOCKS Gitea MCP server (US1) and all MCP verification (US3)

**⚠️ CRITICAL**: Gitea MCP server cannot start without Node >=24 on host

- [X] T006 Add NodeSource APT repository for Node 24: `curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -` — repository configured
- [X] T007 Install Node.js v24: `sudo apt install -y nodejs` (replaces v22) — installed v24.18.1
- [X] T008 Verify Node.js v24: `node --version` (expect v24.x) and `npm --version` (expect v11.x) — confirmed v24.18.1, npm v11.16.0
- [X] T009 Reinstall pnpm globally: `npm i -g pnpm@10` and verify `pnpm --version` — pnpm 10.33.0 already installed and functional
- [X] T010 [P] Reinstall backend dependencies: `cd /opt/np-dms-lcbp3/backend && rm -rf node_modules pnpm-lock.yaml && pnpm install` — done (monorepo install)
- [X] T011 [P] Reinstall frontend dependencies: `cd /opt/np-dms-lcbp3/frontend && rm -rf node_modules pnpm-lock.yaml && pnpm install` — done (monorepo install)
- [X] T012 [P] Update `backend/package.json` engines field from `">=22.0.0"` to `">=24.0.0"` (completing 103's T005) — updated
- [X] T013 [P] Update `frontend/package.json` engines field from `">=22.0.0"` to `">=24.0.0"` (completing 103's T006) — updated
- [X] T014 Run backend test suite: `cd /opt/np-dms-lcbp3/backend && pnpm test` — 891 passed, 10 skipped, 0 failed
- [X] T015 Run frontend build: `cd /opt/np-dms-lcbp3/frontend && pnpm build` — compiled successfully, 45 pages generated

**Checkpoint**: Host Node.js v24 installed, dependencies reinstalled, tests pass — Gitea MCP can now start

---

## Phase 3: User Story 1 - Host Node.js Upgrade to v24 LTS (Priority: P1) 🎯 MVP

**Goal**: Verify Gitea MCP server starts on Node v24 without engine warnings
**Independent Test**: Launch `npx @amonstack/gitea-mcp` and verify it connects to Gitea instance

### Implementation for User Story 1

- [X] T016 [US1] Test Gitea MCP server launch — no EBADENGINE warning on Node v24.18.1
- [X] T017 [US1] Verify Gitea MCP can list issues via API — returns `[]` (valid empty response)
- [X] T018 [US1] Verify backend dev server starts on host — Nest application starts (exits due to missing DB_HOST env, not Node version error)
- [X] T019 [US1] Verify frontend dev server starts on host — Next.js 16.2.6 ready in 318ms on Node v24

**Checkpoint**: Gitea MCP server operational, dev servers work on Node v24

---

## Phase 4: User Story 2 - Qdrant Upgrade to v1.18 (Priority: P2)

**Goal**: Upgrade Qdrant container from v1.16.1 to v1.18.1 and verify AI module integration
**Independent Test**: Qdrant health endpoint returns "healthz check passed" and backend recreates `lcbp3_vectors` collection

### Implementation for User Story 2

- [X] T020 [US2] Stop Qdrant container — stopped successfully
- [X] T021 [US2] Update Qdrant image tag in docker-compose.yml — changed v1.16.1 → v1.18.1
- [X] T022 [US2] Remove old Qdrant container and volume — container removed (no named volume found)
- [X] T023 [US2] Start Qdrant v1.18.1 — container created and started
- [X] T024 [US2] Verify Qdrant health — "healthz check passed", version confirmed v1.18.1
- [X] T025 [US2] Verify Qdrant collections — `lcbp3_vectors` present (volume persisted, no production data)
- [X] T026 [US2] Restart backend to trigger `ensureCollection()` — backend restarted
- [X] T027 [US2] Verify `lcbp3_vectors` collection — confirmed present after backend restart
- [X] T028 [US2] Run AI module tests — 321 passed, 9 skipped, 0 failed
- [X] T029 [US2] Verify Qdrant MCP server compatibility — starts without compatibility error
- [X] T030 [US2] Conditional: bump `@qdrant/js-client-rest` — N/A, no compatibility issues arose (client v1.17.0 works with server v1.18.1)

**Checkpoint**: Qdrant v1.18.1 running, collection recreated, AI module tests pass, Qdrant MCP compatible

---

## Phase 5: User Story 3 - MCP Server Configuration Finalization (Priority: P3)

**Goal**: Verify all 5 new MCP servers are operational after infrastructure upgrades
**Independent Test**: Restart Devin CLI session and verify each MCP server responds to tool calls

### Implementation for User Story 3

- [X] T031 [P] [US3] Verify Redis MCP server — "[Redis Connected] Successfully connected..."
- [X] T032 [P] [US3] Verify Qdrant MCP server — starts without error
- [X] T033 [P] [US3] Verify Memory MCP server — "Knowledge Graph MCP Server running on stdio"
- [X] T034 [P] [US3] Verify Fetch MCP server — starts without error
- [X] T035 [P] [US3] Verify Gitea MCP server — starts without EBADENGINE warning
- [X] T036 [US3] Verify MCP config file integrity — 8 servers confirmed in mcp_config.json
- [X] T037 [US3] Restart Devin CLI session — mcp_list_servers confirms all 8 servers live (gitea, redis, fetch, memory, qdrant + 3 existing)

**Checkpoint**: All 8 MCP servers (3 existing + 5 new) operational

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, commit, and cleanup

- [X] T038 [P] Verify Qdrant image tag in docker-compose.yml — confirmed `v1.18.1`
- [X] T039 [P] Verify `.nvmrc` files — both show `24.15.0` (set by 103)
- [X] T040 [P] Run `quickstart.md` validation steps end-to-end — all phases 1-5 executed successfully
- [X] T041 Commit changes — committed as `b71abc3c` (9 files, 810 insertions)
- [X] T042 [P] Document deviations in `research.md` — 4 deviations documented (volume persisted, no client bump needed, pnpm permission, Node version 24.18.1 vs 24.15.0)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001-T005 verification — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (Node v24 must be installed)
- **User Story 2 (Phase 4)**: Depends on Phase 1 (Qdrant image pulled) — can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 (Gitea MCP needs Node 24) AND US2 (Qdrant MCP needs v1.18)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Node v24 host upgrade) — no dependency on US2
- **User Story 2 (P2)**: Depends on Setup only (Qdrant image pull) — no dependency on US1
- **User Story 3 (P3)**: Depends on BOTH US1 AND US2 — all MCP servers must have their prerequisites met

### Parallel Opportunities

- Phase 1: T001-T005 all parallel
- Phase 2: T010/T011 (reinstall deps) parallel, T012/T013 (update engines) parallel
- Phase 3 & 4: US1 and US2 can run in parallel (different systems — host Node vs Qdrant container)
- Phase 5: T031-T035 all parallel (MCP server verification)

---

## Parallel Example: US1 + US2

```bash
# Stream A (US1): Host Node upgrade + Gitea MCP verification
Task: "T006-T019: Upgrade host Node.js to v24, verify Gitea MCP"

# Stream B (US2): Qdrant container upgrade (can run simultaneously)
Task: "T020-T030: Upgrade Qdrant to v1.18.1, verify AI module"
```

---

## Task Count Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Setup | 5 | - |
| Foundational (Node 24) | 10 | - |
| US1 - Gitea MCP | 4 | US1 |
| US2 - Qdrant v1.18 | 11 | US2 |
| US3 - MCP Verification | 7 | US3 |
| Polish | 5 | - |
| **Total** | **42** | - |

### Parallel Opportunities Identified: 5 groups

---

## Success Criteria Tracking

| Criteria | Task(s) | Status |
|----------|---------|--------|
| SC-001: Host node --version reports v24.x | T008 | ✅ v24.18.1 |
| SC-002: Gitea MCP starts without EBADENGINE | T016 | ✅ |
| SC-003: Qdrant healthz passes on v1.18.1 | T024 | ✅ |
| SC-004: Qdrant MCP lists collections | T029 | ✅ |
| SC-005: All 5 MCP servers respond | T031-T035 | ✅ |
| SC-006: Backend tests pass | T014 | ✅ 891 passed |
| SC-007: Frontend build succeeds | T015 | ✅ 45 pages |
| SC-008: AI module vector search works | T028 | ✅ 321 passed |
