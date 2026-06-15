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
