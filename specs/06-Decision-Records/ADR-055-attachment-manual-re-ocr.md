// File: specs/06-Decision-Records/ADR-055-attachment-manual-re-ocr.md
// Change Log:
// - 2026-09-14: Initial creation — เพิ่มความสามารถ manual re-OCR ให้ attachment ที่มีอยู่แล้วใน
//   production พร้อม human-in-the-loop compare-before-replace (แยกออกมาจาก ADR-054 D6 เดิมที่ถูกตัด
//   เพราะเป็น scope creep — ADR-054 แก้ data-loss bug ของ migration, ADR นี้คือ net-new capability)

# ADR-055: Attachment Manual Re-OCR — Human-in-the-loop Compare-before-Replace

**Status**: Accepted
**Date**: 2026-09-14
**Related Documents**:
- [ADR-054: Migration Review Queue Metadata Separation](./ADR-054-migration-review-queue-metadata-separation.md) (ที่มาของ scope นี้ — D6 เดิมถูกตัดออกเพราะไม่มี use case ใน migration/production ingestion ปกติ แนะนำให้แยก ADR เพราะเป็น net-new capability)
- [ADR-042: Sandbox Project + OCR Text Persistence](./ADR-042-sandbox-project-and-ocr-text-persistence.md) (OCR text persistence policy, `attachments.ocr_text`)
- [ADR-023A: Unified AI Architecture](./ADR-023A-unified-ai-architecture.md) (Qdrant `projectPublicId` filter — ใช้ตอน re-embed)
- [ADR-016: Security & Authentication Strategy](./ADR-016-security-authentication.md) (RBAC)
- `backend/src/common/file-storage/` (Attachment module — ที่ตั้งของ feature นี้)
- `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` (OCR engine — reuse)
- `backend/src/common/file-storage/entities/attachment.entity.ts` (`ocr_text` column)

---

## Context and Problem Statement

ระหว่าง grill ADR-054 (migration data-loss fix) มีการเสนอให้เพิ่ม `attachments.ocr_text_bak` เพื่อป้องกันการเขียนทับ `attachments.ocr_text` ในกรณี production ingestion re-OCR — แต่ตรวจโค้ดแล้วพบว่า **ไม่มี capability "re-OCR เอกสารที่มีอยู่แล้ว" ในระบบเลย** (`processRagPrepare` เป็น write-once + reuse เท่านั้น ไม่มี overwrite path) จึงตัด D6 ออกจาก ADR-054 และแยกมาเป็น ADR นี้แทน เพราะเป็นการเพิ่ม capability ใหม่ทั้งหมด (net-new) ไม่ใช่ safety fix ของสิ่งที่มีอยู่แล้ว

**ความต้องการจริง**: บางครั้ง `attachments.ocr_text` ที่มีอยู่ในระบบมีคุณภาพไม่ดี (OCR engine เดิมตอน ingest อ่านผิด/อ่านไม่ครบ) และต้องการให้ admin สั่ง re-OCR ใหม่ด้วย engine ที่ดีกว่า/ใหม่กว่า แล้วเปรียบเทียบกับของเดิมก่อนตัดสินใจแทนที่

---

## Decision Drivers

- **Human-in-the-loop** — `attachments.ocr_text` เป็น source of truth ของ production (RAG อ่านจากตรงนี้) การแทนที่ต้องมีคนตรวจสอบก่อนเสมอ ไม่ใช่ automatic overwrite
- **Minimal schema footprint** — ไม่เพิ่ม column ถาวรถ้าไม่จำเป็น (ADR-044) — ข้อมูลระหว่างรอตัดสินใจเป็นข้อมูลชั่วคราว
- **RAG consistency** — ถ้า `ocr_text` เปลี่ยน ข้อมูลใน Qdrant ต้อง sync ตาม ไม่ปล่อยให้ stale
- **Reuse ของที่มีอยู่แล้ว** — OCR engine, BullMQ queue infrastructure ที่มีอยู่แล้ว ไม่สร้างใหม่ซ้ำซ้อน
- **จำกัดความเสี่ยง** — จำกัด RBAC และ scope ให้แคบที่สุดเท่าที่ยังใช้งานได้จริง (ลด blast radius ของ feature ใหม่)

---

## Decisions

### D1: Manual trigger เท่านั้น — จำกัด RBAC เฉพาะ `superadmin`/`admin`

**Decision**: ไม่มี automatic/scheduled re-OCR job ใดๆ — ต้องเป็น `superadmin` หรือ `admin` เท่านั้นที่กด trigger เองผ่าน UI ทีละ attachment

**Rationale**: Re-OCR กระทบ source of truth ของ production data โดยตรง — ไม่มี clear trigger condition ที่ปลอดภัยสำหรับ automatic job (ต่างจาก migration ที่มี signal ชัดเจนคือ "metadata format เก่า") automatic job จะสิ้นเปลือง GPU resource บน `np-dms-lcbp3` โดยไม่มีเหตุผลชัดเจนว่าเมื่อไหร่ควรรัน จำกัด role แคบที่สุดเพราะกระทบข้อมูลที่ใช้งานจริงในระบบ

**Alternatives rejected**:
- Scheduled batch job re-OCR เอกสารทั้งหมดเป็นระยะ — สิ้นเปลือง resource โดยไม่มี signal ว่าเอกสารไหนต้องการจริง
- เปิดให้ role อื่น (เช่น Project Manager) trigger ได้ — เพิ่มความเสี่ยงโดยไม่จำเป็น เพราะกระทบ production data โดยตรง

### D2: Reuse เฉพาะ OCR extraction logic — ไม่ reuse `migration_review_queue`

**Decision**: ใช้ `SandboxOcrEngineService.detectAndExtract()` (engine เดียวกับที่ migration/sandbox ใช้) สำหรับรัน OCR ใหม่ แต่ flow/state ทั้งหมดเป็นของ Attachment module เอง (`backend/src/common/file-storage/`) ไม่เกี่ยวกับ `migration_review_queue` table หรือ migration review flow เลย

**Rationale**: `migration_review_queue` มี lifecycle เฉพาะของ migration (batch import ครั้งเดียว, มี `review_state_json`, ผูกกับ `documentNumber`) ไม่เหมาะกับ attachment เดี่ยวๆ ใน production ที่อาจถูก re-OCR ซ้ำได้หลายครั้งตลอดอายุของเอกสาร การ reuse เฉพาะ engine logic (ซึ่งเป็น stateless function) ปลอดภัยกว่าการดึง table/flow ทั้งกระบวนการมาผูกกัน

**Alternatives rejected**:
- Reuse ทั้ง review-queue pattern (ส่งผล re-OCR เข้า `migration_review_queue`) — ผูก production attachment lifecycle เข้ากับ migration table ที่ออกแบบมาเพื่อ one-time batch import ทำให้ schema สับสน (attachment ที่ไม่เกี่ยวกับ migration เลยจะมีแถวใน migration table)
- เขียน OCR extraction logic ใหม่ทั้งหมด — ซ้ำซ้อนกับของที่มีอยู่แล้ว เพิ่มความเสี่ยง inconsistency ระหว่าง engine ที่ migration ใช้กับที่ production ใช้

### D3: Two-step flow — trigger (cache ผลลัพธ์) → confirm (apply จริง)

**Decision**: แบ่งเป็น 2 endpoint:
1. `POST /attachments/:publicId/re-ocr` — รัน OCR engine ใหม่ (async ผ่าน BullMQ, reuse `QUEUE_NP_DMS_OCR`), เก็บผลลัพธ์ไว้ใน Redis ชั่วคราว (ดู D4) พร้อมส่งกลับให้ frontend แสดง diff กับ `attachments.ocr_text` เดิม — **ไม่แตะ `attachments.ocr_text` เลยในขั้นตอนนี้**
2. `POST /attachments/:publicId/re-ocr/confirm` — admin เห็น diff แล้วกดยืนยัน → อ่านผลลัพธ์จาก Redis มา `UPDATE attachments SET ocr_text = ...` จริง แล้ว trigger re-embed (ดู D6)

**Rationale**: Human-in-the-loop คือหัวใจของ ADR นี้ — engine ใหม่อาจให้ confidence score สูงแต่ผลลัพธ์ผิดจริงก็ได้ (OCR quality metric ไม่น่าเชื่อถือ 100%) การแยก trigger กับ apply ออกจากกันทำให้ `attachments.ocr_text` (source of truth การผลิตจริง) ไม่ถูกแตะจนกว่าจะมีคนยืนยันเห็นด้วยตา

**Alternatives rejected**:
- Auto-replace ทันทีถ้า confidence ใหม่สูงกว่าเดิม — confidence ไม่ใช่ตัวชี้วัดที่เชื่อถือได้เพียงพอสำหรับการแทนที่ source of truth โดยไม่มีคนตรวจ
- Single endpoint ที่ replace ทันทีพร้อม `ocr_text_bak` เผื่อ rollback — ยังเป็น automatic overwrite ที่ไม่มีคนตรวจก่อน ต่างจากเจตนาหลักของ ADR นี้

### D4: เก็บผลลัพธ์ระหว่างรอ confirm ใน Redis (TTL 24 ชั่วโมง) — ไม่เพิ่ม column ใหม่

**Decision**: ผลลัพธ์ re-OCR ที่รอ confirm เก็บใน Redis key เช่น `attachment:re-ocr:{attachmentPublicId}` (รูปแบบเดียวกับ pattern ที่มีอยู่แล้ว `ai:sandbox:ocr:${idempotencyKey}`) TTL 24 ชั่วโมง — ถ้าหมดอายุโดยยังไม่ confirm ถือเป็นการ reject โดยปริยาย **ไม่มี endpoint "reject" แยกต่างหาก**

**Rationale**: ข้อมูลนี้เป็นข้อมูลชั่วคราวโดยธรรมชาติ (รอ decision ของ admin) ไม่ควรอยู่ถาวรใน DB ตรงกับหลักการ "ไม่เพิ่ม schema เกินจำเป็น" (ADR-044) TTL 24 ชม. เหมาะกับ manual-trigger ที่ admin ควรกลับมาตัดสินใจในวันเดียวกัน ถ้าหมดอายุก็แค่ trigger ใหม่ ไม่มี cost สูง (`attachments.ocr_text` จริงไม่เคยถูกแตะจนกว่าจะ confirm — ปลอดภัยโดย design)

**Alternatives rejected**:
- Column ใหม่ `ocr_text_pending` ใน `attachments` — persistent เกินความจำเป็นสำหรับข้อมูลที่ควรตัดสินใจเร็ว เพิ่ม storage cost ถาวร (LONGTEXT) โดยไม่จำเป็น
- ไม่มี TTL (เก็บถาวรจนกว่าจะ confirm/reject) — เสี่ยง Redis เต็มด้วยข้อมูลที่ไม่มีใครมาตัดสินใจต่อ

### D5: Scope — single attachment เท่านั้น (ไม่รองรับ batch)

**Decision**: Endpoint รองรับ re-OCR ทีละ 1 attachment (`:publicId` เดียว) ไม่มี bulk/batch endpoint ในรอบนี้

**Rationale**: Human-in-the-loop ต้องดู diff ทีละไฟล์อยู่ดี แม้จะ trigger พร้อมกันหลายไฟล์ได้ ก็ไม่ได้ลดภาระ decision ของ admin ลง การจำกัด scope แคบช่วยลด complexity การ implement รอบแรก ขยายเป็น batch ได้ในอนาคตโดยไม่กระทบของเดิม (ไม่ hard-to-reverse)

**Alternatives rejected**:
- Batch endpoint ตั้งแต่แรก — เพิ่ม complexity (ต้องคิดเรื่อง partial success, progress tracking) โดยยังไม่มีความต้องการชัดเจน

### D6: หลัง confirm ต้อง trigger re-embed เข้า Qdrant ใหม่

**Decision**: หลัง `POST /re-ocr/confirm` เขียน `attachments.ocr_text` ใหม่สำเร็จ ต้อง:
1. ลบ chunks เดิมของ attachment นั้นออกจาก Qdrant (filter ด้วย `attachmentPublicId` + `projectPublicId` ตาม ADR-023A, reuse `QUEUE_AI_VECTOR_DELETION`)
2. Enqueue embed-document job ใหม่ (reuse `QUEUE_AI_RAG_INGEST` / logic เดียวกับ `processEmbedDocument`)

**Rationale**: `attachments.ocr_text` คือ source ของ RAG chunking/embedding — ถ้าไม่ sync ตาม semantic search จะ match กับข้อความเก่าที่ไม่มีอยู่จริงแล้ว เป็น inconsistency ที่ร้ายแรงกว่าการไม่มี re-OCR เลย

**Alternatives rejected**:
- ไม่ re-embed อัตโนมัติ ให้ admin สั่งแยกเอง — เพิ่มขั้นตอนที่ admin อาจลืมทำ ทำให้ RAG กับ `ocr_text` ไม่ sync กันโดยไม่มีใครรู้

### D7: ให้ admin เลือก OCR engine เอง (ไม่ fix auto-detect)

**Decision**: `POST /re-ocr` รับ parameter `engineType: SandboxOcrEngineType` (`'auto' | 'np-dms-ocr'` — ตามที่มีอยู่จริงใน `sandbox-ocr-engine.service.ts:25`) ให้ admin เลือกจาก dropdown ใน UI

**Rationale**: ถ้า fix เป็น `'auto'` เดิมเสมอ ผลลัพธ์ re-OCR อาจออกมาเหมือนเดิมทุกประการ (logic เดียวกัน input เดียวกัน) ทำให้ไม่มีประโยชน์จากการ re-OCR เลย เหตุผลหลักที่ trigger re-OCR คือต้องการลองผลลัพธ์จาก engine อื่น/เวอร์ชันใหม่กว่า

**Alternatives rejected**:
- Fix `'auto'` เสมอ — ลดประโยชน์ของ feature นี้ลงมาก ตามที่อธิบายข้างต้น

### D8: ไม่มี rollback-after-confirm — confirm คือ final decision

**Decision**: หลัง admin กด confirm และ `attachments.ocr_text` ถูกแทนที่แล้ว **ไม่มี mechanism กู้คืนค่าก่อนหน้า** (ไม่มี `ocr_text_bak` column) ถ้าต้องการค่าเดิมคืนต้อง re-OCR ใหม่อีกรอบ (ผลลัพธ์อาจไม่เหมือนเดิม 100% ถ้า engine/ไฟล์เปลี่ยนไป)

**Rationale**: Confirm เป็น explicit human decision ที่เห็น diff ก่อนตัดสินใจแล้ว (D3) ต่างจากกรณี data-loss ที่ ADR-054 แก้ (automatic overwrite ไม่มีคนตรวจ) — ถ้า admin ตัดสินใจผิดพลาดหลังเห็น diff เอง เป็นความรับผิดชอบของการตัดสินใจนั้น ไม่ใช่ bug ที่ระบบต้องป้องกัน การไม่มี column เพิ่มเติมทำให้ schema เรียบง่ายกว่า ตรงกับหลักการ "ไม่เพิ่ม schema เกินจำเป็น" (ADR-044)

**Alternatives rejected**:
- เพิ่ม `ocr_text_bak` เก็บค่าก่อน confirm 1 เวอร์ชัน — เพิ่ม storage cost ถาวรโดยไม่จำเป็น เพราะมี human decision point ป้องกันความผิดพลาดไว้แล้วที่ D3 (ยืนยันกับ user 2026-09-14)

---

## Consequences

### Positive

- Admin สามารถปรับปรุงคุณภาพ OCR ของเอกสารที่มีอยู่แล้วในระบบได้ โดยไม่เสี่ยง data loss (source of truth ไม่ถูกแตะจนกว่าจะ confirm)
- ไม่เพิ่ม schema ใหม่เลย — ใช้ Redis สำหรับข้อมูลชั่วคราว, reuse OCR engine + BullMQ queue ที่มีอยู่แล้ว
- RAG/Qdrant sync กับ `attachments.ocr_text` เสมอหลัง confirm (D6)
- Scope แคบ (single attachment, RBAC จำกัด) ลด blast radius ของ feature ใหม่

### Negative

- ไม่มี rollback-after-confirm — ถ้า admin ตัดสินใจผิดพลาด ต้อง re-OCR ใหม่เพื่อพยายามกู้คืน (อาจไม่ได้ผลลัพธ์เดิม 100%)
- Redis TTL 24 ชม. — ถ้า admin ไม่ confirm ทันเวลาต้อง trigger ใหม่ (เสีย GPU cycle ซ้ำ)
- ไม่รองรับ batch — ถ้าต้องการ re-OCR หลายไฟล์ต้องทำทีละไฟล์ในรอบแรกนี้

### Neutral

- Feature นี้แยกจาก migration flow โดยสิ้นเชิง (D2) — ไม่กระทบ `migration_review_queue` หรือ ADR-054 เลย
- ใช้ RBAC role ที่มีอยู่แล้ว (`superadmin`/`admin`) ไม่ต้องสร้าง role/permission ใหม่

---

## Schema Changes

**ไม่มี** — ADR นี้ไม่เพิ่ม column/table ใหม่เลย ข้อมูลระหว่างรอ confirm อยู่ใน Redis (D4) ไม่มี rollback mechanism ที่ต้องพึ่ง column สำรอง (D8)

---

## Implementation Plan

| ขั้นตอน | ไฟล์ | งาน |
|---------|------|-----|
| 1 | `backend/src/common/file-storage/file-storage.controller.ts` | เพิ่ม `POST :publicId/re-ocr` (trigger) + `POST :publicId/re-ocr/confirm` endpoint พร้อม RBAC guard (`superadmin`/`admin` เท่านั้น) |
| 2 | `backend/src/common/file-storage/file-storage.service.ts` (หรือ service ใหม่ `attachment-re-ocr.service.ts`) | เรียก `SandboxOcrEngineService.detectAndExtract()` ด้วย `engineType` ที่ admin เลือก, เก็บผลลง Redis (`attachment:re-ocr:{publicId}`, TTL 24h) |
| 3 | (service เดียวกัน) | `confirm`: อ่านผลจาก Redis → `UPDATE attachments SET ocr_text = ...` → ลบ Qdrant chunks เดิม (`QUEUE_AI_VECTOR_DELETION`) → enqueue embed job ใหม่ (`QUEUE_AI_RAG_INGEST`) |
| 4 | Frontend | หน้า diff view (เก่า vs ใหม่) + ปุ่ม engine selector + confirm/cancel — เฉพาะ `superadmin`/`admin` เห็นปุ่ม re-OCR |
| 5 | `backend/src/common/file-storage/file-storage.controller.spec.ts` + service spec | เพิ่ม tests: RBAC reject ถ้าไม่ใช่ admin, `attachments.ocr_text` ไม่เปลี่ยนจนกว่าจะ confirm, confirm สำเร็จแล้ว trigger re-embed, TTL หมดอายุแล้ว confirm ไม่ได้ |

### Tests ที่ต้องเพิ่ม

- Trigger re-OCR ไม่แก้ `attachments.ocr_text` จนกว่าจะ confirm
- Confirm ต้องมาจาก key ที่ยังไม่หมด TTL — ถ้าหมดอายุ reject request
- RBAC: role อื่นที่ไม่ใช่ `superadmin`/`admin` เรียก endpoint ไม่ได้
- Confirm สำเร็จ → `attachments.ocr_text` เปลี่ยนตามผลลัพธ์ใหม่ + Qdrant chunks เดิมถูกลบ + embed job ใหม่ถูก enqueue
- Engine selector ส่งค่าที่ไม่อยู่ใน `SandboxOcrEngineType` → reject ด้วย validation error

---

## Notes

- ADR นี้แยกออกมาจาก ADR-054 D6 เดิม (ถูกตัดออกเพราะไม่มี use case ใน migration/production ingestion ปกติ) — เป็น net-new capability ที่ไม่เคยมีในระบบมาก่อน
- ทุก decision ในนี้ยึดหลัก human-in-the-loop เป็นแกนกลาง — ไม่มีจุดไหนที่ `attachments.ocr_text` ถูกแทนที่โดยไม่มี admin เห็น diff ก่อน
