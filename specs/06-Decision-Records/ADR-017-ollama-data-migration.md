# ADR-017: Ollama Data Migration Architecture

**Status:** Accepted
**Date:** 2026-02-26
**Version:** 1.8.3 (Aligned with ADR-020)
**Review Cycle:** Core ADR (Review every 6 months or Major Version upgrade)
**Decision Makers:** Development Team, DevOps Engineer, AI Integration Lead
**Gap Resolution:** Addresses legacy document migration challenges (20,000+ PDFs) and data integrity validation requirements (Product Vision v1.8.5, Section 3.1) and migration acceptance criteria (UAT Criteria, Section 4.6)
**Version Dependency:**
- **Effective From:** v1.8.3
- **Applies To:** v1.8.3+ (Migration execution)
- **Backward Compatible:** v1.8.0+ (Migration planning)
- **Required For:** v1.9.0+ (Legacy data completion)

**Related Documents:**

- [ADR-020: AI Intelligence Integration Architecture](./ADR-020-ai-intelligence-integration.md) — Overall AI Architecture & RFA-First Strategy
- [Legacy Data Migration Plan](../03-Data-and-Storage/03-04-legacy-data-migration.md)
- [n8n Migration Setup Guide](../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md) — UUID Strategy สำหรับ DB Lookup
- [Software Architecture](../02-Architecture/02-02-software-architecture.md)
- [Data Dictionary](../03-Data-and-Storage/03-01-data-dictionary.md)
  > **Note:** ADR-017 is clarified and hardened by ADR-018 regarding AI physical isolation. Now part of unified ADR-020 architecture with RFA-First approach, Gemma 4 model, and comprehensive Human-in-the-Loop validation.

---

## Context and Problem Statement

โครงการ LCBP3-DMS มีความจำเป็นต้องนำเข้าเอกสาร PDF เก่าจำนวนกว่า 20,000 ฉบับ พร้อม Metadata ใน Excel เข้าสู่ระบบใหม่

ความท้าทายหลักคือ **Data Integrity และความถูกต้องของ Metadata** เนื่องจากข้อมูลเก่ามีโอกาสเกิด Human Error เราจึงต้องการ AI ช่วย Validate ก่อนนำเข้า

การส่งข้อมูลขึ้น Cloud AI Provider มีปัญหา 2 ประการ:

1. **Data Privacy:** เอกสารก่อสร้างท่าเรือเป็นความลับ ห้ามออกนอกเครือข่าย
2. **Cost:** ~$0.01–0.03 ต่อ Record = อาจสูงถึง $600 สำหรับ 20,000 records

---

## Decision Drivers

- **Security & Privacy:** ประมวลผลภายในเครือข่ายองค์กร (On-Premise) เท่านั้น
- **Cost Effectiveness:** ไม่เสียค่า Pay-per-use
- **Performance:** ประมวลผลได้ในระยะเวลาที่จำกัด (~3–4 คืน)
- **Maintainability:** แยก Migration ออกจาก Core Application
- **Recoverability:** Rollback ได้สมบูรณ์
- **Resilience:** รองรับ Checkpoint/Resume และ Hardware Failure
- **Data Integrity:** Idempotency, Revision Drift Protection, Enum Enforcement
- **Storage Governance:** ทุก File Move ต้องผ่าน StorageService

---

## Considered Options

### Option 1: NestJS Custom Script + Public AI API

**Pros:** ไม่ต้องจัดหา Hardware เพิ่ม, AI ฉลาดสูง

**Cons:**

- ❌ ผิดนโยบาย Data Privacy
- ❌ ค่าใช้จ่ายสูง (~$600)
- ❌ Code สกปรก ปะปนกับ Source Code หลัก

### Option 2: Pure Scripting (No AI)

**Pros:** เร็ว ไม่มีค่าใช้จ่าย

**Cons:**

- ❌ ความแม่นยำต่ำ ตรวจได้แค่ Format
- ❌ ต้องใช้ Manual Review จำนวนมาก

### Option 3: Local AI Model (Ollama) + n8n ⭐ (Selected)

**Pros:**

- ✅ Privacy Guaranteed
- ✅ Zero Cost
- ✅ Clean Architecture
- ✅ Visual & Debuggable
- ✅ Resilient (Checkpoint/Resume)
- ✅ Structured Output ด้วย JSON Schema

**Cons:**

- ❌ ต้องเปิด Desktop ทิ้งไว้ดูแล GPU Temperature
- ❌ Model เล็กอาจแม่นน้อยกว่า Cloud AI → ต้องมี Human Review Queue

---

## Decision Outcome

**Chosen Option:** Option 3 — Local AI Model (Ollama) + n8n

**Rationale:**

ประยุกต์ใช้ Hardware ที่มีอยู่ โดยไม่ขัดหลัก Privacy และ Security ของโครงการ n8n ช่วยลด Risk ที่จะกระทบ Core Backend และรองรับ Checkpoint/Resume ได้ดีกว่าการเขียน Script เอง

---

## Impact Analysis

### Affected Components

| Component | Impact Level | Description |
|-----------|--------------|-------------|
| **Migration Infrastructure** | **High** | n8n workflows, Ollama AI services, Admin Desktop setup |
| **Database Schema** | **High** | Migration tables, audit logs, staging areas |
| **Backend Services** | **High** | Migration APIs, validation services, storage integration |
| **Storage Systems** | **Medium** | Two-phase storage, file management, cleanup processes |
| **Security Model** | **Medium** | Migration tokens, IP whitelisting, audit trails |
| **Frontend Interface** | **Medium** | Migration dashboard, review queues, approval workflows |
| **Monitoring & Logging** | **Medium** | Migration progress tracking, error handling, performance metrics |
| **Documentation** | **Low** | Migration procedures, troubleshooting guides |

### Required Changes

| Change Category | Specific Changes | Priority |
|----------------|------------------|----------|
| **Infrastructure** | <ul><li>Setup n8n on QNAP NAS with Docker</li><li>Install Ollama with Gemma 4 on Admin Desktop</li><li>Configure PaddleOCR service for Thai text extraction</li><li>Setup network segmentation and AI isolation per ADR-018</li><li>Configure GPU monitoring and temperature controls</li></ul> | **Critical** |
| **Database** | <ul><li>Create migration_logs table with UUIDv7 primary keys</li><li>Create migration_review_queue staging table</li><li>Create import_transactions audit table</li><li>Create migration_progress tracking table</li><li>Setup migration_fallback_state table</li></ul> | **Critical** |
| **Backend** | <ul><li>Implement MigrationService with business logic</li><li>Create AI validation layer with confidence thresholds</li><li>Add migration-specific API endpoints with CASL guards</li><li>Implement idempotency handling for migration requests</li><li>Create storage service integration for two-phase file handling</li></ul> | **Critical** |
| **Security** | <ul><li>Implement migration token system with 7-day expiry</li><li>Setup IP whitelisting for migration services</li><li>Configure rate limiting for migration endpoints</li><li>Create comprehensive audit logging for migration operations</li><li>Implement Nginx security rules for migration access</li></ul> | **High** |
| **Storage** | <ul><li>Implement two-phase storage (temp → permanent)</li><li>Create migration-specific storage paths</li><li>Setup file cleanup and archival processes</li><li>Implement storage service integration</li><li>Create file validation and virus scanning workflows</li></ul> | **High** |
| **Frontend** | <ul><li>Build migration dashboard with queue management</li><li>Create review interface for AI suggestions</li><li>Implement bulk approval/rejection workflows</li><li>Add progress tracking and monitoring displays</li><li>Create error handling and retry interfaces</li></ul> | **Medium** |
| **Monitoring** | <ul><li>Setup migration progress tracking and metrics</li><li>Implement AI service health monitoring</li><li>Create error logging and alerting systems</li><li>Setup performance monitoring for migration workflows</li><li>Create GPU temperature and resource monitoring</li></ul> | **Medium** |
| **Documentation** | <ul><li>Create migration operation procedures</li><li>Document troubleshooting and recovery processes</li><li>Create admin training materials</li><li>Update API documentation with migration endpoints</li><li>Create rollback and recovery guides</li></ul> | **Medium** |

### Cross-Component Dependencies

| Dependency | Source | Target | Impact |
|------------|--------|--------|--------|
| **n8n → Backend API** | Migration workflows | Validation endpoints | Data processing |
| **AI Services → Backend** | Ollama processing | AI validation layer | Quality control |
| **Migration Service → Storage** | Data processing | Two-phase storage | File management |
| **Frontend → Migration API** | Dashboard interface | Migration endpoints | User interaction |
| **Audit → Migration** | Logging service | Migration audit trail | Compliance tracking |
| **Monitoring → Infrastructure** | Health checks | AI and n8n services | Operational stability |
| **Security → Migration** | Token validation | Migration access control | Access management |

---

## Implementation Summary

| Component              | รายละเอียด                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Migration Orchestrator | n8n (Docker บน QNAP NAS)                                                                                     |
| AI Model Primary       | Ollama `gemma4:9b` (9.6 GB, Gemma 4 9B) — Validation, Summarization, Tagging |
| AI Model Fallback      | Ollama `mistral:7b-instruct-q4_K_M`                                                                          |
| Hardware               | QNAP NAS (Orchestrator) + Desktop Desk-5439 (AI Processing, RTX 2060 SUPER 8GB)                              |
| DB Lookup (n8n)        | n8n ทำการ Query `project_uuid`, `organization_uuid` และดึง `Tags` จาก DB ให้ AI (ADR-019)                      |
| Data Ingestion         | 1. Staging ลง `migration_review_queue` -> 2. กดยืนยันผ่าน Frontend Management UI -> 3. Final Commit ผ่าน API |
| Concurrency (n8n)      | Sequential — Batch Size 50-100 ป้องกัน DB Connection Overload                                                |
| Checkpoint             | MariaDB `migration_progress` และการใช้ `ON DUPLICATE KEY UPDATE` ใน Staging                                  |
| Fallback               | Auto-switch Model เมื่อ Error ≥ Threshold                                                                    |
| Storage                | Two-Phase Storage: 1. `POST /api/storage/upload` (Temp) -> 2. Commit ภายหลัง                                 |
| Expected Runtime       | ~16.6 ชั่วโมง (~3–4 คืน) สำหรับ 20,000 records                                                               |

---

## AI Output Contract (JSON Schema)

```json
{
  "is_valid": true,
  "confidence": 0.92,
  "suggested_category": "Correspondence",
  "detected_issues": [],
  "suggested_title": null,
  "summary": "This document outlines the revised design specifications for the electrical subsystem in phase 2...",
  "suggested_tags": [
    { "name": "Electrical", "description": "Electrical engineering design documents.", "is_new": false },
    { "name": "Phase2-Specs", "description": "Specific requirements for Phase 2 implementation.", "is_new": true }
  ]
}
```

| Field                | Type                      | คำอธิบาย                                                         |
| -------------------- | ------------------------- | ---------------------------------------------------------------- |
| `is_valid`           | boolean                   | เอกสารผ่านการตรวจสอบหรือไม่ (เปรียบเทียบ subject vs pdf)         |
| `confidence`         | float (0.0–1.0)           | ความมั่นใจของ AI                                                 |
| `suggested_category` | string (enum จาก Backend) | หมวดหมู่ที่ AI แนะนำ                                             |
| `detected_issues`    | string[]                  | รายการปัญหา (array ว่างถ้าไม่มี)                                 |
| `suggested_title`    | string \| null            | Title ที่แก้ไขแล้ว หรือ null                                     |
| `summary`            | string                    | สรุปเนื้อหา 4-5 ประโยค สำหรับใส่ใน `body`                        |
| `suggested_tags`     | array of objects          | รายการ Tags ที่จับคู่ได้ หรือ แนะนำให้สร้างใหม่ (`is_new: true`) |

> ⚠️ **Patch:** `suggested_category` ต้องตรงกับ System Enum จาก `GET /api/meta/categories` เท่านั้น — ห้าม hardcode Category List ใน Prompt

---

## Confidence Threshold Policy (Staging Logic)

**ข้อมูลทุกชุดจาก n8n จะต้องถูกส่งเข้าตาราง `migration_review_queue` เสมอ** โดยจัดสถานะเบื้องต้นตาม Confidence:

| ระดับ Confidence                 | สถานะใน Review Queue                              |
| -------------------------------- | ------------------------------------------------- |
| `>= 0.85` และ `is_valid = true`  | `PENDING` (พร้อมให้ Admin เลือก Batch Import)     |
| `0.60–0.84`                      | `PENDING` (ไฮไลต์แจ้งให้ Admin ตรวจสอบข้อมูลก่อน) |
| `< 0.60` หรือ `is_valid = false` | `REJECTED` (รอให้ Admin แก้ไขข้อมูล Manual)       |
| AI Parse Error                   | ส่งไป Error Log + Trigger Fallback Logic          |
| Revision Drift                   | `PENDING` พร้อมระบุ reason: "Revision drift"      |

> ⚠️ **Tag Review:** ข้อมูลใดที่มี `is_new: true` ใน `suggested_tags` จะถูกบังคับให้ Admin ตรวจสอบบน Frontend UI ก่อน เพื่อป้องกัน AI สร้าง Tags ขยะซ้ำซ้อน

---

## Idempotency Contract

**HTTP Header ที่ต้องส่งทุก Request:**

```
Idempotency-Key: <document_number>:<batch_id>
```

**Backend Logic:**

```
IF idempotency_key EXISTS in import_transactions → RETURN HTTP 200 (no action)
ELSE → Process normally → INSERT import_transactions → RETURN HTTP 201
```

ป้องกัน Revision ซ้ำกรณี n8n Retry หรือ Network Error

---

## Duplicate Handling Clarification

Bypass Duplicate **Validation Error**

Hard Rules:

- ❌ Migration Token ไม่สามารถ Overwrite Revision ที่มีอยู่
- ❌ Migration Token ไม่สามารถ Delete Revision ก่อนหน้า
- ✅ Migration Token trigger Revision increment logic ตามปกติเท่านั้น

---

## Storage Governance (Two-Phase Storage)

**ข้อห้าม:**

```
❌ mv /data/dms/staging_ai/TCC-COR-0001.pdf /final/path/...
```

**ข้อบังคับ (Two-Phase Strategy):**

**Phase 1: Temp Upload (โดย n8n)**

```
✅ POST /api/storage/upload
   (Upload ไฟล์ PDF ได้ผลลัพธ์เป็น attachment_id เช่น 1024)
   *ไฟล์จะถูกระบุเป็น `is_temporary = TRUE`*
```

**Phase 2: Final Commit (โดย Frontend UI -> Backend API)**

```
✅ POST /api/migration/commit_batch
   body: { queue_ids: [1, 2, 3] }
```

Backend จะทำหน้าที่:

1. อ่านข้อมูลจาก `migration_review_queue` ซึ่งมี `temp_attachment_id` อยู่
2. นำ `temp_attachment_id` ไปเชื่อมกับเอกสาร (Link to `correspondence_attachments`)
3. เปลี่ยนสถานะอัพเดต `is_temporary = FALSE`
4. Move ไฟล์ไปที่ `/data/dms/uploads/YYYY/MM/{uuid}.pdf` ผ่าน StorageService อย่างถูกต้อง

---

## Review Queue Contract & Frontend UI

- `migration_review_queue` เป็น **Staging Table หลัก** (ไม่ auto-ingest ข้ามขั้นตอนนี้)
- ห้ามสร้าง Correspondence record จนกว่า Admin จะสั่ง Execute การ Import จากหน้าจอ
- **Approval Flow:**
  1. N8N Insert เข้า `migration_review_queue` (พร้อม `temp_attachment_id`)
  2. Admin Review บน Frontend UI (ให้ความสำคัญกับการเช็ค `is_new: true` Tags)
  3. Admin เลือก Rows แล้วกด **"Execute Import"**
  4. Frontend ส่งคำสั่ง `POST /api/migration/commit_batch` ถือว่าเป็นการ Ingest ลงตาราง Business Schema จริง

---

## Revision Drift Protection

ถ้า Excel มี revision column:

```
IF excel_revision != current_db_revision + 1
→ ROUTE ไป Review Queue พร้อม reason: "Revision drift"
```

---

## Execution Time Estimate

| Parameter              | ค่า                            |
| ---------------------- | ------------------------------ |
| Delay ระหว่าง Request  | 2 วินาที                       |
| Inference Time (avg)   | ~1 วินาที                      |
| เวลาต่อ Record         | ~3 วินาที                      |
| จำนวน Record           | 20,000                         |
| เวลารวม                | ~60,000 วินาที (~16.6 ชั่วโมง) |
| **จำนวนคืนที่ต้องใช้** | **~3–4 คืน** (รัน 22:00–06:00) |

---

## Encoding Normalization

ก่อน Ingestion ทุกครั้ง:

- Excel data → Convert เป็น **UTF-8**
- Filename → Normalize เป็น **NFC UTF-8** ป้องกันปัญหาภาษาไทยเพี้ยนข้าม OS

---

## Security Constraints

1. Migration Token อายุ **≤ 7 วัน** — Revoke ทันทีหลัง Migration
2. Token Bypass ได้เฉพาะ: Virus Scan, Duplicate Validation Error, Created-by
3. Token **ไม่มีสิทธิ์** ลบหรือ Overwrite Record เดิม
4. ทุก Request บันทึก Audit Log: `action=IMPORT, source=MIGRATION, created_by=SYSTEM_IMPORT`
5. **IP Whitelist:** ใช้ได้เฉพาะจาก `<NAS_IP>`
6. **Nginx Rate Limit:** `limit_req zone=migration burst=5 nodelay`
7. **Docker Hardening:** `mem_limit: 2g`, log rotation `max-size: 10m, max-file: 3`

---

## Rollback Strategy

1. Disable Migration Token ใน DB ทันที
2. ลบ Records ทั้งหมด `created_by = 'SYSTEM_IMPORT'` ผ่าน Transaction SQL (รวม `import_transactions`)
3. ย้ายไฟล์ PDF กลับ `migration_temp/`
4. Reset `migration_progress` และ `migration_fallback_state`
5. วิเคราะห์ Root Cause ก่อนรันใหม่

รายละเอียดดูที่ `03-04-legacy-data-migration.md` หัวข้อ 4

---

## Architecture Validation Checklist (GO-LIVE GATE)

### 🟢 A. Infrastructure Validation

| Check                        | Expected      | ✅  |
| ---------------------------- | ------------- | --- |
| Ollama `/api/tags` reachable | HTTP 200      |     |
| Backend `/health` OK         | HTTP 200      |     |
| MariaDB reachable            | SELECT 1      |     |
| `staging_ai` mounted RO      | ls works      |     |
| `migration_logs` mounted RW  | write test OK |     |
| GPU VRAM < 70% idle          | safe margin   |     |
| Disk space > 30% free        | safe          |     |

### 🟢 B. Security Validation

| Check                                  | Expected | ✅  |
| -------------------------------------- | -------- | --- |
| Migration Token expiry ≤ 7 days        | Verified |     |
| Token IP Whitelist = NAS IP only       | Verified |     |
| Token cannot DELETE records            | Verified |     |
| Token cannot UPDATE non-import records | Verified |     |
| Audit Log records `source=MIGRATION`   | Verified |     |
| Nginx rate limit configured            | Verified |     |
| Docker mem_limit = 2g                  | Verified |     |

### 🟢 C. Data Integrity Validation

| Check                                          | Expected       | ✅  |
| ---------------------------------------------- | -------------- | --- |
| Enum fetched from `/api/meta/categories`       | Not hardcoded  |     |
| `Idempotency-Key` header enforced              | Verified       |     |
| Duplicate revision test (run same batch twice) | No overwrite   |     |
| Revision drift test                            | Sent to Review |     |
| Storage path matches Core Storage Spec v1.8.0  | Verified       |     |
| Encoding normalization NFC UTF-8               | Verified       |     |

### 🟢 D. Workflow Validation (Dry Run 20 Records)

| Check                                    | Expected     | ✅  |
| ---------------------------------------- | ------------ | --- |
| JSON parse success rate                  | > 95%        |     |
| Confidence distribution reasonable       | Mean 0.7–0.9 |     |
| Checkpoint updates every 10 records      | Verified     |     |
| Fallback model not prematurely triggered | Verified     |     |
| Reject log written to `migration_logs/`  | Verified     |     |
| Error log written to `migration_logs/`   | Verified     |     |
| Review queue inserts to DB               | Verified     |     |

### 🟢 E. Performance Validation

| Check                           | Expected | ✅  |
| ------------------------------- | -------- | --- |
| 10 records processed < 1 minute | Verified |     |
| GPU temp < 80°C                 | Verified |     |
| No memory leak after 1 hour     | Verified |     |
| No duplicate revision created   | Verified |     |

### 🟢 F. Rollback Test (Mandatory)

| Check                                | Expected          | ✅  |
| ------------------------------------ | ----------------- | --- |
| Disable token works                  | is_active = false |     |
| Delete `SYSTEM_IMPORT` records works | COUNT = 0         |     |
| `import_transactions` cleared        | COUNT = 0         |     |
| Checkpoint reset to 0                | Verified          |     |
| Fallback state reset                 | Verified          |     |

---

## GO / NO-GO Criteria

**GO ถ้า:**

- A, B, C ทุก Check = PASS
- Dry run error rate < 10%
- JSON parse failure < 5%
- Revision conflict < 3%

**NO-GO ถ้า:**

- Enum mismatch (Category hardcoded)
- Idempotency ไม่ได้ implement
- Storage bypass (move file โดยตรง)
- Audit log ไม่ครบ

---

## Final Architectural Assessment

| Area               | Status                                            |
| ------------------ | ------------------------------------------------- |
| ADR Compliance     | ✅ Fully aligned                                  |
| Security           | ✅ Hardened (IP Whitelist, Rate Limit, Docker)    |
| Data Integrity     | ✅ Controlled (Idempotency, Revision Drift, Enum) |
| Storage Governance | ✅ Enforced (StorageService only)                 |
| Operational Safety | ✅ Production Grade                               |

---

_สำหรับขั้นตอนปฏิบัติงานแบบละเอียด ดูที่ `03-04-legacy-data-migration.md` และ `03-05-n8n-migration-setup-guide.md`_

---

## ADR Review Cycle

### Review Classification

**Core ADR Status:** This ADR is classified as a **Core Migration Architecture** due to its fundamental impact on data migration strategy and AI integration patterns.

### Review Schedule

| Review Type | Frequency | Trigger | Scope |
|-------------|-----------|---------|-------|
| **Regular Review** | Every 6 months | Calendar-based | Migration effectiveness, AI accuracy |
| **Major Version Review** | Every major version (v2.0.0, v3.0.0) | Version planning | Architecture relevance, new migration requirements |
| **Migration Review** | During migration execution | Migration progress | Performance, accuracy, operational issues |
| **Post-Migration Review** | After migration completion | Migration completion | Lessons learned, improvements, retirement planning |

### Review Process

#### Phase 1: Preparation (1 week before review)
1. **Migration Metrics Collection**
   - Migration progress and completion rates
   - AI validation accuracy and confidence scores
   - Error rates and failure patterns
   - Processing performance benchmarks
   - Storage and resource utilization metrics

2. **Stakeholder Notification**
   - Development Team
   - DevOps Engineer
   - AI Integration Lead
   - Database Administrator
   - Project Management

#### Phase 2: Review Meeting (2-hour session)
1. **Migration Performance Assessment**
   - Review migration progress against targets
   - Analyze AI validation accuracy and effectiveness
   - Evaluate processing speed and resource utilization
   - Assess error handling and recovery procedures

2. **Data Quality Evaluation**
   - Review AI validation accuracy against human verification
   - Analyze data integrity and consistency metrics
   - Evaluate duplicate detection and handling
   - Assess revision drift protection effectiveness

3. **Operational Assessment**
   - Review system stability and reliability
   - Evaluate monitoring and alerting effectiveness
   - Assess rollback and recovery procedures
   - Review security compliance and audit trails

#### Phase 3: Decision & Documentation (1 week after review)
1. **Review Outcomes**
   - **No Change:** Migration architecture remains effective
   - **Update Required:** Adjust AI parameters or migration procedures
   - **Enhancement:** Add new migration capabilities or optimizations
   - **Retire:** Migration complete, ADR no longer needed

2. **Documentation Updates**
   - Update migration procedures and guidelines
   - Revise performance benchmarks and targets
   - Document lessons learned and best practices
   - Update operational procedures and troubleshooting guides

### Review Criteria

| Criterion | Question | Pass/Fail Threshold |
|-----------|----------|---------------------|
| **Migration Progress** | Is migration meeting completion targets? | Pass: ≥90% of target, Fail: <90% |
| **AI Validation Accuracy** | Is AI validation meeting accuracy targets? | Pass: ≥85% accuracy, Fail: <85% |
| **Processing Performance** | Are processing times within acceptable limits? | Pass: <3s per record, Fail: >3s |
| **Data Integrity** | Are data integrity issues within acceptable limits? | Pass: <2% errors, Fail: ≥2% |
| **System Stability** | Is migration system stable and reliable? | Pass: >99% uptime, Fail: <99% |
| **Security Compliance** | Are all security controls functioning properly? | Pass: 100% compliant, Fail: Any violations |

### Review History Template

```
## Review Cycle [YYYY-MM-DD]

**Review Type:** [Regular/Major Version/Migration/Post-Migration]
**Reviewers:** [Names and roles]
**Duration:** [Meeting date]

### Findings
- [Key findings from migration performance and data quality assessment]

### Issues Identified
- [Performance bottlenecks, accuracy problems, or operational issues]

### Recommendations
- [Migration optimizations, AI improvements, or procedural changes]

### Outcome
- [No Change/Update Required/Enhancement/Retire]

### Next Review Date
- [YYYY-MM-DD]
```

---

## Document History

| Version | Date       | Author      | Changes                                                              |
| ------- | ---------- | ----------- | -------------------------------------------------------------------- |
| 1.8.0   | 2026-02-26 | DevOps Team | Initial ADR — Ollama + n8n Migration Architecture                    |
| 1.8.2   | 2026-04-03 | Tech Lead   | **Updated** — Aligned with ADR-019 (UUID Strategy), changed AI Model to `gemma4:9b` (9.6 GB) |
| 1.8.4   | 2026-04-04 | System Architect | **Enhanced** — Added Impact Analysis template, ADR Review Cycle process, Gap Linking to requirements, and Version Dependency tracking |
