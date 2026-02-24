# 📝 Documents Management System Version 1.5.1: Application Requirements Specification

**สถานะ:** FINAL-Rev.01
**วันที่:** 2025-12-04
**อ้างอิงพื้นฐาน:** v1.5.0
**Classification:** Internal Technical Documentation

## 📌 1. Objectives

# 📌 Section 1: Objectives (วัตถุประสงค์)
---
title: 'Objectives'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: -
---

สร้างเว็บแอปพลิเคชันสำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System - DMS) แบบครบวงจร ที่เน้นความปลอดภัยสูงสุด ความถูกต้องของข้อมูล (Data Integrity) และรองรับการขยายตัวในอนาคต (Scalability) โดยแก้ไขปัญหา Race Condition และเพิ่มความเสถียรในการจัดการไฟล์ และใช้ Unified Workflow Engine ในการจัดการกระบวนการอนุมัติทั้งหมดเพื่อความยืดหยุ่น

- มีฟังก์ชันหลักในการอัปโหลด จัดเก็บ ค้นหา แชร์ และควบคุมสิทธิ์การเข้าถึงเอกสาร
- ช่วยลดการใช้เอกสารกระดาษ เพิ่มความปลอดภัยในการจัดเก็บข้อมูล
- เพิ่มความสะดวกในการทำงานร่วมกันระหว่างองค์กร
- ปรับปรุงความปลอดภัยของระบบด้วยมาตรการป้องกันที่ทันสมัย
- เพิ่มความทนทานของระบบด้วยกลไก resilience patterns
- สร้างระบบ monitoring และ observability ที่ครอบคลุม

## 🛠️ 2. System Architecture

# 🛠️ Section 2: System Architecture (สถาปัตยกรรมและเทคโนโลยี)
---
title: 'System Architecture'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: - specs/01-objectives.md
---

ชื่อกำหนด สถาปัตยกรรมแบบ Headless/API-First ที่ทันสมัย ทำงานทั้งหมดบน QNAP Server ผ่าน Container Station เพื่อความสะดวกในการจัดการและบำรุงรักษา

### 2.1 Infrastructure & Environment
- Domain: `np-dms.work`, `www.np-dms.work`
- IP: 159.192.126.103
- Server: QNAP (Model: TS-473A, RAM: 32GB, CPU: AMD Ryzen V1500B)
- Containerization: Container Station (Docker & Docker Compose) ใช้ UI ของ Container Station เป็นหลัก ในการ configuration และการรัน docker command
- Development Environment: VS Code/Cursor on Windows 11
- Data Storage: /share/dms-data บน QNAP
- ข้อจำกัด: ไม่สามารถใช้ .env ในการกำหนดตัวแปรภายนอกได้ ต้องกำหนดใน docker-compose.yml เท่านั้น

### 2.2 Configuration Management
- ใช้ docker-compose.yml สำหรับ environment variables ตามข้อจำกัดของ QNAP
- Secrets Management: ใช้ docker-compose.override.yml (gitignore) สำหรับ secret injection, Docker secrets หรือ Hashicorp Vault, encrypted env vars
- Development environment ยังใช้ .env ได้ แต่ต้องไม่ commit เข้า version control
- มี configuration validation during application startup
- แยก configuration ตาม environment (development, staging, production)
- Docker Network: lcbp3

### 2.3 Core Services
- Code Hosting: Gitea (`git.np-dms.work`)
- Backend / Data Platform: NestJS (`backend.np-dms.work`)
- Database: MariaDB 10.11 (`db.np-dms.work`)
- Database Management UI: phpMyAdmin (`pma.np-dms.work`)
- Frontend: Next.js (`lcbp3.np-dms.work`)
- Workflow Automation: n8n (`n8n.np-dms.work`)
- Reverse Proxy: Nginx Proxy Manager (`npm.np-dms.work`)
- Search Engine: Elasticsearch
- Cache: Redis

### 2.4 Business Logic & Consistency
- Unified Workflow Engine (central) with DSL JSON configuration
- Versioning of workflow definitions, optimistic locking with Redis lock for document numbering
- No SQL triggers; all business logic in NestJS services

## 📦 3. Functional Requirements

### 3.1 Project Management

# 3.1 Project Management (การจัดการโครงสร้างโครงการและองค์กร)
---
title: "Functional Requirements: Project Management"
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: -
---
- 3.1.1. โครงการ (Projects): ระบบต้องสามารถจัดการเอกสารภายในหลายโครงการได้ (ปัจจุบันมี 4 โครงการ และจะเพิ่มขึ้นในอนาคต)
- 3.1.2. สัญญา (Contracts): ระบบต้องสามารถจัดการเอกสารภายในแต่ละสัญญาได้ ในแต่ละโครงการ มีได้หลายสัญญา หรืออย่างน้อย 1 สัญญา
- 3.1.3. องค์กร (Organizations):
  - มีหลายองค์กรในโครงการ Owner, Designer, Consultant สามารถอยู่หลายโครงการและสัญญาได้
  - Contractor จะถือ 1 สัญญา และอยู่ใน 1 โครงการเท่านั้น

### 3.2 Correspondence Management

# 3.2 การจัดการเอกสารโต้ตอบ (Correspondence Management)
---
title: 'Functional Requirements: Correspondence Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: -
---
- 3.2.1. วัตถุประสงค์: เอกสารโต้ตอบระหว่างองค์กรภายในและภายนอกโครงการ, รองรับ To และ CC หลายองค์กร
- 3.2.2. ประเภทเอกสาร: PDF, ZIP; Types include Letter, Email, RFI, RFA (with revisions)
- 3.2.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์สร้าง Draft, Submit requires Admin approval
- 3.2.4. การอ้างอิงและจัดกลุ่ม: รองรับหลาย Reference, Tagging
- 3.2.5. Workflow: รองรับ Unified Workflow

### 3.3 RFA Management

# 3.3 RFA Management (การจัดการเอกสาขออนุมัติ)
---
title: 'Functional Requirements: RFA Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: -
---
- 3.3.1. วัตถุประสงค์: เอกสารขออนุมัติภายในโครงการ
- 3.3.2. ประเภทเอกสาร: PDF, รองรับหลาย revision และหลายประเภท RFA
- 3.3.3. การสร้างเอกสาร: Draft creation by Document Control, Submit requires Admin
- 3.3.4. การอ้างอิง: สามารถอ้างถึง Shop Drawing ได้หลายฉบับ
- 3.3.5. Workflow: รองรับ Unified Workflow

### 3.4 Contract Drawing Management

# 3.4 Contract Drawing Management (การจัดการแบบคู่สัญญา)
---
title: 'Functional Requirements: Contract Drawing Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: -
---
- 3.4.1. วัตถุประสงค์: ใช้เพื่ออ้างอิงและตรวจสอบ
- 3.4.2. ประเภทเอกสาร: PDF
- 3.4.3. การสร้างเอกสาร: ผู้มีสิทธิ์สร้างและแก้ไข
- 3.4.4. การอ้างอิง: ใช้สำหรับอ้างอิงใน Shop Drawings

### 3.5 Shop Drawing Management

# 3.5 Shop Drawing Management (การจัดการแบบก่อสร้าง)
---
title: 'Functional Requirements: Shop Drawing Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: -
---
- 3.5.1. วัตถุประสงค์: ใช้ในการตรวจสอบและจัดส่งด้วย RFA
- 3.5.2. ประเภทเอกสาร: PDF, DWG, ZIP
- 3.5.3. การสร้างเอกสาร: ผู้มีสิทธิ์สร้าง/แก้ไข, Draft visibility control
- 3.5.4. การอ้างอิง: ใช้ใน RFA, มีการจัดหมวดหมู่, แต่ละ revision มี RFA หนึ่งฉบับ

### 3.6 Unified Workflow Management

# 3.6 Unified Workflow Management (การจัดการ Workflow)
---
title: 'Functional Requirements: Unified Workflow Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related: -
---
- 3.6.1 Workflow Definition: Admin can create/edit rules via UI DSL Editor, define State, Transition, Role, Condition
- 3.6.2 Workflow Execution: Create instances polymorphic to documents, support actions Approve, Reject, Comment, Return, auto-actions
- 3.6.3 Flexibility: Parallel Review, Conditional Flow
- 3.6.4 Approval Flow: Supports complex multi-organization sequences and return paths
- 3.6.5 Management: Deadline setting, notifications, step skipping, backtrack

# 3.7 Transmittals Management (การจัดการเอกสารนำส่ง)
---
title: 'Functional Requirements: Transmittals Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related:
  - specs/01-requirements/01-objectives.md
  - specs/01-requirements/02-architecture.md
  - specs/01-requirements/03-functional-requirements.md
---
## 3.7.1. วัตถุประสงค์:
- เอกสารนำส่ง ใช้สำหรับ นำส่ง Request for Approval (RFAS) หลายฉบับ ไปยังองค์กรอื่น

## 3.7.2. ประเภทเอกสาร:
- ไฟล์ PDF

## 3.7.3. การสร้างเอกสาร:
- ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้

## 3.7.4. การอ้างอิงและจัดกลุ่ม:
- เอกสารนำส่ง เป็นส่วนหนึ่งใน Correspondence

# 3.8 Circulation Sheet Management (การจัดการใบเวียนเอกสาร)
---
title: 'Functional Requirements: Circulation Sheet Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related:
  - specs/01-requirements/01-objectives.md
  - specs/01-requirements/02-architecture.md
  - specs/01-requirements/03-functional-requirements.md
---
## 3.8.1. วัตถุประสงค์:
- การสื่อสาร เอกสาร (Correspondence) ทุกฉบับ จะมีใบเวียนเอกสารเพื่อควบคุมและมอบหมายงานภายในองค์กร (สามารถดูและแก้ไขได้เฉพาะคนในองค์กร)

## 3.8.2. ประเภทเอกสาร:
- ไฟล์ PDF

## 3.8.3. การสร้างเอกสาร:
- ผู้ใช้ที่มีสิทธิ์ในองค์กรนั้น สามารถสร้างและแก้ไขได้

## 3.8.4. การอ้างอิงและจัดกลุ่ม:
- การระบุผู้รับผิดชอบ:
  - ผู้รับผิดชอบหลัก (Main): มีได้หลายคน
  - ผู้ร่วมปฏิบัติงาน (Action): มีได้หลายคน
  - ผู้ที่ต้องรับทราบ (Information): มีได้หลายคน

## 3.8.5. การติดตามงาน:
- สามารถกำหนดวันแล้วเสร็จ (Deadline) สำหรับผู้รับผิดชอบประเภท Main และ Action ได้
- มีระบบแจ้งเตือนเมื่อมี Circulation ใหม่ และแจ้งเตือนล่วงหน้าก่อนถึงวันแล้วเสร็จ
- สามารถปิด Circulation ได้เมื่อดำเนินการตอบกลับไปยังองค์กรผู้ส่ง (Originator) แล้ว หรือ รับทราบแล้ว (For Information)

# 3.9 Logs Management (ประวัติการแก้ไข)
---
title: 'Functional Requirements: Logs Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related:
  - specs/01-requirements/01-objectives.md
  - specs/01-requirements/02-architecture.md
  - specs/01-requirements/03-functional-requirements.md
---
## 3.9.1. วัตถุประสงค์:
- เพื่อ บันทึกการกระทำ CRUD ของเอกสารทั้งหมด รวมถึงการ เข้าใช้งาน ของ users
- admin สามารถดูประวัติการแก้ไขของเอกสารทั้งหมด พร้อม จัดทำรายงายตามข้อกำหนดที่ ต้องการได้

# 3.10 File Handling Management (การจัดการไฟล์)
---
title: 'Functional Requirements: File Handling Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related:
  - specs/01-requirements/01-objectives.md
  - specs/01-requirements/02-architecture.md
  - specs/01-requirements/03-functional-requirements.md
---
## 3.10.1 Two-Phase Storage Strategy:
1. Phase 1 (Upload): ไฟล์ถูกอัปโหลดเข้าโฟลเดอร์ temp/ และได้รับ temp_id
2. Phase 2 (Commit): เมื่อ User กด Submit ฟอร์มสำเร็จ ระบบจะย้ายไฟล์จาก temp/ ไปยัง permanent/{YYYY}/{MM}/ และบันทึกลง Database ภายใน Transaction เดียวกัน
3. Cleanup: มี Cron Job ลบไฟล์ใน temp/ ที่ค้างเกิน 24 ชม. (Orphan Files)

## 3.10.2 Security:
- Virus Scan (ClamAV) ก่อนย้ายเข้า permanent
- Whitelist File Types: PDF, DWG, DOCX, XLSX, ZIP
- Max Size: 50MB
- Access Control: ตรวจสอบสิทธิ์ผ่าน Junction Table ก่อนให้ Download Link

## 3.10.3 ความปลอดภัยของการจัดเก็บไฟล์:
- ต้องมีการ scan virus สำหรับไฟล์ที่อัปโหลดทั้งหมด โดยใช้ ClamAV หรือบริการ third-party
- จำกัดประเภทไฟล์ที่อนุญาต: PDF, DWG, DOCX, XLSX, ZIP (ต้องระบุรายการที่ชัดเจน)
- ขนาดไฟล์สูงสุด: 50MB ต่อไฟล์
- ไฟล์ต้องถูกเก็บนอก web root และเข้าถึงได้ผ่าน authenticated endpoint เท่านั้น
- ต้องมี file integrity check (checksum) เพื่อป้องกันการแก้ไขไฟล์
- Download links ต้องมี expiration time (default: 24 ชั่วโมง)
- ต้องบันทึก audit log ทุกครั้งที่มีการดาวน์โหลดไฟล์สำคัญ

# 3.11 Document Numbering Management (การจัดการเลขที่เอกสาร)
---
title: 'Functional Requirements: Document Numbering Management'
version: 1.6.0
status: draft
owner: Nattanin Peancharoen
last_updated: 2025-12-02
related:
  - specs/01-requirements/01-objectives.md
  - specs/01-requirements/02-architecture.md
  - specs/01-requirements/03-functional-requirements.md
  - specs/03-implementation/document-numbering.md
  - specs/04-operations/document-numbering-operations.md
  - specs/04-data-dictionary/4_Data_Dictionary_V1_4_4.md
---
## 3.11.1 วัตถุประสงค์:
- ระบบต้องสามารถสร้างเลขที่เอกสาร (Running Number) ได้โดยอัตโนมัติและยืดหยุ่นสูง
- ระบบต้องสามารถกำหนดรูปแบบ (template) เลขที่เอกสารได้ สำหรับแต่ละโครงการ, ชนิดเอกสาร, ประเภทเอกสาร
- ระบบต้องรับประกัน Uniqueness ของเลขที่เอกสารในทุกสถานการณ์
- ระบบต้องรองรับการทำงานแบบ concurrent ได้อย่างปลอดภัย

## 3.11.2 Logic การนับเลข (Counter Logic)
การนับเลขจะแยกตาม **Counter Key** ที่ประกอบด้วยหลายส่วน ขึ้นกับประเภทเอกสาร

### Counter Key Components
| Component                    | Required?        | Description         | Database Source                                           | Default if NULL |
| ---------------------------- | ---------------- | ------------------- | --------------------------------------------------------- | --------------- |
| `project_id`                 | ✅ Yes            | ID โครงการ          | Derived from user context or organization                 | -               |
| `originator_organization_id` | ✅ Yes            | ID องค์กรผู้ส่ง         | `correspondences.originator_id`                           | -               |
| `recipient_organization_id`  | Depends on type  | ID องค์กรผู้รับหลัก (TO) | `correspondence_recipients` where `recipient_type = 'TO'` | NULL for RFA    |
| `correspondence_type_id`     | ✅ Yes            | ID ประเภทเอกสาร     | `correspondence_types.id`                                 | -               |
| `sub_type_id`                | TRANSMITTAL only | ID ประเภทย่อย        | `correspondence_sub_types.id`                             | 0               |
| `rfa_type_id`                | RFA only         | ID ประเภท RFA       | `rfa_types.id`                                            | 0               |
| `discipline_id`              | RFA only         | ID สาขางาน          | `disciplines.id`                                          | 0               |
| `current_year`               | ✅ Yes            | ปี ค.ศ.              | System year (ปัจจุบัน)                                       | -               |

### Counter Key แยกตามประเภทเอกสาร
**LETTER / RFI / MEMO / EMAIL / MOM / INSTRUCTION / NOTICE / OTHER**:
```
(project_id, originator_organization_id, recipient_organization_id,
 correspondence_type_id, 0, 0, 0, current_year)
```
*หมายเหตุ*: ไม่ใช้ `discipline_id`, `sub_type_id`, `rfa_type_id`

**TRANSMITTAL**:
```
(project_id, originator_organization_id, recipient_organization_id,
 correspondence_type_id, sub_type_id, 0, 0, current_year)
```
*หมายเหตุ*: ใช้ `sub_type_id` เพิ่มเติม

**RFA**:
```
(project_id, originator_organization_id, NULL,
 correspondence_type_id, 0, rfa_type_id, discipline_id, current_year)
```
*หมายเหตุ*: RFA ไม่ใช้ `recipient_organization_id` เพราะเป็นเอกสารโครงการ (CONTRACTOR → CONSULTANT → OWNER)

### วิธีการหา project_id
1. **User Context** (แนะนำ):
   - เมื่อ User สร้างเอกสาร UI จะให้เลือก Project/Contract ก่อน
   - ใช้ `project_id` จาก Context ที่เลือก
2. **จาก Organization**:
   - Query `project_organizations` หรือ `contract_organizations`
   - ใช้ `originator_organization_id` หา project ที่เกี่ยวข้อง
   - ถ้ามีหลาย project ให้ User เลือก
3. **Validation**:
   - ตรวจสอบว่า organization มีสิทธิ์ใน project นั้น
   - ตรวจสอบว่า project/contract เป็น active

### Fallback สำหรับค่า NULL
- `discipline_id`: ใช้ `0` (ไม่ระบุสาขางาน)
- `sub_type_id`: ใช้ `0` (ไม่มีประเภทย่อย)
- `rfa_type_id`: ใช้ `0` (ไม่ระบุประเภท RFA)
- `recipient_organization_id`: ใช้ `NULL` สำหรับ RFA, Required สำหรับ LETTER/TRANSMITTAL

## 3.11.3 Format Templates by Correspondence Type
### 3.11.3.1. Letter (TYPE = LETTER)
**Template**:
```
{ORIGINATOR}-{RECIPIENT}-{SEQ:4}-{YEAR:B.E.}
```
**Example**: `คคง.-สคฉ.3-0001-2568`
**Token Breakdown**:
- `คคง.` = {ORIGINATOR} = รหัสองค์กรผู้ส่ง
- `สคฉ.3` = {RECIPIENT} = รหัสองค์กรผู้รับหลัก (TO)
- `0001` = {SEQ:4} = Running number (เริ่ม 0001, 0002, ...)
- `2568` = {YEAR:B.E.} = ปี พ.ศ.
> **⚠️ Template vs Counter Separation**
- {CORR_TYPE} **ไม่แสดง**ใน template เพื่อความกระชับ
- แต่ระบบ**ยังใช้ correspondence_type_id ใน Counter Key** เพื่อแยก counter
- LETTER, MEMO, RFI **มี counter แยกกัน** แม้ template format เหมือนกัน
**Counter Key**: `(project_id, originator_org_id, recipient_org_id, corr_type_id, 0, 0, 0, year)`
---
### 3.11.3.2. Transmittal (TYPE = TRANSMITTAL)
**Template**:
```
{ORIGINATOR}-{RECIPIENT}-{SUB_TYPE}-{SEQ:4}-{YEAR:B.E.}
```
**Example**: `คคง.-สคฉ.3-21-0117-2568`
**Token Breakdown**:
- `คคง.` = {ORIGINATOR}
- `สคฉ.3` = {RECIPIENT}
- `21` = {SUB_TYPE} = หมายเลขประเภทย่อย (11=MAT, 12=SHP, 13=DWG, 14=MET, ...)
- `0117` = {SEQ:4}
- `2568` = {YEAR:B.E.}
> **⚠️ Template vs Counter Separation**
- {CORR_TYPE} **ไม่แสดง**ใน template (เหมือน LETTER)
- TRANSMITTAL มี counter แยกจาก LETTER
**Counter Key**: `(project_id, originator_org_id, recipient_org_id, corr_type_id, sub_type_id, 0, 0, year)`
---
### 3.11.3.3. RFA (Request for Approval)
**Template**:
```
{PROJECT}-{CORR_TYPE}-{DISCIPLINE}-{RFA_TYPE}-{SEQ:4}-{REV}
```
**Example**: `LCBP3-C2-RFA-TER-RPT-0001-A`
**Token Breakdown**:
- `LCBP3-C2` = {PROJECT} = รหัสโครงการ
- `RFA` = {CORR_TYPE} = ประเภทเอกสาร (แสดงใน RFA template)
- `TER` = {DISCIPLINE} = รหัสสาขางาน (TER=Terminal, STR=Structure, ...)
- `RPT` = {RFA_TYPE} = ประเภท RFA (RPT=Report, SDW=Shop Drawing, ...)
- `0001` = {SEQ:4}
- `A` = {REV} = Revision code
> **📋 RFA Workflow**
- RFA เป็น **เอกสารโครงการ** (Project-level document)
- Workflow: **CONTRACTOR → CONSULTANT → OWNER**
- ไม่มี specific `recipient_id` เพราะเป็น workflow ที่กำหนดไว้แล้ว
**Counter Key**: `(project_id, originator_org_id, NULL, corr_type_id, 0, rfa_type_id, discipline_id, year)`
---
## 3.11.4. Security & Data Integrity Requirements
### 3.11.4.1. Concurrency Control
**Requirements:**
- ระบบ**ต้อง**ป้องกัน race condition เมื่อมีการสร้างเลขที่เอกสารพร้อมกัน
- ระบบ**ต้อง**รับประกัน uniqueness ของเลขที่เอกสารในทุกสถานการณ์
- ระบบ**ควร**ใช้ Distributed Lock (Redis) เป็นกลไก primary
- ระบบ**ต้อง**มี fallback mechanism เมื่อ Redis ไม่พร้อมใช้งาน
### 3.11.4.2. Data Integrity
**Requirements:**
- ระบบ**ต้อง**ใช้ Optimistic Locking เพื่อตรวจจับ concurrent updates
- ระบบ**ต้อง**มี database constraints เพื่อป้องกันข้อมูลผิดพลาด:
  - Unique constraint บน `document_number`
  - Foreign key constraints ทุก relationship
  - Check constraints สำหรับ business rules
---
## 3.11.5. Validation Rules
- ต้องมี JSON schema validation สำหรับแต่ละประเภท
- ต้องรองรับ versioning ของ schema
- ต้องมี default values สำหรับ field ที่ไม่บังคับ
- ต้องตรวจสอบ data types และ format ให้ถูกต้อง
---
## 3.11.6. Performance Requirements
- JSON field ต้องมีขนาดไม่เกิน 50KB
- ต้องรองรับ indexing สำหรับ field ที่ใช้ค้นหาบ่อย
- ต้องมี compression สำหรับ JSON ขนาดใหญ่
---
## 3.11.7. Security Requirements
- ต้อง sanitize JSON input เพื่อป้องกัน injection attacks
- ต้อง validate JSON structure ก่อนบันทึก
- ต้อง encrypt sensitive data ใน JSON fields
---
## 3.11.8. JSON Schema Migration Strategy
- สำหรับ Schema Breaking Changes:
  - Phase 1 - Add New Column
    ALTER TABLE correspondence_revisions
    ADD COLUMN ref_project_id_v2 INT GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(details, '$.newProjectIdPath'))) VIRTUAL;
  - Phase 2 - Backfill Old Records
    - ใช้ background job แปลง JSON format เก่าเป็นใหม่
    - Update `details` JSON ทีละ batch (1000 records)
  - Phase 3 - Switch Application Code
    - Deploy code ที่ใช้ path ใหม่
  - Phase 4 - Remove Old Column
    - หลังจาก verify แล้วว่าไม่มี error
    - Drop old virtual column
- สำหรับ Non-Breaking Changes
  - เพิ่ม optional field ใน schema
  - Old records ที่ไม่มี field = ใช้ default value
---
# 3.12 JSON Details Management (การจัดการ JSON Details)
---
title: 'Functional Requirements: JSON Details Management'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related:
  - specs/01-requirements/01-objectives.md
  - specs/01-requirements/02-architecture.md
  - specs/01-requirements/03-functional-requirements.md
---
## 3.12.1 วัตถุประสงค์
- จัดเก็บข้อมูลแบบไดนามิกที่เฉพาะเจาะจงกับแต่ละประเภทของเอกสาร
- รองรับการขยายตัวของระบบโดยไม่ต้องเปลี่ยนแปลง database schema
- จัดการ metadata และข้อมูลประกอบสำหรับ correspondence, routing, และ workflows
## 3.12.2 โครงสร้าง JSON Schema
- ระบบต้องมี predefined JSON schemas สำหรับประเภทเอกสารต่างๆ:
  - 3.12.2.1 Correspondence Types
    - GENERIC: ข้อมูลพื้นฐานสำหรับเอกสารทั่วไป
    - RFI: รายละเอียดคำถามและข้อมูลทางเทคนิค
    - RFA: ข้อมูลการขออนุมัติแบบและวัสดุ
    - TRANSMITTAL: รายการเอกสารที่ส่งต่อ
    - LETTER: ข้อมูลจดหมายทางการ
    - EMAIL: ข้อมูลอีเมล
  - 3.12.2.2 Rworkflow Types
    - workflow_definitions: กฎและเงื่อนไขการส่งต่อ
    - workflow_histories: สถานะและประวัติการส่งต่อ
    - workflow_instances: การดำเนินการในแต่ละขั้นตอน
  - 3.12.2.3 Audit Types
    - AUDIT_LOG: ข้อมูลการตรวจสอบ
    - SECURITY_SCAN: ผลการตรวจสอบความปลอดภัย
## 3.12.3 Virtual Columns (ปรับปรุง)
- สำหรับ Field ใน JSON ที่ต้องใช้ในการค้นหา (Search) หรือจัดเรียง (Sort) บ่อยๆ ต้องสร้าง Generated Column (Virtual Column) ใน Database และทำ Index ไว้ เพื่อประสิทธิภาพสูงสุด
- Schema Consistency: Field ที่ถูกกำหนดเป็น Virtual Column ห้าม เปลี่ยนแปลง Key Name หรือ Data Type ใน JSON Schema Version ถัดไป หากจำเป็นต้องเปลี่ยน ต้องมีแผนการ Re-index หรือ Migration ข้อมูลเดิมที่ชัดเจน
## 3.12.4 Validation Rules
- ต้องมี JSON schema validation สำหรับแต่ละประเภท
- ต้องรองรับ versioning ของ schema
- ต้องมี default values สำหรับ field ที่ไม่บังคับ
- ต้องตรวจสอบ data types และ format ให้ถูกต้อง
## 3.12.5 Performance Requirements
- JSON field ต้องมีขนาดไม่เกิน 50KB
- ต้องรองรับ indexing สำหรับ field ที่ใช้ค้นหาบ่อย
- ต้องมี compression สำหรับ JSON ขนาดใหญ่
## 3.12.6 Security Requirements
- ต้อง sanitize JSON input เพื่อป้องกัน injection attacks
- ต้อง validate JSON structure ก่อนบันทึก
- ต้อง encrypt sensitive data ใน JSON fields
---

## 📂 4. Non‑Functional Requirements

# 4.1 Access Control
# 🔐 Section 4: Access Control (ข้อกำหนดด้านสิทธิ์และการเข้าถึง)

## 4.1. Overview:

- Users and organizations can view and edit documents based on the permissions they have. The system's permissions will be based on Role-Based Access Control (RBAC).

## 4.2. Permission Hierarchy:

- Global: The highest level of permissions in the system
- Organization: Permissions within an organization, which is the basic permission for users
- Project: Permissions specific to a project, which will be considered when the user is in that project
- Contract: Permissions specific to a contract, which will be considered when the user is in that contract

## 4.3. Permission Enforcement:

- When checking permissions, the system will consider permissions from all levels that the user has and use the most permissive permission as the decision
- Example: User A is a Viewer in the organization, but is assigned as an Editor in Project X when in Project X, User A will have the right to edit

## 4.4. Role and Scope:

| Role                 | Scope        | Description                | Key Permissions                                                                                                       |
| :------------------- | :----------- | :------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Superadmin**       | Global       | System administrator       | Do everything in the system, manage organizations, manage global data                                                 |
| **Org Admin**        | Organization | Organization administrator | Manage users in the organization, manage roles/permissions within the organization, view organization reports         |
| **Document Control** | Organization | Document controller        | Add/edit/delete documents, set document permissions within the organization                                           |
| **Editor**           | Organization | Document editor            | Edit documents that have been assigned to them                                                                        |
| **Viewer**           | Organization | Document viewer            | View documents that have access permissions                                                                           |
| **Project Manager**  | Project      | Project manager            | Manage members in the project (add/delete/assign roles), create/manage contracts in the project, view project reports |
| **Contract Admin**   | Contract     | Contract administrator     | Manage users in the contract, manage roles/permissions within the contract, view contract reports                     |

## 4.5. Token Management (ปรับปรุง)

- **Payload Optimization:** ใน JWT Access Token ให้เก็บเฉพาะ `userId` และ `scope` ปัจจุบันเท่านั้น
- **Permission Caching:** สิทธิ์ละเอียด (Permissions List) ให้เก็บใน **Redis** และดึงมาตรวจสอบเมื่อ Request เข้ามา เพื่อลดขนาด Token และเพิ่มความเร็ว

## 4.6. Onboarding Workflow

- 4.6.1. Create Organization
  - **Superadmin** creates a new organization (e.g. Company A)
  - **Superadmin** appoints at least 1 user as **Org Admin** or **Document Control** of Company A
- 4.6.2. Add Users to Organization
  - **Org Admin** of Company A adds other users (Editor, Viewer) to the organization
- 4.6.3. Assign Users to Project
  - **Project Manager** of Project X (which may come from Company A or another company) invites or assigns users from different organizations to join Project X
  - In this step, **Project Manager** will assign **Project Role** (e.g. Project Member, or may use organization-level permissions)
- 4.6.4. Assign Users to Contract
  - **Contract Admin** of Contract Y (which is part of Project X) selects users from Project X and assigns them to Contract Y
  - In this step, **Contract Admin** will assign **Contract Role** (e.g. Contract Member) and specific permissions
- 4.6.5 Security Onboarding:
  - Force users to change password for the first time
  - Security awareness training for users with high permissions
  - Safe password reset process
  - Audit log recording every permission change

### **4.7. Master Data Management**

| Master Data                             | Manager                         | Scope                           |
| :-------------------------------------- | :------------------------------ | :------------------------------ |
| Document Type (Correspondence, RFA)     | **Superadmin**                  | Global                          |
| Document Status (Draft, Approved, etc.) | **Superadmin**                  | Global                          |
| Shop Drawing Category                   | **Project Manager**             | Project (สร้างใหม่ได้ภายในโครงการ) |
| Tags                                    | **Org Admin / Project Manager** | Organization / Project          |
| Custom Roles                            | **Superadmin / Org Admin**      | Global / Organization           |
| Document Numbering Formats              | **Superadmin / Admin**          | Global / Organization           |

## 4.8. การบันทึกการกระทำ (Audit Log)

- ทุกการกระทำที่สำคัญของผู้ใช้ (สร้าง, แก้ไข, ลบ, ส่ง) จะถูกบันทึกไว้ใน audit_logs เพื่อการตรวจสอบย้อนหลัง
  - ขอบเขตการบันทึก Audit Log:
    - ทุกการสร้าง/แก้ไข/ลบ ข้อมูลสำคัญ (correspondences, RFAs, drawings, users, permissions)
    - ทุกการเข้าถึงข้อมูล sensitive (user data, financial information)
    - ทุกการเปลี่ยนสถานะ workflow (status transitions)
    - ทุกการดาวน์โหลดไฟล์สำคัญ (contract documents, financial reports)
    - ทุกการเปลี่ยนแปลง permission และ role assignment
    - ทุกการล็อกอินที่สำเร็จและล้มเหลว
    - ทุกการส่งคำขอ API ที่สำคัญ
  - ข้อมูลที่ต้องบันทึกใน Audit Log:
    - ผู้ใช้งาน (user_id)
    - การกระทำ (action)
    - ชนิดของ entity (entity_type)
    - ID ของ entity (entity_id)
    - ข้อมูลก่อนการเปลี่ยนแปลง (old_values) - สำหรับ update operations
    - ข้อมูลหลังการเปลี่ยนแปลง (new_values) - สำหรับ update operations
    - IP address
    - User agent
    - Timestamp
    - Request ID สำหรับ tracing

## 4.9. Data Archiving & Partitioning

- สำหรับตารางที่มีขนาดใหญ่และโตเร็ว (เช่น `audit_logs`, `notifications`, `correspondence_revisions`) ต้องออกแบบโดยรองรับ **Table Partitioning** (แบ่งตาม Range วันที่ หรือ List) เพื่อประสิทธิภาพในระยะยาว

## 4.10. การค้นหา (Search):

- ระบบต้องมีฟังก์ชันการค้นหาขั้นสูง ที่สามารถค้นหาเอกสาร **correspondence**, **rfa**, **shop_drawing**, **contract-drawing**, **transmittal** และ **ใบเวียน (Circulations)** จากหลายเงื่อนไขพร้อมกันได้ เช่น ค้นหาจากชื่อเรื่อง, ประเภท, วันที่, และ Tag

## 4.11. การทำรายงาน (Reporting):

- สามารถจัดทำรายงานสรุปแยกประเภทของ Correspondence ประจำวัน, สัปดาห์, เดือน, และปีได้

## 4.12. ประสิทธิภาพ (Performance):

- มีการใช้ Caching กับข้อมูลที่เรียกใช้บ่อย และใช้ Pagination ในตารางข้อมูลเพื่อจัดการข้อมูลจำนวนมาก

- ตัวชี้วัดประสิทธิภาพ:

  - **API Response Time:** < 200ms (90th percentile) สำหรับ operation ทั่วไป
  - **Search Query Performance:** < 500ms สำหรับการค้นหาขั้นสูง
  - **File Upload Performance:** < 30 seconds สำหรับไฟล์ขนาด 50MB
  - **Concurrent Users:** รองรับผู้ใช้พร้อมกันอย่างน้อย 100 คน
  - **Database Connection Pool:** ขนาดเหมาะสมกับ workload (default: min 5, max 20 connections)
  - **Cache Hit Ratio:** > 80% สำหรับ cached data
  - **Application Startup Time:** < 30 seconds

- Caching Strategy:

  - **Master Data Cache:** Roles, Permissions, Organizations, Project metadata (TTL: 1 hour)
  - **User Session Cache:** User permissions และ profile data (TTL: 30 minutes)
  - **Search Result Cache:** Frequently searched queries (TTL: 15 minutes)
  - **File Metadata Cache:** Attachment metadata (TTL: 1 hour)
  - **Document Cache:** Frequently accessed document metadata (TTL: 30 minutes)
  - **ต้องมี cache invalidation strategy ที่ชัดเจน:**
    - Invalidate on update/delete operations
    - Time-based expiration
    - Manual cache clearance สำหรับ admin operations
  - ใช้ Redis เป็น distributed cache backend
  - ต้องมี cache monitoring (hit/miss ratios)

- Frontend Performance:
  - **Bundle Size Optimization:** ต้องควบคุมขนาด Bundle โดยรวมไม่เกิน 2MB
  - **State Management Efficiency:** ใช้ State Management Libraries อย่างเหมาะสม ไม่เกิน 2 ตัวหลัก
  - **Memory Management:** ต้องป้องกัน Memory Leak จาก State ที่ไม่จำเป็น

## 4.13. System Security (ความปลอดภัยระบบ):

- มีระบบ Rate Limiting เพื่อป้องกันการโจมตีแบบ Brute-force
- การจัดการ Secret (เช่น รหัสผ่าน DB, JWT Secret) จะต้องทำผ่าน Environment Variable ของ Docker เพื่อความปลอดภัยสูงสุด
  - Rate Limiting Strategy:
    - **Anonymous Endpoints:** 100 requests/hour ต่อ IP address
    - **Authenticated Endpoints:**
      - Viewer: 500 requests/hour
      - Editor: 1000 requests/hour
      - Document Control: 2000 requests/hour
      - Admin/Superadmin: 5000 requests/hour
    - **File Upload Endpoints:** 50 requests/hour ต่อ user
    - **Search Endpoints:** 500 requests/hour ต่อ user
    - **Authentication Endpoints:** 10 requests/minute ต่อ IP address
    - **ต้องมี mechanism สำหรับยกเว้น rate limiting สำหรับ trusted services**
    - ต้องบันทึก log เมื่อมีการ trigger rate limiting
  - Error Handling และ Resilience:
    - ต้องมี circuit breaker pattern สำหรับ external service calls
    - ต้องมี retry mechanism ด้วย exponential backoff
    - ต้องมี graceful degradation เมื่อบริการภายนอกล้มเหลว
    - Error messages ต้องไม่เปิดเผยข้อมูล sensitive
  - Input Validation:
    - ต้องมี input validation ทั้งฝั่ง client และ server (defense in depth)
    - ต้องป้องกัน OWASP Top 10 vulnerabilities:
      - SQL Injection (ใช้ parameterized queries ผ่าน ORM)
      - XSS (input sanitization และ output encoding)
      - CSRF (CSRF tokens สำหรับ state-changing operations)
    - ต้อง validate file uploads:
      - File type (white-list approach)
      - File size
      - File content (magic number verification)
    - ต้อง sanitize user inputs ก่อนแสดงผลใน UI
    - ต้องใช้ content security policy (CSP) headers
    - ต้องมี request size limits เพื่อป้องกัน DoS attacks
  - Session และ Token Management:
    - **JWT token expiration:** 8 hours สำหรับ access token
    - **Refresh token expiration:** 7 days
    - **Refresh token mechanism:** ต้องรองรับ token rotation และ revocation
    - **Token revocation on logout:** ต้องบันทึก revoked tokens จนกว่าจะ expire
    - **Concurrent session management:**
      - จำกัดจำนวน session พร้อมกันได้ (default: 5 devices)
      - ต้องแจ้งเตือนเมื่อมี login จาก device/location ใหม่
    - **Device fingerprinting:** สำหรับ security และ audit purposes
    - **Password policy:**
      - ความยาวขั้นต่ำ: 8 characters
      - ต้องมี uppercase, lowercase, number, special character
      - ต้องเปลี่ยน password ทุก 90 วัน
      - ต้องป้องกันการใช้ password ที่เคยใช้มาแล้ว 5 ครั้งล่าสุด

## 4.14. การสำรองข้อมูลและการกู้คืน (Backup & Recovery)

- ระบบจะต้องมีกลไกการสำรองข้อมูลอัตโนมัติสำหรับฐานข้อมูล MariaDB [cite: 2.4] และไฟล์เอกสารทั้งหมดใน /share/dms-data [cite: 2.1] (เช่น ใช้ HBS 3 ของ QNAP หรือสคริปต์สำรองข้อมูล) อย่างน้อยวันละ 1 ครั้ง
- ต้องมีแผนการกู้คืนระบบ (Disaster Recovery Plan) ในกรณีที่ Server หลัก (QNAP) ใช้งานไม่ได้
- ขั้นตอนการกู้คืน:
  - **Database Restoration Procedure:**
    - สร้างจาก full backup ล่าสุด
    - Apply transaction logs ถึง point-in-time ที่ต้องการ
    - Verify data integrity post-restoration
  - **File Storage Restoration Procedure:**
    - Restore จาก QNAP snapshot หรือ backup
    - Verify file integrity และ permissions
  - **Application Redeployment Procedure:**
    - Deploy จาก version ล่าสุดที่รู้ว่าทำงานได้
    - Verify application health
  - **Data Integrity Verification Post-Recovery:**
    - Run data consistency checks
    - Verify critical business data
  - **Recovery Time Objective (RTO):** < 4 ชั่วโมง
  - **Recovery Point Objective (RPO):** < 1 ชั่วโมง

## 4.15. กลยุทธ์การแจ้งเตือน (Notification Strategy - ปรับปรุง)

- ระบบจะส่งการแจ้งเตือน (ผ่าน Email หรือ Line [cite: 2.7]) เมื่อมีการกระทำที่สำคัญ** ดังนี้:
  1. เมื่อมีเอกสารใหม่ (Correspondence, RFA) ถูกส่งมาถึงองค์กรณ์ของเรา
  2. เมื่อมีใบเวียน (Circulation) ใหม่ มอบหมายงานมาที่เรา
  3. (ทางเลือก) เมื่อเอกสารที่เราส่งไป ถูกดำเนินการ (เช่น อนุมัติ/ปฏิเสธ)
  4. (ทางเลือก) เมื่อใกล้ถึงวันครบกำหนด (Deadline) [cite: 3.2.5, 3.6.6, 3.7.5]
- Grouping/Digest
  - กรณีมีการแจ้งเตือนประเภทเดียวกันจำนวนมากในช่วงเวลาสั้นๆ (เช่น Approve เอกสาร 10 ฉบับรวด) ระบบต้อง **รวม (Batch)** เป็น 1 Email/Line Notification เพื่อไม่ให้รบกวนผู้ใช้ (Spamming)
- Notification Delivery Guarantees
  - **At-least-once delivery:** สำหรับ important notifications
  - **Retry mechanism:** ด้วย exponential backoff (max 3 reties)
  - **Dead letter queue:** สำหรับ notifications ที่ส่งไม่สำเร็จหลังจาก retries
  - **Delivery status tracking:** ต้องบันทึกสถานะการส่ง notifications
  - **Fallback channels:** ถ้า Email ล้มเหลว ให้ส่งผ่าน SYSTEM notification
  - **Notification preferences:** ผู้ใช้ต้องสามารถกำหนด channel preferences ได้

## 4.16. Maintenance Mode

- ระบบต้องมีกลไก **Maintenance Mode** ที่ Admin สามารถเปิดใช้งานได้
  - เมื่อเปิด: ผู้ใช้ทั่วไปจะเห็นหน้า "ปิดปรับปรุง" และไม่สามารถเรียก API ได้ (ยกเว้น Admin)
  - ใช้สำหรับช่วง Deploy Version ใหม่ หรือ Database Migration

## 4.17. Monitoring และ Observability

- Application Monitoring
  - **Health checks:** /health endpoint สำหรับ load balancer
  - **Metrics collection:** Response times, error rates, throughput
  - **Distributed tracing:** สำหรับ request tracing across services
  - **Log aggregation:** Structured logging ด้วย JSON format
  - **Alerting:** สำหรับ critical errors และ performance degradation
- Business Metrics
  - จำนวน documents created ต่อวัน
  - Workflow completion rates
  - User activity metrics
  - System utilization rates
  - Search query performance
- Security Monitoring
  - Failed login attempts
  - Rate limiting triggers
  - Virus scan results
  - File download activities
  - Permission changes

## 4.18. JSON Processing & Validation

- JSON Schema Management
  - ต้องมี centralized JSON schema registry
  - ต้องรองรับ schema versioning และ migration
  - ต้องมี schema validation during runtime
- Performance Optimization
  - **Caching:** Cache parsed JSON structures
  - **Compression:** ใช้ compression สำหรับ JSON ขนาดใหญ่
  - **Indexing:** Support JSON path indexing สำหรับ query
- Error Handling
  - ต้องมี graceful degradation เมื่อ JSON validation ล้มเหลว
  - ต้องมี default fallback values
  - ต้องบันทึก error logs สำหรับ validation failures


# 5. UI/UX Guidelines
# 👥 Section 5: UI/UX Requirements (ข้อกำหนดด้านผู้ใช้งาน)
---
title: 'UI/UX Requirements'
version: 1.5.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related:

- specs/02-architecture/data-model.md#correspondence
- specs/03-implementation/backend-guidelines.md#correspondencemodule
---

## 5.1. Layout หลัก

- หน้าเว็บใช้รูปแบบ App Shell ที่ประกอบด้วย
  - Navbar (ส่วนบน): แสดงชื่อระบบ, เมนูผู้ใช้ (Profile), เมนูสำหรับ Document Control/เมนูสำหรับ Admin/Superadmin (จัดการผู้ใช้, จัดการสิทธิ์, และอื่นๆ), และปุ่ม Login/Logout
  - Sidebar (ด้านข้าง): เป็นเมนูหลักสำหรับเข้าถึงส่วนที่เกี่ยวข้องกับเอกสารทั้งหมด เช่น Dashboard, Correspondences, RFA, Drawings
  - Main Content Area: พื้นที่สำหรับแสดงเนื้อหาหลักของหน้าที่เลือก

## 5.2. หน้า Landing Page

- เป็นหน้าแรกที่แสดงข้อมูลบางส่วนของโครงการสำหรับผู้ใช้ที่ยังไม่ได้ล็อกอิน

## 5.3. หน้า Dashboard

- เป็นหน้าแรกหลังจากล็อกอิน ประกอบด้วย
  - การ์ดสรุปภาพรวม (KPI Cards): แสดงข้อมูลสรุปที่สำคัญขององค์กร เช่น จำนวนเอกสาร, งานที่เกินกำหนด
  - ตาราง "งานของฉัน" (My Tasks Table): แสดงรายการงานทั้งหมดจาก Circulation ที่ผู้ใช้ต้องดำเนินการ
  - Security Metrics: แสดงจำนวน files scanned, security incidents, failed login attempts

## 5.4. การติดตามสถานะ

- องค์กรสามารถติดตามสถานะเอกสารทั้งของตนเอง (Originator) และสถานะเอกสารที่ส่งมาถึงตนเอง (Recipient)

## 5.5. การจัดการข้อมูลส่วนตัว (Profile Page)

- ผู้ใช้สามารถจัดการข้อมูลส่วนตัวและเปลี่ยนรหัสผ่านของตนเองได้

## 5.6. การจัดการเอกสารทางเทคนิค (RFA)

- ผู้ใช้สามารถดู RFA ในรูปแบบ Workflow Diagram ทั้งหมดได้ในหน้าเดียว
- Interactive History (เพิ่ม): ในแผนภาพ Workflow ผู้ใช้ต้องสามารถ คลิกที่ Node หรือ Step เก่าที่ผ่านมาแล้ว เพื่อดู Audit Log ย่อยของ Step นั้นได้ทันที (เช่น ใครเป็นคนกด Approve, เวลาไหน, มี Comment อะไร) โดยไม่ต้องสลับไปดูใน Tab History แยกต่างหาก
- ขั้นตอนที่ยังไม่ถึงหรือผ่านไปแล้วจะเป็นรูปแบบ disabled
- สามารถดำเนินการได้เฉพาะในขั้นตอนที่ได้รับมอบหมายงาน (active)
- สิทธิ์ Document Control ขึ้นไป สามารถกด "Force Proceed" ไปยังขั้นตอนต่อไปได้ทุกขั้นตอน, หรือ "Revert" กลับขั้นตอนก่อนหน้าได้

## 5.7. การจัดการใบเวียนเอกสาร (Circulation)

- ผู้ใช้สามารถดู Circulation ในรูปแบบ Workflow ทั้งหมดได้ในหน้าเดียว,ขั้นตอนที่ยังไม่ถึงหรือผ่านไปแล้วจะเป็นรูปแบบ disabled, สามารถดำเนินการได้เฉพาะในขั้นตอนที่ได้รับมอบหมายงาน (active) เช่น ตรวจสอบแล้ว เพื่อไปยังขั้นตอนต่อไป, สิทธิ์ Document Control ขึ้นไป สามารถกด ไปยังขั้นตอนต่อไป ได้ทุกขั้นตอน, การย้อนกลับ ไปขั้นตอนก่อนหน้า สามารถทำได้โดย สิทธิ์ Document Control ขึ้นไป

## 5.8. การจัดการเอกสารนำส่ง (Transmittals)

- ผู้ใช้สามารถดู Transmittals ในรูปแบบรายการทั้งหมดได้ในหน้าเดียว

## 5.9. ข้อกำหนด UI/UX การแนบไฟล์ (File Attachment UX)

- ระบบต้องรองรับการอัปโหลดไฟล์หลายไฟล์พร้อมกัน (Multi-file upload) เช่น การลากและวาง (Drag-and-Drop)
- ในหน้าอัปโหลด (เช่น สร้าง RFA หรือ Correspondence) ผู้ใช้ต้องสามารถกำหนดได้ว่าไฟล์ใดเป็น "เอกสารหลัก" (Main Document เช่น PDF) และไฟล์ใดเป็น "เอกสารแนบประกอบ" (Supporting Attachments เช่น .dwg, .docx, .zip)
- **Security Feedback:** แสดง security warnings สำหรับ file types ที่เสี่ยงหรือ files ที่ fail virus scan
- **File Type Indicators:** แสดง file type icons และ security status

## 5.10 Form & Interaction

- **Dynamic Form Generator:** ใช้ Component กลางที่รับ JSON Schema แล้ว Render Form ออกมาอัตโนมัติ เพื่อลดความซ้ำซ้อนของโค้ดหน้าบ้าน และรองรับเอกสารประเภทใหม่ๆ ได้ทันที
- **Optimistic Updates:** การเปลี่ยนสถานะ (เช่น กด Approve, กด Read) ให้ UI เปลี่ยนสถานะทันทีให้ผู้ใช้เห็นก่อนรอ API Response (Rollback ถ้า Failed)

## 5.11 Mobile Responsiveness

- **Table Visualization:** บนหน้าจอมือถือ ตารางข้อมูลที่มีหลาย Column (เช่น Correspondence List) ต้องเปลี่ยนการแสดงผลเป็นแบบ **Card View** อัตโนมัติ
- **Navigation:** Sidebar ต้องเป็นแบบ Collapsible Drawer

## 5.12 Resilience & Offline Support

- **Auto-Save Draft:** ระบบต้องบันทึกข้อมูลฟอร์มที่กำลังกรอกลง **LocalStorage** อัตโนมัติ เพื่อป้องกันข้อมูลหายกรณีเน็ตหลุดหรือปิด Browser โดยไม่ได้ตั้งใจ
- **State Management:** ใช้ State Management ที่เหมาะสมและไม่ซับซ้อนเกินไป โดยเน้นการใช้ React Query สำหรับ Server State และ React Hook Form สำหรับ Form State
- **Graceful Degradation:** หาก Service รอง (เช่น Search, Notification) ล่ม ระบบหลัก (CRUD) ต้องยังทำงานต่อได้

## 5.13. Secure In-App PDF Viewer (ใหม่)

- 5.13.1 Viewer Capabilities: ระบบต้องมี PDF Viewer ภายในแอปพลิเคชันที่สามารถเปิดดูไฟล์เอกสารหลัก (PDF) ได้ทันทีโดยไม่ต้องดาวน์โหลดลงเครื่อง เพื่อความสะดวกในการตรวจทาน (Review/Approve)
- 5.13.2 Security: การแสดงผลไฟล์ต้อง ห้าม (Disable) การทำ Browser Cache สำหรับไฟล์ Sensitive เพื่อป้องกันการกู้คืนไฟล์จากเครื่อง Client ภายหลัง
- 5.13.3 Performance: ต้องรองรับการส่งข้อมูลแบบ Streaming (Range Requests) เพื่อให้เปิดดูไฟล์ขนาดใหญ่ (เช่น แบบแปลน 50MB+) ได้รวดเร็วโดยไม่ต้องรอโหลดเสร็จทั้งไฟล์

## 🧪 6. Testing Requirements
## 6.1 Unit Testing

- ต้องมี unit tests สำหรับ business logic ทั้งหมด
- Code coverage อย่างน้อย 70% สำหรับ backend services
  - Business Logic: 80%+
  - Controllers: 70%+
  - Utilities: 90%+
- ต้องทดสอบ RBAC permission logic ทุกระดับ

## 6.2 Integration Testing

- ทดสอบการทำงานร่วมกันของ modules
- ทดสอบ database migrations และ data integrity
- ทดสอบ API endpoints ด้วย realistic data

## 6.3 End-to-End Testing

- ทดสอบ complete user workflows
- ทดสอบ document lifecycle จาก creation ถึง archival
- ทดสอบ cross-module integrations

## 6.4 Security Testing

- Penetration Testing: ทดสอบ OWASP Top 10 vulnerabilities
- Security Audit: Review code สำหรับ security flaws
- Virus Scanning Test: ทดสอบ file upload security
- Rate Limiting Test: ทดสอบ rate limiting functionality

## 6.5 Performance Testing

- **Load Testing:** ทดสอบด้วย realistic workloads
- **Stress Testing:** หา breaking points ของระบบ
- **Endurance Testing:** ทดสอบการทำงานต่อเนื่องเป็นเวลานาน

## 6.6 Disaster Recovery Testing

- ทดสอบ backup และ restoration procedures
- ทดสอบ failover mechanisms
- ทดสอบ data integrity หลังการ recovery

## 6.7 Specific Scenario Testing (เพิ่ม)

- **Race Condition Test:** ทดสอบยิง Request ขอเลขที่เอกสารพร้อมกัน 100 Request
  - **Transaction Test:** ทดสอบปิดเน็ตระหว่าง Upload ไฟล์ (ตรวจสอบว่าไม่มี Orphan File หรือ Broken Link)
  - **Permission Test:** ทดสอบ CASL Integration ทั้งฝั่ง Backend และ Frontend ให้ตรงกัน

---
*Version History*
- **v1.5.1** – 2025‑12‑04 – Consolidated requirement specifications into single document.
