# Database Indexing & Performance Strategy

**Version:** 1.1.0 (v1.9.0 Core Schema)
**Context:** Production-scale (100k+ documents, High Concurrency)
**Database:** MariaDB 11.x (Native UUID Support)

## 1. Core Principles (หลักการสำคัญ)

ในการออกแบบ Database Index สำหรับระบบ DMS ให้ยึดหลักการตัดสินใจดังนี้:

1. **Data Integrity First:** ใช้ `UNIQUE INDEX` เพื่อเป็นปราการด่านสุดท้ายป้องกันการเกิด Duplicate Document Number และ Revision ซ้ำซ้อน (แม้ Application Layer จะมี Logic ดักไว้แล้วก็ตาม)
2. **Soft-Delete Awareness:** ทุก Index ที่เกี่ยวข้องกับความถูกต้องของข้อมูล ต้องคำนึงถึงคอลัมน์ `deleted_at` เพื่อไม่ให้เอกสารที่ถูกลบไปแล้ว มาขัดขวางการสร้างเอกสารใหม่ที่ใช้เลขเดิม
3. **Foreign Key Performance:** สร้าง B-Tree Index ให้กับ Foreign Key (FK) ทุกตัว เพื่อรองรับการ JOIN ข้อมูลที่รวดเร็ว โดยเฉพาะการดึง Workflow และ Routing
4. **Write-Heavy Resilience:** ตารางประเภท `audit_logs` ให้เน้น Index เฉพาะที่จำเป็น (`created_at`, `user_id`, `action`) เพื่อไม่ให้กระทบประสิทธิภาพการ Insert

---

## 2. Document Control Indexes (ป้องกัน Duplicate & Conflict)

หัวใจของ DMS คือห้ามมีเอกสารเลขซ้ำในระบบที่ Active อยู่

### 2.1 Unique Document Number & Revision

เพื่อรองรับระบบ Soft Delete (`deleted_at`) ใน MySQL การตั้ง Unique Index จำเป็นต้องมีเทคนิคเพื่อจัดการกับค่า `NULL` (เนื่องจาก MySQL มองว่า `NULL` ไม่เท่ากับ `NULL` จึงอาจทำให้เกิด Duplicate ได้ถ้าตั้งค่าไม่รัดกุม)

**SQL Recommendation (Functional Index - MySQL 8.0+):**

```sql
-- ป้องกันการสร้าง Document No และ Revision ซ้ำ สำหรับเอกสารที่ยังไม่ถูกลบ (Active)
ALTER TABLE `documents`
ADD UNIQUE INDEX `idx_unique_active_doc_rev` (
    `document_no`,
    `revision`,
    (IF(`deleted_at` IS NULL, 1, NULL))
);

```

_เหตุผล:_ โครงสร้างนี้รับประกันว่าจะมี `document_no` + `revision` ที่ Active ได้เพียง 1 รายการเท่านั้น แต่สามารถมีรายการที่ถูกลบ (`deleted_at` มีค่า) ซ้ำกันได้

### 2.2 Current/Superseded Flag Index

การค้นหาว่าเอกสารไหนเป็น "Latest Revision" จะเกิดขึ้นบ่อยมาก

```sql
-- ใช้สำหรับ Filter เอกสารที่เป็นเวอร์ชันล่าสุดอย่างรวดเร็ว
ALTER TABLE `documents`
ADD INDEX `idx_doc_status_is_current` (`is_current`, `status`, `project_id`);

```

---

## 3. High-Concurrency Search Indexes (รองรับ 100k+ Docs)

สำหรับการทำ Filter และ Search บนหน้า Dashboard หรือรายการเอกสาร

### 3.1 Pagination & Sorting

การ Query ข้อมูลแบบแบ่งหน้า (Pagination) พร้อมเรียงลำดับวันที่ มักเกิดปัญหา "Filesort" ที่ทำให้ CPU โหลดหนัก

```sql
-- สำหรับหน้า Dashboard ที่เรียงตามวันที่อัปเดตล่าสุด
ALTER TABLE `documents`
ADD INDEX `idx_project_updated` (`project_id`, `updated_at` DESC);

-- สำหรับ Inbox / Pending Tasks ของ User (General Workflow)
ALTER TABLE `workflow_instances`
ADD INDEX `idx_assignee_status` (`assignee_id`, `status`, `created_at` DESC);

-- สำหรับ Optimistic Locking (ADR-001 v1.1)
ALTER TABLE `workflow_instances`
ADD INDEX `idx_wf_inst_version` (`id`, `version_no`);

```

### 3.2 RFA Parallel Review & Delegation (v1.9.0)

ในระบบ RFA ใหม่ มีการใช้ Parallel Review และการมอบหมายงาน (Delegation) ซึ่งต้องการ Index เฉพาะทาง:

```sql
-- สำหรับดึงงานที่รอตรวจแยกตาม Discipline และสถานะ
ALTER TABLE `review_tasks`
ADD INDEX `idx_review_tasks_lookup` (`assigned_to_user_id`, `status`, `discipline_id`);

-- สำหรับการตรวจสอบสิทธิ์การตรวจรายคน (Priority Order)
ALTER TABLE `review_team_members`
ADD INDEX `idx_rtm_lookup` (`team_id`, `user_id`, `is_active`);

-- สำหรับเช็คการมอบหมายงานที่ยังมีผลอยู่ (Managed by BullMQ)
ALTER TABLE `delegations`
ADD INDEX `idx_delegations_active_lookup` (`delegator_user_id`, `is_active`, `start_date`, `end_date`);
```

### 3.3 Polymorphic Distribution Matrix

เนื่องจาก `distribution_recipients` เก็บ `recipient_public_id` แบบ UUID (ADR-019) และไม่มี Hard FK:

```sql
-- สำหรับ Lookup ผู้รับเอกสารตามประเภท
ALTER TABLE `distribution_recipients`
ADD INDEX `idx_dr_type_recipient` (`recipient_type`, `recipient_public_id`);
```

### 3.4 Full-Text Search (ทางเลือกเบื้องต้นก่อนใช้ Elasticsearch)

หากผู้ใช้ต้องการค้นหาจากชื่อเอกสาร (`title`) หรือเนื้อหาบางส่วน

```sql
-- สร้าง Full-Text Index สำหรับคำค้นหา
ALTER TABLE `documents`
ADD FULLTEXT INDEX `ft_idx_doc_title` (`title`, `subject`);

```

_(หมายเหตุ: หากอนาคตมีระบบ OCR หรือค้นหาในเนื้อหาไฟล์ PDF ให้พิจารณาขยับไปใช้ Elasticsearch แยกต่างหาก ไม่ควรเก็บ Full-Text ขนาดใหญ่ไว้ใน MySQL)_

---

## 4. RBAC & Security Indexes

เพื่อป้องกันปัญหาคอขวด (Bottleneck) ตอนเช็คสิทธิ์ (RBAC validation) ก่อนให้เข้าถึงเอกสาร

```sql
-- ตาราง user_permissions
ALTER TABLE `user_permissions`
ADD UNIQUE INDEX `idx_user_role_project` (`user_id`, `role_id`, `project_id`);

-- ตาราง document_access_logs (Audit)
ALTER TABLE `audit_logs`
ADD INDEX `idx_audit_user_action` (`user_id`, `action`, `created_at`);

```

---

## 5. Audit Log Strategy (การจัดการตารางประวัติ)

ตาราง `audit_logs` จะโตเร็วมาก (Insert-only) คาดว่าจะมีหลักล้าน Record อย่างรวดเร็ว

**คำแนะนำสำหรับ On-Premise:**

1. **Partitioning:** แนะนำให้ทำ Table Partitioning ตามเดือน (Monthly) หรือปี (Yearly) บนคอลัมน์ `created_at`
2. **Minimal Indexing:** ห้ามสร้าง Index เยอะเกินความจำเป็นในตารางนี้ แนะนำแค่:

- `INDEX(document_id, created_at)` สำหรับดู History ของเอกสารนั้นๆ
- `INDEX(user_id, created_at)` สำหรับตรวจสอบพฤติกรรมผู้ใช้ต้องสงสัย (Security Audit)

```sql
-- ตัวอย่างการ Index สำหรับดูกระแสของเอกสาร
ALTER TABLE `audit_logs`
ADD INDEX `idx_entity_history` (`entity_type`, `entity_id`, `created_at` DESC);

```

---

## 6. Maintenance & Optimization (DevOps/Admin)

เนื่องจากระบบอยู่บน On-Prem NAS (QNAP/ASUSTOR) ทรัพยากร I/O ของดิสก์มีจำกัด (Disk IOPS)

- **Index Defragmentation:** ให้กำหนด Scheduled Task (ผ่าน Cronjob หรือ MySQL Event) มารัน `OPTIMIZE TABLE` ทุกๆ ไตรมาส สำหรับตารางที่มีการ Delete/Update บ่อย (ช่วยคืนพื้นที่ดิสก์และลด I/O)
- **Slow Query Monitoring:** ใน `04-infrastructure-ops/04-01-docker-compose.md` ต้องเปิดใช้งาน `slow_query_log=1` และตั้ง `long_query_time=2` เพื่อตรวจสอบว่ามี Query ใดทำงานแบบ Full Table Scan (ไม่ใช้ Index) หรือไม่

## 💡 คำแนะนำเพิ่มเติมจาก Architect (Architect's Notes):

1. **เรื่อง Soft Delete กับ Unique Constraint:** เป็นจุดที่นักพัฒนาพลาดกันบ่อยที่สุด ถ้าระบบอนุญาตให้ลบ `DOC-001 Rev.0` แล้วสร้าง `DOC-001 Rev.0` ใหม่ได้ การจัดการ Unique Constraint บน MySQL ต้องใช้ Functional Index (ตามตัวอย่างในข้อ 2.1) เพื่อป้องกันการตีกันของค่า `NULL` ในฐานข้อมูล
2. **ลดภาระ QNAP/ASUSTOR:** อุปกรณ์จำพวก NAS On-Premise มักจะมีปัญหาเรื่อง Random Read/Write Disk I/O การใช้ **Composite Index** แบบครบคลุม (Covering Index) จะช่วยให้ MySQL คืนค่าได้จาก Index Tree โดยตรง ไม่ต้องกระโดดไปอ่าน Data File จริง ซึ่งจะช่วยรีด Performance ของ NAS ได้สูงสุดครับ
