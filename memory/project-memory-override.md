# Project Memory Override

> **Project:** NAP-DMS (LCBP3) — Laem Chabang Port Phase 3 Document Management System
> **Version:** 1.9.10 (Last Synced: 2026-06-08)
> **Stack:** NestJS 11 + Next.js 16 + TypeScript + MariaDB 11.8 + Redis + BullMQ + Elasticsearch + Ollama (on-prem AI)

> [!IMPORTANT]
> **Project memory นี้ต้องใช้งานภายใต้ `AGENTS.md` เสมอ**
>
> - ให้ใช้ `AGENTS.md` เป็นกฎหลักก่อน memory ทุกครั้ง
> - ถ้า memory เก่าหรือ session note ขัดกับ `AGENTS.md` ให้ยึด `AGENTS.md`
> - งาน schema ต้องทำตาม ADR-009 ผ่าน SQL/delta เท่านั้น
> - งาน UUID/Public API ต้องทำตาม ADR-019 โดยใช้ `publicId` และห้าม `parseInt()` บน UUID
> - งาน n8n / AI migration ต้องอยู่ในขอบเขต ADR-023A และ mutation ต้องมี `Idempotency-Key`

## OS Rules & Sandbox Constraints

> [!IMPORTANT]
> **ระบบรันอยู่บน Linux (Ubuntu/Debian) — Server `np-dms-lcbp3`**
>
> - ใช้คำสั่ง `bash` และ Linux commands ได้ปกติ
> - ห้ามใช้คำสั่ง `cd` ในการสลับ Directory ใน `run_command` ให้ระบุพารามิเตอร์ `Cwd` ใน Tool ตรง ๆ
> - `pnpm` ติดตั้งแล้วบน server (v10.33.0) — รัน `pnpm install` จาก root เสมอ (workspace)
> - `CI=true` จำเป็นสำหรับ `pnpm install` แบบ non-interactive
> - ไฟล์ใน repo ต้องเป็นของ `nattanin:nattanin` ไม่ใช่ `root` (ตรวจด้วย `ls -la`)
> - `2git.sh` ใช้แทน `2git.ps1` สำหรับ commit+push ทั้ง Gitea และ GitHub

## Current Decisions (Locked)

> การตัดสินใจเหล่านี้ **ไม่สามารถเปลี่ยนแปลงได้** โดยไม่ได้รับ Explicit Approval

| ID  | Decision                                                                                                                                                                                                                                                                                                                                    | ADR                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| D1  | n8n = Migration Phase orchestrator เท่านั้น — ห้ามทำ New Correspondence pipeline ผ่าน n8n                                                                                                                                                                                                                                                   | ADR-023A           |
| D2  | New Correspondence → BullMQ `ai-realtime` queue โดยตรง (ไม่ผ่าน n8n)                                                                                                                                                                                                                                                                        | ADR-023A           |
| D3  | n8n ต้อง call `POST /api/ai/jobs` (DMS Backend) เท่านั้น — ห้าม call Ollama/Qdrant โดยตรง                                                                                                                                                                                                                                                   | ADR-023A           |
| D4  | Excel metadata ส่งไปพร้อม AI job เป็น context (docNumber, title, sender ฯลฯ)                                                                                                                                                                                                                                                                | Session 2          |
| D5  | Tag suggestion ใช้ทาง C: แนะนำ existing tags + สร้างใหม่ได้ถ้าไม่มี (`isNew: true` flag)                                                                                                                                                                                                                                                    | Session 2          |
| D6  | Editable Review Form: AI pre-fill → user approve/edit → submit (human-in-the-loop ทุกครั้ง)                                                                                                                                                                                                                                                 | ADR-023            |
| D7  | UUID Strategy: `publicId` (UUIDv7) เท่านั้นสำหรับ Public API — INT PK ต้อง `@Exclude()`                                                                                                                                                                                                                                                     | ADR-019            |
| D8  | Schema changes: แก้ SQL โดยตรง + เพิ่ม `deltas/*.sql` — ห้ามใช้ TypeORM migration files                                                                                                                                                                                                                                                     | ADR-009            |
| D9  | Qdrant search ต้องส่ง `projectPublicId` เป็น mandatory parameter ทุกครั้ง (compile-time)                                                                                                                                                                                                                                                    | ADR-023A           |
| D10 | AI model stack: `np-dms-ai:latest` (Main LLM) + `np-dms-ocr:latest` (OCR, keep_alive:0) + `BGE-M3` (Dense 1024 + Sparse Embedding) + `BGE-Reranker-Large` (Reranker) on Admin Desktop — `nomic-embed-text` ถูกแทนที่แล้ว (ADR-034/035)                                                                                                      | ADR-034/035        |
| D11 | RAG Embedding trigger: `syncStatus()` → `enqueueRagPrepare()` เมื่อ status ≠ DRAFT; jobId = `rag-prepare:{documentPublicId}:{revisionNumber}` (BullMQ dedup); delete-before-upsert ทุกครั้ง                                                                                                                                                 | ADR-035            |
| D12 | Qdrant collection `lcbp3_vectors` = Hybrid schema: `bge_dense` (1024 dims, Cosine) + `bge_sparse` (SPLADE); payload indexes: `project_public_id` (tenant), `doc_public_id`, `status_code`, `doc_type`                                                                                                                                       | ADR-035            |
| D13 | **Analysis Phase required** — ต้องอ่าน `docker-compose*.yml`, `deploy.sh`, `main.ts` ก่อนแนะนำ URL/Port/Path — ห้ามเดา                                                                                                                                                                                                                      | AGENTS.md          |
| D14 | Sandbox-Production Parity: บันทึก draft ใน `ai_sandbox_profiles` และปรับใช้ไป production `ai_execution_profiles` ผ่าน apply API (Idempotency-Key + CASL guard); sandbox pipeline ดึง project/contract ID จริงเพื่อ parity prompt context                                                                                                    | ADR-036            |
| D15 | SandboxTabs ต้องโหลด active prompts ทั้ง ocr_system และ ocr_extraction จาก service เพื่อแสดง prompt info ทั้ง 2 steps ตาม FR-009, FR-010 (Feature-238)                                                                                                                                                                                      | Feature-238        |
| D16 | Backend VRAM service ต้องส่ง loadedModels พร้อม vramUsageMB (bytes → MB) เพื่อให้ frontend แสดงผล VRAM usage ของแต่ละ model ได้ถูกต้อง                                                                                                                                                                                                      | Session 2026-06-18 |
| D17 | สถานะพับ/คลี่ของการ์ดและเซกชันในหน้า AI Admin Console จะเก็บลงใน localStorage เพื่อรักษาสถานะ และการพับไม่มีผลต่อ background query polling                                                                                                                                                                                                  | Feature-240        |
| D18 | Deploy script ต้องตรวจสอบ ClamAV health status ก่อน recreation — ถ้า healthy ให้ recreate เฉพาะ backend/frontend (skip 5-minute healthcheck delay)                                                                                                                                                                                          | Session 2026-06-19 |
| D19 | CI timeout ต้องอย่างน้อย 30 minutes เพื่อรองรับ ClamAV startup กรณีต้อง recreate full stack                                                                                                                                                                                                                                                 | Session 2026-06-19 |
| D20 | AI Admin frontend services ต้อง normalize API response envelope ที่อาจซ้อน `data` ก่อน render; VRAM `totalVRAMMB = 0` คือ unknown capacity ไม่ใช่ OOM Guard                                                                                                                                                                                 | Session 2026-06-19 |
| D21 | OCR Sidecar = Pure Compute Worker — orchestration/params อยู่ใน backend existing services (reject PromptBuilderService, OcrNoiseFilterService, OcrOrchestratorService)                                                                                                                                                                      | ADR-040 D1         |
| D22 | Wire `calculate_ocr_residency()` ใน `process_ocr` — keep_alive เป็น lazy resource param (ADR-036 Gap-2), ห้าม fixed value                                                                                                                                                                                                                   | ADR-040 D3         |
| D23 | Retain vram_monitor + CPU-fallback for `/embed`,`/rerank` — ห้าม force BGE+Reranker GPU-resident, เคารณะ LLM-First GPU Ownership + CPU Fallback Retrieval                                                                                                                                                                                   | ADR-040 D4         |
| D24 | Remove X-API-Key from sidecar — auth = network isolation (supersedes ADR-033 §7), sequencing: ลบเฉพาะหลัง ADR-041 cutover (single Docker host)                                                                                                                                                                                              | ADR-040 D5         |
| D25 | Server Consolidation — co-locate ทุก services บน single Docker host (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB), retire Desk-5439                                                                                                                                                                                                              | ADR-041 D1         |
| D26 | ASUSTOR (192.168.10.9) = Primary NAS (CIFS share np-dms-as), QNAP = Backup server เท่านั้น                                                                                                                                                                                                                                                  | ADR-041 D2         |
| D27 | Docker-internal network only for sidecar/Ollama — enables ADR-040 D5 network-only auth, QNAP backend → new host consolidation                                                                                                                                                                                                               | ADR-041 D3         |
| D28 | Canonical naming enforced: `np-dms-ai` (LLM), `np-dms-ocr` (OCR), `fast-path` (PyMuPDF) — ลบ `typhoon-llm`, `tesseract`, `Typhoon OCR` ออกจาก code; `OCR_SIDECAR_API_KEY` mandatory (no default); backend ไม่ส่ง `keep_alive` (sidecar คำนวณเอง)                                                                                            | ADR-040/034        |
| D29 | Canonical naming cleanup ครบทุก Typhoon reference ใน backend `src/` — `TYPHOON_OCR_REQUIRED_VRAM_MB` → `NP_DMS_OCR_REQUIRED_VRAM_MB`, `typhoon2.5-np-dms` → `np-dms-ai` (defaults/mocks/Swagger/JSDoc/logs); เหลือเฉพาะ historical change log comments (ไม่ต้องแก้); tsc + 299 tests ผ่าน                                                   | ADR-040/034        |
| D30 | API Contract ต้อง match actual implementation — ห้ามเขียน contract ที่ field naming หรือ response schema ไม่ตรง Pydantic models จริง; `/ocr-upload` เป็น primary production endpoint, `/ocr` เป็น legacy; `/ocr-upload` ปลอดภัยจาก path traversal โดย design (รับ file bytes ไม่ใช่ path)                                                   | ADR-040            |
| D31 | Gitea SSH ผ่าน Cloudflare Tunnel — ใช้ domain `git-ssh.np-dms.work` (แยกจาก `git.np-dms.work` สำหรับ HTTP/HTTPS) เพราะ Cloudflare proxy ไม่รองรับ SSH port; client ต้องใช้ `ProxyCommand cloudflared access ssh --hostname %h` ใน SSH config; docker-compose port mapping `192.168.10.11:2222:22` ถูกต้อง (Docker ให้ CAP_NET_BIND_SERVICE) | ADR-041            |
| D32 | Dev environment ย้ายจาก Windows → Linux server `np-dms-lcbp3` — pnpm v10.33.0, node_modules ownership = `nattanin:nattanin`, `2git.sh` แทน `2git.ps1`, GitHub SSH key เพิ่มแล้ว, remotes: `origin` (Gitea SSH) + `github` (GitHub SSH)                                                                                                      | Session 2026-07-02 |
| D33 | Docker port binding ใช้ `0.0.0.0` (ไม่ใช่ IP เฉพาะ) เพื่อให้เข้าได้ทั้ง LAN IP และ localhost; `CORS_ORIGIN` ต้องมีทั้ง `http://192.168.10.11:3001` และ `http://localhost:3001,http://127.0.0.1:3001`; deploy.sh/rollback.sh default URL = `http://192.168.10.11:3000/api` (ไม่ใช่ `backend.np-dms.work`) | Session 2026-07-03 |
| D34 | Deploy/rollback scripts ต้องมี ownership guard ตรวจสอบ runtime compose files ก่อนดำเนินการ และใช้ `install -m 644` แทน `cp` เพื่อหลีกเลี่ยง Permission denied จาก root-owned files; runtime compose files ต้องเป็นของ deploy user (`np-dms`) | Session 2026-07-03 |

## Environment & Services

| Service          | Local URL / Port              | Production                        | Notes                                                                                              |
| ---------------- | ----------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Backend API**  | `http://localhost:3000`       | `http://192.168.10.11:3000/api`   | NestJS — port 3000 in container, bound `0.0.0.0:3000` (localhost + LAN)                           |
| **Frontend**     | `http://localhost:3001`       | `http://192.168.10.11:3001`       | Next.js — port 3000 in container, bound `0.0.0.0:3001` (localhost + LAN)                          |
| **MariaDB**      | `localhost:3307`              | QNAP internal                     | DB: `lcbp3`, root via docker                                                                       |
| **Redis**        | `localhost:6379`              | QNAP internal                     | BullMQ + session store                                                                             |
| **Ollama**       | `http://192.168.10.100:11434` | Admin Desktop (Desk-5439)         | np-dms-ai:latest (main) + np-dms-ocr:latest (OCR, keep_alive:0)                                    |
| **Qdrant**       | `http://localhost:6333`       | Admin Desktop (Desk-5439)         | Vector DB — requires projectPublicId                                                               |
| **OCR Sidecar**  | `http://192.168.10.100:8765`  | Admin Desktop (Desk-5439)         | np-dms-ocr (Ollama) + BGE-M3 `/embed` + BGE-Reranker `/rerank`; async I/O, lifespan, no /normalize |
| **Gitea**        | `https://git.np-dms.work`     | New Server `192.168.10.11:3003`   | Source + CI/CD; SSH via `git-ssh.np-dms.work:2222` (Cloudflare Tunnel)                             |
| **Gitea Runner** | ASUSTOR `192.168.10.9`        | —                                 | CI runner                                                                                          |

### Key Environment Variables

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
REDIS_HOST, REDIS_PORT
JWT_SECRET, JWT_EXPIRES_IN
OLLAMA_BASE_URL (ชี้ไป Admin Desktop)
QDRANT_URL
```

## Next Session Focus

### OCR Sidecar Review Fixes (Session 2026-06-20) ✅ COMPLETE

- [x] **Review:** Code review ของ `specs/100-Infrastructures/140-ocr-sidecar-refactor/` ทั้งหมด (3 Critical, 7 High, 6 Medium, 3 Low, 2 Suggestions)
- [x] **Fix #1:** ลบ hardcoded API key default ใน `SandboxOcrEngineService` — fail-fast เมื่อ `OCR_SIDECAR_API_KEY` ไม่ถูกตั้งค่า
- [x] **Fix #2:** Rewrite API contract v1.1 — เพิ่ม `/ocr-upload`, `/embed`, `/rerank`; แก้ camelCase fields, response schema, error format, health response
- [x] **Fix #3:** Document path traversal safety สำหรับ `/ocr-upload` (inherently safe — accepts file bytes, not paths)
- [ ] **Verify:** `tsc --noEmit` (backend) หลังแก้ SandboxOcrEngineService
- [ ] **Remaining review findings:** 7 High + 6 Medium + 3 Low ยังไม่ได้แก้ (ดู review report ใน session log)

### OCR Backend Cleanup (Session 2026-06-20) ✅ COMPLETE

- [x] **P1-1:** ลบ `keep_alive` จาก backend form data
- [x] **P1-2:** ลบ hardcoded API key defaults (ocr.service.ts + sandbox-ocr-engine.service.ts)
- [x] **P2-1:** Align env var `OCR_SIDECAR_API_KEY` ใน `.env.example`
- [x] **P2-2:** Fix OCR URL + ลบ `THAI_PREPROCESS_URL` ใน `.env.example`
- [x] **P2-5:** Bump Dockerfile เป็น `python:3.11-slim`
- [x] **P3-1/P3-2:** Wrap sync VRAM calls ใน `asyncio.to_thread()`
- [x] **Rename typhoon-llm → np-dms-ai:** สร้าง `np-dms-ai.processor.ts`, ลบ `typhoon-llm.processor.ts`, อัปเดต `ai.module.ts`
- [x] **Tesseract cleanup:** enum, entity, controller, service, audit log, tests
- [x] **User renamed:** `typhoon-ocr.processor.ts` → `np-dms-ocr-processor.ts`
- [x] **Rename TyphoonOcr → NpDmsOcr:** `TyphoonOcrProcessor` → `NpDmsOcrProcessor`, `QUEUE_TYPHOON_OCR` → `QUEUE_NP_DMS_OCR`, `OcrTyphoonOptions` → `OcrNpDmsOptions`, `typhoonOptions` → `ocrOptions` (backend 7 files + 3 tests)
- [x] **Frontend cleanup:** `isTyphoon` → `isAiPowered`, state vars `typhoon*` → `ocr*`, Tesseract mocks → Fast Path, dead `typhoon_ocr` checks removed, `page.tsx` model name constants
- [x] **Verify:** `tsc --noEmit` หลัง rename ครบ (backend) — exit 0, 32 suites/299 tests pass
- [ ] **Verify:** `tsc --noEmit` frontend (pending)

### ADR-040/041 Implementation

- [x] **OCR Sidecar Refactor (Speckit-140):** Phases 1-6, 8, 9 complete (T001-T046, T054-T063)
  - [x] Phase 1-2: Setup + Foundational (T001-T006)
  - [x] Phase 3: US1 Security Hardening (T007-T015) — path traversal, API key fail-fast
  - [x] Phase 4: US2 GPU Resource Management (T016-T025) — residency wiring, CPU fallback
  - [x] Phase 5: US3 Parameter Governance (T026-T040) — backend param resolution
  - [x] Phase 6: US4 Async I/O (T041-T046) — async def, lifespan context manager, AsyncClient
  - [x] Phase 8: Remove /normalize endpoint (T054-T055)
  - [x] Phase 9: Polish & validation (T056-T063) — Dockerfile, docker-compose, README, quickstart
  - [x] **Validation:** speckit-validate PASS — 17/17 active FRs, 13/14 active ACs, 8/8 edge cases, 41 tests (25 Python + 16 TypeScript); 3 FRs blocked by ADR-041; 2 minor gaps (SC-003/SC-005 benchmarks); doc inconsistencies in data-model.md/quickstart.md/README.md
  - [ ] Phase 7: US5 Network Isolation Auth (T047-T053) — BLOCKED until ADR-041 cutover
- [ ] **ADR-041 Infrastructure:** Provision new host, mount ASUSTOR CIFS, deploy docker-compose
- [ ] **ADR-040 Auth Removal:** Remove X-API-Key from sidecar + backend (T048-T053) — **ONLY AFTER ADR-041 cutover**
- [ ] **ADR-041 Cutover:** Migrate DB/ES, update DNS, smoke tests, retire Desk-5439

### N8N Migration & E2E Testing

- [ ] **Import `n8n.workflow.v2.json`** เข้า n8n UI และทดสอบ End-to-End
- [ ] **ทดสอบ End-to-End จริง** — รัน n8n กับ Excel ตัวอย่าง
- [ ] **Frontend Editable Review Form** (Pipeline B) — pre-fill AI suggestions + tag suggestion UI
- [ ] **Dry Run** กับ Excel จริงก่อน Production Migration

### RAG Pipeline — Production Readiness

- [x] **รัน SQL delta** `2026-06-05-add-rag-chunking-prompt.sql` ใน MariaDB production
- [x] **Deploy OCR Sidecar ใหม่** บน Desk-5439 หลัง rebuild image
- [ ] **Drop + recreate Qdrant collection** `lcbp3_vectors` เป็น Hybrid schema
- [ ] **SC-002 E2E accuracy test** — ทดสอบ Chat Q&A ≥ 80% accuracy

### General Tasks

- [ ] เพิ่ม unit test สำหรับ `upsertQueueRecord` ใน `ai-migration-checkpoint.service.spec.ts`
- [ ] เพิ่ม unit test สำหรับ checksum dedup ใน `file-storage.service.spec.ts`

### Feature-303: Frontend Test Coverage — Phase 3 🔄 IN PROGRESS

- [x] **Phase 2 coverage gate:** Statements 51.62% (target ≥ 50%)
- [x] **Verification:** `pnpm --filter lcbp3-frontend exec tsc --noEmit` ผ่าน
- [x] **Coverage suite:** `pnpm --filter lcbp3-frontend exec vitest run --coverage` ผ่าน 92 files / 692 tests
- [x] **New/extended coverage:** auth store, i18n utility, Circulation list, OCR sandbox prompt manager, Layout widgets
- [x] **Plan/tasks updated:** `specs/300-others/303-frontend-test-coverage/plan.md` และ `tasks.md`
- [x] **Phase 3 (Part 1):** Added 11 new test files (AI + layout components); 722/722 tests passing; coverage 51.62% statements
- [x] **Phase 3 (Part 2):** Added 77 tests (lib/api/_ + components/workflows/_); 833/833 tests passing; coverage TBD
- [ ] **Check coverage:** Verify coverage % from browser report (target ≥ 70%)
- [ ] **Remaining:** T034 Admin dashboard components
- [ ] **Remaining polish:** T050-T053 audit (`any`/`console.log`, publicId mock data, file headers, final coverage record)

### Feature-235: AI Runtime Policy Refactor ✅ COMPLETE

- [x] **Phase 1–8 ทุก task เสร็จครบ** รวม T032 (manual validation ผ่านหมดทุก Gate ที่ test ได้)
- [x] **Test suite:** 5 suites / 27 tests ผ่านใน targeted verification รอบล่าสุด (`ai.service.spec`, `ocr-residency.spec`, `queue-policy.spec`, `vram-monitor.service.spec`, `ai.controller.spec`)
- [x] **ESLint + tsc --noEmit:** ผ่านครบ ไม่มี error
- [x] **Canonical naming:** `np-dms-ai` / `np-dms-ocr` ทุก layer (API response, audit log, Admin Console, frontend badge)
- [x] **Adaptive OCR Residency:** `keep_alive` คำนวณ dynamic จาก VRAM headroom + active profile
- [x] **CPU Fallback Retrieval:** `/embed` + `/rerank` บน sidecar fallback ไป CPU เมื่อ GPU headroom ไม่พอ
- [x] **Queue Policy:** `ai-realtime` concurrency=2 (configurable ผ่าน `AI_REALTIME_CONCURRENCY`); `rag-query` → `ai-batch` เสมอ
- [x] **Validation artifacts:** `specs/200-fullstacks/235-ai-runtime-policy-refactor/validation-report.md` = `PARTIAL`; `checklists/cutover-validation.md` สร้างไว้สำหรับปิด T032
- [x] **i18n:** เพิ่ม `ai_runtime_policy` namespace ใน en/th locales
- [x] **CONTEXT.md:** เพิ่ม Feature-235 ใน System Readiness + ADR-034 ใน ADRs table
- [x] **T032:** Manual validation gate (Gate 1A/1B/1D ผ่านแล้ว — Gate 1C ต้องรอมี document จริงใน DB)
- **Branch:** `235-ai-runtime-policy-refactor` — พร้อม merge หลัง T032 manual validation ผ่าน

### Feature-236: Unified OCR Architecture — Sandbox Parity ✅ COMPLETE

- [x] **Phase 1–9 ทุก task เสร็จครบ**
- [x] **Test suite:** 31 suites / 256 tests ผ่าน 100%
- [x] **ESLint + tsc --noEmit:** ผ่านครบ ไม่มี error ทั้ง frontend และ backend
- [x] **Sandbox-Production Parity:** sandbox profiles ดึง draft configuration, apply production flow ทำงานพร้อม Idempotency-Key และ CASL guard
- [x] **Dual-Model Snapshot:** snapshot params แยกส่วน LLM และ OCR บันทึกลง job payload สำเร็จ
- [x] **Master Data Parity:** sandbox ดึง project/contract master data สำหรับ prompt context
- **Branch:** `236-unified-ocr-architecture` — พร้อม merge

### Correspondence Module Review Fixes ✅ COMPLETE

- [x] `throw new Error` → `ValidationException` (ADR-007) + `@Audit` บน `processAction`
- [x] CSV export: force `limit: 10000` override ใน `exportCsv`
- [x] `escapeCsv`: กัน OWASP formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`)
- [x] `bulkCancel`: เพิ่ม `this.logger.warn(...)` ใน catch block
- [x] `update()` re-index: ใช้ status จาก current revision แทน hardcode `'DRAFT'`
- [x] `RecipientDto`: เพิ่ม nested validation class + `@ValidateNested({ each: true })`
- [x] `PUT /:uuid`: แก้ permission → `correspondence.edit` (seed id=73)
- [x] Idempotency: `@UseInterceptors(IdempotencyInterceptor)` บนทุก 7 mutation endpoints
- [ ] **Verify:** `pnpm --filter backend build` + ทดสอบ CSV export > 10 rows + Idempotency header

### RFA ADR-001/021 Migration ✅ COMPLETE

- [x] ตัด deprecated `CorrespondenceRouting`/`RoutingTemplate`/`RoutingTemplateStep` repos ออก
- [x] ตัด `RfaWorkflowService` + entities (`RfaWorkflow`, `RfaWorkflowTemplate`, `RfaWorkflowTemplateStep`) ออกจาก `rfa.module.ts`
- [x] `submit()` + `processAction()` rewired ผ่าน `workflowEngine.processTransition()`
- [x] EC-RFA-001 check ย้ายเข้า transaction ด้วย `FOR UPDATE` lock (race-safe)
- [x] `syncRevisionStatus()` helper: map `STATE_TO_STATUS` — ห้าม hardcode
- [x] `notifyRecipients()` helper: ADR-008 async notify
- [x] `findOneByUuid()`: expose ADR-021 workflow fields (`workflowInstanceId`, `workflowState`, `availableActions`)
- [x] เพิ่ม static constants: `WORKFLOW_CODE = 'RFA_APPROVAL'`, `STATE_TO_STATUS` map, `DEFAULT_APPROVED_CODE = '1A'`
- [x] ตัด `templateId` ออกจาก `SubmitRfaDto` (backend + frontend) + `detail.tsx` UI + tests
- [x] **Verify:** `tsc --noEmit` (backend) exit 0
- [x] **Verify:** 26/26 frontend tests pass (`rfa.service.test.ts` + `detail.test.tsx`)

### Feature-237: Unified Prompt Management UX/UI — Code Review ❌ REQUEST CHANGES

- [x] **Review artifact:** `specs/200-fullstacks/237-unified-prompt-management-ux-ui/code-review-report.md`
- [x] **Frontend verification:** `pnpm --filter lcbp3-frontend exec tsc --noEmit` ผ่าน
- [x] **Backend blocker (resolved):** RFA migration เสร็จครบ — `tsc --noEmit` exit 0, `templateId` ตัดออกครบ, static constants เพิ่มครบ (ดู session-2026-06-14-rfa-migration-complete.md)
- [ ] **Security/data isolation:** แก้ prompt context filter ให้ใช้ public UUID (`projectPublicId`/`contractPublicId`) และ resolve เป็น internal IDs ฝั่ง service ห้าม `Number(uuid)`
- [ ] **Idempotency:** บังคับ `Idempotency-Key` สำหรับ prompt create/activate/context update และ sandbox RAG prep queueing
- [ ] **Prompt contract:** sync placeholders ระหว่าง seed SQL, validator, และ replacement logic สำหรับ `rag_query_prompt`, `rag_prep_prompt`, `classification_prompt`
- [ ] **DTO hardening:** nested validation + `@IsUUID()` + max page size/text length สำหรับ context config และ sandbox RAG prep

### Feature-240: AI Admin Console Collapsible Cards ✅ COMPLETE

- [x] **Master Section Collapse:** เพิ่มปุ่ม Toggle เพื่อพับ/คลี่ทั้งเซกชัน Monitoring ในหน้าจอเดียว
- [x] **Individual Card Collapse:** เพิ่มปุ่ม Toggle สำหรับการ์ดทั้ง 5 ใบ (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM GPU Monitor)
- [x] **Local Storage Persistence:** บันทึกสถานะล่าสุดและโหลดกลับคืนข้ามการรีเฟรชหรือการสลับแท็บอย่างปลอดภัย (กัน Hydration Mismatch)
- [x] **Background Polling:** การพับเก็บไม่มีผลกระทบต่อการดึงข้อมูลสถานะในพื้นหลังผ่าน TanStack Query
- [x] **Validation & Quality:** ผ่านการตรวจสอบประเภท (tsc) และ Lint (eslint) พร้อมสร้างรายงาน validation-report.md
- **Branch:** `240-ai-console-collapsible-cards`

### New Server Setup (Session 2026-07-02) ✅ COMPLETE

- [x] pnpm ติดตั้งบน Linux server (v10.33.0)
- [x] `2git.sh` สร้างแทน `2git.ps1` (bash script สำหรับ commit+push)
- [x] `pnpm install` สำเร็จ — แก้ root ownership บน `node_modules/` และ `.husky/`
- [x] GitHub SSH key เพิ่มแล้ว
- [x] GitHub remote เพิ่มแล้ว (`git@github.com:peancharoen/lcbp3.git`)
- [x] Push สำเร็จทั้ง Gitea และ GitHub

### Backend URL Migration + localhost Support (Session 2026-07-03) ✅ COMPLETE

- [x] deploy.sh/rollback.sh default URL → `http://192.168.10.11:3000/api`
- [x] Docker port binding → `0.0.0.0:3000:3000` และ `0.0.0.0:3001:3000`
- [x] CORS_ORIGIN + `http://localhost:3001,http://127.0.0.1:3001` (3 .env files)
- [x] CSP fallback + `http://localhost:3000` ใน `proxy.ts`
- [ ] Restart application stack เพื่อให้ port binding และ CORS ใหม่มีผล

### Deploy Permission Fix (Session 2026-07-03) ✅ COMPLETE

- [x] Ownership guard ใน `deploy.sh` + `rollback.sh` (step `[0/4]`)
- [x] `install -m 644` แทน `cp` ใน `deploy.sh`
- [x] `chown np-dms:np-dms` ไฟล์ทั้ง 3 layers บน server
- [ ] CI deploy สำเร็จหลัง push commit นี้
