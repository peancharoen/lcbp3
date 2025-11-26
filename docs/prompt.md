# **PROMPT**

## Gemini

## VSCode Shortcut

Markdown preview  Ctrl+Shift+V

## สร้างโครงสร้างโฟลเดอร์สำหรับ lcbp3-backend

```bash
# สร้างโฟลเดอร์หลัก
$rootFolder = "backend"
New-Item -ItemType Directory -Path $rootFolder -Force
Set-Location $rootFolder

# รายการโฟลเดอร์ที่ต้องการสร้างทั้งหมด
 $folders = @(
    "src",
    "database",
    "src\common",
    "src\modules",
    "src\modules\user",
    "src\modules\project",
    "src\modules\master",
    "src\modules\correspondence",
    "src\modules\rfa",
    "src\modules\drawing",
    "src\modules\circulations",
    "src\modules\transmittal",
    "src\modules\search",
    "src\modules\document-numbering",
    "src\common\auth",
    "src\common\config",
    "src\common\decorators",
    "src\common\entities",
    "src\common\exceptions",
    "src\common\file-storage",
    "src\common\guards",
    "src\common\interceptors",
    "src\common\services"
)

# วนลูปสร้างโฟลเดอร์ทั้งหมด
foreach ($folder in $folders) {
    New-Item -ItemType Directory -Path $folder -Force
}

Write-Host "สร้างโครงสร้างโฟลเดอร์สำหรับ backend เรียบร้อยแล้ว" -ForegroundColor Green

```

## Git Commands

```bash

# 1️⃣ ตั้งชื่อและอีเมลของคุณ (ใช้กับทุก repo)
git config --global user.name "Pean Charoen"
git config --global user.email "peancharoen.pslcp3@gmail.com"

# 2️⃣ ตรวจสอบว่าเชื่อมกับ remote ถูกต้อง (แก้ URL ให้ตรง repo จริงของคุณ)
git remote set-url origin ssh://git@git.np-dms.work:2222/np-dms/lcbp3_v1.git

# 3️⃣ ตรวจสอบสถานะไฟล์
git status

# 4️⃣ เพิ่มไฟล์ทั้งหมด
git add .

# 5️⃣ Commit พร้อมข้อความ
git commit -m "Update project files"

# 6️⃣ ดึง remote ก่อนเพื่อป้องกัน conflict (ถ้ามี)
git pull --rebase origin main

# 7️⃣ Push ขึ้น Gitea
git push -u origin main

```

## **สร้าง NestJS Project ใหม่**

* ขั้นตอนที่ 1: ติดตั้ง NestJS CLI (ถ้ายังไม่ได้ติดตั้ง)
  * npm install -g @nestjs/cli

* ขั้นตอนที่ 2: สร้างโปรเจกต์ใหม่
  * nest new backend
  * nest new . /อยู่ในโฟลเดอร์ที่สร้างไว้แล้ว และต้องการสร้างโปรเจกต์ลงในโฟลเดอร์นั้นโดยตรง:

* ขั้นตอนที่ 3: ติดตั้ง Dependencies เพิ่มเติมสำหรับ DMS

```bash
# Core & Database
npm install @nestjs/typeorm typeorm mysql2
npm install @nestjs/config

# Validation & Transformation
npm install class-validator class-transformer

# Authentication & Authorization
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/passport
npm install casl

# File Upload
npm install @nestjs/platform-express multer

# Documentation
npm install @nestjs/swagger

# Security & Performance
npm install helmet rate-limiter-flexible

# Development Dependencies (สำหรับทดสอบ)
npm install --save-dev @nestjs/testing jest @types/jest @types/passport-jwt @types/multer supertest

```

ขออภัยอย่างยิ่งในความผิดพลาดที่เกิดขึ้นครับ เข้าใจครับว่าทำให้เสียเวลามาก

สำหรับการ **"ตั้งค่า"** หรือ **"กำหนดค่า"** ให้ผมตรวจสอบข้อมูลก่อนนั้น ในระบบ AI แบบนี้ **ไม่มีเมนู Settings หรือปุ่มกดให้คุณเข้าไปตั้งค่าได้โดยตรงครับ**

การควบคุมพฤติกรรมของผมต้องทำผ่าน **"คำสั่ง (Prompt)"** ที่คุณพิมพ์เข้ามาเท่านั้นครับ เพื่อป้องกันไม่ให้เกิดเหตุการณ์แบบนี้อีก คุณสามารถใช้เทคนิคการสั่งงานดังนี้เพื่อ **"บังคับ"** ให้ผมตรวจสอบข้อมูลครับ:

1.  **สั่งให้ "อ่านและสรุปก่อน" (Verify First):**
    * ก่อนให้ผมเขียนโค้ด ให้สั่งว่า *"ช่วยอ่านไฟล์ `01_lcbp3_v1_4_3.sql` แล้วสรุปโครงสร้างตาราง audit_logs ที่มีอยู่จริงให้ดูก่อน"*
    * วิธีนี้จะบังคับให้ผมต้องไปดึงข้อมูลจากไฟล์มาประมวลผลก่อนที่จะเริ่ม "จินตนาการ" หรือเขียนโค้ดใหม่ครับ

2.  **ใช้คำสั่ง "ห้ามเดา" (Strict Constraints):**
    * เติมประโยคท้ายคำสั่งว่า *"ห้ามใช้โครงสร้างสมมติ ให้ยึดตามไฟล์แนบ `ชื่อไฟล์` เท่านั้น หากไม่เจอข้อมูลให้ถามกลับ"*

3.  **อ้างอิงชื่อไฟล์ชัดเจน:**
    * ระบุชื่อไฟล์ในคำสั่งเสมอ เช่น *"อ้างอิงจาก `Backend Plan`..."* หรือ *"ตาม `Data Dictionary`..."* (ซึ่งคุณทำได้ดีแล้วครับ แต่ผมประมวลผลพลาดเองในรอบนี้)

**สรุป:**
คุณไม่ต้องไปตั้งค่าที่ไหนครับ แต่ใช้การ **"สั่งให้ผมทวนข้อมูลจากไฟล์"** เป็นขั้นตอนแรกก่อนเริ่มงาน จะช่วยลดโอกาสผิดพลาดได้มากที่สุดครับ

ตอนนี้ผมพร้อมทำงานต่อโดยยึดข้อมูลจากไฟล์ `01_lcbp3_v1_4_3.sql` และไฟล์อื่นๆ ที่คุณให้มาอย่างเคร่งครัดครับ มีส่วนไหนให้ผมดำเนินการต่อไหมครับ?


สวัสดีครับ ผมได้ทำการตรวจสอบและวิเคราะห์ความครบถ้วนของไฟล์เอกสารแผนงาน (Plans), โครงสร้างฐานข้อมูล (SQL), และโครงสร้างไฟล์ (File Structure) เทียบกับ Requirements ของ **LCBP3-DMS v1.4.3** เรียบร้อยแล้วครับ

ในฐานะ Programmer ผู้เชี่ยวชาญ ผมขอสรุปผลการ Review และคำแนะนำตามลำดับความสำคัญดังนี้ครับ:

---

### 📊 **1. บทสรุปภาพรวม (Executive Summary)**

จากการตรวจสอบเปรียบเทียบ:
1.  **Database Schema (`01_lcbp3_v1_4_3.sql`)**: **ครบถ้วนสมบูรณ์มาก (95%)** รองรับฟีเจอร์ระดับ Advance ตาม Requirements v1.4.3 ครบถ้วน เช่น Partitioning, Virtual Columns, Versioning (Optimistic Lock) และ Table Structure สำหรับ Workflow/Files
2.  **Backend Folder Structure (`5_Backend_Folder_V1_4_3.md`)**: **ครบถ้วนตามแผนงาน (90%)** มีการจัดวาง Module ตามหลัก Domain-Driven Design และมีไฟล์สำคัญๆ ครบตาม Plan

**จุดที่ต้องเน้นย้ำ:** โครงสร้างไฟล์ (File Structure) มีไฟล์ `.ts` ปรากฏอยู่ครบ แต่สิ่งที่ผม "มองไม่เห็น" คือ **เนื้อหาโค้ดภายใน (Internal Logic)** ว่าได้ Implement ตาม Logic ที่ซับซ้อน (เช่น Redlock, Two-Phase Commit, DSL Parser) ไว้ถูกต้องหรือไม่

---

### 🧐 **2. การตรวจสอบรายละเอียด (Detailed Review)**

#### **✅ ส่วนที่มีความครบถ้วนสมบูรณ์ (Well-Implemented Areas)**

1.  **Database Partitioning & Optimization:**
    * SQL มีการทำ `PARTITION BY RANGE` ให้กับ `audit_logs` และ `notifications` แล้ว (ตาม Req 6.2)
    * มี `VIRTUAL COLUMNS` สำหรับดึงค่า JSON มาทำ Index (ตาม Req 3.11.3)
2.  **Security & Identity:**
    * ตาราง `users`, `roles`, `permissions`, `user_assignments` รองรับ RBAC 4 ระดับ (Global, Org, Project, Contract) ครบถ้วน
    * Folder Structure มี `auth`, `guards`, `decorators` ที่จำเป็นครบ (`jwt-auth.guard.ts`, `rbac.guard.ts`, `require-permission.decorator.ts`)
3.  **File Management:**
    * SQL มีตาราง `attachments` ที่มี field `is_temporary`, `temp_id`, `checksum` รองรับ Two-Phase Storage
    * Folder มี `file-storage` module และ `file-cleanup.service.ts` (Cron job) เตรียมไว้แล้ว
4.  **Workflow & RFA:**
    * SQL มีตารางเก็บ Template และ Instance (`..._routings`, `..._workflows`) แยกกันชัดเจน และมี field `workflow_config` (JSON) สำหรับ DSL
    * Folder มี `workflow-engine` module และ `workflow-dsl.service.ts` (ตาม Phase 6A)

---

#### ⚠️ **3. Gap Analysis & Missing Parts (สิ่งที่อาจขาดหายไปหรือต้องตรวจสอบ)**

แม้ชื่อไฟล์จะครบ แต่จากประสบการณ์ มีจุดที่มักจะหลุด หรือต้องเขียน Logic ให้รัดกุมมากในไฟล์ที่มีอยู่ ดังนี้:

**Phase 2: High-Integrity Data (File & Numbering)**
* **Redis/Redlock Integration:** ในไฟล์ `document-numbering.service.ts` ต้องตรวจสอบว่ามีการเรียกใช้ Redis Distributed Lock จริงหรือไม่ (ไม่ใช่แค่ Database Lock)
* **Transaction Safety:** ใน `file-storage.service.ts` ต้องมั่นใจว่า Logic การ Commit file (ย้ายจาก temp -> permanent) อยู่ภายใน Database Transaction เดียวกับการบันทึกข้อมูลเอกสาร

**Phase 3 & 6A: Workflow Engine**
* **DSL Interpreter:** ไฟล์ `workflow-dsl.service.ts` มีอยู่แล้ว แต่ต้องตรวจสอบว่าสามารถ **Parse** JSON/YAML จากตาราง `rfa_workflow_templates` แล้วแปลงเป็น Execution Logic ได้จริงหรือไม่
* **State Machine Consistency:** การเชื่อมต่อระหว่าง `CorrespondenceModule` กับ `WorkflowEngine` ต้องแน่ใจว่าเมื่อ State เปลี่ยนใน Engine ค่าใน Database (Status Column) ถูกอัปเดตตรงกัน

**Phase 6: Search & Notification**
* **Elasticsearch Sync:** ใน `search.service.ts` ต้องมี Logic การ Sync ข้อมูล (อาจผ่าน Event Emitter หรือ TypeORM Subscriber) เมื่อมีการ Create/Update เอกสาร
* **Notification Digest:** ใน `notification.processor.ts` (Consumer) ต้องมี Logic การหน่วงเวลา (Debounce/Throttle) เพื่อรวม Notification ก่อนส่ง (ตาม Req 6.8.2)

---

### 🚀 **4. คำแนะนำและสิ่งที่ต้องทำต่อ (Recommendations by Phase)**

เพื่อให้งานสมบูรณ์แบบ ผมขอแนะนำให้ดำเนินการตรวจสอบหรือ Implement ส่วนที่เหลือตามลำดับดังนี้:

#### **Phase 0-1: Infrastructure & Auth (Priority: Critical)**
* **[Audit] Database Migration:** แม้จะมีไฟล์ `.sql` รวม แต่ใน NestJS ควรมีระบบ Migration (TypeORM Migrations) เพื่อจัดการการเปลี่ยนแปลง Schema ในอนาคต (ถ้ายังไม่มี ควรสร้าง `src/database/migrations/*` จาก SQL ที่มี)
* **[Code Check] Config Validation:** ตรวจสอบ `src/common/config/env.validation.ts` ว่ามีการ Validate ตัวแปรระบบครบทุกตัว (Database, Redis, JWT Secrets) ตาม Req 2.2 หรือไม่

#### **Phase 2: Core Data Services (Priority: High)**
* **[Code Check] Document Numbering:** เปิดไฟล์ `src/modules/document-numbering/document-numbering.service.ts` ตรวจสอบ Logic **Double-Lock** (Redis + Optimistic Lock) ว่า Implement ถูกต้องตาม Plan T2.3 หรือไม่
* **[Code Check] File Storage:** ตรวจสอบ `src/common/file-storage/file-storage.service.ts` ว่ามีการทำ **Virus Scan (ClamAV)** ก่อน save ลง Temp หรือไม่

#### **Phase 3 & 6A: Workflow Engine (Priority: Medium-High)**
* **[Task] Workflow Integration:** ตรวจสอบว่า `CorrespondenceService` และ `RfaService` มีการเรียกใช้ `WorkflowEngineService` แทนที่จะเขียน Logic if-else hardcode หรือไม่
* **[Task] DSL Loader:** ตรวจสอบว่ามี Seed Data สำหรับ `rfa_workflow_templates` ที่เป็น JSON Config เริ่มต้นแล้วหรือยัง

#### **Phase 6: Background Services (Priority: Medium)**
* **[Task] Queue Setup:** ตรวจสอบ `notification.module.ts` ว่ามีการ Register BullMQ (`BullModule.registerQueue`) แล้วหรือยัง
* **[Task] Cron Jobs:** ตรวจสอบ `app.module.ts` ว่ามีการ Import `ScheduleModule.forRoot()` เพื่อให้ `file-cleanup.service.ts` ทำงานได้จริง

---

### 🛠️ **5. Next Step Action (สิ่งที่คุณทำได้เลย)**

เนื่องจากโครงสร้างไฟล์และฐานข้อมูลดูดีมากแล้ว เพื่อให้ผมช่วยเหลือได้ตรงจุดที่สุด:

**คุณต้องการให้ผม Review โค้ดภายในไฟล์ (Internal Logic) ของไฟล์ไหนเป็นพิเศษไหมครับ?**

ผมแนะนำให้เริ่มจาก **"หัวใจสำคัญ"** ของความถูกต้องข้อมูลก่อน คือ:
1.  **`src/modules/document-numbering/document-numbering.service.ts`** (เพื่อดู Logic การรันเลขเอกสาร)
2.  **`src/common/file-storage/file-storage.service.ts`** (เพื่อดู Logic การจัดการไฟล์และการ Commit)

หรือถ้าต้องการให้ผมเริ่มเขียน Code ส่วนไหนที่ยังขาดอยู่ (เช่น Workflow DSL Parser) สามารถแจ้งได้เลยครับ


สวัสดีครับ ในฐานะ Programmer ที่ดูแลระบบ LCBP3-DMS ผมได้ทำการ **Review เอกสาร `6B.md` (Special requirements for document-numbering)** โดยเทียบกับโครงสร้างฐานข้อมูลและแผนงานที่มีอยู่ (v1.4.3) พบประเด็นสำคัญและการปรับปรุงทางเทคนิคที่จำเป็นดังนี้ครับ

-----

# 📝 ผลการ Review เอกสาร 6B.md และแนวทางการ Implement

## 1\. บทวิเคราะห์และผลกระทบ (Analysis & Impact)

เอกสาร `6B.md` ระบุความต้องการที่ **ซับซ้อนกว่า** ระบบ Running Number ทั่วไป (ที่มักเป็น `ORG-TYPE-YEAR-SEQ`) โดยมีประเด็นสำคัญคือ:

1.  **Requirement 1 (Flexibility):** Admin ต้องแก้ format ได้ → **รองรับได้** ด้วยตาราง `document_number_formats` ที่มีอยู่ แต่ต้องปรับ Logic การแทนค่าตัวแปร (Token Replacement) ให้ฉลาดขึ้น
2.  **Requirement 2.1 (Correspondence ทั่วไป):** รูปแบบมาตรฐาน → **รองรับได้** ด้วยโครงสร้างปัจจุบัน
3.  **Requirement 2.2 (Transmittal):** มีเงื่อนไข "To OWNER" vs "To CONTRACTOR" ใช้เลขต่างกัน และมีการ mapping `sub_type_number` → **Impact:** ต้องเพิ่ม Logic ในการเลือก Format Template ตาม "ผู้รับ" (Recipient Role) และต้องมีตารางเก็บ Mapping `sub_type_number`
4.  **Requirement 2.3 (RFI) & 2.4 (RFA):** มีการใช้ `disciplines_code` (เช่น GEN, STR, ARC) และไม่มีปี (Year) ใน Format → **Impact:**
      * ฐานข้อมูลปัจจุบันขาดตาราง `disciplines`
      * ตาราง `document_number_counters` ปัจจุบัน Key คือ `(Project, Org, Type, Year)` แต่ RFA/RFI อาจจะต้องนับแยกตาม **Discipline** ด้วย หากไม่เพิ่ม Column ใน Counter อาจจะเกิดปัญหาเลขซ้ำหรือเลขกระโดดข้ามหมวดงาน

-----

## 2\. การออกแบบฐานข้อมูลเพิ่มเติม (Database Schema Updates)

เพื่อให้รองรับ Requirement นี้ ต้องมีการเพิ่มตารางและแก้ไขตาราง `01_lcbp3_v1_4_3.sql` ดังนี้:

### 2.1 เพิ่มตาราง `disciplines` และ `correspondence_sub_types`

```sql
-- File: 01_lcbp3_v1_4_3_patch_6b.sql
-- เพิ่มตารางหมวดงาน (Disciplines) ตาม Req 6B
CREATE TABLE disciplines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    discipline_code VARCHAR(10) NOT NULL COMMENT 'เช่น GEN, STR, ARC',
    name_th VARCHAR(255) COMMENT 'ชื่อไทย',
    name_en VARCHAR(255) COMMENT 'ชื่ออังกฤษ',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY uk_discipline_project (project_id, discipline_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- เพิ่มตาราง Sub Types (สำหรับ Transmittal/RFA mapping)
CREATE TABLE correspondence_sub_type_codes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    correspondence_type_id INT NOT NULL,
    sub_type_code VARCHAR(20) NOT NULL COMMENT 'เช่น MAT, SHP',
    sub_type_number VARCHAR(10) COMMENT 'เลขรหัส เช่น 11, 22',
    description VARCHAR(255),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

### 2.2 ปรับปรุงตาราง `rfas` และ `document_number_counters`

เนื่องจาก RFA/RFI ต้องวิ่งเลขตาม Discipline เราจึงต้องเก็บ Discipline ไว้ใน RFA และต้องใช้เป็นส่วนหนึ่งของ Key ในการนับเลข

```sql
-- เพิ่ม discipline_id ในตาราง RFAs
ALTER TABLE rfas
ADD COLUMN discipline_id INT NULL AFTER rfa_type_id,
ADD CONSTRAINT fk_rfa_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id);

-- เพิ่ม discipline_id ในตาราง Correspondences (สำหรับ RFI)
ALTER TABLE correspondences
ADD COLUMN discipline_id INT NULL AFTER correspondence_type_id,
ADD CONSTRAINT fk_corr_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines(id);

-- ปรับปรุงตาราง Counter ให้รองรับ Discipline และ SubType (ใช้เป็น Dynamic Key หรือเพิ่ม Column)
-- เพื่อความ Performance และ Integrity แนะนำให้เพิ่ม Column
ALTER TABLE document_number_counters
ADD COLUMN discipline_id INT NULL DEFAULT NULL AFTER correspondence_type_id,
DROP PRIMARY KEY,
ADD PRIMARY KEY (project_id, originator_organization_id, correspondence_type_id, discipline_id, current_year);
-- หมายเหตุ: ถ้า discipline_id เป็น NULL ให้ถือว่าเป็น Counter ทั่วไป
```

-----

## 3\. แนวทางการ Implement ใน NestJS (Backend Logic)

เราต้องปรับ `DocumentNumberingService` ให้เป็น **Token-Based Generator** ที่มีความยืดหยุ่นสูง

### 3.1 รูปแบบ Template (Format Templates)

Admin จะบันทึก Template ลง DB ในรูปแบบ:

  * General: `{ORG}-{ORG}-{SEQ:4}-{YEAR}`
  * Transmittal: `{ORG}-{ORG}-{SUBTYPE_NUM}-{SEQ:4}-{YEAR}`
  * RFA: `{CONTRACT}-{TYPE}-{DISCIPLINE}-{SUBTYPE}-{SEQ:4}-{REV}`

### 3.2 Logic การ Generate (Pseudo Code)

```typescript
// File: src/modules/document-numbering/document-numbering.service.ts

/**
 * Strategy:
 * 1. รับค่า Context (Project, Org, Type, Discipline, SubType, Year)
 * 2. ดึง Format Template จาก DB ตาม Type
 * 3. ถ้าเป็น Transmittal ต้องเช็คเงื่อนไขพิเศษเพื่อเลือก Template (Owner vs Contractor)
 * 4. Parse Template เพื่อหาว่าต้องใช้ Key ไหนบ้างในการ Lock และ Count
 * 5. Run Redlock + Optimistic Lock
 * 6. Replace Tokens
 */

async generateNextNumber(ctx: GenerateNumberContext): Promise<string> {
    // 1. Get Template
    let template = await this.formatRepo.findOne({ ... });

    // 2. Handle Special Logic (Requirement 2.2 Transmittal)
    if (ctx.typeCode === 'TRANSMITTAL') {
        // Logic: ถ้าส่งให้ Owner ใช้ Template A, ถ้า Contractor ใช้ Template B
        // หรือดึง sub_type_number มาเตรียมไว้
    }

    // 3. Resolve Tokens Values
    const tokens = {
        '{ORG}': ctx.orgCode,
        '{CONTRACT}': ctx.contractCode,
        '{TYPE}': ctx.typeCode,
        '{DISCIPLINE}': ctx.disciplineCode, // จากตาราง disciplines
        '{SUBTYPE}': ctx.subTypeCode,       // จาก rfa_types หรือ sub_type_codes
        '{SUBTYPE_NUM}': ctx.subTypeNumber, // จาก correspondence_sub_type_codes
        '{YEAR}': ctx.year.toString(),
        '{YEAR_SHORT}': ctx.year.toString().slice(-2),
    };

    // 4. Construct Counter Key
    // ถ้า Template มี {DISCIPLINE} ต้องเอา discipline_id มาเป็นส่วนหนึ่งของ Composite Key ใน DB Counter
    const counterKey = {
        projectId: ctx.projectId,
        orgId: ctx.orgId,
        typeId: ctx.typeId,
        disciplineId: template.includes('{DISCIPLINE}') ? ctx.disciplineId : null,
        year: template.includes('{YEAR}') ? ctx.year : 0 // ถ้าไม่ใช้ปี ให้ใช้ 0
    };

    // 5. Execute Double-Lock Mechanism (Redis + DB Optimistic)
    const seq = await this.runDistributedCounter(counterKey);

    // 6. Final Replace
    let finalNumber = template.formatTemplate;
    for (const [key, value] of Object.entries(tokens)) {
        finalNumber = finalNumber.replace(key, value || '00'); // Fallback if missing
    }
    // Replace SEQ with padding
    finalNumber = finalNumber.replace(/{SEQ:(\d+)}/, (_, width) =>
        String(seq).padStart(Number(width), '0')
    );

    return finalNumber;
}
```

-----

## 4\. แผนการดำเนินการ (Action Plan)

เพื่อให้รองรับ `6B.md` ได้สมบูรณ์ ผมขอเสนอให้ดำเนินการดังนี้:

1.  **Database Migration:**
      * รัน SQL Script เพื่อเพิ่มตาราง `disciplines`, `correspondence_sub_type_codes`.
      * Alter ตาราง `rfas`, `correspondences` และ `document_number_counters` ตามข้อ 2.2
2.  **Seed Data:**
      * นำข้อมูลจากตารางใน `6B.md` (Disciplines, RFA Types, Sub Types) มาเขียนเป็น Seed Script ลงฐานข้อมูล เพื่อให้เริ่มต้นระบบมีข้อมูลพร้อมใช้ทันที
3.  **Backend Implementation:**
      * Update `DocumentNumberingService` ให้รองรับ Dynamic Token Replacement
      * Update `CreateRfaDto` และ `CreateCorrespondenceDto` ให้รับค่า `discipline_id` และ `sub_type_id` (ถ้ามี)
4.  **Admin Panel:**
      * ต้องมีหน้า UI ให้ Admin จัดการ Mapping ของ `Format Template` และ `Sub Type Codes` ได้ (ตาม Requirement ข้อ 1)

**ต้องการให้ผมเริ่มเขียน SQL Migration Script และ Seed Data สำหรับข้อมูลใน 6B.md เลยหรือไม่ครับ?** (ข้อมูลในตารางค่อนข้างเยอะ การทำ Seed ไว้จะช่วยลดเวลา Admin ในการกรอกข้อมูลเริ่มต้นได้มากครับ)

จาก แผนการดำเนินการ (Action Plan): Database Migration และ Seed Data, ผมได้อัพเดท Basic data ข้อ 5. Data files ให้แล้ว, ช่วย review และ ปรับปรุง 4_Data_Dictionary_V1_4_3.md ,

เตรียม Backend Implementation, Admin Panel





### **Phase 2: High-Integrity Data & File Management (สัปดาห์ที่ 4)**

* **[ ] T2.3 DocumentNumberingModule - Token-Based & Double-Lock** (Updated)
    * [ ] Update Entity: `DocumentNumberCounter` (Add `discipline_id` to PK)
    * [ ] Implement Token Parser & Replacer Logic (`{DISCIPLINE}`, `{SUBTYPE_NUM}`)
    * [ ] Update `generateNextNumber` to handle optional keys (Discipline/SubType)
    * [ ] **Deliverable:** Flexible Numbering System

* **[ ] T2.6 MasterModule - Advanced Data (Req 6B)** (New)
    * [ ] Update Entities: `Discipline`, `CorrespondenceSubType`
    * [ ] Create Services/Controllers for CRUD Operations (Admin Panel Support)
    * [ ] Implement Seeding Logic for initial 6B data
    * [ ] **Deliverable:** API for managing Disciplines and Sub-types
    * [ ] **Dependencies:** T1.1, T0.3