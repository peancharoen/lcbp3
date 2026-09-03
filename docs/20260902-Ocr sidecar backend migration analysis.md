# OCR Sidecar → Backend Migration Analysis

**Project:** LCBP3-DMS
**หัวข้อ:** แนวทางย้าย business logic / model lifecycle จาก OCR Sidecar ไปยัง NestJS Backend
**สถานะ:** ร่างแนวคิดเดิม — ผ่าน grill session 2026-09-02 แล้ว ดู §0 สำหรับผลตรวจสอบกับ ADR/โค้ดจริง

---

## 0. Verification Notes (Grill Session 2026-09-02)

เอกสารนี้เขียนขึ้นก่อนเห็น ADR-043 และ ADR-048 ฉบับเต็ม — ตรวจสอบกับ ADR จริง + โค้ดจริงแล้วพบว่ากรอบคำถามเดิมบางส่วนไม่ตรงกับสถาปัตยกรรมปัจจุบัน:

- **ADR-033 ไม่ใช่คำถามเปิดอีกต่อไป** — §7 (X-API-Key) ถูก supersede โดย ADR-040 (2026-07-30) ไปแล้ว; §2/§6 ยังใช้งานจริง ยืนยันโดย **ADR-043 (Accepted, 2026-08-03)** ซึ่งเป็น single source of truth ที่รวบ ADR-023/023A/033/034/035/036/040/041/042 — ควรอ้างอิง ADR-043 แทนการอ่าน ADR-033 เดี่ยวๆ
- **Engine routing (§1 ข้อ 2, §4) ไม่ใช่คำถามเปิดอีกต่อไป** — ADR-040 D1 ตัด engine selection เหลือ engine เดียว `np-dms-ocr`; ตัวเลือก Typhoon 2 ขนาดใน ADR-033 §4/§5 เป็น dead concept ในโค้ดปัจจุบัน (`ocr.service.ts` comment: "ADR-040 D1 — ยกเลิก engine selection")
- **กรอบคำถาม "ย้าย model lifecycle ทั้งก้อนไป backend" (§3-4) เป็น false dichotomy** — สถาปัตยกรรมปัจจุบันแยกสอง lifecycle คู่ขนานโดยตั้งใจอยู่แล้ว: backend คุม main LLM (`np-dms-ai`) เท่านั้น, sidecar คุม OCR residency ของตัวเองผ่าน `residency_policy.py` — locked เป็น decision แล้ว (memory D28: "backend ไม่ส่ง keep_alive, sidecar คำนวณเอง") และมี guard จริงในโค้ด sidecar (`app.py` raise HTTPException 3 จุดถ้า backend พยายามส่ง `keep_alive` override)
- **"Queue-aware scheduling" (§4 แถวที่ 2 ในตาราง "ย้ายมา Backend ได้") ยังเป็นคำถามเปิดจริง** — ตรวจสอบ ADR-048 (AI Engine Control Center, Proposed, 2026-08-24) แล้วพบว่า **ไม่ครอบคลุมเรื่องนี้**: ADR-048 D3 เป็นแค่ manual guard (บล็อก admin กดปุ่ม Load/Unload เองถ้า queue ไม่ว่าง) ไม่ใช่ automatic policy ที่ตัดสินใจ when/which ตาม queue priority ตามที่เอกสารนี้เสนอ — **ตัดสินใจแล้วว่าจะเปิด ADR ใหม่แยกต่างหาก** สำหรับ "Automatic Queue-Aware Model Scheduling" แทนการยัดเข้า ADR-048 (คนละ concern: ADR-048 = observability + manual control, เรื่องนี้ = automatic policy engine ที่ต้องแก้ `ai-batch.processor.ts` โดยตรง)

---

## 1. บริบท

แผนเดิม (Phase 3 ของ OCR sidecar refactor) ตั้งใจให้ sidecar เป็น **pure compute worker** เข้าถึงได้เฉพาะผ่าน internal Docker network โดยย้าย business logic ทั้งหมดไปที่ backend

อย่างไรก็ตาม พบว่ามี **ADR-033 (v1.9.8, มิถุนายน 2026)** — "Active Model & OCR Sandbox Management" ซึ่งดูเหมือนให้ sidecar คุม model lifecycle เองค่อนข้างเยอะ (synchronous verification, dynamic VRAM release, OOM fallback ผ่าน VramMonitor, X-API-Key protection, engine routing) ซึ่งอาจขัดกับวิสัยทัศน์ "sidecar = pure compute worker"

**⚠️ จุดที่ต้อง confirm กับทีม/ADR ตัวจริงก่อนเริ่มงาน:**
1. ADR-033 supersede แผน Phase 3 ไปแล้ว หรือเป็นคนละ scope กัน?
2. Engine routing (Typhoon/Tesseract) ควรอยู่ backend หรือ sidecar ตามดีไซน์ปัจจุบัน?

---

## 2. Business Logic ที่ย้ายไป Backend ได้ (ภาพรวม Phase 3)

| Logic | เหตุผล |
|---|---|
| Normalize input | ไม่เกี่ยวกับ GPU/โมเดล |
| Engine selection (Typhoon vs Tesseract) | เป็น policy — แต่ overlap กับ ADR-033 engine routing ต้อง confirm |
| Fast-path decisions | เป็นเงื่อนไข business |
| Page range calculation | ไม่ต้อง react ทันที |
| systemPrompt validation | ตรวจสอบก่อนส่งเข้าโมเดล |
| Auth (user-facing) | backend เป็นเจ้าของ RBAC/CASL อยู่แล้ว |

**สิ่งที่ไม่ควรย้าย:** การเรียก inference จริง (OCR/LLM call), VRAM/model lifecycle management ที่ timing-critical

---

## 3. Model Lifecycle Migration: ผลดี–ผลเสีย

### ผลดี
- **Single source of truth** — backend รู้ state โมเดลที่โหลดอยู่ที่เดียว ไม่ต้อง sync สอง service
- **เข้ากับ BullMQ 2-queue design** — ตัดสินใจสลับโมเดลร่วมกับ queue state (ai-realtime / ai-batch) ได้ในที่เดียว
- **RBAC/CASL integration** — ควบคุมสิทธิ์สั่งสลับโมเดลง่ายขึ้น
- **Testability/observability รวมศูนย์** — logic เป็น TypeScript, test ด้วย Vitest ได้ ไม่ต้อง maintain สองภาษา
- **สอดคล้องวิสัยทัศน์ Phase 3** — sidecar เหลือแค่ pure compute worker

### ผลเสีย
- **Latency เพิ่ม** — ทุกการตัดสินใจสลับโมเดลต้อง round-trip ข้าม Docker network
- **OOM fallback ตอบสนองช้าลง** ⚠️ ความเสี่ยงสูงสุด — OOM ต้องจัดการทันทีใกล้ GPU ถ้ารอ backend สั่งอาจ timeout ก่อน fallback ทำงานทัน
- **Race condition กับ state จริง** — VRAM/model state อยู่ใน sidecar process จริง ถ้า backend "คิดว่า" รู้ state แต่ sidecar เปลี่ยนไปแล้ว (crash, process อื่นแย่ง VRAM) จะเกิด desync ต้องมี reconciliation mechanism
- **ขัดกับ ADR-033 ที่เพิ่ง implement** — ถ้า ADR ตั้งใจให้ sidecar คุม lifecycle เองด้วยเหตุผล proximity ต่อ GPU การย้ายมา backend คือการ revert งานที่เพิ่งเสร็จ
- **X-API-Key auth ซ้อนทับ** — ต้องเคลียร์ trust boundary ระหว่าง backend↔sidecar ให้ชัด ไม่ให้เกิดช่องโหว่จาก logic ซ้อนสองที่

---

## 4. หลักการแบ่งงาน: "ความเร็วที่ต้องตอบสนอง"

> สิ่งที่ย้ายได้คือ **"ควรทำอะไร"** (decision/policy)
> สิ่งที่ต้องอยู่ sidecar คือ **"ทำยังไงตอนนี้เดี๋ยวนี้"** (execution/reaction)

Backend ส่ง intent เช่น `{ action: "switch_model", target: "gemma4:e4b" }` → sidecar execute + handle failure แบบ local เอง

### ย้ายมา Backend ได้ (policy/orchestration)

| รายการ | รายละเอียด |
|---|---|
| Model switch decision (when/which) | พิจารณา queue state, priority, เวลา |
| Queue-aware scheduling | เช่น ห้ามสลับโมเดลถ้า ai-realtime queue ยังค้าง — ต้องรู้ BullMQ state ทั้งระบบ |
| RBAC/authorization สำหรับสั่ง switch model | ใช้ CASL ที่ backend |
| Audit logging / history การสลับโมเดล | เก็บใน MariaDB |
| Retry/backoff policy ระดับสูง | circuit-break ทั้ง endpoint เมื่อ error ติดกัน |
| Notification/alerting | ผ่าน n8n/LINE เมื่อ OOM/fallback ผิดปกติ (after-the-fact) |
| Config/threshold management | VRAM threshold กำหนดจาก env/DB ที่ backend ส่งให้ sidecar ใช้ |

### ต้องอยู่ Sidecar ต่อ (ต้อง react ทันที, ใกล้ GPU)

| รายการ | เหตุผล |
|---|---|
| OOM detection + immediate fallback | ต้องเกิดในโปรเซสเดียวกับ GPU memory จริง |
| Dynamic VRAM release (`keep_alive:0` หลังโหลดโมเดลใหม่) | timing-critical, synchronous กับ Ollama call |
| Synchronous LLM verification ก่อนสลับจริง | ต้องรอผล Ollama โดยตรง |
| VramMonitor | ต้อง poll/monitor local resource แบบ tight loop |
| X-API-Key validation สำหรับ inference call | transport-layer guard เฉพาะของ sidecar |

---

## 5. Next Steps

- [x] ~~ขอ/อ่าน ADR-033 ฉบับเต็ม~~ — อ่านแล้ว, superseded บางส่วนโดย ADR-040, ยังใช้งานอยู่บางส่วนตาม ADR-043 (ดู §0)
- [x] ~~ยืนยันว่า Phase 3 กับ ADR-033 เป็นแผนคนละ scope หรือ ADR-033 supersede~~ — ตอบแล้วใน §0; อ้างอิง ADR-043 แทน ADR-033 ในงานต่อไป
- [x] ~~ตัดสินใจ engine routing (Typhoon/Tesseract) ว่าอยู่ backend หรือ sidecar~~ — ไม่มี multi-engine ให้ route แล้ว (ADR-040 D1, engine เดียว `np-dms-ocr`)
- [x] เปิด ADR ใหม่แล้ว — [ADR-051: Automatic Queue-Aware Model Scheduling](../specs/06-Decision-Records/ADR-051-automatic-queue-aware-model-scheduling.md) (Draft, ยังไม่มี Decision Outcome — ต้อง grill ต่อ 4 คำถามเปิดใน Considered Options)
- [ ] พิจารณา reconciliation mechanism สำหรับ state desync ถ้า ADR ใหม่ตัดสินใจให้ backend มีส่วนรู้ queue state ระหว่างการสลับโมเดล (ความเสี่ยงเดิมใน §3 ยังใช้ได้: backend "คิดว่า" รู้ state แต่ sidecar อาจเปลี่ยนไปแล้วจาก local OOM event)
