# 🛡️ Module Edge Cases & Business Rules — LCBP3-DMS v1.8.1

---

title: 'Edge Cases, Business Rules, and Anti-Bug Specifications'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen (Product Owner / System Architect)
last_updated: 2026-03-24
related:

- specs/01-Requirements/01-04-user-stories.md
- specs/01-Requirements/01-05-acceptance-criteria.md
- specs/01-Requirements/01-02-business-rules/01-02-02-doc-numbering-rules.md
- specs/06-Decision-Records/ADR-001-unified-workflow-engine.md
- specs/06-Decision-Records/ADR-016-security-authentication.md
- specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md
- specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql

---

> [!IMPORTANT]
> เอกสารนี้ระบุ **Edge Cases ที่ต้อง Implement และ Test อย่างชัดเจน** เพื่อป้องกัน Bug ในระบบ Prod
> ทุก Edge Case มี **Expected Behavior** ที่ Developer และ QA ต้องยึดถือ

---

## 📐 วิธีอ่าน

- **EC-[MODULE]-[NNN]** = Edge Case ID
- **Severity:** 🔴 Critical | 🟠 High | 🟡 Medium
- **Type:** `Data Integrity` | `Security` | `Concurrency` | `UX` | `Business Rule`

---

## Module 1: Document Numbering Edge Cases

### EC-DN-001 — Concurrent Submission (Race Condition)

**Severity:** 🔴 Critical | **Type:** Concurrency, Data Integrity

**Scenario:** User A และ User B กด Submit Correspondence พร้อมกันทุก millisecond สำหรับ Project/Type/Sender/Receiver เดียวกัน

**Expected Behavior:**

- ทั้งสองได้รับเลขเอกสาร **ต่างกัน** (เช่น 0001 และ 0002)
- ไม่มีเลข Duplicate ในระบบ
- API ทั้งสองตอบ 201 Created สำเร็จ

**Implementation Rule:**

```
1. Redis Redlock acquire บน counterKey ก่อน
2. ถ้า Lock ไม่ได้ใน 5 วินาที → 503 Service Unavailable (Retry-After: 3s)
3. DB SELECT FOR UPDATE อีกชั้น (Defense in Depth)
4. Increment counter → COMMIT → Release Lock
5. ห้ามใช้ AUTO_INCREMENT ของ DB โดยตรงสำหรับเลขเอกสาร
```

**Test Method:** Load Test 50 concurrent POST `/document-numbering/reserve` → Assert DISTINCT count = 50

---

### EC-DN-002 — Yearly Reset Boundary Condition

**Severity:** 🟠 High | **Type:** Business Rule, Data Integrity

**Scenario A:** Document ถูก Submit เวลา 23:59:59 วันที่ 31 ธันวาคม
**Scenario B:** Cron Job Reset Counter ทำงานตอนเที่ยงคืน แต่มี Document ในสถานะ RESERVED อยู่

**Expected Behavior (A):**

- ได้รับเลขของปีเก่า (counter ปีเก่า) — เวลา Submit คือที่กำหนด
- ถ้า Confirm หลังเที่ยงคืน → เลขยังเป็นของปีเก่า (ใช้เวลา Reserve ไม่ใช่ Confirm)

**Expected Behavior (B):**

- Cron Job ต้อง **Skip** เลขที่อยู่ใน RESERVED state — ไม่ Reset Counter จนกว่า Reservation จะ Expire หรือ Confirmed
- ถ้า Reset รันก่อน Expiry: Counter ใหม่เริ่ม 0001 แต่ Reserved เลขยังคงอยู่ (ไม่ถูก Overwrite)

**Implementation Rule:**

```
- Cron Job ติด Lock เดียวกับ Reserve Process ก่อน Reset
- Reset scope = 'YEAR_2025' → Counter Key ใหม่ = 'YEAR_2026'
- ไม่ Delete counter เก่า — แค่ Key ใหม่
```

---

### EC-DN-003 — Cancelled/Voided Number Must Not Reuse

**Severity:** 🔴 Critical | **Type:** Business Rule, Data Integrity

**Scenario:** Document ถูก Submit → ได้เลข 0005 → Admin Cancel Document → User Submit ใหม่

**Expected Behavior:**

- เลขถัดไปต้อง **0006** ไม่ใช่ 0005
- เลข 0005 อยู่ใน `document_number_reservations` สถานะ CANCELLED ตลอดไป
- ไม่มีการ Reuse เลขที่ถูก Cancel เด็ดขาด

**Business Rule:** "เลขที่ออกแล้วต้องไปข้างหน้าเท่านั้น — ห้ามถอยหลัง"

---

### EC-DN-004 — Reservation TTL Expired Cleanup

**Severity:** 🟠 High | **Type:** Data Integrity, UX

**Scenario:** User Reserve เลข (TTL 5 นาที) แต่ Browser ปิดก่อน Confirm

**Expected Behavior:**

- หลัง 5 นาที → `document_number_reservations.status` เปลี่ยนเป็น EXPIRED (by Cron/TTL)
- Counter ไม่ถูก Decrement (เลขนั้นหายไปถาวร — ฟัน-หลอ-เลข เป็นที่ยอมรับ)
- ถ้า User กลับมา Confirm Token ที่ Expired → 410 Gone (Token expired)

**Implementation Rule:**

```sql
-- Cron ทุก 1 นาที
UPDATE document_number_reservations
SET status = 'EXPIRED'
WHERE status = 'RESERVED' AND expires_at < NOW();
```

---

### EC-DN-005 — Idempotency Key Duplicate Submission

**Severity:** 🟠 High | **Type:** Concurrency, UX

**Scenario:** Network ไม่เสถียร → User คลิก Submit 2 ครั้ง → Frontend ส่ง POST 2 ครั้งด้วย Idempotency-Key เดียวกัน

**Expected Behavior:**

- Request แรก → ออกเลขใหม่ → 201 Created
- Request ที่สอง (same Idempotency-Key) → **Return เลขเดิม** → 200 OK (ไม่ออกเลขใหม่)
- ไม่ว่า Request ที่สองจะมาเร็วแค่ไหน

**Implementation Rule:** Cache Idempotency-Key ใน Redis (TTL 24h) → ถ้า Key เจอ → Return Cached Response

---

## Module 2: Workflow Engine Edge Cases

### EC-WF-001 — Concurrent Approval (Parallel Steps)

**Severity:** 🔴 Critical | **Type:** Concurrency, Business Rule

**Scenario:** Workflow มี Parallel Approval (Engineer A **และ** Engineer B ต้อง Approve พร้อมกัน)
Engineer A Approve พร้อมกับ Engineer B Approve ใน millisecond เดียวกัน

**Expected Behavior:**

- Workflow System บันทึกทั้งสอง Action อย่างถูกต้อง
- State เปลี่ยนเป็น "Approved" ก็ต่อเมื่อ **ทุก Parallel Branch** Complete แล้ว
- ไม่เกิด State Corruption (เช่น State ถูก Override โดย Action หนึ่ง)

**Implementation Rule:**

```
- DB Transaction Isolation: SERIALIZABLE สำหรับ State Transition
- Check: all parallel branches completed → ถ้าใช่ → advance to next state
- ถ้าไม่ใช่ → บันทึก partial approval เท่านั้น
```

---

### EC-WF-002 — Action on Wrong Workflow State

**Severity:** 🔴 Critical | **Type:** Security, Business Rule

**Scenario A:** Reviewer พยายาม Approve เอกสารที่ถูก Cancel แล้ว
**Scenario B:** Reviewer Approve เอกสารที่ Approve ไปแล้ว (Double-click)

**Expected Behavior (A):**

- `GET /correspondences/:id` → status: CANCELLED → ปุ่ม Approve ไม่แสดง (UI)
- ถ้าโจมตีตรงๆ ผ่าน API → 422 Unprocessable Entity (Invalid state transition)

**Expected Behavior (B):**

- `workflow_state_transitions` ตรวจสอบ current_state + action ก่อน
- ถ้า Action ไม่ Valid สำหรับ State ปัจจุบัน → 409 Conflict (Already processed)
- Idempotency: ถ้า User กด Approve ซ้ำด้วย Action เดียวกัน → Return เดิม ไม่ Error

---

### EC-WF-003 — Force Proceed on Final State

**Severity:** 🟠 High | **Type:** Business Rule, UX

**Scenario:** Document Control กด "Force Proceed" บนเอกสารที่อยู่ใน APPROVED (Final State) แล้ว

**Expected Behavior:**

- ถ้าไม่มี Next State ใน DSL → ปุ่ม Force Proceed ไม่แสดง (UI)
- ถ้าเรียก API ตรงๆ → 422 (No next state available from current state)

---

### EC-WF-004 — Workflow Definition Changed During Execution

**Severity:** 🟡 Medium | **Type:** Business Rule, Data Integrity

**Scenario:** Admin แก้ไข Workflow DSL ขณะที่มี Workflow Instance กำลังดำเนินการอยู่

**Expected Behavior:**

- Workflow Instance ที่กำลังเดินอยู่ **ใช้ DSL เวอร์ชันที่สร้าง Instance** (Snapshot at creation)
- Instance ใหม่ที่สร้างหลังจากนั้นใช้ DSL เวอร์ชันใหม่
- ไม่มีการ Interrupt Instance ที่กำลังเดินอยู่

**Implementation Rule:**

```
workflow_instances.workflow_definition_snapshot (JSON) — บันทึก DSL ณ เวลาสร้าง
ไม่ Reference workflow_definitions.id โดยตรงสำหรับ Active Instances
```

---

### EC-WF-005 — Deadline Passed — No Action Taken

**Severity:** 🟡 Medium | **Type:** Business Rule, UX

**Scenario:** Deadline ของ Organization ผ่านไปแล้ว แต่ User ยังไม่ Approve

**Expected Behavior:**

- Workflow **ไม่ Auto-advance** (ต้องการ Human Decision เสมอ)
- Dashboard แสดง "Overdue" Badge (สีแดง)
- Notification Reminder ส่งซ้ำตาม Schedule (ไม่ใช่ตลอดเวลา — Anti-Spam)
- Document Control สามารถ Force Proceed ได้ (กรณีฉุกเฉิน)

---

## Module 3: File Storage Edge Cases

### EC-STOR-001 — File Upload During Network Interruption

**Severity:** 🟠 High | **Type:** UX, Data Integrity

**Scenario:** User Upload ไฟล์ 50MB ผ่าน Wi-Fi แล้วเน็ตหลุดระหว่าง Upload

**Expected Behavior:**

- Partial upload ไม่ถูก Save ใน Temp Storage
- User เห็น Error: "การอัปโหลดล้มเหลว กรุณาลองใหม่" + ปุ่ม Retry
- Draft ข้อมูล Form (ที่ไม่ใช่ไฟล์) ยังอยู่ใน LocalStorage (Auto-saved)
- ถ้า Retry → อัปโหลดใหม่ทั้งหมด (ไม่มี Resume Upload ใน MVP)

---

### EC-STOR-002 — Virus Detected in Uploaded File

**Severity:** 🔴 Critical | **Type:** Security

**Scenario:** User พยายาม Upload ไฟล์ที่ ClamAV ตรวจพบ Malware

**Expected Behavior:**

- ClamAV Scan ใน Temp Storage → พบ → ลบไฟล์ออกจาก Temp ทันที
- API ตอบ 422 Unprocessable Entity: `{ "error": "FILE_VIRUS_DETECTED", "filename": "..." }`
- Audit Log บันทึก: `VIRUS_DETECTED` + filename + user_id + ip_address
- Security Metric Counter ใน Dashboard เพิ่มขึ้น
- ไม่ดำเนินการ Submit Document ต่อ (ไม่ว่าไฟล์อื่นจะผ่านแล้ว)

---

### EC-STOR-003 — File Type Mismatch (MIME Sniffing Attack)

**Severity:** 🔴 Critical | **Type:** Security

**Scenario:** Attacker เปลี่ยน Extension ไฟล์ `malware.exe` → `document.pdf` แล้ว Upload

**Expected Behavior:**

- Backend ตรวจ MIME Type จาก **File Content** (ไม่ใช่ Extension)
- ถ้า MIME Type ไม่ตรงกับ Whitelist (PDF, DWG, ZIP, DOCX) → 400 Bad Request
- ถ้า Extension กับ MIME Type ไม่ตรงกัน → 400 Bad Request: "File type mismatch"
- Audit Log บันทึก Security Event

**Whitelist:**

```
PDF: application/pdf
DWG: application/acad, image/vnd.dwg
ZIP: application/zip, application/x-zip-compressed
DOCX: application/vnd.openxmlformats-officedocument.wordprocessingml.document
XLSX: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

---

### EC-STOR-004 — Orphan File Cleanup (Document Cancelled Before Confirm)

**Severity:** 🟠 High | **Type:** Data Integrity, Storage

**Scenario:** User Reserve Document Number → อัปโหลดไฟล์ไป Temp → Cancel Document → ออกจากหน้า

**Expected Behavior:**

- Temp files ต้องถูกลบออกจาก Storage ภายใน 1 ชั่วโมง (Cleanup Cron)
- ไม่มี Orphan Files ใน Temp Storage เกิน TTL
- Permanent Storage ไม่มีไฟล์ที่ไม่มี Document Reference

**Implementation Rule:**

```typescript
// Cron ทุกชั่วโมง
// ลบ Temp files ที่ older than 1 hour และ ไม่ได้ถูก Confirm
```

---

### EC-STOR-005 — Duplicate File Upload Detection

**Severity:** 🟡 Medium | **Type:** UX, Storage

**Scenario:** User อัปโหลดไฟล์เดิมซ้ำสองครั้ง (ลืมว่าอัปโหลดแล้ว)

**Expected Behavior:**

- **ไม่ Block** การ Upload ซ้ำ — เก็บเป็น 2 Attachment แยกกัน
- แสดง Warning (ไม่ใช่ Error): "ไฟล์นี้อาจถูกอัปโหลดแล้ว — ชื่อเดียวกัน"
- User สามารถลบ Duplicate ออกก่อน Submit

---

## Module 4: RFA & Drawing Edge Cases

### EC-RFA-001 — 1 Shop Drawing Revision = Max 1 RFA Constraint

**Severity:** 🔴 Critical | **Type:** Business Rule, Data Integrity

**Scenario:** Document Control พยายามสร้าง RFA ที่สอง สำหรับ Shop Drawing Revision เดิม

**Expected Behavior:**

- ตรวจสอบ: `rfas WHERE shop_drawing_revision_id = X AND status NOT IN ('REJECTED', 'CANCELLED')`
- ถ้ามี Active RFA อยู่แล้ว → 409 Conflict: "Shop Drawing Revision นี้มี RFA อยู่แล้ว"
- UI: Disable ปุ่ม "สร้าง RFA" ถ้า Revision มี Active RFA แล้ว

**Exception:** ถ้า RFA ก่อนหน้าถูก REJECTED หรือ CANCELLED → สร้างใหม่ได้

---

### EC-RFA-002 — RFA Revision While Previous Still Pending

**Severity:** 🟠 High | **Type:** Business Rule

**Scenario:** RFA Rev.A ยัง Pending Review อยู่ แต่ Contractor พยายามสร้าง Rev.B

**Expected Behavior:**

- ถ้า Rev.A ยังไม่มีคำตอบสุดท้าย (REJECTED/APPROVED/APPROVED_WITH_COMMENTS) → Block
- 409 Conflict: "ต้องรอคำตอบของ Revision ก่อนหน้าก่อน"
- ไม่อนุญาตให้มี 2 Active Revision พร้อมกัน

---

### EC-RFA-003 — Shop Drawing Uploaded to Wrong Category

**Severity:** 🟡 Medium | **Type:** Business Rule, UX

**Scenario:** User เลือก Discipline = "Structural" แต่ Upload Shop Drawing ที่เป็น Electrical

**Expected Behavior (MVP):**

- ไม่มี Auto-detection (AI Classification เป็น Phase 3)
- Validation: Discipline ต้องเลือก (ไม่มี Default)
- เตือนผู้ใช้ให้ตรวจสอบก่อน Submit (Review Mode)
- Reviewer ที่ Reject สามารถระบุเหตุผล "Wrong Discipline" ได้

---

### EC-RFA-004 — Transmittal Contains Mixed-Status RFAs

**Severity:** 🟠 High | **Type:** Business Rule

**Scenario:** Transmittal ถูกสร้างโดยรวม RFA บางฉบับที่ยัง DRAFT และบางฉบับที่ READY

**Expected Behavior:**

- Transmittal Submit ได้เฉพาะเมื่อ **ทุก RFA ใน Transmittal** อยู่ในสถานะ READY (ไม่ใช่ DRAFT)
- ถ้ามี DRAFT อยู่ → 422: "RFA [เลข] ยังอยู่ใน Draft กรุณา Submit ก่อน"
- UI: แสดง Status ของแต่ละ RFA ใน Transmittal ก่อน Submit

---

### EC-RFA-005 — Edit Draft RFA Validation

**Severity:** 🔴 Critical | **Type:** Business Rule, Data Integrity

**Scenario:** User พยายามแก้ไข RFA ที่ไม่ใช่สถานะ DRAFT หรือพยายามแก้ไข Shop Drawing Revision

**Expected Behavior:**

- ถ้าสถานะ ≠ DRAFT → 403 Forbidden: "สามารถแก้ไขได้เฉพาะในสถานะ Draft"
- ถ้าสถานะ = DRAFT → อนุญาตแก้ไข Subject, Body, Remarks, Description, Due Date
- Shop Drawing Revision ที่ผูกอยู่ **ไม่สามารถเปลี่ยนได้** (EC-RFA-001 enforced)
- Audit Log บันทึก UPDATE + user + timestamp ทุกครั้ง
- Details JSON schema_version คงที่ (ไม่อนุญาตเปลี่ยน version)

**Reference:** US-012a, AC-RFA-007

---

### EC-RFA-006 — Cancel Draft RFA Cascade Effects

**Severity:** 🔴 Critical | **Type:** Business Rule, Data Integrity

**Scenario:** User ยกเลิก RFA ที่อยู่ในสถานะ DRAFT หรือพยายามยกเลิกที่ไม่ใช่ DRAFT

**Expected Behavior:**

- ถ้าสถานะ ≠ DRAFT → 403 Forbidden: "สามารถยกเลิกได้เฉพาะในสถานะ Draft"
- ถ้าสถานะ = DRAFT → RFA status เปลี่ยนเป็น CANCELLED
- Shop Drawing Revision ถูกปลดผูก (available = true) ทันที
- Audit Log บันทึก CANCELLED + reason + user + timestamp
- ไม่สามารถ Undo การ Cancel ได้ (ต้องสร้าง RFA ใหม่)

**Reference:** US-012b, AC-RFA-008

---

### EC-RFA-007 — Search Results RBAC Filtering

**Severity:** 🔴 Critical | **Type:** Security, Business Rule

**Scenario:** Contractor A ค้นหา RFA แต่พยายามเห็น RFA ของ Contractor B โดยใช้ Advanced Filter

**Expected Behavior:**

- RFA ในสถานะ DRAFT → เห็นเฉพาะ originator organization (เจ้าของ RFA)
- RFA ในสถานะอื่น (SUBMITTED, FAP, APPROVED, REJECTED) → เห็นตามสิทธิ์ปกติ (project/contract scope)
- Elasticsearch query filter ด้วย `visible_to_organizations` array field
- Frontend ไม่แสดงผลลัพธ์ที่ไม่มีสิทธิ์ (return empty ไม่ใช่ error)
- API Response ไม่เปิดเผย entity_uuid ของเอกสารที่ไม่มีสิทธิ์

**Implementation:** Backend filter ใน service layer + Elasticsearch query filter

**Reference:** US-012c, AC-RFA-009, ADR-019

---

## Module 5: Authentication & Session Edge Cases

### EC-AUTH-001 — Token Refresh Race Condition

**Severity:** 🔴 Critical | **Type:** Concurrency, Security

**Scenario:** Browser Tab A และ Tab B ทำ API Call พร้อมกันด้วย Access Token ที่ Expired
ทั้งสองตรวจพบ 401 และพยายาม Refresh Token พร้อมกัน

**Expected Behavior:**

- ใช้ **Single Refresh Promise Pattern**: Tab แรกที่ Refresh สำเร็จ → Tab ที่สองใช้ Token ใหม่ (ไม่ Refresh ซ้อน)
- ถ้า Tab ที่สอง Refresh ก็ได้ Token ใหม่เหมือนกัน → ถือว่า OK (Refresh Token ยังใช้ได้)
- Refresh Token ถูก Rotate ทุกครั้งที่ใช้ (Refresh Token Rotation)

**Implementation:** Frontend Singleton Refresh Promise ใน Axios Interceptor

---

### EC-AUTH-002 — Permission Changed While User is Logged In

**Severity:** 🔴 Critical | **Type:** Security, Business Rule

**Scenario:** Admin เปลี่ยน Role ของ User จาก Document Control → Viewer ขณะที่ User กำลัง Login อยู่

**Expected Behavior:**

- Redis Permission Cache ของ User ถูกล้าง **ทันที** (ไม่รอ TTL)
- Access Token เดิมยังใช้ได้จนหมดอายุ (15 นาที) — เป็นที่ยอมรับ
- **Request ถัดไปหลัง Token Refresh** → Permission ใหม่มีผล
- Maximum Lag: 15 นาที (= Access Token TTL)

---

### EC-AUTH-003 — Concurrent Login (Same Account, Multiple Devices)

**Severity:** 🟡 Medium | **Type:** Security, Business Rule

**Scenario:** User Login จาก 2 Device พร้อมกัน (PC และ Tablet)

**Expected Behavior (MVP):**

- อนุญาต (Session ทั้งสองทำงาน Independent)
- แต่ละ Device มี Refresh Token แยกกัน
- Logout จาก Device หนึ่ง → Revoke เฉพาะ Refresh Token ของ Device นั้น

**Future Enhancement (Phase 2):**

- Option: "Logout จาก Device อื่นทั้งหมด"

---

### EC-AUTH-004 — Account Deactivated While Logged In

**Severity:** 🔴 Critical | **Type:** Security

**Scenario:** Admin Deactivate User Account ขณะที่ User กำลัง Login อยู่

**Expected Behavior:**

- Redis: Blacklist User ID (ทุก Token ของ User นั้นถือว่า Invalid ทันที)
- Request ถัดไปของ User → 401 Unauthorized: "Account has been deactivated"
- User ถูก Redirect ไปหน้า Login พร้อม Message ชัดเจน

**Implementation:**

```typescript
// ใน JWT Guard: ตรวจ Redis Blacklist ก่อน Validate Token
const isBlacklisted = await redis.get(`user:blacklist:${userId}`);
if (isBlacklisted) throw new UnauthorizedException('Account deactivated');
```

---

## Module 6: Permission & RBAC Edge Cases

### EC-PERM-001 — Direct Object Reference (IDOR Attack)

**Severity:** 🔴 Critical | **Type:** Security

**Scenario:** User A รู้ UUID ของเอกสาร User B (เช่น `/correspondences/550e8400-e29b-41d4-a716-446655440000`) แล้วเรียกตรงๆ

**Expected Behavior:**

- CASL AbilityGuard ตรวจสอบทั้ง Action และ Resource Owner (ADR-019)
- ถ้าไม่มีสิทธิ์ → **403 Forbidden** (ไม่ใช่ 404 — เพราะ 404 บอกว่ามีอยู่แต่หาไม่เจอ)
- **Exception:** ถ้าต้องการซ่อน Existence ของ Document → Return 404
- ทุก API ต้องผ่าน Permission Check โดยไม่มีข้อยกเว้น
- ParseUuidPipe ตรวจสอบ UUID format ก่อน query database

**Implementation:** UUID-based routing + CASL permissions

---

### EC-PERM-002 — Super Admin Impersonation Prevention

**Severity:** 🔴 Critical | **Type:** Security

**Scenario:** User พยายาม Forge JWT payload เพิ่ม role: 'SUPERADMIN'

**Expected Behavior:**

- JWT ถูก Sign ด้วย Secret ที่ไม่เปิดเผย → Signature ไม่ตรง → 401 Invalid token
- Role ไม่ถูก Read จาก Token โดยตรงสำหรับ Permission Check — ต้อง Verify จาก DB/Redis
- JWT payload ใช้แค่ `user_id` → ดึง Permission จาก Redis Cache/DB

---

### EC-PERM-003 — Organization Switch Mid-session

**Severity:** 🟡 Medium | **Type:** Business Rule, UX

**Scenario (ถ้ามี):** User เป็นสมาชิกในหลาย Organization (กรณี Consultant ที่ทำงานหลายโครงการ)

**Expected Behavior:**

- User เห็นเฉพาะ Data ขององค์กรที่ Login อยู่ (Active Context)
- ถ้าต้องการดูอีก Org → ต้อง "Switch Organization" (Session Context เปลี่ยน)
- ไม่มี Cross-org Data Leak แม้ User เป็นสมาชิกทั้งสอง Org

---

## Module 7: Correspondence Edge Cases

### EC-CORR-001 — Cancel Correspondence with Downstream Circulation

**Severity:** 🔴 Critical | **Type:** Business Rule, Data Integrity

**Scenario:** Correspondence ถูก Submit → ผู้รับสร้าง Circulation แล้ว → Originator ขอ Cancel

**Expected Behavior:**

- ต้องแจ้งเตือน Admin ว่า "มี Circulation ที่เปิดอยู่ [X รายการ] สำหรับเอกสารนี้"
- ต้องยืนยันก่อน Cancel: "การ Cancel จะส่งผลให้ Circulation ที่เกี่ยวข้องถูกปิดทั้งหมด"
- เมื่อ Confirm → Correspondence = CANCELLED + Circulation ที่เกี่ยวข้อง = FORCE_CLOSED
- Audit Log บันทึกทั้งหมด (CANCELLED + FORCE_CLOSED + reason + user)

---

### EC-CORR-002 — Reply to Cancel Correspondence

**Severity:** 🟡 Medium | **Type:** Business Rule

**Scenario:** Document Control พยายามสร้าง Correspondence เพื่อ Reply ต่อ Correspondence ที่ถูก Cancel

**Expected Behavior:**

- Reply ทำได้ — Reference ถึง CANCELLED เอกสารได้ (เพื่อ acknowledge การยกเลิก)
- UI แสดง Warning: "กำลัง Reply ต่อเอกสารที่ถูกยกเลิกแล้ว"
- ไม่ Block การ Reply (เป็น Business Decision ไม่ใช่ Technical Constraint)

---

### EC-CORR-003 — Correspondence to Self (Same Organization)

**Severity:** 🟡 Medium | **Type:** Business Rule

**Scenario:** User พยายามสร้าง Correspondence ที่ Sender และ Receiver เป็นองค์กรเดียวกัน

**Expected Behavior:**

- External Correspondence (Letter/RFI) → Block: "ไม่สามารถส่งหาตัวเองได้"
- Internal Communication → ใช้ Circulation Sheet แทน (ไม่ใช่ Correspondence)
- UI Validation + Backend Validation (Double Check)

---

## Module 8: Circulation Edge Cases

### EC-CIRC-001 — Assignee Deactivated Before Completing Task

**Severity:** 🟠 High | **Type:** Business Rule, UX

**Scenario:** User ถูก Deactivate หลังจากถูก Assign ใน Circulation แต่ก่อน Respond

**Expected Behavior:**

- Circulation ยัง Active อยู่ — ไม่หยุดอัตโนมัติ
- Document Control เห็น Warning: "Assignee [ชื่อ] ไม่ Active แล้ว"
- Document Control สามารถ Re-assign ไปยัง User อื่นได้
- Audit Log บันทึก Re-assign Event

---

### EC-CIRC-002 — Multi-Assignee: Partial Response

**Severity:** 🟡 Medium | **Type:** Business Rule, UX

**Scenario:** Circulation มี Action Assignees 3 คน — 2 คน Respond แล้ว แต่ 1 คนยังไม่ Respond

**Expected Behavior (MVP):**

- Document Control เห็นสถานะ "2/3 ตอบกลับแล้ว"
- Document Control สามารถ Force Close ได้ (พร้อมระบุเหตุผล)
- ถ้า Force Close → ทุก Partial Response ถูกบันทึก + หมายเหตุว่า Force Closed

---

### EC-CIRC-003 — Circulation Deadline = Today (Edge of Day)

**Severity:** 🟡 Medium | **Type:** Business Rule, UX

**Scenario:** Deadline ถูกกำหนด = "วันนี้" แต่ User ดูตอนบ่ายสอง

**Expected Behavior:**

- ถ้า Deadline = วันที่ X → หมดเขตเมื่อ X เวลา 23:59:59 (ไม่ใช่ 00:00:00)
- Reminder: ส่ง Notification เวลา 08:00 ของวัน Deadline
- Overdue Badge ขึ้นเมื่อ `NOW() > deadline_date + 1 day` (วันถัดไป 00:00)

---

## Module 9: Search & Elasticsearch Edge Cases

### EC-SRCH-001 — Search Index Lag (Eventual Consistency)

**Severity:** 🟡 Medium | **Type:** Data Consistency, UX

**Scenario:** Document ถูก Submit แล้ว → User ค้นหาทันที แต่ไม่เจอ

**Expected Behavior:**

- Index อาจ Lag 5–30 วินาที (BullMQ Async Job)
- UI แสดง "เอกสารอาจใช้เวลาสักครู่ก่อนปรากฏในผลค้นหา"
- **ไม่ถือว่า Bug** — เป็น By Design (Eventual Consistency)
- User สามารถ Navigate ไปยังเอกสารได้ทันทีผ่าน Notification Link (ไม่ต้องรอ Search)

---

### EC-SRCH-002 — Permission-filtered Search Results

**Severity:** 🔴 Critical | **Type:** Security

**Scenario:** Contractor A ค้นหา Keyword ที่มีใน Document ของ Contractor B

**Expected Behavior:**

- Elasticsearch Index ต้องมี `organization_id` / `contract_id` Field
- ทุก Search Query ต้อง Filter ด้วย `must: [{ term: { visible_to_org: userOrgId } }]`
- Contractor A **ไม่เห็น** Document ของ Contractor B ในผลค้นหา
- **ห้าม Filter ที่ Application Layer เท่านั้น** → ต้อง Filter ที่ Query Level

---

### EC-SRCH-003 — Special Characters in Search Query

**Severity:** 🟡 Medium | **Type:** Security, UX

**Scenario:** User ค้นหาด้วย `คคง. สค. - 2025` (มี `-`, `.`, ช่องว่าง)

**Expected Behavior:**

- ไม่ Crash — Elasticsearch รองรับ Special Characters
- Sanitize Query ก่อนส่ง (กัน Elasticsearch Injection)
- ผล Search ยังคง Relevance สูง

---

## Module 10: Notifications Edge Cases

### EC-NOTIF-001 — Notification Flood Prevention

**Severity:** 🟠 High | **Type:** UX, Anti-Spam

**Scenario:** Workflow มีหลาย Step ที่เปลี่ยนเร็ว → ส่ง Notification ทุก State Change → User ได้รับ Email 10 ฉบับในนาทีเดียว

**Expected Behavior:**

- **Notification Debounce/Batch:** รวม Notifications ภายใน 5 นาทีเป็น Summary Email เดียว
- ถ้าเปลี่ยน State 5 ครั้งใน 5 นาที → Email เดียว: "เอกสาร X มี 5 การเปลี่ยนแปลง"
- In-App Notifications ยังแสดงทุกรายการ (ไม่ Batch)

---

### EC-NOTIF-002 — User Unsubscribed from EMAIL but still needs In-App

**Severity:** 🟡 Medium | **Type:** UX, Business Rule

**Scenario:** User ปิด Email Notification แต่ยังต้องการ In-App Notification

**Expected Behavior:**

- Notification Settings: แยก Toggle สำหรับ Email / LINE / In-App
- Core Workflow Assignments (ที่ User ต้อง Action) → **ไม่สามารถ Disable** ทุก Channel ได้
- ต้องมี In-App อย่างน้อย 1 Channel สำหรับ Action Required Notifications

---

## 📊 Edge Case Summary by Module

| Module             | Critical | High  | Medium | Total  |
| ------------------ | -------- | ----- | ------ | ------ |
| Document Numbering | 2        | 2     | 1      | 5      |
| Workflow Engine    | 2        | 1     | 2      | 5      |
| File Storage       | 2        | 2     | 1      | 5      |
| RFA & Drawing      | 4        | 2     | 1      | 7      |
| Auth & Session     | 3        | 0     | 1      | 4      |
| Permission & RBAC  | 2        | 0     | 1      | 3      |
| Correspondence     | 1        | 0     | 2      | 3      |
| Circulation        | 0        | 1     | 2      | 3      |
| Search             | 1        | 0     | 2      | 3      |
| Notifications      | 0        | 1     | 1      | 2      |
| **รวม**            | **17**   | **9** | **14** | **40** |

---

## 🧪 Testing Strategy for Edge Cases

### สำหรับ Unit Tests (Backend)

```typescript
// ตัวอย่าง: EC-RFA-005 — Edit Draft RFA Validation
describe('RFAService - Edit Draft Validation', () => {
  it('should allow edit when status is DRAFT', async () => {
    const rfa = await service.createRFA({ status: 'DRAFT' });
    const updated = await service.updateRFA(rfa.uuid, { subject: 'Updated' });
    expect(updated.subject).toBe('Updated');
  });

  it('should reject edit when status is not DRAFT', async () => {
    const rfa = await service.createRFA({ status: 'SUBMITTED' });
    await expect(service.updateRFA(rfa.uuid, { subject: 'Updated' }))
      .rejects.toThrow('403');
  });
});

// ตัวอย่าง: EC-DN-001 — Concurrent Number Generation
describe('DocumentNumberingService - Concurrency', () => {
  it('should generate unique numbers for concurrent requests', async () => {
    const promises = Array.from({ length: 50 }, () => service.reserve({ projectId: 1, typeId: 2, orgId: 3 }));
    const results = await Promise.all(promises);
    const numbers = results.map((r) => r.documentNumber);
    const unique = new Set(numbers);
    expect(unique.size).toBe(50); // ไม่มีซ้ำ
  });
});
```

### สำหรับ Integration Tests

- EC-DN-001: k6 Load Test Script (50 VUs, `/document-numbering/reserve`)
- EC-AUTH-001: Cypress Multi-tab Token Refresh Test
- EC-PERM-001: API Test Suite — Direct Object Reference สำหรับทุก Resource (UUID-based)
- EC-RFA-005~007: RFA CRUD operations test with different user roles

### สำหรับ Manual UAT

- EC-WF-001: Test Parallel Approval ด้วย 2 Browser Session พร้อมกัน
- EC-STOR-002: Upload EICAR Test File (ClamAV Test Virus)
- EC-RFA-001: สร้าง RFA สำหรับ Revision เดิมที่มี Active RFA → Assert Block
- EC-RFA-006: Cancel Draft RFA → Verify Shop Drawing Revision ถูกปลดผูก
- EC-RFA-007: Contractor A ค้นหา → Assert ไม่เห็น RFA ของ Contractor B

---

## 📝 Document Control

- **Version:** 1.8.1 | **Status:** updated
- **Created:** 2026-03-11 | **Updated:** 2026-03-24 | **Owner:** Nattanin Peancharoen
- **Changes:** Added EC-RFA-005~007 (Edit/Cancel/Search RFA), Updated UUID references (ADR-019), Sync with US-012a~012c and AC-RFA-007~009
- **Next Review:** Pre-UAT (T-2 สัปดาห์ก่อน Go-Live)
- **Classification:** Internal Use Only — Developer & QA Reference
