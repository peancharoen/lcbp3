# Session — 2026-09-04 (OCR Residency Dead Code Cleanup + VRAM Management Display Fix)

## Summary

ต่อจาก Two-Phase Batch OCR/AI Extraction (D267) — user ถามว่า np-dms-ocr ยังค้างอยู่ตอน
np-dms-ai โหลดขึ้นมา ถูกต้องหรือไม่ (สังเกตจากพฤติกรรมจริงหลัง batch OCR phase) ตรวจสอบแล้ว
พบว่า**ถูกต้องตามดีไซน์** (ไม่ใช่บั๊ก) แต่ระหว่างตรวจสอบพบ dead code จริงใน `OcrService` +
พบ display bug ที่ทำให้หน้า `/admin/ai/system` (Ollama Engine & VRAM Management card) แสดงผล
ทำให้ user เข้าใจผิดว่า np-dms-ocr + np-dms-ai อาจเกิน VRAM — แก้ทั้งสองเรื่อง

## ปัญหาที่พบ (Root Cause)

### 1. `OcrService.calculateOcrResidency()` เป็น dead code

Method นี้คำนวณ `keep_alive` decision ทุกครั้งที่เรียก OCR แต่**ผลลัพธ์ไม่เคยถูกส่งไป sidecar
เลย** (ไม่มี `keepAlive` field ใน multipart form ที่ส่งไป `/ocr-upload`) เป็นโค้ดตกค้างจากก่อน
ADR-040 D4 ที่ย้าย authority การตัดสินใจ keep_alive ไปให้ sidecar เอง (`residency_policy.py`,
คำนวณจาก VRAM headroom ณ เวลา process จริง) — sidecar เองมี guard reject explicit keep_alive
จาก backend ด้วยซ้ำ (`raise HTTPException(400, "keep_alive is managed by OCR residency
policy")`) ยืนยันด้วย `git log -S` ว่า call site มีมาก่อน ADR-040 หลายเดือน ไม่เคยถูกลบทิ้ง

### 2. Ollama Engine & VRAM Management card แสดงผลทำให้เข้าใจผิด

- **"Active models: Main: X / OCR: Y"** ไม่ใช่ค่า live — คือ
  `ollamaService.getMainModelName()`/`getOcrModelName()` (ชื่อ model ที่ config ไว้จาก env)
  ไม่เคยเช็ค `/api/ps` เลย โชว์ทั้งคู่พร้อมกันตลอดเวลาเหมือนทั้งสอง model โหลดอยู่ใน GPU
  พร้อมกันเสมอ — ขัดกับดีไซน์ exclusive-GPU-access (D261/D267) ที่ตั้งใจให้สอง model
  แทบไม่โหลดพร้อมกันเลย ทำให้ user สงสัยว่ารวมกันเกิน VRAM
- **"Loaded on Ollama" badges** อ่านจาก `health.ollama.models` (poll ทุก 30s ผ่าน
  `useAiHealth`) ส่วนตาราง VRAM catalog อ่านจาก `vramStatus.loadedModels` (poll ทุก 15s
  ผ่าน query แยก) — สอง query independent คนละรอบเวลา สามารถโชว์ snapshot ไม่ตรงกันได้
  โดยเฉพาะตอนโมเดลกำลังสลับ (เช่นระหว่าง batch OCR phase)
- `vramStatus.lastUpdated` มีอยู่ใน type แต่ไม่เคยถูก render เลย — user ไม่มีทางรู้ว่าตัวเลข
  ที่เห็นเก่าไปกี่วินาที
- Header badge `X% VRAM` แยกจากตัวเลข used/total MB ในบอดี้การ์ด (คนละที่ในการ์ด)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/services/ocr.service.ts` | ลบ `calculateOcrResidency()` + 3 config field ที่ใช้เฉพาะ method นี้ (`vramHeadroomThresholdMb`/`ocrResidencyWindowSeconds`/`mainModelPressureThresholdMb`) + call site (ลด `getVramHeadroom()` query ที่ไม่จำเป็นทุก OCR call ไปด้วย) |
| `backend/src/modules/ai/interfaces/ocr-residency.interface.ts` | ลบไฟล์ทั้งหมด (ใช้เฉพาะ method ที่ลบไปแล้ว) |
| `backend/src/modules/ai/tests/ocr-residency.spec.ts` | ลบไฟล์ทั้งหมด (test 5 ตัว เทสเฉพาะ method ที่ลบไปแล้ว — ADR-035/US2 era) |
| `backend/.env.example` | ลบ `AI_VRAM_HEADROOM_THRESHOLD_MB`/`AI_GPU_MAIN_MODEL_PRESSURE_THRESHOLD_MB`/`AI_OCR_RESIDENCY_WINDOW_SECONDS` (backend ไม่อ่านแล้ว) + comment ชี้ไปที่ sidecar `.env.template` ที่ยังใช้ค่าไม่มี prefix จริง |
| `frontend/components/admin/ai/CombinedOllamaEngineCard.tsx` | (1) relabel "Active models" → "Configured models" + de-emphasize styling (2) "Loaded on Ollama" badges เปลี่ยนมาอ่าน `vramStatus.loadedModels` แทน `health.ollama.models` (3) เพิ่มแถว "อัปเดตล่าสุด" จาก `vramStatus.lastUpdated` (4) รวม header badge `X% VRAM` เข้ากับตัวเลข used/total ในบอดี้การ์ดเป็นบรรทัดเดียว |
| `frontend/app/(admin)/admin/ai/system/page.tsx` | relabel "Active Models:" → "Configured Models:" (badge เดียวกันปัญหาเดียวกันในหน้า System Toggle) |

## กฎที่ Lock แล้ว

- **D268 — np-dms-ocr ค้างใน GPU ตอน np-dms-ai reload เป็นพฤติกรรมที่ถูกต้อง (ไม่ใช่บั๊ก):**
  sidecar's `calculate_ocr_residency()` เห็นว่า VRAM headroom เหลือเยอะระหว่าง batch OCR
  phase (เพราะ BGE+main ถูก unload ไปแล้ว) จึงตั้ง `keep_alive=120s` ให้ np-dms-ocr เอง —
  ทำให้มันค้างข้าม document ใน loop (ดีต่อ performance, ลด reload เพิ่ม) ตอน main model
  reload กลับท้าย phase 1 อาจยังเห็น np-dms-ocr resident อยู่ในช่วง 120s นั้น — ปลอดภัยเพราะ
  ข้อจำกัด exclusive-GPU-access (D261) ครอบคลุมเฉพาะ **compute buffer ชั่วคราว ~9.3GB ระหว่าง
  active inference** ไม่ใช่ idle weight residency เฉยๆ (idle np-dms-ocr ~3-5GB + np-dms-ai
  ~3-4GB ยังเหลือ headroom เยอะจาก GPU 16GB) — พฤติกรรมนี้มีมาก่อน batch feature อยู่แล้ว
  (`detectAndExtract()` เดิมก็ทำแบบนี้) ไม่ใช่สิ่งที่ two-phase orchestrator เปลี่ยน
- **D269 — `OcrService.calculateOcrResidency()` ถูกลบแล้ว (dead code, ADR-040 D4 authority
  อยู่ที่ sidecar เท่านั้น):** ห้ามเพิ่ม logic คำนวณ/ส่ง `keep_alive` จาก backend ไปหา
  ocr-sidecar อีก — sidecar reject explicit `keep_alive` จาก backend อยู่แล้ว (guard ใน
  `app.py`) การตัดสินใจ residency ของ np-dms-ocr เป็นหน้าที่ sidecar's
  `residency_policy.py::calculate_ocr_residency()` แต่ผู้เดียวตาม ADR-040 D4
- **D270 — VRAM Management card ต้องอ่าน "โมเดลไหนโหลดอยู่จริง" จากแหล่งเดียว
  (`vramStatus.loadedModels`) เท่านั้น ห้ามผสมกับ `health.ollama.models`:** สอง query นี้
  poll คนละรอบเวลา (health 30s, vramStatus 15s) ผสมกันจะโชว์ snapshot ไม่ตรงกันได้ระหว่าง
  โมเดลกำลังสลับ — `health.activeModels.main/ocr` ก็ไม่ใช่ live state เช่นกัน (เป็นแค่ชื่อ
  model ที่ config ไว้จาก env) ต้อง label ว่า "Configured" ไม่ใช่ "Active" เสมอ

## Verification

- [x] Backend: `tsc --noEmit` + `eslint --max-warnings 0` — 0 errors (ไฟล์ที่แก้)
- [x] Backend: `pnpm exec jest src/modules/ai src/modules/migration` — 947/947 pass (952 −
      5 tests ของไฟล์ที่ลบ)
- [x] Frontend: `tsc --noEmit` + `eslint --max-warnings 0` — 0 errors (ไฟล์ที่แก้)
- [x] Frontend: `pnpm test --run` เต็ม suite — 997/997 pass (ไม่มี regression)
- [x] Frontend: `pnpm build` — สำเร็จ
- [x] Commit local ทีละหัวข้อ (D264) แล้ว squash + push ผ่าน `2git.sh` → `a8d562d4`
      (`ccf7676d..a8d562d4`)

## หมายเหตุสำหรับ session ถัดไป

- ไม่มีงานค้างจากหัวข้อนี้ — ทั้ง dead code cleanup และ display fix ครบและ push แล้ว
- Two-Phase Batch OCR/AI Extraction (D267) ยังเหลือ E2E manual verify (ต้องมี browser/live
  system access) ตามที่บันทึกไว้ก่อนหน้า
