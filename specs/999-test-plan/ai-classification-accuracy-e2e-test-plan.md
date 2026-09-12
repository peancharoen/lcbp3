// File: specs/999-test-plan/ai-classification-accuracy-e2e-test-plan.md
// Change Log:
// - 2026-09-12: Initial unified test plan — ครอบคลุมทุกกระบวนการ AI (Intent → RAG prepare → Vector → ai-realtime/ai-batch/ai-ingest/ai-rag/ai-rag-ingest) เพื่อทดสอบความแม่นยำของ AI classification แบบ end-to-end (C4 — SC-002 scenario)

# แผนการทดสอบรวม: AI Classification Accuracy E2E (C4 — SC-002)

**วันที่ร่าง**: 2026-09-12
**ขอบเขต**: ทุกกระบวนการ AI ในระบบ — Intent Classification (224) → RAG Prepare/Embed (234/254) → Vector Store (Qdrant) → Retrieval/Rerank → LLM Answer → Migration Compare (242) → Metadata Extraction (250) → Runtime Policy (235) → Engine Control (248) ครอบคลุม BullMQ queues: `ai-realtime`, `ai-batch`, `ai-rag-query`, `ai-rag-ingest`, `ai-vector-deletion`
**หมายเหตุ**: ไม่ทับซ้ำกับ `rag-admin-console-unified-test-plan.md` (ซึ่งครอบคลุมเฉพาะ UI `/admin/ai/rag-console`) — แผนนี้เน้น **ความแม่นยำของผล AI และความถูกต้องของ pipeline ต้นทางจนถึงปลายทาง**
**ADR อ้างอิง**: ADR-023/023A (AI Boundary), ADR-024 (Intent Classification), ADR-029 (Dynamic Prompts), ADR-042 (OCR Persistence), ADR-043 (AI Architecture Current State), ADR-048 (Engine Control), ADR-050 (Metadata Contract), ADR-019 (UUID), ADR-016 (RBAC), ADR-008 (BullMQ), ADR-007 (Error Handling)
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
| 11 | **232-typhoon-ocr-integration** | Typhoon OCR + Tesseract fallback | Implemented |
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
  rag-generation-cleanup / rag-metadata-sync (ai-rag-ingest)
  ai-vector-deletion (delete RETIRED points)

  ─────────  MIGRATION AI (async)  ─────────

  242 migrate-document (ai-batch) → AI Compare (ทะเบียน vs OCR)
        ▼
  250 legacy-ai-enrichment (ai-batch) → ocrQuality + per-field confidence
        ▼
  human-in-the-loop review (/ai-staging) → commit → batch RAG embed
```

### 1.4 Queue Map (จาก `backend/src/common/constants/queue.constants.ts`)

| Queue Constant | ชื่อจริง | Job Types | Concurrency | สเปค |
|----------------|---------|-----------|-------------|------|
| `QUEUE_AI_REALTIME` | `ai-realtime` | intent classification, tool-only suggest | 2 | 224, 235 |
| `QUEUE_AI_BATCH` | `ai-batch` | `rag-prepare`, `embed-document`, `rag-query`, `migrate-document`, `legacy-ai-enrichment`, `sandbox-rag` | 1 (lockDuration 700s) | 234, 242, 250, 235 |
| `QUEUE_AI_RAG` | `ai-rag-query` | `rag-query` | 1 | 234, 254 |
| `QUEUE_AI_RAG_INGEST` | `ai-rag-ingest` | `rag-attachment-ingest`, `rag-metadata-sync`, `rag-generation-cleanup`, `rag-generation-retention` | 1 | 254 |
| `QUEUE_AI_VECTOR_DELETION` | `ai-vector-deletion` | `delete-document-vectors` | — | 254 |
| `QUEUE_NP_DMS_AI` | `np-dms-ai` | model processor | — | 235 |
| `QUEUE_NP_DMS_OCR` | `np-dms-ocr` | OCR processor | — | 232, 236 |

---

## 2. โครงสร้างการทดสอบ (Phase Overview)

| Phase | สถานการณ์ที่ครอบคลุม | Priority | จำนวน cases |
|-------|---------------------|----------|-----------|
| Phase 1: Browser E2E | ทดสอบผ่านเบราว์เซอร์จริง — Intent Test Console, RAG Playground, Document Chat, Migration Review Queue, AI Staging, Engine Control Center | P1 | 26 |
| Phase 2: Backend Unit | ปิด coverage gap — intent classifier, rag retrieval guard, metadata extraction, generation swap, stale validation | P2 | 22 |
| Phase 3: Integration | End-to-end flow ข้ามหลาย queue — submit→rag-prepare→ingest→query→answer, migration compare→review→commit→batch embed | P2 | 18 |
| Phase 4: Performance & Accuracy | Benchmark ตาม SC — latency, accuracy ≥80%/≥90%, cross-project leak 0%, CPU fallback | P3 | 16 |
| Phase 5: Security & RBAC | CASL guard ทุก AI endpoint, projectPublicId filter, AI boundary, idempotency, audit trail, UUID | P2 | 14 |
| **รวม** | | | **96** |

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

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
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

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
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

---

## 5. Phase 3: Integration Tests (P2)

> End-to-end flow ข้ามหลาย queue — ใช้ `ai-rag-pipeline.integration.spec.ts` pattern เป็นฐาน

### 3A. RAG Prepare → Ingest → Query → Answer (Spec 234/254)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
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

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
|---------|---------|-------------|---------|
| 3B.1 | enqueue `migrate-document` (ai-batch) สำหรับเอกสาร 20 ฉบับ | AI Compare รายช่อง + ระดับความเชื่อมั่น | 242 FR-006/007/008 |
| 3B.2 | verify OCR text persist ตั้งแต่ขั้นนำเข้า | `attachments.ocr_text` มีค่า + ไม่อ่านซ้ำ | 242 FR-013/014, SC-006, ADR-042 |
| 3B.3 | enqueue `legacy-ai-enrichment` (ai-batch) | ผล ocrQuality + per-field metadata.confidence + requiresHumanReview | 250 FR-001/002 |
| 3B.4 | reviewer approve ใน `/ai-staging` → commit | category/tags apply หลัง human review (ไม่ auto) | 250 FR-012, SC-007 |
| 3B.5 | รัน batch RAG embed (FR-021) สำหรับชุดนำเข้า | เอกสารทุกฉบับที่มีข้อคายอ่านได้ถูกเตรียม semantic search | 242 FR-021/022/023, SC-007 |
| 3B.6 | รัน batch embed ซ้ำชุดเดิม | ไม่สร้างข้อมูลค้นหาซ้ำซ้อน | 242 FR-025, SC-010 |
| 3B.7 | semantic search เอกสารเก่าด้วยคำใกล้เคียง (ไม่ตรงคำ) | พบเอกสารเก่าภายใน 2 วินาที | 242 US3 AC6, SC-008 |
| 3B.8 | ตรวจ project isolation ใน semantic search | ไม่เห็นเอกสารโครงการอื่น | 242 FR-030, SC (isolation) |

### 3C. Queue Policy & BullMQ Reliability (Spec 235/248, ADR-008)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
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
| 4A.1 | RAG Q&A ตอบถูก ≥ 80% | golden set 50 คำถาม (เนื้อหาในเอกสาร IN_REVIEW) → นับ % ที่ตอบถูก + อ้างเอกสารถูก | 234 SC-002 |
| 4A.2 | Migration ตรวจพบ mismatch จริง ≥ 90% | golden set 100 ฉบับ (ทราบคำตอบ) → นับ % ที่ตรวจพบ mismatch จริง | 242 SC-002 |
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
| 4C.2 | OCR fallback Tesseract < 5 วินาที | ปิด Typhoon → OCR → วัดเวลา fallback | 232 SC-003 |
| 4C.3 | fixed-size chunking fallback (ไม่มี `<chunk>` tag) | LLM output ไม่มี tag → verify fallback 512/64 ไม่ error | 234 FR-005, US3 AC3 |
| 4C.4 | 50 concurrent users ไม่ semaphore overflow > 5% | 50 users พร้อมกัน → นับ % overflow | 224 SC-004 |
| 4C.5 | rag-prepare ข้ามเอกสารไม่มี attachment | ไม่ error + log warning | 234 Edge Case |
| 4C.6 | OCR text < 50 chars ข้าม chunking + embedding | ไม่ error + log | 234 Edge Case |

---

## 7. Phase 5: Security & RBAC Tests (P2)

> ADR-016 RBAC + ADR-023A AI Boundary + ADR-019 UUID + ADR-008 BullMQ + ADR-007 Error

### 5A. RBAC — ทุก AI endpoint ต้องมี test สำหรับ 4 roles

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
|---------|---------|-------------|---------|
| 5A.1 | viewer01 เรียก Intent Classification API | อนุญาต (read) หรือ block ตาม CASL — ไม่ใช่ 500 | 224 FR-014, ADR-016 |
| 5A.2 | editor01 พยายาม Load/Unload model (`/ai/admin/models/*/vram/*`) | block 403 (ต้อง `system.manage_all`) | 248 FR-014, ADR-016 |
| 5A.3 | admin พยายาม classification override โดยไม่มี `document.classification_override` | block + user-friendly permission error | 254 FR-042, US5 AC2 |
| 5A.4 | viewer01 พยายาม batch RAG embed / batch link | block (admin-only) | 242 FR-027, ADR-016 |
| 5A.5 | viewer01 พยายาม Clear Failed jobs | block (Superadmin) | 248 FR-014 |
| 5A.6 | ทุก mutation AI endpoint ไม่มี `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` | CI/ESLint ต้อง fail | ADR-016, Tier 1 |

### 5B. AI Boundary (ADR-023/023A)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
|---------|---------|-------------|---------|
| 5B.1 | grep โค้ด: AI module เรียก DB/Storage โดยตรง (bypass DMS API) | ไม่พบ (AI → DMS API → DB เท่านั้น) | ADR-023/023A, 02-security |
| 5B.2 | Qdrant search ที่ไม่ส่ง `projectPublicId` | throw/throw + ไม่ return ผล | 254 FR-026, ADR-023A |
| 5B.3 | n8n เรียก Ollama/Qdrant โดยตรง | ไม่พบ (ต้องผ่าน DMS API → BullMQ) | ADR-023A, 02-security |
| 5B.4 | AI output ถูก apply อัตโนมัติโดยไม่ผ่าน human review | ไม่พบ (human-in-the-loop บังคับ) | 250 FR-012, ADR-023A |

### 5C. UUID, Idempotency, Audit Trail (ADR-019/016/008)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
|---------|---------|-------------|---------|
| 5C.1 | ตรวจ AI API responses | ใช้ `publicId` (UUIDv7) ไม่ expose INT PK; ไม่มี `parseInt` บน UUID | ADR-019, 01-adr-019 |
| 5C.2 | ตรวจ citation | ใช้ `chunkPublicId`/`attachmentPublicId` (UUIDv7) ไม่ใช่ `generation_uuid` | 254 FR-005/019/034, ADR-019 |
| 5C.3 | POST/PUT/PATCH AI mutation ไม่มี `Idempotency-Key` | reject ด้วย validation error | ADR-016, 02-security |
| 5C.4 | ทุก AI interaction (classify, rag-query, compare, override) | มี audit log ครบ (actor, action, before/after, timestamp) | 224 FR-010, 248 FR-015, 254 FR-043, ADR-016 |
| 5C.5 | mutation Load/Unload/Retry/Delete/Clear-Failed | มี `@Audit()` decorator + structured audit log | 248 FR-015, SC-003 |
| 5C.6 | classification override | audit before/after/reason/actor/timestamp | 254 FR-043, SC-010 |

### 5D. Error Handling (ADR-007)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาน | FR/Spec |
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
5. **Phase 4 (P3) — Performance & Accuracy**: 4A (accuracy golden set) → 4B (latency) → 4C (fallback)
   - ทำทีหลังเพราะต้องเตรียม golden set และ environment (GPU pressure จำลอง)

---

## 10. เกณฑ์ผ่าน (Acceptance Criteria)

- [ ] Phase 1: ทุก Browser E2E case ผ่าน, console errors = 0, ไม่มี 5xx ใน network
- [ ] Phase 2: Backend coverage branches ≥ 70%, functions ≥ 70% (ปิด gap 250 ที่ 61.63%/58.33%); business logic ≥ 80%
- [ ] Phase 3: Integration flow ครบทุก queue (`ai-realtime`, `ai-batch`, `ai-rag-query`, `ai-rag-ingest`, `ai-vector-deletion`) ผ่าน + retry/dead-letter ทำงาน
- [ ] Phase 4: ทุก SC-002 ผ่าน — RAG ≥ 80%, Migration detect ≥ 90%, false mismatch ≤ 10%, Intent confidence ≥ 0.7, cross-project leak 0%
- [ ] Phase 5: ทุก AI endpoint มี RBAC test 4 roles, AI boundary ไม่ถูกทะลุ, UUID compliance, audit log ครบ
- [ ] ไม่มี `parseInt`/`Number`/`+` บน UUID ใน AI test หรือโค้ด (ADR-019)
- [ ] ทุก test case ครอบคลุม error path ไม่ใช่แค่ happy path (ADR-007)

---

## 11. ความเสี่ยงและการจัดการ

| ความเสี่ยง | ผลกระทบ | การจัดการ |
|-----------|--------|-----------|
| Ollama/QRant ไม่พร้อมบน production ตอนทดสอบ | E2E fail ทั้ง phase | ตรวจ `GET /ai/admin/host/metrics` + health ก่อนเริ่ม; ทดสอบบน staging ถ้า production ไม่พร้อม |
| Golden set 100 ฉบับ ต้องเตรียมเอง | ทดสอบ accuracy ไม่ได้ | เตรียม golden set ที่ทราบคำตอบล่วงหน้า (50 RAG Q&A + 100 migration) เก็บใน `specs/999-test-plan/fixtures/` |
| GPU pressure จำลองยาก (CPU fallback test) | 4C.1 ทดสอบไม่ได้ | ใช้ Ollama unload model จำลอง VRAM ไม่พอ + sidecar log `device: "cpu"` |
| RAG accuracy ขึ้นกับ model version (typhoon2.5-np-dms) | ผลไม่ stable | บันทึก model version ใน test report; รันซ้ำ 3 ครั้งเพื่อยืนยัน |
| BullMQ job รอนาน (ai-batch lockDuration 700s) | Phase 3 ช้า | ใช้ test queue แยก + mock Ollama สำหรับ integration ที่ไม่ต้องการ model จริง |
| ทดสอบบน production อาจกระทบข้อมูล | ข้อมูล production เสียหาย | ใช้ project test `LCBP3-C2` เท่านั้น; ห้าม commit migration จริง โดยไม่ได้รับอนุญาต; ใช้ read-only verify สำหรับ accuracy |
| 250 coverage gap ใหญ่ (branches 61.63%) | ปิด gap นาน | ทำ 2C ก่อนใน Phase 2; target ≥ 70% ไม่ใช่ 80% (ตาม threshold) |

---

## 12. งานที่เกี่ยวข้อง (Cross-Reference)

| สเปค/เอกสาร | ความสัมพันธ์ |
|-------------|-------------|
| `rag-admin-console-unified-test-plan.md` | ครอบคลุม `/admin/ai/rag-console` UI — แผนนี้ไม่ทับซ้ำ (เน้น accuracy ของ pipeline แทน) |
| `migration-admin-unified-test-plan.md` | ครอบคลุม `/admin/migration` UI flow — แผนนี้เน้น AI Compare accuracy (242 SC-002) |
| `109-speckit-tester` | รัน test ตามแผนนี้ — handoff ไป |
| `e2e-testing` | Playwright patterns สำหรับ Phase 1 |
| `check-real-app` | browser verify จริงใน Phase 1 |
| `112-speckit-security-audit` | Phase 5 Security & RBAC |
| `verification-loop` | build → typecheck → lint → test → security → diff |
| ADR-024 | Intent Classification Strategy (Pattern → LLM Fallback) |
| ADR-029 | Dynamic Prompt Management (prompt จาก DB + Redis cache) |
| ADR-042 | OCR text persistence |
| ADR-043 | AI Architecture Current State (Single Source of Truth) |
| ADR-048 | AI Engine Control Center |
| ADR-050 | AI Metadata Extraction Output Contract |
