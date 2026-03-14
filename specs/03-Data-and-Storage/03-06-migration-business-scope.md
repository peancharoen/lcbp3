# 📦 Legacy Data Migration — Business Scope & Governance

---
title: 'Migration Business Scope, Data Governance, and Go/No-Go Gates'
version: 1.0.0
status: DRAFT — Awaiting Stakeholder Confirmation
owner: Nattanin Peancharoen (PO + Migration Lead)
last_updated: 2026-03-11
related:
  - specs/03-Data-and-Storage/03-04-legacy-data-migration.md   ← Technical Implementation
  - specs/03-Data-and-Storage/03-05-n8n-migration-setup-guide.md
  - specs/06-Decision-Records/ADR-017-ollama-data-migration.md
  - specs/06-Decision-Records/ADR-018-ai-boundary.md
  - specs/00-Overview/00-04-stakeholder-signoff-and-risk.md     ← Risk Register (RISK-002)
---

> [!IMPORTANT]
> เอกสารนี้กำหนด **ขอบเขตทางธุรกิจ** ของการ Migration เท่านั้น  
> รายละเอียดทางเทคนิค (n8n Workflow, Ollama Prompt, API Spec) อยู่ใน `03-04-legacy-data-migration.md`

> [!NOTE]
> "เอกสารเก่า" คือเอกสารที่บริหารจัดการผ่าน Email + File Share ก่อนระบบ LCBP3-DMS  
> จำนวน: ประมาณ **20,000 ไฟล์ PDF** พร้อม Metadata ใน Excel

---

## 1. 🎯 Migration Objective

| วัตถุประสงค์ | รายละเอียด |
|------------|-----------|
| **Continuity** | ผู้ใช้สามารถค้นหาและอ้างอิงเอกสารเก่าในระบบใหม่ได้ทันที |
| **Traceability** | Workflow ใหม่สามารถ Link กลับไปยัง Correspondence เก่าได้ |
| **Searchability** | เอกสารเก่าถูก Index ใน Elasticsearch — ค้นหาได้ด้วย Full-text |
| **Compliance** | Audit Trail ครบ: รู้ว่าใครนำเข้า เมื่อไหร่ จาก Batch ไหน |

---

## 2. 📋 Data Scope Definition

### 2.1 ✅ IN SCOPE — นำเข้าระบบใหม่

| ประเภทเอกสาร | Subdirectory | Volume (ประมาณ) | Priority |
|-------------|-------------|----------------|---------|
| **Correspondence** (Letters, RFI) | `CORR/` | ~8,000 ไฟล์ | 🔴 High |
| **RFA + Shop Drawings** | `RFA/` | ~5,000 ไฟล์ | 🔴 High |
| **Contract Drawings** | `CD/` | ~3,000 ไฟล์ | 🟠 Medium |
| **Transmittals** | `TRM/` | ~2,000 ไฟล์ | 🟠 Medium |
| **Reports & Minutes** | `RPT/` | ~2,000 ไฟล์ | 🟡 Low |

**ช่วงเวลาที่ Include:**
- **เริ่มต้น:** 1 มกราคม 2564 (โครงการเริ่ม)
- **สิ้นสุด:** วันก่อน Go-Live — 1 วัน (เอกสารหลังจากนั้นใช้ระบบใหม่)

**เงื่อนไข Include:**
- ไฟล์ต้องเป็น PDF (หรือ DWG สำหรับ Drawing)
- ไฟล์ต้อง Readable โดย Tika/Ollama (ไม่ Corrupted)
- มี Row ใน Excel Metadata ที่ตรงกัน (document_number ไม่ว่าง)

---

### 2.2 ❌ OUT OF SCOPE — ไม่นำเข้า

| รายการ | เหตุผล |
|--------|-------|
| **เอกสารก่อนปี 2564** | ก่อนเริ่มโครงการ LCBP3 Phase 3 |
| **Email Body / Attachments ที่ไม่ใช่ PDF** | Format ไม่รองรับ |
| **Draft ที่ไม่เคย Submit** | ไม่มีเลขเอกสารทางการ |
| **ไฟล์ที่ Corrupted หรืออ่านไม่ได้** | ไปที่ Reject Log |
| **ข้อมูล Financial / Cost Records** | ไม่อยู่ใน DMS Scope |
| **Personal Communication (ไม่มีเลขทางการ)** | ไม่ใช่เอกสารทางการ |
| **วิดีโอ / รูปภาพ Standalone** | ไม่ใช่ Document |
| **ไฟล์ DWG ที่ไม่มี PDF คู่** | ออก PDF ก่อนนำเข้า (Admin Task) |

---

### 2.3 📊 Migration Tiers (ลำดับความสำคัญ)

```
Tier 1 — ต้องนำเข้าก่อน Go-Live (บล็อก Go-Live ถ้าไม่เสร็จ):
┌─────────────────────────────────────────────────────────┐
│  Correspondence สำคัญ (marked as "CRITICAL" ใน Excel)  │
│  RFA ที่ยัง Active อยู่ (status != FINAL_APPROVED)     │
│  จำนวนประมาณ: 2,000 เอกสาร                             │
│  Deadline: T-3 วันก่อน Go-Live                         │
└─────────────────────────────────────────────────────────┘

Tier 2 — นำเข้าภายใน 2 สัปดาห์หลัง Go-Live:
┌─────────────────────────────────────────────────────────┐
│  Correspondence ทั่วไป + RFA FINAL ที่เสร็จแล้ว        │
│  Contract Drawings                                      │
│  จำนวนประมาณ: 10,000 เอกสาร                            │
│  Deadline: Go-Live + 14 วัน                            │
└─────────────────────────────────────────────────────────┘

Tier 3 — นำเข้าภายใน 1 เดือนหลัง Go-Live:
┌─────────────────────────────────────────────────────────┐
│  Reports, Minutes, Archives                              │
│  เอกสารที่ AI Confidence ต่ำ (ต้องผ่าน Manual Review)   │
│  จำนวนประมาณ: 8,000 เอกสาร                             │
│  Deadline: Go-Live + 30 วัน                             │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 🗃️ Source Data Assessment

### 3.1 Excel Metadata Schema (Legacy)

| Column | Field ใหม่ | บังคับ | หมายเหตุ |
|--------|----------|-------|---------|
| `DOC_NO` | `document_number` | ✅ | ใช้เป็น Idempotency Key |
| `TITLE` | `title` | ✅ | AI จะ Suggest แก้ไขถ้าผิด Format |
| `DATE` | `reference_date` | ✅ | วันที่เอกสาร (ไม่ใช่วันนำเข้า) |
| `FROM_ORG` | `sender_org_id` | ✅ | Map ด้วย org_code lookup table |
| `TO_ORG` | `receiver_org_id` | ✅ | Map ด้วย org_code lookup table |
| `TYPE` | `category` | ✅ | AI ตรวจสอบ Enum ที่ถูกต้อง |
| `DISCIPLINE` | `discipline` | ❌ | Optional — AI Extract จาก Title |
| `CONTRACT_NO` | `contract_id` | ❌ | Map ด้วย contract lookup table |
| `PROJECT_NO` | `project_id` | ✅ | ต้องมี (ทุกเอกสาร) |
| `FILE_PATH` | `source_file_path` | ✅ | Path ใน NAS staging folder |
| `REVISION` | `revision` | ❌ | Detect จากเลขเอกสาร |

### 3.2 Organization Code Mapping

> ต้องสร้าง Lookup Table ก่อนเริ่ม Migration — Superadmin ทำใน Pre-migration Setup

| Legacy Code (Excel) | Organization ใหม่ | org_id (System) |
|--------------------|-----------------|----------------|
| กทท. | การท่าเรือแห่งประเทศไทย | TBD (ดูจาก DB) |
| สค. | สำนักงานโครงการ | TBD |
| TEAM | TEAM | TBD |
| คคง. | คณะกรรมการตรวจงาน | TBD |
| ผรม. | ผู้รับจ้างหลัก | TBD |

> **Action Item:** Superadmin ต้อง Fill in `org_id` ก่อน Migration เริ่ม

---

## 4. 📅 Migration Timeline

```
T-6 สัปดาห์ก่อน Go-Live:
├── Data Audit: นับไฟล์, ตรวจ Excel Quality
├── สร้าง Organization Lookup Table
├── ติดตั้ง n8n + Ollama บน Staging Environment
└── สร้าง Migration Bot User + Token (7 วัน, IP Whitelist)

T-5 สัปดาห์:
├── DRY RUN 1: Batch 50 เอกสาร — ตรวจ Error Rate
├── แก้ไข Mapping / Prompt ตามผล Dry Run 1
└── Tier 1 List ยืนยันกับ Document Control แต่ละ Org

T-4 สัปดาห์:
├── DRY RUN 2: Batch 500 เอกสาร — ตรวจ Scale Issue
├── Admin Review Queue Round 1
└── Performance Check: Runtime ≈ ตามประมาณการ?

T-3 สัปดาห์:
├── **Production Migration START — Tier 1 (2,000 เอกสาร)**
├── ตรวจ Integrity ทุกวัน (SQL Verification Queries)
└── Token Expire? → Renew (ไม่เกิน 7 วัน/ครั้ง)

T-2 สัปดาห์:
├── Verify Tier 1 Complete → Migration Go/No-Go Gate #1
├── Start Tier 2 Migration (10,000 เอกสาร)
└── Admin Review Queue Round 2

Go-Live Day:
├── Migration Bot Token: REVOKE ทันที
├── Staging Folder: Read-only (ยังไม่ลบ — 30 วัน)
└── Tier 1 + Tier 2 ต้องเสร็จ✅ ก่อน Go-Live

T+1 เดือน:
├── Tier 3 Migration (8,000 เอกสาร)
├── Final Integrity Check
└── Legacy System → Read-only (ไม่ลบ — เก็บ 6 เดือน)
```

---

## 5. ✅ Migration Go/No-Go Gates

### Gate #1: Before Production Migration Starts (T-3 สัปดาห์)

| เกณฑ์ | ต้องผ่าน | วิธีวัด |
|-------|---------|--------|
| Dry Run 2 JSON Parse Success | ≥ 95% | n8n Execution Log |
| Dry Run 2 AI Category Accuracy | ≥ 90% (Manual Spot-check 50 docs) | Human Review |
| Idempotency Test: รัน Batch ซ้ำ | 0 Duplicate Records | SQL Count |
| Organization Mapping ครบ | 100% | Lookup Table review |
| Frontend Review UI พร้อมใช้งาน | ✅ | UAT Passed สำหรับหน้าจออนุมัติ |
| Migration Bot Token Active + Whitelisted | ✅ | API Test |
| Staging NAS Space: ≥ 500GB free | ✅ | QNAP Dashboard |

**Owner:** Nattanin P. | **Approver:** Org Admin ทุกองค์กร

---

### Gate #2: Before Go-Live (T-1 วัน)

| เกณฑ์ | ต้องผ่าน |
|-------|---------|
| Tier 1 Migration: 100% เสร็จ + Verified | ✅ |
| Tier 2 Migration: ≥ 90% เสร็จ + Verified | ✅ |
| Review Queue (รวมการพิจารณา AI New Tags): ≤ 5% ค้างอยู่ (Critical Tier 1 = 0%) | ✅ |
| Migration Bot Token: REVOKED | ✅ |
| Integrity Queries ผ่านทั้งหมด | ✅ |
| Legacy System ยังเข้าถึงได้ (Read-only Fallback) | ✅ |

---

### Gate #3: Post Go-Live (T+30 วัน)

| เกณฑ์ | ต้องผ่าน |
|-------|---------|
| Tier 3 Migration: 100% เสร็จ | ✅ |
| User Search Test: สามารถค้นหา Legacy Doc ใน ES | ✅ |
| Zero Orphan Files ใน Staging | ✅ |
| Legacy System Archive เสร็จ (Compress + Store) | ✅ |

---

## 6. 🧑‍💼 Data Ownership & Responsibility

| Responsibility | Owner | Action |
|---------------|-------|--------|
| **Excel Metadata Quality** | Document Control (สค.) | ทำความสะอาดก่อน T-6 |
| **File Organization บน NAS** | Nattanin P. + IT | จัด Folder structure |
| **Organization Lookup Table** | Superadmin (NAP) | สร้างก่อน T-6 |
| **Tier 1 Document List** | Document Control ทุก Org | ยืนยัน T-5 |
| **Daily Monitoring (n8n Runs)** | Nattanin P. | T-3 ถึง Go-Live |
| **Admin Review Queue & AI Tag Approval** | Document Control (สค.) | ทุกเช้าวันทำงาน (บังคับตรวจสอบ New Tags) |
| **Post-migration Verification** | Nattanin P. | After each Gate |
| **Legacy System Archival** | กทท. IT + NAP | T+30 |

---

## 7. 🔒 Data Privacy & Security

### ข้อกำหนดการ Migrate

1. **Files ต้อง Scan ClamAV ก่อน** ก่อนเข้า Staging Folder
   - Migration Bot มี Bypass Virus Scan Permission เฉพาะกรณีนี้
   - หมายความว่า Pre-scan ต้องทำโดย Admin ก่อน (ไม่ใช่ Skip)

2. **Migration Token Restrictions** (ดู `03-04-legacy-data-migration.md` Section 2):
   - IP Whitelist: NAS IP เท่านั้น
   - Expiry: 7 วัน (ต้อง Renew ทุกสัปดาห์)
   - Revoke ทันที หลัง Migration เสร็จ

3. **AI Isolation** (ตาม ADR-018):
   - Ollama ไม่มี Direct DB Access
   - Ollama เห็นแค่ Text Content จากไฟล์ PDF — ไม่เห็น System Data
   - Output ของ AI ต้องผ่าน Backend Validation ก่อน Write

4. **Audit Log**: ทุก Record ที่ Import มี:
   ```json
   { "created_by": "SYSTEM_IMPORT", "batch_id": "migration_YYYYMMDD", "action": "IMPORT" }
   ```

5. **Data Retention ของ Legacy Files**:
   - Staging Folder: เก็บ 30 วันหลัง Migration เสร็จ → แล้วลบ
   - ต้นฉบับ (ใน Old System): เก็บ 6 เดือน Read-only → Archive

---

## 8. 🔄 Rollback & Contingency

### กรณี Migration ล้มเหลว (Error Rate > 20%)

```
1. หยุด n8n Workflow ทันที
2. Disable Migration Bot Token (SQL)
3. Run Rollback SQL (ดู 03-04-legacy-data-migration.md Section 4)
4. แจ้ง PO + Org Admin: "Migration หยุด — เหตุผล: ___"
5. Post-mortem: วิเคราะห์ Root Cause
6. Fix → Dry Run ใหม่ → Gate #1 ใหม่
```

### กรณี Go-Live โดย Tier 2 ไม่เสร็จ (Emergency)

**เปิดใช้ Parallel Operation:**
- ระบบใหม่: เอกสาร Tier 1 + เอกสารใหม่หลัง Go-Live
- Legacy System: เปิด Read-only สำหรับเอกสาร Tier 2/3 ยังไม่ Migrate
- Timeline Extension: Tier 2 ต้องเสร็จภายใน T+7 (ไม่เกิน 1 สัปดาห์หลัง Go-Live)

---

## 9. 📊 Migration Success Metrics

| Metric | Target | วิธีวัด |
|--------|--------|--------|
| Total Records Imported | ≥ 95% ของ In-Scope | SQL COUNT vs Excel Row Count |
| Auto-import Rate (confidence ≥ 0.85) | ≥ 70% | n8n Execution Report |
| Review Queue Clearance | ≥ 95% ก่อน Go-Live | Review Queue Table |
| Reject Rate (Corrupted/Unreadable) | < 5% | Reject Log |
| Duplicate Records | 0 | SQL HAVING COUNT > 1 |
| Tag Extraction Rate | ≥ 80% ของ Auto-imported docs มี ≥ 1 Tag | SQL |
| Post-migration Search Hit Rate | ≥ 90% ของ Legacy doc numbers ค้นหาเจอ | Manual Test 100 samples |

---

## 📝 Document Control

- **Version:** 1.0.0 | **Status:** DRAFT
- **Created:** 2026-03-11 | **Owner:** Nattanin Peancharoen
- **Stakeholder Review:** T-6 สัปดาห์ก่อน Go-Live
- **Technical Detail:** ดู [`03-04-legacy-data-migration.md`](../03-Data-and-Storage/03-04-legacy-data-migration.md)
- **Classification:** Internal Use Only
