# ✅ Acceptance Criteria — LCBP3-DMS MVP (UAT) v1.8.1

---

title: 'Acceptance Criteria & UAT Test Scenarios'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen (Product Owner)
last_updated: 2026-03-24
related:

- specs/01-Requirements/01-01-objectives.md
- specs/01-Requirements/01-04-user-stories.md
- specs/01-Requirements/01-06-edge-cases-and-rules.md
- specs/01-Requirements/01-02-business-rules/01-02-01-rbac-matrix.md
- specs/01-Requirements/01-02-business-rules/01-02-04-non-functional-rules.md
- specs/06-Decision-Records/ADR-001-unified-workflow-engine.md
- specs/06-Decision-Records/ADR-016-security-authentication.md

---

## 📖 วิธีอ่านเอกสารนี้

แต่ละ Scenario ใช้รูปแบบ **Given / When / Then** พร้อม:

- **ID**: รหัส Scenario ใช้อ้างอิง (AC-XXX-YYY)
- **Priority**: 🔴 Blocker | 🟠 Critical | 🟡 Major | 🟢 Minor
- **Role**: ผู้ใช้ที่ทดสอบ Scenario นี้

---

## 🏗️ Module 1: Authentication & Session Management

### AC-AUTH-001 — Login Success

**Priority:** 🔴 Blocker | **Role:** ทุก Role

|           | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| **Given** | User มีบัญชีในระบบ และ Password ถูกต้อง                          |
| **When**  | กรอก Username + Password แล้วกด Login                            |
| **Then**  | ✅ ได้รับ JWT Access Token (15 min TTL) + Refresh Token (7 days) |
|           | ✅ ถูก Redirect ไปที่ Dashboard                                  |
|           | ✅ Audit Log บันทึก `LOGIN_SUCCESS` พร้อม IP Address             |

### AC-AUTH-002 — Login Failed (Wrong Password)

**Priority:** 🔴 Blocker | **Role:** ทุก Role

|           | Description                                                           |
| --------- | --------------------------------------------------------------------- |
| **Given** | User มีบัญชีในระบบ                                                    |
| **When**  | กรอก Password ผิด                                                     |
| **Then**  | ✅ แสดง Error "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" (ไม่บอกว่าอันไหนผิด) |
|           | ✅ Audit Log บันทึก `LOGIN_FAILED`                                    |
|           | ✅ หลัง 5 ครั้งใน 1 นาที → Rate Limit 429 Too Many Requests           |

### AC-AUTH-003 — First Login Force Password Change

**Priority:** 🔴 Blocker | **Role:** ทุก Role (new user)

|           | Description                                                                |
| --------- | -------------------------------------------------------------------------- |
| **Given** | User เพิ่งถูกสร้างโดย Admin (password_must_change = true)                  |
| **When**  | Login สำเร็จครั้งแรก                                                       |
| **Then**  | ✅ ถูก Redirect ไปยังหน้า "เปลี่ยนรหัสผ่าน" ทันที                          |
|           | ✅ ไม่สามารถเข้าถึงหน้าอื่นได้ จนกว่าจะเปลี่ยนรหัสผ่าน                     |
|           | ✅ Password ใหม่ต้องผ่าน Policy (ตัวใหญ่ + ตัวเล็ก + ตัวเลข + 8+ ตัวอักษร) |

### AC-AUTH-004 — Token Refresh

**Priority:** 🟠 Critical | **Role:** ทุก Role

|           | Description                                                  |
| --------- | ------------------------------------------------------------ |
| **Given** | Access Token หมดอายุ (15 min) แต่ Refresh Token ยังใช้งานได้ |
| **When**  | Frontend ตรวจพบ 401 Response ระหว่างการใช้งาน                |
| **Then**  | ✅ Frontend auto-refresh token โดยผู้ใช้ไม่รู้สึก            |
|           | ✅ Request เดิม Retry สำเร็จหลัง Token Refresh               |

### AC-AUTH-005 — Logout

**Priority:** 🟠 Critical | **Role:** ทุก Role

|           | Description                             |
| --------- | --------------------------------------- |
| **Given** | User กำลัง Login อยู่                   |
| **When**  | กด Logout                               |
| **Then**  | ✅ Refresh Token ถูก Revoke ใน Database |
|           | ✅ Redis Permission Cache ถูกลบ         |
|           | ✅ Redirect ไปหน้า Login                |
|           | ✅ Audit Log บันทึก `LOGOUT`            |

---

## 🏢 Module 2: User & Organization Management (Admin)

### AC-ADMIN-001 — Superadmin สร้าง Organization

**Priority:** 🔴 Blocker | **Role:** Superadmin

|           | Description                                   |
| --------- | --------------------------------------------- |
| **Given** | Login ด้วย Superadmin Account                 |
| **When**  | สร้าง Organization ใหม่ กรอกชื่อ + รหัสองค์กร |
| **Then**  | ✅ Organization ถูกสร้างในฐานข้อมูล           |
|           | ✅ สามารถกำหนด Org Admin ได้ทันที             |
|           | ✅ Audit Log บันทึก `ORGANIZATION_CREATED`    |

### AC-ADMIN-002 — Superadmin สร้าง Project + Contract

**Priority:** 🔴 Blocker | **Role:** Superadmin

|           | Description                                               |
| --------- | --------------------------------------------------------- |
| **Given** | มี Organization อย่างน้อย 1 ที่                           |
| **When**  | สร้าง Project → สร้าง Contract ภายใน Project              |
| **Then**  | ✅ Project ผูกกับ Organization ได้หลายองค์กร              |
|           | ✅ Contract ผูกกับ Project (1 Contract ต่อ Contractor)    |
|           | ✅ การตั้งค่า Document Number Format สำหรับ Project ทำได้ |

### AC-ADMIN-003 — Org Admin เพิ่ม User เข้า Organization

**Priority:** 🟠 Critical | **Role:** Org Admin

|           | Description                                            |
| --------- | ------------------------------------------------------ |
| **Given** | Login ด้วย Org Admin                                   |
| **When**  | เพิ่ม User พร้อม Role (Editor/Viewer/Document Control) |
| **Then**  | ✅ User ได้รับ Email แจ้ง Credentials                  |
|           | ✅ User Login แล้วเห็น Dashboard ขององค์กรตัวเอง       |
|           | ✅ Permission ถูก Cache ใน Redis (ภายใน 30 วินาที)     |

### AC-ADMIN-004 — Permission Isolation ระหว่าง Contractor

**Priority:** 🔴 Blocker | **Role:** Document Control (Contractor A)

|           | Description                                                    |
| --------- | -------------------------------------------------------------- |
| **Given** | มี Contractor A (Contract 1) และ Contractor B (Contract 2)     |
| **When**  | Contractor A Login แล้วพยายาม เข้าดู Document ของ Contractor B |
| **Then**  | ✅ ได้รับ 403 Forbidden                                        |
|           | ✅ Contractor A ไม่เห็น Document ของ Contractor B ในรายการ     |
|           | ✅ Audit Log บันทึกความพยายาม Unauthorized Access              |

### AC-ADMIN-005 — Permission Cache Invalidation

**Priority:** 🟠 Critical | **Role:** Superadmin

|           | Description                                                          |
| --------- | -------------------------------------------------------------------- |
| **Given** | User กำลัง Login อยู่และมี Permission Cache ใน Redis                 |
| **When**  | Superadmin เปลี่ยน Role ของ User นั้น                                |
| **Then**  | ✅ Redis Cache ของ User นั้นถูกล้างทันที                             |
|           | ✅ Request ถัดไปของ User ใช้ Permission ใหม่ (ภายใน 1 request cycle) |

---

## 📨 Module 3: Correspondence Management

### AC-CORR-001 — สร้าง Correspondence (Draft)

**Priority:** 🔴 Blocker | **Role:** Document Control

|           | Description                                                              |
| --------- | ------------------------------------------------------------------------ |
| **Given** | Login ด้วย Document Control ขององค์กรใด                                  |
| **When**  | สร้าง Correspondence ใหม่ (Letter/RFI) กรอก Subject, To, CC, แนบไฟล์ PDF |
| **Then**  | ✅ เอกสารถูกบันทึกในสถานะ `DRAFT`                                        |
|           | ✅ ผู้ใช้ขององค์กรอื่น **ไม่เห็น** Draft นี้                             |
|           | ✅ ผู้สร้างเห็นใน "เอกสารฉบับร่างของฉัน"                                 |

### AC-CORR-002 — Submit Correspondence + Auto Document Number

**Priority:** 🔴 Blocker | **Role:** Document Control

|           | Description                                                                           |
| --------- | ------------------------------------------------------------------------------------- |
| **Given** | มี Correspondence ในสถานะ Draft พร้อม Attachment                                      |
| **When**  | กด Submit                                                                             |
| **Then**  | ✅ ระบบออกเลขเอกสารอัตโนมัติตาม Format Template (เช่น `LCBP3-สคฉ-กทท-LETTER-0001-68`) |
|           | ✅ เลขเอกสารไม่ซ้ำกัน แม้ Submit พร้อมกันหลาย Request                                 |
|           | ✅ สถานะเปลี่ยนเป็น `SUBMITTED`                                                       |
|           | ✅ Workflow Instance ถูกสร้างใน `workflow_instances`                                  |
|           | ✅ องค์กรผู้รับ (To) ได้รับแจ้งเตือน (Email + In-App)                                 |

### AC-CORR-003 — ผู้รับ Correspondence

**Priority:** 🔴 Blocker | **Role:** Document Control (Recipient Org)

|           | Description                              |
| --------- | ---------------------------------------- |
| **Given** | Correspondence ถูก Submit มายังองค์กรเรา |
| **When**  | Document Control ขององค์กรผู้รับ เปิดดู  |
| **Then**  | ✅ เห็นเอกสารใน Inbox/Received           |
|           | ✅ สามารถสร้าง Circulation Sheet ได้     |
|           | ✅ สามารถดาวน์โหลดไฟล์แนบได้             |

### AC-CORR-004 — อ้างอิงเอกสารก่อนหน้า (References)

**Priority:** 🟡 Major | **Role:** Document Control

|           | Description                                    |
| --------- | ---------------------------------------------- |
| **Given** | มีเอกสาร Correspondence เก่าในระบบ             |
| **When**  | สร้าง Correspondence ใหม่และอ้างอิงเอกสารเก่า  |
| **Then**  | ✅ Link เชื่อมระหว่างเอกสารทั้งสอง             |
|           | ✅ สามารถคลิก Navigate ไปดูเอกสารที่อ้างถึงได้ |

### AC-CORR-005 — Cancel Correspondence (Admin Only)

**Priority:** 🟡 Major | **Role:** Org Admin / Superadmin

|           | Description                                        |
| --------- | -------------------------------------------------- |
| **Given** | Correspondence ถูก Submit แล้ว (สถานะ SUBMITTED+)  |
| **When**  | Admin กด Cancel พร้อมระบุเหตุผล                    |
| **Then**  | ✅ สถานะเปลี่ยนเป็น `CANCELLED`                    |
|           | ✅ ต้องระบุ `cancel_reason` (ไม่ยอม Empty)         |
|           | ✅ Audit Log บันทึกพร้อมเหตุผล                     |
|           | ✅ User ระดับ Viewer/Editor ทำ Cancel ไม่ได้ → 403 |

---

## 📋 Module 4: RFA Management

### AC-RFA-001 — สร้าง RFA + แนบ Shop Drawing

**Priority:** 🔴 Blocker | **Role:** Document Control (Contractor)

|           | Description                                                                |
| --------- | -------------------------------------------------------------------------- |
| **Given** | Login ด้วย Document Control ของ Contractor                                 |
| **When**  | สร้าง RFA ใหม่ — กรอก RFA Type, Discipline, แนบ Shop Drawing (PDF/DWG/ZIP) |
| **Then**  | ✅ RFA ถูกบันทึกในสถานะ `DRAFT`                                            |
|           | ✅ Shop Drawing ผูกกับ RFA (1 Revision = 1 RFA)                            |
|           | ✅ ไฟล์ถูก Scan ด้วย ClamAV — ปฏิเสธไฟล์ที่ติด Virus                       |

### AC-RFA-002 — Submit RFA + Auto Number

**Priority:** 🔴 Blocker | **Role:** Document Control (Contractor)

|           | Description                                                    |
| --------- | -------------------------------------------------------------- |
| **Given** | RFA Draft พร้อม Shop Drawing                                   |
| **When**  | กด Submit                                                      |
| **Then**  | ✅ เลขที่ RFA ถูกออกอัตโนมัติตาม Format (`LCBP3-RFA-STR-0001`) |
|           | ✅ เลขไม่ reset ตามปี (RFA = No reset policy)                  |
|           | ✅ สถานะ = `SUBMITTED` → สร้าง Transmittal อัตโนมัติ         |
|           | ✅ Workflow Routing เริ่มทำงาน (ส่งไปยัง Reviewer)             |

### AC-RFA-003 — Review RFA (Approved)

**Priority:** 🔴 Blocker | **Role:** Engineer/Reviewer (Supervisor Org)

|           | Description                                          |
| --------- | ---------------------------------------------------- |
| **Given** | RFA อยู่ในสถานะรอ Review ที่องค์กรเรา                |
| **When**  | Engineer คลิก "Approved"                             |
| **Then**  | ✅ สถานะ RFA เปลี่ยนเป็น `APPROVED` (1A)              |
|           | ✅ Originator (Contractor) ได้รับแจ้งเตือน           |
|           | ✅ Workflow History บันทึก Action + Timestamp + User |

### AC-RFA-004 — Review RFA (Approved with Comments)

**Priority:** 🟠 Critical | **Role:** Engineer/Reviewer

|           | Description                                           |
| --------- | ----------------------------------------------------- |
| **Given** | RFA อยู่ในสถานะรอ Review                              |
| **When**  | Engineer คลิก "Approved with Comments" + กรอก Comment |
| **Then**  | ✅ สถานะ = `APPROVED_WITH_COMMENTS` (1B)             |
|           | ✅ Comment ถูกบันทึกใน Workflow History               |
|           | ✅ Originator เห็น Comment ได้                        |

### AC-RFA-005 — Review RFA (Rejected)

**Priority:** 🟠 Critical | **Role:** Engineer/Reviewer

|           | Description                                   |
| --------- | --------------------------------------------- |
| **Given** | RFA อยู่ในสถานะรอ Review                      |
| **When**  | Engineer คลิก "Rejected" + ระบุเหตุผล         |
| **Then**  | ✅ สถานะ = `REJECTED` (4X)                     |
|           | ✅ เหตุผลการ Reject บันทึกครบถ้วน             |
|           | ✅ Contractor สามารถยื่น RFA Revision ใหม่ได้ |

### AC-RFA-006 — Revision RFA

**Priority:** 🟠 Critical | **Role:** Document Control (Contractor)

|           | Description                                             |
| --------- | ------------------------------------------------------- |
| **Given** | RFA Rev.A ถูก Rejected แล้ว                             |
| **When**  | Contractor สร้าง RFA Revision ใหม่ (Rev.B)              |
| **Then**  | ✅ Rev.B ผูกกับ shop_drawing revision ใหม่              |
|           | ✅ เลขที่เอกสารเดิม — Revision Code เปลี่ยน (เช่น `-B`) |
|           | ✅ Rev.A ยังอ่านได้ (ไม่ถูกลบ)                          |

### AC-RFA-007 — Edit Draft RFA

**Priority:** 🔴 Blocker | **Role:** Document Control (Contractor)

|           | Description                                    |
| --------- | ---------------------------------------------- |
| **Given** | RFA อยู่ในสถานะ DRAFT (EC-RFA-001 enforced)      |
| **When**  | Document Control แก้ไข Subject/Body/Remarks    |
| **Then**  | ✅ RFA ถูกอัปเดตในสถานะ DRAFT                 |
|           | ✅ หากสถานะไม่ใช่ DFT → 403 Forbidden          |
|           | ✅ Audit Log บันทึก UPDATE + user + timestamp   |
|           | ✅ 1 Shop Drawing Revision = 1 RFA เท่านั้น     |

### AC-RFA-008 — Cancel Draft RFA

**Priority:** 🟠 Critical | **Role:** Document Control (Contractor)

|           | Description                                    |
| --------- | ---------------------------------------------- |
| **Given** | RFA อยู่ในสถานะ DRAFT                          |
| **When**  | กด Cancel                                      |
| **Then**  | ✅ สถานะเปลี่ยนเป็น CANCELLED                  |
|           | ✅ Shop Drawing Revision ถูกปลดผูก (available) |
|           | ✅ Audit Log บันทึก CANCELLED + reason         |
|           | ✅ ไม่สามารถกด Cancel ได้ถ้าสถานะไม่ใช่ DFT  |

### AC-RFA-009 — Search/Filter RFA

**Priority:** 🔴 Blocker | **Role:** Document Control/Engineer

|           | Description                                          |
| --------- | ---------------------------------------------------- |
| **Given** | มี RFA ในระบบหลายฉบับ                              |
| **When**  | Filter ด้วย Project/Status หรือค้นหา Keyword         |
| **Then**  | ✅ ผลลัพธ์ถูกต้องตาม Filter                        |
|           | ✅ DFT → เห็นเฉพาะ originator org (RBAC)           |
|           | ✅ Pagination ทำงาน (20 items/page)                 |
|           | ✅ ค้นหาจากเลขเอกสาร/Subject ได้                |

---

## 📐 Module 5: Drawing Management

### AC-DRW-001 — Upload Contract Drawing

**Priority:** 🟠 Critical | **Role:** Document Control (Design Consultant)

|           | Description                                                  |
| --------- | ------------------------------------------------------------ |
| **Given** | Login ด้วย Document Control ที่มีสิทธิ์ Contract Drawing     |
| **When**  | Upload แบบคู่สัญญา (PDF) พร้อมระบุ หมวดหมู่ / Drawing Number |
| **Then**  | ✅ Drawing ถูกบันทึกในระบบ                                   |
|           | ✅ สามารถอ้างอิงจาก Shop Drawing ได้                         |
|           | ✅ ไม่สามารถแก้ไขได้โดยไม่มีสิทธิ์                           |

### AC-DRW-002 — Upload Shop Drawing + Link to Contract Drawing

**Priority:** 🟠 Critical | **Role:** Document Control (Contractor)

|           | Description                                               |
| --------- | --------------------------------------------------------- |
| **Given** | มี Contract Drawing ในระบบแล้ว                            |
| **When**  | Upload Shop Drawing พร้อมระบุ Referenced Contract Drawing |
| **Then**  | ✅ Shop Drawing ผูก Reference กับ Contract Drawing        |
|           | ✅ สามารถ Navigate ไปดู Contract Drawing ที่อ้างถึงได้    |

### AC-DRW-003 — Shop Drawing Revision Control

**Priority:** 🟠 Critical | **Role:** Document Control

|           | Description                                              |
| --------- | -------------------------------------------------------- |
| **Given** | Shop Drawing Rev.A มีอยู่แล้ว                            |
| **When**  | Upload Shop Drawing Rev.B                                |
| **Then**  | ✅ Rev.B ถือเป็น Current Revision                        |
|           | ✅ Rev.A ยังสามารถดูได้ (ไม่ถูกลบ)                       |
|           | ✅ 1 Shop Drawing Revision ผูกกับ RFA ได้ 1 ฉบับเท่านั้น |

---

## ⚙️ Module 6: Unified Workflow Engine

### AC-WF-001 — Workflow Instance Creation

**Priority:** 🔴 Blocker | **Role:** ระบบ (Auto)

|           | Description                                |
| --------- | ------------------------------------------ |
| **Given** | Document ถูก Submit                        |
| **When**  | ระบบสร้าง Workflow Instance                |
| **Then**  | ✅ `workflow_instances` record ถูกสร้าง    |
|           | ✅ `current_state` = Initial State ตาม DSL |
|           | ✅ `entity_type` และ `entity_id` ถูกต้อง   |

### AC-WF-002 — Workflow State Transition (Happy Path)

**Priority:** 🔴 Blocker | **Role:** ตาม Workflow Role

|           | Description                                                                     |
| --------- | ------------------------------------------------------------------------------- |
| **Given** | Workflow อยู่ใน State A                                                         |
| **When**  | User ที่มีสิทธิ์ทำ Action ที่กำหนดใน DSL                                        |
| **Then**  | ✅ State เปลี่ยนเป็น State B ตาม Transition Rules                               |
|           | ✅ `workflow_histories` บันทึก from_state, to_state, action, user_id, timestamp |
|           | ✅ Event Notifications ถูก Dispatch (ถ้า DSL กำหนด)                             |

### AC-WF-003 — Workflow Unauthorized Transition

**Priority:** 🔴 Blocker | **Role:** User ไม่ถูก Role

|           | Description                                   |
| --------- | --------------------------------------------- |
| **Given** | Workflow รอ Approve โดย Role X                |
| **When**  | User ที่เป็น Role Y (ไม่ใช่ X) พยายาม Approve |
| **Then**  | ✅ ได้รับ 403 Forbidden                       |
|           | ✅ State ไม่เปลี่ยน                           |

### AC-WF-004 — Workflow Visualization (UI)

**Priority:** 🟡 Major | **Role:** ทุก Role ที่มีสิทธิ์ดูเอกสาร

|           | Description                                              |
| --------- | -------------------------------------------------------- |
| **Given** | Workflow กำลังดำเนินการอยู่                              |
| **When**  | เปิดดูหน้ารายละเอียดเอกสาร                               |
| **Then**  | ✅ แสดง Workflow Diagram พร้อม State ปัจจุบัน            |
|           | ✅ State ที่ผ่านมาแล้วแสดง History (คลิกดูรายละเอียดได้) |
|           | ✅ State ที่ยังไม่ถึง Disabled                           |

### AC-WF-005 — Force Proceed (Document Control Override)

**Priority:** 🟡 Major | **Role:** Document Control

|           | Description                                         |
| --------- | --------------------------------------------------- |
| **Given** | Workflow ติดอยู่ที่ State ใด State หนึ่ง            |
| **When**  | Document Control กด "Force Proceed" พร้อมระบุเหตุผล |
| **Then**  | ✅ Workflow ข้ามไป State ถัดไป                      |
|           | ✅ Audit Log บันทึก `FORCE_PROCEED` + reason + user |

### AC-WF-006 — Workflow Deadline & Notification

**Priority:** 🟡 Major | **Role:** Document Control

|           | Description                                      |
| --------- | ------------------------------------------------ |
| **Given** | Workflow ถูกกำหนด Deadline สำหรับ Organization   |
| **When**  | เวลาผ่าน Deadline ไปแล้ว                         |
| **Then**  | ✅ ระบบส่ง Reminder Notification ให้ผู้รับผิดชอบ |
|           | ✅ Dashboard แสดง "Overdue" indicator            |

---

## 📧 Module 7: Transmittals Management

### AC-TRM-001 — สร้าง Transmittal (ส่ง RFA หลายฉบับพร้อมกัน)

**Priority:** 🟠 Critical | **Role:** Document Control

|           | Description                                                 |
| --------- | ----------------------------------------------------------- |
| **Given** | มี RFA Draft หลายฉบับต้องส่งให้ที่ปรึกษา                    |
| **When**  | สร้าง Transmittal แนบ RFA หลายฉบับ                          |
| **Then**  | ✅ Transmittal ผูกกับ RFA ทุกฉบับ                           |
|           | ✅ Transmittal เป็นส่วนหนึ่งใน Correspondence (มีเลขเอกสาร) |
|           | ✅ ผู้รับเห็น Transmittal พร้อม RFA ที่แนบ                  |

---

## 📄 Module 8: Circulation Sheet Management

### AC-CIRC-001 — สร้าง Circulation Sheet

**Priority:** 🟠 Critical | **Role:** Document Control (ภายในองค์กร)

|           | Description                                                               |
| --------- | ------------------------------------------------------------------------- |
| **Given** | Correspondence เข้ามาในองค์กร                                             |
| **When**  | Document Control สร้าง Circulation Sheet กำหนด Main/Action/Info Assignees |
| **Then**  | ✅ Circulation ถูกสร้าง ผูกกับ Correspondence                             |
|           | ✅ Assignees ได้รับแจ้งเตือน (In-App + Email)                             |
|           | ✅ ผู้ใช้นอกองค์กรไม่เห็น Circulation Sheet นี้                           |

### AC-CIRC-002 — กำหนด Deadline + แจ้งเตือนล่วงหน้า

**Priority:** 🟡 Major | **Role:** Document Control

|           | Description                                     |
| --------- | ----------------------------------------------- |
| **Given** | Circulation ถูกกำหนด Deadline ให้ Main Assignee |
| **When**  | เหลืออีก 2 วันก่อน Deadline                     |
| **Then**  | ✅ ระบบส่งแจ้งเตือน Reminder                    |
|           | ✅ Dashboard แสดง "ใกล้ Deadline" badge         |

### AC-CIRC-003 — ปิด Circulation

**Priority:** 🟠 Critical | **Role:** Document Control

|           | Description                               |
| --------- | ----------------------------------------- |
| **Given** | ดำเนินการตอบกลับ Originator แล้ว          |
| **When**  | กด "ปิด Circulation"                      |
| **Then**  | ✅ Circulation สถานะ = `CLOSED`           |
|           | ✅ Audit Log บันทึก closed_by + timestamp |

---

## 🔢 Module 9: Document Numbering System

### AC-DN-001 — Auto Number Generation (Concurrent Safe)

**Priority:** 🔴 Blocker | **Role:** ระบบ (Auto)

|           | Description                                                |
| --------- | ---------------------------------------------------------- |
| **Given** | User 2 คนกด Submit พร้อมกัน ใน Project/Type เดียวกัน       |
| **When**  | ทั้งสองส่ง Request พร้อมกัน                                |
| **Then**  | ✅ เลขเอกสารไม่ซ้ำกัน (Redis Redlock + DB Optimistic Lock) |
|           | ✅ Response Time < 100ms สำหรับ Generation                 |
|           | ✅ ทั้งสอง Request สำเร็จ — ไม่มี Error                    |

> **Test Method:** Load Test ด้วย 50 concurrent requests ไปที่ `POST /document-numbering/reserve` — ตรวจสอบว่าเลขไม่ซ้ำ

### AC-DN-002 — Cancelled Number ไม่ถูกนำกลับมาใช้

**Priority:** 🔴 Blocker | **Role:** ระบบ

|           | Description                                                         |
| --------- | ------------------------------------------------------------------- |
| **Given** | เลขที่ 0012 ถูก Reserved แต่ Document ถูก Cancel ก่อน Confirm       |
| **When**  | มีการ Submit Document ถัดไป                                         |
| **Then**  | ✅ เลขที่ถัดไปจะเป็น 0013 (ข้าม 0012)                               |
|           | ✅ เลข 0012 อยู่ใน `document_number_reservations` สถานะ `CANCELLED` |

### AC-DN-003 — Number Format Template

**Priority:** 🟡 Major | **Role:** Superadmin

|           | Description                                                                          |
| --------- | ------------------------------------------------------------------------------------ |
| **Given** | กำหนด Format Template: `{PROJECT}-{ORIGINATOR}-{RECIPIENT}-{CORR_TYPE}-{SEQ:4}-{YY}` |
| **When**  | Submit Document ครั้งแรกของปีสำหรับ Pair นั้น                                        |
| **Then**  | ✅ เลขออกมาถูก Format (เช่น `LCBP3-สค.-กทท.-LETTER-0001-68`)                         |
|           | ✅ Preview ตัวอย่างเลขได้ก่อน Save Template                                          |

### AC-DN-004 — Yearly Reset

**Priority:** 🟡 Major | **Role:** ระบบ (Cron)

|           | Description                               |
| --------- | ----------------------------------------- |
| **Given** | Correspondence ใช้ Yearly Reset Policy    |
| **When**  | ปีใหม่เปลี่ยน (Cron Job ทำงาน)            |
| **Then**  | ✅ Counter เริ่มนับใหม่จาก 0001           |
|           | ✅ เลขของปีก่อนยังคงอยู่ในระบบ (ไม่ถูกลบ) |

---

## 🔍 Module 10: Search & Discovery

### AC-SRCH-001 — Full-text Search

**Priority:** 🟠 Critical | **Role:** ทุก Role

|           | Description                               |
| --------- | ----------------------------------------- |
| **Given** | มีเอกสารในระบบ (Indexed ใน Elasticsearch) |
| **When**  | พิมพ์ค้นหา Keyword ในช่อง Search          |
| **Then**  | ✅ ผล Search ปรากฏภายใน 500ms             |
|           | ✅ ค้นหาได้จาก: เลขเอกสาร, Subject, Tag   |
|           | ✅ แสดงเฉพาะเอกสารที่ User มีสิทธิ์เห็น   |

### AC-SRCH-002 — Advanced Filter

**Priority:** 🟡 Major | **Role:** ทุก Role

|           | Description                                     |
| --------- | ----------------------------------------------- |
| **Given** | อยู่ในหน้า Correspondence List                  |
| **When**  | Filter ด้วย Document Type + Date Range + Status |
| **Then**  | ✅ รายการ Filter ถูกต้อง                        |
|           | ✅ URL อัปเดตให้ Shareable (Query Params)       |

---

## 📧 Module 11: Notifications

### AC-NOTIF-001 — Email Notification (Document Submit)

**Priority:** 🟠 Critical | **Role:** ระบบ (Auto)

|           | Description                                       |
| --------- | ------------------------------------------------- |
| **Given** | Document ถูก Submit มายังองค์กร                   |
| **When**  | Workflow Transition เกิดขึ้น                      |
| **Then**  | ✅ Email ถูกส่งไปยัง Recipient ภายใน 5 นาที       |
|           | ✅ Email มี: เลขเอกสาร, Subject, ลิงก์ไปยังเอกสาร |
|           | ✅ BullMQ Job อยู่ใน Queue (สามารถ Monitor ได้)   |

### AC-NOTIF-002 — In-App Notification

**Priority:** 🟡 Major | **Role:** ทุก Role

|           | Description                                        |
| --------- | -------------------------------------------------- |
| **Given** | มี Action เกิดขึ้นที่เกี่ยวข้องกับ User            |
| **When**  | User เปิดแอป                                       |
| **Then**  | ✅ Bell Icon แสดง Unread Count                     |
|           | ✅ คลิกดูรายการ Notifications ได้                  |
|           | ✅ คลิกที่ Notification นำทางไปเอกสารที่เกี่ยวข้อง |

### AC-NOTIF-003 — Notification Retry on Failure

**Priority:** 🟡 Major | **Role:** ระบบ

|           | Description                                          |
| --------- | ---------------------------------------------------- |
| **Given** | Email Server ไม่สามารถส่งได้ชั่วคราว                 |
| **When**  | BullMQ Job ส่งไม่สำเร็จ                              |
| **Then**  | ✅ Retry ด้วย Exponential Backoff (3 ครั้ง)          |
|           | ✅ เมื่อ Retry ครบแล้วยังล้มเหลว → Dead Letter Queue |
|           | ✅ In-App Notification ยังส่งได้ (Fallback)          |

---

## 📎 Module 12: File Storage & Security

### AC-STOR-001 — File Upload (Two-Phase Storage)

**Priority:** 🔴 Blocker | **Role:** Document Control

|           | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| **Given** | User อัปโหลดไฟล์ PDF ขนาด 50MB                                         |
| **When**  | เลือกไฟล์ + อัปโหลด                                                    |
| **Then**  | ✅ ไฟล์ถูก Upload ไปยัง Temp Storage ก่อน                              |
|           | ✅ ClamAV Scan ในเวลา < 30 วินาที                                      |
|           | ✅ หากผ่าน Scan → ย้ายไปยัง Permanent Storage เมื่อ Document Confirmed |
|           | ✅ หากไม่ผ่าน Scan → ปฏิเสธพร้อมแสดง Security Warning                  |

### AC-STOR-002 — File Type Restriction

**Priority:** 🔴 Blocker | **Role:** Document Control

|           | Description                                               |
| --------- | --------------------------------------------------------- |
| **Given** | User พยายาม Upload ไฟล์ .exe หรือ .js                     |
| **When**  | เลือกไฟล์นอก Whitelist                                    |
| **Then**  | ✅ Frontend Block ก่อน Upload                             |
|           | ✅ Backend ยืนยันซ้ำ (Defense in Depth) — 400 Bad Request |

### AC-STOR-003 — Secure PDF Viewer (No Download)

**Priority:** 🟡 Major | **Role:** Viewer

|           | Description                                    |
| --------- | ---------------------------------------------- |
| **Given** | User มีสิทธิ์ดูเอกสารแต่ไม่มีสิทธิ์ Download   |
| **When**  | คลิกดูเอกสาร PDF                               |
| **Then**  | ✅ เปิดใน In-App PDF Viewer (ไม่ต้อง Download) |
|           | ✅ ปุ่ม Download ถูก Disable                   |
|           | ✅ Range Requests (Streaming) ใช้งานได้        |

---

## 📊 Module 13: Dashboard & Audit Log

### AC-DASH-001 — Dashboard KPI Cards

**Priority:** 🟡 Major | **Role:** ทุก Role

|           | Description                                                              |
| --------- | ------------------------------------------------------------------------ |
| **Given** | Login เสร็จ                                                              |
| **When**  | เข้าหน้า Dashboard                                                       |
| **Then**  | ✅ KPI Cards แสดง: จำนวน Correspondence, RFA Pending, งานของฉัน, Overdue |
|           | ✅ "My Tasks" แสดง Circulation ที่ตัวเองต้องทำ                           |
|           | ✅ ข้อมูลถูกต้องตามสิทธิ์ของตัวเอง                                       |

### AC-AUDIT-001 — Audit Log Coverage

**Priority:** 🔴 Blocker | **Role:** Superadmin

|           | Description                                                                 |
| --------- | --------------------------------------------------------------------------- |
| **Given** | ดำเนินการ Action ต่างๆ ในระบบ (Create, Update, Submit, Approve, Cancel)             |
| **When**  | ตรวจสอบ Audit Log                                                           |
| **Then**  | ✅ ทุก Action มีบันทึกใน `audit_logs` (severity INFO/WARN/ERROR/CRITICAL)               |
|           | ✅ บันทึกมี: user_id, action, entity_type, entity_uuid, details_json, ip_address, timestamp |
|           | ✅ ไม่สามารถแก้ไขหรือลบ Audit Log ได้ (Read-only)                           |

---

## 🔐 Section 14: Security Acceptance Criteria

### AC-SEC-001 — SQL Injection Prevention

**Priority:** 🔴 Blocker | **Role:** QA (Security Test)

|           | Description                                              |
| --------- | -------------------------------------------------------- |
| **Given** | ช่อง Input ใดๆ ในระบบ                                    |
| **When**  | ใส่ SQL Injection payload เช่น `'; DROP TABLE users; --` |
| **Then**  | ✅ คำขอถูกปฏิเสธหรือ Sanitized โดยไม่ทำงาน               |
|           | ✅ Database ปลอดภัย ไม่เกิด Error จาก Injection          |

### AC-SEC-002 — XSS Prevention

**Priority:** 🔴 Blocker | **Role:** QA (Security Test)

|           | Description                           |
| --------- | ------------------------------------- |
| **Given** | ช่อง Input เช่น Subject, Comment      |
| **When**  | ใส่ `<script>alert('XSS')</script>`   |
| **Then**  | ✅ Script ไม่ถูก Execute ใน Browser   |
|           | ✅ แสดงเป็น Plaintext หรือถูก Escaped |

### AC-SEC-003 — Authorization Boundary (IDOR Protection)

**Priority:** 🔴 Blocker | **Role:** QA (Security Test)

|           | Description                                                    |
| --------- | -------------------------------------------------------------- |
| **Given** | User A รู้ Document UUID ของ User B (ADR-019)                   |
| **When**  | User A เรียก `GET /correspondences/:uuid` ของ User B โดยตรง |
| **Then**  | ✅ ได้รับ 403 Forbidden (ไม่ใช่ 404)                      |
|           | ✅ ข้อมูลของ User B ไม่ถูกเปิดเผย                         |

### AC-SEC-004 — Rate Limiting on Auth Endpoint

**Priority:** 🔴 Blocker | **Role:** QA (Security Test)

|           | Description                                                 |
| --------- | ----------------------------------------------------------- |
| **Given** | ไม่มี Session อยู่                                          |
| **When**  | เรียก `POST /auth/login` เกิน 5 ครั้งใน 1 นาที จาก IP เดียว |
| **Then**  | ✅ ครั้งที่ 6+ ได้รับ 429 Too Many Requests                 |
|           | ✅ Audit Log บันทึก Rate Limit Event                        |

### AC-SEC-005 — Security Headers

**Priority:** 🟠 Critical | **Role:** QA

|           | Description                            |
| --------- | -------------------------------------- |
| **Given** | ระบบทำงานบน HTTPS                      |
| **When**  | ตรวจสอบ HTTP Response Headers          |
| **Then**  | ✅ `X-Content-Type-Options: nosniff`   |
|           | ✅ `X-Frame-Options: DENY`             |
|           | ✅ `Strict-Transport-Security` present |
|           | ✅ `Content-Security-Policy` defined   |

---

## ⚡ Section 15: Performance Acceptance Criteria

### AC-PERF-001 — API Response Time

**Priority:** 🟠 Critical

|                    | Description                                         |
| ------------------ | --------------------------------------------------- |
| **Test Condition** | 50 concurrent users, Normal workload                |
| **Then**           | ✅ P90 Response Time < 200ms สำหรับ CRUD operations |
|                    | ✅ P90 Search Query < 500ms                         |
|                    | ✅ File Upload 50MB < 30 seconds                    |

> **Test Tool:** k6 หรือ Apache JMeter
> **Test Script:** `specs/05-Engineering-Guidelines/performance-test-script.js` (TODO: สร้าง)

### AC-PERF-002 — Concurrent Users

**Priority:** 🟠 Critical

|                    | Description                               |
| ------------------ | ----------------------------------------- |
| **Test Condition** | 100 concurrent active users               |
| **Then**           | ✅ ระบบไม่ crash หรือ Error Rate > 1%     |
|                    | ✅ Memory ไม่เกิน 80% ของ Container Limit |
|                    | ✅ CPU ไม่เกิน 80% sustained              |

### AC-PERF-003 — Document Number Concurrent

**Priority:** 🔴 Blocker

|                    | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| **Test Condition** | 50 concurrent POST `/document-numbering/reserve` สำหรับ Project/Type เดียวกัน |
| **Then**           | ✅ เลขเอกสารไม่ซ้ำกันทั้ง 50 Request                                          |
|                    | ✅ ทุก Request สำเร็จ (ไม่มี 5xx Error)                                       |

---

## 💾 Section 16: Data Integrity & Recovery

### AC-DATA-001 — Backup & Restore

**Priority:** 🔴 Blocker | **Role:** DevOps

|           | Description                                           |
| --------- | ----------------------------------------------------- |
| **Given** | Production Database มีข้อมูล 1 วันทำการ               |
| **When**  | ทดสอบ Restore จาก Backup ล่าสุด                       |
| **Then**  | ✅ Restore สำเร็จภายใน RTO < 4 ชั่วโมง                |
|           | ✅ ข้อมูลสมบูรณ์ ไม่มี Data Loss เกิน RPO < 1 ชั่วโมง |
|           | ✅ ระบบทำงานปกติหลัง Restore                          |

### AC-DATA-002 — Orphan File Prevention

**Priority:** 🟠 Critical | **Role:** ระบบ

|           | Description                                                  |
| --------- | ------------------------------------------------------------ |
| **Given** | User อัปโหลดไฟล์ไปยัง Temp แล้ว Cancel Document ก่อน Confirm |
| **When**  | Cleanup Job ทำงาน                                            |
| **Then**  | ✅ ไฟล์ใน Temp Storage ถูกลบ                                 |
|           | ✅ Permanent Storage ไม่มี Orphan Files                      |

---

## ✅ UAT Sign-off Checklist

### Pre-UAT Conditions

- [ ] ระบบ Deploy บน Staging Environment (ใช้ Docker Compose เหมือน Production)
- [ ] Seed Data ตาม `lcbp3-v1.8.0-seed-basic.sql` และ `seed-permissions.sql`
- [ ] Test Users ทุก Role ถูกสร้าง (Superadmin, Org Admin, Document Control, Editor, Viewer)
- [ ] Email + LINE Notify Test Mode เปิดใช้งาน

### Go-Live Criteria (ต้องผ่านทั้งหมด)

| #   | Criteria                                          | Status |
| --- | ------------------------------------------------- | ------ |
| 1   | AC-AUTH-001 ~ AC-AUTH-005 ผ่านทั้งหมด             | ⬜     |
| 2   | AC-ADMIN-001 ~ AC-ADMIN-005 ผ่านทั้งหมด           | ⬜     |
| 3   | AC-CORR-001 ~ AC-CORR-002 (Happy Path) ผ่าน       | ⬜     |
| 4   | AC-RFA-001 ~ AC-RFA-003, AC-RFA-007 ~ AC-RFA-009 (RFA Core) ผ่าน   | ⬜     |
| 5   | AC-WF-001 ~ AC-WF-003 (Workflow Engine Core) ผ่าน | ⬜     |
| 6   | AC-DN-001 (Concurrent Number) ผ่าน                | ⬜     |
| 7   | AC-STOR-001 (Two-Phase Storage + ClamAV) ผ่าน     | ⬜     |
| 8   | AC-SEC-001 ~ AC-SEC-004 (Security) ผ่านทั้งหมด    | ⬜     |
| 9   | AC-PERF-001 (Response Time) ผ่าน                  | ⬜     |
| 10  | AC-DATA-001 (Backup & Restore DR Test) ผ่าน       | ⬜     |
| 11  | AC-AUDIT-001 (Audit Log Coverage) ผ่าน            | ⬜     |
| 12  | ไม่มี Bug Priority P0/P1 ค้างอยู่                 | ⬜     |

### UAT Participant Sign-off

| Organization             | Representative | Signature | Date |
| ------------------------ | -------------- | --------- | ---- |
| กทท. (Owner)             |                |           |      |
| สค. (Admin)              |                |           |      |
| TEAM (Design Consultant) |                |           |      |
| คคง. (Supervisor)        |                |           |      |
| ผรม. (Contractor Rep.)   |                |           |      |
| NAP (Developer)          | Nattanin P.    |           |      |

---

## 📝 Document Control

- **Version:** 1.8.1
- **Status:** updated
- **Created:** 2026-03-11 | **Updated:** 2026-03-24
- **Owner:** Nattanin Peancharoen (Product Owner / System Architect)
- **Changes:** Added AC-RFA-007~009 (Edit/Cancel/Search RFA), Updated status codes, Added UUID references (ADR-019), Linked edge cases
- **Next Review:** Prior to UAT Start
- **Classification:** Internal Use Only

---

> [!NOTE]
> เอกสารนี้ต้องได้รับการ Sign-off จาก Stakeholder ทุกฝ่ายก่อนเริ่ม UAT
> ดู Gap 5 (Stakeholder Sign-off) ใน `po-analysis.md` สำหรับ Process การอนุมัติ
