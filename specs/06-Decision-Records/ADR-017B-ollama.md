# ADR-017B: Smart Legacy Document Digitization (AI-Powered Use Case Extension)

**Status:** Accepted
**Date:** 2026-03-27
**Version:** 1.8.2 (Aligned with ADR-020)
**Decision Makers:** Development Team, AI Integration Lead
**Related Documents:**

- [ADR-020: AI Intelligence Integration Architecture](./ADR-020-ai-intelligence-integration.md) — Overall AI Architecture & RFA-First Strategy
- [ADR-017: Ollama Data Migration Architecture](./ADR-017-ollama-data-migration.md)
- [ADR-018: AI Boundary Policy](./ADR-018-ai-boundary.md) — AI Physical Isolation (No Direct DB/Storage Access)
- [n8n Migration Setup Guide](../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md)
- [Legacy Data Migration Plan](../03-Data-and-Storage/03-04-legacy-data-migration.md)
- [Migration Business Scope](../03-Data-and-Storage/03-06-migration-business-scope.md)
- [Glossary](../00-Overview/00-02-glossary.md)

> **Note:** ADR-017B เป็น Use Case Extension ของ ADR-017 ที่ขยายขอบเขตการใช้งาน Ollama จาก Migration Batch สู่ระบบจัดหมวดหมู่เอกสารอัจฉริยะ (Smart Categorization) พร้อมควบคุมตาม ADR-018 (AI Isolation Policy) และเป็นส่วนหนึ่งของ ADR-020 (Unified AI Architecture).

---

## Context and Problem Statement

### ปัญหาที่ต้องการแก้ไข

โครงการ LCBP3 มีเอกสารเก่าจำนวนมาก (กว่า 20,000 ฉบับ) ที่ต้องนำเข้าสู่ระบบ DMS ใหม่ การจัดหมวดหมู่และสกัด Metadata ด้วยมือมีปัญหาหลัก 3 ประการ:

1. **Manual Labor สูง:** ต้องใช้เวลานานในการอ่านและพิมพ์ข้อมูล Metadata (Data Entry)
2. **Human Error:** ความผิดพลาดจากการพิมพ์ (Typo) โดยเฉพาะเลขที่สัญญาและชื่อเฉพาะ
3. **Searchability:** ไฟล์ PDF ที่เป็นแค่ภาพสแกน (Scanned) ไม่สามารถค้นหาเนื้อหาได้

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

ประยุกต์ใช้ Hardware ที่มีอยู่ (i7-9700K + RTX 2060 Super) โดยไม่ขัดหลัก Privacy และ Security ของโครงการ n8n ช่วยลด Risk ที่จะกระทบ Core Backend และรองรับ Checkpoint/Resume ได้ดีกว่าการเขียน Script เอง นอกจากนี้ยังสอดคล้องกับ **ADR-018 (AI Boundary)** ที่กำหนดให้ AI ต้องรันบน Admin Desktop แยกต่างหาก และไม่สามารถเข้าถึง Database/Storage โดยตรงได้

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

1. ✅ **Privacy Guaranteed** — ไม่มีข้อมูลออกนอกเครือข่ายองค์กร
2. ✅ **Zero AI Cost** — ไม่มีค่าใช้จ่าย Pay-per-use
3. ✅ **Security Compliant (ADR-018)** — AI Isolation ชัดเจน
4. ✅ **Human-in-the-Loop** — ความถูกต้อง 100% ก่อน Commit
5. ✅ **Recoverability** — รองรับ Checkpoint/Resume และ Rollback
6. ✅ **Searchable Legacy** — Scanned PDF กลายเป็น Searchable Metadata

### Negative Consequences

1. ❌ **Operational Overhead** — ต้องดูแล GPU Temperature และ Desktop Uptime
2. ❌ **Accuracy Trade-off** — Model ขนาดเล็กอาจแม่นยำน้อยกว่า Cloud AI
3. ❌ **Time Investment** — ต้องใช้เวลา ~3–4 คืนในการ Migration
4. ❌ **Hardware Dependency** — ต้องพึ่งพา Desktop Desk-5439

### Mitigation Strategies

- **Human Review Queue** — บังคับตรวจสอบทุก record ก่อน Commit
- **Confidence Threshold** — แบ่งระดับตามความมั่นใจของ AI
- **Fallback Model** — Auto-switch ไป mistral:7b-instruct เมื่อ Error ≥ Threshold
- **Monitoring** — ตรวจสอบ GPU Temperature และ Progress ตลอดเวลา

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

---

**Last Updated:** 2026-03-27
**Status:** Accepted
**Next Review:** 2026-06-01 (Quarterly review)
