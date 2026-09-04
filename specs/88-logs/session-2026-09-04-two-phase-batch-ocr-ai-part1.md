# Session — 2026-09-04 (Two-Phase Batch OCR/AI Extraction — Part 1)

## Summary

เริ่ม implement feature ใหม่: แยก batch OCR/AI legacy enrichment เป็น 2 phase (OCR ทั้ง batch
ก่อน แล้วค่อยยิง LLM metadata ทั้ง batch) เพื่อลด Ollama model swap จาก 2N เหลือ 2 ครั้งต่อ
batch (N = จำนวนเอกสาร) พร้อม gate ที่ block AI Chat/RAG แบบ realtime ระหว่าง phase OCR
(user เลือก tradeoff นี้เอง — ต้องแจ้ง user ด้วย choice รอ/ยกเลิก ไม่ใช่ปล่อยให้ cold-start
เงียบๆ) แผนเต็มอยู่ที่ `~/.claude/plans/velvet-hatching-whistle.md` (ไฟล์นอก repo — plan
mode ของ Claude Code) — session นี้ทำเสร็จแค่ **ส่วนที่ 1 จาก 5** ตามแผน

## ปัญหาที่พบ (Root Cause)

`processLegacyAiEnrichment()` (`ai-batch.processor.ts:2122`) รัน OCR แล้วต่อด้วย LLM ต่อ
เอกสาร 1 job/เอกสาร — `OcrService.detectAndExtract()` unload main model+BGE ก่อนเรียก OCR
sidecar แล้ว reload main model ใน `finally` ทุกครั้ง (D261) ดังนั้น batch N เอกสาร = สลับ
โมเดล 2N ครั้ง (5-15s cold start ต่อครั้ง) ทั้งที่ทำได้แค่ 2 ครั้งถ้าแยก phase

ระหว่างแก้ พบบั๊กแฝงเพิ่ม: `checkModelTransitioningLock()` (`ai-queue.service.ts`) throw raw
`HttpException` พร้อม custom `code` field เอง แต่ `GlobalExceptionFilter` เช็ค
`instanceof BaseException` ก่อน — raw `HttpException` ที่ไม่ใช่ `BaseException` subclass จะ
ถูก overwrite `code` เป็น `'HTTP_ERROR'` เสมอ (ไม่มีทางอ่าน custom code ได้เลย) ทำให้
frontend interceptor (`lib/api/client.ts`, เช็ค `code === 'AI_FEATURES_UNAVAILABLE'`) ไม่เคย
match มาตั้งแต่มี gate นี้ (ADR-048) — `AI_FEATURES_UNAVAILABLE_EVENT` ไม่เคย fire จริง

## การแก้ไข (Fix) — Part 1 เท่านั้น

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/ai-queue.service.ts` | เพิ่ม Redis lock ที่สอง `ai:ocr-batch:active` (heartbeat pattern, ต่ออายุเป็นระยะ แทน fixed TTL 15s แบบ `ai:model:transitioning` เดิม เพราะ phase OCR ทั้ง batch ยาวเป็นนาที) พร้อม `acquireOcrBatchLock()`/`heartbeatOcrBatchLock()`/`releaseOcrBatchLock()`; rename `checkModelTransitioningLock()` → `checkAiUnavailableLocks()` เช็คทั้ง 2 lock (OR) — 7 enqueue* call site เดิมไม่ต้องแก้ไข; เปลี่ยนจาก raw `HttpException` เป็น `ServiceUnavailableException` (แก้บั๊กแฝงด้านบน) |
| `backend/src/modules/ai/ai-queue.service.spec.ts` | เพิ่ม 9 tests (lock acquire/heartbeat/release + ownership token + error.code assertion); แก้บั๊กแฝงใน mock เอง — `set()` mock เช็ค `'NX'` ที่ positional arg ตัวที่ 3 ผิด (arg 3 จริงคือ `'EX'` เสมอ, `'NX'` อยู่ arg 5) ทำให้ NX semantics ไม่เคยถูกทดสอบจริงมาก่อน |

## กฎที่ Lock แล้ว

- **D265 — สอง lock คนละหน้าที่:** `ai:model:transitioning` (ADR-048, TTL คงที่ 15s, สำหรับสลับ
  โมเดลสั้นๆ) กับ `ai:ocr-batch:active` (heartbeat, สำหรับ phase ยาวเป็นนาที) ต้องแยกกันเสมอ
  ห้ามใช้ lock เดียวกันสำหรับทั้งสองวัตถุประสงค์ — `checkAiUnavailableLocks()` เป็นจุดเดียวที่
  เช็คทั้งคู่ (OR)
- **D266 — 503 ที่ต้องการให้ frontend เห็น `code` ต้องใช้ BaseException subclass เท่านั้น:**
  raw `HttpException` ใน backend นี้ถูก `GlobalExceptionFilter` overwrite `code` เป็น
  `'HTTP_ERROR'` เสมอ ไม่ว่าจะใส่ custom `code` field ใน body หรือไม่ — ถ้าต้องการให้ error
  code เฉพาะเจาะจง (เช่น `AI_FEATURES_UNAVAILABLE`) ไปถึง frontend จริง ต้อง throw ผ่าน
  `BaseException` subclass (เช่น `ServiceUnavailableException`) เท่านั้น

## Verification

- [x] `pnpm --filter backend test` เฉพาะ `ai-queue.service.spec.ts` — 31/31 pass
- [x] `tsc --noEmit` — 0 errors
- [x] `eslint --max-warnings 0` บนไฟล์ที่แก้ — 0 errors
- [x] Commit local `0f874744` (D264 — commit ทันที, ยังไม่ push)
- [ ] **ยังไม่ push** — รอรวมกับ commit อื่นของ feature นี้ก่อน หรือรอ user สั่ง `2git.sh`

## งานที่เหลือ (Next Session — อ่านแผนเต็มที่ `~/.claude/plans/velvet-hatching-whistle.md` ก่อน)

- [ ] **(2) `OcrService`** — แยก `extractTextOnly()` (ไม่ unload/reload) ออกจาก
      `detectAndExtract()` เดิม (คง `detectAndExtract()` ไว้สำหรับ caller อื่นที่ไม่เกี่ยวกับ
      batch feature นี้ — sandbox OCR test ฯลฯ ห้ามกระทบ)
- [ ] **(3) Orchestrator job ใหม่** ใน `ai-batch.processor.ts` (job type ใหม่ เช่น
      `legacy-ocr-batch-phase`) — acquire lock จาก (1) → unload ครั้งเดียว → loop OCR ทุก
      เอกสารในชุด (heartbeat lock ทุกรอบ) → reload ครั้งเดียว → release lock → enqueue phase 2
      (job type ใหม่ เช่น `legacy-ai-metadata-only`, แยก logic LLM ออกจาก
      `processLegacyAiEnrichment` เดิมมาใช้ร่วมกัน ไม่ duplicate)
- [ ] **(4) `migration.service.ts`** — `startExtractBatch()` เปลี่ยนจาก enqueue N jobs เป็น
      enqueue orchestrator job เดียวสำหรับทั้ง batch (ตัดสินใจตอน implement: route
      `startExtractQueueItem` เดี่ยวผ่าน orchestrator แบบ batch-of-1 ด้วยหรือไม่)
- [ ] **(5) Schema change** — ต้องผ่าน skill `schema-change` (ADR-044 SQL delta) เพิ่ม
      per-document OCR-phase tracking ใน `migration_review_queue` (ชื่อคอลัมน์/รูปแบบ ตัดสินใจ
      ตอน implement ผ่าน skill)
- [ ] **(6) Frontend** — `AiUnavailableWaitDialog` component (shadcn Dialog, ปุ่ม รอ/ยกเลิก) +
      `useAiUnavailableRetry` hook (backoff retry ทุก ~8s จนสำเร็จหรือ user กด cancel) wire
      เข้า `frontend/hooks/use-ai-chat.ts` (catch block `sendMessage()`) และ
      `frontend/app/(admin)/admin/ai/rag-playground/page.tsx` (catch block
      `handleSubmitSandbox`)
- [ ] E2E manual: รัน "Start Extract" batch หลายเอกสารพร้อมกับส่ง AI Chat จาก session อื่น —
      ยืนยันว่า dialog รอ/ยกเลิกโผล่จริง ไม่ใช่ error เงียบๆ หรือ cold-start ช้าๆ

## หมายเหตุสำคัญสำหรับ session ถัดไป

- **พบใน memory เดิม (บรรทัด "Next Session Focus" ของ session 2026-09-03):** เครื่องนี้อาจมี
  agent หลายตัว (Devin/Claude/Codex) รันพร้อมกันบน `/opt/np-dms-lcbp3` เดียวกันโดยไม่มี
  worktree แยก — สงสัยเป็นสาเหตุที่ไฟล์ที่แก้ไข (`SKILL.md` deploy 3 ชุด +
  `memory/project-memory-override.md`) หายกลับไปเป็นเนื้อหาเดิมกลางเซสชันนี้เอง (ยืนยันแล้วว่า
  `git status` ไม่เห็นว่ามีการแก้ไขค้างอยู่เลยหลังเหตุการณ์ ทั้งที่ไม่เคย commit/revert เอง) —
  **ควรพิจารณาใช้ isolated worktree** สำหรับ feature ใหญ่นี้ก่อนแก้ไฟล์ critical
  (`ai-batch.processor.ts` ~2000 บรรทัด) เพื่อกันเหตุการณ์แบบเดียวกันเกิดซ้ำระหว่างทำ part
  ที่เหลือ
