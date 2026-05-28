# Walkthrough: Context-Aware Prompt Templates & Database Typo CC Cleanup

โปรเจกต์ได้รับการดำเนินการอิมพลีเมนต์คุณสมบัติ Context-Aware Prompt Templates (ADR-030) และล้างข้อมูลช่องว่างในประเภทผู้รับ CC ('CC ') ได้สำเร็จลุล่วง 100% พร้อมผ่านการทดสอบและการตรวจสอบประเภทอย่างสมบูรณ์แบบ

## การเปลี่ยนแปลงหลัก (Changes Made)

### 1. Database & Schema Alignment (ADR-009)
- **[Modify] [schema-02-tables.sql](file:///e:/np-dms/lcbp3/specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql)**
  - แก้ไขบรรทัดที่ 338 ของโครงสร้างตารางหลักเพื่อล้างช่องว่างของ ENUM: จาก `ENUM('TO', 'CC ')` เป็น `ENUM('TO', 'CC')`
- **[NEW] [2026-05-27-add-context-aware-prompts-and-cleanup.sql](file:///e:/np-dms/lcbp3/specs/03-Data-and-Storage/deltas/2026-05-27-add-context-aware-prompts-and-cleanup.sql)**
  - คำสั่ง SQL Delta สำหรับปรับปรุงข้อมูล CC เก่า ลบช่องว่าง และเพิ่มฟิลด์ `context_config` JSON ในตาราง `ai_prompts` รวมถึงการ Seed Prompt ภาษาไทยเวอร์ชัน 2
- **[NEW] [2026-05-27-add-context-aware-prompts-and-cleanup.rollback.sql](file:///e:/np-dms/lcbp3/specs/03-Data-and-Storage/deltas/2026-05-27-add-context-aware-prompts-and-cleanup.rollback.sql)**
  - คำสั่งสำหรับย้อนกลับ Schema และข้อมูลในกรณีที่มีการถอยทัพ

### 2. Backend Modules & Entities Update (ADR-030)
- **[Modify] [ai-prompts.entity.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/prompts/ai-prompts.entity.ts)**
  - เพิ่มคอลัมน์ `contextConfig` และทำการแมปลงฐานข้อมูล
- **[Modify] [create-ai-prompt.dto.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/prompts/dto/create-ai-prompt.dto.ts)** / **[ai-prompt-response.dto.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/prompts/dto/ai-prompt-response.dto.ts)**
  - รองรับฟิลด์ `contextConfig` สำหรับการป้อนข้อมูลและแสดงผลลัพธ์
- **[Modify] [ai-prompts.service.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/prompts/ai-prompts.service.ts)**
  - เพิ่มฟังก์ชัน `resolveContext()` เพื่อสกัดและเตรียม Master Data (Projects, Organizations, Disciplines, CorrespondenceTypes, Tags) สอดคล้องกับ filter คอนฟิกใน template
  - บังคับใช้ **Gatekeeper Security Rule** ด้วยการโยน `ForbiddenException` ทันทีที่พบการพยายามร้องขอ override project UUID นอกขอบเขตของโครงการที่ผูกไว้ใน prompt template
- **[Modify] [ai-batch.processor.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/processors/ai-batch.processor.ts)**
  - ปรับการดึงข้อมูล `master_data_context` ไปแมปใน OCR Prompt เอนจิ้นอย่างไดนามิก
  - ปรับการวิเคราะห์ผลลัพธ์ JSON ของ AI รองรับโครงสร้างผู้รับเอกสารแบบใหม่เป็น Object Array เพื่อความเสถียรและทนทานของข้อมูล
- **[Modify] [ai-batch.processor.spec.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/processors/ai-batch.processor.spec.ts)**
  - เพิ่มการ Mock เมธอด `getActive` และ `resolveContext` เพื่อป้องกันปัญหา `TypeError` ใน unit tests

### 3. Frontend Alignment
- **[Verify] [detail.tsx](file:///e:/np-dms/lcbp3/frontend/components/correspondences/detail.tsx)**
  - ยืนยันการใช้งานฟังก์ชัน `normalizeRecipientType` ซึ่งครอบคลุมการล้างช่องว่างจากการกรองผู้รับ TO/CC ได้อย่างมีประสิทธิภาพอยู่แล้ว

---

## ผลการทดสอบและการตรวจสอบ (Validation Results)

### 1. การตรวจสอบการ Compile ของโค้ด (Type Verification Build)
- รันคำสั่งตรวจสอบประเภทโค้ด Backend:
  ```powershell
  pnpm --filter backend build
  ```
- **ผลลัพธ์:** Compile สำเร็จ 100% ไม่มีข้อผิดพลาดด้าน TypeScript (Strict Mode Compliant)

### 2. ชุดการทดสอบระบบ (Jest Unit & Integration Test Suites)
- เพิ่มและปรับปรุงชุดการทดสอบใน:
  - **[ai-prompts.service.spec.ts](file:///e:/np-dms/lcbp3/backend/src/modules/ai/prompts/ai-prompts.service.spec.ts)**: ครอบคลุมการทดสอบดึงข้อมูล context, โยน `NotFoundException` และการล็อคสิทธิ์ความปลอดภัยป้องกันการเจาะข้อมูลข้ามโครงการด้วย `ForbiddenException`
- รันชุดทดสอบทั้งหมดใน AI Module:
  ```powershell
  npm run test -- src/modules/ai/
  ```
- **ผลลัพธ์:**
  ```text
  Test Suites: 60 passed, 60 total
  Tests:       521 passed, 521 total
  Snapshots:   0 total
  Time:        50.15 s
  Ran all test suites.
  ```
  ผ่านการทดสอบทั้งหมด 100% ปราศจาก regression บัค!

---

## สรุปสถานะความเสถียร (Stability Summary)

การอิมพลีเมนต์คุณสมบัติตาม **ADR-030** และ ** whitespace cleanup ของ CC ** ได้รับการยอมรับผ่านกระบวนการตรวจสอบคุณภาพโค้ดระดับสูงของโปรเจกต์ DMS และพร้อมแล้วสำหรับการนำไปใช้งานจริงบนสภาพแวดล้อม QNAP Container Station และการเชื่อมต่อผ่าน n8n workflow ต่อไป
