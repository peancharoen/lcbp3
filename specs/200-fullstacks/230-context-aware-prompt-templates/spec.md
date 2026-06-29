# Feature Specification: Context-Aware Prompt Templates & Database Typo Cleanup

**Feature Branch**: `main`  
**Created**: 2026-05-27  
**Status**: Draft  
**Input**: User description: "/01-speckit.prepare E:\np-dms\lcbp3\specs\06-Decision-Records\ADR-030-context-aware-prompt-templates.md"

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OCR Metadata Extraction with Project Context (Priority: P1)

ในฐานะ **ผู้ดูแลระบบ (Admin) หรือระบบประมวลผล (Migration Bot)** 
ข้าพเจ้าต้องการสั่งให้ระบบสกัดข้อมูลจากไฟล์เอกสารโดยส่งข้อมูลอ้างอิงโครงการ (Master Data Context) ไปด้วย
เพื่อป้องกันไม่ให้ AI เกิดความสับสน และสกัดข้อมูลออกมาเป็นภาษาไทยได้อย่างถูกต้องตรงตามโครงการนั้นๆ

**Why this priority**:
นี่คือหัวใจหลักของแผนงานในการยกระดับคุณภาพของการสกัดและเชื่อมโยงเอกสารให้มีความถูกต้องแม่นยำสูงที่สุด และป้องกันการสกัดข้อมูลผิดพลาดเนื่องจากไม่มีบริบทของโครงการ (Master Data) มารองรับ

**Independent Test**:
รันคำสั่งสกัดเอกสารผ่าน Sandbox ในหน้า AI Admin Console หรือผ่าน REST Client โดยผูกกับโครงการเฉพาะ จากนั้นตรวจสอบว่าผลลัพธ์ JSON ที่ AI ส่งคืนมีค่า UUID ตรงกันกับ Master Data ใน DB

**Acceptance Scenarios**:

1. **Given** มีการผูกโครงการเฉพาะเจาะจงไว้ใน `context_config` ของ Prompt Template, **When** ระบบส่งคำสั่งสกัดข้อมูล (OCR Extraction) หา AI, **Then** AI จะได้รับ Prompt ภาษาไทยที่มีรายการ Master Data (Projects, Organizations, Tags) ที่ถูกคัดกรองเฉพาะโครงการนั้นสอดแทรกไปด้วย
2. **Given** ผลลัพธ์จากการสกัดข้อมูล, **When** AI คืนค่าผลลัพธ์มาในรูปแบบ JSON, **Then** ข้อมูลผู้รับ (Recipients) จะต้องมีลักษณะเป็น Object Array เสมอ `recipients: Array<{ organizationPublicId, recipientType }>` ป้องกันความยาว Array ไม่สัมพันธ์กัน

---

### User Story 2 - Cross-Project Data Isolation Safeguard (Priority: P2)

ในฐานะ **ผู้ดูแลความปลอดภัยระบบ (Security Administrator)**
ข้าพเจ้าต้องการให้ระบบเป็นผู้เฝ้าประตู (Gatekeeper) ตรวจสอบความปลอดภัยของการกรองข้อมูลโครงการ
เพื่อป้องกันช่องโหว่ความมั่นคงปลอดภัยและการเข้าถึงข้อมูลข้ามโครงการโดยมิได้รับอนุญาต (Cross-Project Data Leak)

**Why this priority**:
สอดคล้องกับกฎ Tier 1 - CRITICAL ในเรื่อง Data Isolation และ Security Boundary ของระบบ DMS โครงการภาครัฐ

**Independent Test**:
พยายามสั่งรัน API `/ai/ocr-extract` โดยระบุ Override Project ID เป็นโครงการอื่น ที่ต่างจากโครงการที่ผูกไว้ใน `context_config` ของ Prompt Template ที่กำหนดสิทธิ์เข้มงวด และตรวจสอบว่าระบบจะปฏิเสธการเข้าถึงและเกิด `ForbiddenException` ทันที

**Acceptance Scenarios**:

1. **Given** Prompt Template ตัวที่ใช้งานผูกกับโครงการ A ไว้อย่างชัดเจนใน `context_config`, **When** มี Request ส่งมาโดยพยายาม Override ค่าเป็นโครงการ B, **Then** ระบบจะปฏิเสธคำขอและคืนค่า `403 Forbidden` ทันที

---

### User Story 3 - Database Cleanup of Typo Whitespaces (Priority: P3)

ในฐานะ **วิศวกรข้อมูล (Data Engineer)**
ข้าพเจ้าต้องการให้ฐานข้อมูลเก็บประเภทผู้รับจดหมายแบบ CC เป็น `'CC'` (ไม่มีช่องว่าง) แทนที่จะเป็น `'CC '`
เพื่อตัดช่องโหว่การประมวลผลข้อมูลผิดพลาด และล้าง Typo ในฐานข้อมูลต้นทางอย่างหมดจด

**Why this priority**:
ช่วยในการล้างข้อผิดพลาด (Typo) ที่ต้นตอของระบบ ส่งผลดีต่อความสะอาดของข้อมูลและการกรองข้อมูลในระบบ Frontend ระยะยาว

**Independent Test**:
เรียกดูโครงสร้างและข้อมูลของตาราง `correspondence_recipients` หลังจากการรัน SQL Delta และตรวจสอบว่าค่า ENUM เป็น `'CC'` และไม่มีข้อมูลเดิมที่ค้างช่องว่างอยู่

**Acceptance Scenarios**:

1. **Given** มีความต้องการแก้ไขข้อผิดพลาดใน DB, **When** รัน SQL Delta, **Then** ค่า ENUM และข้อมูล CC เก่าจะถูกแปลงเป็น `'CC'` โดยสมบูรณ์ และไม่มีผลกระทบต่อ API detail page

---

### Edge Cases

- **กรณี AI สกัด Tags ออกมาแล้วไม่มีในระบบ:** Backend Service จะต้องทำตัวเป็นผู้จัดการความสอดคล้อง โดยตรวจสอบความสัมพันธ์ และทำการ Suggest เป็น Tag ที่สร้างขึ้นมาใหม่ (`isNew: true`)
- **กรณี UUID ของผู้ส่งหรือผู้รับที่ AI คืนมาไม่มีอยู่ใน Master Data:** ระบบจะกำหนดสถานะของงานนำเข้านั้นเป็น **Flagged** เพื่อเข้าสู่ `migration_review_queue` เสมอ เพื่อให้มนุษย์ดำเนินการตรวจสอบซ้ำ

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบ MUST เก็บโครงสร้าง `context_config` (JSON) เพิ่มเติมในตาราง `ai_prompts`
- **FR-002**: ระบบ MUST รองรับการคัดกรองข้อมูลอ้างอิงโครงการ (Master Data Context Filter) ตาม `context_config` ของ Prompt Template หรือตาม Override Parameters
- **FR-003**: ระบบ MUST ปฏิเสธการประมวลผล (Throw `ForbiddenException`) หากคำขอ Override Project ID ขัดแย้งกับข้อจำกัดใน `context_config` ของ Prompt Template
- **FR-004**: ระบบ MUST ทำการแปลงและจับคู่ (Map/Resolve) ข้อมูลผู้รับ (Recipients) ที่ได้จาก AI ในรูปแบบ Object Array และแปลง UUID string เป็น Primary Key ID ที่ถูกต้อง
- **FR-005**: ระบบ MUST มี SQL Delta ในการล้าง Typo จาก `'CC '` เป็น `'CC'` ทั้งในคอลัมน์และข้อมูลเดิมทั้งหมด

### Key Entities

- **AiPrompt (Entity)**:
  - `contextConfig`: JSON - เก็บข้อมูล Configuration สำหรับคัดกรอง Master Data เช่น projectId, contractId, pageSize, language, outputLanguage
- **CorrespondenceRecipient (Entity)**:
  - `recipientType`: ENUM('TO', 'CC') - ประเภทผู้รับที่ได้รับการแก้ไขโครงสร้างให้ถูกต้อง

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% ของการประมวลผล OCR Metadata Extraction ที่ผูกโครงการไว้ จะต้องไม่มีข้อมูล Master Data ของโครงการอื่นปะปนไปใน Context
- **SC-002**: การพยายาม Override สิทธิ์ข้ามโครงการจะต้องถูกสกัดและตรวจจับได้ 100% โดย Backend Security Guard (0% bypass rate)
- **SC-003**: 100% ของคำที่บันทึก CC จะต้องไม่มีช่องว่าง whitespace ท้ายคำ และทำงานร่วมกับ API ดั้งเดิมได้ปกติ
