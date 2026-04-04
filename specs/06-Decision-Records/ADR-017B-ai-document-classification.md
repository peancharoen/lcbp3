# ADR-017B: AI Document Classification

**Status:** Accepted
**Date:** 2026-03-27
**Version:** 1.8.2 (Aligned with ADR-020)
**Review Cycle:** Core ADR (Review every 6 months or Major Version upgrade)
**Decision Makers:** Development Team, AI Integration Lead
**Gap Resolution:** Addresses manual document classification inefficiency and inconsistency problems (Product Vision v1.8.5, Section 3.3) and AI-assisted workflow requirements (UAT Criteria, Section 4.8)
**Version Dependency:**
- **Effective From:** v1.8.2
- **Applies To:** v1.8.2+ (AI classification features)
- **Backward Compatible:** v1.8.0+ (Manual classification still available)
- **Required For:** v1.9.0+ (Enhanced document management)

**Related Documents:**

- [ADR-020: AI Intelligence Integration Architecture](./ADR-020-ai-intelligence-integration.md) — Overall AI Architecture & RFA-First Strategy
- [ADR-017: Ollama Data Migration Architecture](./ADR-017-ollama-data-migration.md)
- [ADR-018: AI Boundary Policy](./ADR-018-ai-boundary.md) — AI Physical Isolation (No Direct DB/Storage Access)
- [n8n Migration Setup Guide](../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md)
- [Legacy Data Migration Plan](../03-Data-and-Storage/03-04-legacy-data-migration.md)
- [Migration Business Scope](../03-Data-and-Storage/03-06-migration-business-scope.md)
- [Glossary](../00-Overview/00-02-glossary.md)

> **Note:** ADR-017B extends ADR-017's scope from batch migration to AI-powered document classification, enabling automatic categorization and metadata extraction. Complies with ADR-018 (AI Isolation Policy) and is part of ADR-020 (Unified AI Architecture).

---

## Context and Problem Statement

### ปัญหาที่ต้องการแก้ไข

โครงการ LCBP3 มีเอกสารจำนวนมาก (ทั้งเก่าและใหม่) ที่ต้องจัดหมวดหมู่และสกัด Metadata อัตโนมัติ การจัดหมวดหมู่ด้วยมือมีปัญหาหลัก 3 ประการ:

1. **Manual Labor สูง:** ต้องใช้เวลานานในการอ่านและจัดหมวดหมู่เอกสารด้วยมือ
2. **Human Error:** ความผิดพลาดจากการจัดหมวดหมู่ (ผิดประเภท, ผิด Tag) โดยเฉพาะเอกสารที่ซับซ้อน
3. **Inconsistency:** การจัดหมวดหมู่ไม่สม่ำเสมอกันระหว่างผู้จัดการคนละคน

### ข้อจำกัดที่สำคัญ

- **Data Privacy:** เอกสารก่อสร้างท่าเรือเป็นความลับ ห้ามส่งข้อมูลขึ้น Cloud AI Provider
- **Cost Constraint:** การใช้ Cloud AI (~$0.01–0.03 ต่อ Record) อาจสูงถึง $600 สำหรับ 20,000 records
- **Hardware Limitation:** ต้องรันบนเครื่องที่มีอยู่ (i7-9700K / 32GB RAM / RTX 2060 Super 8GB)

---

## Decision Drivers

- **Security First (ADR-018):** AI ต้องรันบน Admin Desktop (Desk-5439) เท่านั้น — ห้ามรันบน QNAP/Production Server
- **Privacy Guaranteed:** ประมวลผลภายในเครือข่ายองค์กร (On-Premise) เท่านั้น
- **Cost Effectiveness:** Zero Cost สำหรับ AI Inference (ไม่มีค่า Pay-per-use)
- **Data Integrity:** ข้อมูลที่ AI สกัดต้องผ่าน Human Verification ก่อน Commit ลงระบบจริง
- **AI Isolation (ADR-018):** AI ห้ามเข้าถึง Database/Storage โดยตรง — ต้องสื่อสารผ่าน DMS API เท่านั้น
- **Recoverability:** รองรับ Checkpoint/Resume และ Rollback ได้สมบูรณ์

---

## Considered Options

### Option 1: Manual Data Entry (No AI)

**Pros:**

- ไม่ต้องลงทุน Hardware เพิ่ม
- ความแม่นยำ 100% (ถ้าพิมพ์ถูก)

**Cons:**

- ❌ ใช้เวลานานมาก (อาจเป็นสัปดาห์หรือเดือน)
- ❌ Human Error สูง (Typo, Inconsistency)
- ❌ ไม่สามารถทำให้ Scanned PDF ค้นหาได้

### Option 2: Cloud AI Service (OpenAI, Google Vision, Azure AI)

**Pros:**

- AI ฉลาดสูง แม่นยำมาก
- ไม่ต้องดูแล Infrastructure

**Cons:**

- ❌ **ผิดนโยบาย Data Privacy** — เอกสารก่อสร้างท่าเรือเป็นความลับ
- ❌ **ค่าใช้จ่ายสูง** (~$600 สำหรับ 20,000 records)
- ❌ Dependency กับ External Service

### Option 3: Local AI (Ollama + Gemma 4 9B) + n8n + Human Verification ⭐ (Selected)

**Pros:**

- ✅ **Privacy Guaranteed** — รันภายในเครือข่ายองค์กร
- ✅ **Zero Cost** — ไม่มีค่า Pay-per-use
- ✅ **AI Isolation (ADR-018)** — AI รันบน Desktop แยกต่างหาก ไม่เข้าถึง DB โดยตรง
- ✅ **Human-in-the-Loop** — Admin ตรวจสอบก่อน Commit
- ✅ **Recoverability** — รองรับ Checkpoint/Resume
- ✅ **Clean Architecture** — แยก Migration Logic ออกจาก Core Application

**Cons:**

- ❌ ต้องเปิด Desktop ทิ้งไว้ดูแล GPU Temperature
- ❌ Model ขนาดเล็กอาจแม่นยำน้อยกว่า Cloud AI → ต้องมี Human Review Queue
- ❌ ใช้เวลา Migration ~16.6 ชั่วโมง (~3–4 คืน)

---

## Decision Outcome

**Chosen Option:** Option 3 — Local AI (Ollama + Gemma 4 9B) + n8n + Human Verification

**Rationale:**

การใช้ AI จัดหมวดหมู่เอกสารอัตโนมัติด้วย Ollama ช่วยลดภาระงานจากการจัดหมวดหมู่ด้วยมือ พร้อมรักษาความปลอดภัยตามนโยบาย ADR-018 ที่กำหนดให้ AI ต้องรันบน Admin Desktop แยกต่างหาก และไม่สามารถเข้าถึง Database/Storage โดยตรง ทำให้ได้ประสิทธิภาพที่ดีขึ้นในการจัดการเอกสารขนาดใหญ่

---

## Impact Analysis

### Affected Components

| Component | Impact Level | Description |
|-----------|--------------|-------------|
| **Frontend Components** | **High** | AI classification UI, suggestion displays, user confirmation flows |
| **Backend Services** | **High** | AI integration endpoints, validation services, classification logic |
| **AI Infrastructure** | **Medium** | Ollama model usage, prompt engineering, confidence scoring |
| **Database Schema** | **Medium** | AI suggestion storage, classification history, confidence tracking |
| **User Experience** | **Medium** | Workflow changes, AI-assisted classification interfaces |
| **API Design** | **Medium** | AI classification endpoints, response formats, error handling |
| **Testing Framework** | **Low** | AI accuracy tests, classification validation, user acceptance tests |
| **Documentation** | **Low** | User guides, AI classification procedures, troubleshooting |

### Required Changes

| Change Category | Specific Changes | Priority |
|----------------|------------------|----------|
| **Frontend** | <ul><li>Create AI classification suggestion components</li><li>Build confidence score indicators</li><li>Implement user confirmation dialogs</li><li>Add classification history displays</li><li>Create AI-assisted tagging interface</li></ul> | **Critical** |
| **Backend** | <ul><li>Implement AI classification service endpoints</li><li>Create validation layer for AI suggestions</li><li>Add confidence threshold processing</li><li>Implement classification audit logging</li><li>Create AI model communication interfaces</li></ul> | **Critical** |
| **Database** | <ul><li>Create AI classification suggestions table</li><li>Add confidence score tracking fields</li><li>Implement classification history logging</li><li>Create user feedback storage for AI improvement</li><li>Update data dictionary with AI fields</li></ul> | **High** |
| **AI Integration** | <ul><li>Setup Ollama model communication protocols</li><li>Implement prompt engineering for document classification</li><li>Create confidence scoring algorithms</li><li>Setup fallback model switching logic</li><li>Implement AI response validation</li></ul> | **High** |
| **API** | <ul><li>Create /api/ai/classify endpoint</li><li>Implement AI suggestion confirmation endpoints</li><li>Add AI service health check endpoints</li><li>Create classification feedback endpoints</li><li>Implement rate limiting for AI services</li></ul> | **High** |
| **Testing** | <ul><li>Create AI accuracy validation tests</li><li>Implement classification consistency tests</li><li>Add user acceptance testing for AI features</li><li>Create performance tests for AI endpoints</li><li>Implement security tests for AI boundaries</li></ul> | **Medium** |
| **Documentation** | <ul><li>Create user guide for AI classification features</li><li>Document AI model limitations and best practices</li><li>Create troubleshooting guide for AI issues</li><li>Update API documentation with AI endpoints</li></ul> | **Medium** |

### Cross-Component Dependencies

| Dependency | Source | Target | Impact |
|------------|--------|--------|--------|
| **Frontend → AI API** | Classification UI components | /api/ai/classify endpoint | User experience |
| **Backend → AI Services** | AI classification service | Ollama model API | Classification accuracy |
| **Database → Classification** | Classification results | AI suggestions table | Data persistence |
| **Validation → AI Output** | Validation layer | AI response processing | Quality control |
| **Audit → AI Interactions** | Logging service | Classification audit trail | Compliance |
| **Testing → AI Accuracy** | Test suites | Classification validation | Quality assurance |

---

## Implementation Architecture

### System Components

| Component | รายละเอียด | ที่ตั้ง |
|-----------|-----------|---------|
| **Migration Orchestrator** | n8n (Docker บน QNAP NAS) | QNAP NAS |
| **AI Processing Engine** | Ollama + Gemma 4 9B (9.6 GB) | Admin Desktop (Desk-5439) |
| **OCR Engine** | Tesseract หรือ Google Vision (On-prem) | Same as AI |
| **Verification UI** | Next.js Frontend — Review Mode | Web Browser |
| **Database** | MariaDB — Staging + Production | QNAP NAS |
| **File Storage** | Two-Phase Storage (Temp → Permanent) | NAS Mounts |

### Workflow (Main Success Scenario)

```
[1. Ingestion]        → Batch Upload (PDF/Scan)
      ↓
[2. Pre-processing]   → File Validation (NestJS)
      ↓
[3. OCR Layer]        → Raw Text Extraction (Tesseract)
      ↓
[4. AI Analysis]      → Gemma 4 9B via Ollama (Desk-5439)
      ↓
[5. Staging]          → migration_review_queue (MariaDB)
      ↓
[6. Verification]     → Admin Review UI (Next.js)
      ↓
[7. Commit]           → POST /api/migration/commit_batch
      ↓
[8. Finalization]     → Permanent Storage (QNAP)
```

### AI Processing Flow (ADR-018 Compliant)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Scanned PDF   │────▶│  OCR Engine     │────▶│   Raw Text      │
│   (Staging)     │     │  (Tesseract)    │     │   (Text)        │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                              ┌──────────────────────────┘
                              ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  DMS Backend    │◀────│  Ollama API     │◀────│  AI Prompt      │
│  (Validation)   │     │  (Desk-5439)    │     │  (Gemma 4 9B)   │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  JSON Metadata  │────▶ migration_review_queue
│  (Validated)    │
└─────────────────┘
```

> ⚠️ **ADR-018 Enforcement:** AI (Ollama) อยู่บน Desktop Desk-5439 แยกต่างหาก — ไม่มี Direct DB Access หรือ File System Access โดยตรง ทุกการสื่อสารผ่าน DMS Backend API เท่านั้น

---

## AI Prompt Specification (Prompt Engineering)

### Document Analysis Prompt

```markdown
บทบาท: คุณคือผู้ช่วยจัดการเอกสารวิศวกรรมโยธาประจำโครงการท่าเรือแหลมฉบัง เฟส 3
ภารกิจ: อ่านข้อความดิบจากการสแกน และสรุปข้อมูลออกมาในรูปแบบ JSON เท่านั้น

ข้อความดิบ: [RAW_TEXT_FROM_OCR]

รูปแบบ JSON ที่ต้องการ:
{
  "document_type": "รายงาน/สัญญา/จดหมายโต้ตอบ",
  "contract_number": "เลขที่สัญญา (ถ้ามี)",
  "contractor_name": "ชื่อบริษัทผู้รับเหมา",
  "work_phase": "Phase ของงาน (เช่น งานถมทะเล, งานไฟฟ้า)",
  "summary": "สรุปเนื้อหาสำคัญ 1-2 ประโยค",
  "key_dates": ["วันที่ในเอกสาร", "วันกำหนดส่งงาน"]
}
```

### Extracted Metadata Schema

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `document_type` | enum | Correspondence / RFA / Drawing / Minutes / Contract |
| `contract_number` | string | เลขที่สัญญา (เช่น LCBP3-C1) |
| `contractor_name` | string | ชื่อบริษัทผู้รับเหมา |
| `work_phase` | string | Phase งาน (จาก Master Data) |
| `work_zone` | string | Zone F, Basin 3, etc. |
| `priority` | enum | ด่วนที่สุด / ด่วน / ปกติ |
| `summary` | string | สรุปเนื้อหา 4-5 ประโยค |
| `confidence` | float | 0.0–1.0 (ความมั่นใจของ AI) |
| `suggested_tags` | array | Tags ที่แนะนำ (is_new: true/false) |

> ⚠️ **Patch Note:** `document_type` ต้องตรงกับ System Enum จาก `GET /api/meta/categories` เท่านั้น — ห้าม hardcode Category List ใน Prompt (ดู ADR-017)

---

## Security & Compliance (ADR-018)

### AI Isolation Requirements

| Rule | Implementation |
|------|----------------|
| **Physical Isolation** | Ollama รันบน Admin Desktop (Desk-5439) เท่านั้น |
| **No Direct DB Access** | AI ต้องสื่อสารผ่าน DMS API → Backend → Database |
| **No Direct Storage Access** | File operations ผ่าน StorageService เท่านั้น |
| **Validation Layer** | Backend ตรวจสอบ AI Output ก่อน Write ทุกครั้ง |
| **Audit Logging** | ทุก AI Request/Response บันทึกใน Audit Log |

### Two-Phase Storage (Storage Governance)

**ข้อห้าม:**

```bash
❌ mv /data/dms/staging_ai/TCC-COR-0001.pdf /final/path/...
```

**ข้อบังคับ (ADR-017):**

```
Phase 1: Temp Upload (โดย n8n)
✅ POST /api/storage/upload
   → ได้ผลลัพธ์เป็น attachment_id (เช่น 1024)
   → ไฟล์จะถูกระบุเป็น is_temporary = TRUE

Phase 2: Final Commit (โดย Admin ผ่าน Frontend)
✅ POST /api/migration/commit_batch
   body: { queue_ids: [1, 2, 3] }
```

---

## Confidence Threshold Policy

ข้อมูลทุกชุดจาก AI จะถูกส่งเข้า `migration_review_queue` โดยจัดสถานะตาม Confidence:

| Confidence Level | สถานะ | การดำเนินการ |
|-----------------|-------|--------------|
| `≥ 0.85` และ `is_valid = true` | PENDING | พร้อมให้ Admin Batch Import |
| `0.60–0.84` | PENDING | ไฮไลต์ให้ Admin ตรวจสอบก่อน |
| `< 0.60` หรือ `is_valid = false` | REJECTED | รอ Admin แก้ไข Manual |
| AI Parse Error | ERROR_LOG | Trigger Fallback Logic |

---

## Performance Estimation

| Parameter | ค่า |
|-----------|-----|
| Delay ระหว่าง Request | 2 วินาที |
| Inference Time (avg) | ~1 วินาที |
| เวลาต่อ Record | ~3 วินาที |
| จำนวน Record | 20,000 |
| **เวลารวม** | ~60,000 วินาที (~16.6 ชั่วโมง) |
| **จำนวนคืนที่ต้องใช้** | **~3–4 คืน** (รัน 22:00–06:00) |

> **Recommendation:** สำหรับเครื่อง i7-9700K / 32GB RAM / RTX 2060 Super 8GB แนะนำให้ใช้ Queue (BullMQ) ประมวลผลไฟล์แบบ Sequential (ทีละไฟล์) เพื่อให้ Gemma 4 9B (9.6 GB) ทำงานได้เสถียรที่สุดใน VRAM 8GB

---

## Consequences

### Positive Consequences

1. ✅ **Automated Classification:** ลดเวลาการจัดหมวดหมู่เอกสารด้วยมืออย่างมีนัยสำคัญ
2. ✅ **Consistent Categorization:** AI จัดหมวดหมู่อย่างสม่ำเสมอตามเกณฑ์เดียวกัน
3. ✅ **Security Compliant (ADR-018):** AI Isolation ชัดเจน ปลอดภัย
4. ✅ **Human-in-the-Loop:** ความถูกต้อง 100% ก่อนยืนยันการจัดหมวดหมู่
5. ✅ **Scalable:** รองรับการจัดหมวดหมู่เอกสารจำนวนมาก
6. ✅ **Cost Effective:** ไม่มีค่าใช้จ่ายต่อเอกสาร (On-premise AI)

### Negative Consequences

1. ❌ **Operational Overhead:** ต้องดูแล GPU Temperature และ Desktop Uptime
2. ❌ **Accuracy Trade-off:** Model ขนาดเล็กอาจแม่นยำน้อยกว่า Cloud AI
3. ❌ **Hardware Dependency:** ต้องพึ่งพา Desktop Desk-5439
4. ❌ **Processing Time:** ต้องรอ AI processing สำหรับเอกสารแต่ละฉบับ

### Mitigation Strategies

- **Human Review Queue** — บังคับตรวจสอบทุก record ก่อน Commit
- **Confidence Threshold** — แบ่งระดับตามความมั่นใจของ AI
- **Fallback Model** — Auto-switch ไป mistral:7b-instruct เมื่อ Error ≥ Threshold
- **Monitoring** — ตรวจสอบ GPU Temperature และ Progress ตลอดเวลา

---

## ADR Review Cycle

### Review Classification

**Core ADR Status:** This ADR is classified as a **Core AI Feature** due to its fundamental impact on document management workflows and AI integration patterns.

### Review Schedule

| Review Type | Frequency | Trigger | Scope |
|-------------|-----------|---------|-------|
| **Regular Review** | Every 6 months | Calendar-based | AI accuracy, user adoption, performance |
| **Major Version Review** | Every major version (v2.0.0, v3.0.0) | Version planning | Architecture relevance, new AI capabilities |
| **Performance Review** | Quarterly | Performance monitoring | AI processing times, accuracy metrics |
| **User Feedback Review** | Quarterly | User feedback analysis | User satisfaction, workflow improvements |

### Review Process

#### Phase 1: Preparation (1 week before review)
1. **Metrics Collection**
   - AI classification accuracy rates and trends
   - User adoption and satisfaction metrics
   - Processing performance benchmarks
   - Error rates and failure patterns
   - User feedback and improvement suggestions

2. **Stakeholder Notification**
   - Development Team
   - AI Integration Lead
   - Product Management
   - User Experience Team
   - Quality Assurance Team

#### Phase 2: Review Meeting (2-hour session)
1. **Performance Assessment**
   - Review AI accuracy metrics against targets
   - Analyze processing time performance
   - Evaluate error rates and failure patterns
   - Assess system resource utilization

2. **User Experience Evaluation**
   - Review user adoption and satisfaction rates
   - Analyze user feedback and improvement requests
   - Evaluate workflow integration effectiveness
   - Assess user interface and experience quality

3. **Technology Assessment**
   - Review AI model performance and accuracy
   - Evaluate new AI technologies and improvements
   - Assess integration with other system components
   - Review security and compliance status

#### Phase 3: Decision & Documentation (1 week after review)
1. **Review Outcomes**
   - **No Change:** AI classification remains effective and accurate
   - **Update Required:** Adjust AI parameters or user interface
   - **Enhancement:** Add new classification capabilities or features
   - **Retire:** AI classification no longer needed (unlikely)

2. **Documentation Updates**
   - Update AI classification procedures and guidelines
   - Revise user documentation and training materials
   - Update performance metrics and targets
   - Modify integration documentation

### Review Criteria

| Criterion | Question | Pass/Fail Threshold |
|-----------|----------|---------------------|
| **Classification Accuracy** | Is AI meeting target accuracy rates? | Pass: ≥85%, Fail: <85% |
| **User Adoption** | Are users actively using AI classification? | Pass: >70% adoption, Fail: ≤70% |
| **Processing Performance** | Are processing times within acceptable limits? | Pass: <10s per document, Fail: >10s |
| **User Satisfaction** | Are users satisfied with AI suggestions? | Pass: ≥4.0/5.0, Fail: <4.0/5.0 |
| **Error Rates** | Are AI errors within acceptable thresholds? | Pass: <5% error rate, Fail: ≥5% |
| **Integration Stability** | Is AI integration stable and reliable? | Pass: >99% uptime, Fail: <99% |

### Review History Template

```
## Review Cycle [YYYY-MM-DD]

**Review Type:** [Regular/Major Version/Performance/User Feedback]
**Reviewers:** [Names and roles]
**Duration:** [Meeting date]

### Findings
- [Key findings from accuracy, performance, and user experience assessment]

### Issues Identified
- [Accuracy problems, performance bottlenecks, or user experience issues]

### Recommendations
- [AI model improvements, user interface enhancements, or workflow changes]

### Outcome
- [No Change/Update Required/Enhancement/Retire]

### Next Review Date
- [YYYY-MM-DD]
```

---

## Related Documents

- [ADR-017: Ollama Data Migration Architecture](./ADR-017-ollama-data-migration.md) — Architecture หลักสำหรับ Migration
- [ADR-018: AI Boundary Policy](./ADR-018-ai-boundary.md) — Security Isolation สำหรับ AI
- [03-05-n8n-migration-setup-guide.md](../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md) — คู่มือติดตั้ง n8n Workflow
- [03-04-legacy-data-migration.md](../03-Data-and-Storage/03-04-legacy-data-migration.md) — แผน Migration แบบละเอียด
- [03-06-migration-business-scope.md](../03-Data-and-Storage/03-06-migration-business-scope.md) — Go/No-Go Gates และ Business Scope
- [00-02-glossary.md](../00-Overview/00-02-glossary.md) — คำศัพท์และตัวย่อในระบบ DMS

---

## Document History

| Version | Date       | Author     | Changes |
|---------|------------|------------|---------|
| 1.0.0   | 2026-02-26 | Nattanin   | Initial Use Case Specification |
| 1.8.1   | 2026-03-27 | Tech Lead  | **Refactored to ADR format** — Aligned with ADR-017, ADR-018, and Project Specs |
| 1.8.3   | 2026-04-04 | System Architect | **Renamed** — Changed from "Smart Legacy Document Digitization" to "AI Document Classification" for clarity and simplicity |
| 1.8.4   | 2026-04-04 | System Architect | **Enhanced** — Added Impact Analysis template, ADR Review Cycle process, Gap Linking to requirements, and Version Dependency tracking |

---

**Last Updated:** 2026-04-04
**Status:** Accepted
**Next Review:** 2026-06-01 (Quarterly review)
**Next 6-Month Review:** 2026-10-04 (regular review cycle)
