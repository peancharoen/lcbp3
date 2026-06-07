# Session 11 — 2026-05-30 (Typhoon OCR & LLM Integration)

## Summary

ออกแบบและพัฒนาการใช้งานโมเดลภาษาไทยผสมอังกฤษ Typhoon OCR-3B ร่วมกับ Tesseract OCR แบบ Dynamic พร้อมระบบ caching 24 ชม., VRAM Monitor ป้องกัน GPU OOM และระบบ fallback 5s เมื่อโมเดลมีปัญหา และการสลับและบริหารจัดการ LLM โมเดลหลักแบบ Dynamic ในระบบ AI Model Management ของ Next.js frontend ตามข้อกำหนด ADR-032

## Backend Changes (B1-B5)

- **OcrService**:
  - เพิ่ม dynamic OCR engine selection (`getOcrEngines()`, `selectOcrEngine()`, `getActiveEngineId()`) จัดเก็บสถานะหลักใน DB `system_settings` (`OCR_ACTIVE_ENGINE`) พร้อม cache ใน Redis 30s ป้องกันคิวรีซ้ำซ้อน
  - ปรับปรุง `detectAndExtract()` ให้เลือกใช้ engine ที่เหมาะสม หากผู้ใช้เลือก Typhoon OCR-3B จะทำงานผ่าน `processWithTyphoon()` ร่วมกับ `OcrCacheService` (24-hour Redis caching) และ `VramMonitorService` (ตรวจสอบ VRAM capacity > 4GB ก่อนโหลดโมเดล)
  - พัฒนาระบบ **Graceful Fallback** ไปยัง Tesseract OCR ในเวลา 5 วินาทีหาก Typhoon ขัดข้องหรือ VRAM ไม่เพียงพอ โดยมีการบันทึกรายละเอียดและ error ลง `ai_audit_logs`
- **AiService**:
  - เพิ่ม endpoints สำหรับ AI Model Management: `GET /models`, `POST /models` (Superadmin), `PATCH /models/:modelId/activate` และ `GET /vram/status` (Used/Free VRAM และ Active models บน GPU) ร่วมกับ `AiSettingsService` และ `VramMonitorService`
  - ตรวจสอบความปลอดภัย VRAM ก่อนอนุญาตให้สลับโมเดลหลัก หากเหลือพื้นที่หน่วยความจำ GPU ไม่พอ จะโยน `BusinessException` แจ้งเตือนภาษาไทยพร้อมบันทึกลง Audit Log และระงับการเปลี่ยนโมเดลทันที
  - แก้ไขข้อผิดพลาด build error ใน `ai.service.ts` โดยการนำเข้า `OllamaService` และ `AiQdrantService` ที่ขาดหายไปใน constructor

## Frontend Changes (F1-F3)

- **admin-ai.service.ts**: เพิ่ม interface `LoadedModelInfo` และ `VramStatusResponse` และเพิ่ม methods `getVramStatus()`, `getAvailableModels()`, `setActiveModel()`, และ `addModel()` โดยใช้ dynamic path ที่อ้างอิง UUIDv7 (`modelId`) และส่ง idempotency headers ตาม ADR-019/ADR-016
- **admin/ai/page.tsx**: อัปเดตหน้า AI Admin page โดยเพิ่ม **VRAM GPU Monitor Card** แบบ realtime (ดึงและสลับรีเฟรชผ่าน React Query ทุก 15s) แสดง Free/Used VRAM และ active models บน GPU และปรับปรุง UI ส่วน AI Model Management ให้สลับโมเดลหลักผ่าน UUIDv7 และแสดง VRAM requirements ของแต่ละโมเดลอย่างสวยงามพรีเมียม

## ADRs Update (ADR-023/023A)

- อัปเดต `ADR-023-unified-ai-architecture.md` (v1.2) และ `ADR-023A-unified-ai-architecture.md` (v1.3) เพื่อรับรองสถาปัตยกรรม dynamic Thai specialized models (Typhoon OCR & LLM) ภายใต้การควบคุมของ VRAM Monitor

## Verification

- Backend NestJS Build: ✅ Compile สำเร็จ 100% ปราศจาก Error (`npm run build` ใน backend)
- Frontend Next.js Build: ✅ Compile สำเร็จ 100% ปราศจาก Error (`npm run build` ใน frontend)
