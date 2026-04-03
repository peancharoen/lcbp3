# ADR-020: AI Intelligence Integration Architecture

**Status:** Proposed
**Date:** 2026-04-03
**Version:** 1.8.5
**Decision Makers:** Development Team, AI Integration Lead, System Architect
**Related Documents:**

- [ADR-017: Ollama Data Migration Architecture](./ADR-017-ollama-data-migration.md)
- [ADR-017B: Smart Legacy Document Digitization](./ADR-017B-ollama.md)
- [ADR-018: AI Boundary Policy](./ADR-018-ai-boundary.md) — AI Physical Isolation
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md) — UUID Strategy
- [n8n Migration Setup Guide](../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md)

> **หมายุ:** ADR-020 กำหนดสถาปัตยกรรมการผสานรวม AI Intelligence เข้ากับระบบ NAP-DMS แบบครบวงจร โดยใช้แนวทาง "RFA-First" เพื่อให้ครอบคลุมทั้งการนำเข้าเอกสารเก่า (Legacy Migration) และการสร้างเอกสารใหม่ (New Ingestion)

---

## Context and Problem Statement

### ปัญหาที่ต้องการแก้ไข

ระบบ NAP-DMS v1.8.5 ต้องการเพิ่มประสิทธิภาพการทำงานกับเอกสารวิศวกรรมโดยใช้ AI Intelligence ใน 2 สถานการณ์หลัก:

1. **Legacy Document Migration:** มีเอกสาร PDF เก่าจำนวนมากที่ต้องนำเข้าระบบ พร้อมตรวจสอบความถูกต้องระหว่าง Metadata ใน Excel กับเนื้อหาใน PDF
2. **New Document Ingestion:** ผู้ใช้งานอัปโหลดเอกสารใหม่และต้องการความช่วยเหลือจาก AI ในการสกัดข้อมูลอัตโนมัติ

### ข้อจำกัดและข้อกำหนด

- **Security (ADR-018):** AI ต้องรันบน Admin Desktop (Desk-5439) แยกส่วนกับระบบหลัก
- **Data Privacy:** ห้ามส่งข้อมูลขึ้น Cloud Provider ต้องประมวลผลภายในองค์กรเท่านั้น
- **Human-in-the-Loop:** ข้อมูลที่ AI สกัดต้องผ่านการตรวจสอบโดยมนุษย์เสมอ
- **Thai Language Support:** ต้องรองรับเอกสารภาษาไทยและวิศวกรรม

---

## Decision Drivers

- **RFA-First Approach:** เริ่มจากเอกสาร RFA (Request for Approval) ที่มีความซับซ้อนสูง
- **Unified Architecture:** ใช้ Pipeline และ Component ร่วมกันทั้ง 2 รูปแบบการทำงาน
- **Data Integrity:** รักษาความถูกต้องของข้อมูลเป็นสำคัญสูงสุด
- **User Experience:** จัดหมวดหมู่ระหว่าง Batch Throughput กับ Real-time UX
- **Cost Efficiency:** ใช้ Ollama แบบ On-Premise เพื่อลดต้นทุน
- **Maintainability:** แยก Logic ของ AI ออกจาก Core Application

---

## Considered Options

### Option 1: Separate AI Systems per Use Case

**Pros:**
- ✅ เชี่ยวชาญเฉพาะทาง (Specialized)
- ✅ แยก Failure Domain

**Cons:**
- ❌ Code Dupification สูง
- ❌ บำรุงรักษายาก (Multiple systems)
- ❌ Inconsistent AI Behavior

### Option 2: Unified AI Pipeline with Different Frontends ⭐ (Selected)

**Pros:**
- ✅ **Single Source of Truth:** Pipeline กลางเดียว
- ✅ **Reusable Components:** DocumentReviewForm ใช้ร่วมกันได้
- ✅ **Consistent Quality:** Prompt และ Model เดียวกัน
- ✅ **Easier Maintenance:** แก้ไขที่เดียว ใช้ได้ทั้งหมด
- ✅ **Cost Effective:** ใช้ Ollama รุ่นเดียว (Gemma 4)

**Cons:**
- ❌ ต้องออกแบบให้รองรับทั้ง Batch และ Real-time
- ❌ Complex Component Design

---

## Decision Outcome

**Chosen Option:** Option 2 — Unified AI Pipeline with Different Frontends

**Rationale:**

การสร้าง Pipeline กลางเดียวสำหรับ AI และใช้ Component ร่วมกันทาง Frontend จะช่วยลดความซับซ้อนในการบำรุงรักษา และรับประกันความสม่ำเสมอของคุณภาพ AI ทั้งในการนำเข้าเอกสารเก่าและใหม่

---

## Architecture Overview

### Core Technology Stack

| Component | Technology | Host | Purpose |
|-----------|------------|------|---------|
| **AI Engine** | Ollama + Gemma 4 | Admin Desktop (Desk-5439) | LLM Inference |
| **OCR Engine** | PaddleOCR | Admin Desktop (Desk-5439) | Thai/English Text Extraction |
| **Orchestrator** | n8n | QNAP NAS (Docker) | Workflow Management |
| **AI Gateway** | NestJS AiModule | QNAP NAS (Docker) | API Gateway & Validation |

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Processing Flow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐     │
│  │   Input     │───▶│    n8n      │───▶│  AI Services    │     │
│  │  (PDF/Excel)│    │  Workflow   │    │ (OCR+LLM)       │     │
│  └─────────────┘    └─────────────┘    └────────┬────────┘     │
│                                              │                 │
│                                              ▼                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              DMS Backend API                           │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │   │
│  │  │AiService    │    │Validation   │    │Audit Log   │  │   │
│  │  │Gateway      │◀───│Layer        │◀───│Service     │  │   │
│  │  └─────────────┘    └─────────────┘    └────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Frontend Layer                           │   │
│  │  ┌─────────────────────┐    ┌─────────────────────┐     │   │
│  │  │  Migration Dashboard │    │  Document Review   │     │   │
│  │  │      (Admin)        │    │     Form (User)     │     │   │
│  │  └─────────────────────┘    └─────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Modules

### Backend Components

#### 1. AiModule & AiService

```typescript
@Injectable()
export class AiService {
  // Single entry point for all AI operations
  async extractMetadata(fileId: string): Promise<AiExtractionResult> {
    // 1. Send to n8n workflow
    // 2. Wait for OCR + LLM processing
    // 3. Validate results
    // 4. Return structured data
  }

  async validateExtraction(result: AiExtractionResult): Promise<ValidationResult> {
    // Confidence scoring, enum validation, audit logging
  }
}
```

#### 2. Migration Entity

```sql
CREATE TABLE migration_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  publicId BINARY(16) DEFAULT (UUID_TO_BIN(UUID(), 1)),
  source_file VARCHAR(255) NOT NULL,
  source_metadata JSON, -- Data from Excel
  ai_extracted JSON, -- Data from AI
  confidence_score DECIMAL(3,2),
  status ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED'),
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 3. API Endpoints

| Endpoint | Purpose | Access |
|----------|---------|--------|
| `POST /api/ai/extract` | Real-time extraction | Authenticated Users |
| `POST /api/migration/batch` | Batch migration | Admin Only |
| `GET /api/migration/queue` | Review queue | Admin Only |
| `POST /api/migration/commit` | Commit approved items | Admin Only |

### Frontend Components

#### 1. DocumentReviewForm (Reusable Component)

```typescript
interface DocumentReviewFormProps {
  // Source: Migration Table or AI API Response
  sourceData: MigrationItem | AiExtractionResult;
  // Mode: 'migration' | 'new'
  mode: 'migration' | 'new';
  onSubmit: (validatedData: ValidatedDocument) => void;
}

// Features:
// - Highlight AI-suggested fields
// - Show confidence scores
// - Allow human correction
// - Track feedback for AI improvement
```

#### 2. Migration Dashboard (Admin)

```typescript
// Features:
// - Filter by confidence level
// - Bulk approve/reject
// - Compare source vs AI data
// - Export review reports
```

---

## Workflow Specifications

### Workflow 1: Legacy Migration (Batch Processing)

```
Input: Excel Metadata + PDF Files
  │
  ▼
n8n Workflow:
  1. Read Excel row
  2. Send PDF to PaddleOCR
  3. Extract Thai/English text
  4. Send text + metadata to Gemma 4
  5. AI validates consistency
  6. Generate confidence score
  7. Store in migration_logs (PENDING_REVIEW)
  │
  ▼
Output: Migration Dashboard for Admin Review
  │
  ▼
Action: Admin approves → Commit to permanent storage
```

### Workflow 2: New Ingestion (Real-time Processing)

```
Input: User uploads PDF in RFA creation form
  │
  ▼
n8n Workflow (Real-time):
  1. OCR extraction (PaddleOCR)
  2. AI analysis (Gemma 4)
  3. Return suggestions to frontend
  │
  ▼
Output: Form auto-fill with AI suggestions
  │
  ▼
Action: User reviews/edits → Saves to database
```

---

## AI Model Configuration

### Gemma 4 Prompt Strategy

```prompt
You are an AI assistant for Laem Chabang Phase 3 construction project document analysis.

TASK: Extract and validate metadata from engineering documents.

RULES:
1. Extract: Subject, Date, Discipline, Drawing Reference, Contract Number
2. Validate: Check consistency between provided metadata and document content
3. Confidence: Rate accuracy (0-100%) for each extracted field
4. Language: Support Thai and English engineering terms
5. Format: Return structured JSON

OUTPUT FORMAT:
{
  "extracted_metadata": {
    "subject": "...",
    "date": "YYYY-MM-DD",
    "discipline": "Civil|Mechanical|Electrical|Architectural",
    "drawing_reference": "...",
    "contract_number": "..."
  },
  "validation": {
    "is_consistent": true|false,
    "discrepancies": ["..."],
    "confidence_score": 0.95
  }
}
```

### Confidence Scoring Strategy

| Score Range | Action |
|-------------|--------|
| **95-100%** | Auto-approve (migration only) |
| **85-94%** | Low priority review |
| **60-84%** | High priority review |
| **< 60%** | Reject / Requires manual entry |

---

## Security & Compliance

### AI Boundary Enforcement (ADR-018)

| Rule | Implementation |
|------|----------------|
| **Physical Isolation** | AI runs on Admin Desktop only |
| **No Direct DB Access** | All communication via DMS API |
| **API Authentication** | JWT tokens with `ai:invoke` scope |
| **Audit Logging** | Every AI interaction logged |
| **Human Validation** | No auto-commit without review |

### Data Privacy Measures

- **Local Processing Only:** No data leaves corporate network
- **Temporary Storage:** AI processes data in memory only
- **Encryption:** All API calls use TLS 1.3
- **Data Retention:** AI logs retained for 90 days only

---

## Implementation Roadmap

### Phase 1: Pipeline Infrastructure (Task BE-AI-01)

**Week 1-2: AI Pipeline Foundation**
1. **Docker Environment Setup** on Admin Desktop (Desk-5439)
   - n8n service with Basic Authentication
   - Ollama with Gemma 4 model (GPU optimized)
   - PaddleOCR service with Thai language support
2. **n8n Workflow Development**
   - Webhook trigger for DMS integration
   - OCR → AI → JSON processing pipeline
   - Error handling and retry logic
3. **Prompt Engineering**
   - Thai engineering document templates
   - JSON schema validation
   - Confidence scoring implementation
4. **Integration Testing**
   - End-to-end pipeline validation
   - Security boundary verification
   - Performance benchmarking

### Phase 2: Backend AI Gateway (Task BE-AI-02)

**Week 3-4: NestJS Integration Layer**
1. **Database Schema Design** (SQL First)
   - `migration_logs` table with UUIDv7 primary keys
   - `ai_audit_logs` for performance tracking
   - Data dictionary updates
2. **AI Module Architecture**
   - `AiService` with n8n webhook integration
   - `MigrationService` for business logic
   - Validation layer with confidence thresholds
3. **API Endpoints & Security**
   - Admin migration endpoints with CASL guards
   - Real-time extraction endpoint (`/api/ai/extract`)
   - Idempotency and rate limiting implementation
4. **Configuration Management**
   - Service account authentication
   - Environment variables for AI endpoints
   - Monitoring and logging setup

### Phase 3: Frontend Human-in-the-Loop (Task FE-AI-03)

**Week 5-6: User Experience & Validation**
1. **Reusable AI Components**
   - `AiSuggestionField` with confidence indicators
   - `DocumentComparisonView` with PDF sidebar
   - Client-side validation with Zod + React Hook Form
2. **Admin Migration Dashboard**
   - Paginated table with filtering/sorting
   - Bulk actions for high-confidence items
   - Error logging and retry mechanisms
3. **Real-time Ingestion Integration**
   - RFA creation flow enhancement
   - AI processing state indicators
   - Auto-fill with user override capability
4. **Human-AI Feedback Loop**
   - User correction tracking
   - Performance analytics dashboard
   - Accuracy metrics and reporting

### Phase 4: Testing & Deployment

**Week 7-8: Production Readiness**
1. **Comprehensive Testing**
   - Thai/English document validation
   - Confidence scoring accuracy verification
   - Load testing and performance optimization
2. **Security Audit**
   - ADR-018 boundary verification
   - Penetration testing of AI endpoints
   - Data privacy compliance check
3. **User Training & Documentation**
   - Admin workflow training
   - User guide for AI-assisted document creation
   - Troubleshooting and support procedures
4. **Production Deployment**
   - Blue-green deployment strategy
   - Monitoring and alerting setup
   - Rollback procedures and contingency plans

---

## Success Metrics

### Technical Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Thai OCR Accuracy** | >90% | Character-by-character comparison with ground truth |
| **AI JSON Validity** | 100% | Automated validation of all AI responses |
| **Processing Time** | <15s/document | End-to-end timing from upload to suggestion |
| **GPU Memory Usage** | <6GB per doc | Resource monitoring on Admin Desktop |
| **System Uptime** | >99% | Service availability monitoring |

### Business Impact Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Data Entry Time Reduction** | 70% | Time comparison manual vs AI-assisted workflows |
| **AI Accuracy Rate** | 85%+ | Human verification of AI extractions |
| **Migration Throughput** | 1000 docs/day | Batch processing capacity with admin review |
| **User Correction Rate** | <15% | Percentage of AI suggestions modified by users |
| **Admin Productivity** | 3x improvement | Documents processed per admin hour |

### User Experience Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **User Satisfaction** | 4.0/5.0 | Post-deployment user survey |
| **Task Completion Rate** | >95% | Successful document creation rate |
| **Learning Curve** | <30 min | Time to proficiency for new users |
| **Error Rate** | <2% | Failed AI extractions requiring manual intervention |

### Security & Compliance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Security Incidents** | 0 | Audit log monitoring and breach detection |
| **Data Privacy Compliance** | 100% | Adherence to ADR-018 and PDPA requirements |
| **Audit Trail Completeness** | 100% | All AI interactions logged and traceable |
| **API Response Times** | <200ms | DMS API performance under load |

---

## Risk Assessment & Mitigation

### 🔴 High-Risk Items

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|-------------------|
| **AI Accuracy on Thai Documents** | High | Medium | Custom prompt engineering + Extensive testing with Thai engineering docs |
| **Admin Desktop Hardware Failure** | High | Low | Backup desktop ready + Cloud AI fallback plan (emergency only) |
| **Data Privacy Violations** | Critical | Low | Strict ADR-018 enforcement + Regular security audits |
| **Performance Bottlenecks** | Medium | Medium | Queue system + GPU monitoring + Load balancing |

### 🟡 Medium-Risk Items

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|-------------------|
| **User Adoption Resistance** | Medium | Medium | Comprehensive training + UI/UX optimization + Early user involvement |
| **Thai OCR Quality Issues** | Medium | Medium | Multiple OCR engines + Manual correction workflow |
| **Integration Complexity** | Medium | Low | Phased deployment + Extensive testing + Rollback procedures |
| **Cost Overruns** | Medium | Low | On-premise AI eliminates per-use costs | Resource monitoring |

### 🟢 Low-Risk Items

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|-------------------|
| **Technology Stack Changes** | Low | Low | Containerized deployment + Version pinning |
| **Vendor Dependency** | Low | Low | Open-source stack + Multiple model options |
| **Regulatory Changes** | Medium | Low | Flexible architecture + Compliance monitoring |

---

## Related Documents & Tasks

### Architecture Decision Records
- **[ADR-017: Ollama Data Migration](./ADR-017-ollama-data-migration.md)** — Foundation migration architecture
- **[ADR-017B: Smart Categorization](./ADR-017B-ollama.md)** — AI categorization use cases
- **[ADR-018: AI Boundary Policy](./ADR-018-ai-boundary.md)** — Security isolation requirements (CRITICAL)
- **[ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)** — UUID usage patterns (CRITICAL)

### Implementation Tasks
- **[Task BE-AI-01: Pipeline Infrastructure Setup](../08-Tasks/Task%20BE-AI-01.md)** — n8n + PaddleOCR + Gemma 4 setup
- **[Task BE-AI-02: Backend AI Gateway Development](../08-Tasks/Task%20BE-AI-02.md)** — NestJS integration layer
- **[Task FE-AI-03: Frontend Human-in-the-Loop Interface](../08-Tasks/Task-FE-AI-03.md)** — User experience and validation

### Technical Specifications
- **[03-05-n8n-migration-setup-guide.md](../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md)** — n8n configuration details
- **[05-02-backend-guidelines.md](../05-Engineering-Guidelines/05-02-backend-guidelines.md)** — NestJS patterns and conventions
- **[05-03-frontend-guidelines.md](../05-Engineering-Guidelines/05-03-frontend-guidelines.md)** — Next.js patterns and UI standards
- **[03-01-data-dictionary.md](../03-Data-and-Storage/03-01-data-dictionary.md)** — Field definitions and business rules

### Compliance & Security
- **[ADR-016: Security & Authentication](./ADR-016-security-authentication.md)** — Overall security framework
- **[04-08-release-management-policy.md](../04-Infrastructure-OPS/04-08-release-management-policy.md)** — Deployment procedures

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.8.5 | 2026-04-03 | AI Integration Lead | Initial ADR — AI Intelligence Integration Architecture |
| 1.8.6 | 2026-04-03 | Tech Lead | Updated — Aligned with detailed task specifications and implementation requirements |

---

**Last Updated:** 2026-04-03
**Status:** Proposed
**Review Date:** 2026-04-10
**Implementation Target:** v1.9.0
