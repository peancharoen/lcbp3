# Session — 2026-09-18→19 (RAG Admin Console, Orphan Cleanup, Vector Sync Migration)

## Summary

งาน RAG 3 ระลอก: (1) RAG Admin Console — Dashboard Re-ingest ต่อ row, checksum auto-heal, metrics ย้าย Redis + lifetime จาก DB, ซ่อน orphan attachments; (2) cleanup data — ลบ orphan attachments 249 rows (backup 3 tables), re-OCR/heal เอกสารที่ขาด OCR; (3) ยืนยัน+แก้ conflict ระหว่าง Maintenance Vector Sync (legacy `rag-prepare`) กับ generation-aware pipeline (`ai-rag-ingest`) — ลบ 188 legacy Qdrant points, migrate `VectorSyncService` ทั้ง service, และซ่อม 2 attachments ที่ค้างจน missing list = 0

## ปัญหาที่พบ (Root Cause)

1. **Re-ingest "ล้มเหลว" ไม่ใช่ bug** — Dashboard list รวม staging orphan attachments 251 rows (เศษ import ซ้ำหลายรอบ 11/13/15/16 ก.ย.) ที่ไม่ผูกเอกสารและไม่มี `ocr_text` เลย — ingest fail `NO_OCR_TEXT` ถูกต้องตาม design; "AI Pipeline PENDING" คือ `ai_processing_status` บน staging rows ที่ไม่เคยรัน pipeline
2. **Legacy/new pipeline conflict (พิสูจน์ด้วยข้อมูลจริง)** — `VectorSyncService` ใช้ `rag-prepare`/`EmbeddingService` (@deprecated) เขียน payload `doc_public_id` ไม่มี `generation_uuid`; `filterActiveChunksFromResults` drop points ที่ไม่มี `generation_uuid` ทั้งหมด → legacy vectors ไม่เคยถูกใช้ตอบ RAG; วัดจริง: 5,323 points มี 188 legacy dead-weight (12 docs ที่มี ACTIVE gen ครบอยู่แล้ว); vector-sync scan ด้วย `doc_public_id` จึงรายงาน "missing" ผิดและทุกการกดสร้าง dead vectors เพิ่ม
3. **2 attachments ค้างหลัง migrate** — `test-attach.pdf` (432B, hand-crafted PDF ไม่มี xref — sidecar `startxref not found`) และ `AI-INGEST-E2E-001.pdf` (ชี้ staging file QC-0001 8.9MB) — ทั้งคู่ไม่มี ocr_text
4. **Backend container env** — `MARIADB_ROOT_PASSWORD` ไม่มีใน backend container; ใช้ `DB_ROOT_PASSWORD`; mysql2 resolve ต้อง `-w /app`
5. **ไฟล์ถูกเขียนทับเพี้ยนระหว่างแก้** — `rag-admin.service.ts` โดน external editor (VS Code server buffer เก่า) เขียนทับหลายรอบ; แก้ด้วยเขียนผ่าน Python deterministically

## การแก้ไข (Fix)

| ไฟล์/ตำแหน่ง | การเปลี่ยนแปลง |
| -------------- | ---------------------- |
| `rag-admin.service.ts` | `listAttachments`+`listAttachmentsForClassification` filter เฉพาะ linked attachments (EXISTS ครบ 5 join tables); `reingest()` compute+persist checksum; expose `hasOcrText`; `getLifetimeMetrics()` derive จาก DB |
| `rag-observability.service.ts` | in-memory → Redis hash `rag:metrics` (HINCRBY, รอด restart); `getSnapshot()`/`reset()` async |
| `rag-query-log.entity.ts` + delta SQL | `retrieval_mode ENUM('VECTOR','FULL_TEXT','HYBRID')` — applied production DB |
| `rag-attachment-ingestion.service.ts` | reuse BUILDING generation เมื่อ checksum ตรง (ปิด duplicate-BUILDING race) |
| `vector-sync.service.ts` | **rewrite ทั้ง service** — missing = attachment ขาด ACTIVE gen (ไม่ใช่ doc_public_id count); enqueue = checksum ensure → `ingest()` → `enqueueRagAttachmentIngestion`; orphan scan = `chunk_public_id` ↔ `rag_attachment_chunks` (+ doc_public_id defensive) |
| Frontend | Actions column + Re-ingest button (disabled+tooltip เมื่อไม่มี OCR), uptime note, lifetime card, `attachmentPublicId` optional ใน `VectorSyncItem`, i18n th/en |
| `.devin/rules/15-mcp-mariadb-tools.md` | Direct CLI access: ห้าม `mysql` บน host — `docker exec mariadb mariadb ...` เท่านั้น |
| **Data ops (ไม่ใช่ code)** | ลบ 188 legacy Qdrant points (5,323→5,135); ลบ orphan attachments 249 rows + gens 14 + pages 8 (backup `*_backup_20260918` ×3, เก็บ queue-referenced id 339/342); heal OCR `01a0a357-3952` (copy จาก queue, checksum verify), `01a0a7fc-169c` (re-OCR sidecar 12,098 chars), `01a0a966-...` (PyMuPDF extract — sidecar parse malformed PDF ไม่ได้), `05a4fa03-...` (sidecar 16,296 chars); manual re-ingest recipe = INSERT BUILDING gen (uuidv7, `bge-m3`) + BullMQ job `rag-attachment-ingest:{att}:{checksum}` → ทั้ง 2 ACTIVE+INDEXED, missing list = 0 |

## กฎที่ Lock แล้ว

- **Canonical RAG path เดียว** — Qdrant point ต้องมี `generation_uuid`+`attachment_public_id` (guard drop `doc_public_id`-only); ทุก re-embed/sync ต้องผ่าน `RagAttachmentIngestionService`+`ai-rag-ingest`; legacy `rag-prepare`/`EmbeddingService` ห้ามใช้สร้าง vectors ใหม่
- **Orphan attachments** — list เฉพาะ linked (EXISTS join tables); ลบต้อง backup `*_backup_YYYYMMDD` + ลบตาม FK order (pages→gens→attachments) + exclude queue-referenced
- **Manual re-ingest recipe** — heal = persist `ocr_text`+`CHECKSUM` → INSERT `BUILDING` gen → enqueue `ai-rag-ingest`; processor เป็นเจ้าของ `rag_status` PROCESSING→INDEXED/FAILED
- **Checksum verify ก่อน heal** — ห้าม copy ocr_text ข้าม attachment โดยไม่ verify ไฟล์ identical (sha256 ตรง)
- **Backend container DB access** — `DB_ROOT_PASSWORD` (ไม่ใช่ `MARIADB_ROOT_PASSWORD`), node scripts ต้อง `-w /app`

## Verification

- [x] Backend tsc + eslint + Jest 3,054 tests
- [x] Frontend tsc + eslint + Vitest 29/29
- [x] `findMissingVectors` SQL บน DB จริง: 8 docs → หลังซ่อมเหลือ 0
- [x] 2 stuck attachments: ACTIVE gen + INDEXED (1 + 37 chunks)
- [x] Qdrant: 5,135 points generation-aware ล้วน
- [x] Deploy image `3dbea91d` รันบน production
- [ ] Browser verify Vector Sync tab + RAG Console metrics (pending)

## Commits

`7e97ea8f` feat(rag) → `71321edc` fix(rag-admin) → `fce3e7a0` fix(maintenance) vector-sync migration → memory `812231af`, `adcf55a3`, `3dbea91d`
