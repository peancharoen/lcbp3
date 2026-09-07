// File: specs/200-fullstacks/253-unified-doc-crud/spec.md
// Change Log:
// - 2026-09-06: Initial specification for Unified Document CRUD Management with Admin Maintenance Tools

# Feature Specification: Unified Document CRUD Management with Admin Maintenance Tools

**Feature Branch**: `253-unified-doc-crud`
**Created**: 2026-09-06
**Status**: Draft
**Category**: 200-fullstacks
**Input**: User description: "Admin console ยังไม่มี page การจัดการ correspondence/RFA/Drawings/Circulation/Transmittals ที่สามารถจัดการได้แบบ (CRUD) ที่ทำได้ทุกอย่าง ถึงแม้จะมีใน Dashboard ก็ไม่คลอบคลุม ควรใช้ Dashboard ในการจัดการ เช่น เพิ่ม CRUD ให้ครบแล้วจำกัดสิทธิ์ หรือแยกส่วน"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Document Controller ยกเลิกเอกสารจากหน้า Dashboard (Priority: P1)

Document Controller (DC) เปิดหน้ารายการ Correspondences ใน Dashboard เห็นตารางเอกสารทั้งหมด กดเมนูจุดสามจุด (⋯) ที่แถวของเอกสารที่ต้องการยกเลิก เลือก "ยกเลิกเอกสาร" ระบบแสดง Dialog ให้กรอกเหตุผลพร้อมคำเตือนว่าการยกเลิกจะปิดใบเวียนที่เกี่ยวข้องทั้งหมด DC กรอกเหตุผลและยืนยัน ระบบเปลี่ยนสถานะเป็น CANCELLED ปิด Circulation ที่ผูกอยู่ ยุติ Workflow ส่งการแจ้งเตือนไปยังผู้เกี่ยวข้อง และอัปเดตดัชนีค้นหา จากนั้นแสดง Toast สรุปผลว่า "ยกเลิกสำเร็จ — ปิดใบเวียน 2 รายการ ส่งการแจ้งเตือน 5 รายการ"

**Why this priority**: การยกเลิกเอกสารเป็นการกระทำที่ DC ทำบ่อยที่สุดในงานประจำวัน และเป็นพื้นฐานของระบบจัดการเอกสารที่สมบูรณ์ หากไม่มี DC จะไม่สามารถจัดการเอกสารที่สร้างผิดหรือเปลี่ยนแปลงได้

**Independent Test**: สามารถทดสอบได้โดยสร้าง Correspondence สถานะ IN_REVIEW จากนั้นให้ DC กด Cancel จาก Row Action Dropdown และยืนยันว่าสถานะเปลี่ยนเป็น CANCELLED พร้อม side effects ครบถ้วน

**Acceptance Scenarios**:

1. **Given** DC เปิดหน้า Correspondences Dashboard, **When** กด ⋯ ที่แถวเอกสารสถานะ IN_REVIEW แล้วเลือก "ยกเลิกเอกสาร" กรอกเหตุผลและยืนยัน, **Then** เอกสารเปลี่ยนสถานะเป็น CANCELLED Circulation ที่ผูกอยู่ถูกปิดแบบบังคับ Workflow ถูกยุติ และแสดง Toast สรุป side effects
2. **Given** ผู้ใช้ทั่วไป (ไม่ใช่ DC/Admin) เปิดหน้า Correspondences, **When** กด ⋯ ที่แถวเอกสาร, **Then** เห็นเฉพาะ "ดูรายละเอียด" ไม่เห็นเมนู "ยกเลิกเอกสาร" เพราะไม่มีสิทธิ์
3. **Given** DC พยายามยกเลิกเอกสารที่สถานะ CANCELLED อยู่แล้ว, **When** กด ⋯, **Then** เมนู "ยกเลิกเอกสาร" ถูกซ่อนหรือ disabled เพราะเป็น idempotent
4. **Given** DC ยกเลิกเอกสารที่มี Circulation 2 ใบผูกอยู่, **When** ยืนยันการยกเลิก, **Then** Circulation ทั้ง 2 ใบถูก force-close พร้อมเหตุผล "Correspondence cancelled: [reason]" และผู้รับที่ยัง pending ได้รับการแจ้งเตือน

---

### User Story 2 - DC แก้ไขข้อมูลกำกับเอกสารหลังส่งแล้ว (Priority: P1)

DC เปิดหน้ารายละเอียดเอกสาร Correspondence ที่สถานะ IN_REVIEW พบว่าพิมพ์ Subject ผิดและลืมใส่ Tag DC กด "แก้ไขข้อมูลกำกับ" ระบบเปิด Dialog ให้แก้ไขเฉพาะฟิลด์ Tier 1 (Subject, Remarks, Due Date, Tags, CC Recipients) DC แก้ Subject และเพิ่ม Tag แล้วบันทึก ระบบบันทึก Audit Trail พร้อม Before/After Diff และแจ้งผู้รับว่าเอกสารถูกแก้ไขข้อมูลกำกับ

**Why this priority**: การพิมพ์ผิดในเอกสารที่ส่งแล้วเป็นปัญหาที่เกิดบ่อยในงานก่อสร้าง หากไม่สามารถแก้ไข Metadata ได้ DC ต้องยกเลิกเอกสารและสร้างใหม่ ทำให้เลขที่เอกสารกระโดดและเพิ่มภาระงานมหาศาล

**Independent Test**: สร้าง Correspondence สถานะ IN_REVIEW จากนั้นให้ DC กด "แก้ไขข้อมูลกำกับ" เปลี่ยน Subject และเพิ่ม Tag ยืนยันว่าข้อมูลเปลี่ยน Audit Trail บันทึก Before/After Diff และผู้รับได้รับการแจ้งเตือน

**Acceptance Scenarios**:

1. **Given** DC เปิดหน้ารายละเอียดเอกสารสถานะ IN_REVIEW, **When** กด "แก้ไขข้อมูลกำกับ" เปลี่ยน Subject และเพิ่ม Tag แล้วบันทึก, **Then** Subject และ Tag อัปเดต Audit Trail บันทึก Before/After Diff และผู้รับได้รับการแจ้งเตือน
2. **Given** DC พยายามแก้ไขเอกสารสถานะ CANCELLED, **When** กด "แก้ไขข้อมูลกำกับ", **Then** ปุ่มถูก disabled เพราะห้ามแก้เอกสารที่ยกเลิกแล้ว
3. **Given** DC 2 คนแก้ไขเอกสารเดียวกันพร้อมกัน, **When** คนที่ 2 บันทึกหลังคนที่ 1, **Then** ระบบปฏิเสธพร้อมแจ้ง "เอกสารถูกแก้โดยผู้ใช้อื่น กรุณารีเฟรชหน้านี้" (Optimistic Lock)
4. **Given** DC พยายามแก้ไขฟิลด์ Tier 3 (เลขที่เอกสาร, ผู้ออกเอกสาร, โครงการ), **When** เปิด Dialog แก้ไขข้อมูลกำกับ, **Then** ฟิลด์เหล่านี้ไม่ปรากฏใน Dialog เพราะเป็น Tier 3 (Never Editable)

---

### User Story 3 - Superadmin ลบถาวรเอกสารที่นำเข้าผิดพลาด (Priority: P2)

Superadmin เปิดหน้ารายละเอียดเอกสารที่นำเข้าจากระบบเก่าผิดพลาดอย่างร้ายแรง กด "ลบถาวร" ระบบแสดง Dialog สีแดงพร้อมคำเตือนว่า "การลบถาวรจะลบไฟล์ ข้อมูล และเวกเตอร์ค้นหาทั้งหมด ไม่สามารถกู้คืนได้" และให้พิมพ์ "DELETE" เพื่อยืนยัน Superadmin พิมพ์ยืนยัน ระบบลบ physical files, Qdrant vectors, DB rows พร้อมบันทึก Snapshot ก่อนลบใน Audit Trail

**Why this priority**: การลบถาวรเป็นสิทธิ์ที่ใช้น้อยแต่จำเป็นสำหรับกรณีฉุกเฉิน เช่น นำเข้าข้อมูลผิดพลาด หรือล้างข้อมูลทดสอบ ต้องจำกัดเฉพาะ Superadmin เพื่อความปลอดภัย

**Independent Test**: สร้างเอกสารทดสอบพร้อมไฟล์แนบและ Qdrant vector จากนั้นให้ Superadmin กด Hard Delete ยืนยัน ตรวจสอบว่าไฟล์ ฐานข้อมูล และ vectors ถูกลบหมด และ Audit Trail มี Snapshot ก่อนลบ

**Acceptance Scenarios**:

1. **Given** Superadmin เปิดหน้ารายละเอียดเอกสาร, **When** กด "ลบถาวร" พิมพ์ "DELETE" ยืนยัน, **Then** physical files, Qdrant vectors, DB rows ถูกลบทั้งหมด และ Audit Trail บันทึก Snapshot ก่อนลบ
2. **Given** DC (ไม่ใช่ Superadmin) เปิดหน้ารายละเอียดเอกสาร, **When** มองหาปุ่ม "ลบถาวร", **Then** ปุ่มไม่ปรากฏเพราะต้องการสิทธิ์ system.manage_all
3. **Given** Superadmin ลบถาวร Transmittal, **When** ยืนยัน, **Then** ลบเฉพาะ transmittals + transmittal_items เท่านั้น ไม่ลบ Correspondence ต้นทาง และไม่ลบเอกสารที่ถูกนำส่ง (items)
4. **Given** Superadmin ลบถาวรเอกสารที่มี Qdrant vector, **When** Qdrant deletion ล้มเหลว, **Then** ระบบเก็บลง pending_vector_deletions เพื่อ retry ภายหลัง และรายงาน vectorDeletionStatus = PENDING_RETRY

---

### User Story 4 - DC ยกเลิกเอกสารเป็นชุด (Bulk Cancel) (Priority: P2)

DC เปิดหน้ารายการ Correspondences เลือก Checkbox หน้า 5 เอกสารที่ต้องการยกเลิกพร้อมกัน แถบ Bulk Action Bar ปรากฏด้านล่างแสดง "เลือกแล้ว 5 รายการ" DC กด "ยกเลิกเป็นชุด" ระบบแสดง Dialog ให้กรอกเหตุผลร่วม DC กรอกเหตุผลและยืนยัน ระบบประมวลผลทีละรายการพร้อมแสดง Progress Bar เมื่อเสร็จแสดง Dialog สรุปผล: 4 รายการสำเร็จ 1 รายการล้มเหลว (พร้อมเหตุผล)

**Why this priority**: ในโครงการก่อสร้างขนาดใหญ่ DC ต้องจัดการเอกสารวันละหลายร้อยฉบับ การยกเลิกทีละฉบับใช้เวลานาน Bulk Operations ช่วยลดเวลาได้มหาศาล

**Independent Test**: สร้าง 5 เอกสาร (3 สถานะ IN_REVIEW, 1 สถานะ DRAFT, 1 สถานะ CANCELLED) เลือกทั้ง 5 แล้วกด Bulk Cancel ยืนยันว่าระบบกรองเอกสาร CANCELLED ออก ประมวลผล 4 รายการ และรายงานผลแยกสำเร็จ/ล้มเหลว

**Acceptance Scenarios**:

1. **Given** DC เลือก Checkbox 5 เอกสารในหน้า Correspondences, **When** กด "ยกเลิกเป็นชุด" กรอกเหตุผลและยืนยัน, **Then** ระบบประมวลผลทีละรายการ แสดง Progress Bar และ Dialog สรุปผล success/failed
2. **Given** DC เลือก Checkbox เอกสารที่สถานะ CANCELLED อยู่แล้ว, **When** กด Bulk Cancel, **Then** ระบบแสดง warning ว่า "เลือกได้เฉพาะเอกสารที่ยังไม่ถูกยกเลิก" และ disable Checkbox ของ CANCELLED items
3. **Given** DC เลือก Checkbox มากกว่า 100 รายการ, **When** พยายามเลือกเพิ่ม, **Then** ระบบปฏิเสธพร้อมแจ้ง "เลือกได้สูงสุด 100 รายการ"
4. **Given** DC ทำ Bulk Cancel 5 รายการ โดย 1 รายการล้มเหลว, **When** ประมวลผลเสร็จ, **Then** Audit Trail บันทึกแยก per-item พร้อม bulkId ร่วมเพื่อให้ query กลุ่มได้

---

### User Story 5 - System Admin ใช้ Maintenance Console ซ่อมแซมระบบ (Priority: P3)

System Admin เปิดหน้า Admin Console → Document Maintenance เห็น 4 แท็บ: Numbering Tools, Orphan Cleanup, Vector Sync, Emergency Unlock ในแท็บ Orphan Cleanup กด "สแกนหาไฟล์ขยะ" ระบบสแกนหาไฟล์ใน Storage ที่ไม่มีเอกสารผูกอยู่ แสดงรายการพร้อมขนาดพื้นที่ที่จะประหยัดได้ System Admin กด "ล้างไฟล์ขยะ" ระบบลบไฟล์และบันทึก Audit Log

**Why this priority**: Maintenance Tools เป็นเครื่องมือสำหรับ System Admin ในการดูแลสุขภาพของระบบในระยะยาว ไม่ใช่งานประจำวัน แต่จำเป็นต้องมีเพื่อป้องกันปัญหาสะสม เช่น ไฟล์ขยะ เวกเตอร์ตกหล่น เลขที่ติดล็อก

**Independent Test**: สร้างไฟล์ขยะใน Storage (อัปโหลดแล้วยกเลิก) จากนั้นให้ System Admin เปิด Orphan Cleanup สแกนและลบ ยืนยันว่าไฟล์ถูกลบและ Audit Log บันทึก

**Acceptance Scenarios**:

1. **Given** System Admin เปิดหน้า Admin Console → Document Maintenance, **When** เปิดแท็บ Orphan Cleanup และกด "สแกน", **Then** ระบบแสดงรายการไฟล์ที่ไม่มีเอกสารผูกอยู่พร้อมขนาด
2. **Given** System Admin เปิดแท็บ Numbering Tools, **When** กด "ตรวจสอบช่องว่างเลขที่", **Then** ระบบแสดงเลขที่ที่หายไป (Sequence Gap) พร้อมตัวเลือก Manual Override หรือ Void & Replace
3. **Given** System Admin เปิดแท็บ Vector Sync, **When** กด "ตรวจสอบเอกสารที่ยังไม่ได้ Embed", **Then** ระบบแสดงรายการเอกสารที่ตกหล่นจาก Qdrant พร้อมปุ่ม Batch Re-embed
4. **Given** System Admin เปิดแท็บ Emergency Unlock, **When** ตรวจพบเอกสารที่ติดค้าง Lock, **Then** ระบบแสดงรายการและปุ่ม Force Release Lock

---

### User Story 6 - ผู้ใช้ทั่วไปสร้างและแก้ไขเอกสารในสถานะ DRAFT (Priority: P1)

ผู้ใช้ทั่วไปสร้าง Correspondence ใหม่ กรอกข้อมูล และบันทึกเป็น DRAFT จากนั้นกลับมาแก้ไขเนื้อหา (Body, Attachments, Recipients) ได้ตามต้องการ จนกว่าจะกด Submit เมื่อ Submit แล้วเอกสารเข้าสู่กระบวนการ Workflow และผู้ใช้ทั่วไปไม่สามารถแก้ไขเนื้อหาได้อีก (ต้องออก Revision ใหม่หรือให้ DC แก้ Metadata)

**Why this priority**: การสร้างและแก้ไขเอกสารในสถานะ DRAFT เป็นฟังก์ชันพื้นฐานที่มีอยู่แล้วในระบบ แต่ต้องยืนยันว่ายังทำงานได้ถูกต้องหลังเพิ่ม Actions ใหม่ และว่ากฎ 2-Tier Edit ไม่กระทบการทำงานปกติของผู้ใช้ทั่วไป

**Independent Test**: ผู้ใช้ทั่วไปสร้าง Correspondence บันทึกเป็น DRAFT แก้ไขเนื้อหา แล้ว Submit ยืนยันว่าหลัง Submit ผู้ใช้ทั่วไปไม่สามารถแก้ไขเนื้อหาได้ แต่ DC สามารถแก้ Metadata ได้

**Acceptance Scenarios**:

1. **Given** ผู้ใช้ทั่วไปสร้าง Correspondence ใหม่, **When** กรอกข้อมูลและบันทึก, **Then** เอกสารถูกสร้างเป็นสถานะ DRAFT และผู้ใช้สามารถแก้ไขได้ทุกฟิลด์
2. **Given** ผู้ใช้ทั่วไปกด Submit, **When** เอกสารเข้าสู่ IN_REVIEW, **Then** ผู้ใช้ไม่สามารถแก้ไขเนื้อหา (Body, Attachments, Recipients) ได้อีก ต้องออก Revision ใหม่หรือให้ DC แก้ Metadata
3. **Given** ผู้ใช้ทั่วไปพยายามแก้ไขเอกสารสถานะ APPROVED, **When** กดแก้ไข, **Then** ระบบปฏิเสธพร้อมแจ้ง "เอกสารนี้อนุมัติแล้ว ไม่สามารถแก้ไขได้ กรุณาติดต่อ Document Controller หรือออก Revision ใหม่"

---

### Edge Cases

- **ยกเลิกเอกสารที่ไม่มี Circulation ผูกอยู่**: ระบบดำเนินการ Cancel ปกติโดยไม่มี side effect ของ Circulation
- **ยกเลิกเอกสารที่มี Workflow ค้างอยู่หลาย instance**: ระบบยุติ Workflow ทั้งหมด ถ้ายุติไม่ได้ (critical fail) ให้ rollback ทั้ง Cancel
- **Hard-Delete เอกสารที่มีไฟล์แนบใน Storage แต่ไฟล์ถูกลบไปแล้ว**: ระบบข้ามไฟล์ที่ไม่มีและดำเนินการลบ DB rows ต่อ
- **Bulk Cancel ที่ทุกรายการล้มเหลว**: ระบบรายงาน failed ทั้งหมด ไม่มีรายการที่สำเร็จ
- **Metadata Patch ที่ไม่มีฟิลด์ใดเปลี่ยนแปลง**: ระบบไม่บันทึก Audit Trail (no-op) และส่ง response ว่า "ไม่มีการเปลี่ยนแปลง"
- **Cancel Transmittal ที่มี items ผูกอยู่**: ยกเลิกเฉพาะ Transmittal (Correspondence ต้นทาง) ไม่กระทบ TransmittalItem และไม่กระทบ Correspondence ที่ถูกนำส่ง (correspondence ต้นทางของ transmittal นั้นเองถูกยกเลิก แต่ correspondence ที่เป็น item ใน transmittal อื่นไม่ถูกกระทบ)
- **Hard-Delete Transmittal**: ลบเฉพาะ transmittal + transmittal_items ไม่ลบ Correspondence ต้นทางและไม่ลบ Correspondence ที่ถูกนำส่งเป็น item
- **Hard-Delete Drawings ที่ไม่มี Qdrant vector**: ระบบข้าม vector deletion (SKIPPED) และลบ physical files + DB rows
- **สอง DC กด Cancel เอกสารเดียวกันพร้อมกัน**: คนแรกสำเร็จ คนที่สองได้รับแจ้ง "เอกสารนี้ถูกยกเลิกแล้ว" (idempotent)
- **Bulk Cancel ข้ามประเภทเอกสาร**: ระบบไม่อนุญาต เพราะ Bulk จำกัดเฉพาะ Same-Type ในหน้านั้น
- **Maintenance Console — Void & Replace หมายเลขเอกสาร**: เลขเก่าถูก mark เป็น VOID (audit เหตุผลและเลขเก่า) และเลขใหม่ถูกออกต่อท้ายลำดับปัจจุบัน ไม่ reuse เลขที่ VOID แล้ว
- **Maintenance Console: Orphan Cleanup ขณะมีการอัปโหลดไฟล์ใหม่**: ระบบใช้ Distributed Lock เพื่อป้องกันการลบไฟล์ที่กำลังถูก commit

## Clarifications

### Session 2026-09-06

- Q: FR-001 ระบุว่า Drawings ใช้ Cancel (เปลี่ยน status เป็น CANCELLED) แต่ Drawings ไม่มี status field — ควรใช้กลไกใด? → A: แก้ไข FR-001 ให้ Drawings ใช้ Soft Delete (deletedAt) แตกต่างจาก Correspondence/RFA/Transmittal ที่ใช้ Cancel (status → CANCELLED) ตาม Decision #8 (2-Layer: Common Shell + Type-Specific Strategy)

## Requirements _(mandatory)_

### Functional Requirements

**Cancel / Void (Soft-Cancel)**

- **FR-001**: System MUST allow Document Controller (DC) and Admin to soft-cancel documents with a mandatory reason, using type-specific behavior per Type-Specific Strategy:
  - Correspondence, RFA, Transmittal: change status to CANCELLED (these types have a status field)
  - Drawings: set deletedAt (Soft Delete — Drawings have no status field, no Cancel concept)
  - Circulation: use Force Close (not Cancel — see FR-006)
- **FR-002**: System MUST NOT allow soft-cancel of documents already in CANCELLED status (Correspondence/RFA/Transmittal) or already Soft-Deleted (Drawings) — idempotent (menu hidden or disabled)
- **FR-003**: System MUST automatically force-close all active Circulations linked to a cancelled Correspondence, with the cancel reason recorded
- **FR-004**: System MUST terminate all active Workflow instances when a document is cancelled (critical side effect — rollback if fails) — applies to Correspondence, RFA, Transmittal (Drawings and Circulation do not have Workflow instances)
- **FR-005**: System MUST NOT allow regular users (non-DC/Admin) to soft-cancel or soft-delete documents
- **FR-006**: For Circulation, system MUST use "Force Close" instead of "Cancel" (different terminology and behavior per type-specific strategy)

**Hard-Delete (Permanent Delete)**

- **FR-007**: System MUST restrict Hard-Delete to Superadmin only (system.manage_all permission)
- **FR-008**: System MUST delete physical files, Qdrant vectors, and DB rows in cascade per type-specific policy:
  - Correspondence/RFA: full cascade (files + vectors + DB)
  - Transmittal: delete transmittals + transmittal_items only (NOT the Correspondence that issued the transmittal, NOT the Correspondence documents transmitted as items in other transmittals)
  - Drawings: delete files + vectors + DB rows
  - Circulation: no Hard-Delete (use Force Close only)
- **FR-009**: System MUST record a snapshot of the document (number, status, attachment count, vector count) in Audit Trail before Hard-Delete
- **FR-010**: System MUST use Distributed Lock (Redis Redlock) during Hard-Delete to prevent conflicts with background jobs (orphan scan, vector cleanup)
- **FR-011**: If Qdrant vector deletion fails, system MUST store in pending_vector_deletions for retry and report vectorDeletionStatus = PENDING_RETRY

**Metadata Patch (Admin Edit)**

- **FR-012**: System MUST allow DC/Admin to edit metadata fields on documents in any status except CANCELLED, classified into 3 tiers:
  - Tier 1 (Always Editable): Tags, Remarks, Due Date, Subject/Title, CC Recipients
  - Tier 2 (Status-Dependent — DRAFT/IN_REVIEW only): Body/Description, Transmittal Items, Circulation Routings, Drawing Volume/Category
  - Tier 3 (Never Editable — Superadmin Force-Edit only): Document Number, Originator, Project, Type, Attachments
- **FR-013**: System MUST record Before/After Diff of changed fields in Audit Trail for every Metadata Patch
- **FR-014**: System MUST use Optimistic Lock (version check) for Metadata Patch — if version mismatch, reject with "document modified by another user, please refresh"
- **FR-015**: System MUST send notifications to recipients/assignees when metadata is patched (via BullMQ, non-critical)

**Bulk Operations**

- **FR-016**: System MUST support Bulk Cancel, Bulk Tag, and Bulk Export for same-type documents only (within a single Dashboard page)
- **FR-017**: System MUST limit Bulk Operations to maximum 100 items per batch
- **FR-018**: System MUST filter out ineligible items (e.g., CANCELLED items in Bulk Cancel) and warn the user
- **FR-019**: System MUST show progress feedback during Bulk Operations and report success/failed per item at completion
- **FR-020**: System MUST record Audit Trail per item with a shared bulkId (UUIDv7) for correlation

**Row Actions & UI**

- **FR-021**: System MUST display a Row Action Dropdown (⋯) on every document list table showing actions available to the user's role (CASL-controlled)
- **FR-022**: System MUST display a consistent Action Bar on every document detail page across all 5 document types
- **FR-023**: System MUST display a Bulk Action Bar (floating bottom bar) when checkboxes are selected, showing count and available bulk actions
- **FR-024**: System MUST use Shared Polymorphic Action Components (common UI shell) with Type-Specific Strategy (different behavior per document type)

**Side Effects Pipeline**

- **FR-025**: System MUST execute critical side effects (Workflow Termination, Circulation Force-Close) within the same transaction as the main action — rollback all if critical side effect fails
- **FR-026**: System MUST execute non-critical side effects (Search Re-index, Notifications, Vector Deletion) post-commit with retry mechanism — failure does not rollback main action
- **FR-027**: System MUST return a unified response shape including sideEffects summary and failedSideEffects list
- **FR-028**: System MUST re-index Elasticsearch after Cancel and Metadata Patch (fire-and-forget)
- **FR-029**: System MUST send notifications via BullMQ (never inline) to affected parties after Cancel, Hard-Delete, and Metadata Patch

**Admin Maintenance Console**

- **FR-030**: System MUST provide a Document Maintenance Console at /admin/doc-control/maintenance with 4 tabs:
  - Numbering Tools: Sequence Gap Audit, Counter Sync, Manual Override, Void & Replace
  - Orphan Cleanup: Scan orphan files in Storage, show size savings, purge with audit
  - Vector Sync: Check documents missing from Qdrant, Batch Re-embed
  - Emergency Unlock: Detect stuck locks/workflows, Force Release, Bulk Hard-Purge (Superadmin only)
- **FR-031**: System MUST restrict Maintenance Console access to System Admin (system.numbering_override, system.orphan_cleanup, system.vector_sync, system.emergency_unlock permissions)

**Permissions**

- **FR-032**: System MUST add new granular permissions to seed: edit_metadata, bulk_cancel, bulk_tag, bulk_export, numbering_override, orphan_cleanup, vector_sync, emergency_unlock
- **FR-033**: System MUST maintain system.manage_all as hierarchy fallback (Superadmin can do everything)
- **FR-034**: System MUST adjust correspondence.delete to be used for Hard-Delete (instead of system.manage_all) while keeping system.manage_all as fallback

**Audit Trail**

- **FR-035**: System MUST record Audit Trail for every action with: userId, timestamp, ipAddress, userAgent, action, entityType, entityId (publicId), before, after
- **FR-036**: System MUST record Before/After Diff for Metadata Patch
- **FR-037**: System MUST record Snapshot before Hard-Delete (document number, status, attachment count, vector count)
- **FR-038**: System MUST record bulkId for all items in a Bulk Operation for correlation

**Concurrency**

- **FR-039**: System MUST check document status before any action (Status Guard) — reject if status not eligible (idempotent)
- **FR-040**: System MUST use Optimistic Lock (version check) for Metadata Patch and Cancel
- **FR-041**: System MUST use Distributed Lock (Redis Redlock) for Hard-Delete and Bulk Cancel

**i18n**

- **FR-042**: System MUST use i18n keys (document.action.* namespace in common.json) for all user-facing text in Document Actions — no hardcoded strings
- **FR-043**: System MUST use document.type.* keys for type-specific labels (Correspondence, RFA, Transmittal, Drawings, Circulation)

**Error Handling**

- **FR-044**: System MUST classify errors per ADR-007: Permission (403), Validation/State (422), Partial Success (200 with failedSideEffects), System Error (500)
- **FR-045**: System MUST provide actionable error messages (e.g., "document modified by another user, please refresh" with refresh button)
- **FR-046**: System MUST show Bulk Partial Failure as a summary dialog with per-item success/failed table

**Backward Compatibility**

- **FR-047**: System MUST use additive-only changes — no existing endpoint path/method removed or changed
- **FR-048**: System MUST use response superset — new fields (sideEffects, auditId) added without removing existing fields
- **FR-049**: System MUST verify role-permission mapping before changing correspondence.delete to prevent DC from accidentally getting Hard-Delete permission

### Key Entities _(include if feature involves data)_

- **Document Action Strategy**: Interface defining type-specific behavior for Cancel, Hard-Delete, Metadata Patch per document type (Correspondence, RFA, Transmittal, Drawings, Circulation)
- **Side Effects Result**: Structure containing results of critical and non-critical side effects (searchReindexed, notificationsSent, workflowTerminated, circulationsClosed, vectorsDeleted, filesDeleted, failedSideEffects)
- **Bulk Operation Result**: Structure containing succeeded[], failed[], bulkId for bulk action correlation
- **Audit Diff**: Structure containing before/after field values for Metadata Patch audit trail
- **Hard-Delete Snapshot**: Structure containing document number, status, attachment count, vector count captured before permanent deletion

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Document Controller can cancel any document from the Dashboard list view in under 30 seconds (from clicking ⋯ to seeing success toast)
- **SC-002**: Document Controller can correct metadata errors (Subject, Tags, Due Date) on submitted documents without needing to cancel and recreate, reducing document recreation rate by 80%
- **SC-003**: Superadmin can hard-delete a document with full cascade (files, vectors, DB) in under 10 seconds, with zero orphaned files remaining
- **SC-004**: Document Controller can bulk-cancel up to 100 documents in a single operation with per-item success/failure reporting, reducing manual effort from 100 individual actions to 1 batch
- **SC-005**: System Admin can detect and clean orphaned storage files through Maintenance Console, recovering storage space without manual database intervention
- **SC-006**: All document actions (Cancel, Hard-Delete, Metadata Patch, Bulk) produce complete Audit Trail entries with Before/After Diff or Snapshot, enabling 100% traceability for compliance
- **SC-007**: 95% of document actions complete without side-effect failures; when failures occur, non-critical side effects are retried automatically within 5 minutes
- **SC-008**: Users see consistent Row Action Dropdown (⋯) and Action Bar across all 5 document types, reducing training time for new Document Controllers by 50%
- **SC-009**: Concurrent edits by 2 DCs on the same document are detected and prevented (Optimistic Lock), with zero instances of lost updates
- **SC-010**: All user-facing text in Document Actions uses i18n keys (zero hardcoded strings), ensuring Thai/English locale support
