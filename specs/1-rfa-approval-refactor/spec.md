# Feature Specification: RFA Approval System Refactor (TeamBinder/InEight-Style)

**Feature Branch**: `1-rfa-approval-refactor`
**Created**: 2026-05-11
**Status**: Draft
**Input**: User description: "refactor ระบบการอนุมัติเอกสาร, RFA ให้เหมือนกับ TeamBinder หรือ InEight"

---

## Overview

ปรับปรุงระบบการอนุมัติเอกสาร RFA (Request for Approval) ให้มีความยืดหยุ่นและครบถ้วนตามมาตรฐานระดับสูงของอุตสาหกรรมก่อสร้าง (TeamBinder, InEight) รองรับการทำงานแบบ Multi-Disciplinary Review, Response Codes มาตรฐาน, และ Distribution Matrix อัตโนมัติ

---

## User Scenarios & Testing

### User Story 1 - Review Teams by Discipline (Priority: P1)

ผู้จัดการโครงการสามารถกำหนดกลุ่มผู้ตรวจสอบ (Review Teams) ตามสาขาวิชา (Disciplines) แทนการระบุรายบุคคล เพื่อให้การมอบหมายงานยืดหยุ่นและรวดเร็ว

**Why this priority**: ฟีเจอร์หลักที่แยกระบบปัจจุบันกับมาตรฐานอุตสาหกรรม - ช่วยลดเวลาในการกำหนดผู้ตรวจสอบและรองรับการเปลี่ยนแปลงบุคคลในโครงการ

**Independent Test**: สามารถทดสอบโดยสร้าง Review Team ที่มีหลาย Disciplines และส่ง RFA เข้า workflow - ระบบต้องสามารถมอบหมายให้ทุก Discipline พร้อมกันได้

**Acceptance Scenarios**:

1. **Given** ผู้ใช้มีสิทธิ์จัดการ Review Teams, **When** สร้าง Review Team ใหม่ชื่อ "Structural Review Team" พร้อมกำหนด Disciplines: Structural, Civil, **Then** ระบบบันทึกทีมและสามารถใช้กับ RFA ได้
2. **Given** RFA ถูกส่งเข้า workflow และใช้ Review Team ที่มี 3 Disciplines, **When** ระบบประมวลผล, **Then** สร้าง Review Tasks สำหรับแต่ละ Discipline พร้อมกัน
3. **Given** Reviewer ในทีมเปลี่ยนตำแหน่งหรือลาออก, **When** Admin อัปเดตสมาชิกใน Review Team, **Then** RFA ที่รออยู่ต้องอัปเดตผู้รับผิดชอบโดยอัตโนมัติ

---

### User Story 2 - Response Codes & Sub-Status (Priority: P1)

วิศวกรสามารถเลือก Response Code มาตรฐาน (1A, 1B, 1C, 2, 3, 4) พร้อม Sub-Status ที่บ่งบอกความหมายเฉพาะทาง เพื่อสื่อสารสถานะงานได้ชัดเจนและสอดคล้องกับมาตรฐานอุตสาหกรรม

**Why this priority**: ปรับปรุงการสื่อสารระหว่างฝ่ายต่างๆ ลดความกำกวมในการอนุมัติ และสนับสนุนการทำ Final Acceptance Certificate (FAC)

**Independent Test**: สามารถทดสอบโดยเปิดหน้าอนุมัติ RFA และตรวจสอบว่า Response Codes แสดงตาม Category ของเอกสาร - เลือก Code 1C ต้องมีการแจ้งเตือนฝ่ายสัญญา

**Acceptance Scenarios**:

1. **Given** RFA ประเภท Shop Drawing, **When** Reviewer เปิดหน้าอนุมัติ, **Then** แสดงเฉพาะ Response Codes ที่เกี่ยวข้องกับ Engineering/Drawings (1A-1G, 2, 3, 4)
2. **Given** Reviewer เลือก Code 1C (Change Order) หรือ 1D (Alternative), **When** บันทึกการอนุมัติ, **Then** ระบบส่งแจ้งเตือนไปยังฝ่ายสัญญา/BOQ อัตโนมัติ
3. **Given** RFA ได้รับ Code 2 (Approved as Noted), **When** ดูรายงานสถานะ, **Then** แสดงสถานะ "Approved with Minor Comments" พร้องานที่ต้องแก้ไข

---

### User Story 3 - Delegation & Proxy (Priority: P2)

ผู้ตรวจสอบสามารถมอบหมายอำนาจ (Delegate) ให้ผู้อื่นทำงานแทนเมื่อไม่อยู่หรือไม่สะดวก โดยกำหนดระยะเวลาและขอบเขตอำนาจได้

**Why this priority**: ป้องกันการคั่งค้างของ workflow เมื่อผู้ตรวจสอบไม่ว่าง รองรับการทำงานแบบ Hybrid/Remote

**Independent Test**: สามารถทดสอบโดยผู้ใช้ A ตั้งค่า Delegate ให้ผู้ใช้ B แล้วส่ง RFA มา - ผู้ใช้ B ต้องเห็นงานใน Inbox และสามารถอนุมัติแทนได้

**Acceptance Scenarios**:

1. **Given** ผู้ใช้ต้องการลาพักร้อน 1 สัปดาห์, **When** ตั้งค่า Delegation ให้ colleague พร้อมระบุวันที่เริ่ม-สิ้นสุด, **Then** งานที่ส่งมาระหว่างนี้ไปที่ Delegatee โดยอัตโนมัติ
2. **Given** มีงาน RFA รออยู่ใน Inbox และผู้ใช้ตั้งค่า Delegation ไว้, **When** มีการส่งงานใหม่เข้ามา, **Then** ระบบมอบหมายให้ Delegatee พร้อมแสดงว่าเป็น "Delegated from [Original User]"
3. **Given** Delegation หมดอายุ, **When** มีงานใหม่ส่งมา, **Then** งานกลับมาที่ผู้ใช้เจ้าของงานเดิม และยกเลิกสิทธิ์ Delegatee

---

### User Story 4 - Auto-Reminders & Escalation (Priority: P2)

ระบบส่งการแจ้งเตือนอัตโนมัติเมื่องานใกล้ครบกำหนด และส่งขึ้นระดับ (Escalate) เมื่อเกินกำหนด ตาม SLA ที่กำหนดไว้

**Why this priority**: ลดความล่าช้าใน workflow และปรับปรุง on-time delivery rate ของเอกสาร

**Independent Test**: สามารถทดสอบโดยสร้าง RFA ที่มี Due Date ในอีก 1 วัน และตรวจสอบว่าระบบส่ง Reminder ตามที่ตั้งค่าไว้

**Acceptance Scenarios**:

1. **Given** RFA มี Due Date ในอีก 2 วัน, **When** ถึงเวลา 9:00 ของวันที่ตั้งค่า Reminder, **Then** ส่งอีเมล/แจ้งเตือนไปยังผู้รับผิดชอบ
2. **Given** RFA เกินกำหนด 1 วัน, **When** ถึงเงื่อนไข Escalation, **Then** ส่งแจ้งเตือนไปยัง Manager ของผู้รับผิดชอบ พร้อมสถานะ Overdue
3. **Given** Admin ตั้งค่า Reminder Frequency เป็น "Daily" สำหรับงาน Overdue, **When** งานค้างเกินกำหนด, **Then** ส่ง Reminder ทุกวันจนกว่าจะดำเนินการ

---

### User Story 5 - Distribution Matrix (Priority: P2)

ระบบกระจายเอกสารอัตโนมัติไปยังผู้ที่เกี่ยวข้องหลังจาก RFA ได้รับการอนุมัติ ตาม Distribution Matrix ที่กำหนดไว้ตามประเภทเอกสารและ Response Code

**Why this priority**: ลด manual work ในการส่งเอกสารต่อ ป้องกันการส่งตกหล่น และสนับสนุนการทำ Transmittal อัตโนมัติ

**Independent Test**: สามารถทดสอบโดยอนุมัติ RFA ที่มี Distribution Matrix แล้วตรวจสอบว่าเอกสารถูกส่งไปยังผู้รับที่กำหนดใน Matrix โดยอัตโนมัติ

**Acceptance Scenarios**:

1. **Given** RFA ประเภท Shop Drawing ได้รับ Code 1A (Full Approval), **When** อนุมัติสำเร็จ, **Then** ระบบส่งเอกสารไปยัง Site Team, QS, และ Document Control ตาม Distribution Matrix
2. **Given** Distribution Matrix มีเงื่อนไข "Send only if Code = 1A, 1B, or 2", **When** RFA ได้รับ Code 3 (Rejected), **Then** ไม่ส่งเอกสารตาม Matrix (แจ้งเฉพาะผู้ส่ง)
3. **Given** Admin อัปเดต Distribution Matrix เพิ่มผู้รับใหม่, **When** RFA ถัดไปได้รับการอนุมัติ, **Then** ส่งเอกสารไปยังผู้รับใหม่ด้วย

---

### User Story 6 - Master Approval Matrix Management (Priority: P3)

ผู้ดูแลระบบสามารถจัดการ Master Approval Matrix ที่เป็นมาตรฐานขององค์กร แยกตามหมวดงานและสถานะย่อย ให้ใช้งานทั่วทั้งโครงการ

**Why this priority**: มาตรฐานการอนุมัติให้สอดคล้องกับบริษัทและอุตสาหกรรม ลดความสับสนในการใช้ Response Codes

**Independent Test**: สามารถทดสอบโดยสร้าง Master Approval Matrix ใหม่ และตรวจสอบว่า RFA แสดง Response Codes ตาม Matrix ที่กำหนด

**Acceptance Scenarios**:

1. **Given** Admin ต้องการสร้างมาตรฐานใหม่สำหรับโครงการก่อสร้างสะพาน, **When** สร้าง Master Approval Matrix พร้อมกำหนดหมวดงานและ Sub-status, **Then** สามารถใช้กับโครงการที่เลือกได้
2. **Given** Master Approval Matrix ถูกใช้งานในโครงการหลายแห่ง, **When** Admin แก้ไข Matrix, **Then** ระบบแสดง Warning ว่าจะมีผลกับโครงการที่ใช้งานอยู่

---

### Edge Cases

1. **Race Condition**: สอง Reviewer ในทีมเดียวกันกดอนุมัติพร้อมกัน - ระบบต้องจัดการด้วย Optimistic Locking หรือ Redlock
2. **Circular Delegation**: ผู้ใช้ A Delegate ให้ B, B Delegate ให้ C, C พยายาม Delegate ให้ A - ระบบต้องตรวจจับและป้องกัน
3. **Expired Review Task**: Review Task ค้างนานเกินกำหนดและถูก Reassign - ต้องบันทึกประวัติการเปลี่ยนแปลง
4. **Invalid Response Code**: Reviewer พยายามใช้ Response Code ที่ไม่สอดคล้องกับ Category ของเอกสาร - ระบบต้องแสดงข้อผิดพลาดและไม่บันทึก
5. **Concurrent Review**: หลาย Disciplines ต้อง Review พร้อมกัน แต่มี Discipline หนึ่งปฏิเสธ - ต้องหยุด workflow และแจ้งผู้ส่ง

---

## Requirements

### Functional Requirements

**Review Teams & Disciplines**
- **FR-001**: ระบบ MUST รองรับการสร้าง Review Teams ที่มีหลาย Disciplines
- **FR-002**: Review Teams MUST สามารถกำหนดเป็น Default ตามประเภท RFA ได้
- **FR-003**: เมื่อ RFA เข้า workflow ที่ใช้ Review Team, ระบบ MUST สร้าง Review Tasks สำหรับแต่ละ Discipline พร้อมกัน (Parallel Review)
- **FR-004**: Review Tasks MUST แสดงสถานะรวม (Aggregate Status) เช่น "2 of 3 Disciplines Approved"
- **FR-004.5**: Parallel Review MUST ใช้กฎ Majority with Veto - หากส่วนใหญ่อนุมัติให้ผ่าน แต่หากมี Discipline ใดให้ Code 3 (Rejected) ต้องหยุด workflow และส่งกลับให้แก้ไข

**Response Codes & Master Approval Matrix**
- **FR-005**: ระบบ MUST ใช้ Master Approval Matrix ตามมาตรฐานที่กำหนด
- **FR-006**: Response Codes MUST แสดงตาม Category ของเอกสาร (Engineering, Material, Contract, Testing, ESG)
- **FR-007**: Code 1C (Change Order), 1D (Alternative), 3 (Rejected) MUST trigger การแจ้งเตือนไปยังฝ่ายที่เกี่ยวข้องโดยอัตโนมัติ
- **FR-008**: ระบบ MUST บันทึกประวัติการเปลี่ยน Response Code (Audit Trail)
- **FR-009**: Reviewer MUST สามารถเพิ่ม Comments พร้อม Response Code ได้

**Delegation & Proxy**
- **FR-010**: ผู้ใช้ MUST สามารถตั้งค่า Delegation ได้ พร้อมกำหนดระยะเวลาเริ่มต้น-สิ้นสุด
- **FR-011**: Delegation MUST รองรับการกำหนด Scope (เฉพาะบางประเภทเอกสาร หรือทั้งหมด)
- **FR-012**: ระบบ MUST ตรวจจับ Circular Delegation และป้องกัน
- **FR-013**: เมื่อ Delegation หมดอายุ, งานใหม่ MUST กลับไปยังผู้ใช้เดิมโดยอัตโนมัติ
- **FR-014**: Delegatee MUST เห็นงานที่ได้รับมอบหมายแยกจากงานของตนเอง (Badge "Delegated")

**Auto-Reminders & Escalation**
- **FR-015**: ระบบ MUST ส่ง Reminder ตาม Schedule ที่กำหนด (1 วันก่อน Due, วัน Due, ทุกวันหลัง Due)
- **FR-016**: Escalation MUST ส่งแจ้งเตือนไปยัง Manager เมื่องาน Overdue ตามเกณฑ์ที่ตั้งไว้
- **FR-017**: Admin MUST สามารถตั้งค่า Reminder Rules ต่อโครงการ/ประเภทเอกสารได้
- **FR-018**: ระบบ MUST บันทึกประวัติการส่ง Reminder (ส่งเมื่อไหร่, ใครได้รับ)

**Frontend Workflow Visualization**
- **FR-019.1**: Parallel Review MUST แสดงผลด้วย **Horizontal Stepper** - แถบความคืบหนันแนวนอนแสดงสถานะแต่ละ Discipline [Structural ▓▓▓░] [Civil ▓▓▓▓] [MEP ▓░░░]
- **FR-019.2**: เมื่อมี Code 3 (Rejected) จาก Discipline ใด MUST แสดง **Modal Dialog** แจ้งการ Veto พร้อมรายละเอียด Discipline ที่ reject
- **FR-019.3**: Navigation ระหว่าง Discipline details MUST ใช้ **Side Panel** layout - ซ้ายรายการ Disciplines, ขวาแสดงรายละเอียด Comments + Attachments ของ Discipline ที่เลือก
- **FR-019.4**: Project Manager MUST สามารถ **Override Veto** ได้ - บังคับผ่าน RFA แม้มี Code 3 จาก Discipline พร้อมบันทึกเหตุผล, Audit trail ว่าเป็น forced approval, และแจ้งเตือนทุก stakeholder ที่เกี่ยวข้อง

**Distribution Matrix**
- **FR-019**: Distribution Matrix MUST กำหนดผู้รับตาม: ประเภทเอกสาร + Response Code + สถานะเอกสาร
- **FR-020**: ระบบ MUST สร้าง Transmittal Records อัตโนมัติหลังการอนุมัติตาม Distribution Matrix ผ่าน BullMQ Queue (Async, ภายใน 5 นาที)
- **FR-021**: Distribution Matrix MUST รองรับเงื่อนไข "Send Only If" (เช่น Code 1A, 1B เท่านั้น)
- **FR-022**: ระบบ MUST แสดงรายงาน Distribution Status (ส่งแล้วกี่ราย, ค้างกี่ราย)

**Integration with Existing Systems**
- **FR-023**: ต้องใช้ Unified Workflow Engine (ADR-001) ที่มีอยู่แล้ว
- **FR-024**: ต้องใช้ BullMQ (ADR-008) สำหรับ Reminders และ Distribution Jobs
- **FR-025**: ต้องใช้ CASL (ADR-016) สำหรับสิทธิ์ Reviewer และ Delegation

### Key Entities

**ReviewTeam**
- ตัวแทนกลุ่มผู้ตรวจสอบที่จัดการตามสาขาวิชา
- Attributes: name, description, projectId, defaultForRfaTypes, isActive
- Relationships: has many ReviewTeamMember, has many ReviewTask

**ReviewTeamMember**
- สมาชิกใน Review Team พร้อม Discipline ที่รับผิดชอบ
- Attributes: teamId, userId, disciplineId, role, priorityOrder
- Relationships: belongs to ReviewTeam, belongs to User, belongs to Discipline

**ReviewTask**
- งานตรวจสอบที่สร้างเมื่อ RFA เข้า workflow
- Attributes: rfaRevisionId, teamId, disciplineId, assignedToUserId, status, dueDate, responseCode, comments
- Relationships: belongs to RfaRevision, belongs to ReviewTeam

**ResponseCodeMatrix**
- Master Approval Matrix ที่กำหนด Response Codes ตาม Category
- Attributes: code, subStatus, category, descriptionTh, descriptionEn, implications, requiresNotificationTo
- Relationships: has many ResponseCodeRule

**ResponseCodeRule**
- กฎการใช้ Response Code ตามประเภทเอกสาร
- Attributes: matrixId, documentTypeId, isEnabled, requiresComments, triggersNotification

**Delegation**
- การมอบหมายอำนาจจากผู้ใช้หนึ่งไปอีกผู้ใช้
- Attributes: delegatorId, delegateeId, startDate, endDate, scope, documentTypes, isActive
- Relationships: belongs to User (delegator), belongs to User (delegatee)

**ReminderRule**
- กฎการส่ง Reminder ตาม SLA
- Attributes: name, projectId, documentTypeId, triggerDays, reminderType, recipients, messageTemplate
- Relationships: has many ReminderSchedule

**DistributionMatrix**
- กำหนดการกระจายเอกสารหลังอนุมัติ
- Attributes: name, documentTypeId, responseCode, status, recipients, conditions, isActive
- Relationships: has many DistributionRecipient

**DistributionRecipient**
- ผู้รับเอกสารใน Distribution Matrix
- Attributes: matrixId, recipientType (USER/ORGANIZATION/TEAM), recipientId, deliveryMethod

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: ผู้ใช้สามารถกำหนด Review Team ได้ในเวลาน้อยกว่า 2 นาที (เทียบกับระบบเดิมที่ต้องเลือกรายบุคคล)
- **SC-002**: Response Code ถูกใช้งานได้ถูกต้อง 95%+ ของเวลาทั้งหมด (ลดการใช้ผิดประเภท)
- **SC-003**: ลดเวลาในการอนุมัติ RFA โดยเฉลี่ย 30% จากการใช้ Parallel Review และ Response Codes ที่ชัดเจน
- **SC-004**: 0% ของเอกสารที่ค้างงานเนื่องจากผู้ตรวจสอบไม่อยู่ (ใช้ Delegation)
- **SC-005**: 100% ของเอกสารที่อนุมัติถูกกระจายตาม Distribution Matrix โดยไม่ต้อง manual intervention
- **SC-006**: On-time delivery rate ของ RFA ปรับปรุงจาก baseline เป็นอย่างน้อย 85%
- **SC-007**: ผู้ใช้พึงพอใจกับระบบอนุมัติใหม่ (NPS > 40)

---

## Clarifications

### Session 2026-05-11

- **Q1**: Master Approval Matrix scope and inheritance model? → **A**: Global base + Project overrides - Default Matrix inherited organization-wide, projects can override specific codes/rules as needed (Option B)
- **Q2**: Parallel Review consensus model when Disciplines have conflicting decisions? → **A**: Majority with veto - All Disciplines submit responses, majority determines outcome, but Code 3 (Rejected) from any Discipline vetoes approval and requires revision (Option C)
- **Q3**: Escalation chain depth for overdue RFA reviews? → **A**: 2 levels - Direct manager first, then Project Manager/Director if still unresolved after additional delay (Option B)
- **Q4**: Distribution Matrix execution timing relative to approval? → **A**: Async after approval - Approval returns immediately, distribution queued via BullMQ and processed automatically within 5 minutes (Option C)
- **Q5**: Frontend pattern for displaying Parallel Review progress? → **A**: Horizontal Stepper - แถบความคืบหนันแนวนอนแสดงสถานะแต่ละ Discipline (Option A)
- **Q6**: How to display Veto/Consensus status when Code 3 triggered? → **A**: Modal Dialog - Popup แจ้งเมื่อมีการ Veto พร้อมรายละเอียด Discipline ที่ reject (Option B)
- **Q7**: Navigation pattern between Discipline details for Reviewer? → **A**: Side Panel - ซ้ายรายการ Disciplines, ขวาแสดงรายละเอียดที่เลือก (Option D)
- **Q8**: Can Veto be overridden and by whom? → **A**: Project Manager Override - PM สามารถบังคับผ่าน Veto ได้ พร้อมบันทึกเหตุผล และแจ้งเตือนทุก stakeholder (Option B)

---

## Assumptions

1. **ผู้ใช้มีความคุ้นเคยกับ Response Codes มาตรฐานอุตสาหกรรม** - จำเป็นต้องมี Training Material ประกอบ
2. **โครงสร้าง Discipline Master Data มีอยู่แล้ว** - ใช้จากระบบ User Management ที่มีอยู่
3. **Unified Workflow Engine (ADR-001) มีความสามารถรองรับ Parallel Tasks** - อาจต้องปรับปรุง DSL
4. **BullMQ Infrastructure พร้อมใช้งาน** - สำหรับ Reminders และ Background Jobs

---

## Dependencies

- **ADR-001**: Unified Workflow Engine (ต้องรองรับ Parallel Review Tasks)
- **ADR-008**: BullMQ Notification Strategy
- **ADR-016**: CASL Authorization (สำหรับ Reviewer สิทธิ์)
- **ADR-019**: UUID Strategy (สำหรับ Entities ใหม่)
- **ADR-021**: Workflow Context (สำหรับ Step Attachments)
- **Existing**: Discipline, User, Organization Master Data

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ผู้ใช้ไม่คุ้นเคยกับ Response Codes ใหม่ | High | ทำ Training Workshop พร้อม Quick Reference Guide |
| Workflow Engine ไม่รองรับ Parallel Review | High | ประเมิน DSL ก่อนเริ่ม, อาจต้อง Refactor Engine |
| Performance ช้าจาก Complex Matrix Lookup | Medium | ทำ Caching สำหรับ Matrix และ Rules |
| Circular Delegation ซับซ้อน | Low | Validation ตั้งแต่ต้น, Limit depth ของ chain |
