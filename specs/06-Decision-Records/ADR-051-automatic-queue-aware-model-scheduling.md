<!-- File: specs/06-Decision-Records/ADR-051-automatic-queue-aware-model-scheduling.md -->
<!-- Change Log
- 2026-09-02: Created initial draft from grill-with-docs session on docs/20260902-Ocr sidecar backend migration analysis.md — scoped out of ADR-048 (Control Center) because it is an automatic policy engine concern, not a manual admin control concern.
- 2026-09-02: Grill session round 2 — discovered existing pause/resume mechanism in ai-realtime.processor.ts (undocumented since 2026-05-16, docs/cross-spec/bullmq-coordination.md) already implements most of what this ADR set out to design. Scope narrowed to: (a) ratifying that mechanism formally, (b) accepting one residual race window with UX mitigation, (c) no batch bypass. Decision Outcome written.
- 2026-09-02: Accepted. Added Known Issues (Out of Scope) section — QUEUE_AI_INGEST (`ai-ingest`) and QUEUE_VETO_NOTIFICATIONS (`veto-notifications`) have no `@Processor` consumer in current code, found while refreshing docs/cross-spec/bullmq-coordination.md against real queue.constants.ts. Unrelated to this ADR's scheduling decision but surfaced by the same investigation thread.
-->

# ADR-051: Automatic Queue-Aware Model Scheduling

**Status:** Accepted
**Date:** 2026-09-02
**Decision Makers:** Development Team
**Amends:** none (additive — formalizes existing `ai-realtime.processor.ts` behavior; one UX addition)
**Related Documents:**

- [ADR-033: Active Model & OCR Runner Management](./ADR-033-active-model-and-ocr-management.md) — §1/§6, synchronous pre-load + dynamic unload baseline
- [ADR-040: OCR Sidecar Refactor](./ADR-040-ocr-sidecar-refactor.md) — D4/D5, `calculate_ocr_residency()` (sidecar-owned)
- [ADR-043: AI Architecture — Current State](./ADR-043-ai-architecture-current-state.md) — §3.1/§3.3, backend/sidecar lifecycle split (source of truth)
- [ADR-048: AI Engine Control Center](./ADR-048-ai-engine-control-center.md) — D3, manual load/unload guard this ADR must not duplicate or conflict with
- [docs/cross-spec/bullmq-coordination.md](../../docs/cross-spec/bullmq-coordination.md) (2026-05-16) — original, never-formalized design of the pause/resume mechanism this ADR ratifies
- [Migration analysis draft (docs/20260902-Ocr sidecar backend migration analysis.md)](../../docs/20260902-Ocr%20sidecar%20backend%20migration%20analysis.md) — origin of this question, §0/§4/§5

---

## 🎯 Context and Problem Statement

`ai-batch.processor.ts` มี automatic model switching อยู่แล้ว (unload main → load OCR → generate → reload main) ที่ทำงานทุกครั้งที่มี `ocr-extract` job เอกสารวิเคราะห์ 20260902 ตั้งคำถามว่า switching นี้ควร "รู้จัก" priority ระหว่าง `ai-realtime` (งาน user รอ response) กับ `ai-batch` (งานเบื้องหลัง) ก่อนตัดสินใจสลับโมเดลหรือไม่ เพื่อไม่ให้ user โดน cold-start latency จาก batch job ที่แย่ง VRAM

**พบระหว่าง grill session ว่ากลไกนี้มีอยู่แล้วในโค้ด แต่ไม่เคยถูก formalize เป็น ADR:**

`ai-realtime.processor.ts` มี auto-pause/resume ตั้งแต่ 2026-05-16 (`docs/cross-spec/bullmq-coordination.md`, ไม่เคยอัปเดตเป็น ADR หรือบันทึกใน project memory):

```ts
@OnWorkerEvent('active')
async onActive(job) {
  if (++this.activeRealtimeJobs === 1) await this.aiBatchQueue.pause();
}
@OnWorkerEvent('completed') / @OnWorkerEvent('failed')
async onCompletedOrFailed(job) {
  if (--this.activeRealtimeJobs === 0) await this.aiBatchQueue.resume();
}
```

เมื่อมี realtime job active แม้แต่ตัวเดียว `ai-batch` (รวม `ocr-extract` ที่ trigger model switching) จะถูก `pause()` ไม่ให้หยิบ job ใหม่ — ตอบโจทย์ "ห้ามสลับโมเดลถ้า ai-realtime ยังค้าง" ของเอกสาร 20260902 ไปเกือบทั้งหมดแล้วโดยไม่ต้องออกแบบใหม่

**Gap ที่เหลือจริง (ไม่ถูกปิดโดยกลไกเดิม):** `pause()` หยุดแค่การหยิบ job **ใหม่** — ไม่ interrupt job ที่ dequeue ไปแล้วและกำลังรันอยู่ ถ้า `ocr-extract` เริ่ม unload main model ไปแล้ว (อยู่ระหว่างรอ `np-dms-ocr` generate ซึ่งอาจกินเวลาถึงหลักสิบวินาที ตาม incident 2026-08-29 ที่เจอ OCR ใช้เวลา >300s) แล้ว realtime job เข้ามาพอดีในช่วงนั้น — realtime job จะเจอ cold-start latency เต็มๆ เพราะ main model ไม่อยู่ใน VRAM

**สิ่งที่ ADR นี้ต้อง reconcile กับของเดิม (ห้ามขัดแย้ง):**
- ADR-043 §3.3 — backend ห้ามส่ง `keep_alive` override ไปยัง sidecar โดยตรง — ไม่เกี่ยวข้องกับ ADR นี้เพราะกลไก pause/resume ทำงานที่ระดับ BullMQ queue ไม่ใช่การสั่ง sidecar
- ADR-048 D3 — manual empty-queue guard (สำหรับปุ่ม admin) เป็นกลไกคนละชั้นกับ automatic pause/resume นี้ ไม่ทับซ้อนกัน

---

## ⚙️ Decision Drivers

- **User-facing latency protection:** งานใน `ai-realtime` ต้องไม่ถูกกระทบจาก VRAM contention ที่เกิดจาก `ai-batch` model switching
- **Minimal new complexity:** ถ้ากลไกเดิมตอบโจทย์ได้เกือบหมดแล้ว ไม่ควรสร้าง mechanism ใหม่ซ้อนทับ (เช่น enqueue-time guard เพิ่มเติม) โดยไม่มีเหตุผลจำเป็น
- **ไม่เพิ่ม race/desync risk ใหม่:** การปิด gap ที่เหลือด้วย cross-process lock (เช่น ทำ `activeRealtimeJobs` เป็น Redis-shared state) ต้องแลกกับ complexity และความเสี่ยง desync ถ้า backend รันหลาย instance — ต้องชั่งน้ำหนักกับขนาดจริงของปัญหา (window แคบ, ไม่ใช่ทุก request)

---

## 🔬 Considered Options (grill session 2026-09-02 — สรุปผล)

### 1. จุดที่ policy ควรบังคับใช้
**เลือก: ไม่ต้องเพิ่ม enforcement point ใหม่** — กลไก pause/resume ที่มีอยู่แล้วบังคับใช้ที่ "queue level" (BullMQ `pause()`/`resume()`) ซึ่งครอบคลุมทั้ง "ห้ามหยิบ job ใหม่" อยู่แล้วโดยธรรมชาติ ไม่ต้องเพิ่ม enqueue-time guard หรือ processor-time bounded-wait ตามที่เสนอไว้ตอนต้น session (retracted — ซ้ำซ้อนกับของเดิม)

### 2. "ai-realtime ยังค้าง" วัดยังไง
**เลือก: คงเกณฑ์เดิม** — `activeRealtimeJobs > 0` (in-memory counter, blanket ทุก job type รวม lightweight) ไม่ต้องเพิ่ม threshold หรือแยกตาม job type ตอนนี้ เพราะ `intent-classify`/`tool-suggest` เป็น stub ที่ยังไม่เรียก Ollama จริง (ไม่มีผลเสียจาก over-conservative pause) — **หมายเหตุสำหรับอนาคต:** เมื่อ intent classifier ถูก implement จริงตาม Pattern-First/LLM-Fallback design ต้องกลับมาแยก logic (pause เฉพาะตอนเข้า LLM Fallback path ไม่ใช่ทุกครั้งที่ job active) แต่ไม่ใช่ scope ของ ADR นี้

### 3. ai-batch job ที่ถูก "ชะลอ" เกิดอะไรขึ้น
**ตอบแล้วโดยปริยายจากข้อ 1:** BullMQ `pause()` เก็บ job ไว้ใน `waiting` state ตามปกติจนกว่าจะ `resume()` — ไม่ต้องมี retry/backoff/timeout พิเศษเพิ่มเติม ไม่กิน `attempts` budget เดิม

### 4. Bypass สำหรับ batch งานใหญ่ (เช่น Migration)
**เลือก: ไม่มี bypass** — ทุก `ai-batch` job ผ่าน pause/resume coordination เดียวกันหมด ไม่แยกเคส เหตุผล: งาน batch ขนาดใหญ่ที่ต้องการความเร็วสูงสุดแบบไม่ถูกขัดจังหวะมี ADR-048 D3 (manual Load/Unload ผ่าน Control Center) เป็นทางเลือก out-of-band ให้ admin สั่งเองอยู่แล้ว ไม่จำเป็นต้องเพิ่ม flag ใหม่ในระบบ automatic policy

### Gap ที่เหลือ: mid-flight race ระหว่าง unload→reload
**เลือก: ยอมรับความเสี่ยง (accept) — ไม่ปิดด้วย cross-process lock** เหตุผล: window แคบ (เกิดเฉพาะช่วง `ocr-extract` กำลังรัน และบังเอิญมี realtime job มาพอดี), การปิดด้วย Redis-shared lock เพิ่ม complexity และความเสี่ยง desync ถ้า scale เป็นหลาย backend instance ในอนาคต ไม่คุ้มกับความถี่ของปัญหาจริง **มี mitigation ด้าน UX แทน** (ดู D2)

---

## 📌 Decision Outcome

**Chosen Option:** Ratify กลไก pause/resume ที่มีอยู่แล้วใน `ai-realtime.processor.ts` ให้เป็น official policy (ไม่เคยถูกบันทึกเป็น ADR มาก่อน) แทนการออกแบบ automatic queue-aware scheduling ใหม่ทั้งหมด, ยอมรับ residual race window พร้อม mitigation ด้าน UX, และไม่มี bypass สำหรับ batch งานใหญ่

### D1: Ratify Existing Pause/Resume as Automatic Queue-Aware Scheduling Policy

- `AiRealtimeProcessor.onActive()` / `onCompleted()` / `onFailed()` (มีอยู่แล้ว, ไม่ต้องแก้โค้ด) เป็น **official mechanism** ที่ตอบคำถาม "เมื่อไหร่ควรให้ ai-batch สลับโมเดล" — ai-batch ถูก pause ทุกครั้งที่มี ai-realtime job active แม้แต่ 1 job, resume เมื่อ realtime queue กลับมาว่าง
- ไม่มีการเพิ่ม enqueue-time guard, processor-time bounded-wait, หรือ threshold ใหม่ใดๆ
- อัปเดต `docs/cross-spec/bullmq-coordination.md` ให้ชี้กลับมาที่ ADR นี้ (เดิมไม่มี ADR อ้างอิง)

### D2: Accept Residual Mid-Flight Race — Mitigate with UX Loading Message

- **ไม่แก้ด้วย cross-process lock** — คง `activeRealtimeJobs` เป็น in-memory counter ต่อ instance ตามเดิม
- **Mitigation:** เมื่อ `ai-realtime` job (`ai-suggest`/`rag-query`) ต้องรอ Ollama cold-start (ตรวจจับผ่าน response time หรือ Ollama `/api/ps` ก่อน generate) ให้ frontend แสดงข้อความ เช่น _"ระบบกำลังเตรียมโมเดล AI กรุณารอสักครู่ (5-15 วินาที)"_ แทนการปล่อยให้ user เห็น loading spinner เฉยๆ โดยไม่มีบริบท — รายละเอียด UI/endpoint ที่ใช้ตรวจจับ cold-start เป็น implementation detail ที่ต้องออกแบบตอน implement (ไม่ fix ใน ADR นี้)

### D3: No Bypass for Large Batch Jobs

- ทุก `ai-batch` job (รวม `migrate-document`, `ocr-extract`) ผ่าน pause/resume coordination เดียวกันหมด ไม่มี flag แยก
- Admin ที่ต้องการรัน batch ขนาดใหญ่โดยไม่ถูกขัดจังหวะ ใช้ ADR-048 D3 (manual VRAM Load/Unload ผ่าน Control Center) เป็นทางเลือกแทน

---

## 🔍 Impact Analysis

| Component | Level | Impact | Required Action |
| :--- | :--- | :--- | :--- |
| `ai-realtime.processor.ts` | 🟢 Low | ไม่มีการแก้โค้ด — แค่ ratify behavior เดิม | ไม่มี |
| `docs/cross-spec/bullmq-coordination.md` | 🟢 Low | เพิ่ม reference กลับมา ADR-051 | แก้ 1 บรรทัด |
| Frontend (AI suggestion/RAG UI) | 🟡 Medium | เพิ่ม loading message สำหรับ cold-start scenario | เพิ่ม UI state + คำอธิบาย |
| `ai.service.ts` / realtime response path | 🟡 Medium | ต้องมีทางตรวจจับว่า response กำลังช้าเพราะ cold-start เพื่อ trigger message | ออกแบบตอน implement |

---

## 📋 Consequences

### Positive
1. ✅ ไม่ต้องสร้าง mechanism ใหม่ — ใช้ของที่มีอยู่แล้วและทำงานถูกต้องเป็นส่วนใหญ่
2. ✅ Formalize undocumented behavior ที่ไม่มีใครรู้ที่มาไว้เป็น ADR — ป้องกันการถูกแก้ทิ้งโดยไม่ตั้งใจในอนาคต
3. ✅ ไม่เพิ่ม race/desync risk ใหม่จาก cross-process locking ที่ไม่จำเป็น

### Negative
1. ❌ Residual race window ยังอยู่ — user อาจเจอ cold-start latency เป็นครั้งคราวระหว่าง OCR job กำลังรัน (mitigated ด้วย UX message ไม่ใช่แก้ที่ root cause)
2. ❌ Blanket pause สำหรับทุก realtime job type (รวม lightweight stub) ยังไม่ optimal เชิงทฤษฎี แต่ไม่มีผลจริงตอนนี้

---

## ⚠️ Known Issues Found During Investigation (Out of Scope for This ADR)

Discovered while refreshing `docs/cross-spec/bullmq-coordination.md` against actual `queue.constants.ts` as part of the same investigation thread — **not fixed here, tracked for follow-up:**

- **`QUEUE_AI_INGEST` (`ai-ingest`)** — registered as a queue (`ai.module.ts`) and enqueued via `AiQueueService.enqueueIngest()`, but no `@Processor(QUEUE_AI_INGEST)` consumer exists anywhere in the current codebase. Jobs sent here sit in `waiting` indefinitely.
- **`QUEUE_VETO_NOTIFICATIONS` (`veto-notifications`)** — registered in `review-team.module.ts`, same gap: no consumer found.

Neither is related to model switching or GPU coordination, so fixing them is out of scope for ADR-051. Flagged here so the gap isn't lost — needs a separate investigation to confirm whether these are genuinely dead code paths (candidates for removal, similar to D161's `migration_logs` cleanup) or a missing consumer that should be implemented.

---

## Version History

| Version | Date       | Changes                                                                 | Status |
| ------- | ---------- | ------------------------------------------------------------------------ | ------ |
| 1.0     | 2026-09-02 | Accepted. Added Known Issues (Out of Scope) section for `ai-ingest`/`veto-notifications` missing consumers | Accepted |
| 0.2     | 2026-09-02 | Grill round 2 — discovered existing pause/resume mechanism, narrowed scope, wrote Decision Outcome (D1-D3), accepted residual race with UX mitigation, no batch bypass | Proposed |
| 0.1     | 2026-09-02 | Initial draft — Context/Problem/Decision Drivers only | Draft |
