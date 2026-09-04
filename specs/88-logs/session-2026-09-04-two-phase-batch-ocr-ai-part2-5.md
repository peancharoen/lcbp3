# Session — 2026-09-04 (Two-Phase Batch OCR/AI Extraction — Part 2-5, feature complete)

## Summary

สานต่อจาก `session-2026-09-04-two-phase-batch-ocr-ai-part1.md` (Part 1: Redis lock layer)
ทำ Part 2-5 ที่เหลือทั้งหมดจนครบตามแผนที่ `~/.claude/plans/velvet-hatching-whistle.md` — แยก
batch OCR/AI legacy enrichment เป็น 2 phase (OCR ทั้ง batch ก่อน แล้วยิง LLM metadata ทั้ง
batch) ลด Ollama model swap จาก 2N เหลือ 2 ครั้งต่อ batch พร้อม frontend Wait/Cancel dialog
เมื่อ AI Chat/RAG ถูก block ระหว่าง phase OCR

## การแก้ไข (Fix)

| Part | ไฟล์ | การเปลี่ยนแปลง |
| --- | --- | --- |
| 2 | `backend/src/modules/ai/services/ocr.service.ts` | เพิ่ม `extractTextOnly()` — เหมือน `detectAndExtract()` ทุกอย่างยกเว้นไม่ unload/reload model เอง (caller คือ batch orchestrator รับผิดชอบแทน); `detectAndExtract()` เดิม refactor ให้เรียก `extractTextOnly()` ภายใน wrapper unload/reload เดิม — caller อื่น (sandbox OCR test, single-doc flows) ไม่กระทบ |
| 2 | `backend/src/modules/ai/tests/ocr.service.spec.ts` | +4 tests (unload/reload assertion, extractTextOnly ไม่ unload/reload, threshold skip, no-pdfPath skip) |
| 3 | `backend/src/modules/ai/processors/ai-batch.processor.ts` | เพิ่ม job type `legacy-ocr-batch-phase` (orchestrator: acquire lock → unload BGE+main ครั้งเดียว → loop `extractTextOnly()` ทุกเอกสาร (heartbeat lock ทุก 10s) → reload ครั้งเดียว → release lock → enqueue phase 2 ต่อเอกสาร) และ `legacy-ai-metadata-only` (phase 2: LLM metadata extraction เท่านั้น, รับ ocrText จาก phase 1); extract `runLegacyMetadataExtraction()` + `persistLegacyEnrichmentResult()` ออกจาก `processLegacyAiEnrichment()` เดิมให้ทั้ง 2 path (single-doc เดิม + batch phase 2 ใหม่) ใช้ร่วมกัน ไม่ duplicate |
| 3 | `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | +5 tests (phase 1 happy path unload/reload ครั้งเดียว + ใช้ extractTextOnly ไม่ใช่ detectAndExtract, lock-held → throw, partial OCR failure isolation, phase 2 happy path, phase 2 immediate-fail เมื่อ ocrFailed จาก phase 1) |
| 4 | `backend/src/modules/migration/migration.service.ts` | `startExtractBatch()`: publicIds.length <= 1 → path เดิม (`startExtractQueueItem` ทีละตัว) ไม่เปลี่ยน; N>1 → validate guard เดียวกันทุก publicId (status PENDING + ไม่มี job ค้าง) แล้ว enqueue orchestrator job เดียว (`legacy-ocr-batch-phase`) พร้อม `items[]`; เพิ่ม `enqueueLegacyAiMetadataOnly()` ให้ processor เรียกตอนจบ phase 1 |
| 4 | `backend/src/modules/migration/migration.service.spec.ts` | อัปเดต `startExtractBatch` describe block (แก้ test เดิมที่ผลลัพธ์เปลี่ยนลำดับ) + 2 tests ใหม่ (N>1 orchestrator enqueue, all-guards-failed → ไม่ enqueue) + เพิ่ม `update` mock ใน `mockReviewQueueRepo` |
| 5 | `frontend/hooks/use-ai-unavailable-retry.ts` (ใหม่) | Shared hook `trigger/wait/cancel` state machine — "รอ" เริ่ม retry loop ทุก 8s จนสำเร็จหรือ cancel (ไม่มี server-side cap) |
| 5 | `frontend/components/ai/ai-unavailable-wait-dialog.tsx` (ใหม่) | shadcn Dialog, บล็อค outside-click/Esc (ต้องกดปุ่มเท่านั้น), ข้อความไทยผ่าน i18n keys ใหม่ |
| 5 | `frontend/hooks/use-ai-chat.ts` | `sendMessage()` catch block เช็ค `axios.isAxiosError` + `response.data.error.code === 'AI_FEATURES_UNAVAILABLE'` → เปิด dialog แทน error bubble คงที่; cancel replace placeholder message เป็น "ผู้ใช้ยกเลิกการส่งข้อความ" |
| 5 | `frontend/app/(admin)/admin/ai/rag-playground/page.tsx` | `handleSubmitSandbox()` catch block ได้ treatment เดียวกัน (เฉพาะ submit เริ่มต้น — `pollSandboxJob` 5s polling loop ไม่แตะ เพราะเป็นคนละ endpoint) |
| 5 | `frontend/public/locales/{th,en}/common.json` | เพิ่ม namespace `ai.unavailable.*` (title/description/retrying/wait/cancel) ทั้ง 2 ภาษา |
| 5 | `frontend/hooks/__tests__/use-ai-chat.test.ts` | +3 tests (dialog เปิดแทน error bubble, "รอ" retry สำเร็จผ่าน fake timers, "ยกเลิก" mark placeholder) |

## Judgment call ที่ตัดสินใจระหว่าง implement (ตามที่แผนทิ้งไว้เป็น open question)

- **`startExtractQueueItem` (single-doc) ไม่ผ่าน orchestrator แม้เป็น batch-of-1** — คง legacy
  path เดิมไว้เพราะไม่มีปัญหา model-swap ซ้ำที่ orchestrator แก้อยู่แล้วเมื่อมีแค่ 1 เอกสาร
  (2 swaps ก็เหมือนเดิมไม่ว่าจะผ่าน orchestrator หรือไม่) — ลด risk footprint ของ PR นี้
- **ไม่เพิ่มคอลัมน์ schema ใหม่ (`ocr_status`/`ocr_completed_at`) ตามที่แผนเสนอไว้เป็นตัวเลือก**
  — reuse `aiStatus` enum เดิม (`WAITING` repurposed เป็น "OCR phase เสร็จแล้ว รอ phase 2"
  แทนความหมายเดิม "รอ BullMQ เริ่มงาน") ทั้งสองความหมายคือ "ยังไม่เสร็จ รอขั้นต่อไป" เข้ากันได้
  ไม่กระทบ final state (DONE/FAILED) หรือ query ที่กรองด้วย aiStatus — หลีกเลี่ยง ADR-044 SQL
  delta ทั้งชุดสำหรับ iteration นี้ **Follow-up ถ้าจำเป็นในอนาคต:** ถ้า UI ต้องการแยกแสดง
  "OCR done, waiting LLM" ออกจาก "queued, not started yet" ชัดเจนกว่านี้ ต้องทำ schema-change
  skill เพิ่มคอลัมน์จริง

## กฎที่ Lock แล้ว

- **D267 — Two-Phase Batch OCR/AI Extraction (ดู `project-memory-override.md`)**

## Verification

- [x] Backend: `pnpm --filter backend test` เฉพาะไฟล์ที่แก้ (ocr.service.spec.ts,
      ai-batch.processor.spec.ts, migration.service.spec.ts) — ทุกไฟล์ผ่าน 100%
- [x] Backend: `pnpm exec jest src/modules/ai src/modules/migration` เต็มโฟลเดอร์ — 952/952 pass
- [x] Backend: `tsc --noEmit` + `eslint --max-warnings 0` บนทุกไฟล์ที่แก้ — 0 errors
- [x] Frontend: `pnpm test --run` เต็ม suite — 997/997 pass (994 เดิม + 3 ใหม่)
- [x] Frontend: `tsc --noEmit` + `eslint --max-warnings 0` บนทุกไฟล์ที่แก้ — 0 errors
- [x] Frontend: `pnpm build` — สำเร็จ (production build ผ่าน)
- [x] Commit local ทีละ part ตาม D264 (4 commits, รายละเอียดใน `project-memory-override.md`
      D267) — **ยังไม่ push**
- [ ] **E2E manual verify ยังไม่ได้ทำ** (ต้องมี browser/live system access) — รัน "Start
      Extract" batch หลายเอกสารพร้อมกับส่ง AI Chat จาก session อื่น ยืนยันว่า dialog รอ/ยกเลิก
      โผล่จริง ไม่ใช่ error เงียบๆ หรือ cold-start ช้าๆ — **pending**
- [ ] ยังไม่ push — รอ user สั่ง `2git.sh`

## หมายเหตุสำหรับ session ถัดไป

- Feature ครบทั้ง 5 part ตามแผนแล้ว ไม่มีงาน backend/frontend เหลือ (นอกจาก E2E manual verify
  ด้านบน) — ถ้า user สั่ง push ให้ใช้ `2git.sh` ตาม D264 (squash 4 commits เป็น 1 อัตโนมัติ)
- คำเตือนเรื่อง isolated worktree จาก session ก่อนหน้า (ไฟล์แก้ไขหายกลับไปเป็นเนื้อหาเดิมกลาง
  session) **ไม่เกิดซ้ำใน session นี้** — ทำงานตรงบน `/opt/np-dms-lcbp3` แบบเดิม ไม่ใช้ worktree
  แยก, ทุก commit ตรวจสอบด้วย `git status`/`git diff --stat` แล้วสำเร็จตามคาด
