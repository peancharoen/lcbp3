// File: specs/06-Decision-Records/ADR-055-attachment-manual-re-ocr.md
// Change Log:
// - 2026-09-14: Initial creation — เพิ่มความสามารถ manual re-OCR ให้ attachment ที่มีอยู่แล้วใน
//   production พร้อม human-in-the-loop compare-before-replace (แยกออกมาจาก ADR-054 D6 เดิมที่ถูกตัด
//   เพราะเป็น scope creep — ADR-054 แก้ data-loss bug ของ migration, ADR นี้คือ net-new capability)
// - 2026-09-19: Grill session — แก้สมมติฐานที่ไม่ตรงโค้ดจริง 16 ข้อ:
//   (1) QUEUE_NP_DMS_OCR เป็น dead queue ไม่มี producer + BullMQ priority:1 deprioritize ไม่ใช่ข้ามหน้า
//       → ชุบชีวิต queue เป็น dedicated sequential OCR queue โดยไม่ใช้ priority (D3)
//   (2) OcrCacheService 24h จะคืน text เดิม → เพิ่ม forceRefresh ข้าม cache-read (D15)
//   (3) re-embed ใช้ reingest pattern (ingest(force=true) → enqueue หลัง commit) แทน manual
//       Qdrant deletion — force=true บังคับเพราะ checksum ไม่เปลี่ยน (D6)
//   (4) Redis เป็น two-key design ชัดเจน: status pointer + tokenized payload (D4)
//   (5) Job payload เพิ่ม attachmentPublicId/reOcrToken/forceRefresh (D15)
//   (6) เพิ่ม in-flight guard (pointer + jobId verify) + post-confirm key deletion (D9/D4)
//   (7) Endpoint contract: rag.admin.write/rag.manage + AiEnabledGuard + @Audit +
//       Idempotency-Key + @Throttle ตาม reingest precedent (D11)
//   (8) File guard: PDF-only (422) + file existence (410) ก่อน enqueue (D12)
//   (9) VRAM gate เฉพาะ engineType='np-dms-ocr' — 'auto' ข้าม (D7/D15)
//   (10) confirm ตั้ง ai_processing_status='DONE' (D6)
//   (11) Module: service อยู่ file-storage + ModuleRef lazy lookup (D13)
//   (12) Response: queuePosition + estimatedWaitSeconds worst-case, ไม่มี ocrOptions (D14)
//   (13) เก็บ checkAiUnavailableLocks (503 ตอน batch OCR/model transition) (D11)
//   (14) DONE terminal-state guard ใน ingestion write path (D9)
//   (15) attempts:3 + เขียน failed เฉพาะ attempt สุดท้าย (D10)
//   (16) status/result contract + identical flag + side-by-side diff (D14)
// - 2026-09-19: Grill session รอบ UX/UI — เพิ่ม D16: RAG console entry เดียว +
//   full-screen dialog, resume-by-click + triggeredBy visibility, empty→failed +
//   shrink warning + retry buttons, fire-and-observe post-confirm, AlertDialog
//   no-rollback + empty-old placeholder, PDF reference pane + search-in-pane
// - 2026-09-19: Implementation (spec 257) — deviations recorded: (a) controller+service อยู่ใน
//   `common/file-storage/` แต่ register ใน AiModule (AiEnabledGuard ต้องใช้ AiSettingsService) จึงไม่ใช้ ModuleRef (D13);
//   (b) route = `/files/:publicId/re-ocr[/status|/confirm]` บน prefix `files` เดิม; (c) BullMQ jobId ใช้ `-`
//   (`re-ocr-{id}-{token}`) เพราะ BullMQ 5.x ห้าม `:`; (d) status `completed` เพิ่ม `currentText` (ซ้ายของ diff)
//   และ `warning`/`identical` คำนวณที่ service ตอนอ่าน (processor ไม่มี DB); (e) confirm คืน `reindexQueued`
//   (reingest ล้มเหลวหลัง commit ไม่ rollback text — health check ซ่อม); (f) เพิ่ม `GoneException` (410) ใน exception hierarchy
// - 2026-09-19: Code-review hardening (110-speckit-reviewer): (a) trigger mutex `attachment:re-ocr:lock:{id}`
//   (SET NX 15s) serialize check→write→enqueue กัน TOCTOU concurrent trigger; (b) confirm reject 409
//   `RE_OCR_SUPERSEDED` เมื่อ pointer เป็นของ token ใหม่กว่า และ `RE_OCR_IDENTICAL` เมื่อผลเท่าเดิม;
//   (c) เพิ่ม `GET /files/:publicId/re-ocr/preview` (rag.manage) — preview เดิมต้อง document.view;
//   (d) ตัด documentPublicId ออกจาก job payload (ส่ง attachment id ผิด semantic field)
// - 2026-09-19: Scope extension — Production File Replace (grill รอบที่ 3, D17–D22): เจตนาจริงของ
//   feature คือแก้เคส "correspondence ผูกไฟล์ PDF ผิด" บน production (พบจริง: queue item 715
//   `คคง.-สคฉ.3-03-21-0004-2567` ถูก import ด้วยไฟล์ของ `ผรม.2-1-0007-2567` — attachment 977 ถูก share
//   โดย 2 junction links เป็น main document ของทั้งคู่) — เพิ่ม replace-file mode เข้า flow เดิม:
//   junction swap แทน in-place (D17), candidate = uniform temp attachment + staging copy เข้า
//   tempDir (D18), route แยก + permission คู่ (D19), confirm tx = swap+commit+reindex+orphan
//   de-index (D20), ไม่ re-extract metadata (D21), UI = 2 entry points + link picker + PDF toggle (D22)

# ADR-055: Attachment Manual Re-OCR — Human-in-the-loop Compare-before-Replace

**Status**: Accepted
**Date**: 2026-09-14 (revised 2026-09-19)
**Related Documents**:
- [ADR-054: Migration Review Queue Metadata Separation](./ADR-054-migration-review-queue-metadata-separation.md) (ที่มาของ scope นี้ — D6 เดิมถูกตัดออกเพราะไม่มี use case ใน migration/production ingestion ปกติ แนะนำให้แยก ADR เพราะเป็น net-new capability)
- [ADR-042: Sandbox Project + OCR Text Persistence](./ADR-042-sandbox-project-and-ocr-text-persistence.md) (OCR text persistence policy, `attachments.ocr_text`)
- [ADR-022: Retrieval Augmented Generation](./archive/ADR-022-retrieval-augmented-generation.md) (archived — `attachments.rag_status` lifecycle)
- [ADR-023A: Unified AI Architecture](./ADR-023A-unified-ai-architecture.md) (Qdrant `projectPublicId` filter — ใช้ตอน re-embed)
- [ADR-056: AI Queue Observability & Retry Resilience](./ADR-056-ai-queue-observability-retry-resilience.md) (Vector Health Check Cron — self-healing path)
- [ADR-016: Security & Authentication Strategy](./ADR-016-security-authentication.md) (RBAC/CASL, Idempotency-Key)
- `backend/src/common/file-storage/` (Attachment module — ที่ตั้งของ feature นี้)
- `backend/src/modules/ai/processors/np-dms-ocr-processor.ts` (OCR processor — reuse + bugfix)
- `backend/src/modules/ai/services/rag-admin.service.ts` (`reingest()` — canonical re-embed pattern)
- `backend/src/common/file-storage/entities/attachment.entity.ts` (`ocr_text`, `ai_processing_status`, `rag_status` columns)

---

## Context and Problem Statement

ระหว่าง grill ADR-054 (migration data-loss fix) มีการเสนอให้เพิ่ม `attachments.ocr_text_bak` เพื่อป้องกันการเขียนทับ `attachments.ocr_text` ในกรณี production ingestion re-OCR — แต่ตรวจโค้ดแล้วพบว่า **ไม่มี capability "re-OCR เอกสารที่มีอยู่แล้ว" ในระบบเลย** (`processRagPrepare` เป็น write-once + reuse เท่านั้น ไม่มี overwrite path) จึงตัด D6 ออกจาก ADR-054 และแยกมาเป็น ADR นี้แทน เพราะเป็นการเพิ่ม capability ใหม่ทั้งหมด (net-new) ไม่ใช่ safety fix ของสิ่งที่มีอยู่แล้ว

**ความต้องการจริง**: บางครั้ง `attachments.ocr_text` ที่มีอยู่ในระบบมีคุณภาพไม่ดี (OCR engine เดิมตอน ingest อ่านผิด/อ่านไม่ครบ) และต้องการให้ admin สั่ง re-OCR ใหม่ด้วย engine ที่ดีกว่า/ใหม่กว่า แล้วเปรียบเทียบกับของเดิมก่อนตัดสินใจแทนที่

**ขยาย 2026-09-19 — Production File Replace**: เจตนาที่แท้จริงของ feature นี้คือ remediation บน production — กรณีที่ **correspondence ถูกผูกกับไฟล์ PDF ผิดตั้งแต่ import** (ไม่ใช่แค่ OCR เพี้ยน) เคสจริงที่พบ: queue item 715 (`คคง.-สคฉ.3-03-21-0004-2567`, IMPORTED) ผูกกับ `O672-0221-คคง.-ผรม.2-1-0007-2567.pdf` ซึ่งเป็นไฟล์ของ queue item 725 — attachment 977 ถูก share เป็น `is_main_document` ของ correspondence **ทั้งสอง** `replaceQueueItemFile()` เดิม reject IMPORTED (state guard) จึงไม่มีทางแก้ผ่าน tooling — flow เดียวกับ re-OCR (trigger → OCR candidate → compare → confirm) ต้องรองรับ "เปลี่ยนไฟล์" ด้วย โดยยังคง guarantee เดิมทุกข้อ (ไม่แตะ production จน confirm, human decision, audit)

---

## Decision Drivers

- **Human-in-the-loop** — `attachments.ocr_text` เป็น source of truth ของ production (RAG อ่านจากตรงนี้) การแทนที่ต้องมีคนตรวจสอบก่อนเสมอ ไม่ใช่ automatic overwrite
- **Minimal schema footprint** — ไม่เพิ่ม column ถาวรถ้าไม่จำเป็น (ADR-044) — ข้อมูลระหว่างรอตัดสินใจเป็นข้อมูลชั่วคราว
- **RAG consistency** — ถ้า `ocr_text` เปลี่ยน ข้อมูลใน Qdrant ต้อง sync ตาม ไม่ปล่อยให้ stale — ใช้ generation lifecycle (BUILDING → ACTIVE → RETIRED) ที่มีอยู่ ไม่ลบ vector เอง
- **Reuse ของที่มีอยู่แล้ว** — OCR engine, BullMQ queue, `reingest` pattern, endpoint contract ที่มีอยู่แล้ว ไม่สร้างใหม่ซ้ำซ้อน
- **จำกัดความเสี่ยง** — จำกัด RBAC และ scope ให้แคบที่สุดเท่าที่ยังใช้งานได้จริง (ลด blast radius ของ feature ใหม่)
- **Referential integrity ของ shared attachment** *(เพิ่ม 2026-09-19)* — attachment row เดียวถูก link โดยหลาย correspondence revision ได้จริง (junction M:N) — การแก้ไฟล์ห้ามลอยไปแตะ consumer อื่น; unit of change ต้องเป็น junction link ไม่ใช่ attachment
- **NAS เป็น source of truth** *(เพิ่ม 2026-09-19)* — ไฟล์ staging/Legacy NAS ห้ามถูก move/delete โดย flow นี้; temp-cleanup worker (`fs.remove(att.filePath)`) จะลบไฟล์ตาม path ของ temp attachment ทุกตัว → candidate จาก staging ต้องเป็น copy ใน tempDir เท่านั้น

---

## Decisions

### D1: Manual trigger เท่านั้น — จำกัดสิทธิ์ผ่าน CASL permission

**Decision**: ไม่มี automatic/scheduled re-OCR job ใดๆ — ต้องเป็น admin ที่มี permission `rag.admin.write` เท่านั้นที่กด trigger เองผ่าน UI ทีละ attachment (mapping ของ role → permission ดู D11)

**Rationale**: Re-OCR กระทบ source of truth ของ production data โดยตรง — ไม่มี clear trigger condition ที่ปลอดภัยสำหรับ automatic job (ต่างจาก migration ที่มี signal ชัดเจนคือ "metadata format เก่า") automatic job จะสิ้นเปลือง GPU resource บน `np-dms-lcbp3` โดยไม่มีเหตุผลชัดเจนว่าเมื่อไหร่ควรรัน จำกัด permission แคบที่สุดเพราะกระทบข้อมูลที่ใช้งานจริงในระบบ

**Alternatives rejected**:
- Scheduled batch job re-OCR เอกสารทั้งหมดเป็นระยะ — สิ้นเปลือง resource โดยไม่มี signal ว่าเอกสารไหนต้องการจริง
- เปิดให้ permission ระดับ read (`rag.manage`) trigger ได้ — เพิ่มความเสี่ยงโดยไม่จำเป็น เพราะกระทบ production data โดยตรง

### D2: Reuse เฉพาะ OCR extraction logic — ไม่ reuse `migration_review_queue`

**Decision**: ใช้ `SandboxOcrEngineService.detectAndExtract()` (engine เดียวกับที่ migration/sandbox ใช้) สำหรับรัน OCR ใหม่ แต่ flow/state ทั้งหมดเป็นของ Attachment module เอง (`backend/src/common/file-storage/`) ไม่เกี่ยวกับ `migration_review_queue` table หรือ migration review flow เลย

**Rationale**: `migration_review_queue` มี lifecycle เฉพาะของ migration (batch import ครั้งเดียว, มี `review_state_json`, ผูกกับ `documentNumber`) ไม่เหมาะกับ attachment เดี่ยวๆ ใน production ที่อาจถูก re-OCR ซ้ำได้หลายครั้งตลอดอายุของเอกสาร การ reuse เฉพาะ engine logic (ซึ่งเป็น stateless function) ปลอดภัยกว่าการดึง table/flow ทั้งกระบวนการมาผูกกัน

**Alternatives rejected**:
- Reuse ทั้ง review-queue pattern (ส่งผล re-OCR เข้า `migration_review_queue`) — ผูก production attachment lifecycle เข้ากับ migration table ที่ออกแบบมาเพื่อ one-time batch import ทำให้ schema สับสน (attachment ที่ไม่เกี่ยวกับ migration เลยจะมีแถวใน migration table)
- เขียน OCR extraction logic ใหม่ทั้งหมด — ซ้ำซ้อนกับของที่มีอยู่แล้ว เพิ่มความเสี่ยง inconsistency ระหว่าง engine ที่ migration ใช้กับที่ production ใช้

### D3: Two-step flow — trigger (cache ผลลัพธ์พร้อม reOcrToken) → confirm (apply จริง)

**Decision**: แบ่งเป็น 3 endpoint:
1. `POST /attachments/:publicId/re-ocr` — enqueue OCR job เข้า **`QUEUE_NP_DMS_OCR`** (async ผ่าน BullMQ) Response: `{ reOcrToken, jobId, status: 'queued', queuePosition, estimatedWaitSeconds }` — **ไม่แตะ `attachments.ocr_text` เลยในขั้นตอนนี้**
2. `GET /attachments/:publicId/re-ocr/status` — polling status pointer (contract ดู D14)
3. `POST /attachments/:publicId/re-ocr/confirm` — admin เห็น diff แล้วกดยืนยัน โดยส่ง `{ reOcrToken }` มาด้วย → อ่าน payload key ตาม token มา `UPDATE attachments` จริง แล้ว trigger re-embed (ดู D6)

> **Queue — corrected 2026-09-19**: `QUEUE_NP_DMS_OCR` ปัจจุบัน**ไม่มี producer เลย** — เป็น dead queue เหลือจากดีไซน์ยุค ADR-032 (sandbox/migration OCR jobs ทั้งหมดไปลง `ai-batch` ผ่าน `enqueueSandboxJob`) ADR นี้จึงเป็นการ **"ชุบชีวิต" queue** ให้เป็น dedicated sequential OCR queue: `concurrency=1` serialize GPU access + VRAM gate ในตัว แยก GPU-bound re-OCR work ออกจาก `ai-batch` ที่งานหนักอยู่แล้ว — **ไม่ใช้ `priority`** เพราะ (ก) ใน BullMQ priority 0 คือสูงสุด `priority: 1` จะ deprioritize ไม่ใช่ข้ามหน้า และ (ข) ใน queue นี้มีแต่ re-OCR jobs อยู่แล้ว ไม่มีอะไรให้ข้าม Worst case wait = active job ปัจจุบัน × lockDuration (180s) + waiting jobs ข้างหน้า

**Rationale**: Human-in-the-loop คือหัวใจของ ADR นี้ — การส่ง `reOcrToken` ป้องกัน race condition กรณีที่ admin เปิดหลายหน้าต่าง หรือมี trigger ซ้อน ซึ่งอาจทำให้ยืนยันผลลัพธ์ผิด job

**Alternatives rejected**:
- Auto-replace ทันทีถ้า confidence ใหม่สูงกว่าเดิม — confidence ไม่ใช่ตัวชี้วัดที่เชื่อถือได้เพียงพอสำหรับการแทนที่ source of truth โดยไม่มีคนตรวจ
- Single endpoint ที่ replace ทันทีพร้อม `ocr_text_bak` เผื่อ rollback — ยังเป็น automatic overwrite ที่ไม่มีคนตรวจก่อน ต่างจากเจตนาหลักของ ADR นี้
- Webhook/SSE แจ้งผลเมื่อเสร็จ — เพิ่ม complexity เกินควร admin ใช้ polling GET เดียวกันกับ pattern ที่มีอยู่แล้วใน sandbox OCR flow
- Enqueue เข้า `ai-batch` แทน — ผสม GPU-bound work เข้า batch pipeline ทั่วไป ไม่ได้ concurrency=1 + VRAM gate isolation มาฟรี
- `priority: 1` เพื่อข้ามหน้าคิว — สมมติฐานผิด 2 ชั้น: queue เดิมไม่มี migration jobs และ BullMQ priority ต่ำกว่า = สำคัญกว่า

### D4: Redis two-key — status pointer + tokenized payload (TTL 72h เดียว) — ไม่เพิ่ม column ใหม่

**Decision**: เก็บข้อมูลระหว่างรอ confirm ใน Redis 2 key คนละหน้าที่:

```
attachment:re-ocr:{publicId}                    ← status pointer (job ล่าสุดเสมอ)
  { status: 'queued'|'processing'|'completed'|'failed',
    reOcrToken, jobId, engineType,
    triggeredByDisplayName, triggeredAt,
    errorMessage?, attempt?, warning?, updatedAt }
  TTL 72h — trigger เขียน 'queued', processor อัปเดตทุก transition

attachment:re-ocr:{publicId}:{reOcrToken}       ← payload (เขียนเฉพาะตอนสำเร็จ)
  { newText, engineUsed, charCount, processingTimeMs, completedAt }
  TTL 72h — confirm อ่าน key นี้ตาม token ที่ส่งมา
```

- **หมด TTL โดยยังไม่ confirm = reject โดยปริยาย** — ไม่มี endpoint "reject" แยกต่างหาก
- **Post-confirm cleanup**: confirm สำเร็จ → `DEL` ทั้ง pointer และ payload key ทันที → confirm ซ้ำจะเจอ 404/410 เหมือน expired token — idempotent โดยธรรมชาติ

**Rationale**: Tokenized payload key ป้องกันการ overwritten กรณี trigger ซ้อน (แต่ละ trigger มี payload ของตัวเอง) ส่วน pointer เป็น key เบา ๆ สำหรับ polling ที่ไม่ต้องโหลด OCR text ยักษ์ทุก request — pointer เก็บ `jobId` ไว้ใช้กับ in-flight guard (D9) Trigger ใหม่ overwrite pointer ได้ตลอดจึงไม่จำเป็นต้องมี TTL แยกสำหรับ failed state

**Alternatives rejected**:
- Single static key (`attachment:re-ocr:{publicId}` เก็บทุกอย่างรวม text) — payload หนักถูกส่งซ้ำทุก poll และเสี่ยง race ตอน trigger ซ้อน
- TTL 24 ชม. — สั้นเกินไปสำหรับ work cycle จริง: trigger วันศุกร์เย็น → กลับมา confirm เช้าวันจันทร์
- TTL 1h สำหรับ failed (ดีไซน์เดิม) — ไม่จำเป็นแล้วเมื่อเป็น two-key: trigger ใหม่ overwrite pointer ได้ตลอด
- Column ใหม่ `ocr_text_pending` ใน `attachments` — persistent เกินความจำเป็นสำหรับข้อมูลชั่วคราว

### D5: Scope — single attachment เท่านั้น (ไม่รองรับ batch)

**Decision**: Endpoint รองรับ re-OCR ทีละ 1 attachment (`:publicId` เดียว) ไม่มี bulk/batch endpoint ในรอบนี้

**Rationale**: Human-in-the-loop ต้องดู diff ทีละไฟล์อยู่ดี แม้จะ trigger พร้อมกันหลายไฟล์ได้ ก็ไม่ได้ลดภาระ decision ของ admin ลง การจำกัด scope แคบช่วยลด complexity การ implement รอบแรก ขยายเป็น batch ได้ในอนาคตโดยไม่กระทบของเดิม (ไม่ hard-to-reverse)

**Alternatives rejected**:
- Batch endpoint ตั้งแต่แรก — เพิ่ม complexity (ต้องคิดเรื่อง partial success, progress tracking) โดยยังไม่มีความต้องการชัดเจน

### D6: หลัง confirm — transaction อัปเดต DB → commit → re-embed ผ่าน generation lifecycle (reingest pattern)

**Decision** — แก้จากเดิมที่จะลบ Qdrant vector เอง:

1. **DB transaction เดียว** (commit ก่อน enqueue เสมอ):
   ```sql
   UPDATE attachments
   SET ocr_text = :newText,
       rag_status = 'PENDING',
       rag_last_error = NULL,
       ai_processing_status = 'DONE'
   WHERE public_id = :publicId
   ```
   - `ai_processing_status='DONE'` เพราะ OCR text ใหม่ผ่าน human validation แล้ว — attachment หลุดจาก "AI pipeline failures" section ของ `listFailedIngestions` อัตโนมัติ (รวมเคส `PENDING` ค้างด้วย)
   - ถ้า attachment ถูกลบไปแล้ว (affected rows = 0) → 404
2. **หลัง commit** — เรียก `ragAdminService.reingest(attachmentPublicId)` ซึ่งทำ canonical flow ที่มีอยู่แล้ว:
   - checksum guard (compute SHA-256 ให้ถ้า attachment ไม่มี checksum — เช่นจาก migration)
   - BUILDING conflict check → 409 ถ้ามี generation `BUILDING` ค้างอยู่
   - `ingestionService.ingest(publicId, force=true)` → สร้าง BUILDING generation ใหม่
   - `enqueueRagAttachmentIngestion({ attachmentPublicId, attachmentChecksum, force: true })`
   - ถ้า enqueue fail → mark generation `FAILED` กัน dangling BUILDING
3. `RagAttachmentIngestProcessor` อ่าน `attachments.ocr_text` ใหม่ → normalize → chunk → embed → `activate()` swap generation (ของเก่า → RETIRED) → `JOB_RAG_GENERATION_CLEANUP` ลบ vector เก่าตาม `generation_uuid`
4. สำเร็จ → `rag_status='INDEXED'`; fail → `'FAILED'` → Vector Health Check Cron (ADR-056 D4) ตรวจเจอและซ่อม

> **Critical corrections (2026-09-19)**:
> - **`force=true` บังคับ** — re-OCR ไม่เปลี่ยน file checksum → ถ้าไม่ force, `ingest()` จะ reuse ACTIVE generation เดิม (idempotent path, line 98-104) → ไม่มี BUILDING → processor `skip` เงียบ ๆ → **RAG ค้างเป็น vector ของ text เก่าโดยไม่มีใครรู้**
> - **ไม่มี manual Qdrant deletion** — generation lifecycle + cleanup job จัดการ vector เก่าเอง การยิง `QUEUE_AI_VECTOR_DELETION` ด้วย `documentPublicId` จะลบ vector ทั้งหมดของ attachment รวม points ใหม่ถ้า race กับ upsert — ตัดออกทั้งหมด
> - **Enqueue อยู่นอก DB transaction** — BullMQ/Qdrant อยู่ใน MariaDB transaction ไม่ได้; enqueue ก่อน commit เสี่ยง job อ่าน state ที่ยังไม่ commit

**Rationale**: `attachments.ocr_text` คือ source ของ RAG chunking/embedding การตั้ง `rag_status='PENDING'` ทันทีขณะอัปเดต DB ทำให้สถานะ vector สอดคล้องกับ pipeline จริง และทำให้ระบบ self-healing (ADR-056) ซ่อมได้หากเกิด fault ระหว่างทาง — ส่วน generation lifecycle เป็นของที่ออกแบบมาเพื่อ re-embed อยู่แล้ว ไม่ควร hand-roll การลบ vector เอง

**Alternatives rejected**:
- Manual `QUEUE_AI_VECTOR_DELETION` ก่อน re-embed (ดีไซน์เดิม) — race กับ upsert ของ generation ใหม่ + ซ้ำซ้อนกับ cleanup ที่มีอยู่
- ไม่อัปเดต `rag_status` เป็น `'PENDING'` ใน transaction — เสี่ยง silent discrepancy หาก re-embed มีปัญหาหลังอัปเดต DB สำเร็จ
- ไม่ re-embed อัตโนมัติ ให้ admin สั่งแยกเอง — เพิ่มขั้นตอนที่ admin อาจลืมทำ ทำให้ RAG กับ `ocr_text` ไม่ sync กันโดยไม่มีใครรู้
- Enqueue ภายใน transaction เดียวกับ UPDATE — ทำไม่ได้ทางเทคนิค (BullMQ อยู่นอก MariaDB transaction) และเสี่ยง job อ่านข้อมูลก่อน commit

### D7: ให้ admin เลือก OCR engine เอง — default = `'np-dms-ocr'` (ไม่มี Silent Automatic Fallback)

**Decision**: `POST /re-ocr` รับ parameter `engineType: SandboxOcrEngineType` (`'auto' | 'np-dms-ocr'` — ตามที่มีอยู่จริงใน `sandbox-ocr-engine.service.ts:25`) ให้ admin เลือกจาก dropdown ใน UI โดย **default = `'np-dms-ocr'`** (ไม่ใช่ `'auto'`)

UI แสดงคำอธิบายให้ admin เลือกได้อย่างมี context:
- **`np-dms-ocr` (แนะนำ / default)** — Vision model OCR สำหรับเอกสารที่ text layer ไม่ชัด หรือ scan ที่อ่านยาก ใช้ GPU, ช้ากว่า แต่แม่นยำกว่าสำหรับงาน re-OCR
- **`auto`** — ระบบเลือกให้อัตโนมัติ (PyMuPDF CPU → np-dms-ocr fallback) เหมาะสำหรับไฟล์ที่ text layer ชัดเจนอยู่แล้ว

**No Silent Automatic Fallback**: หากเลือก `np-dms-ocr` แล้วล้มเหลว (เช่น GPU VRAM ไม่พอ) ระบบจะ **ไม่ถอยไปใช้ `auto` เองโดยอัตโนมัติ** แต่จะบันทึกสถานะล้มเหลวพร้อมสาเหตุลง Redis pointer (D4) และเสนอทางเลือกให้ Admin ตัดสินใจบน UI เองว่าต้องการลองใหม่ด้วย Vision Model หรือสลับไปใช้ `auto`

**Conditional VRAM gate** (เพิ่ม 2026-09-19): processor เช็ค `vramMonitorService.hasVramCapacity()` **เฉพาะ `engineType='np-dms-ocr'`** — `'auto'` ข้าม pre-check เพราะ PyMuPDF path ไม่ใช้ GPU เลย (กัน false failure ตอน VRAM เต็มแต่ไฟล์ประมวลผลด้วย CPU ได้) ถ้า `'auto'` สุดท้าย fallback ไปหา vision model จริง ระดับ contention เท่ากับพฤติกรรมเดิมใน `ai-batch`

**Rationale**: เหตุผลหลักที่ admin trigger re-OCR คือ **ผลลัพธ์เดิมไม่ดี** — หากทำ Silent Fallback สลับไปใช้ `auto` เองโดยอัตโนมัติ จะได้ผลลัพธ์อ่านผิดเดิมๆ กลับมา ย้อนแย้งกับวัตถุประสงค์ของ feature และหลักการ Human-in-the-loop

**Alternatives rejected**:
- Default = `'auto'` — มีโอกาสได้ผลเหมือนเดิม ลดประโยชน์ของ feature นี้โดยไม่จำเป็น
- Silent Fallback ถอยไปใช้ `auto` อัตโนมัติเมื่อ Vision Model ล้มเหลว — ส่งผลลัพธ์เดิมกลับมาให้ Admin โดยไม่ผ่านการยินยอม
- Fix `'np-dms-ocr'` เสมอ ไม่ให้เลือก — ขาด flexibility สำหรับ use case ที่ `'auto'` เหมาะกว่า
- VRAM check ทุก engine — `'auto'` ที่ใช้แค่ PyMuPDF จะ fail โดยไม่จำเป็นตอน GPU ไม่ว่าง

### D8: ไม่มี rollback-after-confirm — confirm คือ final decision

**Decision**: หลัง admin กด confirm และ `attachments.ocr_text` ถูกแทนที่แล้ว **ไม่มี mechanism กู้คืนค่าก่อนหน้า** (ไม่มี `ocr_text_bak` column) ถ้าต้องการค่าเดิมคืนต้อง re-OCR ใหม่อีกรอบ (ผลลัพธ์อาจไม่เหมือนเดิม 100% ถ้า engine/ไฟล์เปลี่ยนไป)

**Rationale**: Confirm เป็น explicit human decision ที่เห็น diff ก่อนตัดสินใจแล้ว (D3) ต่างจากกรณี data-loss ที่ ADR-054 แก้ (automatic overwrite ไม่มีคนตรวจ) — ถ้า admin ตัดสินใจผิดพลาดหลังเห็น diff เอง เป็นความรับผิดชอบของการตัดสินใจนั้น ไม่ใช่ bug ที่ระบบต้องป้องกัน การไม่มี column เพิ่มเติมทำให้ schema เรียบง่ายกว่า ตรงกับหลักการ "ไม่เพิ่ม schema เกินจำเป็น" (ADR-044)

**Alternatives rejected**:
- เพิ่ม `ocr_text_bak` เก็บค่าก่อน confirm 1 เวอร์ชัน — เพิ่ม storage cost ถาวรโดยไม่จำเป็น เพราะมี human decision point ป้องกันความผิดพลาดไว้แล้วที่ D3 (ยืนยันกับ user 2026-09-14)

### D9: Trigger guards — block `PROCESSING` + in-flight guard บน pointer + DONE terminal-state guard

**Decision**: `POST /re-ocr` ตรวจ 3 ชั้น:

1. **`attachments.ai_processing_status`**:
   - **`PROCESSING`** → **reject 409 Conflict** — มี ingestion job เดิมกำลังรันอยู่ ห้าม trigger ซ้อน
   - **`PENDING`** → **อนุญาต** — job เดิมอาจค้างใน queue (edge case จริง) admin มีสิทธิ์ข้ามผ่าน (และ DONE-guard ข้างล่างกัน collision ไว้แล้ว)
   - **`DONE`** → **อนุญาต** — กรณีปกติ re-OCR เพื่อปรับปรุงคุณภาพ
   - **`FAILED`** → **อนุญาต** — กรณีปกติ retry ด้วย engine อื่น
2. **In-flight guard** (เพิ่ม 2026-09-19): อ่าน status pointer `attachment:re-ocr:{publicId}` — ถ้า `status` เป็น `queued`/`processing` **และ** BullMQ job ที่ pointer อ้างถึง (`jobId`) ยังอยู่ใน state waiting/active จริง → **reject 409** กัน trigger ซ้อนเสีย GPU + pointer overwrite — ถ้า job หายไปแล้ว (worker ตาย, stalled จน removed) → ถือว่า pointer stale → อนุญาต
3. **DONE terminal-state guard ใน ingestion pipeline** (เพิ่ม 2026-09-19): แก้ write path ของ `ai-batch.processor.ts` — conditional `UPDATE ... WHERE ai_processing_status <> 'DONE'` → ถ้า affected rows = 0 → skip job ทั้งตัว + log warn

> **ทำไมต้องมีข้อ 3**: การอนุญาต `PENDING` (ข้อ 1) สร้าง **guaranteed collision** ไม่ใช่แค่ edge case — job ที่อยู่ในคิวจะรันแน่ ๆ เมื่อถึงตา ถ้า admin confirm ไปแล้ว (`DONE`) แล้ว job ตื่นมาเขียน `ocr_text` ทับ จะทิ้ง human decision เงียบ ๆ — conditional write ทำให้ `DONE` เป็น terminal state ที่ไม่มีใครเขียนทับ และซ่อม idempotency hole เดิมของ pipeline (job รันซ้ำทับผลเดิมอยู่แล้ววันนี้) — `<> 'DONE'` ยังอนุญาต retry จาก `FAILED`/`PENDING` ตามปกติ

**Rationale**: `PROCESSING` คือสถานะเดียวที่มี active ingestion job กำลังประมวลผลอยู่จริง ส่วน in-flight guard ป้องกัน re-OCR ซ้อนกันเอง (ซึ่ง `ai_processing_status` ไม่ได้สะท้อนเพราะ re-OCR ไม่แตะ column นี้)

**Alternatives rejected**:
- Block ทั้ง `PENDING` และ `PROCESSING` — เข้มงวดเกินไป กรณี PENDING ค้าง admin จะไม่มีทางออกเลย (และ DONE-guard ทำให้ปลอดภัยอยู่แล้ว)
- ไม่ block เลย — เสี่ยง race condition เมื่อ PROCESSING job กำลังรัน
- Re-OCR job ไปเขียน `ai_processing_status='PROCESSING'` แทน in-flight guard — ปน semantics ของ ingestion pipeline กับ manual operation และต้อง restore ค่าเดิมตอนจบ ซับซ้อนกว่า
- `job.remove()` job เดิมตอน trigger — ต้อง resolve attachment→document→revision หลาย hop และไม่ครบทุก jobType ที่เขียน `ocr_text` — fragile

### D10: Processor failure semantics — เขียน failed ทุก throw path + เฉพาะ attempt สุดท้าย

> **Existing Bug (ขยาย scope 2026-09-19)**: `np-dms-ocr-processor.ts` มี **2 จุด throw เงียบ** ไม่ใช่จุดเดียว — (ก) VRAM gate (line 102-114) `throw` โดยไม่เขียน Redis และ (ข) catch block (line 148-159) เขียน audit log แล้ว `throw` โดยไม่เขียน Redis — ต่างจาก `ai-batch.processor.ts` ที่เขียน `status:'failed'` ก่อน throw ถูกต้อง (line 929–939)

**Decision**: แก้ `NpDmsOcrProcessor` ให้เขียน failed status กลับ Redis ก่อน throw **ทุก failure path** (VRAM gate + catch):

1. `ai:np-dms-ocr:{idempotencyKey}` → `{ status:'failed', errorMessage, failedAt }` — bugfix existing behavior สำหรับ polling ทั่วไป
2. ถ้าเป็น re-OCR job (`reOcrToken` present) → เขียน pointer `attachment:re-ocr:{publicId}` → `{ status:'failed', reOcrToken, errorMessage, failedAt }` ด้วย
3. **เขียน `failed` เฉพาะ attempt สุดท้าย** — `job.attemptsMade + 1 >= job.opts.attempts` (default `attempts: 3`, exponential backoff 5s) — ระหว่าง retry ที่เหลือ pointer = `{ status:'processing', attempt }` กัน status กะพริบ failed→processing→failed ที่ทำให้ admin เข้าใจผิด — หมด attempts จริง ๆ ถึงแสดง `failed` + errorMessage ให้ admin ตัดสินใจตาม D7

**Rationale**: ถ้า processor `throw` โดยไม่เขียน Redis — frontend polling จะได้ `status: 'queued'`/`'processing'` ค้างไปตลอดจนกว่า TTL 72h หมด admin ไม่รู้ว่า job fail หรือแค่ช้า เป็น silent failure ที่ไม่ยอมรับได้สำหรับ admin tool — ส่วนการเขียนเฉพาะ final attempt เก็บ resilience ของ transient failure (sidecar timeout, network blip) โดยไม่ทำให้ status ขัดแย้งกับ retry ที่กำลังจะเกิด

**Alternatives rejected**:
- ปล่อยให้ frontend polling timeout เอง (ไม่เขียน failed status) — silent failure ทำให้ UX แย่มาก
- `attempts: 1` fail-fast — ทิ้ง resilience ของ transient blip ที่ retry แก้ได้ใน 5 วิ ทั้งที่ D7 ห้ามแค่ *engine fallback* (เรื่องคุณภาพผลลัพธ์) ไม่ได้ห้าม retry กลไก
- แยก fix เป็น PR แยก — ต้องแตะไฟล์เดียวกันอยู่แล้ว เพิ่มความซับซ้อนโดยไม่จำเป็น

### D11: Endpoint contract — CASL permission + guards ตาม `reingest` precedent

**Decision**: ยึด contract เดียวกับ `POST /ai/admin/rag/attachments/:id/reingest` (rag-admin.controller.ts:101-121) ซึ่งเป็น operation ที่ใกล้เคียงที่สุด (admin เขียนทับข้อมูล RAG):

| Endpoint | Permission | Guards/decorators |
|---|---|---|
| `POST /attachments/:publicId/re-ocr` | `rag.admin.write` | `JwtAuthGuard, RbacGuard, AiEnabledGuard`, `@Audit('attachment.re_ocr.trigger','attachment')`, `Idempotency-Key` **required** (400 ถ้าไม่ส่ง), `@Throttle` (~10/min เทียบ sandbox) |
| `GET /attachments/:publicId/re-ocr/status` | `rag.manage` | `JwtAuthGuard, RbacGuard` — read-only ตาม split read/write ของระบบ |
| `POST /attachments/:publicId/re-ocr/confirm` | `rag.admin.write` | `JwtAuthGuard, RbacGuard, AiEnabledGuard`, `@Audit('attachment.re_ocr.confirm','attachment')`, `Idempotency-Key` **required**, `@Throttle` |

**`checkAiUnavailableLocks` คงไว้** (เพิ่ม 2026-09-19): `enqueueAttachmentReOcr()` ใน `AiQueueService` ต้องเรียก `checkAiUnavailableLocks()` เหมือน `enqueue*` method อื่นทุกตัว — trigger ตอน OCR batch phase (`ai:ocr-batch:active`) หรือ model transition (`ai:model:transitioning`) จะได้ `ServiceUnavailableException` 503 พร้อม `userMessage`/`recoveryAction` ภาษาไทย — frontend interceptor จับ `code:'AI_FEATURES_UNAVAILABLE'` แสดง dialog รอ/ยกเลิกอยู่แล้ว

**Rationale**: `rag.admin.write` คือ admin-write tier เดียวกับ `reingest`/`metrics reset` (ผู้ถือ permission นี้คือกลุ่ม superadmin/admin ที่ D1 หมายถึง) — ไม่ต้องสร้าง permission ใหม่ `Idempotency-Key` บังคับตาม Security rule #1 และ precedent ของทุก admin POST endpoint `@Audit` บันทึก human validation (confirm = การแทนที่ source of truth ต้องมี audit record ชัดว่าใครยืนยัน) `AiEnabledGuard` ปิด feature เมื่อ AI ถูก disable ผ่าน Admin Console

**Alternatives rejected**:
- ใช้ `system.manage_all` (sandbox tier) — เข้มกว่าที่จำเป็น feature นี้เป็น production operation ไม่ใช่ testbed
- Role-name guard (`superadmin`/`admin` ตรง ๆ) — ระบบไม่มี pattern นี้ ใช้ CASL permission ทั้งหมด
- ไม่บังคับ `Idempotency-Key` — ขัด Security rule #1 และ precedent ของ codebase

### D12: File guard — PDF-only + file existence ก่อน enqueue

**Decision**: `POST /re-ocr` validate ไฟล์ก่อน enqueue:

1. `attachment.mimeType !== 'application/pdf'` → **reject 422** `ValidationException` — engine path (`detectAndExtract`) รองรับ PDF เท่านั้น (`'auto'` ใช้ PyMuPDF, `'np-dms-ocr'` ส่งเข้า sidecar `/ocr-upload`) — DOCX/DWG/ZIP จะ fail ที่ engine หรือแย่กว่าคือได้ binary garbage เป็น "text" กลับมา
2. `fs.existsSync(attachment.filePath)` fail → **reject 410** — ไฟล์ต้นฉบับหายจาก disk (storage cleanup, NAS unmount) รู้ทันทีดีกว่า enqueue แล้วค่อย fail

**Rationale**: Fail fast ที่ trigger — error เด้งทันทีที่ admin กด (ดีกว่า spinner แล้วค่อย failed), ไม่เสีย GPU/queue slot กับ job ที่รู้ล่วงหน้าว่าพังแน่ และทำให้ `ai_processing_status='PENDING'` ค้างของ non-PDF attachments ไม่เป็นปัญหา (mime guard ดักก่อนอยู่แล้ว)

**Alternatives rejected**:
- ปล่อยให้ fail ที่ engine แล้วแสดง errorMessage — UX แย่กว่าและเสีย queue slot โดยไม่จำเป็น
- รองรับ DOCX/XLSX text extraction — นอก scope, engine ไม่ได้ออกแบบมาให้ทำ

### D13: Module placement — Attachment module เป็นเจ้าของ + ModuleRef lazy lookup

**Decision**: `AttachmentReOcrService` + `AttachmentReOcrController` อยู่ใน `backend/src/common/file-storage/` ตาม D2 (ownership ของ Attachment module) — *(implemented: register ใน AiModule ไม่ใช่ FileStorageModule เพราะ `AiEnabledGuard` ต้องใช้ `AiSettingsService`; inject `AiQueueService`/`RagAdminService`/queue ตรง ๆ จึงไม่ต้อง ModuleRef)* — แผนเดิม: inject `AiQueueService` และ `RagAdminService` ผ่าน **`ModuleRef.get(..., {strict:false})` lazy lookup** (pattern เดียวกับ `file-storage.service.ts:486-499` ที่เลี่ยง circular dependency: AiModule import FileStorageModule อยู่แล้ว) และ register `{ name: QUEUE_NP_DMS_OCR }` ใน `BullModule.registerQueue` ของ FileStorageModule เพื่อ `@InjectQueue` ใช้ verify jobId ใน in-flight guard (D9)

**Rationale**: รักษา ownership ตาม D2 และไม่ต้อง forwardRef ทั้งสอง module — มี precedent ชัดเจนในไฟล์เดียวกันอยู่แล้ว

**Alternatives rejected**:
- ย้าย service/endpoints ไป AiModule — ง่ายกว่าเรื่อง DI แต่ขัด D2 และทำให้ URL หลุดจาก attachment context
- `forwardRef` ทั้งสอง module — ซับซ้อนกว่า ModuleRef pattern ที่มีอยู่แล้ว

### D14: Status/result contract — `newText` เฉพาะ completed + `identical` flag

**Decision**:

```
GET /attachments/:publicId/re-ocr/status
→ 404    (ไม่มี job / pointer หมด TTL)
→ { status:'queued'|'processing', reOcrToken, jobId, engineType, attempt? }
→ { status:'failed', reOcrToken, errorMessage }
→ { status:'completed', reOcrToken, newText, engineUsed, charCount,
    processingTimeMs, identical: boolean }
```

- `newText` ส่ง inline **เฉพาะตอน `completed`** — frontend หยุด poll เมื่อเจอ terminal state จึง fetch text หนัก (LONGTEXT อาจหลักแสนตัวอักษร) แค่ครั้งเดียว ไม่ต้องมี endpoint ที่ 4
- `identical` = server เทียบ `newText === attachments.ocr_text` ปัจจุบัน → ถ้าเหมือนเป๊ะ frontend แสดง notice "ผลลัพธ์เหมือนเดิม" และ **disable ปุ่ม confirm** — กัน re-embed churn เปล่า ๆ
- Trigger response (D3): `queuePosition` = `getWaitingCount()` หลัง `add()`; `estimatedWaitSeconds` = `(waitingAhead + active?1:0) × 180` (lockDuration worst-case) — label ชัดว่าเป็น worst-case estimate
- **ไม่เปิด `ocrOptions`** (temperature/topP/repeatPenalty) ใน v1 — engine ใช้ค่าจาก `ai_execution_profiles` ('ocr-extract') ที่ admin calibrate ผ่าน Admin Console อยู่แล้ว

**Frontend**: side-by-side diff panes (ซ้าย = `ocrText` ปัจจุบัน, ขวา = `newText`) + charCount เดิม/ใหม่ + scroll sync — OCR prose ยาวทำให้ word-level diff noisy ไม่มีประโยชน์; polling status ทุก 3 วิ; เฉพาะผู้มี `rag.admin.write` เห็นปุ่ม re-OCR

**Alternatives rejected**:
- `newText` ใน status ทุก response — เปลือง bandwidth ทุก poll สำหรับ text ที่อาจ 200KB+
- Endpoint `/result` แยก — เพิ่ม endpoint โดยไม่จำเป็นเมื่อ polling หยุดตอน completed อยู่แล้ว
- Unified/word-level diff — OCR เปลี่ยนกระจายทั่วเอกสาร diff แทบทั้งหมดเป็นสี อ่านยากกว่า side-by-side
- `ocrOptions` per-request — เพิ่ม surface area โดยไม่มี use case ชัด (เพิ่มทีหลังได้ไม่ breaking)
- Historical-duration estimate — เพิ่ม metrics plumbing เกินความจำเป็นสำหรับ admin tool ที่มี job ไม่กี่ตัว

### D15: Re-OCR job contract — payload, jobId, `forceRefresh` cache bypass

**Decision**: ขยาย `NpDmsOcrJobData` ด้วย optional discriminator fields:

```typescript
export interface NpDmsOcrJobData {
  pdfPath: string;
  engineType: SandboxOcrEngineType;
  idempotencyKey: string;            // re-OCR: ใช้ reOcrToken เป็นค่านี้
  documentPublicId?: string;         // re-OCR: ใส่ attachmentPublicId (audit log)
  ocrOptions?: OcrNpDmsOptions;
  // ── ADR-055: re-OCR contract (ถ้ามี reOcrToken = job ประเภท re-OCR) ──
  attachmentPublicId?: string;
  reOcrToken?: string;
  forceRefresh?: boolean;            // ข้าม OcrCacheService.get() — แก้ silent no-op
}
```

- **Processor contract**: ถ้า `reOcrToken` มีค่า → เขียน pointer `attachment:re-ocr:{attachmentPublicId}` ทุก transition (`processing`/`completed`/`failed`) + เขียน payload key ตอนสำเร็จ + **ข้าม `ocrCacheService.get()`** (แต่ยัง `set()` ปกติ — overwrite ผลเก่าให้ cache ตรงของใหม่เสมอ) — ถ้าไม่มี `reOcrToken` → behavior เดิม 100%
- **BullMQ `jobId`** = `re-ocr:{attachmentPublicId}:{reOcrToken}` — dedup อัตโนมัติถ้า trigger ส่ง token เดิมซ้ำ

> **ทำไมต้อง `forceRefresh`**: `NpDmsOcrProcessor` เช็ค `OcrCacheService` (TTL 24h, key = SHA-256(pdfPath+engineType)) ก่อนรันเสมอ และ `OcrService` (production ingest path) ก็เขียน cache ตัวเดียวกัน — re-OCR ภายใน 24 ชม. จะเจอ cache hit → คืน **text เดิมเป๊ะ** → silent no-op ที่ทำลายเหตุผลของ feature ทั้งหมด

**Alternatives rejected**:
- `ocrCacheService.invalidate()` ตอน trigger — ได้ผลเหมือนกัน แต่ flag ใน job data explicit กว่า (อ่านโค้ดรู้ทันทีว่า path นี้ตั้งใจข้าม cache)
- ไม่เขียน cache เลยสำหรับ re-OCR — ไม่จำเป็น ผลใหม่คือสิ่งที่ควร cache อยู่ดี

### D16: UI/UX flow — RAG console entry เดียว + resume-by-click + verification aids

**Decision** — 6 sub-decisions จาก grill รอบ UX/UI (2026-09-19):

1. **Entry point เดียว**: action "Re-OCR" ต่อ row ใน RAG console attachments list (`/admin/ai/rag-console` — ข้าง `RetryButton` ที่มีอยู่, เห็นเฉพาะผู้มี `rag.admin.write`) flow ทั้งหมดอยู่ใน **full-screen dialog** 3 phase (เลือก engine → รอ job → diff) — ไม่ใช่หน้าแยกและไม่ฝังใน file preview ของผู้ใช้ทั่วไป เพราะ RAG console คือจุดที่ admin ค้นพบปัญหาอยู่แล้ว (`aiProcessingStatus`/`ragStatus` + failed-ingestions section)
2. **Resume-by-click**: action เรียก `GET /re-ocr/status` ก่อนเสมอ — `404`→trigger form, `queued`/`processing`→phase รอของ job เดิม, `completed`→phase diff ของ payload เดิม, `failed`→phase error — admin คนใดก็ resume flow เดียวกันได้ (in-flight 409 เป็น server-side net เท่านั้น แทบไม่เด้งหน้า UI); pointer เก็บ `triggeredByDisplayName`+`triggeredAt` → dialog แสดง "เริ่มโดย {name} เมื่อ {time}"
3. **Result guards**: `newText` ว่างเปล่า → processor เขียน **`failed`** ("engine คืนผลลัพธ์ว่างเปล่า") ไม่ใช่ completed — confirm empty text ไม่มีทางเกิดขึ้นเพราะว่างแย่กว่าเดิมเสมอ; `newText` สั้นกว่าเดิม **<50%** → response มี `warning:'RESULT_MUCH_SHORTER'` → badge เหลืองเตือนแต่ยัง confirm ได้ (shrink อาจถูกต้อง); failed phase มี 2 ปุ่ม "ลองใหม่ด้วย np-dms-ocr" / "ลองด้วย auto" — ทั้งคู่คือ trigger ใหม่ token ใหม่ตามเจตนา D7 (no silent fallback)
4. **Post-confirm fire-and-observe**: confirm → ปิด dialog + toast + invalidate attachments list query → `RagStatusBadge`/`GenerationTimeline` เดิมแสดง re-index progress (`PENDING`→`INDEXED`/`FAILED`) — ไม่มี progress UI ใหม่ ไม่มี cancel job (pointer ค้างไม่ block อะไร TTL จัดการเอง); fail → โผล่ failed-ingestions + health check (ADR-056) ซ่อม
5. **Confirm friction**: AlertDialog ชั้นสุดท้าย "จะแทนที่ OCR text เดิมถาวร — ไม่สามารถย้อนกลับได้" + แสดง `charCount` เดิม→ใหม่ซ้ำ (destructive action ที่ไม่มี undo ตาม D8 สมควรมี explicit confirm แยกจากปุ่มหลัก); `ocr_text` เดิม NULL/ว่าง → ฝั่งซ้ายแสดง placeholder "ไม่มี OCR text เดิม (extraction ก่อนหน้าล้มเหลว/ยังไม่เคยรัน)" — informational ไม่ใช่ error เพราะนี่คือเคสที่ feature มีไว้แก้
6. **Verification aids**: diff view มี **PDF reference pane** (reuse `file-preview-modal` component) เป็น ground truth — diff เดิม↔ใหม่บอกแค่ "ต่างกัน" แต่ตัดสินว่าอันไหนถูกต้องเทียบต้นฉบับ; **search box ต่อ text pane** สำหรับ spot-check token เฉพาะ (เลขที่เอกสาร, ชื่อบริษัท); monospace/`<pre>` text + scroll sync ตาม D14

**Rationale**: ทุก sub-decision ยึดหลัก "admin ตัดสินใจได้ดีที่สุดเมื่อมี context ครบ" — entry อยู่ที่จุดค้นพบปัญหา, resume ไม่สร้าง job ซ้ำ, guard กัน confirm ที่ไม่มีเหตุผล (empty) แต่ไม่ block เคสที่อาจถูก (shrink), และ verification aids ให้ตัดสินกับ ground truth ไม่ใช่ลอย ๆ

**Alternatives rejected**:
- Dedicated route `/admin/ai/re-ocr/[id]` — เสีย list context + เพิ่ม routing surface
- Entry ใน file preview ของผู้ใช้ทั่วไป — ปน role (preview เป็น read surface ไม่ใช่ admin surface)
- Badge "pending confirm" บน list row — ต้อง join/SCAN Redis ทุกแถว (N+1) ไม่คุ้ม v1
- ค้าง dialog แสดง progress จน `INDEXED` — ขัง admin ไว้นานเกิน ซ้ำซ้อนกับ badge/timeline ที่มี
- Cancel-job endpoint — เพิ่ม API surface สำหรับสิ่งที่ TTL จัดการเองได้
- ไม่มี AlertDialog — misclick บน action ที่กู้ไม่ได้ ไม่สมส่วนกับ cost 1 click
- Block confirm เมื่อ shrink — shrink อาจถูกต้อง (text เดิมเป็น garbage ยาว) warning พอ
- PDF แยก tab/modal — context switch ทำให้เทียบ 3 อย่างพร้อมกันไม่ได้

---

## Decisions — Production File Replace (extension, 2026-09-19)

### D17: Unit of change = junction link — junction swap, ไม่ใช่ in-place mutation

**Decision**: Replace mode ไม่แก้ `attachments.file_path`/`original_filename` ของ attachment เดิมเลย — confirm เปลี่ยน `correspondence_revision_attachments.attachment_id` ของ **link เดียวที่ admin เลือก** ไปชี้ attachment ใหม่แทน:

- Trigger body รับ `targetCorrespondencePublicId` — service resolve หา junction row ที่ `(attachment_id = :att) AND (correspondence_revision เป็น is_current ของ correspondence นั้น)` — ไม่เจอ → reject
- `is_main_document` คงเดิมโดยอัตโนมัติ (junction row เดิม เปลี่ยนแค่ FK)
- **Shared attachment ไม่ใช่ blocker** — swap กระทบเฉพาะ junction row ที่เลือก; link อื่นของ attachment เดิม (เช่น 977↔725) ไม่ขยับ
- Attachment row ถือเป็น immutable file record: publicId→file mapping คงที่ตลอดชีพ → audit/preview/RAG vectors ต่อ row สอดคล้องเสมอ
- Revision เก่า (is_current=false) เป็น history — ห้ามแตะ (เลือกได้เฉพาะ link บน current revision)

**Rationale**: หลักฐานจริง (attachment 977 เป็น main document ของ 2 correspondences) พิสูจน์ว่า in-place update จะ corrupt correspondence ที่ถูกต้องอยู่แล้ว — junction swap ทำให้ "ไฟล์เก่า" ยัง serve consumer เดิมได้ และ preserve attachment เดิมครบสำหรับ audit โดยไม่ต้องมี version table

**Alternatives rejected**:
- In-place `UPDATE attachments SET file_path=...` — corrupt ทุก link ที่ share attachment เดียวกัน + เสีย mapping ไฟล์เก่า
- Block replace เมื่อ attachment shared — ทำให้เคสจริง (715) แก้ไม่ได้เลย
- Attachment version table ใหม่ — schema change ไม่จำเป็นเมื่อ junction model รองรับอยู่แล้ว (ADR-044)

### D18: Candidate = uniform temporary attachment — staging copy เข้า tempDir ตอน trigger

**Decision**: ทุก candidate (ทั้ง `storageTempPath` และ `tempAttachmentPublicId`) กลายเป็น **temp attachment row มาตรฐาน** (`isTemporary=true`, `expiresAt` set, file อยู่ใน tempDir) ตอน trigger:

- **Staging source**: path-traversal guard เดียวกับ `replaceQueueItemFile` (resolve แล้วต้องอยู่ใต้ stagingDir/legacyNasPath) + exists+isFile+`.pdf` → **`fs.copy` เข้า tempDir** → สร้าง temp attachment row ชี้ copy นั้น
- **Upload source**: reuse temp attachment จาก `POST /files/upload` เดิม (validate isTemporary + PDF)
- OCR job รันบน candidate filePath (temp copy) — pointer/payload reuse D4 keys เดิม พร้อม field เพิ่มใน pointer: `{ mode:'replace', targetCorrespondencePublicId, candidateAttachmentPublicId, candidateFilename, candidateSource:'STAGING'|'UPLOAD' }`
- **Reject/expire** → temp-cleanup worker เดิมเก็บกวาด (ไฟล์ temp copy + row) — NAS ต้นฉบับปลอดภัยเพราะไม่เคยถูกอ้างถึงตรง ๆ
- **Identical-file guard**: checksum (SHA-256) ของ candidate == checksum ของ attachment เดิม → **409** ก่อน enqueue (ไม่เผา GPU)

**Rationale**: `cleanup-temp-files.worker` ทำ `fs.remove(att.filePath)` บน temp attachment ที่หมดอายุ — ถ้า row ชี้ NAS ตรง ๆ worker จะลบไฟล์ต้นฉบับบน NAS; copy เข้า tempDir ทำให้ทั้งสอง source มี pipeline เดียวกัน 100% (preview/OCR/commit/cleanup ไม่ต้องแยก branch)

**Alternatives rejected**:
- Temp row ชี้ NAS path ตรง ๆ — ต้องแก้ cleanup worker ให้ข้าม path นอก tempDir เสี่ยงและแตะ component ที่ทำงานอยู่
- ไม่สร้าง attachment row เก็บ path ใน Redis + preview endpoint แบบ path-guard — เพิ่ม attack surface (arbitrary path read) และ code path พิเศษ
- Commit เข้า permanent ตั้งแต่ trigger — reject แล้วต้องมี orphan-permanent cleanup ของตัวเอง

### D19: Route แยก + permission คู่ — `POST /files/:publicId/re-ocr/replace`

**Decision**:

| Endpoint | Permission | หมายเหตุ |
|---|---|---|
| `POST /files/:publicId/re-ocr/replace` | `rag.admin.write` **AND** `correspondence.edit` | trigger replace — body: `{ engineType?, targetCorrespondencePublicId, storageTempPath? XOR tempAttachmentPublicId? }` + Idempotency-Key + `@Throttle` + `@Audit('attachment.re_ocr.replace','attachment')` + `AiEnabledGuard` |
| `GET /files/:publicId/re-ocr/links` | `rag.manage` | คืน junction links ทั้งหมดของ attachment (`{ correspondencePublicId, correspondenceNumber, revisionLabel, isCurrent }[]`) สำหรับ link picker |
| status / preview / confirm | เหมือนเดิม (`rag.manage` / `rag.admin.write`) | payload มี `mode:'replace'` → confirm แยก branch เอง |

**Rationale**: replace แตะ junction ของ correspondence = แก้ข้อมูลเอกสาร production จริง ไม่ใช่แค่ OCR text — guard เป็น static per-route แยกตาม body ไม่ได้ จึงต้อง route แยก; permission คู่บังคับให้ผู้ทำมีสิทธิ์แก้ correspondence ด้วย (`RequirePermission` รองรับ AND อยู่แล้ว)

**Alternatives rejected**:
- Route เดียว + `rag.admin.write` เท่านั้น — admin RAG ที่ไม่มี correspondence-edit แก้ข้อมูลเอกสารได้ ข้าม permission boundary
- `correspondence.edit` เท่านั้น — RAG admin ทั่วไปอาจไม่มี permission นี้ ทำให้ feature ใช้ไม่ได้จริง

### D20: Confirm (replace mode) — tx swap + commit-to-permanent + reindex-new → de-index-orphan

**Decision** — confirm เมื่อ payload เป็น `mode:'replace'`:

1. **Pre-checks เดิมทั้งหมด** (payload exists, supersede guard) + junction row ยังอยู่และชี้ attachment เดิม (ไม่ใช่ → 404/410) + candidate temp attachment ยังอยู่
2. **Dedup check**: ถ้ามี non-temp attachment อื่นที่ checksum เดียวกับ candidate อยู่แล้ว → ใช้ row นั้นเป็น target (ไม่สร้างซ้ำ)
3. **DB transaction เดียว**:
   - อัปเดต candidate row: `ocrText=newText`, `aiProcessingStatus='DONE'`, `ragStatus='PENDING'`, `ragLastError=NULL`, `expiresAt=NULL` (ป้องกัน temp-cleanup เผื่อขั้นถัดไปล้มเหลว)
   - `UPDATE correspondence_revision_attachments SET attachment_id=:newId WHERE correspondence_revision_id=:rev AND attachment_id=:oldId` (affected=0 → 404)
4. **Post-commit**: `fileStorageService.commit([tempId], { documentType, issueDate })` — move temp→permanent + `isTemporary=false` + auto RAG-ingest trigger (attachment มี ocr_text แล้ว → ingest ใช้ text นี้ ไม่ต้อง OCR ซ้ำ; junction swap commit ก่อนแล้วจึง resolve document context ได้)
   - commit() ล้มเหลว → row ยังชี้ tempDir + `expiresAt` ถูก clear แล้วจึงไม่โดน worker ลบ — link ใช้งานได้ปกติ (file เดิมใน tempDir) + log error; retry ผ่าน flow ปกติ
   - reingest **ไม่จำเป็น** สำหรับ attachment ใหม่ (ไม่มี ACTIVE generation เดิม — auto-ingest ของ commit พอ) แต่ยัง fire explicit reingest เป็น safety net ได้
5. **Orphan de-index (ลำดับหลัง reindex ใหม่เสมอ)**: นับ junction rows ที่เหลือของ attachment เดิม — `=0` → enqueue vector deletion (RAG cleanup path ที่มีอยู่) + set `ragStatus` ตามผล; `>0` → ไม่แตะเลย
6. **Audit**: `writeAuditLog` ปกติ + ถ้า trace queue item ได้ (`migration_review_queue.imported_correspondence_public_id` = target correspondence) → append `MigrationFileReplacement` เข้า `review_state_json.fileReplacements` (best-effort, ไม่ block confirm)
7. `cleanupKeys` เดิม

**Rationale**: swap+field updates อยู่ใน tx เดียว = atomic; file move เป็น fs operation ทำใน tx ไม่ได้จึงอยู่หลัง commit โดย `expiresAt=NULL` ใน tx ทำให้ failure window ปลอดภัย (row ไม่โดน reap แม้ move ยังไม่เกิด); de-index เก่าหลัง index ใหม่ = ไม่มี gap ใน RAG search

**Alternatives rejected**:
- De-index เก่าก่อน reindex ใหม่ — เอกสารหายจาก search ชั่วคราว
- ลบ old attachment row+file เมื่อ orphan — เสีย audit trail และตัวเลือกย้อนกลับ
- `importStagingFile()` ตอน confirm — ซ้ำซ้อน: temp row อยู่แล้ว `commit()` เดิมครอบทั้ง move+ingest trigger
- Manual `QUEUE_AI_VECTOR_DELETION` บน attachment ใหม่ — เหมือน D6 (generation lifecycle จัดการเอง); vector deletion ใช้เฉพาะกับ **orphan attachment เดิม** เท่านั้น

### D21: ไม่ re-extract metadata — filename-mismatch เตือนแต่ไม่บล็อก

**Decision**: Replace mode เปลี่ยนเฉพาะไฟล์ + `ocr_text` + RAG index — correspondence metadata (`correspondence_number`, subject, type, tags, dates) ที่ผ่าน human review แล้วคงเดิมทั้งหมด **ห้าม** re-extract อัตโนมัติ แต่ UI แสดง non-blocking warning เมื่อเลขที่ใน filename ของ candidate ดูไม่ตรงกับ `correspondence_number` เป้าหมาย (filename ไม่ใช่ source of truth — เตือนให้ตรวจสอบเท่านั้น)

**Rationale**: เคส 715 พิสูจน์ — `document_number` ถูกต้องอยู่แล้ว (admin review ตอน commit) ผิดแค่ไฟล์; auto re-extract จะเขียนทับข้อมูลที่คนตัดสินใจแล้ว ขัดหลัก human-in-the-loop เดียวกัน

**Alternatives rejected**:
- Auto re-extract + metadata compare step — เพิ่ม review phase ทั้งชุดสำหรับเคสส่วนน้อย
- Block เมื่อ filename ไม่ตรง — filename convention ไม่ reliable พอที่จะเป็น hard gate

### D22: UI — สอง entry points + link picker + file picker reuse + PDF toggle

**Decision**:

1. **Entry points 2 จุด**: (ก) Re-OCR dialog เดิมใน RAG console — เพิ่ม "replace file" mode (เห็นเฉพาะผู้มี `rag.admin.write` + `correspondence.edit`) (ข) ปุ่ม replace บน attachment row ในหน้า correspondence detail (`detail.tsx` ข้าง preview/delete) — context ผูก link ของ correspondence นั้นอัตโนมัติ ไม่ต้องเลือก
2. **Link picker** (เฉพาะ entry จาก RAG console): `GET .../re-ocr/links` → dialog แสดง radio list ของ junction links (`correspondenceNumber + revisionLabel + isCurrent`) — unshared = auto-select เดียว; เลือกได้เฉพาะ link บน current revision
3. **File picker**: reuse pattern ของ `frontend/components/migration/replace-file-dialog.tsx` — Tabs `staging` (Legacy NAS folder tree ผ่าน `listLegacyFolders`/`listLegacyFolderFiles`) + `upload` (two-phase `POST /files/upload`)
4. **PDF pane toggle**: diff view เดิม 3 pane — pane ที่ 3 (PDF) มี toggle "ต้นฉบับเดิม / ไฟล์ใหม่" default=ใหม่; preview ผ่าน `GET /files/:publicId/re-ocr/preview` เดิมสำหรับไฟล์เก่า และ candidate temp attachment publicId สำหรับไฟล์ใหม่
5. **Warning**: filename-mismatch badge ใน dialog (D21) — ไม่บล็อก confirm
6. Confirm flow เดิมทั้งหมด (AlertDialog permanent + counts + toast + close) ใช้ได้กับ replace mode โดยข้อความปรับเป็น "แทนที่ไฟล์และ OCR text ถาวร"

**Rationale**: จุดค้นพบปัญหาจริงคือหน้า correspondence ("เลขนี้ไฟล์ผิด") มากกว่า RAG console — แต่ console ยังต้องรองรับด้วย link picker เพราะ shared attachment เลือก link จาก context ไม่ได้

**Alternatives rejected**:
- Entry point เดียว (console เท่านั้น / detail เท่านั้น) — ขาดอีก workflow หนึ่ง
- 4-pane diff (PDF เก่า+ใหม่แยก column) — แคบเกินบนจอทั่วไป toggle พอ
- Replace ทุก link พร้อมกัน — ทำ correspondence ที่ถูกอยู่พัง (เคส 725)

---

## Consequences

### Positive

- Admin สามารถปรับปรุงคุณภาพ OCR ของเอกสารที่มีอยู่แล้วในระบบได้ โดยไม่เสี่ยง data loss (source of truth ไม่ถูกแตะจนกว่าจะ confirm)
- ไม่เพิ่ม schema ใหม่เลย — ใช้ Redis สำหรับข้อมูลชั่วคราว, reuse OCR engine + BullMQ queue + generation lifecycle ที่มีอยู่แล้ว
- RAG/Qdrant sync กับ `attachments.ocr_text` เสมอหลัง confirm ผ่าน generation lifecycle ที่ถูกออกแบบมาเพื่อ re-embed (D6)
- Scope แคบ (single attachment, `rag.admin.write`) ลด blast radius ของ feature ใหม่
- ซ่อม bug/ch่องโหว่เดิมของ codebase ไปด้วย: `NpDmsOcrProcessor` silent failure ทั้ง 2 path (D10), ingestion pipeline idempotency hole (DONE-guard, D9) — ทั้งสองอยู่ใน blast radius ของไฟล์ที่ต้องแตะอยู่แล้ว
- DONE terminal-state guard ทำให้ `ai_processing_status` มี semantics ชัดขึ้น: เสร็จแล้วไม่มีใครเขียนทับ
- *(2026-09-19)* แก้เคส wrong-file-on-production ได้โดยไม่แตะ consumer อื่น (junction swap per-link) — ปิด gap ที่ `replaceQueueItemFile` reject IMPORTED ทิ้งไว้
- *(2026-09-19)* Old attachment เป็น immutable record — audit/ย้อนดูไฟล์เก่าได้เสมอ; NAS ต้นฉบับปลอดภัยจากทุก path (copy-only)

### Negative

- ไม่มี rollback-after-confirm — ถ้า admin ตัดสินใจผิดพลาด ต้อง re-OCR ใหม่เพื่อพยายามกู้คืน (อาจไม่ได้ผลลัพธ์เดิม 100%)
- Redis TTL 72 ชม. (3 วัน) — ถ้า admin ไม่ confirm ภายใน 3 วันต้อง trigger ใหม่ (เสีย GPU cycle ซ้ำ) แต่ครอบคลุม work cycle ปกติรวมถึงกรณีวันหยุดแล้ว
- ไม่รองรับ batch — ถ้าต้องการ re-OCR หลายไฟล์ต้องทำทีละไฟล์ในรอบแรกนี้
- แตะ `ai-batch.processor.ts` (shared ingestion path) สำหรับ DONE-guard — เพิ่ม conditional + early-skip ~10 บรรทัด ต้องมี test ว่า flow ปกติ (PENDING→PROCESSING→DONE, FAILED→retry) ไม่พัง
- *(2026-09-19)* Replace mode ซับซ้อนกว่า re-OCR เดิม (junction swap + temp commit + orphan de-index) — failure window ระหว่าง tx-commit กับ file move มีอยู่แต่ปลอดภัย (D20 ข้อ 4)
- *(2026-09-19)* Orphan attachment เดิมค้างเป็น row ที่ไม่มี link (เก็บไว้ตามเจตนา) — ไม่มี orphan-row cleanup สำหรับกรณีนี้; แสดงใน RAG console ต่อได้จนกว่าจะ de-indexed

### Neutral

- Feature นี้แยกจาก migration flow โดยสิ้นเชิง (D2) — ไม่กระทบ `migration_review_queue` หรือ ADR-054 เลย
- ใช้ CASL permission ที่มีอยู่แล้ว (`rag.admin.write`/`rag.manage`) ไม่ต้องสร้าง permission ใหม่
- Frontend polling reuse pattern เดียวกับ sandbox OCR flow ที่มีอยู่แล้ว
- `QUEUE_NP_DMS_OCR` กลับมามี producer จริงหลังเป็น dead queue มาตั้งแต่ถูก ai-batch routing แทนที่

---

## Schema Changes

**ไม่มี** — ADR นี้ไม่เพิ่ม column/table ใหม่เลย ข้อมูลระหว่างรอ confirm อยู่ใน Redis (D4) ไม่มี rollback mechanism ที่ต้องพึ่ง column สำรอง (D8)

*(ยืนยันอีกครั้ง 2026-09-19 สำหรับ file-replace extension)* — junction swap ใช้ `correspondence_revision_attachments` เดิม, candidate ใช้ `attachments.isTemporary`/`expiresAt`/`tempId` เดิม, queue annotation ใช้ `review_state_json.fileReplacements` เดิม — ไม่ต้อง schema change ใด ๆ (ADR-044 unaffected)

---

## Implementation Plan

| ขั้นตอน | ไฟล์ | งาน |
|---------|------|----- |
| 1 | `backend/src/modules/ai/processors/np-dms-ocr-processor.ts` | **[BUGFIX + contract]** (ก) เขียน `ai:np-dms-ocr:{idempotencyKey}` → `status:'failed'` ก่อน throw **ทั้ง 2 path** (VRAM gate + catch) (ข) รองรับ re-OCR fields (`attachmentPublicId`/`reOcrToken`/`forceRefresh`): เขียน pointer ทุก transition, payload key ตอนสำเร็จ, ข้าม cache-read ถ้า forceRefresh, เขียน failed เฉพาะ attempt สุดท้าย (ค) VRAM gate เฉพาะ `engineType='np-dms-ocr'` |
| 2 | `backend/src/modules/ai/ai-queue.service.ts` | เพิ่ม `enqueueAttachmentReOcr()` — เรียก `checkAiUnavailableLocks()` เหมือน method อื่น → `npDmsOcrQueue.add()` ด้วย `jobId = re-ocr:{publicId}:{token}` (ไม่ใส่ priority) |
| 3 | `backend/src/common/file-storage/attachment-re-ocr.service.ts` (ใหม่) | trigger: file guard (D12) → `aiProcessingStatus` check (D9) → in-flight guard (D9) → gen `reOcrToken` → เขียน pointer `'queued'` → enqueue; status: อ่าน pointer (+ payload เมื่อ completed, เทียบ `identical`); confirm: validate `Idempotency-Key` + `reOcrToken` → อ่าน payload → transaction UPDATE (D6) → `reingest()` → DEL keys — inject AiQueueService/RagAdminService ผ่าน ModuleRef (D13) |
| 4 | `backend/src/common/file-storage/file-storage.module.ts` | register `{ name: QUEUE_NP_DMS_OCR }` ใน `BullModule.registerQueue` (D13) |
| 5 | `backend/src/common/file-storage/file-storage.controller.ts` | เพิ่ม `POST :publicId/re-ocr` + `GET :publicId/re-ocr/status` + `POST :publicId/re-ocr/confirm` พร้อม contract ตาม D11 |
| 6 | `backend/src/modules/ai/processors/ai-batch.processor.ts` | **[DONE-guard]** conditional `UPDATE ... WHERE ai_processing_status <> 'DONE'` ที่จุดเขียน `ocr_text`/PROCESSING → affected rows = 0 → skip job + log warn (D9 ข้อ 3) |
| 7 | Frontend (RAG console + components ใหม่) | row action "Re-OCR" ใน attachments list (เฉพาะ `rag.admin.write`) → full-screen dialog 3 phase (engine select → wait+poll 3วิ → diff): resume-by-click ผ่าน `GET /status` ก่อนเสมอ, diff = side-by-side `<pre>` + PDF reference pane (reuse file-preview) + search-in-pane + charCount + shrink badge + `identical` disable, AlertDialog no-rollback ก่อน confirm, post-confirm toast + list invalidate — i18n keys ทั้งหมด (D16) |
| 8 | `np-dms-ocr-processor.spec.ts` + `attachment-re-ocr.service.spec.ts` + controller spec + ai-batch spec | เพิ่ม tests ทั้ง bugfix, DONE-guard และ feature (ดู Tests ที่ต้องเพิ่ม) |
| **Extension: Production File Replace (D17–D22)** | | |
| 9 | `backend/src/common/file-storage/re-ocr.constants.ts` + `dto/re-ocr.dto.ts` | pointer เพิ่ม replace fields (`mode`, `targetCorrespondencePublicId`, `candidateAttachmentPublicId`, `candidateFilename`, `candidateSource`); `TriggerReplaceFileDto` (XOR source) |
| 10 | `backend/src/common/file-storage/attachment-re-ocr.service.ts` | `triggerReplace()` (link resolve + path guard + staging copy→temp + checksum guard) + `confirmReplace()` (D20 tx + commit + orphan de-index + queue annotation) + `listLinks()`; `getStatus` pass-through replace fields |
| 11 | `backend/src/common/file-storage/attachment-re-ocr.controller.ts` | `POST :publicId/re-ocr/replace` (dual permission) + `GET :publicId/re-ocr/links` (rag.manage) |
| 12 | `backend/src/modules/ai/processors/np-dms-ocr-processor.ts` | re-OCR job รองรับ candidate `pdfPath` ที่ชี้ temp file (job data เดิมพอ — service ส่ง candidate path) |
| 13 | Frontend | `ReOcrDialog` + link picker + file picker (reuse staging browser/upload tabs) + filename-mismatch warning; `ReOcrDiffView` PDF toggle เดิม/ใหม่; replace button ใน `components/correspondences/detail.tsx`; i18n |

### Tests ที่ต้องเพิ่ม

- Trigger re-OCR ไม่แก้ `attachments.ocr_text` จนกว่าจะ confirm
- Trigger response มี `reOcrToken`, `queuePosition`, `estimatedWaitSeconds`, `status:'queued'` และ pointer ถูกเขียน `queued`
- `GET /re-ocr/status` ส่ง `processing` เมื่อ job เริ่มรัน, `completed` พร้อม `newText`/`identical` เมื่อเสร็จ, `failed` พร้อม `errorMessage` เมื่อ attempt สุดท้ายพัง
- Re-OCR job **ข้าม `OcrCacheService.get()`** (cache hit ไม่คืน text เก่า) แต่ยัง `set()` หลังสำเร็จ
- VRAM gate: `engineType='np-dms-ocr'` + VRAM ไม่พอ → fail; `engineType='auto'` + VRAM ไม่พอ → ไม่ fail ที่ gate
- Confirm ต้องมาจาก payload key ที่ยังไม่หมด TTL — ถ้าหมดอายุ/token ไม่ตรง reject
- Confirm ซ้ำหลัง keys ถูกลบ → 404/410
- RBAC: ผู้ไม่มี `rag.admin.write` เรียก POST ไม่ได้; `Idempotency-Key` หาย → 400
- Confirm สำเร็จ → `ocr_text`/`rag_status='PENDING'`/`ai_processing_status='DONE'` เปลี่ยน + `ingest(force=true)` ถูกเรียก + ingest job ถูก enqueue — **ไม่มีการเรียก QUEUE_AI_VECTOR_DELETION**
- Engine selector ส่งค่าที่ไม่อยู่ใน `SandboxOcrEngineType` → validation error
- Trigger ขณะ `aiProcessingStatus='PROCESSING'` → 409; `'PENDING'`/`'FAILED'`/`'DONE'` → อนุญาต
- In-flight guard: pointer `processing`/`queued` + job ยังอยู่ใน BullMQ → 409; pointer stale (job หาย) → อนุญาต
- Non-PDF attachment → 422; `filePath` หายจาก disk → 410
- Job fail attempt 1/2 → pointer `processing` (ไม่ใช่ `failed`); attempt สุดท้าย → `failed`
- VRAM gate throw → เขียน failed status ลง `ai:np-dms-ocr:{key}` + pointer (ทั้ง 2 path)
- DONE-guard: ingestion job รันบน attachment ที่ `ai_processing_status='DONE'` → skip + ไม่เขียน `ocr_text`; บน `PENDING`/`FAILED` → ทำงานปกติ
- Trigger ตอน `ai:ocr-batch:active`/`ai:model:transitioning` lock → 503 `AI_FEATURES_UNAVAILABLE`
- Pointer มี `triggeredByDisplayName` + `triggeredAt` ตั้งแต่เขียน `'queued'` (D16)
- `newText` ว่างเปล่า → pointer `failed` (ไม่ใช่ completed) + errorMessage ชัด (D16)
- `newText` สั้นกว่าเดิม <50% → status response มี `warning:'RESULT_MUCH_SHORTER'` (D16)
- Frontend: action เรียก `GET /status` ก่อนเสมอ — pointer `completed` → เปิด diff phase โดยไม่ trigger ซ้ำ (resume-by-click) (D16)

**File Replace (D17–D22)**:

- Trigger replace: staging path นอก allowed roots → 400; path ไม่ใช่ไฟล์/ไม่ใช่ PDF → 422/404; source XOR ผิด (ส่งทั้งคู่/ไม่ส่งเลย) → 400
- Staging candidate ถูก **copy** เข้า tempDir + temp attachment row (`isTemporary`, `expiresAt`) — ไฟล์ NAS ต้นฉบับไม่ถูกแตะ (assert mtime/exists หลัง trigger)
- Link resolve: target correspondence ไม่มี junction กับ attachment บน current revision → 404/409; link บน non-current revision → reject
- Candidate checksum == attachment เดิม → 409 (ไม่ enqueue)
- OCR job ของ replace รันบน candidate filePath (temp copy) ไม่ใช่ไฟล์เดิม — assert `pdfPath` ใน job data
- Confirm: tx เดียว — junction `attachment_id` เปลี่ยนเฉพาะ link ที่เลือก (assert link อื่นของ attachment เดิมไม่ขยับ), candidate row ได้ `ocrText`/`DONE`/`PENDING`/`expiresAt=NULL`, old attachment row ไม่ถูกแก้ field ใด
- Post-commit: `commit()` move temp→permanent; orphan old (junction count=0) → vector deletion enqueue + ragStatus; shared old (count>0) → untouched
- Junction หาย/ชี้ attachment อื่นแล้วระหว่าง trigger→confirm → 404/410 ไม่มี partial swap
- Candidate temp attachment ถูก cleanup ก่อน confirm → confirm 404
- Dedup: non-temp attachment checksum เดียวกันอยู่แล้ว → link ชี้ row เดิมนั้น ไม่สร้างซ้ำ
- Queue annotation: queue item ที่ trace ได้ได้ `fileReplacements` entry (idempotencyKey, at, userId, source, paths); queue ไม่มี → audit ยังเขียนใน ai_audit_logs ปกติ
- RBAC: replace route ต้องการ **ทั้ง** `rag.admin.write` และ `correspondence.edit` — ขาดตัวใดตัวหนึ่ง → 403
- Frontend: link picker แสดงครบทุก link + auto-select เมื่อ link เดียว + เลือกได้เฉพาะ current revision; PDF pane toggle เดิม/ใหม่ default=ใหม่; filename-mismatch warning ไม่บล็อก confirm

---

## Notes

- ADR นี้แยกออกมาจาก ADR-054 D6 เดิม (ถูกตัดออกเพราะไม่มี use case ใน migration/production ingestion ปกติ) — เป็น net-new capability ที่ไม่เคยมีในระบบมาก่อน
- ทุก decision ในนี้ยึดหลัก human-in-the-loop เป็นแกนกลาง — ไม่มีจุดไหนที่ `attachments.ocr_text` ถูกแทนที่โดยไม่มี admin เห็น diff ก่อน
- **[BUGFIX included]** D10 แก้ existing gap ใน `np-dms-ocr-processor.ts` ที่ error path ทั้ง 2 จุด (VRAM gate + catch) ไม่เคยเขียน `status:'failed'` กลับ Redis — แก้ใน PR เดียวกันเพราะต้องแตะไฟล์เดียวกันอยู่แล้ว (เทียบ pattern: `ai-batch.processor.ts` line 929–939 ทำถูกต้องอยู่แล้ว)
- **[PIPELINE GUARD included]** D9 ข้อ 3 แก้ idempotency hole เดิมใน `ai-batch.processor.ts` — ทำให้ `DONE` เป็น terminal state ของ `ai_processing_status` ซึ่งจำเป็นต่อ correctness ของ feature นี้ (กัน late ingestion job ทับผลที่ admin confirm แล้ว) แยก commit ใน PR เดียวกัน
- Grill session 2026-09-19 พบสมมติฐานเดิมที่ผิด 3 จุดสำคัญ: (ก) `QUEUE_NP_DMS_OCR` ไม่มี producer — claim "ข้ามหน้า migration jobs" เป็นเท็จ (ข) BullMQ `priority: 1` deprioritize ไม่ใช่ข้ามหน้า (ค) manual Qdrant deletion ทั้งผิดกลไก (generation lifecycle จัดการเอง) และเสี่ยง race กับ upsert ใหม่ — ทั้งหมดถูกแก้ใน revision นี้
