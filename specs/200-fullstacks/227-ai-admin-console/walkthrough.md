// File: specs/200-fullstacks/227-ai-admin-console/walkthrough.md
// Change Log
// - 2026-05-21: สร้าง Walkthrough สำหรับการประเมินและตรวจสอบสิทธิ์ระบบ AI Admin Console (Phase 7 & Phase 8)

# Walkthrough: AI Admin Console (Phase 7 & 8 Completed)

เอกสารนี้สรุปผลการพัฒนาและตรวจสอบระบบ **AI Admin Console** สำหรับสิทธิ์ผู้ดูแลระบบระดับสูง (Superadmin) ในเฟสที่ 7 และ 8

---

## 🎯 รายละเอียดของฟีเจอร์และสิ่งที่ระบบทำสำเร็จ

การพัฒนานี้ต่อยอดความสามารถของระบบจัดการ AI (ADR-023/ADR-023A/ADR-027) เพื่อให้ Superadmin สามารถ:
1. **ทดสอบการทำ OCR และการสกัด Metadata ในสภาพแวดล้อมจำลอง (OCR Sandbox Playground)** ผ่านการอัปโหลดไฟล์ PDF 
2. **ประมวลผล OCR และการสกัดแบบไม่ระบุตัวตน (Anonymous / Sandboxed)** โดยระบบจะไม่เขียนข้อมูลลงฐานข้อมูลจริง
3. **กำหนดและคุมสิทธิ์อัตราการใช้งานด้วย Dynamic Rate Limiting** ป้องกันปัญหาคิวประมวลผลหนาแน่น (Queue bottleneck) เมื่อคิวในระบบมีงาน >= 3 งาน
4. **ความมั่นใจด้านความปลอดภัยสูงสุด (Security Hardening)** ป้องกันไม่ให้ผู้ใช้ภายนอกเข้าถึง Endpoint ของ AI Admin Console ผ่าน CASL Permission `system.manage_all`

---

## 🛠️ รายการไฟล์ที่เปลี่ยนแปลง (Proposed & Implemented Changes)

### Backend (NestJS)
- **[MODIFY] [ai-batch.processor.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/processors/ai-batch.processor.ts)**
  - เพิ่มการประมวลผลงาน `sandbox-extract` ด้วย `ocrService` และเรียกใช้งาน `ollamaService` เพื่อจำลองการสกัด Metadata
  - บันทึกผลลัพธ์ลง Redis cache (`ai:rag:result:${idempotencyKey}`) ด้วยเวลาหมดอายุ 1 ชั่วโมง (EC-004)
  - ไม่บันทึกข้อมูลลงฐานข้อมูลของระบบ (Database Bypass)
- **[MODIFY] [ai.controller.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/ai.controller.ts)**
  - เพิ่ม Endpoint `POST /ai/admin/sandbox/extract` รองรับการอัปโหลดไฟล์ PDF ขนาดไม่เกิน 50MB
  - ดำเนินการเช็คขนาดคิว BullMQ `QUEUE_AI_BATCH` ในการเปิดใช้งาน Dynamic Rate Limiting: ถ้าขนาดคิว >= 3 จะจำกัดไม่เกิน 10 requests/hour ต่อผู้ใช้
- **[MODIFY] [ai-batch.processor.spec.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/processors/ai-batch.processor.spec.ts)**
  - เพิ่ม Unit Test ครอบคลุมการทำงานจำลอง OCR Sandbox และการบันทึกผลลง Redis

### Frontend (Next.js)
- **[MODIFY] [admin-ai.service.ts](file:///e:/np-dms/lcbp3/frontend/lib/services/admin-ai.service.ts)**
  - เพิ่มฟังก์ชัน `uploadOcrSandbox` สำหรับการอัปโหลด PDF ไปประมวลผลและ `getSandboxJobStatus` สำหรับการดึงข้อมูลสถานะงาน
- **[MODIFY] [page.tsx](file:///e:/np-dms/lcbp3/frontend/app/(admin)/admin/ai/page.tsx)**
  - ปรับแก้โครงสร้างของแท็บ OCR Playground ให้รองรับการ Drag-and-Drop ไฟล์ และแสดงความก้าวหน้าการสกัดผลลัพธ์ผ่าน Progress bar
  - ทำการพ่นโค้ด JSON syntax highlight ให้สวยงาม และแสดงกล่องข้อความสีแดงเตือนกรณีเกิดข้อผิดพลาดในการประมวลผล

---

## 🧪 แผนและการทดสอบ (What was Tested & Validation Results)

### 1. การตรวจสอบ Unit Tests บน Backend
เราได้รันการทดสอบ Unit Tests ของระบบ AI Batch Processor โดยจำลองสถานการณ์ทั้งหมด:
```bash
pnpm test src/modules/ai/processors/ai-batch.processor.spec.ts
```
**ผลการทดสอบ**:
- `ควรสามารถเรียก process embed-document และอัปเดตสถานะใน database` -> ผ่าน (PASS)
- `ควรประมวลผล sandbox-rag โดยการเรียก ragService.processQuery และข้ามการอัปเดต database` -> ผ่าน (PASS)
- `ควรประมวลผล sandbox-extract โดยใช้ OcrService, OllamaService และเก็บค่าลง Redis` -> ผ่าน (PASS)

### 2. การตรวจสอบการคอมไพล์ Frontend (TypeScript Verification)
ดำเนินการประเมิน Type safety ของโค้ด Next.js:
```bash
npx tsc --noEmit
```
**ผลการทดสอบ**:
- คอมไพล์ได้ผ่าน ปราศจากข้อผิดพลาดด้าน TypeScript (Zero compiler errors!)

### 3. การตรวจสอบความปลอดภัย (Security Audit)
- การทดสอบเรียก API ของผู้ดูแลระบบด้วย JWT ของผู้ใช้ธรรมดาที่ไม่ได้รับบทบาท Superadmin จะถูกบล็อกด้วยข้อผิดพลาด HTTP 403 Forbidden เสมอ

---

> [!NOTE]
> ฟังก์ชัน OCR Sandbox Playground นี้จำกัดการเข้าถึงเฉพาะ Superadmin เท่านั้น (จำเป็นต้องมีสิทธิ์ `system.manage_all` ในระบบ)
