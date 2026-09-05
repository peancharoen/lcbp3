# Session 2026-09-05 (ADR-051 D2 Cold-Start UX + Next Session Focus Tracking)

## Summary

สร้าง branch `docs/next-session-focus` เพื่อติดตามงานค้างใน "Next Session Focus"
ปิด items ที่เสร็จแล้ว (CI/CD verify ผ่าน manual, uptime-kuma แก้แล้ว, worktree
isolation mitigated ด้วย `memory/branch-workflow.md`) และ implement
ADR-051 D2 — UX loading message สำหรับ Ollama cold-start

## ปัญหาที่พบ (Root Cause)

ADR-051 D2 ยอมรับ residual mid-flight race: เมื่อ `ocr-extract` (ai-batch) dequeue
ไปแล้วและกำลัง unload main model อยู่ ถ้า realtime job เข้ามาพอดีจะเจอ cold-start
latency 5-15s — user เห็นแค่ spinner เฉยๆ ไม่มีบริบท ตรวจ code ก่อน implement
พบว่า `AiUnavailableWaitDialog` ครอบคลุมเฉพาะเคส 503 `AI_FEATURES_UNAVAILABLE`
ไม่ใช่ cold-start delay ที่ response สำเร็จแต่ช้า

**เหตุที่เลือก elapsed-time heuristic แทน `/api/ps` pre-check (D275):**

- Chat path เป็น non-streaming axios POST `/api/ai/chat` — flag จาก backend
  จะมาพร้อม response ตอนจบ สายเกินไปที่จะแสดงระหว่างรอ
- Endpoint `ai-vram-status` (ที่มี `loadedModels` จริงจาก `/api/ps`) เป็น
  admin-only ใช้กับ document chat ของ user ทั่วไปไม่ได้
- ADR-051 D2 อนุญาต "ตรวจจับผ่าน response time" อยู่แล้ว และ false positive
  (warm generation ที่ช้า) ทำให้ข้อความมีบริบทมากขึ้น ไม่ผิดพลาด

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | --------------- |
| `frontend/hooks/use-cold-start-hint.ts` (ใหม่) | Hook คืน `true` เมื่อ `isWaiting` ต่อเนื่องเกิน `delayMs` (default 5000ms) |
| `frontend/hooks/use-ai-chat.ts` | expose `isColdStartLikely` (ผูก `chatMutation.isPending`) |
| `frontend/components/ai/ai-chat-panel.tsx` | ส่ง `isColdStartLikely` ต่อให้ `AiChatMessages` |
| `frontend/components/ai/ai-chat-messages.tsx` | สลับ spinner text เป็น `t('ai.coldStart.hint')` ทั้ง streaming bubble และ trailing loading bubble |
| `frontend/app/(admin)/admin/ai/rag-playground/page.tsx` | แสดง hint ใต้ progress card เมื่อ sandbox job รอนาน |
| `frontend/public/locales/{th,en}/common.json` | เพิ่ม key `ai.coldStart.hint` |
| `frontend/hooks/__tests__/use-cold-start-hint.test.ts` (ใหม่) | 6 test cases (threshold, reset, custom delayMs) |
| `memory/project-memory-override.md` | ปิด Next Session Focus items + เพิ่ม D275 |

## กฎที่ Lock แล้ว

- **D275** — ADR-051 D2 cold-start UX ใช้ elapsed-time heuristic (frontend-only)
  ผ่าน `useColdStartHint` ไม่ใช้ `/api/ps` pre-check (เหตุผล: non-streaming
  response + admin-only vram-status endpoint); ยอมรับ false positive เพราะเป็น
  UX mitigation ไม่ใช่ root-cause fix

## Next Session Focus Cleanup Pass (ภายหลัง)

ทวน `- [ ]` ทั้งหมด ~101 รายการใน `project-memory-override.md`:

- **39 รายการ verify ผ่าน → ติ๊ก `[x]` ตรงนั้น** — commit/push ทั้งหมดอยู่บน `origin/main`
  (working tree clean), deploy ผ่าน CI แล้ว, `ai_status` enum มี `WAITING` (SHOW COLUMNS),
  `ocr_extraction` v3 active ใน `ai_prompts`, `backend/src/migrations/` ไม่มีอยู่จริง
  (ADR-044 compliant), session logs มีครบ
- **รายการเปิดที่เหลือรวมใน "🎯 Open Items" ใหม่** บนสุดของ Next Session Focus แบ่ง 3 กลุ่ม:
  A. Code/Tech Debt, B. Browser/Manual Verify, C. Ops/Infra — พร้อม note ว่า `[ ]` ที่ไม่อยู่
  ใน list นี้ถือ stale/เก็บเป็น history
- **Blocker สำคัญที่พบ:** `correspondences` table = 0 rows → RAG vector E2E + Re-Extract
  E2E + QC-0001/QC-0002 ทำไม่ได้จนกว่าจะมี test data

## Verification

- [x] vitest 18/18 ผ่าน (hook ใหม่ 6 + use-ai-chat 7 + ai-chat-panel 5)
- [x] `tsc --noEmit` ผ่าน
- [x] eslint ผ่าน (pre-commit `--fix` ไม่แก้อะไรเพิ่ม)
- [ ] Browser verify บน production — ทำได้เฉพาะเมื่อ cold-start เกิดจริง
      (ต้องให้ OCR batch รันค้างแล้วส่ง chat/RAG query ช่วงนั้น) หรือรอเกิดเอง
- [ ] Push — commit `aad114ab` บน branch `docs/next-session-focus`
      (รอ user รัน `2git.sh` หรือสั่ง merge)
