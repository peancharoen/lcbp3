// File: specs/999-test-plan/20260915-ai-classification-accuracy-e2e-test-plan.md
// Change Log:
// - 2026-09-12: Initial unified test plan — ครอบคลุมทุกกระบวนการ AI (Intent → RAG prepare → Vector → ai-realtime/ai-batch/ai-ingest/ai-rag/ai-rag-ingest) เพื่อทดสอบความแม่นยำของ AI classification แบบ end-to-end (C4 — SC-002 scenario)
// - 2026-09-15: ปรับปรุงหลัง execution รอบแรก (2026-09-14) — เปลี่ยนชื่อไฟล์เป็นรูปแบบ YYYYMMDD-, อัปเดต Queue Map ตาม B13 fix (แยก RAG lifecycle queues), อ้างอิง golden set + compare script ที่สร้างแล้ว, แก้ Tesseract fallback ตาม ADR-040 D1, เพิ่มสถานะผลการทดสอบล่าสุด, เพิ่ม §2.1 ข้อมูลทดสอบที่ต้องเตรียม (D1-D12) + ชุดข้อมูลจริง 265 records (`C22024-265.xlsx` / `incoming/08C.2/2567`), เพิ่ม ADR-054 regression coverage (1D.9-12, §2E, 3B.9-10), แก้ typo

# แผนการทดสอบรวม: AI Classification Accuracy E2E (C4 — SC-002)

**วันที่ร่าง**: 2026-09-12 | **ปรับปรุงล่าสุด**: 2026-09-15
**ขอบเขต**: ทุกกระบวนการ AI ในระบบ — Intent Classification (224) → RAG Prepare/Embed (234/254) → Vector Store (Qdrant) → Retrieval/Rerank → LLM Answer → Migration Compare (242) → Metadata Extraction (250) → Runtime Policy (235) → Engine Control (248) ครอบคลุม BullMQ queues: `ai-realtime`, `ai-batch`, `ai-rag-query`, `ai-rag-ingest`, `ai-rag-metadata-sync`, `ai-rag-generation-cleanup`, `ai-rag-generation-retention`, `ai-vector-deletion`
**หมายเหตุ**: ไม่ทับซ้ำกับ `rag-admin-console-unified-test-plan.md` (ซึ่งครอบคลุมเฉพาะ UI `/admin/ai/rag-console`) — แผนนี้เน้น **ความแม่นยำของผล AI และความถูกต้องของ pipeline ต้นทางจนถึงปลายทาง**
**Artifacts ที่ใช้**: golden set `fixtures/sc002-golden-set.json` (v2.0.0), compare script `scripts/sc002-accuracy-compare.ts`, ผลทดสอบรอบแรก `sc002-execution-report.md` (2026-09-14)
**ADR อ้างอิง**: ADR-023/023A (AI Boundary), ADR-024 (Intent Classification), ADR-029 (Dynamic Prompts), ADR-040 (OCR Sidecar — ยกเลิก Tesseract fallback), ADR-041 (Server Consolidation), ADR-042 (OCR Persistence), ADR-043 (AI Architecture Current State), ADR-048 (Engine Control), ADR-050 (Metadata Contract — ข้อ 2 ถูก supersede โดย ADR-054), ADR-054 (Migration Metadata Separation + OCR Text Protection — เกิดจาก data-loss incident ตอน SC-002), ADR-019 (UUID), ADR-016 (RBAC), ADR-008 (BullMQ), ADR-007 (Error Handling)
**ทดสอบบน production**: https://lcbp3.np-dms.work
**Login Credentials:**
```
username:superadmin password:Center2025
username:admin password:Center2025
username:editor01 password:Center2025
username:viewer01 password:Center2025
```

---

## 1. สเปคใน 200-fullstacks ที่เกี่ยวข้อง

### 1.1 Core Specs — สเปคที่ implement กระบวนการ AI โดยตรง

| # | สเปค | ADR | หน้าที่ใน pipeline | SC-002 ความหมาย | สถานะ Implementation |
|---|------|-----|------------------|-----------------|---------------------|
| 1 | **224-intent-classification** | ADR-024 | Intent Classification (Pattern → LLM Fallback) ส่งต่อให้ Tool Layer | LLM Fallback latency < 2000ms | Implemented — `ai/intent-classifier/` 18 services, 9 service specs, 2 controller specs |
| 2 | **234-rag-pipeline-enhancements** | ADR-035→ADR-043 | RAG Prepare (BGE-M3 embed, semantic chunking, Qdrant Hybrid search, rerank) | Chat Q&A ตอบถูก ≥ 80% | Implemented (PASS 6/6 suites, 24/24 tests) — superseded by ADR-043 เป็น audit trail |
| 3 | **242-migration-ai-pipeline** | ADR-028/042 | Migration AI Compare (ทะเบียน vs เอกสาร) + batch RAG embedding | ตรวจพบ mismatch จริง ≥ 90% | Implemented — 172/172 PASS |
| 4 | **250-ai-metadata-extraction-contract** | ADR-050 | Metadata extraction output contract (ocrQuality + per-field confidence) | 100% แสดง confidence แยก (ไม่ merge) | Partial — tests pass แต่ coverage branches 61.63% / functions 58.33% < 70% threshold |
| 5 | **254-rag-attachment-chunks** | — | RAG Attachment generation lifecycle (BUILDING→ACTIVE→RETIRED/FAILED), checksum, citation | 100% ACTIVE มี checksum + scope เดียว | Implemented — 2881 backend + 45 RAG E2E PASS (commit dd880227) |
| 6 | **235-ai-runtime-policy-refactor** | ADR-033/034→ADR-043 | Runtime policy (canonical `np-dms-ai`/`np-dms-ocr`, adaptive keep_alive, CPU fallback) | 100% แสดง canonical name | Implemented — validation-report exists |
| 7 | **248-ai-engine-control-center** | ADR-048 | Active control (VRAM load/unload, queue drill-down, clear-failed) | Zero race conditions | Implemented — validation-report exists |

### 1.2 Supporting Specs — สเปคสนับสนุนที่ pipeline ใช้

| # | สเปค | ความเกี่ยวข้อง | สถานะ |
|---|------|---------------|-------|
| 8 | **225-ai-tool-layer-architecture** | Tool Layer รับ Intent จาก 224 → execute (CASL-guarded) | Implemented |
| 9 | **229-dynamic-prompt-management** | Prompt จาก `ai_prompts` (Redis cache `ai:prompt:active:{type}` TTL 60s) | Implemented |
| 10 | **230-context-aware-prompt-templates** | Context-aware prompt + cross-project guard | Implemented |
| 11 | **232-typhoon-ocr-integration** | Typhoon OCR (np-dms-ocr) — ⚠️ Tesseract fallback ถูกยกเลิกโดย ADR-040 D1 (single engine) | Implemented (amended by ADR-040) |
| 12 | **233-ai-model-ocr-runner-management** | Ollama `ps` real-time + VRAM monitor | Implemented |
| 13 | **236-unified-ocr-architecture** | Unified OCR parameter tuning | Implemented |
| 14 | **255-rag-admin-console** | Admin console UI — **มี test plan เดิมแล้ว** (อ้างอิง ไม่ทำซ้ำ) | Implemented |
| 15 | **226-document-chat-ui-pattern** | Side-panel chat UI (SSE streaming) บน rfas/[uuid], drawings/[uuid] | Implemented |

### 1.3 แผนภาพความสัมพันธ์ (Dependency Flow — AI Pipeline)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER QUERY (Chat / Playground)                   │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  224 Intent Classification  (ai-realtime queue, concurrency 2)          │
│  Pattern Match (Redis cache) ──miss──▶ LLM Fallback (Ollama, semaphore 3)│
│  → Intent code + confidence + params                                    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  225 AI Tool Layer (CASL-guarded) — dispatch ตาม Intent                │
│  GET_RFA / GET_DRAWING / RAG_QUERY / SUMMARIZE_DOCUMENT / ...           │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  234/254 RAG Query Pipeline  (ai-rag-query queue)                       │
│  BGE-M3 /embed (Sidecar) → Qdrant Hybrid search (filter project_public_ │
│  id) topK=15 → BGE-Reranker /rerank → top 3-5 → verify ACTIVE generation │
│  (254 FR-030) → keyword/full-text fallback (254 FR-032)                 │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LLM Answer (np-dms-ai via Ollama) + Citation (254 FR-033)             │
│  → Audit log (ai_audit_logs)                                            │
└─────────────────────────────────────────────────────────────────────────┘

  ─────────  BACKGROUND INGESTION (async)  ─────────

  Workflow Submit (DRAFT→IN_REVIEW)
        ▼
  234 rag-prepare job (ai-batch queue, FR-010/012)
        ▼
  OCR (np-dms-ocr) → ocr_text persist (ADR-042) → semantic chunking (229 prompt)
        ▼
  254 rag-attachment-ingest (ai-rag-ingest queue)
     BUILDING → ACTIVE (checksum verify, Redlock swap) → Qdrant upsert
        ▼
  rag-metadata-sync / rag-generation-cleanup / rag-generation-retention
  (lifecycle queues แยกตาม B13 fix: ai-rag-metadata-sync /
   ai-rag-generation-cleanup / ai-rag-generation-retention)
  ai-vector-deletion (delete RETIRED points)

  ─────────  MIGRATION AI (async)  ─────────

  242 migrate-document (ai-batch) → AI Compare (ทะเบียน vs OCR)
        ▼
  250 legacy-ocr-batch-phase → legacy-ai-metadata-only / legacy-ai-enrichment
      (ai-batch, two-phase D267) → ocrQuality + per-field confidence
        ▼
  human-in-the-loop review (/ai-staging) → commit → batch RAG embed
```

### 1.4 Queue Map (จาก `backend/src/modules/common/constants/queue.constants.ts` — อัปเดต 2026-09-15 ตาม B13 phase 2 fix)

| Queue Constant | ชื่อจริง | Job Types | Concurrency | สเปค |
|----------------|---------|-----------|-------------|------|
| `QUEUE_AI_REALTIME` | `ai-realtime` | intent classification, tool-only suggest | 2 | 224, 235 |
| `QUEUE_AI_BATCH` | `ai-batch` | `ocr`, `ocr-extract`, `extract-metadata`, `ai-suggest`, `embed-document`, `migrate-document`, `rag-prepare`, `legacy-ai-enrichment`, `legacy-ocr-batch-phase`, `legacy-ai-metadata-only`, `sandbox-*`, `clear-failed-jobs` | 1 (lockDuration 700s) | 232, 234, 235, 242, 250 |
| `QUEUE_AI_RAG` | `ai-rag-query` | `rag-query` | 1 | 234, 254 |
| `QUEUE_AI_RAG_INGEST` | `ai-rag-ingest` | `rag-attachment-ingest` | 1 | 254 |
| `QUEUE_AI_RAG_METADATA_SYNC` | `ai-rag-metadata-sync` | `rag-metadata-sync` | 1 | 254 (B13 fix) |
| `QUEUE_AI_RAG_GENERATION_CLEANUP` | `ai-rag-generation-cleanup` | `rag-generation-cleanup` | 1 | 254 (B13 fix) |
| `QUEUE_AI_RAG_GENERATION_RETENTION` | `ai-rag-generation-retention` | `rag-generation-retention` | 1 | 254 (B13 fix) |
| `QUEUE_AI_VECTOR_DELETION` | `ai-vector-deletion` | `delete-document-vectors` | — | 254 |
| `QUEUE_NP_DMS_AI` | `np-dms-ai` | model processor (นิยามใน `ai/processors/np-dms-ai.processor.ts`) | — | 235 |
| `QUEUE_NP_DMS_OCR` | `np-dms-ocr` | OCR processor (นิยามใน `ai/processors/np-dms-ocr-processor.ts`) | — | 232, 236 |

> ⚠️ B13 phase 2 (commit `fed11419`, 2026-09-14): แยก `rag-metadata-sync`, `rag-generation-cleanup`, `rag-generation-retention` ออกจาก `ai-rag-ingest` เป็น queue ของตัวเอง — เดิม 4 WorkerHost processors แชร์ queue เดียวทำให้ BullMQ ส่ง job ผิด type ไปยัง processor ผิดแล้ว complete ทันที

---

## 2. โครงสร้างการทดสอบ (Phase Overview)

| Phase | สถานการณ์ที่ครอบคลุม | Priority | จำนวน cases |
|-------|---------------------|----------|-----------|
| Phase 1: Browser E2E | ทดสอบผ่านเบราว์เซอร์จริง — Intent Test Console, RAG Playground, Document Chat, Migration Review Queue (รวม re-extract/ADR-054), AI Staging, Engine Control Center | P1 | 30 |
| Phase 2: Backend Unit | ปิด coverage gap — intent classifier, rag retrieval guard, metadata extraction, generation swap, stale validation, ADR-054 data-loss regression | P2 | 29 |
| Phase 3: Integration | End-to-end flow ข้ามหลาย queue — submit→rag-prepare→ingest→query→answer, migration compare→review→re-extract→commit→batch embed | P2 | 20 |
| Phase 4: Performance & Accuracy | Benchmark ตาม SC — latency, accuracy ≥80%/≥90%, cross-project leak 0%, CPU fallback | P3 | 16 |
| Phase 5: Security & RBAC | CASL guard ทุก AI endpoint, projectPublicId filter, AI boundary, idempotency, audit trail, UUID | P2 | 14 |
| **รวม** | | | **109** |

### 2.1 ข้อมูลทดสอบที่ต้องเตรียม (Test Data Requirements)

> **ชุดข้อมูลหลัก — 265 records**: import ผ่านหน้า `/admin/migration` — เลือกไฟล์ Excel `C22024-265.xlsx` จาก NAS, Staging PDF folder บน NAS = `incoming/08C.2/2567`; ถ้ามี PDF ขาดหายให้ค้นหาเพิ่มจาก `incoming/` (root folder)
> Project: `LCBP3-C2` (projectPublicId `01a01992-8420-74ff-b0f4-0c8560a8478c`, batch `BATCH-C2-2567-005`) เว้นแต่ระบุอื่น

| # | ข้อมูลทดสอบ | ใช้กับ test | แหล่ง/วิธีเตรียม | สถานะ |
|---|------------|------------|----------------|-------|
| D1 | Golden set 5 docs (RFA/TRANSMITTAL จริง: QC-0001, QC-0002, คคง., CHEC-0002, CHEC-0004) + expected type/confidence/OCR quality/chunk count | 4A.1–4A.2, 1D, 3B | `fixtures/sc002-golden-set.json` v2.0.0 — import ผ่าน migration pipeline (commit_batch) | ✅ พร้อม (indexed แล้ว, 106 vectors) |
| D2 | Intent queries 7 รายการ (pattern 4 + llm_fallback 3 + tolerance notes) | 1A, 4A.4–4A.5, 4B.1–4B.2 | `intentClassificationGoldenSet` ใน golden set | ✅ พร้อม |
| D3 | RAG queries 7 รายการ (normal, ambiguity, typo, mixed-lang, cross-doc) | 1B, 4A.1, 4B.7 | `ragQueryGoldenSet` ใน golden set | ✅ พร้อม |
| D4 | Review queue ที่ทราบคำตอบ — ชุดใหญ่ 265 records (รวมกรณี mismatch หลายช่อง + OCR ไม่ได้) | 1D.1–1D.4, 1D.9–1D.12, 3B, 4A.2 | Import Excel `C22024-265.xlsx` (NAS) ผ่าน `/admin/migration` + Staging PDF `incoming/08C.2/2567`; PDF ที่ขาดค้นจาก `incoming/` | ⏳ ต้อง import + ทำเครื่องหมายรายการที่ทราบ mismatch |
| D5 | เอกสาร indexed ใน **Project B** (โครงการอื่น) | 1B.3, 1C.3, 3B.8, 4A.6 | เลือกเอกสารที่ indexed อยู่แล้วใน project อื่นบน production — ห้ามสร้างใหม่โดยไม่ได้รับอนุญาต | ⏳ ต้องระบุเอกสาร |
| D6 | เอกสาร DRAFT (ยังไม่ submit — ต้องไม่ถูก RAG) | 1B.4 | สร้าง Correspondence DRAFT ใหม่ใน LCBP3-C2 | ⏳ ต้องเตรียม |
| D7 | ai-staging items ที่ requiresHumanReview=true (รวม flagged fields, tag ใหม่, OCR quality ต่ำ) | 1E, 3B.4, 1D.6–1D.8 | จาก `legacy-ai-enrichment` ของ batch C2 หรือ flag ด้วยตนเอง | ⏳ ต้องเตรียม |
| D8 | Failed jobs ใน BullMQ queues (สำหรับ Retry / Clear Failed) | 1F.4–1F.5 | seed job ที่ fail จงใจ (payload ไม่ valid) หรือรอ job fail จริง | ⏳ ต้องเตรียม |
| D9 | Failed jobs 10,000 รายการ | 4B.6 | เขียน seed script (BullMQ `queue.add` + fail) — ใช้ test queue แยก ห้ามยิงใส่ queue production จริง | ⏳ ต้องเขียน script |
| D10 | 50 concurrent users | 4C.4 | load test tool (k6 / Artillery) + script ยิง classify API พร้อมกัน | ⏳ ต้องเตรียม |
| D11 | GPU pressure / model unload จำลอง | 4C.1, 4C.2, 1F.6, 3C.7–3C.8 | unload model ผ่าน `/ai/admin/models/:name/vram/unload` + ตรวจ sidecar log `device: "cpu"` | ✅ วิธีระบุแล้ว |
| D12 | Ollama / Qdrant / sidecar ไม่พร้อม | 3C.4–3C.5, 4C.2, 5D.1 | stop service บน np-dms-lcbp3 — **ต้องขออนุญาตก่อน** (กระทบ production) | ⏳ ต้องอนุญาต |

**หมายเหตุ**: D4, D9, D10, D12 เป็น blocker ของ Phase 4 — แนะนำเตรียมก่อนเริ่ม Phase 1 รอบถัดไป

---

## 3. Phase 1: Browser E2E (P1)

> ทดสอบผ่านเบราว์เซอร์จริงบน https://lcbp3.np-dms.work — ใช้ Playwright patterns จาก skill `e2e-testing`
> ตรวจ console errors = 0 และ network ไม่มี 5xx ในทุก case

### 1A. Intent Classification — Test Console (Spec 224)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1A.1 | ล็อกอิน superadmin, เข้า `/admin/ai/intent-classification/test-console` | แสดง Test Console (ช่องพิมพ์คำถาม + ปุ่มทดสอบ) | 224 FR-013, US4 AC1 |
| 1A.2 | พิมพ์ "สรุปเอกสารนี้" กดทดสอบ | คืน Intent `SUMMARIZE_DOCUMENT`, confidence = 1.0, method = `pattern`, latency < 10ms | 224 US2 AC1, SC-001 |
| 1A.3 | พิมพ์ "ขอดูแบบที่เกี่ยวข้องกับ RFA-0042" กดทดสอบ | คืน Intent `GET_RFA_DRAWINGS`, method = `llm_fallback`, confidence ≥ 0.7 | 224 US2 AC2, SC-003 |
| 1A.4 | พิมพ์ "อากาศดีไหมวันนี้" กดทดสอบ | คืน Intent `FALLBACK` + ข้อความแนะนำตัวอย่างคำถาม (confidence < 0.4) | 224 US2 AC3, FR-009 |
| 1A.5 | พิมพ์ "ขอดู RFA ล่าสุดของ contract A" (ไทย/อังกฤษปน) | คืน Intent `GET_RFA` พร้อม params ที่ถูกต้อง | 224 US2 AC4, FR-014 |
| 1A.6 | พิมพ์ "สรปุเอกสาร" (typo) | LLM Fallback เข้าใจและ classify ถูกต้อง (ไม่ FALLBACK) | 224 Edge Case 6 |
| 1A.7 | เปิดหน้า Analytics หลังมีการ classify > 100 ครั้ง | แสดง Hit Rate (Pattern vs LLM), Confidence Distribution, Latency Statistics | 224 US3 AC1, SC-006 |
| 1A.8 | ตรวจ network response ของ classify API | ใช้ `publicId` (UUIDv7) ไม่ใช่ INT PK; มี `projectPublicId`, `userPublicId` ใน audit | 224 FR-010, ADR-019 |

### 1B. RAG Playground — Query Accuracy (Spec 234/254)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1B.1 | ล็อกอิน superadmin, เข้า `/admin/ai/rag-playground`, เลือก Project A | แสดงหน้า RAG Playground (เลือก project + ช่อง query) | 234 US1 |
| 1B.2 | ถามคำถามที่เนื้อหาอยู่ในเอกสาร IN_REVIEW ของ Project A | ระบบตอบได้พร้อมระบุเลขเอกสาร + วันที่อ้างอิง ภายใน 30 วินาที | 234 US1 AC1, SC-002 |
| 1B.3 | ถามคำถามที่เนื้อหาอยู่ใน Project B โดยล็อกอินใน Project A | ระบบไม่ดึงข้อมูลจาก Project B มาตอบ (0% cross-project leak) | 234 US1 AC2, SC-003, 254 SC-009 |
| 1B.4 | ถามคำถามที่เนื้อหาอยู่ในเอกสาร DRAFT (ยังไม่ submit) | ระบบไม่นำเนื้อหา DRAFT มาตอบ | 234 US1 AC3 |
| 1B.5 | ตรวจ citation ในคำตอบ | citation มี Attachment identity, owner, source locator, segment, snippet, score, `chunkPublicId` — **ไม่** มี `generation_uuid` | 254 FR-033, FR-034 |
| 1B.6 | ถามคำถามที่ chunk ที่ match เป็น RETIRED generation | ระบบ skip RETIRED + ใช้ keyword/full-text fallback + บันทึก fallback reason | 254 FR-030/031/032, US2 AC2/3 |

### 1C. Document Chat UI (Spec 226/234)

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 1C.1 | ล็อกอิน editor01, เข้า `/rfas/[uuid]` ของ Project A, เปิด side-panel chat | แสดง chat panel โดยเนื้อหาเอกสารไม่ถูกบดบัง | 226 SC-002, US1 |
| 1C.2 | ถามคำถามเกี่ยวกับเอกสารที่เปิดอยู่ (context attached) | ระบบตอบโดยใช้ context ของเอกสารที่เปิดอยู่ 100% | 226 SC-002, 234 US1 |
| 1C.3 | ถามคำถามที่เนื้อหาอยู่ในโครงการอื่น | ระบบไม่นำข้อมูลโครงการอื่นมาตอบ | 234 SC-003, 230 SC-002 |
| 1C.4 | จำลอง network error ระหว่าง SSE streaming | ระบบแสดง UI แจ้งข้อผิดพลาด + ปุ่ม Retry ภายใน 500ms | 226 SC-004 |

### 1D. Migration Review Queue — AI Compare Accuracy (Spec 242/250)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1D.1 | ล็อกอิน admin, เข้า `/admin/migration` review queue ที่มีเอกสาร 20 ฉบับ (5 ฉบับข้อมูลไม่ตรง) | queue แสดงรายการที่ไม่ตรงครบ 5 ฉบับ + ไม่แจ้งผิดพลาดใน 15 ฉบับ | 242 US1, SC-002, SC-003 |
| 1D.2 | เปิดรายการที่มี mismatch หัวเรื่อง | แสดงค่าจากทะเบียน + ค่าที่พบในเอกสารเทียบกัน + ระดับความเชื่อมั่น | 242 FR-007/008, US1 AC2 |
| 1D.3 | เปิดรายการที่มี mismatch 4 ช่อง (เกณฑ์ตั้งไว้ 3) | รายการถูกจัดกลุ่ม "ต้องแก้ไขด้วยตนเอง" | 242 US1 AC3, FR-010 |
| 1D.4 | เปิดรายการสถานะ "เปรียบเทียบไม่ได้" (OCR ไม่ได้) | ใช้ค่าจากทะเบียนทั้งหมด + ระบุเหตุ + ยืนยันได้ | 242 FR-012a/b/c, Edge Case |
| 1D.5 | เลือก "ใช้ค่าจากเอกสาร" สำหรับช่องวันที่ แล้วยืนยัน | ระบบบันทึกค่าจากเอกสาร + audit แหล่งค่า | 242 US1 AC7, FR-011/011b |
| 1D.6 | เปิดรายการที่ AI สกัดการแนะนำ tag | แต่ละ tag แสดง isNew + evidence excerpt + ปุ่ม accept/reject แยก | 250 US3 AC1, FR-006/007 |
| 1D.7 | พยายาม commit รายการที่ flagged `requiresHumanReview` โดยไม่ resolve | commit ถูก block + แจ้งเหตุ | 250 US1 AC4, FR-013, SC-007 |
| 1D.8 | ตรวจ OCR quality vs metadata confidence ใน detail page | แสดงเป็น indicator แยก ไม่ merge เป็น score เดียว | 250 SC-002, FR-001/009 |
| 1D.9 | re-extract รายการที่ review ไปแล้ว (มี fieldResolutions) | `review_state_json` คงอยู่ครบ (มนุษย์ตัดสินใจไม่หาย) + `ai_metadata_json` มีเฉพาะ AI output ใหม่ | ADR-054 D3/D9 |
| 1D.10 | re-extract รายการที่ `storage_temp_path` ว่าง | extractor fallback หา PDF จาก `attachments.file_path` (tempAttachmentIds[0]) — **ไม่**เขียน "ไม่มี ไฟล์ PDF" ทับ `ocr_text` | ADR-054 D4 |
| 1D.11 | re-extract รายการที่มี `ocr_text` อยู่แล้ว | `ocr_text_bak` มี snapshot ค่าเดิมก่อนทับ — กู้คืนได้ถ้า extract ผิดพลาด | ADR-054 D5 |
| 1D.12 | หลัง commit/import สำเร็จ เปิด queue item เดิม | record ไม่ถูกลบ (status=IMPORTED) + `imported_correspondence_public_id` link ไปยัง correspondence | ADR-054 D10 |

### 1E. AI Staging — Human-in-the-Loop (Spec 250/254)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1E.1 | ล็อกอิน editor01, เข้า `/ai-staging` | แสดง staging queue พร้อม AiStatusBanner | 250 US1 |
| 1E.2 | กรอง "needs review" | แสดงเฉพาะรายการที่ requiresHumanReview = true | 250 FR-003, US1 AC2 |
| 1E.3 | เรียง queue ตาม OCR quality | รายการเรียงจาก worst → best (หรือกลับกัน) | 250 FR-004, US1 AC3 |
| 1E.4 | approve รายการที่ resolve flagged field ครบ | commit สำเร็จ, category/tags ถูก apply (human-in-the-loop) | 250 FR-012, SC-007 |
| 1E.5 | ตรวจ category ที่ commit | category อยู่ใน approved list เท่านั้น (0% invalid) | 250 FR-005, SC-003 |

### 1F. Engine Control Center (Spec 248)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1F.1 | ล็อกอิน superadmin, เข้า `/admin/ai/system` | แสดง Host CPU/Mem/Temp/GPU + Ollama/VRAM table + 5 queue cards | 248 US1 AC1, FR-005 |
| 1F.2 | รอ 10 วินาที | metric cards auto-refresh โดยไม่ reload page | 248 US1 AC2, SC-005 |
| 1F.3 | คลิก queue card `ai-batch` | slide-over drawer แสดง jobs (Job ID, Type, Status, Error Reason) + filter tabs + pagination | 248 US3 AC1, FR-011 |
| 1F.4 | filter "Failed" + คลิก Retry บน failed job | job re-enqueue + audit log | 248 US3 AC3, FR-012/015 |
| 1F.5 | คลิก "Clear Failed" บน queue ที่มี failed jobs | enqueue async cleanup + progress toast + รายงาน cleared count | 248 US4 AC1/2, FR-013 |
| 1F.6 | พยายาม Load model ขณะมี active/waiting job | ระบบ block ด้วย 409 Conflict | 248 US2 AC3, FR-007 |
| 1F.7 | ตรวจ model name ใน panel | แสดง `np-dms-ai`/`np-dms-ocr` ไม่ใช่ runtime name | 235 SC-002, US1 AC3 |

---

## 4. Phase 2: Backend Unit Tests (P2)

> ปิด coverage gap — เน้นไฟล์ที่มี coverage < 80% หรือ branch ไม่ถูกทดสอบ

### 2A. Intent Classifier (Spec 224) — coverage gap

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 2A.1 | unit test `pattern-matcher.service` กรณี Pattern Conflict 2 รายการ match | priority ต่ำสุด (เลขน้อยสุด) ชนะ | 224 Edge Case 3, FR-006 |
| 2A.2 | unit test `llm-semaphore.service` ส่ง 4 concurrent LLM calls | รายการที่ 4+ ได้ `FALLBACK` confidence 0 + log warning | 224 Edge Case 5, FR-008 |
| 2A.3 | unit test `intent-pattern.service` บันทึก regex invalid | validate ตอนบันทึก + แสดง error ก่อน save | 224 Edge Case 4 |
| 2A.4 | unit test `intent-classifier.service` LLM unavailable/timeout | return `FALLBACK` + log LLM Error ไม่ crash | 224 Edge Case 2, FR-009 |
| 2A.5 | unit test `classification-audit.service` ทุก request | บันทึก input, output, method, latency, projectPublicId, userPublicId | 224 FR-010, SC-006 |
| 2A.6 | unit test `intent-pattern-cache.service` cache miss + thundering herd | query DB ครั้งเดียว + update cache | 224 Edge Case 1, FR-005 |

### 2B. RAG Retrieval Guard & Stale Validation (Spec 254) — accuracy-critical

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 2B.1 | unit test `rag-retrieval-guard.service` ผล Qdrant ที่ generation RETIRED | exclude ก่อนส่ง LLM | 254 FR-030/031, SC-003 |
| 2B.2 | unit test ผล Qdrant ที่ generation missing ใน MariaDB | exclude + ไม่ crash | 254 FR-031, Edge Case |
| 2B.3 | unit test ไม่มี valid ACTIVE chunk เหลือ | fallback keyword/full-text + บันทึก reason | 254 FR-032, US2 AC3 |
| 2B.4 | unit test `rag-citation.service` สร้าง citation | มี Attachment identity, owner, locator, segment, offsets, snippet, score, chunkPublicId — ไม่มี generation_uuid | 254 FR-033/034, SC-004 |
| 2B.5 | unit test `rag-generation-swap.service` concurrent swap 2 requests | ชนะ 1 + exactly one ACTIVE (Redlock + DB tx) | 254 FR-009/010, SC-005 |
| 2B.6 | unit test `rag-attachment-ingestion.service` checksum mismatch | generation = FAILED + ไม่ activate + error reason | 254 FR-004, US1 AC4 |
| 2B.7 | unit test `rag-classification.service` override โดย user ไม่มีสิทธิ์ | reject + user-friendly permission error | 254 FR-042, US5 AC2 |
| 2B.8 | unit test metadata-only sync (content unchanged) | update MariaDB + Qdrant metadata โดยไม่ re-embed | 254 FR-018/044, SC-006 |

### 2C. Metadata Extraction Contract (Spec 250) — coverage gap (branches 61.63%)

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 2C.1 | unit test AI output มี confidence นอก valid range | flag failed/needing manual attention ไม่ silent accept | 250 FR-010, SC-005, Edge Case |
| 2C.2 | unit test AI suggest category นอก approved list | flag + ไม่ save | 250 FR-005, SC-003 |
| 2C.3 | unit test OCR produced nothing | flag requiresHumanReview by default | 250 Edge Case, FR-002 |
| 2C.4 | unit test tag ที่มี casing/spacing ต่างแต่มีอยู่แล้ว | treat as existing (ไม่ mark new) | 250 Edge Case, FR-006 |
| 2C.5 | unit test resolve flagged field A ไม่ clear flag field B | per-field tracking | 250 FR-014, SC-007 |
| 2C.6 | unit test legacy queue item (old format) | visible แต่ unreviewable จนกว่าจะ re-extract | 250 FR-011, SC-006 |

### 2D. Migration Compare (Spec 242)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 2D.1 | unit test `review-threshold.service` ปรับเกณฑ์ runtime | มีผลกับรายการที่ประมวลผลหลังเปลี่ยนเท่านั้น + audit | 242 FR-010c/010d, SC-011 |
| 2D.2 | unit test `metadata-resolution.service` ค่าอ้างอิงไม่มีในระบบ | บันทึก linked-failed + ค่าที่หาไม่พบ โดยไม่ fail ทั้งชุด | 242 FR-019, US4 AC2 |
| 2D.3 | unit test `rag-batch.service` รันซ้ำชุดเดิม | ไม่สร้างข้อมูลซ้ำ (0 รายการซ้ำ) | 242 FR-020/025, SC-010 |
| 2D.4 | unit test compare ข้อความว่าง/สั้นเกินไป | status "เปรียบเทียบไม่ได้" ไม่ใช่ "ทุกช่องไม่ตรง" | 242 FR-012a, Edge Case |

### 2E. Migration Metadata Separation (ADR-054) — data-loss regression

> ครอบคลุม "Tests ที่ต้องเพิ่ม" ใน ADR-054 — ป้องกัน incident OCR text หายถาวร (183 records, 2026-09-14) ซ้ำ

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 2E.1 | unit test `reExtractQueueItem` reset `ai_metadata_json` | `review_state_json` (fieldResolutions) ไม่ถูกแตะต้อง | ADR-054 D9/D3 |
| 2E.2 | unit test reset ไม่ลบ `storage_temp_path`, `original_filename`, `attachment_ids`, `temp_attachment_ids` | ingestion metadata อยู่ใน column ของตัวเอง ไม่ใช่ JSON bag | ADR-054 D1/D2/D3 |
| 2E.3 | unit test extractor เมื่อ `storage_temp_path` + `details.source_file_path` ว่าง | fallback ดึง `attachments.file_path` ผ่าน `tempAttachmentIds[0]` — ไม่เกิด NO_PDF placeholder | ADR-054 D4 |
| 2E.4 | unit test re-extract สำเนา `ocr_text` → `ocr_text_bak` ก่อนเขียนทับ | `ocr_text_bak` = ค่าเดิม; จำลองทับผิดพลาดแล้วกู้จาก bak ได้ | ADR-054 D5 |
| 2E.5 | unit test `MigrationReviewService` เขียน fieldResolutions | เขียนลง `review_state_json` เท่านั้น — `ai_metadata_json` ไม่มี fieldResolutions; `AiBatchProcessor` ไม่แตะ `review_state_json` | ADR-054 D9 |
| 2E.6 | unit test `approveQueueItem` สำเร็จ | status=IMPORTED + `reviewedBy`/`reviewedAt` + `imported_correspondence_public_id` — record ไม่ถูกลบ | ADR-054 D10 |
| 2E.7 | unit test `ai_confidence` column vs `metadata.confidence.*` | column = alias ของ min(per-field confidence) — ไม่ diverge จาก JSON SoT | ADR-054 D7 |

> หมายเหตุ: ADR-054 D8 (bulk operation protocol: backup → preflight → canary → verify → bulk → log → rollback) เป็น process discipline ไม่ได้บังคับผ่าน code — ตรวจด้วย dry-run checklist ตอนทำ bulk operation จริงบน production (ดู §11 ตารางความเสี่ยง)

---

## 5. Phase 3: Integration Tests (P2)

> End-to-end flow ข้ามหลาย queue — ใช้ `ai-rag-pipeline.integration.spec.ts` pattern เป็นฐาน

### 3A. RAG Prepare → Ingest → Query → Answer (Spec 234/254)

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 3A.1 | submit Correspondence DRAFT→IN_REVIEW | enqueue `rag-prepare` ใน `ai-batch` ภายใน 1s โดยไม่ block response | 234 FR-010/012, SC-004 |
| 3A.2 | รอ `rag-prepare` job เสร็จ | Qdrant มี chunks พร้อม `project_public_id`, `doc_number`, `status_code`, `chunk_topic` | 234 FR-008, US2 AC2 |
| 3A.3 | verify `rag-prepare` ลบ points เก่าก่อน upsert ใหม่ (revision ใหม่) | 0 stale chunks | 234 FR-011, SC-006 |
| 3A.4 | verify `rag-attachment-ingest` (ai-rag-ingest) สร้าง ACTIVE generation | exactly one ACTIVE + checksum verified | 254 FR-002/006, SC-001/002 |
| 3A.5 | ส่ง RAG query ใน Project A | embed query → Qdrant Hybrid topK=15 (filter project_public_id) → rerank top 3-5 → LLM answer + citation | 234 FR-013/014/015, 254 FR-026 |
| 3A.6 | ตรวจ Qdrant search payload | filter `project_public_id` เป็น mandatory (ไม่มี query ที่ไม่ filter) | 254 FR-026, ADR-023A |
| 3A.7 | retire generation แล้ว query | skip RETIRED + fallback keyword + ไม่ expose RETIRED content | 254 FR-030/031/032, SC-003 |
| 3A.8 | trigger `ai-vector-deletion` หลัง retire | Qdrant points ของ RETIRED ถูกลบ + MariaDB retain จน cleanup สำเร็จ | 254 FR-028, SC-007 |

### 3B. Migration Compare → Review → Commit → Batch Embed (Spec 242/250)

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 3B.1 | enqueue `migrate-document` (ai-batch) สำหรับเอกสาร 20 ฉบับ | AI Compare รายช่อง + ระดับความเชื่อมั่น | 242 FR-006/007/008 |
| 3B.2 | verify OCR text persist ตั้งแต่ขั้นนำเข้า | `attachments.ocr_text` มีค่า + ไม่อ่านซ้ำ | 242 FR-013/014, SC-006, ADR-042 |
| 3B.3 | enqueue `legacy-ai-enrichment` (ai-batch) | ผล ocrQuality + per-field metadata.confidence + requiresHumanReview | 250 FR-001/002 |
| 3B.4 | reviewer approve ใน `/ai-staging` → commit | category/tags apply หลัง human review (ไม่ auto) | 250 FR-012, SC-007 |
| 3B.5 | รัน batch RAG embed (FR-021) สำหรับชุดนำเข้า | เอกสารทุกฉบับที่มีข้อความอ่านได้ถูกเตรียม semantic search | 242 FR-021/022/023, SC-007 |
| 3B.6 | รัน batch embed ซ้ำชุดเดิม | ไม่สร้างข้อมูลค้นหาซ้ำซ้อน | 242 FR-025, SC-010 |
| 3B.7 | semantic search เอกสารเก่าด้วยคำใกล้เคียง (ไม่ตรงคำ) | พบเอกสารเก่าภายใน 2 วินาที | 242 US3 AC6, SC-008 |
| 3B.8 | ตรวจ project isolation ใน semantic search | ไม่เห็นเอกสารโครงการอื่น | 242 FR-030, SC (isolation) |
| 3B.9 | E2E: review → resolve fields → re-extract → commit | AI output คำนวณใหม่ + review state คงอยู่ + `ocr_text` ไม่หาย + `ocr_text_bak` มี snapshot + commit สำเร็จ | ADR-054 D3/D5/D9 |
| 3B.10 | หลัง import สำเร็จ ตรวจ queue item | status=IMPORTED, ไม่ถูกลบ + `imported_correspondence_public_id` link ไปยัง correspondence จริง (reverse lookup ได้) | ADR-054 D10 |

### 3C. Queue Policy & BullMQ Reliability (Spec 235/248, ADR-008)

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 3C.1 | ส่ง generation-heavy job (rag-query) เข้า `ai-realtime` | redirect ไป `ai-batch` + log | 235 US4 AC2, queue-policy.spec |
| 3C.2 | ส่ง 2 intent classification jobs พร้อมกัน | รันพร้อมกันใน `ai-realtime` (concurrency 2) | 235 US4 AC1 |
| 3C.3 | มี realtime job active + ส่ง ai-batch job | ai-batch ถูก pause จน realtime สำเร็จ | 235 US4 AC3, queue-policy.spec |
| 3C.4 | BGE-M3 sidecar ไม่พร้อม → `rag-prepare` fail | retry 3 ครั้ง (ADR-008) + dead-letter | 234 Edge Case, ADR-008 |
| 3C.5 | Qdrant ไม่พร้อม → `rag-prepare` fail | retry + dead-letter | 234 Edge Case, ADR-008 |
| 3C.6 | ส่ง `rag-prepare` ซ้อนจากหลาย user พร้อมกัน | idempotency key ป้องกัน duplicate jobs | 234 Edge Case, FR-010 |
| 3C.7 | Load/Unload model ระหว่างมี job active | 409 Conflict + 503 enqueue intercept (transition lock) | 248 FR-007/009, Edge Case |
| 3C.8 | enqueue ระหว่าง model transition (TOCTOU) | `AiQueueService` ปฏิเสธด้วย 503 | 248 Edge Case, FR-009 |

---

## 6. Phase 4: Performance & Accuracy Benchmarks (P3)

> วัดตาม Success Criteria ที่กำหนดในแต่ละสเปค — ใช้ชุดทดสอบที่ทราบคำตอบ (golden set)

### 4A. Accuracy — SC-002 (Core ของแผนนี้)

| Test | เกณฑ์ | วิธีวัด | SC |
|------|-------|--------|----|
| 4A.1 | RAG Q&A ตอบถูก ≥ 80% | golden set `fixtures/sc002-golden-set.json` (7 RAG queries — ขยายเป็น 50 คำถามเพื่อ statistical significance) → นับ % ที่ตอบถูก + อ้างเอกสารถูก | 234 SC-002 |
| 4A.2 | Migration ตรวจพบ mismatch จริง ≥ 90% | golden set 5 ฉบับ (human-verified) + full population 265 records (Excel `C22024-265.xlsx`, batch `BATCH-C2-2567-005`) ผ่าน `scripts/sc002-accuracy-compare.ts` → นับ % ที่ตรวจพบ mismatch จริง | 242 SC-002 |
| 4A.3 | Migration false mismatch ≤ 10% | golden set → นับ % ที่แจ้ง mismatch แต่จริง ๆ ตรงกัน | 242 SC-003 |
| 4A.4 | Intent LLM Fallback confidence ≥ 0.7 (เฉลี่ย) | 50 คำถามที่ต้องใช้ LLM → นับ avg confidence | 224 SC-003 |
| 4A.5 | Pattern hit 70-80% | 100 คำถามทั่วไป → นับ % ที่ classify ด้วย Pattern (ไม่เรียก LLM) | 224 SC-001 |
| 4A.6 | 0% cross-project leak | ถามใน Project A ด้วยเนื้อหา Project B → นับ % ที่รั่ว (ต้องเป็น 0) | 234 SC-003, 254 SC-009 |
| 4A.7 | 0 RETIRED/FAILED ใน RAG response | query หลัง retire → นับ % ที่มี RETIRED (ต้อง 0) | 254 SC-003 |
| 4A.8 | ≥ 99% citation ครบ | 100 indexed chunks → นับ % ที่ citation มี Attachment + segment | 254 SC-004 |
| 4A.9 | 100% ACTIVE มี checksum + scope เดียว | scan ACTIVE generations → นับ % ที่ verified checksum + 1 owner | 254 SC-002 |
| 4A.10 | exactly one ACTIVE หลัง concurrent ingest | race 5 concurrent ingest → นับ ACTIVE (ต้อง 1) | 254 SC-005 |

### 4B. Latency Benchmarks

| Test | เกณฑ์ | วิธีวัด | SC |
|------|-------|--------|----|
| 4B.1 | LLM Fallback latency < 2000ms (Pattern + LLM) | 50 คำถาม LLM fallback → วัด p95 latency | 224 SC-002 |
| 4B.2 | Pattern match latency < 10ms | 50 คำถาม pattern hit → วัด p95 | 224 SC-001 |
| 4B.3 | `rag-prepare` ไม่ delay workflow submit > 500ms | วัดเวลาตั้งแต่กด submit จน response กลับ | 234 SC-004 |
| 4B.4 | RAG embed พร้อมค้นหาได้ภายใน 5 นาที | วัดเวลาตั้งแต่ submit จน Qdrant มี points | 234 SC-001 |
| 4B.5 | Host metrics endpoint < 10ms (target < 5ms) | `GET /ai/admin/host/metrics` จาก Redis cache | 248 SC-001 |
| 4B.6 | Clear 10,000 failed jobs < 5 วินาที | seed 10k failed → trigger clear-failed → วัดเวลา | 248 SC-004 |
| 4B.7 | Semantic search ผลลัพธ์ < 2 วินาที | ค้นหาเอกสารเก่า → วัดเวลา | 242 SC-008 |
| 4B.8 | OCR 1 page < 60 วินาที | OCR เอกสาร 1 หน้า → วัด per-page | 232 SC-002 |

### 4C. Fallback & Resilience Accuracy

| Test | เกณฑ์ | วิธีวัด | SC |
|------|-------|--------|----|
| 4C.1 | RAG query ยังตอบได้ 100% บน CPU fallback | จำลอง GPU pressure → ยิง rag-query → นับ % สำเร็จ | 235 SC-004, US3 |
| 4C.2 | Single engine `np-dms-ocr` เท่านั้น — ⚠️ Tesseract fallback ถูกยกเลิกโดย ADR-040 D1 | ปิด Ollama → OCR ต้อง flag FAILED + user-friendly error โดย **ไม่** fallback ไป engine อื่น + audit log | 232 SC-003 (superseded), ADR-040 D1 |
| 4C.3 | fixed-size chunking fallback (ไม่มี `<chunk>` tag) | LLM output ไม่มี tag → verify fallback 512/64 ไม่ error | 234 FR-005, US3 AC3 |
| 4C.4 | 50 concurrent users ไม่ semaphore overflow > 5% | 50 users พร้อมกัน → นับ % overflow | 224 SC-004 |
| 4C.5 | rag-prepare ข้ามเอกสารไม่มี attachment | ไม่ error + log warning | 234 Edge Case |
| 4C.6 | OCR text < 50 chars ข้าม chunking + embedding | ไม่ error + log | 234 Edge Case |

---

## 7. Phase 5: Security & RBAC Tests (P2)

> ADR-016 RBAC + ADR-023A AI Boundary + ADR-019 UUID + ADR-008 BullMQ + ADR-007 Error

### 5A. RBAC — ทุก AI endpoint ต้องมี test สำหรับ 4 roles

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 5A.1 | viewer01 เรียก Intent Classification API | อนุญาต (read) หรือ block ตาม CASL — ไม่ใช่ 500 | 224 FR-014, ADR-016 |
| 5A.2 | editor01 พยายาม Load/Unload model (`/ai/admin/models/*/vram/*`) | block 403 (ต้อง `system.manage_all`) | 248 FR-014, ADR-016 |
| 5A.3 | admin พยายาม classification override โดยไม่มี `document.classification_override` | block + user-friendly permission error | 254 FR-042, US5 AC2 |
| 5A.4 | viewer01 พยายาม batch RAG embed / batch link | block (admin-only) | 242 FR-027, ADR-016 |
| 5A.5 | viewer01 พยายาม Clear Failed jobs | block (Superadmin) | 248 FR-014 |
| 5A.6 | ทุก mutation AI endpoint ไม่มี `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` | CI/ESLint ต้อง fail | ADR-016, Tier 1 |

### 5B. AI Boundary (ADR-023/023A)

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 5B.1 | grep โค้ด: AI module เรียก DB/Storage โดยตรง (bypass DMS API) | ไม่พบ (AI → DMS API → DB เท่านั้น) | ADR-023/023A, 02-security |
| 5B.2 | Qdrant search ที่ไม่ส่ง `projectPublicId` | throw error + ไม่ return ผล | 254 FR-026, ADR-023A |
| 5B.3 | n8n เรียก Ollama/Qdrant โดยตรง | ไม่พบ (ต้องผ่าน DMS API → BullMQ) | ADR-023A, 02-security |
| 5B.4 | AI output ถูก apply อัตโนมัติโดยไม่ผ่าน human review | ไม่พบ (human-in-the-loop บังคับ) | 250 FR-012, ADR-023A |

### 5C. UUID, Idempotency, Audit Trail (ADR-019/016/008)

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 5C.1 | ตรวจ AI API responses | ใช้ `publicId` (UUIDv7) ไม่ expose INT PK; ไม่มี `parseInt` บน UUID | ADR-019, 01-adr-019 |
| 5C.2 | ตรวจ citation | ใช้ `chunkPublicId`/`attachmentPublicId` (UUIDv7) ไม่ใช่ `generation_uuid` | 254 FR-005/019/034, ADR-019 |
| 5C.3 | POST/PUT/PATCH AI mutation ไม่มี `Idempotency-Key` | reject ด้วย validation error | ADR-016, 02-security |
| 5C.4 | ทุก AI interaction (classify, rag-query, compare, override) | มี audit log ครบ (actor, action, before/after, timestamp) | 224 FR-010, 248 FR-015, 254 FR-043, ADR-016 |
| 5C.5 | mutation Load/Unload/Retry/Delete/Clear-Failed | มี `@Audit()` decorator + structured audit log | 248 FR-015, SC-003 |
| 5C.6 | classification override | audit before/after/reason/actor/timestamp | 254 FR-043, SC-010 |

### 5D. Error Handling (ADR-007)

| ขั้นตอน | การกระทำ | ผลที่คาดหวัง | FR/Spec |
|---------|---------|-------------|---------|
| 5D.1 | LLM unavailable ระหว่าง classify | `FALLBACK` + user-friendly + log technical | 224 Edge Case 2, ADR-007 |
| 5D.2 | AI output malformed | flag needing manual attention ไม่ silent broken data | 250 FR-010, SC-005, ADR-007 |
| 5D.3 | Qdrant upsert สำเร็จแต่ MariaDB activation fail | rollback/handle ไม่ leave inconsistent state | 254 Edge Case, ADR-007 |
| 5D.4 | AI features unavailable (model unload) ระหว่าง submit | 503 `AI_FEATURES_UNAVAILABLE` + wait dialog (ไม่ toast crash) | rag-playground page, ADR-007 |

---

## 8. ไฟล์ทดสอบสรุป

### 8.1 ไฟล์ที่มีอยู่ (อ้างอิง ไม่ทำซ้ำ)

| ไฟล์ | ครอบคลุม | สถานะ |
|------|----------|-------|
| `backend/src/modules/ai/ai-rag-pipeline.integration.spec.ts` | RAG pipeline E2E (SC-002 gap fix) — enqueueRagPrepare dedup, EmbeddingService, project isolation | มีอยู่ |
| `backend/src/modules/ai/tests/queue-policy.spec.ts` | ai-realtime/ai-batch redirect + pause/resume | มีอยู่ |
| `backend/src/modules/ai/processors/rag.processor.spec.ts` | QUEUE_AI_RAG = `ai-rag-query` | มีอยู่ |
| `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | rag-prepare + embed-document (ADR-042) | มีอยู่ |
| `backend/src/modules/ai/processors/rag-attachment-ingest.processor.spec.ts` | ai-rag-ingest | มีอยู่ |
| `backend/src/modules/ai/intent-classifier/services/*.spec.ts` (9 files) | intent classifier services | มีอยู่ |
| `specs/999-test-plan/rag-admin-console-unified-test-plan.md` | `/admin/ai/rag-console` UI (5 tabs) | มีอยู่ — ไม่ทำซ้ำ |
| `specs/999-test-plan/fixtures/sc002-golden-set.json` | Golden set v2.0.0 — 5 docs + 7 intent queries + 7 RAG queries + 5 metadata extraction (human-verified) | มีอยู่ |
| `specs/999-test-plan/scripts/sc002-accuracy-compare.ts` | เปรียบเทียบ AI output กับ golden set + full population stats + threshold recommendations | มีอยู่ |
| `specs/999-test-plan/sc002-execution-report.md` | ผลทดสอบรอบแรก 2026-09-14 (5/5 docs, 7/7 RAG, 7/7 intent, regression 3 รอบ variance=0) | มีอยู่ |

### 8.2 ไฟล์ทดสอบที่แนะนำให้สร้าง/เพิ่ม (gap fix)

| ไฟล์ (แนะนำ) | Phase | ครอบคลุม |
|---------------|-------|----------|
| `backend/src/modules/ai/intent-classifier/services/pattern-matcher.service.spec.ts` (เพิ่ม case) | 2A | Pattern Conflict, regex invalid |
| `backend/src/modules/ai/intent-classifier/services/llm-semaphore.service.spec.ts` (เพิ่ม case) | 2A | Semaphore overflow |
| `backend/src/modules/ai/services/rag-retrieval-guard.service.spec.ts` (เพิ่ม case) | 2B | RETIRED/FAILED/missing validation |
| `backend/src/modules/ai/services/rag-generation-swap.service.spec.ts` (เพิ่ม case) | 2B | concurrent swap race |
| `backend/src/modules/ai/services/rag-classification.service.spec.ts` (เพิ่ม case) | 2B/5A | override permission |
| `backend/src/modules/migration/*.spec.ts` (เพิ่ม case) | 2C/2D | metadata contract coverage gap (branches 61.63% → ≥70%) |
| `backend/src/modules/ai/ai-pipeline-accuracy.integration.spec.ts` (ใหม่) | 3A/4A | golden set accuracy E2E |
| `frontend/components/ai/__tests__/ai-chat-panel.test.tsx` (เพิ่ม case) | 1C | cross-project leak + retry |
| `e2e/ai-classification-accuracy.spec.ts` (ใหม่ — Playwright) | 1A/1B/1D | Browser E2E accuracy |

---

## 9. ลำดับการทำ (Execution Order)

1. **Phase 1 (P1) — Browser E2E** ก่อน: 1A (Intent Test Console) → 1B (RAG Playground) → 1D (Migration Review) → 1E (AI Staging) → 1F (Engine Control) → 1C (Document Chat)
   - เหตุผล: ยืนยันว่า pipeline ทำงานได้จริงบน production ก่อนเจาะ unit/integration
2. **Phase 3 (P2) — Integration** คู่กับ Phase 1: 3A (RAG prepare→query) → 3B (migration→commit→embed) → 3C (queue policy)
3. **Phase 2 (P2) — Backend Unit**: 2C (metadata contract — coverage gap ใหญ่สุด) → 2B (retrieval guard) → 2A (intent) → 2D (migration compare)
4. **Phase 5 (P2) — Security & RBAC**: 5A (RBAC 4 roles) → 5B (AI boundary) → 5C (UUID/audit) → 5D (error)
5. **Phase 4 (P3) — Performance & Accuracy**: 4A (accuracy golden set — ใช้ `fixtures/sc002-golden-set.json` + รัน `scripts/sc002-accuracy-compare.ts` เทียบผล) → 4B (latency) → 4C (fallback)
   - ทำทีหลังเพราะต้องเตรียม environment (GPU pressure จำลอง) — golden set + compare script พร้อมแล้ว (2026-09-14)

---

## 10. เกณฑ์ผ่าน (Acceptance Criteria)

- [x] Pipeline smoke รอบแรกผ่าน 2026-09-14 — golden set 5/5 docs, RAG 7/7 queries, Intent 7/7 (1 partial), regression 3 รอบ variance=0 (ดู `sc002-execution-report.md`)
- [ ] ข้อมูลทดสอบพร้อมครบตาม §2.1 (D1–D12) — โดยเฉพาะ D4, D9, D10, D12 ที่เป็น blocker ของ Phase 4
- [ ] Phase 1: ทุก Browser E2E case ผ่าน, console errors = 0, ไม่มี 5xx ใน network
- [ ] Phase 2: Backend coverage branches ≥ 70%, functions ≥ 70% (ปิด gap 250 ที่ 61.63%/58.33%); business logic ≥ 80%
- [ ] Phase 3: Integration flow ครบทุก queue (`ai-realtime`, `ai-batch`, `ai-rag-query`, `ai-rag-ingest`, `ai-vector-deletion`) ผ่าน + retry/dead-letter ทำงาน
- [ ] Phase 4: ทุก SC-002 ผ่าน — RAG ≥ 80%, Migration detect ≥ 90%, false mismatch ≤ 10%, Intent confidence ≥ 0.7, cross-project leak 0%
- [ ] Phase 5: ทุก AI endpoint มี RBAC test 4 roles, AI boundary ไม่ถูกทะลุ, UUID compliance, audit log ครบ
- [ ] ADR-054 regression: re-extract ไม่ทำลาย `review_state_json`/`ocr_text`/`storage_temp_path`, `ocr_text_bak` มี snapshot, import แล้ว record ไม่ถูกลบ (1D.9-12, 2E, 3B.9-10)
- [ ] ไม่มี `parseInt`/`Number`/`+` บน UUID ใน AI test หรือโค้ด (ADR-019)
- [ ] ทุก test case ครอบคลุม error path ไม่ใช่แค่ happy path (ADR-007)

---

## 11. ความเสี่ยงและการจัดการ

| ความเสี่ยง | ผลกระทบ | การจัดการ |
|-----------|--------|-----------|
| Ollama/Qdrant ไม่พร้อมบน production ตอนทดสอบ | E2E fail ทั้ง phase | ตรวจ `GET /ai/admin/host/metrics` + `GET /ai/admin/health` ก่อนเริ่ม; ทดสอบบน staging ถ้า production ไม่พร้อม |
| Golden set ขนาดเล็ก (5 docs / 7+7 queries) | สถิติ accuracy ไม่ significant | ✅ บรรเทาแล้ว — `fixtures/sc002-golden-set.json` v2.0.0 + `scripts/sc002-accuracy-compare.ts` + ชุดข้อมูลจริง 265 records (`C22024-265.xlsx` + PDF `incoming/08C.2/2567`); residual: ขยาย golden set เป็น 50 RAG queries + 100 docs |
| GPU pressure จำลองยาก (CPU fallback test) | 4C.1 ทดสอบไม่ได้ | ใช้ Ollama unload model จำลอง VRAM ไม่พอ + sidecar log `device: "cpu"` |
| RAG accuracy ขึ้นกับ model version (typhoon2.5-np-dms:latest — ยืนยันจาก `GET /ai/admin/models` 2026-09-14) | ผลไม่ stable | บันทึก model version ใน test report; รันซ้ำ 3 ครั้งเพื่อยืนยัน (รอบแรก variance=0.0000 — deterministic) |
| BullMQ job รอนาน (ai-batch lockDuration 700s) | Phase 3 ช้า | ใช้ test queue แยก + mock Ollama สำหรับ integration ที่ไม่ต้องการ model จริง |
| ทดสอบบน production อาจกระทบข้อมูล | ข้อมูล production เสียหาย | ใช้ project test `LCBP3-C2` เท่านั้น (projectPublicId `01a01992-8420-74ff-b0f4-0c8560a8478c`, batch `BATCH-C2-2567-005`); ห้าม commit migration จริง โดยไม่ได้รับอนุญาต; ใช้ read-only verify สำหรับ accuracy |
| Bulk operation บน `migration_review_queue` (reset/re-extract หลายรายการ) | data loss ถาวร — เคยเกิดจริง 2026-09-14 (OCR text 183 records หาย) | ปฏิบัติตาม ADR-054 D8 protocol เสมอ: backup table → preflight → canary 1 record → verify → bulk → log → มี rollback path |
| 250 coverage gap ใหญ่ (branches 61.63%) | ปิด gap นาน | ทำ 2C ก่อนใน Phase 2; target ≥ 70% ไม่ใช่ 80% (ตาม threshold) |

---

## 12. ผลการทดสอบรอบล่าสุด (Execution Status — 2026-09-14)

> รอบแรกรันบน production https://lcbp3.np-dms.work (session-only authorization) — รายละเอียดเต็มใน `sc002-execution-report.md`

| ขั้นตอน | ผล | หมายเหตุ |
|---------|-----|---------|
| Migration Import (commit_batch) | ✅ 5/5 | Correspondence IDs 61-65, 0 failed |
| OCR + AI Extraction | ✅ 5/5 | confidence 0.90-0.97, OCR quality 0.80-0.95 |
| RAG Ingest + Vector Embedding | ✅ 5/5, 106 vectors | rag_status = INDEXED, ACTIVE generations + checksum ครบ |
| RAG Query | ✅ 7/7 | ครอบคลุม typo, mixed-lang, ambiguity, cross-doc |
| Intent Classification | ✅ 7/7 (1 partial) | Pattern 4 + LLM fallback 3 |
| AI Admin Console / Runtime Policy / Queue ops | ✅ | 10/10 endpoints, 5 profiles, edge cases |
| Regression (3 รอบ) | ✅ | variance=0.0000 (deterministic) |
| AI Compare | ✅ 5/5 | COMPARED ทั้งหมด, ai_metadata_json ครบ |

**Bugs ที่พบและแก้ระหว่างทดสอบ** (3 commits): `12797794` (rag_status, SQL columns, chunking timeout), `fed11419` (duplicate vectors, B13 queue split, import status), `b18e49f7` (chunk_text enrichment)

**งานคงค้างจากรอบแรก**: accuracy threshold recalibration (ต้องรอ 100-500 docs), golden set expansion (5→100 docs, 7→50 RAG queries), coverage gap ของ spec 250 (branches 61.63% → ≥70%), ADR-054 regression tests (§2E — re-extract ต้องไม่ทำลาย review state/OCR text)

> ⚠️ ระหว่างทดสอบรอบแรกเกิด data-loss incident: reset `ai_metadata_json` ทั้ง bag ทำให้ `source_file_path` หาย → OCR text 183 records หายถาวร (ต้อง re-OCR ~3 ชม.) — เป็นที่มาของ ADR-054 และ test cases §1D.9-12, §2E, §3B.9-10 ในแผนนี้

---

## 13. งานที่เกี่ยวข้อง (Cross-Reference)

| สเปค/เอกสาร | ความสัมพันธ์ |
|-------------|-------------|
| `sc002-execution-report.md` | ผลทดสอบรอบแรก 2026-09-14 — evidence ของแผนนี้ |
| `fixtures/sc002-golden-set.json` | Golden set v2.0.0 สำหรับ Phase 4A accuracy benchmark |
| `scripts/sc002-accuracy-compare.ts` | Script เทียบ AI output กับ golden set + threshold recommendations |
| `rag-admin-console-unified-test-plan.md` | ครอบคลุม `/admin/ai/rag-console` UI — แผนนี้ไม่ทับซ้ำ (เน้น accuracy ของ pipeline แทน) |
| `migration-admin-unified-test-plan.md` | ครอบคลุม `/admin/migration` UI flow — แผนนี้เน้น AI Compare accuracy (242 SC-002) |
| `109-speckit-tester` | รัน test ตามแผนนี้ — handoff ไป |
| `e2e-testing` | Playwright patterns สำหรับ Phase 1 |
| `check-real-app` | browser verify จริงใน Phase 1 |
| `112-speckit-security-audit` | Phase 5 Security & RBAC |
| `verification-loop` | build → typecheck → lint → test → security → diff |
| ADR-024 | Intent Classification Strategy (Pattern → LLM Fallback) |
| ADR-029 | Dynamic Prompt Management (prompt จาก DB + Redis cache) |
| ADR-040 | OCR Sidecar Refactor — single engine np-dms-ocr, ยกเลิก Tesseract fallback (D1), ตัด /normalize (D2) |
| ADR-041 | Server Consolidation — AI runtime อยู่บน np-dms-lcbp3 |
| ADR-042 | OCR text persistence |
| ADR-043 | AI Architecture Current State (Single Source of Truth) |
| ADR-048 | AI Engine Control Center |
| ADR-050 | AI Metadata Extraction Output Contract (ข้อ 2 superseded โดย ADR-054) |
| ADR-054 | Migration Review Queue Metadata Separation — OCR text protection, review_state_json, ocr_text_bak, bulk op protocol (เกิดจาก incident 2026-09-14) |
