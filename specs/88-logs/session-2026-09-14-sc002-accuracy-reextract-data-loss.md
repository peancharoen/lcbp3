# Session — 2026-09-14 (SC-002 Accuracy + Re-extract Data Loss)

## Summary

ทดสอบ SC-002 E2E accuracy สำหรับ AI classification โดยใช้ข้อมูล migration จริง (C2 contract, 267 records) — พบและแก้ปัญหา D334 (VRAM model switching) + resolver fallback matching + re-ingest 49 ไฟล์ แต่เกิด **data loss จากความไม่รอบคอบของ agent** ตอน reset `ai_metadata_json` ทำให้ OCR text ของ 183 records หายไปถาวร ต้อง re-OCR ใหม่ทั้งหมด (~3 ชม.)

## ปัญหาที่พบ (Root Cause)

### 1. D334 — np-dms-ai VRAM offload ไป CPU

**อาการ**: `np-dms-ai` โหลดแค่ 1488MB จาก 6214MB ใน VRAM → LLM inference ช้ามาก

**สาเหตุ**: หลัง OCR batch เสร็จ ระบบ reload `np-dms-ai` กลับเข้า VRAM แต่ **ไม่ได้ unload `np-dms-ocr` ก่อน** ทำให้ VRAM ไม่พอ Ollama offload np-dms-ai ไป CPU 4726MB

**แก้**: `processLegacyOcrBatchPhase` + `detectAndExtract` — unload np-dms-ocr ก่อน reload np-dms-ai

### 2. Data Loss — reset `ai_metadata_json` ทำลาย `source_file_path`

**อาการ**: 183 records ที่ reset metadata เพื่อ re-extract กลายเป็น `NO_PDF` ทั้งหมด

**สาเหตุหลัก**: `ai_metadata_json` เป็น JSON bag กว้างที่ปนกัน 3 ประเภทข้อมูล:
1. **Ingestion metadata** (`source_file_path`, `attachment_ids`, `original_row_index`) — ห้าม reset
2. **AI extraction output** (`ocrQuality`, `metadata.*`) — reset ได้
3. **Review state** (`fieldResolutions`, `compareResult`) — ห้าม reset

Agent reset ทั้ง bag → `source_file_path` หาย → extractor หา PDF ไม่เจอ → เขียน `"ไม่มี ไฟล์ PDF"` ทับ OCR text จริง → ข้อมูลหายถาวร

**สาเหตุทางสถาปัตยกรรม**: ADR-050 ข้อ 2 บอกว่า "ไม่เพิ่ม column ต่อ field" แต่จริงๆ มี column ว่างอยู่แล้ว (`storage_temp_path`, `original_filename`) ที่ไม่ถูกใช้ ข้อมูลไปอยู่ใน JSON bag แทน ทั้งที่ควรเป็น column ของตัวเอง

### 3. OCR text ไม่มี source of truth เดียว

- `migration_review_queue.ocr_text` — source of truth ตอน migration (เขียนโดย extractor)
- `attachments.ocr_text` — source of truth ตอน production (ใช้ตอน RAG prepare)
- Migration flow ไม่เขียน `attachments.ocr_text` จนกว่าจะ commit → ถ้า queue.ocr_text หาย = หายถาวร

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | D334: unload np-dms-ocr ก่อน reload np-dms-ai ใน `processLegacyOcrBatchPhase` + `detectAndExtract` |
| `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | อัปเดต test ให้ expect `unloadModel` 2 ครั้ง (np-dms-ocr + np-dms-ai) |
| `backend/src/modules/ai/services/ocr.service.spec.ts` | เพิ่ม `getOcrModelName` mock |
| `backend/src/modules/migration/migration.service.ts` | Resolver fallback matching — 3 strategies สำหรับหา PDF ที่ชื่อไม่ตรง |
| `specs/999-test-plan/fixtures/sc002-golden-set.json` | อัปเดต golden set ให้ใช้ document_number จริงจาก migration |
| `specs/999-test-plan/scripts/sc002-accuracy-compare.ts` | สร้าง accuracy comparison script |

**Commits**: `869a9f12` (resolver) + `49e4841a` (D334) — pushed + deployed

## กฎที่ Lock แล้ว

- **D334**: ก่อน reload main model (np-dms-ai) ต้อง unload np-dms-ocr ออกจาก VRAM ก่อนเสมอ
- **Data Loss Lesson**: ห้าม reset JSON bag ทั้งก้อนโดยไม่ตรวจว่ามี field อะไรอยู่ข้างใน — ต้อง whitelist fields ที่จะ reset เท่านั้น
- **Backup ก่อน bulk operation**: สร้าง snapshot table ก่อน UPDATE/DELETE ที่กระทบข้อมูลเยอะ
- **Canary test**: ทดสอบด้วยจำนวนน้อยก่อน batch ใหญ่

## สถานะปัจจุบัน

- Re-extraction ของ 183 records กำลังทำงาน (OCR phase ใหม่ เพราะ OCR text หายไปแล้ว)
- 37 records DONE (new format), 19 FAILED (pre-existing), 182 WAITING + 1 RUNNING
- Golden set อัปเดตแล้ว (5 docs, 7 intents, 7 RAG queries, 5 metadata cases)
- Accuracy comparison script พร้อมใช้

## Verification

- [ ] รอ re-extraction เสร็จ (183 records, ~3 ชม.)
- [ ] ตรวจว่า golden-set records มี ADR-050 format ครบ
- [ ] รัน `sc002-accuracy-compare.ts` เปรียบเทียบกับ golden set
- [ ] Threshold recalibration ตาม ADR-023A
- [ ] Implement ADR-054 (แยก ingestion metadata ออกจาก JSON bag)
- [ ] เพิ่ม tests ป้องกัน data loss ซ้ำ

## ADR ที่สร้าง

- **ADR-054**: Migration Review Queue Metadata Separation — แยก ingestion metadata / AI output / review state ออกจาก `ai_metadata_json` JSON bag (supersede ADR-050 ข้อ 2 ทั้งข้อ)

### ADR-054 สรุปการเขียน (10 decisions)

| Decision | เรื่อง | เกี่ยว ocr_text? |
|----------|-------|------------------|
| D1 | แยก `source_file_path` → `storage_temp_path` column | ✅ ป้องกันต้นเหตุ |
| D2 | แยก `original_filename` → column | ❌ scope รอง |
| D3 | `reExtractQueueItem` reset `ai_metadata_json` เท่านั้น | ✅ ป้องกันต้นเหตุ |
| D4 | Extractor fallback หา PDF จาก `attachments.file_path` | ✅ ป้องกันกลางทาง |
| D5 | สำเนา `ocr_text` → `ocr_text_bak` ก่อน re-extract (queue) | ✅ สำรอง |
| D6 | สำเนา `ocr_text` → `ocr_text_bak` ก่อนเขียนทับ (attachment) | ✅ สำรอง |
| D7 | ลดความซ้ำซ้อน confidence values | ❌ scope รอง |
| D8 | Operational safety protocol (backup + canary + preflight) | ✅ กระบวนการ |
| D9 | แยก `review_state_json` ออกจาก `ai_metadata_json` | ✅ แยกข้อมูลชัดเจน |
| D10 | Post-import: เก็บ audit trail + `imported_correspondence_public_id` | ✅ link กลับ |

### Schema ใหม่ (4 columns)

```sql
ALTER TABLE migration_review_queue
  ADD COLUMN ocr_text_bak LONGTEXT NULL AFTER ocr_text,
  ADD COLUMN review_state_json JSON NULL AFTER ai_metadata_json,
  ADD COLUMN imported_correspondence_public_id VARCHAR(36) NULL;

ALTER TABLE attachments
  ADD COLUMN ocr_text_bak LONGTEXT NULL AFTER ocr_text;
```

### การแยก 3 ประเภทข้อมูลชัดเจน

```
Ingestion metadata → column (storage_temp_path, original_filename)
AI output          → ai_metadata_json (reset ได้ตอน re-extract)
Review state       → review_state_json (ห้าม reset)
```

### เอกสารที่อัปเดต

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `ADR-054` | เขียนใหม่ทั้งไฟล์ — 10 decisions + OCR Text Protection Chain |
| `ADR-050` | Status + Related Documents อ้างถึง ADR-054 (supersede ข้อ 2) |
| `ADR-047` | Version Dependency Matrix เพิ่ม ADR-054 + warning |
| `ADR-042` | Related Documents อ้างถึง ADR-054 D6 (ocr_text_bak) |

### Commits (local only — ไม่ push จนกว่า user สั่ง)

| Commit | เนื้อหา |
|--------|---------|
| `0d4305a2` | memory/session updates for SC-002 and D334-D337 |
| `23628c08` | initial ADR-054 and related documentation updates |
| `a7f5db43` | expanded ADR-054 with alternatives rejected |
| `e6b37d1c` | ADR-054 เพิ่ม OCR Text Protection Chain section |
| `02374af7` | ADR-054 เขียนใหม่ทั้งไฟล์ (เริ่ม migration ใหม่หมด) |
| `e106a008` | ADR-054 เปลี่ยน D5/D6 เป็น ocr_text_bak strategy |
| `069f6a94` | ADR-054 เพิ่ม D9 แยก review_state_json |
| `a2fffb33` | ADR-054 เพิ่ม D10 post-import audit trail |
| `9ba48531` | ADR-047 + ADR-042 อ้างถึง ADR-054 |
