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

### D3: Two-step flow — trigger (cache ผลลัพธ์พร้อม reOcrToken) → confirm (apply จริง)

**Decision**: แบ่งเป็น 2 endpoint:
1. `POST /attachments/:publicId/re-ocr` — รัน OCR engine ใหม่ (async ผ่าน BullMQ, reuse `QUEUE_NP_DMS_OCR`, **`priority: 1`** เพื่อข้ามหน้า migration batch jobs ที่ยังรอ) Response จาก endpoint นี้ต้องระบุ `reOcrToken` (UUIDv7), queue position + เวลาที่คาดว่าจะเสร็จ (estimated wait) เพื่อให้ admin รู้ว่าต้องรออีกสักเท่าไหร่ — **ไม่แตะ `attachments.ocr_text` เลยในขั้นตอนนี้**
2. `POST /attachments/:publicId/re-ocr/confirm` — admin เห็น diff แล้วกดยืนยัน โดยส่ง `{ reOcrToken }` มาด้วย → อ่านผลลัพธ์จาก Redis key ตาม token มา `UPDATE attachments SET ocr_text = ...` จริง แล้ว trigger re-embed (ดู D6)

> **Queue behavior**: `priority: 1` ใน BullMQ ทำให้ manual re-OCR job **ข้ามหน้า** migration jobs ที่ยังรอใน queue (รันเป็นตัวถัดไป) แต่ไม่หยุด job ที่กำลังรันอยู่ (active job ต้องรอจนเสร็จเอง) Worst case: lockDuration=180s → admin รอสูงสุด ~3 นาทีก่อนเริ่ม OCR จริง

**Rationale**: Human-in-the-loop คือหัวใจของ ADR นี้ — การส่ง `reOcrToken` ป้องกัน race condition กรณีที่ admin เปิดหลายหน้าต่าง หรือมี trigger ซ้อน ซึ่งอาจทำให้ยืนยันผลลัพธ์ผิด job

**Alternatives rejected**:
- Auto-replace ทันทีถ้า confidence ใหม่สูงกว่าเดิม — confidence ไม่ใช่ตัวชี้วัดที่เชื่อถือได้เพียงพอสำหรับการแทนที่ source of truth โดยไม่มีคนตรวจ
- Single endpoint ที่ replace ทันทีพร้อม `ocr_text_bak` เผื่อ rollback — ยังเป็น automatic overwrite ที่ไม่มีคนตรวจก่อน ต่างจากเจตนาหลักของ ADR นี้
- Webhook/SSE แจ้งผลเมื่อเสร็จ — เพิ่ม complexity เกินควร admin ใช้ polling GET เดียวกันกับ pattern ที่มีอยู่แล้วใน sandbox OCR flow

### D4: เก็บผลลัพธ์ระหว่างรอ confirm ใน Redis ด้วย Tokenized Key (TTL 72 ชั่วโมง / 3 วัน) — ไม่เพิ่ม column ใหม่

**Decision**: ผลลัพธ์ re-OCR ที่รอ confirm เก็บใน Redis key รูปแบบ **`attachment:re-ocr:{attachmentPublicId}:{reOcrToken}`** TTL **72 ชั่วโมง (3 วัน)** — หากหมดอายุโดยยังไม่ confirm ถือเป็นการ reject โดยปริยาย **ไม่มี endpoint "reject" แยกต่างหาก**

**Rationale**: การใช้ Tokenized Key ป้องกันการ overwritten ใน Redis กรณี trigger ซ้อน ข้อมูลนี้เป็นข้อมูลชั่วคราวโดยธรรมชาติ (รอ decision ของ admin) ไม่ควรอยู่ถาวรใน DB ตรงกับหลักการ "ไม่เพิ่ม schema เกินจำเป็น" (ADR-044) TTL 72 ชม. ให้เวลาเพียงพอสำหรับงานค้างข้ามวันหยุด

**Alternatives rejected**:
- Static Key (`attachment:re-ocr:{attachmentPublicId}`) — เสี่ยงเกิด race condition ถูก overwrite หากมี trigger ซ้อนระหว่างรอ confirm
- TTL 24 ชม. — สั้นเกินไปสำหรับ work cycle จริง: trigger วันศุกร์เย็น → กลับมา confirm เช้าวันจันทร์
- Column ใหม่ `ocr_text_pending` ใน `attachments` — persistent เกินความจำเป็นสำหรับข้อมูลชั่วคราว

### D5: Scope — single attachment เท่านั้น (ไม่รองรับ batch)

**Decision**: Endpoint รองรับ re-OCR ทีละ 1 attachment (`:publicId` เดียว) ไม่มี bulk/batch endpoint ในรอบนี้

**Rationale**: Human-in-the-loop ต้องดู diff ทีละไฟล์อยู่ดี แม้จะ trigger พร้อมกันหลายไฟล์ได้ ก็ไม่ได้ลดภาระ decision ของ admin ลง การจำกัด scope แคบช่วยลด complexity การ implement รอบแรก ขยายเป็น batch ได้ในอนาคตโดยไม่กระทบของเดิม (ไม่ hard-to-reverse)

**Alternatives rejected**:
- Batch endpoint ตั้งแต่แรก — เพิ่ม complexity (ต้องคิดเรื่อง partial success, progress tracking) โดยยังไม่มีความต้องการชัดเจน

### D6: หลัง confirm ต้องปรับ `rag_status = 'PENDING'` และ trigger re-embed เข้า Qdrant ใหม่

**Decision**: หลัง `POST /re-ocr/confirm` ได้รับการอนุมัติ ให้ดำเนินการใน DB Transaction เดียวกันกับการอัปเดต `ocr_text`:
1. `UPDATE attachments SET ocr_text = newText, rag_status = 'PENDING', rag_last_error = NULL WHERE public_id = ...` (ตาม ADR-022)
2. ลบ chunks เดิมของ attachment นั้นออกจาก Qdrant (filter ด้วย `attachmentPublicId` + `projectPublicId` ตาม ADR-023A, reuse `QUEUE_AI_VECTOR_DELETION`)
3. Enqueue job เข้า `QUEUE_AI_RAG_INGEST` เพื่อตัด Chunk และทำ Embedding ใหม่
4. เมื่อ `RagAttachmentIngestProcessor` ทำงานสำเร็จ จะเปลี่ยน `rag_status` ➔ **`'INDEXED'`** (หากล้มเหลวจะกลายเป็น **`'FAILED'`** เพื่อให้ Vector Health Check Cron ตาม ADR-056 D4 สแกนเจอและซ่อมแซมได้)

**Rationale**: `attachments.ocr_text` คือ source ของ RAG chunking/embedding การตั้งสถานะ `rag_status = 'PENDING'` ทันทีขณะอัปเดต DB ช่วยให้สถานะของ Vector ในระบบสอดคล้องกับสถานะประมวลผลจริง และช่วยให้ระบบ Self-Healing (ADR-056) สามารถตรวจจับและ Re-embed ซ้ำได้หากเกิด Network Fault ระหว่างทาง

**Alternatives rejected**:
- ไม่อัปเดต `rag_status` เป็น `'PENDING'` ใน Transaction — เสี่ยงเกิด silent discrepancy หากกระบวนการ Re-embed หรือ Qdrant มีปัญหาหลังจากอัปเดต DB สำเร็จ
- ไม่ re-embed อัตโนมัติ ให้ admin สั่งแยกเอง — เพิ่มขั้นตอนที่ admin อาจลืมทำ ทำให้ RAG กับ `ocr_text` ไม่ sync กันโดยไม่มีใครรู้

### D7: ให้ admin เลือก OCR engine เอง — default = `'np-dms-ocr'` (ไม่มี Silent Automatic Fallback)

**Decision**: `POST /re-ocr` รับ parameter `engineType: SandboxOcrEngineType` (`'auto' | 'np-dms-ocr'` — ตามที่มีอยู่จริงใน `sandbox-ocr-engine.service.ts:25`) ให้ admin เลือกจาก dropdown ใน UI โดย **default = `'np-dms-ocr'`** (ไม่ใช่ `'auto'`)

UI แสดงคำอธิบายให้ admin เลือกได้อย่างมี context:
- **`np-dms-ocr` (แนะนำ / default)** — Vision model OCR สำหรับเอกสารที่ text layer ไม่ชัด หรือ scan ที่อ่านยาก ใช้ GPU, ช้ากว่า แต่แม่นยำกว่าสำหรับงาน re-OCR
- **`auto`** — ระบบเลือกให้อัตโนมัติ (PyMuPDF CPU → np-dms-ocr fallback) เหมาะสำหรับไฟล์ที่ text layer ชัดเจนอยู่แล้ว

**No Silent Automatic Fallback**: หากเลือก `np-dms-ocr` แล้วล้มเหลว (เช่น GPU VRAM ไม่พอ) ระบบจะ **ไม่ถอยไปใช้ `auto` เองโดยอัตโนมัติ** แต่จะบันทึกสถานะล้มเหลวพร้อมสาเหตุลง Redis (D10) และเสนอทางเลือกให้ Admin ตัดสินใจบน UI เองว่าต้องการลองใหม่ด้วย Vision Model หรือสลับไปใช้ `auto`

**Rationale**: เหตุผลหลักที่ admin trigger re-OCR คือ **ผลลัพธ์เดิมไม่ดี** — หากทำ Silent Fallback สลับไปใช้ `auto` เองโดยอัตโนมัติ จะได้ผลลัพธ์อ่านผิดเดิมๆ กลับมา ย้อนแย้งกับวัตถุประสงค์ของ feature และหลักการ Human-in-the-loop

**Alternatives rejected**:
- Default = `'auto'` — มีโอกาสได้ผลเหมือนเดิม ลดประโยชน์ของ feature นี้โดยไม่จำเป็น
- Silent Fallback ถอยไปใช้ `auto` อัตโนมัติเมื่อ Vision Model ล้มเหลว — ส่งผลลัพธ์เดิมกลับมาให้ Admin โดยไม่ผ่านการยินยอม
- Fix `'np-dms-ocr'` เสมอ ไม่ให้เลือก — ขาด flexibility สำหรับ use case ที่ `'auto'` เหมาะกว่า

### D8: ไม่มี rollback-after-confirm — confirm คือ final decision

**Decision**: หลัง admin กด confirm และ `attachments.ocr_text` ถูกแทนที่แล้ว **ไม่มี mechanism กู้คืนค่าก่อนหน้า** (ไม่มี `ocr_text_bak` column) ถ้าต้องการค่าเดิมคืนต้อง re-OCR ใหม่อีกรอบ (ผลลัพธ์อาจไม่เหมือนเดิม 100% ถ้า engine/ไฟล์เปลี่ยนไป)

**Rationale**: Confirm เป็น explicit human decision ที่เห็น diff ก่อนตัดสินใจแล้ว (D3) ต่างจากกรณี data-loss ที่ ADR-054 แก้ (automatic overwrite ไม่มีคนตรวจ) — ถ้า admin ตัดสินใจผิดพลาดหลังเห็น diff เอง เป็นความรับผิดชอบของการตัดสินใจนั้น ไม่ใช่ bug ที่ระบบต้องป้องกัน การไม่มี column เพิ่มเติมทำให้ schema เรียบง่ายกว่า ตรงกับหลักการ "ไม่เพิ่ม schema เกินจำเป็น" (ADR-044)

**Alternatives rejected**:
- เพิ่ม `ocr_text_bak` เก็บค่าก่อน confirm 1 เวอร์ชัน — เพิ่ม storage cost ถาวรโดยไม่จำเป็น เพราะมี human decision point ป้องกันความผิดพลาดไว้แล้วที่ D3 (ยืนยันกับ user 2026-09-14)

### D9: Block trigger ถ้า `aiProcessingStatus = 'PROCESSING'` เท่านั้น

**Decision**: `POST /re-ocr` ต้องตรวจ `attachments.ai_processing_status` ก่อนรับ job:
- **`PROCESSING`** → **reject 409 Conflict** — มี OCR job เดิมกำลังรันอยู่ ห้าม trigger ซ้อน (race condition ระหว่าง 2 jobs แย่งเขียน Redis key เดียวกัน)
- **`PENDING`** → **อนุญาต** — job เดิมอาจค้างใน queue นานโดยไม่มี worker รับ (edge case จริง) admin มีสิทธิ์ข้ามผ่าน
- **`DONE`** → **อนุญาต** — กรณีปกติ re-OCR เพื่อปรับปรุงคุณภาพ
- **`FAILED`** → **อนุญาต** — กรณีปกติ retry ด้วย engine อื่น

**Rationale**: `PROCESSING` คือสถานะเดียวที่มี active job กำลังประมวลผลอยู่จริง — การ trigger ซ้อนจะทำให้ Redis key ถูกเขียนทับโดย job ที่เสร็จก่อน ส่วน `PENDING` แม้จะ "รออยู่" แต่ไม่มี active lock ไม่มี race condition จริง และ admin อาจเจอ case ที่ PENDING ค้างนาน (worker หยุด หรือ queue ล้น) ซึ่งควรให้ admin มีทางออก

**Alternatives rejected**:
- Block ทั้ง `PENDING` และ `PROCESSING` — เข้มงวดเกินไป กรณี PENDING ค้าง admin จะไม่มีทางออกเลย
- ไม่ block เลย — เสี่ยง race condition เมื่อ PROCESSING job กำลังรันและ manual re-OCR เข้ามาแย่งเขียน Redis

### D10: Processor ต้องเขียน `status: 'failed'` กลับ Redis ก่อน throw — แก้ existing bug ใน `np-dms-ocr-processor.ts` ด้วย

> **Existing Bug**: `np-dms-ocr-processor.ts` error path (line 148–159) ปัจจุบัน `throw` โดยไม่เขียน `ai:np-dms-ocr:{idempotencyKey}` status เลย ต่างจาก `ai-batch.processor.ts` (sandbox OCR) ที่ pattern ถูกต้อง — catch block เขียน `ai:rag:result:{key}` → `status: 'failed'` ก่อน throw (line 929–939)

**Decision**: แก้ `NpDmsOcrProcessor` ให้เขียน failed status กลับ Redis ก่อน throw เสมอ (2 key):
1. `ai:np-dms-ocr:{idempotencyKey}` — **bugfix existing behavior** เพื่อให้ polling ทั่วไปได้รับผล (TTL 1h)
2. `attachment:re-ocr:{publicId}` — **feature ใหม่** เฉพาะ re-OCR jobs (TTL 1h)

```json
{
  "status": "failed",
  "errorMessage": "VRAM ไม่เพียงพอสำหรับ np-dms-ocr...",
  "failedAt": "2026-09-16T10:00:00.000Z"
}
```

TTL ของ failed key — **1 ชั่วโมง** (vs. completed = 72h ตาม D4) เพื่อให้ admin ทราบว่า job fail และสามารถ trigger ใหม่ได้ ไม่เก็บ error state ค้างนาน

**Rationale**: ถ้า processor `throw` โดยไม่เขียน Redis — frontend polling จะได้ `status: 'queued'` หรือ `status: 'processing'` ค้างไปตลอดจนกว่า TTL 72h หมด admin ไม่รู้ว่า job fail หรือแค่ช้า เป็น silent failure ที่ไม่ยอมรับได้สำหรับ admin tool แก้ bug นี้พร้อมกับ implement ADR-055 เพราะ ต้องแตะไฟล์เดียวกันอยู่แล้ว

**Alternatives rejected**:
- ปล่อยให้ frontend polling timeout เอง (ไม่เขียน failed status) — silent failure ทำให้ UX แย่มาก admin ไม่รู้ว่าต้องทำอะไรต่อ
- ใช้ TTL เดียวกัน (72h) สำหรับทั้ง failed และ completed — error state ค้างนานเกินความจำเป็น
- แยก fix เป็น PR แยก — ต้องแตะไฟล์เดียวกันอยู่แล้ว เพิ่มความซับซ้อนโดยไม่จำเป็น

---


## Consequences

### Positive

- Admin สามารถปรับปรุงคุณภาพ OCR ของเอกสารที่มีอยู่แล้วในระบบได้ โดยไม่เสี่ยง data loss (source of truth ไม่ถูกแตะจนกว่าจะ confirm)
- ไม่เพิ่ม schema ใหม่เลย — ใช้ Redis สำหรับข้อมูลชั่วคราว, reuse OCR engine + BullMQ queue ที่มีอยู่แล้ว
- RAG/Qdrant sync กับ `attachments.ocr_text` เสมอหลัง confirm (D6)
- Scope แคบ (single attachment, RBAC จำกัด) ลด blast radius ของ feature ใหม่

### Negative

- ไม่มี rollback-after-confirm — ถ้า admin ตัดสินใจผิดพลาด ต้อง re-OCR ใหม่เพื่อพยายามกู้คืน (อาจไม่ได้ผลลัพธ์เดิม 100%)
- Redis TTL 72 ชม. (3 วัน) — ถ้า admin ไม่ confirm ภายใน 3 วันต้อง trigger ใหม่ (เสีย GPU cycle ซ้ำ) แต่ครอบคลุม work cycle ปกติรวมถึงกรณีวันหยุดแล้ว
- ไม่รองรับ batch — ถ้าต้องการ re-OCR หลายไฟล์ต้องทำทีละไฟล์ในรอบแรกนี้

### Neutral

- Feature นี้แยกจาก migration flow โดยสิ้นเชิง (D2) — ไม่กระทบ `migration_review_queue` หรือ ADR-054 เลย
- ใช้ RBAC role ที่มีอยู่แล้ว (`superadmin`/`admin`) ไม่ต้องสร้าง role/permission ใหม่
- Frontend polling (D9) reuse pattern เดียวกับ sandbox OCR flow ที่มีอยู่แล้ว

---

## Schema Changes

**ไม่มี** — ADR นี้ไม่เพิ่ม column/table ใหม่เลย ข้อมูลระหว่างรอ confirm อยู่ใน Redis (D4) ไม่มี rollback mechanism ที่ต้องพึ่ง column สำรอง (D8)

---

## Implementation Plan

| ขั้นตอน | ไฟล์ | งาน |
|---------|------|----- |
| 1 | `backend/src/modules/ai/processors/np-dms-ocr-processor.ts` | **[BUGFIX]** เพิ่ม error path เขียน `ai:np-dms-ocr:{idempotencyKey}` → `status: 'failed'` + TTL 1h ก่อน throw (D10) — แก้ gap ที่มีอยู่เปรียบเทียบ `ai-batch.processor.ts` pattern |
| 2 | `backend/src/modules/ai/ai-queue.service.ts` | เพิ่ม `enqueueAttachmentReOcr()` method เข้า `QUEUE_NP_DMS_OCR` ด้วย `priority: 1` (D3) พร้อม response ส่ง `queuePosition` กลับให้ admin ทราบ |
| 3 | `backend/src/common/file-storage/attachment-re-ocr.service.ts` (ใหม่) | trigger: ตรวจ `aiProcessingStatus` (D9) → เรียก `enqueueAttachmentReOcr()` → เก็บ `attachment:re-ocr:{publicId}` TTL 72h; status: polling; confirm: อ่าน Redis → UPDATE → Qdrant delete → re-embed |
| 4 | `backend/src/common/file-storage/file-storage.controller.ts` | เพิ่ม `POST :publicId/re-ocr` + `GET :publicId/re-ocr/status` + `POST :publicId/re-ocr/confirm` พร้อม RBAC guard (`superadmin`/`admin` เท่านั้น) |
| 5 | Frontend | หน้า diff view (เก่า vs ใหม่) + spinner + polling `GET /re-ocr/status` ทุก 3วิ + engine selector (default: `np-dms-ocr`) + confirm/cancel — เฉพาะ `superadmin`/`admin` เห็นปุ่ม re-OCR |
| 6 | `np-dms-ocr-processor.spec.ts` + `attachment-re-ocr.service.spec.ts` + controller spec | เพิ่ม tests ทั้ง bugfix และ feature (ดูใน Tests ที่ต้องเพิ่ม) |

### Tests ที่ต้องเพิ่ม

- Trigger re-OCR ไม่แก้ `attachments.ocr_text` จนกว่าจะ confirm
- Trigger response มี `queuePosition` และ `status: 'queued'`
- `GET /re-ocr/status` ส่ง `status: 'processing'` เมื่อ job เริ่มรัน และ `status: 'completed'` พร้อม `newText` เมื่อเสร็จ
- Confirm ต้องมาจาก key ที่ยังไม่หมด TTL — ถ้าหมดอายุ reject request
- RBAC: role อื่นที่ไม่ใช่ `superadmin`/`admin` เรียก endpoint ไม่ได้
- Confirm สำเร็จ → `attachments.ocr_text` เปลี่ยนตามผลลัพธ์ใหม่ + Qdrant chunks เดิมถูกลบ + embed job ใหม่ถูก enqueue
- Engine selector ส่งค่าที่ไม่อยู่ใน `SandboxOcrEngineType` → reject ด้วย validation error
- `priority: 1` job ขึ้นหน้าคิวหลัง migration batch job (priority: 10) ใน queue เดียวกัน
- Trigger ขณะ `aiProcessingStatus = 'PROCESSING'` → reject 409 Conflict (D9)
- Trigger ขณะ `aiProcessingStatus = 'PENDING'` หรือ `'FAILED'` → อนุญาตปกติ (D9)
- OCR job FAILED (VRAM ไม่พอ) → `GET /re-ocr/status` ส่ง `{ status: 'failed', errorMessage }` ไม่ใช่ spinner ค้าง (D10)
- Failed Redis key หมด TTL 1h → `GET /re-ocr/status` ส่ง 404 (ไม่ใช่ค้าง) (D10)

---

## Notes

- ADR นี้แยกออกมาจาก ADR-054 D6 เดิม (ถูกตัดออกเพราะไม่มี use case ใน migration/production ingestion ปกติ) — เป็น net-new capability ที่ไม่เคยมีในระบบมาก่อน
- ทุก decision ในนี้ยึดหลัก human-in-the-loop เป็นแกนกลาง — ไม่มีจุดไหนที่ `attachments.ocr_text` ถูกแทนที่โดยไม่มี admin เห็น diff ก่อน
- **[BUGFIX included]** D10 แก้ existing gap ใน `np-dms-ocr-processor.ts` ที่ error path ไม่เคยเขียน `status: 'failed'` กลับ Redis — เสนอให้แก้ใน PR เดียวกันเพราะต้องแตะไฟล์เดียวกันอยู่แล้ว (เทียบ pattern: `ai-batch.processor.ts` line 929–939 ทำถูกต้องอยู่แล้ว)
