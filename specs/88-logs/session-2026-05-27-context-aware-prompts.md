# Session 9 — 2026-05-27 (Context-Aware Prompt Templates & Database Typo CC Cleanup)

## Summary

ดำเนินการอิมพลีเมนต์ ADR-030 (Context-Aware Prompt Templates สำหรับการสกัดข้อมูลเอกสาร) และทำการแก้ไขบัคช่องว่างประเภทผู้รับ `'CC '` ในฐานข้อมูล

## Backend Changes (B1-B6)

- **AiPrompt Entity**: เพิ่มการแมปคอลัมน์ `contextConfig` ไปยัง JSON ฟิลด์ `context_config` ในฐานข้อมูลเพื่อควบคุม master data resolution
- **CreateAiPromptDto / Response DTO**: ปรับแต่งให้รองรับการรับและส่งออกคอลัมน์ `contextConfig`
- **AiPromptsService**:
  - อิมพลีเมนต์เมธอด `resolveContext()` สำหรับการดึงข้อมูล Master Data ดำเนินการคัดกรองข้อมูลอ้างอิงโครงการ (Projects, Organizations, Disciplines, CorrespondenceTypes, Tags) สอดคล้องกับ dynamic config filter
  - ติดตั้ง **Gatekeeper Rule** (ตัวกรองความปลอดภัย) โยน `ForbiddenException` ทันทีเมื่อมีการร้องขอ override project UUID ข้ามอาณาเขตโครงการที่กำหนดใน template เพื่อป้องกัน Cross-project data leak
- **AiBatchProcessor**:
  - ปรับปรุงโครงสร้าง `MigrateDocumentMetadata` interface, sandbox extraction, และ migration process ให้ดึงข้อมูลและแมป master data context-aware
  - สกัดและจำแนกผู้รับเอกสาร (recipients) ภายใต้โครงสร้าง JSON แบบใหม่ในรูป Object Array: `recipients: Array<{ organizationPublicId: string, recipientType: 'TO' | 'CC' }>` เพื่อความเสถียรและทนทานของข้อมูล
- **Unit Tests**:
  - เพิ่มชุดการทดสอบ `resolveContext` ใน `ai-prompts.service.spec.ts` ครอบคลุมการจำลอง master data resolution, การโยน `NotFoundException` และการล็อคสิทธิ์ความปลอดภัยด้วย `ForbiddenException` เมื่อ override โครงการข้าม boundary
  - แก้ไข mock dependencies ของ `AiPromptsService` ใน `ai-batch.processor.spec.ts` ป้องกันปัญหา `TypeError: getActive is not a function` ทำให้ผ่าน unit tests 100%

## Database & Schema Changes (ADR-009)

- **schema-02-tables.sql**: แก้ไข line 338 ปรับปรุง `ENUM('TO', 'CC ')` เป็น `ENUM('TO', 'CC')`
- **SQL Delta**: สร้าง `2026-05-27-add-context-aware-prompts-and-cleanup.sql` ดำเนินการ `UPDATE` ข้อมูลเก่าที่เป็น `'CC '` ให้เป็น `'CC'` เพื่อล้างช่องว่าง จากนั้นสั่ง `ALTER TABLE` ปรับปรุงฟิลด์ enum และ Seed template ภาษาไทยเวอร์ชัน 2
- **Rollback SQL**: สร้างไฟล์ย้อนกลับ `2026-05-27-add-context-aware-prompts-and-cleanup.rollback.sql` เรียบร้อย

## Frontend Changes

- **detail.tsx**: ตรวจสอบการใช้งาน `normalizeRecipientType` ซึ่งครอบคลุมการล้างช่องว่างและการกรองผู้รับ TO/CC ได้อย่างทนทาน

## Verification

- `pnpm --filter backend build` — ✅ Compile ผ่านแบบ Strict Mode
- unit tests AI module & backend suites — ✅ ผ่านทั้งหมด 60 suites / 521 tests
