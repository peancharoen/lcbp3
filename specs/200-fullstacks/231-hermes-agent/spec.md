// File: specs/200-fullstacks/231-hermes-agent/spec.md
// Change Log:
// - 2026-05-29: Initial specification derived from ADR-031 v2.0

# Feature Specification: Hermes Agent — Autonomous Dev Orchestrator & Telegram DevOps Bridge

**Feature Branch**: `231-hermes-agent`
**Created**: 2026-05-29
**Status**: Draft
**Category**: 200-fullstacks
**Input**: ADR-031 v2.0 (specs/06-Decision-Records/ADR-031-hermes-agent-telegram-devops-bridge.md)

## Overview

Hermes Agent เป็น Autonomous Development Loop Orchestrator และ Telegram DevOps Bridge ที่รันบน ASUSTOR NAS แบบ always-on โดยทำหน้าที่ 2 roles หลัก:

1. **Autonomous Dev Orchestrator** (primary) — รับ coding task จาก Developer ผ่าน Telegram/CLI, โหลด context, วางแผน, จ่ายงานให้ sub-agents (Cloud AI), รัน self-correction loop (lint/tsc/test), และสร้าง PR ใน Gitea สำหรับ human review
2. **Telegram DevOps Bridge** (subsystem) — รับ DevOps commands ผ่าน Telegram bot สำหรับ read-only queries (CI status, repo summary) และ write-with-confirmation actions (create branch/issue/PR/trigger CI)

Hermes **ไม่ใช่** production DMS service, ไม่ใช่ DMS AI inference boundary, และไม่แตะ production DMS schema ทุกกรณี

---

## Clarifications

### Session 2026-05-29

Ambiguity scan ran across all 10 taxonomy categories. All categories scored **Clear** — ADR-031 v2.0 Locked Decisions (grill-with-docs 2026-05-29) pre-resolve every design choice that would otherwise require clarification:

- Q: Cloud AI scope (which AI services allowed for Hermes?) → A: Claude/GPT-4o for orchestration + Haiku/GPT-4o-mini for sub-agents; DMS document processing remains ADR-023A Ollama-only (Cloud AI Exception, ADR-031 v2.0 Locked)
- Q: Dev Qdrant isolation (shared with DMS Qdrant?) → A: Separate instance on ASUSTOR port 6334, collection `lcbp3_code_chunks` indexed by `repoName`+`moduleName` — never shared with DMS Qdrant port 6333 (ADR-031 v2.0 Locked)
- Q: SOUL.md persistence (repo vs. container?) → A: Container volume only (`/volume1/docker/hermes/SOUL.md`), never synced to repo, rotated every 30 days (ADR-031 v2.0 Locked)
- Q: hermes proxy port (conflict with PaddleOCR?) → A: Port 8766 for hermes proxy; port 8765 is reserved for PaddleOCR sidecar per ADR-023A (ADR-031 v1.1.1 fix)
- Q: hermes_operations_log location (DMS audit_logs?) → A: Hermes-owned store only (SQLite/Postgres volume or structured log), never writes to DMS `audit_logs` (ADR-031 v2.0 Locked)

**Coverage Summary**: Functional Scope ✅ | Domain & Data Model ✅ | Interaction & UX ✅ | Non-Functional ✅ | Integration ✅ | Edge Cases ✅ | Constraints ✅ | Terminology ✅ | Completion Signals ✅

No questions asked. Proceeding directly to `/speckit-plan`.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Autonomous Coding Task Orchestration (Priority: P1)

Developer ส่ง coding task เช่น "scaffold NestJS module for X" ผ่าน Telegram หรือ CLI แล้ว Hermes โหลด project context, วางแผน, แตกงาน, delegate ไปยัง sub-agents, รัน lint/tsc/test self-correction loop, และสร้าง PR ใน Gitea branch `hermes/feat-*` สำหรับ Developer review/approve

**Why this priority**: เป็น core value ของ Hermes — ช่วยให้ Developer สั่งงาน coding จากที่ไหนก็ได้โดยไม่ต้องเปิด IDE และได้รับ PR ที่พร้อม review ภายในเวลาอันสั้น

**Independent Test**: Developer ส่ง Telegram message "scaffold NestJS module for repository diagnostics" → Hermes ส่งกลับ PR link ใน Gitea branch `hermes/feat-*` ที่ผ่าน lint/tsc

**Acceptance Scenarios**:

1. **Given** Developer อยู่ใน Telegram allowlist, **When** ส่ง coding task, **Then** Hermes โหลด context ที่เหมาะกับ task type (selective loading), วางแผน, delegate sub-agent, รัน lint/tsc/test
2. **Given** sub-agent ส่งโค้ดที่ lint ล้มเหลว, **When** Hermes รัน self-correction, **Then** ส่งกลับไปให้ sub-agent แก้ไขสูงสุด 3 iterations ก่อนหยุดและแจ้ง Developer
3. **Given** โค้ดผ่าน lint/tsc/test ทุก check, **When** Hermes push, **Then** commit ลง `hermes/feat-{task-id}` branch โดย `hermes-bot` service account แล้วสร้าง PR พร้อม assign to Developer
4. **Given** Hermes ต้องการ code patterns จาก codebase, **When** ค้นหา, **Then** ใช้ Dev Qdrant (ASUSTOR) ที่แยกจาก DMS Qdrant เท่านั้น
5. **Given** task เสร็จสิ้น, **When** Hermes บันทึก session, **Then** เขียนลง SOUL.md ภายใน container เท่านั้น (ไม่ sync ลง repo)

---

### User Story 2 — Telegram Read-only DevOps Commands (Priority: P2)

DevOps engineer/Developer ส่ง read-only commands ผ่าน Telegram เช่น `/ci_status`, `/repo_summary`, `/status`, `/audit_summary` และรับผลลัพธ์กลับมาทันทีโดยไม่มีผลข้างเคียงต่อระบบ

**Why this priority**: ช่วยให้ทีมตรวจสอบสถานะ CI/repo จากมือถือโดยไม่ต้องเปิด Gitea UI — ลด context switching และเพิ่ม DevOps visibility

**Independent Test**: ส่ง `/ci_status` ใน Telegram → รับสถานะ CI ล่าสุดจาก Gitea กลับมาภายใน 10 วินาที พร้อม reference transactionId

**Acceptance Scenarios**:

1. **Given** Telegram user อยู่ใน allowlist, **When** ส่ง `/ci_status`, **Then** Hermes ดึงสถานะ CI ล่าสุดจาก Gitea แล้วตอบกลับพร้อม `[Ref: {transactionId}]`
2. **Given** Telegram user ไม่อยู่ใน allowlist, **When** ส่ง command ใดก็ตาม, **Then** Hermes ปฏิเสธ request และไม่ดำเนินการใดๆ
3. **Given** Telegram webhook request เข้ามา, **When** ตรวจสอบ `X-Telegram-Bot-Api-Secret-Token` ไม่ตรง, **Then** reject request ทันที
4. **Given** Telegram user ส่ง request เกิน rate limit (>10 ต่อนาที), **When** Hermes ตรวจสอบ Redis counter, **Then** ปฏิเสธ request และแจ้ง user
5. **Given** command ทุกประเภท, **When** รับ/ส่งข้อมูล, **Then** บันทึก inbound/outbound ใน `hermes_operations_log` พร้อม transactionId ทันที

---

### User Story 3 — Telegram Write-with-Confirmation DevOps Actions (Priority: P3)

DevOps engineer ส่ง action commands ผ่าน Telegram เช่น "เตรียม branch/PR proposal สำหรับ fix/ci-pnpm-cache" — Hermes ขอ explicit confirmation ก่อนดำเนินการ และบันทึก transactionId ทุกขั้นตอน

**Why this priority**: ช่วยให้ทีมสั่งงาน DevOps actions จากมือถือได้อย่างปลอดภัยด้วย human confirmation gate ป้องกัน accidental changes

**Independent Test**: ส่ง "สร้าง branch proposal สำหรับ fix/ci-cache" → Hermes แสดง summary + ขอ confirmation → ยืนยัน → Hermes สร้าง branch ใน Gitea + บันทึก hermes_operations_log + แจ้ง PR created

**Acceptance Scenarios**:

1. **Given** Developer ส่ง write action command, **When** Hermes รับ, **Then** แสดง action summary และขอ explicit confirmation ก่อนดำเนินการ
2. **Given** Developer ยืนยัน action, **When** Hermes ดำเนิน, **Then** ใช้ Gitea write token ที่แยกและมี scope แคบ (ไม่ใช่ admin token) สำหรับ create branch/issue/PR/trigger CI เท่านั้น
3. **Given** action สำเร็จหรือล้มเหลว, **When** สิ้นสุด, **Then** บันทึก `transactionId`, token identity, target repo/branch, และผลลัพธ์ใน `hermes_operations_log`
4. **Given** command ที่เป็น forbidden action (push main/develop, production deploy, schema migration, destructive ops, direct DB write), **When** รับ command ดังกล่าว, **Then** Hermes ปฏิเสธทุกกรณี ไม่ว่าจะผ่าน confirmation หรือไม่
5. **Given** Developer ยืนยัน create branch, **When** สร้างสำเร็จ, **Then** branch pattern ต้องเป็น `hermes/feat-*`, `hermes/fix-*`, หรือ `hermes/refactor-*` เท่านั้น

---

### User Story 4 — Developer AI Proxy (hermes proxy) (Priority: P4)

Developer บน laptop ใช้ Codex CLI หรือ agy โดยชี้ `OPENAI_BASE_URL` ไปยัง `hermes proxy` (port 8766 บน ASUSTOR) เพื่อใช้ Hermes เป็น Developer AI Proxy สำหรับ coding/devops assistance เท่านั้น

**Why this priority**: ช่วยให้ CLI tools บน laptop (Codex, agy via MCP) เชื่อมกับ Hermes context บน ASUSTOR ได้ โดยใช้ infrastructure ที่มีอยู่แล้ว

**Independent Test**: บน Windows PowerShell ตั้ง `$env:OPENAI_BASE_URL = "http://<ASUSTOR_IP>:8766/v1"` → รัน `codex "scaffold NestJS module"` → ได้รับ response ที่มี DMS context

**Acceptance Scenarios**:

1. **Given** Developer ตั้ง OPENAI_BASE_URL ชี้ไป hermes proxy, **When** ส่ง coding/devops request, **Then** hermes proxy รับและ forward ไป Cloud AI พร้อม DMS context
2. **Given** proxy รับ payload ที่คล้าย production document content, secret, token, password, หรือ storage path, **When** ตรวจพบ, **Then** ถือเป็น security incident, redact log ทันที, และ reject request
3. **Given** hermes proxy ใช้ port 8766, **When** deploy, **Then** ต้องไม่ conflict กับ PaddleOCR sidecar (port 8765) ตาม ADR-023A
4. **Given** hermes proxy รับ request ใดก็ตาม, **When** ประมวลผล, **Then** expose เฉพาะ LAN/VPN เท่านั้น ห้ามเปิด public internet
5. **Given** Developer ใช้ agy กับ Hermes MCP, **When** เรียก `mcp_hermes-memory_recall`, **Then** Hermes ส่ง DMS context กลับมาโดยไม่มี production document payload หรือ DB query results

---

### User Story 5 — Staged Rollout & Health Monitoring (Priority: P5)

Admin deploy Hermes ผ่าน staged rollout (Stage 0-5) โดยแต่ละ stage มี acceptance gate ที่ต้องผ่านก่อนขึ้น stage ถัดไป และมี monitoring ที่แยก Hermes health ออกจาก DMS production health

**Why this priority**: รับประกันว่า Hermes ถูก deploy อย่างปลอดภัยแบบ incremental และการล่มของ Hermes ไม่ส่งผลกระทบต่อ DMS production ทุกกรณี

**Independent Test**: ปิด Hermes container แล้วตรวจสอบว่า DMS frontend/backend/Workflow Engine/AI pipeline ยังทำงานปกติ 100%

**Acceptance Scenarios**:

1. **Given** Admin ต้องการ deploy Hermes, **When** เริ่ม Stage 1, **Then** Hermes container รันแบบ LAN/VPN-only ด้วย Redis/log store แยกจาก DMS production Redis
2. **Given** Stage acceptance gate ยังไม่ผ่าน, **When** Admin พยายาม deploy Stage ถัดไป, **Then** ระบบหรือ process บล็อกไว้จน gate ผ่าน
3. **Given** Hermes container ล่ม, **When** ตรวจสอบ DMS production, **Then** DMS frontend/backend/Workflow Engine/AI pipeline ทำงานตามปกติ 100% (failure isolation)
4. **Given** Hermes down หรือ Telegram Bridge down, **When** Monitoring แจ้งเตือน, **Then** alert เป็น DevOps warning ไม่ใช่ production DMS outage alert
5. **Given** resource limits กำหนดไว้ใน Docker Compose (CPU 2.0, RAM 4GB limit / 2GB reservation), **When** deploy บน ASUSTOR, **Then** verified ด้วย `docker inspect` และ `docker stats` ว่า runtime enforce จริง

---

### Edge Cases

- Hermes sub-agent ล้มเหลวหลัง 3 iterations — หยุดงานและแจ้ง Developer ผ่าน Telegram พร้อม error detail; ไม่สร้าง PR ที่มีโค้ดผิด
- SOUL.md ขนาดใหญ่เกินไปหลัง 30 วัน — Rotate/clear ตาม schedule; Hermes resume context จาก SOUL.md ต้น session
- hermes-bot ถูก revoke token — ทุก write action ล้มเหลว gracefully พร้อมแจ้ง Developer; read-only commands ยังใช้ token แยกได้
- ASUSTOR restart — Hermes Redis (AOF persistence) recover queue jobs; SOUL.md อยู่ใน container volume ปลอดภัย
- Telegram API ล่ม — BullMQ retry 3 ครั้งด้วย exponential backoff ก่อน dead-letter
- Developer ส่ง secret/token จริงผ่าน Telegram command — Hermes redact ออกจาก log ทันที ไม่ forward ไป Cloud AI
- Dev Qdrant (ASUSTOR) ล่ม — Hermes fallback ไป context-only mode (ไม่มี semantic search) โดย DMS Qdrant ไม่ถูกแตะ
- hermes proxy รับ production document payload — Security incident: redact, reject, alert
- inter-VLAN routing ยังไม่เปิด (ASUSTOR → QNAP) — Stage 2+ ไม่สามารถ deploy ได้; Hermes แสดง error ชัดเจนว่า network path blocked
- hermes-bot พยายาม push ตรง main/develop — Git server-side branch protection block ทุกกรณี

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hermes MUST run as an isolated Docker container on ASUSTOR NAS (CPU ≤ 2 cores, RAM ≤ 4GB) within LAN/VPN boundary เท่านั้น
- **FR-002**: Hermes MUST implement Autonomous Dev Orchestration loop: load selective context → plan → delegate to Cloud sub-agents → self-correction (lint/tsc/test, max 3 iterations) → commit via hermes-bot → create PR
- **FR-003**: Hermes MUST use Cloud AI (Claude/GPT-4o for orchestration, Claude Haiku/GPT-4o-mini for sub-agents) เฉพาะ dev orchestration layer — ไม่ใช่ DMS document processing
- **FR-004**: Data Classification Policy MUST be enforced: Code/Config/ADR/Stack trace ส่ง Cloud AI ได้ — Production runtime data (document content, user info, project business data จาก DB) ห้ามส่งออกทุกกรณี
- **FR-005**: Hermes MUST maintain a separate Dev Qdrant instance on ASUSTOR (collection: `lcbp3_code_chunks`, indexed by `repoName`+`moduleName`) ห้ามใช้ DMS Qdrant instance
- **FR-006**: Hermes MUST maintain SOUL.md working journal ภายใน container volume เท่านั้น (ไม่ sync ลง repo, rotate ทุก 30 วัน)
- **FR-007**: Hermes MUST load selective context ตาม task type: DevOps → CONTEXT-ADR-031+AGENTS.md; DMS feature → +CONTEXT.md; Schema/DB → +schema SQL; Bug fix → +Dev Qdrant
- **FR-008**: Hermes MUST enforce Git Identity rules: ใช้ `hermes-bot` service account, push เฉพาะ `hermes/*` branches, ห้าม push main/develop/release ทุกกรณี, ทุก change ต้องผ่าน PR ที่ human approve
- **FR-009**: Hermes Telegram MUST verify `X-Telegram-Bot-Api-Secret-Token` ทุก webhook request
- **FR-010**: Hermes Telegram MUST enforce allowlist (`HERMES_TELEGRAM_ALLOWED_USER_IDS`) สำหรับ DevOps commands ทุกระดับ
- **FR-011**: Hermes Telegram MUST apply Redis-based rate limiting (default: 10 requests/minute/user)
- **FR-012**: Hermes MUST queue all outbound Telegram notifications ผ่าน BullMQ queue `hermes-notification-queue` พร้อม retry 3 ครั้ง exponential backoff
- **FR-013**: Hermes MUST record every inbound/outbound operation ใน `hermes_operations_log` ด้วย transactionId (UUIDv7), operator identity, command type, target system, status, timestamps — ห้ามเขียนลง DMS `audit_logs`
- **FR-014**: Hermes operations log MUST redact command payload ที่อาจมี secret, token, sensitive file path, หรือ production document content
- **FR-015**: Hermes MUST implement 6-stage gated rollout (Stage 0–5) โดยห้ามข้ามไปยัง stage ที่สูงกว่าโดยยังไม่ผ่าน acceptance gate
- **FR-016**: Hermes failure MUST NOT affect DMS production: frontend, backend, Workflow Engine, AI pipeline, and user-facing app ต้องทำงานตามปกติเมื่อ Hermes ล่ม
- **FR-017**: Hermes MUST NOT add or modify any DMS production schema (no SQL delta, no migration, no `user_telegram_mapping` creation)
- **FR-018**: `hermes proxy` MUST expose OpenAI-compatible API (port 8766) สำหรับ Developer AI Proxy เท่านั้น (ห้ามใช้ port 8765 ที่ PaddleOCR sidecar ใช้อยู่)
- **FR-019**: Hermes MUST use separate Redis instance/volume จาก DMS production Redis; queue names ต้องขึ้นต้นด้วย `hermes-`
- **FR-020**: All secrets (Telegram bot token, webhook secret, Gitea token, DB credential, proxy API key) MUST be stored ภายนอก repo ใน ASUSTOR secret store พร้อม rotation plan

### Key Entities

- **HermesAgent**: Docker container orchestrator รันบน ASUSTOR ควบคุม Development Loop ทั้งหมด
- **HermesTelegramGateway**: รับ inbound Telegram webhook, ตรวจสอบ allowlist + webhook secret + rate limit, forward ไปยัง DevOps Command Router
- **HermesTelegramDispatcher**: BullMQ Worker ดึงงานจาก `hermes-notification-queue` เพื่อส่ง outbound Telegram message พร้อม transactionId reference
- **HermesDevOpsCommandRouter**: Route และ execute DevOps commands ตาม permission tier (read-only / write-with-confirmation / forbidden)
- **HermesOperationsLog**: Hermes-owned log store (SQLite หรือ structured log) บันทึก inbound/outbound DevOps operations พร้อม transactionId และ redacted payload
- **HermesSubAgent**: Cloud AI delegate (Claude Haiku / GPT-4o-mini) รับ code generation task จาก Orchestrator และส่ง code diff กลับ
- **SOUL.md**: Container-local working journal บันทึก per-session task context, delegated sub-agents, iterations, PR results
- **DevQdrant**: Qdrant instance บน ASUSTOR (port 6334) สำหรับ codebase embeddings เท่านั้น — collection `lcbp3_code_chunks`
- **HermesProxy**: OpenAI-compatible API proxy (port 8766) สำหรับ Codex CLI / agy MCP integration

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Developer สามารถรับ PR link จาก Hermes ภายใน 30 นาที สำหรับ typical feature scaffolding task (เมื่อ sub-agent ผ่าน lint/tsc ใน iteration แรก)
- **SC-002**: Self-correction loop แก้ lint/tsc/test failures ได้ภายใน 3 iterations ≥ 80% ของกรณีก่อนที่จะ escalate ไป Developer
- **SC-003**: Telegram read-only commands (`/ci_status`, `/repo_summary`, `/status`) ตอบกลับภายใน 10 วินาที ≥ 95% ของ requests
- **SC-004**: DMS production availability (frontend/backend/Workflow Engine) ไม่ได้รับผลกระทบเมื่อ Hermes container ล่ม (0% downtime attributable to Hermes)
- **SC-005**: 100% ของ Telegram requests จาก non-allowlisted users ถูก reject โดยไม่มีการดำเนินการใดๆ
- **SC-006**: 100% ของ DevOps write actions มี transactionId บันทึกใน `hermes_operations_log` ก่อนดำเนิน action
- **SC-007**: All 6 rollout stage acceptance gates ผ่าน verification ก่อน advance ไปยัง stage ถัดไป ไม่มีกรณี skip gate
- **SC-008**: ไม่พบ production document content, DB query results, secrets, หรือ storage paths ใน Cloud AI request payloads (verified จาก proxy request logs)
- **SC-009**: hermes-bot ไม่มี push access ไปยัง `main`, `develop`, หรือ `release/*` branches (verified โดย Gitea branch protection + token scope test)
- **SC-010**: `hermes_operations_log` redacts ทุก payload ที่ตรวจพบ secret/token/sensitive-path ก่อนบันทึก (verified โดย secret scan ของ log output)

---

## Assumptions

- ADR-031 v2.0 Locked Decisions ทั้งหมดใช้บังคับและไม่อยู่ในขอบเขตที่เปลี่ยนได้โดย spec นี้
- Cloud AI exception (Claude/GPT-4o) สำหรับ Hermes dev orchestration layer ได้รับการอนุมัติแล้วใน ADR-031 v2.0
- ASUSTOR NAS มี Docker รองรับ resource limits (cpus/mem_limit); verified ด้วย `docker inspect`/`docker stats` ตาม ADR note
- Gitea `hermes-bot` service account และ Telegram bot ต้องถูกสร้างแยกต่างหากก่อน Stage 1/3
- inter-VLAN routing จาก ASUSTOR ไปยัง QNAP (MariaDB :3306, Gitea :3000) ต้องเปิดก่อน Stage 2
- DMS production Qdrant (ADR-023A, port 6333) และ Dev Qdrant (Hermes, port 6334) เป็นคนละ instance

## Out of Scope

- Production DMS Telegram commands (query/mutate documents, Workflow Engine actions) — ต้องเป็น ADR/spec แยก
- `user_telegram_mapping` table สำหรับ DMS — ห้ามสร้างใน ADR-031 rollout
- DMS production schema changes ทุกกรณี
- Direct integration ระหว่าง Hermes และ DMS BullMQ/Redis/Qdrant/Ollama
- Hermes เป็น DMS AI runtime path (ใช้ DMS Ollama pipeline ตาม ADR-023/023A)
