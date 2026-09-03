# Session — 2026-09-03 (Grill-with-Docs: OCR Sidecar Migration Analysis → ADR-051)

## Summary

Grill session บนดราฟท์แนวคิด `docs/20260902-Ocr sidecar backend migration analysis.md` — พบว่ากรอบคำถามเดิม ("ย้าย model lifecycle ทั้งก้อนไป backend") ล้าสมัยเพราะไม่เคยอ้างอิง ADR-043/ADR-048 คำถามที่เหลือเปิดจริงคือ "Automatic Queue-Aware Model Scheduling" ซึ่งเปิด ADR-051 ใหม่แยกจาก ADR-048 (Control Center)

## สิ่งที่ตรวจพบระหว่าง grill

- ADR-033 §7 (X-API-Key) superseded โดย ADR-040 ไปแล้ว; §2/§6 ยังใช้งานจริงตาม ADR-043 (Accepted, single source of truth ที่ดราฟท์ไม่เคยอ้างถึง)
- Engine routing (Typhoon/Tesseract dropdown) เป็น dead concept แล้ว — ADR-040 D1 เหลือ engine เดียว `np-dms-ocr`
- "ย้าย model lifecycle ทั้งก้อน" เป็น false dichotomy — สถาปัตยกรรมปัจจุบันแยก 2 lifecycle คู่ขนานโดยตั้งใจอยู่แล้ว (backend คุม main LLM, sidecar คุม OCR residency เอง, ห้าม backend override — มี guard จริงในโค้ด sidecar 3 จุด)
- ADR-048 D3 เป็นแค่ manual admin guard (block ปุ่ม Load/Unload ถ้า queue ไม่ว่าง) **ไม่ใช่** automatic queue-aware scheduling ตามที่ดราฟท์เสนอ — คนละ concern
- ตรวจโค้ดพบ **`ai-realtime.processor.ts` มี auto-pause/resume mechanism อยู่แล้ว** (`onActive`→pause ai-batch, `onCompleted`/`onFailed`→resume) มาตั้งแต่ 2026-05-16 (`docs/cross-spec/bullmq-coordination.md`) แต่ไม่เคยถูก formalize เป็น ADR — ตอบโจทย์ "ห้ามสลับโมเดลถ้า ai-realtime ยังค้าง" ไปเกือบหมดแล้วโดยไม่ต้องออกแบบใหม่

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `docs/20260902-Ocr sidecar backend migration analysis.md` | เพิ่ม §0 Verification Notes, อัปเดต §5 Next Steps ให้ชี้ไป ADR-043/ADR-051 |
| `specs/06-Decision-Records/ADR-051-automatic-queue-aware-model-scheduling.md` | สร้างใหม่ — Accepted; ratify pause/resume mechanism เดิม, ยอมรับ residual mid-flight race พร้อม UX mitigation (loading message), ไม่มี bypass สำหรับ batch งานใหญ่; เพิ่ม Known Issues section (ai-ingest/veto-notifications queue ไม่มี consumer — พบระหว่างตรวจ ไม่ได้แก้) |
| `docs/cross-spec/bullmq-coordination.md` | รีเฟรชทั้งไฟล์ให้ตรงโค้ดจริง — แก้ชื่อ queue ผิด (`rfa-reminders`→`reminders` ฯลฯ), ลบ "Priority Strategy" ที่ผิดหลักเทคนิค (BullMQ priority ไม่ข้าม queue), แก้ concurrency ai-realtime (1→2), เพิ่ม cross-reference ไป ADR-051 |

## กฎที่ Lock แล้ว

- **D260** — ADR-051: automatic queue-aware model scheduling = pause/resume ที่มีอยู่แล้วใน `ai-realtime.processor.ts` (ratified, ไม่ใช่ mechanism ใหม่); residual race window ระหว่าง unload→reload ยอมรับความเสี่ยง ใช้ UX loading message แทนการปิดด้วย cross-process lock

## Verification

- [x] ADR-051 เขียน Decision Outcome ครบ (D1-D3), Status: Accepted
- [ ] Implement UX loading message (ADR-051 D2) — ยังไม่ได้ทำ
- [ ] ตรวจสอบ `ai-ingest`/`veto-notifications` queue ไม่มี consumer — ยังไม่ได้ทำ (tracked ใน ADR-051 Known Issues)
