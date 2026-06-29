// File: specs/200-fullstacks/231-hermes-agent/tasks.md
// Change Log:
// - 2026-05-29: Initial task list for Hermes Agent (ADR-031 v2.0)

# Tasks: Hermes Agent — Autonomous Dev Orchestrator & Telegram DevOps Bridge

**Input**: Design documents from `specs/200-fullstacks/231-hermes-agent/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Organization**: Tasks grouped by user story (US1–US5) for independent implementation and testing
**Staged Rollout**: US5 tasks map to Stage gates — do not skip stages

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paths below are relative to `hermes/` monorepo package root (standalone NestJS project)

---

## Phase 1: Setup (Hermes Project Initialization)

**Purpose**: Bootstrap `hermes/` project structure and Docker infrastructure

- [ ] T001 Create `hermes/` NestJS project: `package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example` with TypeScript strict mode and all dependencies from plan.md
- [ ] T002 [P] Create `hermes/Dockerfile` — multi-stage Node.js 22 Alpine build for ASUSTOR deployment
- [ ] T003 [P] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/hermes/docker-compose.hermes.yml` — hermes-agent container with CPU 2.0 / mem 4096M limits (fallback + deploy.resources per ADR-031 note)
- [ ] T004 [P] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/hermes/docker-compose.hermes-redis.yml` — hermes-redis container with `hermes.redis.conf` (AOF persistence, maxmemory 512mb, isolated from DMS Redis)
- [ ] T005 [P] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/hermes/docker-compose.hermes-qdrant.yml` — hermes-qdrant container on port 6334 (separated from DMS Qdrant port 6333)
- [ ] T006 Create `hermes/src/config/hermes.config.ts` — typed env vars (all secrets via env; no hardcoded values; ห้าม commit secret จริง)
- [ ] T007 Create `hermes/src/app.module.ts` — root module wiring all feature modules

**Checkpoint**: `docker compose -f docker-compose.hermes.yml up -d` รัน hermes container ได้; `docker inspect` แสดง resource limits ถูกต้อง

---

## Phase 2: Foundational (Core Infrastructure — Blocks All User Stories)

**Purpose**: Cross-cutting concerns ทุก user story ต้องอาศัย

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create `hermes/src/common/utils/uuid.util.ts` — UUIDv7 generation ตาม ADR-019 (`generateTransactionId()` returns UUIDv7 string)
- [ ] T009 [P] Create `hermes/src/common/utils/secret-redactor.util.ts` — scan command payload สำหรับ secret/token/password/storage-path patterns แล้ว redact ก่อน log (FR-014)
- [ ] T010 [P] Create `hermes/src/common/guards/api-key.guard.ts` — validate `X-API-Key` header ต่อทุก non-webhook endpoint; return 401 ถ้าไม่ถูกต้อง
- [ ] T011 [P] Create `hermes/src/common/interceptors/transaction.interceptor.ts` — auto-generate UUIDv7 transactionId ต่อทุก request และ attach ลง response headers + request context
- [ ] T012 Create `hermes/src/operations/operations-log.service.ts` — SQLite CRUD สำหรับ `hermes_operations_log` (create entry, update status, find by transactionId); ใช้ `better-sqlite3`
- [ ] T013 [P] Create `hermes/src/operations/operations.module.ts` และ `hermes/src/operations/operations.controller.ts` — GET `/operations/logs` + GET `/operations/logs/:transactionId` (ตาม contracts/hermes-api.yaml)
- [ ] T014 Create `hermes/src/health/health.controller.ts` — GET `/health` returns `HermesStatus` with queue counts; no auth required (security: [])
- [ ] T015 [P] Write unit tests `hermes/test/unit/secret-redactor.spec.ts` — test cases: token patterns, password= patterns, storage paths, ไม่ redact code snippets / ADR content

- [ ] T054 [P] Write unit tests `hermes/test/unit/operations-log.spec.ts` — test cases: create entry, update status, findByTransactionId, redaction enforcement, retention boundary

**Checkpoint**: API Key guard ทำงาน; Operations log บันทึก/query ได้; Secret redactor pass tests; Health endpoint ตอบกลับ

---

## Phase 3: User Story 1 — Autonomous Dev Orchestrator (Priority: P1) 🎯 MVP

**Goal**: Developer ส่ง coding task → Hermes orchestrate sub-agents → self-correction loop → PR created

**Independent Test**: POST `/orchestration/tasks` ด้วย `{description: "scaffold NestJS health module", taskType: "DMS_FEATURE", telegramChatId: "test"}` → GET `/orchestration/tasks/:id` แสดง `status: PR_CREATED` + `prUrl` populated ภายใน expected timeout

### Implementation for User Story 1

- [ ] T016 [P] [US1] Create `hermes/src/qdrant/dev-qdrant.service.ts` — Qdrant JS client สำหรับ Dev Qdrant (ASUSTOR port 6334); collection `lcbp3_code_chunks`; search by `repoName`+`moduleName` (ไม่ใช้ `projectPublicId` filter)
- [ ] T017 [P] [US1] Create `hermes/src/orchestrator/context-loader.service.ts` — selective context loading ตาม task type (DEVOPS/DMS_FEATURE/SCHEMA_DB/BUG_FIX); โหลด CONTEXT-ADR-031.md + AGENTS.md เสมอ; เพิ่ม CONTEXT.md สำหรับ DMS_FEATURE; ห้าม load production DB query results
- [ ] T018 [P] [US1] Create `hermes/src/orchestrator/sub-agent.service.ts` — Cloud AI delegation: Claude Haiku/GPT-4o-mini สำหรับ code generation; Data Classification enforcement (ห้าม production data ใน prompt payload)
- [ ] T019 [US1] Create `hermes/src/orchestrator/self-correction.service.ts` — รัน lint/tsc/test ผ่าน MCP hermes-tools; วนซ้ำสูงสุด 3 iterations; ถ้า > 3 → escalate notification ผ่าน BullMQ (depends on T018)
- [ ] T020 [US1] Create `hermes/src/orchestrator/soul.service.ts` — read/append/rotate SOUL.md ที่ `/volume1/docker/hermes/SOUL.md`; rotate ทุก 30 วัน; ไม่ sync ลง repo
- [ ] T021 [US1] Create `hermes/src/orchestrator/orchestrator.service.ts` — main dev loop: context load → plan → sub-agent delegate → self-correction → commit via hermes-bot → create PR → record SOUL.md + operations log (depends on T016–T020)
- [ ] T022 [US1] Create `hermes/src/orchestrator/orchestrator.controller.ts` — POST `/orchestration/tasks`, GET `/orchestration/tasks/:id` ตาม OpenAPI contract; ใช้ hermes-orchestration-queue (BullMQ)
- [ ] T023 [US1] Create `hermes/src/orchestrator/orchestrator.module.ts` — wire all orchestrator providers
- [ ] T024 [P] [US1] Write unit tests `hermes/test/unit/orchestrator.spec.ts` — test context loader (correct files per task type), sub-agent delegation call, self-correction loop iteration count enforcement

**Checkpoint**: POST orchestration task ได้รับ taskId; GET task แสดง status transitions; SOUL.md มี session entry; Dev Qdrant query ไม่แตะ DMS Qdrant

---

## Phase 4: User Story 2 — Telegram Read-only DevOps Commands (Priority: P2)

**Goal**: DevOps engineer ส่ง `/ci_status`, `/repo_summary`, `/status` ผ่าน Telegram และรับผลลัพธ์กลับ ≤ 10 วินาที

**Independent Test**: ส่ง webhook payload `/ci_status` พร้อม valid secret token + allowlisted user → ตรวจสอบ operations log entry + Telegram outbound message queued + BullMQ job created

### Implementation for User Story 2

- [ ] T025 [P] [US2] Create `hermes/src/integrations/gitea/gitea.service.ts` — read-only Gitea API methods: getLatestCI(), getRepoSummary(), getIssues(), getPRs(); ใช้ read-only token; ห้าม write operations ใน phase นี้
- [ ] T026 [P] [US2] Create `hermes/src/integrations/telegram/telegram-rate-limiter.service.ts` — Redis-based rate limit: `hermes:telegram:{userId}` key, incr + expire 60s, threshold 10 req/min (FR-011)
- [ ] T027 [US2] Create `hermes/src/integrations/telegram/hermes-telegram-gateway.ts` — inbound webhook handler: verify `X-Telegram-Bot-Api-Secret-Token` → check allowlist → check rate limit → record inbound to operations log → dispatch to command router (depends on T025, T026)
- [ ] T028 [US2] Create `hermes/src/integrations/telegram/hermes-devops-command-router.ts` — route read-only commands (/status, /ci_status, /repo_summary, /audit_summary, /help); queue outbound response via BullMQ hermes-notification-queue (depends on T027)
- [ ] T029 [US2] Create `hermes/src/integrations/telegram/hermes-telegram-dispatcher.ts` — BullMQ Worker @Processor('hermes-notification-queue'): @Process('telegram-devops-outbound') — send via Telegram Bot API; record outbound to operations log; retry 3x exponential backoff (ADR-007, FR-012)
- [ ] T030 [US2] Create `hermes/src/integrations/telegram/telegram.module.ts` — wire all telegram providers + BullMQ queue registration
- [ ] T031 [P] [US2] Write unit tests `hermes/test/unit/telegram-gateway.spec.ts` — webhook secret verification, allowlist rejection, rate limit enforcement, operations log inbound record (depends on T027)
- [ ] T032 [P] [US2] Write unit tests `hermes/test/unit/command-router.spec.ts` — command routing (/ prefix parsing), forbidden command detection, outbound job queuing (depends on T028)

**Checkpoint**: POST `/telegram/webhook` ด้วย wrong secret → 401; non-allowlisted user → rejected; valid read-only command → operations log entry + BullMQ job created

---

## Phase 5: User Story 3 — Telegram Write-with-Confirmation (Priority: P3)

**Goal**: DevOps engineer สั่ง write action → Hermes ขอ confirmation → ดำเนิน action → บันทึก operations log

**Independent Test**: ส่ง "สร้าง branch proposal สำหรับ fix/test" → รับ confirmation prompt → ยืนยัน → Gitea branch `hermes/fix-test` ถูกสร้าง + operations log มี git write entry + forbidden action blocklist ทำงาน

### Implementation for User Story 3

- [ ] T033 [P] [US3] Extend `hermes/src/integrations/gitea/gitea.service.ts` — เพิ่ม write methods: createBranch(), createIssue(), createPR(), triggerCI() ใช้ write token แยก (least privilege, ไม่ใช่ admin token); branch pattern validation (hermes/*)
- [ ] T034 [US3] Extend `hermes/src/integrations/telegram/hermes-devops-command-router.ts` — เพิ่ม write-with-confirmation flow: (1) parse write intent → (2) show action summary → (3) wait for explicit confirmation → (4) execute → (5) record operations log; forbidden action blocklist (push main/develop, production deploy, schema migration, direct DB write, storage delete) → reject immediately
- [ ] T035 [US3] Integrate `hermes-bot` Git identity ใน `hermes/src/orchestrator/orchestrator.service.ts` — `simple-git` config: user.name "Hermes Bot", user.email "hermes-bot@np-dms.work"; push เฉพาะ `hermes/*` branches; commit message format: `"feat(hermes): {task description}\n\nOrchestrated by Hermes ADR-031 v2.0"`
- [ ] T036 [P] [US3] Write operations log record ใน `hermes/src/operations/operations-log.service.ts` สำหรับ Git write actions — บันทึก `gitea_token_identity`, `target_repo`, `target_branch`, status ก่อนและหลัง action (depends on T033)

**Checkpoint**: Write command ต้องการ confirmation; hermes-bot branch creation ใช้ pattern `hermes/fix-*`; forbidden actions ถูก blocked; operations log มี token identity record

---

## Phase 6: User Story 4 — Developer AI Proxy (Priority: P4)

**Goal**: Developer ใช้ Codex CLI / agy โดยชี้ `OPENAI_BASE_URL` → `hermes proxy` port 8766 รับ request สำหรับ coding/devops assistance เท่านั้น

**Independent Test**: ตั้ง OPENAI_BASE_URL → hermes proxy → ส่ง coding request → รับ response พร้อม DMS context; ส่ง payload ที่มี password/token → ถูก reject + redact log

### Implementation for User Story 4

- [ ] T037 [US4] Create `hermes/src/proxy/proxy.service.ts` — OpenAI-compatible API (port 8766); forward coding/devops requests ไป Cloud AI พร้อม DMS context injection; validate payload ไม่มี production data (ใช้ secret-redactor.util.ts); ห้าม forward ถ้าตรวจพบ production data
- [ ] T038 [US4] Create `hermes/src/proxy/proxy.module.ts` + controller — bind ที่ port 8766 แยกจาก main API port 8080; API Key auth; LAN/VPN-only note ใน config
- [ ] T039 [P] [US4] Create `hermes/src/integrations/mcp/mcp-server.service.ts` — expose `/mcp` endpoint สำหรับ agy + Devin integration; implement `hermes-memory` tool (recall DMS context); implement `hermes-tools` tool (bash/git execution on ASUSTOR)
- [ ] T040 [P] [US4] Create `hermes/src/integrations/mcp/mcp.module.ts` — wire MCP server providers
- [ ] T041 [P] [US4] Verify port isolation: proxy port 8766 ≠ PaddleOCR sidecar port 8765 (ADR-023A) — add port validation assertion ใน `hermes/src/config/hermes.config.ts` ที่ startup

**Checkpoint**: `curl http://<ASUSTOR_IP>:8766/v1/models` returns models list; payload ที่มี "password:" ถูก reject; `/mcp` endpoint accessible; port 8765 ไม่ถูก bind โดย Hermes

---

## Phase 7: User Story 5 — Staged Rollout & Health Monitoring (Priority: P5)

**Goal**: Admin deploy Hermes ผ่าน 6-stage gated rollout พร้อม monitoring ที่แยก Hermes health จาก DMS

**Independent Test**: ปิด hermes container → ตรวจสอบ DMS frontend/backend/workflow-engine response 200; Hermes down alert ≠ DMS production outage alert

### Implementation for User Story 5

- [ ] T042 [P] [US5] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/hermes/stage-gates/` — checklist files per stage (stage-0.md → stage-5.md) ตาม quickstart.md acceptance gates; แต่ละ gate มี verification commands และ pass/fail criteria
- [ ] T043 [US5] Extend `hermes/src/health/health.controller.ts` (extends T014) — เพิ่ม subsystem health: Redis status, Dev Qdrant status, Operations log status, hermes proxy status, BullMQ queue depths; return `HermesStatus` object ครบถ้วนตาม contracts/hermes-api.yaml
- [ ] T044 [P] [US5] Create monitoring alert configuration: Hermes down / Telegram Bridge down / MCP unavailable / hermes proxy down = DevOps warning (ไม่ใช่ DMS production outage); repeated auth failure / rate limit spike = security alert; document ใน `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/hermes/monitoring-alerts.md`
- [ ] T045 [P] [US5] Write failure isolation verification script `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/hermes/verify-isolation.sh` — `docker stop hermes_agent_lcbp3` แล้ว check DMS endpoints return 200; ใช้ใน Stage 1 acceptance gate
- [ ] T046 [P] [US5] Create SOUL.md rotation cron job: เพิ่ม cron schedule ใน `hermes/src/orchestrator/soul.service.ts` สำหรับ rotate ทุก 30 วัน (archive + clear SOUL.md)

**Checkpoint**: Health endpoint แสดง subsystem status ครบถ้วน; Stage gate checklists ครบ 6 stages; Failure isolation test pass (DMS ยังทำงานเมื่อ Hermes ล่ม)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality, security, và documentation finalization

- [ ] T047 [P] Verify all TypeScript files have `// File:` header and `// Change Log:` comments ตาม AGENTS.md; JSDoc สำหรับ public classes (Thai comments)
- [ ] T048 [P] Replace all `console.log` ด้วย NestJS Logger (`this.logger.log/warn/error`) ทั่วทั้ง `hermes/src/`
- [ ] T049 Secret scan validation: ตรวจสอบว่าไม่มี secret จริงใน `hermes/` source tree, compose files, `.env.example`, หรือ spec files; เพิ่ม pre-commit hook (mandatory — FR-020)
- [ ] T050 [P] Resource limit verification: สร้าง `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/hermes/verify-resources.sh` — `docker inspect` + `docker stats` แล้วเปรียบเทียบกับ expected limits (CPU 2.0 / RAM 4096MB)
- [ ] T051 [P] Data Classification audit: review hermes proxy + sub-agent service code ว่าไม่มี production DB query results หรือ document content ใน Cloud AI request payloads
- [ ] T052 Run `quickstart.md` staged verification (Stage 0 → Stage 5) และ update checklist results; document final rollout status
- [ ] T053 [P] Create `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/hermes/secret-rotation.md` — Secret rotation runbook สำหรับ `HERMES_PROXY_API_KEY`, Telegram bot token, Gitea read-only + write tokens, read-only DB credential; include rotation schedule, revocation steps, และ operator offboarding procedure (FR-020)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: ไม่มี dependency — เริ่มทันที
- **Phase 2 (Foundational)**: ต้องการ Phase 1 — **BLOCKS ทุก user story**
- **Phase 3 (US1)**: ต้องการ Phase 2 เสร็จ — เป็น MVP
- **Phase 4 (US2)**: ต้องการ Phase 2 เสร็จ — สามารถขนาน Phase 3 ได้
- **Phase 5 (US3)**: ต้องการ Phase 4 เสร็จ (extends Telegram dispatcher) + Phase 3 บางส่วน (hermes-bot git)
- **Phase 6 (US4)**: ต้องการ Phase 2 เสร็จ — สามารถขนาน Phase 3/4 ได้
- **Phase 7 (US5)**: ต้องการ Phase 3+4 เสร็จเพื่อ health checks ครบถ้วน
- **Phase 8 (Polish)**: ต้องการทุก user story phase เสร็จ

### User Story Dependencies

- **US1 (P1)**: Phase 2 เสร็จ; ไม่ขึ้นกับ US2/US3/US4/US5
- **US2 (P2)**: Phase 2 เสร็จ; ไม่ขึ้นกับ US1/US3/US4/US5
- **US3 (P3)**: US2 (Phase 4) เสร็จ + US1 hermes-bot integration บางส่วน
- **US4 (P4)**: Phase 2 เสร็จ; ไม่ขึ้นกับ US1/US2/US3
- **US5 (P5)**: US1+US2 เสร็จสำหรับ health checks; สามารถเริ่ม stage-gate docs ขนานได้ตั้งแต่ Phase 1

### Within Each User Story

- Utilities/Guards (T008-T015) ก่อน feature implementation
- Service → Controller → Module ordering
- Unit tests [P] สามารถเขียนขนานกับ implementation ที่ไม่มี circular dependency

---

## Parallel Execution Examples

### Phase 2 (Foundational — parallel within phase):

```bash
# รันพร้อมกัน:
T008: uuid.util.ts
T009: secret-redactor.util.ts
T010: api-key.guard.ts
T011: transaction.interceptor.ts
T014: health.controller.ts
T015: secret-redactor.spec.ts
```

### Phase 3 US1 (parallel foundations before orchestrator):

```bash
# รันพร้อมกัน:
T016: dev-qdrant.service.ts
T017: context-loader.service.ts
T018: sub-agent.service.ts
# รอ T016-T018 เสร็จ → T019, T020
# รอ T019-T020 เสร็จ → T021, T022
```

### Phase 4+6 (US2 และ US4 ขนานกับ US1):

```bash
# ขณะที่ทีม A ทำ US1 (Phase 3):
# ทีม B ทำ US2 (Phase 4): T025, T026 ก่อน → T027 → T028, T029
# ทีม C ทำ US4 (Phase 6): T037, T038, T039 ขนานกัน
```

---

## Implementation Strategy

### MVP First (US1 Only — Autonomous Dev Orchestrator)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 — Autonomous Dev Orchestrator
4. **STOP + VALIDATE**: ส่ง coding task → ตรวจสอบ PR created in Gitea
5. Demo to developer team

### Incremental Delivery

1. Setup + Foundational → Foundation ready (Stage 1 acceptance gate ✅)
2. Add US1 → Autonomous coding loop (MVP) → demo
3. Add US2 → Telegram read-only DevOps (Stage 3 acceptance gate ✅)
4. Add US3 → Write-with-confirmation (Stage 4 acceptance gate ✅)
5. Add US4 → Developer AI Proxy (Stage 5 acceptance gate ✅)
6. Add US5 → Full monitoring + staged rollout docs complete

### Staged Rollout Alignment

| Deployment Stage | Prerequisite Tasks |
|------------------|--------------------|
| Stage 0 (Docs) | T001–T007 (Setup) |
| Stage 1 (LAN container) | T008–T015 (Foundational) + T042, T045 |
| Stage 2 (Read-only DB/Gitea) | T025 (Gitea read-only) |
| Stage 3 (Telegram read-only) | T026–T032 (US2 complete) |
| Stage 4 (Write-with-confirmation) | T033–T036 (US3 complete) |
| Stage 5 (Proxy) | T037–T041 (US4 complete) |

---

## Notes

- [P] tasks = different files, no dependency conflicts — safe to parallelize
- hermes-bot Gitea token ต้องสร้างก่อน T033/T035
- Telegram bot token ต้องสร้างก่อน T027
- ห้าม commit secret จริงใน `.env.example` หรือ compose files — placeholder only
- ทุก TypeScript file ต้องขึ้นต้นด้วย `// File: hermes/src/...` ตาม AGENTS.md
- ห้ามใช้ DMS production Redis, DMS Qdrant, DMS `audit_logs` ทุกกรณี
- ADR-031 Stage gate ต้องผ่านก่อน deploy stage ถัดไป — ห้าม skip
