# Recent Rollouts

| วันที่     | Version | รายการ                                                                                               | สถานะ                         |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| 2026-05-23 | v1.9.6  | Specs reorganization (`100/200/300-*` folders), AGENTS.md v1.9.6 update                              | ✅ Complete                   |
| 2026-05-23 | v1.9.6  | N8N Workflow v2 (`n8n.workflow.v2.json`) — ADR-023A compliant, ลบ Ollama direct                      | ⏳ Pending import to n8n UI   |
| 2026-05-24 | v1.9.6  | AGENTS.md Project Memory Override rule (Devin / Antigravity / Codex)                              | ✅ Complete                   |
| 2026-05-25 | v1.9.6  | Migration Queue attachment UUID fix — DTO + Service + n8n.workflow.v2.json (Session 3)               | ✅ Complete (tsc verified)    |
| 2026-05-25 | v1.9.6  | Migration error normalization + `job_id` logging — workflow + backend + SQL/delta (Session 4)        | ✅ Complete                   |
| 2026-05-25 | v1.9.6  | PaddleOCR Sidecar บน Desk-5439 — FastAPI `/ocr`+`/normalize`, CIFS mount, path remapping (Session 7) | ✅ Running                    |
| 2026-05-27 | v1.9.7  | Context-Aware Prompt Templates & DB CC Whitespace Cleanup (ADR-030) (Session 9)                      | ✅ Complete (v1.9.7 main)     |
| 2026-05-30 | v1.9.7  | OCR Engine Migration — PaddleOCR → Tesseract (Session 8)                                             | ✅ Complete (pending rebuild) |
| 2026-05-30 | v1.9.7  | OCR Sandbox Two-Step Flow (ADR-030/231) — Step 1 OCR-only → Step 2 AI Extraction (Session 10)       | ✅ Complete                   |
| 2026-05-30 | v1.9.7  | Typhoon OCR & LLM Integration (ADR-032) — Dynamic model switching + VRAM Monitor (Session 11)        | ✅ Complete                   |
| 2026-06-03 | v1.9.8  | Thai-Optimized AI Model Stack (ADR-034) — typhoon2.5-np-dms:latest + typhoon-np-dms-ocr:latest      | ✅ Complete                   |
| 2026-06-05 | v1.9.8  | RAG Pipeline Enhancements (Spec 234 / ADR-035) — BGE-M3 + BGE-Reranker + Hybrid Qdrant (Session 14/15) | ✅ Complete                   |
| 2026-06-06 | v1.9.9  | LLM JSON Parse Failure & VRAM Fix (ADR-035-135) — retry logic + keep_alive=0 + ESLint heap fix     | ✅ Complete                   |
| 2026-06-08 | v1.9.10 | LLM JSON Response Truncation Fix — ขยาย num_ctx: 16384 (Session 16 โดย AGY Gemini 3.5 Flash (Medium)) | ✅ Complete                   |
| 2026-06-11 | v1.9.10 | AI Runtime Policy Refactor (Feature-235) — Canonical names (`np-dms-ai`/`np-dms-ocr`), Adaptive OCR Residency, CPU Fallback Retrieval, Queue Policy (ai-realtime concurrency=2) — targeted verification 27/27 tests ✅ ESLint + tsc clean | ⏳ Pending T032 Manual Gate + Merge |
| 2026-06-11 | v1.9.10 | Feature-235 validation follow-up — validation-report.md = PARTIAL, cutover-validation checklist added, targeted verification 27/27 | ⏳ Pending T032 execution |
| 2026-06-12 | v1.9.10 | Feature-235 quickstart.md fix — corrected Backend URL, API paths, token extraction, verified Gate 1A/1B/1D (Session by Devin Cascade) | ✅ Complete (T032 done) |
| 2026-06-13 | v1.9.10 | Feature-236 Unified OCR Architecture & Sandbox Parity — endpoints, UI parameters, apply production, dual-model, project/contract context selector, snapshot dual-model, 256/256 tests passed | ✅ Complete (tsc + eslint clean) |
| 2026-06-14 | v1.9.10 | Feature-303 Frontend Test Coverage — added auth-store/i18n/circulation/OCR sandbox/layout tests; coverage 51.62% statements, 92 files / 692 tests passed | ✅ Phase 2 gate passed |
| 2026-06-14 | v1.9.10 | Feature-237 Unified Prompt Management UX/UI code review — report saved; frontend tsc passed; backend build blocked by RFA service compile errors plus prompt context/idempotency findings | ❌ Request changes |
| 2026-06-14 | v1.9.10 | Correspondence Module Review Fixes — ValidationException, CSV row cap (10000), formula injection, bulkCancel logging, dynamic re-index status, RecipientDto nested validation, correspondence.edit permission, IdempotencyInterceptor on all 7 mutation endpoints | ✅ Complete |
| 2026-06-14 | v1.9.10 | RFA ADR-001/021 Migration — ตัด CorrespondenceRouting/RoutingTemplate repos ออก; ตัด templateId จาก DTO; เพิ่ม static constants (WORKFLOW_CODE/STATE_TO_STATUS/DEFAULT_APPROVED_CODE); tsc --noEmit exit 0; 26/26 frontend tests pass | ✅ Complete |
| 2026-06-14 | v1.9.10 | Frontend Test Coverage Phase 3 — added 11 new test files (AI + layout components); 722/722 tests passing; coverage 51.62% statements | ✅ Complete |
| 2026-06-14 | v1.9.10 | Frontend Test Coverage Phase 3 — added 77 tests (lib/api/* + components/workflows/*), 833/833 tests passing, coverage TBD | ✅ Complete (pending coverage check) |
| 2026-06-14 | v1.9.10 | TypeORM RfaWorkflow Entity Fix — added RfaWorkflow to RfaModule.forFeature() to resolve "Entity metadata for RfaRevision#workflows was not found" error | ✅ Complete |
| 2026-06-15 | v1.9.10 | ESLint Error Fixes — Fixed 58 ESLint errors across 4 test files (syntax, unused variables, ADR-019 UUID violations, unsafe member access) | ✅ Complete |
| 2026-06-15 | v1.9.10 | Backend Test Fixes — Added AiExecutionProfilesService mock, skipped integration tests (requires e2e infra), deleted fake e2e test, updated tasks.md npm→pnpm | ✅ Complete |
| 2026-06-17 | v1.9.10 | Correspondence Service Refactor — UUID helpers, transaction for update(), .catch() on fire-and-forget, cancel notification fix (REJECTED→PENDING), Partial<T> types, workflow fields in findOne(), permission cache, exportCsv paginated, 26/26 tests pass | ✅ Complete |
| 2026-06-17 | v1.9.10 | RFA Service Code Review Refactor — constants extraction (type/status/error codes), getCurrentRevision() DRY helper, validateRfaTypeDrawingConstraints() extracted, narrow UpdateRfaDto (6 fields), cancel() terminates workflow via terminateInstance(), tsc --noEmit 0 errors | ✅ Complete |
| 2026-06-18 | v1.9.10 | Feature-238 OCR AI Prompt Separation — SandboxTabs โหลด active prompts ทั้ง ocr_system + ocr_extraction, แสดง prompt info ทั้ง 2 steps, ส่ง active version ที่ถูกต้อง | ✅ Complete |
| 2026-06-18 | v1.9.10 | VRAM Monitor Fix — Backend ส่ง loadedModels พร้อม vramUsageMB, frontend รองรับ format ใหม่, แสดง VRAM usage ถูกต้อง | ✅ Complete |
| 2026-06-19 | v1.9.10 | Feature-240 AI Admin Console Collapsible Cards — เพิ่มปุ่มและฟังก์ชันพับ/คลี่การ์ดและเซกชัน พร้อมบันทึกสถานะลง localStorage และรักษา background query polling | ✅ Complete |
| 2026-06-19 | v1.9.10 | Deployment Timeout Fix — Added clamav health check before recreation (skip if healthy), increased CI timeout 20→30 min | ✅ Complete |
| 2026-06-19 | v1.9.10 | AI Admin Response Normalization — recursive data unwrap for VRAM/prompt payloads, fixed Sandbox `.map()` crash and false OOM Guard | ✅ Complete |
| 2026-06-19 | v1.9.2  | SQL Delta Consolidation — merged applied deltas into schema/seed files, updated data dictionary to v1.9.2, cleaned up deltas directory, moved INSERT statements from schema to seed file | ✅ Complete |
| 2026-06-20 | v1.9.10 | ADR-040 OCR Sidecar Refactor — Pure compute worker, async I/O, residency wiring, path hardening, network isolation (supersedes ADR-033 §7) | ✅ Proposed |
| 2026-06-20 | v1.9.10 | ADR-041 Server Consolidation — Single Docker host (Ryzen 5 5600/32GB/RTX 5060 Ti 16GB), ASUSTOR as Primary NAS, QNAP as backup | ✅ Proposed |
| 2026-06-20 | v1.9.10 | OCR Sidecar Refactor (Speckit-140) — spec.md, plan.md, tasks.md generated, 5 analysis issues fixed, ready for implementation | ✅ Ready for Implement |
| 2026-06-20 | v1.9.10 | OCR Sidecar Refactor Phase 6+8+9 — async I/O (lifespan + AsyncClient + asyncio.to_thread), ลบ /normalize endpoint, Dockerfile curl, docker-compose stale config cleanup, README.md, quickstart.md fix — 19/19 Python tests pass | ✅ Complete (Phase 7 blocked by ADR-041) |
| 2026-06-20 | v1.9.10 | OCR Backend Cleanup — typhoon-llm → np-dms-ai (processor+queue+module), tesseract → fast-path (enum+entity+controller+service+tests), P1-P3 fixes (keep_alive removal, hardcoded API key removal, env var alignment, Dockerfile 3.11, asyncio.to_thread VRAM calls) | ✅ Complete (pending tsc verify) |
| 2026-06-20 | v1.9.10 | OCR Naming Refactor — TyphoonOcr → NpDmsOcr (processor/queue/Redis key/aiModel), OcrTyphoonOptions → OcrNpDmsOptions, typhoonOptions → ocrOptions (backend 7 files + 3 tests), frontend typhoon state vars → ocr, isTyphoon → isAiPowered, Tesseract mocks → Fast Path, dead typhoon_ocr checks removed, page.tsx model name constants | ✅ Complete (pending tsc verify) |
| 2026-06-20 | v1.9.10 | Canonical Naming Cleanup — ลบ Typhoon references ที่เหลือใน backend src (15+ ไฟล์): TYPHOON_OCR_REQUIRED_VRAM_MB → NP_DMS_OCR_REQUIRED_VRAM_MB, typhoon2.5-np-dms → np-dms-ai (defaults/mocks/Swagger/JSDoc/logs), ลบ duplicate vram-monitor condition; tsc --noEmit exit 0; 32 suites/299 tests pass | ✅ Complete |
| 2026-06-20 | v1.9.10 | OCR Sidecar Review Fixes — ลบ hardcoded API key ใน SandboxOcrEngineService (FR-001), rewrite API contract v1.1 (เพิ่ม /ocr-upload, /embed, /rerank; แก้ camelCase fields, response schema, error format, path traversal doc) | ✅ Complete (pending tsc verify) |
| 2026-06-22 | v1.9.10 | OCR Sidecar Refactor Validation (Speckit-140) — speckit-validate: 17/17 active FRs pass, 13/14 active ACs, 8/8 edge cases, 41 tests, 3 FRs blocked by ADR-041, 2 minor gaps (benchmarks) | ✅ PASS (with minor gaps) |
| 2026-06-27 | v1.9.10 | ADR-041 Migration Step 4.7 — Gitea SSH via Cloudflare Tunnel (`git-ssh.np-dms.work`), แก้ Network is unreachable จาก Cloudflare proxy ไม่รองรับ SSH port; SSH config + known_hosts + git remote updated | ✅ Complete (SSH verified) |
| 2026-07-02 | v1.9.10 | New Server Setup — pnpm install, 2git.sh (PowerShell→bash), fix root ownership on node_modules/.husky, add GitHub SSH key + remote, push to both Gitea+GitHub | ✅ Complete |
| 2026-07-03 | v1.9.10 | Backend URL Migration + localhost Support — deploy.sh/rollback.sh default URL → IP, Docker port binding → 0.0.0.0, CORS_ORIGIN + localhost, CSP fallback + localhost | ✅ Complete (pending restart) |

