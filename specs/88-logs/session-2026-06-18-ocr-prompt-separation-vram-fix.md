# Session — 2026-06-18 (OCR Prompt Separation + VRAM Monitor Fix)

## Summary

ตรวจสอบและแก้ไข frontend compliance ตาม spec 238 (OCR AI Prompt Separation) และแก้ไข VRAM Monitor ที่แสดงผลไม่ถูกต้อง

## ปัญหาที่พบ (Root Cause)

### 1. Feature 238 - OCR AI Prompt Separation
- **SandboxTabs ไม่ได้ส่ง active prompt version ที่ถูกต้อง** - ส่ง `selectedVersionNumber` แทนที่จะส่ง `activePromptVersion` ที่โหลดจาก service
- **SandboxTabs แสดง prompt info เฉพาะ ocr_system** - ไม่แสดง prompt info สำหรับทั้ง Step 1 (ocr_system) และ Step 2 (ocr_extraction) ตาม FR-009, FR-010

### 2. VRAM Monitor
- **GPU VRAM Usage แสดง 0/0 ตลอด** - Backend ส่ง `loadedModels` เป็น `string[]` (แค่ชื่อโมเดล) แต่ frontend ต้องการ `LoadedModelInfo[]` ที่มี `vramUsageMB`
- **ไม่แสดงโมเดลที่โหลดอยู่** - เนื่องจากข้อมูลไม่ครบถ้วน
- **ขึ้น "หน่วยความจำไม่เพียงพอ (OOM Guard)" เสมอ** - เนื่องจาก VRAM data ไม่ถูกต้อง

## การแก้ไข (Fix)

### Feature 238 - OCR AI Prompt Separation

| ไฟล์ | การเปลี่ยนแปลง |
| ----- | ------------------ |
| `frontend/components/admin/ai/SandboxTabs.tsx` | เปลี่ยนจากโหลด prompt เดียวเป็นโหลดทั้ง `ocr_system` และ `ocr_extraction` จาก service, แสดง prompt info ทั้ง 2 steps, ส่ง `activeExtractionVersion` ไปใน sandbox AI extract call |

### VRAM Monitor

| ไฟล์ | การเปลี่ยนแปลง |
| ----- | ------------------ |
| `backend/src/modules/ai/services/vram-monitor.service.ts` | เปลี่ยน `VramStatus.loadedModels` เป็น `Array<{modelId, modelName, vramUsageMB}>` และคำนวณ `vramUsageMB` จาก `size_vram` (bytes → MB) |
| `frontend/lib/services/admin-ai.service.ts` | อัปเดต `normalizeVramStatus()` ให้รองรับ format ใหม่ |
| `backend/src/modules/ai/tests/vram-monitor.service.spec.ts` | อัปเดต test expectations ให้ตรงกับ format ใหม่ |

## กฎที่ Lock แล้ว

- **SandboxTabs ต้องโหลด active prompts ทั้ง ocr_system และ ocr_extraction** จาก service เพื่อแสดง prompt info ทั้ง 2 steps ตาม FR-009, FR-010
- **Backend VRAM service ต้องส่ง loadedModels พร้อม vramUsageMB** เพื่อให้ frontend แสดงผล VRAM usage ของแต่ละ model ได้ถูกต้อง

## Verification

- [x] Frontend build ผ่าน
- [x] Backend build ผ่าน
- [x] SandboxTabs แสดง prompt info ทั้ง Step 1 และ Step 2
- [x] SandboxTabs ส่ง active prompt version ที่ถูกต้อง
- [x] VRAM Monitor ส่งข้อมูล format ใหม่ที่มี vramUsageMB
