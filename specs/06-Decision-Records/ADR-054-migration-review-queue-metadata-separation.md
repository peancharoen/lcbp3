// File: specs/06-Decision-Records/ADR-054-migration-review-queue-metadata-separation.md
// Change Log:
// - 2026-09-14: Initial creation — แยก ingestion metadata / AI output / review state ออกจาก JSON bag
//   หลังเกิด data loss incident (D335-D337) ทำให้ OCR text 183 records หายไปถาวร
// - 2026-09-14: เขียนใหม่ทั้งไฟล์ — เริ่ม migration ใหม่ทั้งหมด ไม่ต้อง backward compat
//   focus ที่ OCR text protection เป็นหลัก + แก้ anti-pattern ที่เกี่ยวข้อง

# ADR-054: Migration Review Queue Metadata Separation — แยก Ingestion / AI Output / Review State + OCR Text Protection

**Status**: Accepted
**Date**: 2026-09-14
**Supersedes**: ADR-050 ข้อ 2 (Storage — Bag + promoted flags) — ส่วนที่บอกว่า "ไม่เพิ่ม column ต่อ field" ที่ทำให้เกิด anti-pattern นี้
**Related Documents**:
- [ADR-044: Database Schema Strategy Amendment](./ADR-044-database-schema-strategy-amendment.md) (SQL delta convention — ไม่ใช้ TypeORM migrations)
- [ADR-047: Native Backend Legacy Ingestion](./ADR-047-native-backend-legacy-ingestion.md) (migration_review_queue lifecycle)
- [ADR-050: AI Metadata Extraction Output Contract](./ADR-050-ai-metadata-extraction-output-contract.md) (AI extraction output shape — ข้อ 2 ถูก supersede)
- [ADR-042: Sandbox Project + OCR Text Persistence](./ADR-042-sandbox-project-and-ocr-text-persistence.md) (OCR text persistence policy)
- `backend/src/modules/migration/entities/migration-review-queue.entity.ts` (entity definition)
- `backend/src/modules/migration/types/ai-extraction-details.type.ts` (AI extraction contract type)
- `backend/src/modules/migration/migration.service.ts` (updateQueueEnrichment + reExtractQueueItem)
- `backend/src/modules/ai/processors/ai-batch.processor.ts` (persistLegacyEnrichmentResult + extraction flow)

---

## Context and Problem Statement

### เหตุการณ์ที่ทำให้ต้องตัดสินใจ (2026-09-14)

ระหว่างทดสอบ SC-002 E2E accuracy ต้อง re-extract 183 records ที่ประมวลผลก่อน deploy ADR-050 (มี metadata แบบเก่า ไม่มี `ocrQuality.confidence` และ `metadata.confidence.*`) Agent reset `ai_metadata_json = NULL` ทั้ง bag เพื่อเคลียร์ format เก่า แต่ทำให้:

1. **`source_file_path` หายไป** — extractor หา PDF ไม่เจอ → เขียน `"ไม่มี ไฟล์ PDF (ยกเลิก/ถอน)"` ทับ OCR text จริง
2. **OCR text 183 records หายไปถาวร** — `attachments.ocr_text` ยังว่าง (migration flow ไม่เขียนจนกว่าจะ commit) ไม่มีสำรอง
3. **ต้อง re-OCR ใหม่ทั้ง 183 ไฟล์** — ใช้เวลา ~3 ชั่วโมง

### Root Cause ทางสถาปัตยกรรม

`migration_review_queue.ai_metadata_json` เป็น **JSON bag กว้าง** ที่ปนกัน 3 ประเภทข้อมูลที่มี lifecycle และ ownership ต่างกัน:

| ประเภท | Fields | ใครเขียน | เก็บที่ (หลัง ADR-054) | ควร reset ตอน re-extract? |
|--------|--------|---------|---------------------|--------------------------|
| **Ingestion metadata** | `source_file_path`, `attachment_ids`, `original_row_index` | `LegacyIngestionService` ตอน ingest | column (`storage_temp_path`, `original_filename`) | ❌ ห้าม |
| **AI extraction output** | `ocrQuality`, `metadata.summary/correspondenceType/tags/confidence.*`, `aiFailureReason`, `compareResult`, `capturedThresholds` | `AiBatchProcessor` ตอน extraction | `ai_metadata_json` | ✅ ควร |
| **Review state** | `fieldResolutions` | `MigrationReviewService` ตอน review | `review_state_json` (D9 — column ใหม่) | ❌ ห้าม |

> หมายเหตุ: `compareResult`/`capturedThresholds` ย้ายมาอยู่กลุ่ม AI extraction output (ไม่ใช่ Review
> state ตามที่ร่างแรกจัดไว้) เพราะ `AiBatchProcessor` เป็นคนเขียนจริงตอน extraction (ไม่ใช่
> `MigrationReviewService` ตอน review) และต้องคำนวณใหม่ทุกครั้งที่ re-extract — ถ้าห้าม reset จะทำให้
> mismatch fields ค้างเป็นค่าเก่าไม่ sync กับ AI output ปัจจุบัน (ยืนยันกับ user 2026-09-14)

การปนกันนี้ทำให้ reset AI output fields เป็นเรื่องอันตราย — ถ้าไม่ระวังจะทำลาย ingestion metadata และ review state ไปด้วย

### Anti-pattern ที่ตามมา

ตรวจพบว่าตาราง `migration_review_queue` มี column ว่างอยู่แล้วแต่ไม่ถูกใช้:

| Column | ใช้จริง? | ข้อมูลจริงอยู่ที่ |
|--------|---------|------------------|
| `storage_temp_path` | ❌ ว่าง (0/37) | `ai_metadata_json.source_file_path` |
| `original_filename` | ❌ ว่าง (0/37) | `ai_metadata_json.source_file_path` (basename) |

> หมายเหตุ: `ai_issues` column **ไม่ใช่** anti-pattern แบบเดียวกัน — มี write path อยู่แล้ว
> (`migration.service.ts` `queueItem.aiIssues = dto.aiIssues`) เก็บ `NEW_TAG_SUGGESTED`
> (tag ใหม่จาก register fields ที่ต้องการ human review) ซึ่งเป็นคนละ concept กับ
> `ocrQuality.issues[]` (ปัญหาคุณภาพ OCR) — ไม่มี decision ใน ADR นี้ (D1-D10) แก้ไข column นี้

และมีข้อมูลซ้ำซ้อน 3 ที่:

| ค่า | Column | JSON path 1 | JSON path 2 |
|-----|--------|-------------|-------------|
| Overall confidence | `ai_confidence` | `metadata.confidence.*` (min) | — |
| OCR quality | `ocr_quality_confidence` | `ocrQuality.confidence` | — |
| Correspondence type | `ai_suggested_correspondence_type` | `metadata.correspondenceType` | — |
| Tags | `extracted_tags` | `metadata.tags[].name` | — |

ADR-050 ข้อ 2 บอกว่า "ไม่เพิ่ม column ต่อ field" แต่จริงๆ คือ **มี column อยู่แล้วแต่ไม่ยอมใช้** แล้วยัดข้อมูลไปใน JSON bag แทน — นี่ไม่ใช่ "ห้ามเพิ่ม schema" แต่เป็น "ไม่ยอมใช้ schema ที่มี"

### OCR text ไม่มี source of truth เดียว

| ตาราง | Column | บทบาท |
|-------|--------|-------|
| `migration_review_queue.ocr_text` | `longtext` | Source of truth ตอน migration — เขียนโดย extractor |
| `attachments.ocr_text` | `longtext` | Source of truth ตอน production — ใช้ตอน RAG prepare |

Migration flow (`persistLegacyEnrichmentResult`) เขียนเฉพาะ `migration_review_queue.ocr_text` — ไม่เขียน `attachments.ocr_text` จนกว่าจะ commit (`importCorrespondence` บรรทัด 456-461) ดังนั้นถ้า queue.ocr_text หายก่อน commit = หายถาวร เพราะ attachments.ocr_text ยังว่าง

---

## Decision Drivers

- **OCR text integrity** — การ reset AI output ต้องไม่ทำให้ OCR text หาย (หัวใจหลัก)
- **ADR-044** — ห้ามใช้ TypeORM migrations แต่อนุญาตให้แก้ SQL โดยตรง + delta files
- **Single source of truth** — แต่ละข้อมูลควรมีที่เก็บเดียวที่ชัดเจน ไม่ซ้ำซ้อน
- **Operational safety** — bulk operation ต้องมี backup + canary + preflight + rollback
- **Human-in-the-loop** — review state ต้องไม่ถูก AI extraction เขียนทับ
- **เริ่ม migration ใหม่ทั้งหมด** — ไม่ต้อง backward compat กับข้อมูลเก่า ทำใหม่ได้เลย

---

## OCR Text Protection Chain (Focus หลักของ ADR นี้)

ปัญหาหลักที่ทำให้ต้องสร้าง ADR นี้คือ **OCR text 183 records หายไปถาวร** ทุก decision ใน ADR นี้ต้องตอบคำถาม "จะป้องกัน OCR text หายอย่างไร"

### ลำดับเหตุการณ์ที่ทำให้ ocr_text หาย

```
Step 1: reset ai_metadata_json = NULL ทั้ง bag
        → source_file_path หายไปด้วย (เพราะเก็บปนใน JSON bag)

Step 2: extractor อ่าน details.source_file_path → ไม่มี
        → ไม่มี fallback หา PDF จากแหล่งอื่น

Step 3: extractor ตัดสินใจว่า "ไม่มี PDF"
        → เขียน "ไม่มี ไฟล์ PDF (ยกเลิก/ถอน)" ลง ocr_text
        → ทับ OCR text จริงที่เคยมีอยู่

Step 4: ไม่มีสำเนาสำรอง
        → attachments.ocr_text ยังว่าง (migration flow เขียนตอน commit เท่านั้น)
        → migration_review_queue.ocr_text ถูกเขียนทับแล้ว
        → กู้ไม่ได้
```

### แต่ละ Decision ป้องกันที่จุดไหน

```
Step 1: source_file_path หาย
  ├── D1: แยก source_file_path ไป storage_temp_path column
  │   → reset JSON ไม่กระทบ path เพราะ path อยู่ใน column ของตัวเอง
  └── D3: reExtractQueueItem whitelist fields
      → ถ้ายังเก็บใน JSON ก็ไม่ reset ทั้ง bag ทำให้ path ไม่หาย

Step 2: หา PDF ไม่เจอ
  └── D4: Extractor fallback หา PDF จาก attachments.file_path
      → ถ้า path หาย ยังหา PDF ได้จาก temp_attachment_id

Step 3: เขียน placeholder ทับ ocr_text
  └── D5: สำเนา ocr_text ไป ocr_text_bak ก่อน re-extract
      → ถ้าถูกทับ ยังกู้จาก ocr_text_bak ได้

Step 4: ไม่มีสำเนาสำรอง
  └── D5: migration_review_queue.ocr_text_bak
      → สำเนาใน queue เอง ไม่ต้องพึ่ง table อื่น
      (attachments.ocr_text ไม่ต้องมี backup — ตรวจโค้ดแล้วพบว่าไม่มี overwrite
      scenario เกิดขึ้นได้จริงในปัจจุบัน ดูหมายเหตุท้าย D5)

กระบวนการ (ครอบทุก step):
  └── D8: Operational safety protocol
      → backup + canary + preflight ก่อน bulk operation
      → ถ้าทำผิด ยังกู้จาก backup table ได้
```

### Decision ที่ไม่เกี่ยวกับ ocr_text (anti-pattern ที่แก้ในที่เดียวกัน)

| Decision | เกี่ยวกับ ocr_text? | ทำไมถึงอยู่ใน ADR นี้ |
|----------|---------------------|---------------------|
| D2: แยก `original_filename` | ❌ ไม่เกี่ยว | เป็น anti-pattern ที่สังเกตเห็นตอนตรวจ (column ว่างแต่ข้อมูลไปอยู่ใน JSON) — เป็น root cause เดียวกันคือ "มี column แต่ไม่ยอมใช้" |
| D7: Confidence values — กำหนด scope | ❌ ไม่เกี่ยว | เป็น anti-pattern อีกอัน (confidence ซ้ำ 3 ที่) — แก้ในที่เดียวกันเพราะเกี่ยวกับ storage model เดียวกัน |

D2 และ D7 ไม่ใช่สาเหตุของ data loss แต่เป็น anti-pattern ที่เกิดจาก root cause เดียวกันคือ ADR-050 ข้อ 2 ที่บอกว่า "ไม่เพิ่ม column ต่อ field" ทำให้มี column ว่างแต่ข้อมูลไปอยู่ใน JSON แก้ใน ADR เดียวกันเพราะเป็นการแก้ storage model ครั้งเดียว

---

## Decisions

### D1: แยก `source_file_path` ออกจาก JSON bag → ใช้ `storage_temp_path` column

**Decision**: ย้าย `source_file_path` จาก `ai_metadata_json.source_file_path` ไปเก็บใน `storage_temp_path` column ที่มีอยู่แล้ว (ปัจจุบันว่างทั้งหมด)

- `LegacyIngestionService` เขียน `storage_temp_path` ตอน ingest (แทนที่จะเขียนลง `details.source_file_path`)
- `AiBatchProcessor` อ่านจาก `queueItem.storageTempPath` (แทน `details.source_file_path`)
- ไม่มี backward compat — เริ่ม migration ใหม่ทั้งหมด ไม่มีแถวเก่าที่เก็บใน JSON

**Rationale**: `source_file_path` เป็น ingestion metadata ที่มี lifecycle ต่างจาก AI output — ต้องเก็บใน column ของตัวเอง ไม่ปนใน JSON bag ที่ถูก reset ตอน re-extract ได้ การใช้ column ที่มีอยู่แล้ว (`storage_temp_path`) ไม่ต้องเพิ่ม schema ใหม่ และทำให้ query ได้โดยตรงโดยไม่ต้อง `JSON_EXTRACT`

**Alternatives rejected**:
- เก็บใน JSON bag ต่อไป + whitelist ตอน reset — ยังพึ่ง JSON bag ที่เปราะบาง ถ้ามี field ใหม่ในอนาคตอาจถูก reset โดยไม่ตั้งใจ
- สร้าง column ใหม่ `source_file_path VARCHAR(512)` — ซ้ำซ้อนกับ `storage_temp_path` ที่มีอยู่แล้วและว่างอยู่
- ใช้ `attachments.file_path` เป็น source of truth เดียว (ไม่เก็บใน queue เลย) — ทำให้ queue พึ่ง attachment table ตลอด ถ้า attachment ถูกลบ queue หา PDF ไม่เจอ

### D2: แยก `original_filename` ออกจาก JSON bag → ใช้ column ของตัวเอง

**Decision**: เพิ่ม column `original_filename VARCHAR(512) NULL` (ถ้ายังไม่มี) หรือใช้ column ที่มีอยู่แล้ว — เก็บชื่อไฟล์ต้นฉบับแยกจาก path

**Rationale**: `original_filename` เป็น ingestion metadata ที่ใช้ตอน display และ diagnostic — ควรเก็บใน column ไม่ใช่ใน JSON bag ที่ถูก reset ได้ การมี column ของตัวเองทำให้ query และ sort ได้โดยตรง เป็น anti-pattern เดียวกับ D1 คือมี column อยู่แล้วแต่ไม่ยอมใช้

**Alternatives rejected**:
- ดึงจาก `source_file_path` ด้วย `SUBSTRING_INDEX` ทุกครั้ง — ค่าใช้จ่าย CPU โดยไม่จำเป็น และถ้า path format เปลี่ยน (Windows `\` vs Unix `/`) ต้องแก้ logic
- เก็บใน JSON bag — ปัญหาเดียวกับ D1 คือถูก reset ได้

### D3: `reExtractQueueItem` ต้อง whitelist fields ที่จะ reset

**Decision**: ห้าม reset `ai_metadata_json = NULL` ทั้ง bag โดยไม่ตรวจ — ต้อง reset เฉพาะ AI output fields และเก็บ ingestion metadata + review state ไว้:

```typescript
// ❌ ผิด — ลบทั้งก้อน ทำลาย ingestion metadata
queueItem.details = null;

// ✅ ถูก — whitelist เฉพาะ ingestion metadata ที่ต้องเก็บ (ไม่ใช่ AI output)
const preservedFields = {
  source_file_path: queueItem.details?.source_file_path,
  attachment_ids: queueItem.details?.attachment_ids,
  original_row_index: queueItem.details?.original_row_index,
};
queueItem.details = { ...preservedFields }; // ไม่มี ocrQuality, metadata.*, compareResult, capturedThresholds
```

**หมายเหตุ**: `fieldResolutions` ไม่อยู่ใน whitelist นี้เพราะหลัง D9 ย้ายออกไป `review_state_json` เป็นคนละ column ไปเลย (ไม่ต้อง preserve ภายใน `ai_metadata_json` อีก) ส่วน `compareResult`/`capturedThresholds` ก็ไม่อยู่ใน whitelist เช่นกัน เพราะจัดเป็น AI extraction output (เขียนโดย `AiBatchProcessor`, ต้องคำนวณใหม่ทุกครั้งที่ re-extract) ไม่ใช่ review state — reset ได้ตามปกติ (ดู D9) หลัง D9 ทำให้ reset ง่ายขึ้นเพราะ `ai_metadata_json` เก็บเฉพาะ AI output เท่านั้น สามารถ reset ทั้ง bag ได้โดยไม่ทำลาย review state แต่ยังคง whitelist ไว้เป็น defense in depth สำหรับ ingestion metadata ที่อาจยังค้างอยู่ใน bag เดิม

**Rationale**: การ reset ทั้ง bag ทำลายข้อมูลที่ไม่ใช่ AI output ที่เป็น root cause ของ data loss incident — whitelist approach ทำให้แม้มี field ใหม่ในอนาคตก็ไม่ถูก reset โดยไม่ตั้งใจ เพราะ default คือ "เก็บไว้" ไม่ใช่ "ลบทิ้ง"

**Alternatives rejected**:
- Blacklist approach (ลบเฉพาะ AI output fields ที่ระบุ) — ถ้ามี field ใหม่ที่ไม่ได้ระบุใน blacklist จะถูกเก็บไว้ แต่ถ้า field ใหม่เป็น AI output ที่ควร reset จะไม่ถูก reset (inverted safety)
- แยก JSON column ออกเป็น 3 columns (`ingestion_metadata`, `ai_output`, `review_state`) — ingestion metadata ย้ายเป็น column จริงแล้ว (D1/D2) และ review state ย้ายเป็น `review_state_json` แล้ว (D9) เหลือแค่ `ai_metadata_json` สำหรับ AI output เท่านั้น

### D4: Extractor ต้อง fallback หา PDF จาก `attachments.file_path`

**Decision**: ถ้า `storage_temp_path` และ `details.source_file_path` ไม่มี ให้ดึงจาก `attachments.file_path` ผ่าน `temp_attachment_id` / `temp_attachment_ids`:

```typescript
const fallbackAttachmentId = queueItem.tempAttachmentIds?.[0];
const pdfPath =
  queueItem.storageTempPath ??
  (fallbackAttachmentId
    ? await this.attachmentRepo.findOne({
        where: { id: fallbackAttachmentId },
        select: ['filePath'],
      }).then(a => a?.filePath)
    : undefined);
```

**Rationale**: `attachments` table เป็น source of truth ของไฟล์จริง — ถ้า queue metadata หาย ยังกู้ได้จาก attachment ทำให้ extractor ไม่เจอ NO_PDF โดยไม่จำเป็น และไม่เขียน placeholder ทับ OCR text ใช้ `tempAttachmentIds[0]` (current field) แทน `tempAttachmentId` (deprecated field) แม้ปัจจุบัน `LegacyIngestionService` จะ dual-write ทั้งสอง field ตรงกันเสมอ (`legacy-ingestion.service.ts:402-403`) แต่ field ที่ entity ระบุไว้ชัดเจนว่า deprecated ไม่ควรถูกอ้างอิงในโค้ดใหม่ — ถ้าถูกลบออกในอนาคตตามทิศทางของ deprecation notice โค้ดที่อ้าง `tempAttachmentIds` จะไม่พัง ไม่มี fallback กลางไปที่ `queueItem.details?.source_file_path` เพราะ D1 ระบุชัดว่า "ไม่มี backward compat" — หลัง D1 implement แล้ว ไม่มี code path ไหนเขียน `details.source_file_path` อีกต่อไป (ย้ายไปเขียน `storageTempPath` ทั้งหมด) และ TRUNCATE ล้างแถวเก่าที่อาจยังมี field นี้ค้างอยู่ทิ้งไปแล้ว การเก็บ fallback ที่ไม่มีวันมีค่าไว้จะเป็น dead code ที่ทำให้เข้าใจผิดว่ายังมีบางจุดเขียนอยู่

**Alternatives rejected**:
- ไม่มี fallback — ถ้า queue metadata หาย = NO_PDF = data loss (เหตุการณ์ที่เกิดจริง)
- Fallback จาก `document_number` search ใน filesystem — ช้า + ไม่ reliable (ชื่อไฟล์อาจไม่ตรง document_number)

### D5: สำเนา `ocr_text` ไป `ocr_text_bak` ก่อน re-extract (migration_review_queue)

**Decision**: เพิ่ม column `ocr_text_bak LONGTEXT NULL` ใน `migration_review_queue` — ก่อน re-extract ต้องสำเนา `ocr_text` ปัจจุบันไปที่ `ocr_text_bak` ก่อนเขียนทับ:

```typescript
// ใน reExtractQueueItem หรือ persistLegacyEnrichmentResult ก่อนเขียน ocr_text ใหม่
if (queueItem.ocrText && queueItem.ocrText.trim().length > 0) {
  queueItem.ocrTextBak = queueItem.ocrText; // สำเนาก่อนทับ
}
queueItem.ocrText = newOcrText; // ทับด้วยค่าใหม่
```

**Rationale**: ถ้า re-extract ผิดพลาด (เช่น NO_PDF → placeholder ทับของจริง) ยังมี `ocr_text_bak` กู้ได้ — เป็น defense in depth ที่ไม่ต้องพึ่ง `attachments.ocr_text` (ซึ่งอาจยังว่างในช่วง migration) การสำเนาก่อนทับเป็น pattern ที่เรียบง่ายและป้องกันได้ทุกกรณี ไม่ใช่แค่กรณี NO_PDF

**Alternatives rejected**:
- สำเนาไป `attachments.ocr_text` ตอน extraction — ยังไม่พอ เพราะถ้า re-extract ครั้งที่ 2 ก็ทับ `attachments.ocr_text` อีก ไม่มีสำเนาสำรอง
- ใช้ audit log table แยก — ต้อง join ทุกครั้งที่กู้ ซับซ้อนเกินไปสำหรับการกู้คืนด่วน
- ไม่สำเนา แค่ห้ามเขียนทับ — ถ้า logic ตรวจผิดพลาดก็ทับได้ การสำเนาเป็น safety net ที่ไม่พึ่ง logic

**หมายเหตุ (ตัด `attachments.ocr_text_bak` ออกจาก ADR นี้)**: ร่างแรกมี D6 (`attachments.ocr_text_bak`)
เพื่อป้องกันการเขียนทับ `attachments.ocr_text` ทั้งตอน migration commit (`importCorrespondence`) และ
production ingestion ปกติ (`processRagPrepare`/`processEmbedDocument`) — แต่ตรวจโค้ดแล้วพบว่า**ไม่มี
overwrite scenario เกิดขึ้นได้จริงในทั้งสองจุด**:
- `importCorrespondence` — `attachmentId` มาจาก `fileStorageService.importStagingFile(...)` ซึ่งสร้าง
  attachment ใหม่เสมอจาก staging file (two-phase upload) → `ocr_text` เป็น `NULL` ก่อนเขียนเสมอ (first-write)
- `processRagPrepare` — มี logic "reuse cached `ocr_text` — no re-OCR" (FR-014, SC-006) อยู่แล้ว คือ
  เขียนเฉพาะตอนที่ `ocr_text` ยังว่าง (write-once + reuse) ไม่มี re-OCR endpoint ที่ overwrite ค่าที่มีอยู่

จึงตัด D6 ออกจาก ADR นี้ทั้งหมด (ไม่เพิ่ม column, ไม่แก้โค้ดจุดนี้) — ถ้าในอนาคตต้องการเพิ่มความสามารถ
"re-OCR เอกสารที่มีอยู่แล้วใน production" (เพื่อปรับปรุงคุณภาพ OCR เอกสารเก่า) เป็น net-new capability
ที่ไม่เคยมีในระบบ ต้องออกแบบ compare-before-replace logic ใหม่ (ใคร trigger, เกณฑ์เปรียบเทียบ, RBAC, UI)
— ควรเป็น ADR แยกต่างหาก ไม่ใช่ส่วนหนึ่งของ ADR นี้ (ยืนยันกับ user 2026-09-14)

### D7: Confidence values — กำหนด scope ชัดเจนของแต่ละที่เก็บ (ไม่ลบความซ้ำซ้อน)

**Decision**: หลัง migration เสร็จ ให้ตัดสินใจว่า confidence values เก็บที่ไหนเป็น source of truth:

- **`ai_confidence` column** — คงไว้เป็น backward-compat alias (min ของ metadata.confidence.*) สำหรับ query/report เก่า
- **`ocr_quality_confidence` column** — source of truth สำหรับ sort/filter (promoted จาก JSON)
- **`metadata.confidence.*` ใน JSON** — source of truth สำหรับ per-field confidence (ใช้ตอน review UI)
- **`ocrQuality.confidence` ใน JSON** — source of truth สำหรับ OCR quality (ใช้ตอน review UI)

ไม่ลบ JSON fields เพราะ review UI ต้องการ per-field แต่ column เป็น promoted alias เท่านั้น

**Rationale**: การมีข้อมูลซ้ำซ้อน 3 ที่ (column + JSON + JSON) ทำให้ sync ยากและอาจ inconsistent — แต่การลบ JSON fields จะทำให้ review UI ไม่มี per-field confidence ใช้ จึงคงไว้แต่กำหนดให้ column เป็น alias ที่ computed จาก JSON เท่านั้น ไม่ใช่ source of truth แยก

**Alternatives rejected**:
- ลบ JSON confidence fields ใช้ column เพียงอย่างเดียว — review UI ไม่มี per-field confidence (summary/correspondenceType/tags แยก)
- ลบ column ใช้ JSON เพียงอย่างเดียว — query/filter/sort ต้อง `JSON_EXTRACT` ทุกครั้ง ช้า + ไม่ index ได้
- สร้าง column ใหม่สำหรับแต่ละ per-field confidence — เพิ่ม schema เกินจำเป็น (ADR-044)

### D8: Operational safety — bulk operation protocol

**Decision**: ก่อน bulk UPDATE/DELETE ที่กระทบข้อมูลเยอะ (>10 rows) ต้องทำตาม protocol:

1. **Backup** — `CREATE TABLE migration_review_queue_backup_YYYYMMDD AS SELECT id, document_number, ai_metadata_json, review_state_json, ocr_text, ocr_text_bak, ai_status FROM migration_review_queue WHERE <condition>`
2. **Preflight** — ตรวจ JSON keys ของ 1-2 records ก่อน เพื่อดูว่ามี field อะไรอยู่ข้างใน
3. **Canary** — ทดสอบด้วย 1 record ก่อน แล้ว verify ผลลัพธ์
4. **Verify** — ตรวจ DB state, file path resolution, queue state, output shape
5. **Bulk** — ทำ batch ใหญ่หลัง canary ผ่าน
6. **Log** — บันทึก scope + affected row count
7. **Rollback** — มี path กลับ (restore จาก backup table)

**Rationale**: เหตุการณ์ data loss เกิดจากการ bulk reset โดยไม่ backup + ไม่ canary + ไม่ preflight — protocol นี้บังคับให้ต้องคิดก่อนทำ และมีทางกลับเสมอ

**Alternatives rejected**:
- ไม่มี protocol — ทำได้ตามใจ (เหตุการณ์ที่เกิดจริง)
- บังคับผ่าน code (service method ที่ตรวจ backup ก่อน allow bulk) — เพิ่ม complexity และอาจ block การแก้ด่วนที่จำเป็น
- ใช้ transaction + rollback เท่านั้น — ไม่พอ เพราะบางครั้งต้อง verify หลัง commit (เช่น file path resolution)

### D9: แยก `review_state_json` ออกจาก `ai_metadata_json` เป็น column ของตัวเอง

**Decision**: เพิ่ม column `review_state_json JSON NULL` ใน `migration_review_queue` — ย้าย review state fields ออกจาก `ai_metadata_json` ไปเก็บใน column ของตัวเอง:

```typescript
// ก่อน ADR-054 — ปนกันใน ai_metadata_json
queueItem.details = {
  // AI output (reset ได้)
  ocrQuality: { ... },
  metadata: { ... },
  compareResult: { ... },
  capturedThresholds: { ... },
  // Review state (ห้าม reset) — ปนอยู่ใน bag เดียวกัน
  fieldResolutions: { ... },
};

// หลัง ADR-054 — แยกชัดเจน
queueItem.details = {
  // AI output เท่านั้น — เขียนโดย AiBatchProcessor, reset ได้ตอน re-extract
  // compareResult/capturedThresholds อยู่ที่นี่ (ไม่ใช่ review_state_json) เพราะต้องคำนวณใหม่
  // ทุกครั้งที่ extract ใหม่ — ถ้าห้าม reset จะค้างเป็นค่าเก่าไม่ sync กับ AI output ปัจจุบัน
  ocrQuality: { ... },
  metadata: { ... },
  compareResult: { ... },
  capturedThresholds: { ... },
};
queueItem.reviewState = {
  // Review state เท่านั้น — เขียนโดย MigrationReviewService ตอน review (การตัดสินใจของมนุษย์)
  // ห้าม reset ตอน re-extract
  fieldResolutions: { ... },
};
```

**Rationale**: การแยกออกจากกันอย่างชัดเจนตาม **ownership จริง** (ใครเขียน) ไม่ใช่ตาม "เกี่ยวกับ review หรือเปล่า":
- **Ingestion metadata** → column (`storage_temp_path`, `original_filename`) — ตั้งแต่ ingest ไม่เปลี่ยน
- **AI output** → `ai_metadata_json` — เขียนโดย `AiBatchProcessor`, reset ได้ตอน re-extract (รวม `compareResult`/`capturedThresholds`)
- **Review state** → `review_state_json` — เขียนโดย `MigrationReviewService` เท่านั้น (`fieldResolutions`), ห้าม reset ตอน re-extract

ทำให้ `reExtractQueueItem` ง่ายขึ้น — แค่ reset `ai_metadata_json` ทั้ง bag ได้เลย เพราะไม่มี field ที่มนุษย์เขียนปนอยู่แล้ว ไม่ต้อง whitelist ไม่ต้องกลัวทำลาย review state และ `AiBatchProcessor` ไม่ต้องแตะ `review_state_json` เลยแม้แต่ตอน extraction ปกติ (ป้องกัน AI เขียนทับการตัดสินใจของมนุษย์โดยไม่ตั้งใจ)

**Alternatives rejected**:
- คง review state ใน `ai_metadata_json` + whitelist ตอน reset (D3) — ยังพึ่ง logic whitelist ที่อาจผิดพลาด ถ้ามี field ใหม่ที่ลืมใส่ใน whitelist = หาย
- แยกเป็น 3 JSON columns (`ingestion_metadata`, `ai_output`, `review_state`) — ingestion metadata ย้ายเป็น column จริงแล้ว (D1/D2) ไม่ต้องเป็น JSON
- ทำ review state เป็น column เดี่ยวๆ แต่ละ field (`field_resolutions`) — เพิ่ม schema เกินจำเป็น (ADR-044) review state เป็น flexible structure ที่อาจเปลี่ยน
- ย้าย `compareResult`/`capturedThresholds` ไป `review_state_json` พร้อม `fieldResolutions` (ร่างแรกของ D9) — ทำให้ `AiBatchProcessor` ต้องเขียนทับ column ที่ชื่อบอกว่า "ห้าม reset" ทุกครั้งที่ extract ใหม่ ขัดกับ contract ของตัวเอง และถ้าทำให้ AI ห้ามทับจริง จะได้ mismatch fields ค้างเป็นค่าเก่า ไม่ sync กับ AI output ปัจจุบัน (ยืนยันกับ user 2026-09-14)

### D10: หลัง import เสร็จ — เก็บ record ไว้เป็น audit trail + link กลับ

**Decision**: หลัง import สำเร็จ ไม่ลบ record — เก็บไว้เป็น audit trail และเพิ่ม column `imported_correspondence_public_id VARCHAR(36) NULL` สำหรับ link กลับไปยัง correspondence ที่ import ไป:

```typescript
// ใน approveQueueItem / approveQueueItemByPublicId หลัง import สำเร็จ
queueItem.status = MigrationReviewStatus.IMPORTED;
queueItem.reviewedBy = userId.toString();
queueItem.reviewedAt = new Date();
queueItem.importedCorrespondencePublicId = result.correspondencePublicId; // link กลับ
await this.reviewQueueRepo.save(queueItem);
```

การลบทำได้ผ่าน `deleteReviewQueueByBatch` เท่านั้น (manual — ต้องระบุ batchId, all=true, หรือ publicIds) — ไม่มี auto-cleanup

**Rationale**:
- **Audit trail**: สามารถสืบย้อนได้ว่า correspondence ใน production มาจาก queue item ไหน, ใคร review, ตอนไหน, ข้อมูล AI ตอนนั้นเป็นยังไง
- **Link กลับ**: `imported_correspondence_public_id` ทำให้สามารถ query จาก queue → correspondence ได้โดยตรง และจาก correspondence → queue ได้ (reverse lookup)
- **ไม่ auto-cleanup**: migration เป็นกระบวนการครั้งเดียว (legacy → new) ถ้ามีปัญหาหลัง import ต้องสามารถสืบได้ การ auto-delete ทำให้สูญเสีย audit trail
- **ข้อมูลซ้ำไม่เป็นปัญหา**: หลัง import `ocr_text` มีทั้งใน queue และ attachment แต่ queue เป็น snapshot ตอน migration ไม่ได้ใช้งานจริง ส่วน attachment ใช้งานจริงใน production

**Alternatives rejected**:
- ลบทันทีหลัง import — สูญเสีย audit trail ถ้ามีปัญหาหลัง import ไม่สามารถสืบได้
- Archive ไป table อื่น (`migration_review_queue_archive`) — เพิ่ม complexity (extra table + move logic + query 2 tables) โดยไม่จำเป็น เพราะ migration เป็นครั้งเดียว ข้อมูลไม่โตเร็ว
- Auto-cleanup หลัง N วัน (cron job) — ถ้ามีปัญหาหลัง N วัน ไม่สามารถสืบได้ และต้องดูแล cron job เพิ่ม

---

## Consequences

### Positive

- การ reset AI output ไม่ทำลาย ingestion metadata อีก
- การ reset AI output ไม่ทำลาย review state อีก (D9 — แยก column)
- มี `ocr_text_bak` สำเนาสำรองใน `migration_review_queue` — กู้ได้ถ้าถูกทับตอน re-extract
- ลดความซ้ำซ้อน — `source_file_path` เก็บที่เดียว (column) ไม่ใช่ใน JSON
- Bulk operation มี backup + canary + rollback ป้องกัน data loss
- Query ด้วย `storage_temp_path` ได้โดยตรง (ไม่ต้อง `JSON_EXTRACT`)
- แยก 3 ประเภทข้อมูลชัดเจน: ingestion → column, AI output → `ai_metadata_json`, review state → `review_state_json`
- หลัง import เก็บ audit trail + link กลับไป correspondence ได้ (D10 — `imported_correspondence_public_id`)

### Negative

- ต้องเพิ่ม 3 column ใหม่: `migration_review_queue.ocr_text_bak` + `migration_review_queue.review_state_json` + `migration_review_queue.imported_correspondence_public_id`
- ต้องแก้ code หลายจุด: `LegacyIngestionService`, `AiBatchProcessor`, `MigrationService`, `MigrationReviewService`
- Protocol (D8) เป็น guideline ไม่ได้บังคับผ่าน code — ต้องใช้วินัยในการปฏิบัติ
- `ocr_text_bak` เก็บ snapshot ล่าสุดเท่านั้น (1 รุ่น) — ถ้าทับซ้ำหลายครั้งจะเหลือแค่รุ่นก่อนหน้าสุดท้าย
- IMPORTED records ค้างในตาราง — ตารางโตตามจำนวน migration (แต่ migration เป็นครั้งเดียว ไม่โตเร็ว)

### Neutral

- เริ่ม migration ใหม่ทั้งหมด — ไม่มีข้อมูลเก่า ไม่ต้อง backward compat
- `ai_metadata_json` เก็บ AI output เท่านั้น (หลัง D9 แยก review state ออกแล้ว)
- `ai_confidence` column ยังเป็น alias ของ `min(metadata.confidence.*)` ตามเดิม

---

## Schema Changes (SQL Delta)

```sql
-- File: specs/99-archives/deltas/2026-09-14-adr-054-migration-metadata-separation.sql

-- 1. เพิ่ม column ocr_text_bak ใน migration_review_queue
ALTER TABLE migration_review_queue
  ADD COLUMN ocr_text_bak LONGTEXT NULL AFTER ocr_text;

-- 2. เพิ่ม column review_state_json ใน migration_review_queue (D9)
ALTER TABLE migration_review_queue
  ADD COLUMN review_state_json JSON NULL AFTER ai_metadata_json;

-- 3. เพิ่ม column imported_correspondence_public_id ใน migration_review_queue (D10)
ALTER TABLE migration_review_queue
  ADD COLUMN imported_correspondence_public_id VARCHAR(36) NULL AFTER review_state_json;

-- 4. (ถ้ายังไม่มี original_filename column) เพิ่ม column
-- ALTER TABLE migration_review_queue
--   ADD COLUMN original_filename VARCHAR(512) NULL AFTER storage_temp_path;

-- 5. TRUNCATE migration_review_queue (เริ่ม migration ใหม่ทั้งหมด)
-- หมายเหตุ: ตั้งใจไม่ backup ก่อน TRUNCATE นี้ (ต่างจาก D8 protocol ที่ใช้กับ production
-- bulk operation) เพราะ 37 แถวปัจจุบันเป็น test/sandbox data ก่อน go-live จริง ทิ้งได้
-- ไม่ต้องกู้คืน — เป็นการตัดสินใจโดยเจตนา ไม่ใช่การมองข้าม D8 (ยืนยันกับ user 2026-09-14)
-- ตั้งใจลบทุกแถวจริง รวมถึงแถวที่อาจมีสถานะ IMPORTED แล้วก็ตาม — D10 (audit trail,
-- ห้ามลบ record หลัง import) คุ้มครองเฉพาะ record ที่เกิดขึ้น "หลัง" ADR-054 มีผลบังคับใช้
-- เท่านั้น ไม่ย้อนหลังไปคุ้มครอง 37 แถวชุดทดสอบก่อน go-live นี้ (ยืนยันกับ user 2026-09-14)
TRUNCATE TABLE migration_review_queue;

-- 6. ไม่ต้อง backfill — เริ่มใหม่จาก Excel
```

---

## Implementation Plan

| ขั้นตอน | ไฟล์ | งาน |
|---------|------|-----|
| 1 | `specs/99-archives/deltas/2026-09-14-adr-054-*.sql` | สร้าง SQL delta (ALTER + TRUNCATE) |
| 2 | `backend/src/modules/migration/entities/migration-review-queue.entity.ts` | เพิ่ม `storageTempPath` (D1 — DB column มีอยู่แล้วแต่ entity ยังไม่ map) + `ocrTextBak` + `originalFilename` + `reviewState` (map จาก column `review_state_json`, ดู D9) + `importedCorrespondencePublicId` column |
| 3 | `backend/src/modules/migration/services/legacy-ingestion.service.ts` | เขียน `storage_temp_path` + `original_filename` ตอน ingest (แทน `details.source_file_path`) |
| 4 | `backend/src/modules/ai/processors/ai-batch.processor.ts` | อ่าน PDF path จาก `storageTempPath` ก่อน, fallback `attachments.file_path` |
| 5 | `backend/src/modules/ai/processors/ai-batch.processor.ts` | `persistLegacyEnrichmentResult` สำเนา `ocr_text` ไป `ocr_text_bak` (migration_review_queue) ก่อนเขียนทับ |
| 6 | `backend/src/modules/migration/migration.service.ts` | `reExtractQueueItem` reset `ai_metadata_json` เท่านั้น (ไม่ทำลาย `review_state_json`) |
| 7 | `backend/src/modules/migration/migration-review.service.ts` | เขียน review state ลง `review_state_json` แทน `ai_metadata_json` |
| 8 | `backend/src/modules/migration/migration.service.ts` | `approveQueueItem` / `approveQueueItemByPublicId` เก็บ `importedCorrespondencePublicId` หลัง import สำเร็จ |
| 9 | `backend/src/modules/migration/migration.service.spec.ts` | เพิ่ม tests ป้องกัน data loss + audit trail |
| 10 | `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | เพิ่ม tests สำหรับ fallback path + ocr_text_bak + review_state_json |
| 11 | (manual) | Re-ingest จาก Excel ใหม่ทั้งหมด (TRUNCATE ทำไปแล้วตอนขั้นตอนที่ 1 พร้อม ALTER — SQL delta ไฟล์เดียว รันก่อนแก้โค้ด) |

> `attachments.ocr_text_bak` (D6 เดิม) ถูกตัดออกทั้งหมด — ไม่มี step แก้ `Attachment` entity/
> `importCorrespondence`/`processRagPrepare`/`processEmbedDocument` อีกต่อไป (ดูหมายเหตุท้าย D5)

### Tests ที่ต้องเพิ่ม

- Reset `ai_metadata_json` ไม่ทำลาย `review_state_json`
- Reset ไม่ลบ `source_file_path` (หรือ `storage_temp_path` หลัง migrate)
- Reset ไม่ลบ `attachment_ids` / `temp_attachment_id`
- Missing `storage_temp_path` ใช้ `attachments.file_path` ได้
- Re-extract สำเนา `ocr_text` ไป `ocr_text_bak` ก่อนเขียนทับ (migration_review_queue)
- Review state เขียนลง `review_state_json` ไม่ใช่ `ai_metadata_json`
- หลัง import สำเร็จ `importedCorrespondencePublicId` ถูกเก็บ
- ถ้า `ocr_text` ถูกทับ สามารถกู้จาก `ocr_text_bak` ได้
- Canary/bulk scope ถูก log

---

## Supersedes

### ADR-050 ข้อ 2 (ทั้งข้อ)

ADR-050 ข้อ 2 บอกว่า:
> "Storage — Bag + promoted flags: Payload ใหม่ทั้งก้อน (`ocrQuality`, `metadata.summary/correspondenceType/tags/confidence.*`) เก็บใน `migration_review_queue.details` (JSON bag เดิม) **ไม่เพิ่ม column ต่อ field** — ยกเว้น 2 field ที่ต้อง query/filter/sort ระดับ DB จึง promote เป็น real column"

ADR-054 แก้ข้อนี้ทั้งข้อ — ปัญหาคือ "ไม่เพิ่ม column ต่อ field" ทำให้มี column อยู่แล้ว (`storage_temp_path`, `original_filename`, `ai_issues`) แต่ไม่ยอมใช้ แล้วยัดข้อมูลไปใน JSON bag แทน หลักการ "ไม่เพิ่ม schema เกินจำเป็น" ยังคงอยู่ แต่ถ้ามี column อยู่แล้วและข้อมูลเป็น ingestion metadata ที่มี lifecycle ต่างจาก AI output ต้องใช้ column ไม่ใช่ JSON bag

ส่วนที่ยังคงจาก ADR-050:
- AI extraction output (`ocrQuality`, `metadata.*`) ยังเก็บใน JSON bag ได้
- Promoted columns (`requires_human_review`, `ocr_quality_confidence`) ยังคงเป็น column
- `ai_confidence` ยังเป็น alias

---

## Notes

- ADR นี้เกิดจากเหตุการณ์จริงที่ทำให้ OCR text 183 records หายไปถาวร (Session 2026-09-14) — บันทึกไว้เป็นบทเรียน
- เริ่ม migration ใหม่ทั้งหมด — TRUNCATE migration_review_queue แล้ว re-ingest จาก Excel ใหม่ ไม่ต้อง backward compat
- หลัง implement ADR นี้ จะไม่สามารถเกิดเหตุการณ์เดียวกันซ้ำได้ เพราะ:
  - `source_file_path` อยู่ใน column ไม่ใช่ JSON → reset JSON ไม่กระทบ path
  - `review_state_json` แยกจาก `ai_metadata_json` → reset AI output ไม่ทำลาย review state
  - `ocr_text_bak` ใน `migration_review_queue` → สำเนาก่อน re-extract ทุกครั้ง กู้ได้ถ้าถูกทับ
  - `reExtractQueueItem` reset `ai_metadata_json` เท่านั้น → ไม่ทำลาย `review_state_json`
  - Extractor fallback หา PDF จาก attachment → ไม่เจอ NO_PDF โดยไม่จำเป็น
