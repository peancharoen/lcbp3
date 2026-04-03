# ADR-018: AI Boundary Policy (AI Isolation)

**Status:** Accepted
**Date:** 2026-03-27
**Version:** 1.8.2 (Aligned with ADR-020)
**Decision Makers:** Security Team, System Architect, AI Integration Lead
**Related Documents:**

- [ADR-020: AI Intelligence Integration Architecture](./ADR-020-ai-intelligence-integration.md) — Overall AI Architecture & RFA-First Strategy
- [ADR-017: Ollama Data Migration Architecture](./ADR-017-ollama-data-migration.md)
- [ADR-017B: Smart Legacy Document Digitization](./ADR-017B-ollama.md)
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)
- [n8n Migration Setup Guide](../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md)
- [RAG Architecture](../03-Data-and-Storage/03-07-OpenRAG.md)

> **หมายเหตุ:** ADR-018 เป็น Security Policy หลักที่ควบคุมการทำงานของ AI Components ทั้งหมดในระบบ LCBP3-DMS ทุก Use Case ที่ใช้ AI (Migration, RAG, Smart Categorization) ต้องปฏิบัติตาม Policy นี้ และเป็นส่วนหนึ่งของ ADR-020 (Unified AI Architecture).

---

## Context and Problem Statement

### ปัญหาที่ต้องการแก้ไข

การนำ AI (Ollama, OpenRAG, หรือ LLM อื่นๆ) เข้ามาใช้งานในระบบ DMS ที่มีเอกสารสำคัญและข้อมูล Confidential ของโครงการท่าเรือ Laem Chabang Phase 3 มีความเสี่ยงด้าน Security หลัก 4 ประการ:

1. **Data Exposure Risk:** หาก AI มีสิทธิ์เข้าถึง Database โดยตรง อาจมีการรั่วไหลของข้อมูลทางการค้า / การก่อสร้าง
2. **Unauthorized Data Modification:** AI อาจทำการแก้ไขข้อมูลโดยไม่มีการตรวจสอบจาก Human
3. **Privilege Escalation:** หาก AI ถูก compromise อาจใช้สิทธิ์ Database Access เพื่อโจมตีระบบอื่น
4. **Compliance Violation:** ไม่สอดคล้องกับมาตรฐาน ISO 27001 และ PDPA สำหรับข้อมูลส่วนบุคคล

### ข้อจำกัดด้าน Infrastructure

- **QNAP NAS:** เป็น Production Server ที่ไม่ควรรัน AI Workload (Resource contention + Security boundary)
- **Admin Desktop (Desk-5439):** เครื่องสำหรับ Admin มี GPU (RTX 2060 Super 8GB) เหมาะสำหรับ AI Inference
- **Network Segmentation:** ต้องแยก Zone ระหว่าง AI Processing (Untrusted) กับ Database (Trusted)

---

## Decision Drivers

- **Zero Trust Architecture:** AI ถือเป็น Untrusted Component เสมอ ไม่ว่าเป็น On-Premise หรือไม่
- **Defense in Depth:** หลายชั้นของการควบคุม (Physical → Network → API → Data)
- **Auditability:** ทุกการสื่อสารกับ AI ต้อง Log ได้
- **Human-in-the-Loop:** ข้อมูลจาก AI ต้องผ่าน Human Validation ก่อน Commit ลง Database
- **Minimal Privilege:** AI ได้รับสิทธิ์น้อยที่สุด (Principle of Least Privilege)

---

## Considered Options

### Option 1: AI รันบน QNAP NAS (Same Host กับ Database)

**Pros:**

- ✅ ติดตั้งง่าย ไม่ต้องดูแลหลายเครื่อง
- ✅ Network Latency ต่ำ (localhost)

**Cons:**

- ❌ **Security Risk สูง:** AI มี Direct Access ถึง Database หากถูก compromise
- ❌ **Resource Contention:** AI Inference กิน RAM/CPU สูง กระทบ Production Services
- ❌ **No Isolation:** ไม่มี Security Boundary ระหว่าง AI กับ Core Application

### Option 2: AI บน Cloud AI Provider (OpenAI, Google, Azure)

**Pros:**

- ✅ AI ฉลาดสูง แม่นยำมาก
- ✅ ไม่ต้องดูแล Hardware

**Cons:**

- ❌ **ผิดนโยบาย Data Privacy:** เอกสารก่อสร้างท่าเรือเป็นความลับ ห้ามส่งข้อมูลขึ้น Cloud
- ❌ **Cost สูง:** Pay-per-use ไม่เหมาะกับงานประมวลผลจำนวนมาก
- ❌ **No Control:** ไม่สามารถควบคุม Data Retention หรือ Audit ได้

### Option 3: Physical Isolation + API-only Communication ⭐ (Selected)

**Pros:**

- ✅ **Security Boundary ชัดเจน:** AI รันบน Desktop แยกต่างหาก ไม่เข้าถึง DB โดยตรง
- ✅ **Zero Trust:** AI ถือเป็น Untrusted Component สื่อสารผ่าน API เท่านั้น
- ✅ **Audit Trail:** ทุก Request/Response ผ่าน Backend ซึ่งมี Audit Log ครบถ้วน
- ✅ **Human-in-the-Loop:** Backend ตรวจสอบข้อมูลก่อน Write ลง Database
- ✅ **Resource Isolation:** AI Workload ไม่กระทบ Production Services บน QNAP
- ✅ **Compliance:** สอดคล้องกับ ISO 27001 และ PDPA

**Cons:**

- ❌ ต้องดูแลเครื่อง Desktop เพิ่ม (GPU Temperature, Uptime)
- ❌ Network Latency เพิ่มขึ้นเล็กน้อย (LAN traffic)
- ❌ ต้องออกแบบ API Contract ให้รัดกุม

---

## Decision Outcome

**Chosen Option:** Option 3 — Physical Isolation + API-only Communication

**Rationale:**

การแยก AI ไปรันบน Admin Desktop (Desk-5439) และบังคับให้สื่อสารผ่าน DMS Backend API เท่านั้น เป็นแนวทางที่ Balance ระหว่าง Security, Privacy, และ Operational Feasibility ดีที่สุด ทำให้ AI ถูกมองว่าเป็น **Untrusted External Component** เสมอ แม้จะรันในเครือข่ายเดียวกัน

---

## AI Isolation Architecture

### Infrastructure Layout

| Component | Host | Zone | Network Access | Database Access |
|-----------|------|------|----------------|-----------------|
| **Ollama / OpenRAG** | Admin Desktop (Desk-5439) | Untrusted (AI Zone) | LAN only (QNAP NAS mount) | ❌ **ไม่มี** |
| **DMS Backend** | QNAP NAS (Docker) | Trusted (App Zone) | LAN + Frontend | ✅ Full Access |
| **MariaDB** | QNAP NAS | Trusted (DB Zone) | Localhost only | — |
| **n8n** | QNAP NAS (Docker) | Trusted (Orchestrator) | LAN + DB | ✅ Via API only |

### Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Untrusted Zone (AI Zone)                                        │
│  Admin Desktop (Desk-5439) — RTX 2060 Super 8GB                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Ollama (LLM)   │    │  OpenRAG        │                     │
│  │  Port: 11434    │    │  (Docling)      │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
└───────────┼─────────────────────┼───────────────────────────────┘
            │                     │
            │ HTTP API            │ Write JSON
            │                     │
┌───────────┼─────────────────────┼───────────────────────────────┐
│           ▼                     ▼                               │
│  Trusted Zone (App Zone)                                       │
│  QNAP NAS (Docker)                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │  DMS Backend    │◀───│  n8n            │    │  MariaDB   │  │
│  │  (NestJS)       │    │  (Poll JSON)    │    │  (Auth DB) │  │
│  │  Port: 3001     │    └─────────────────┘    └────────────┘  │
│  └────────┬────────┘                                            │
│           │                                                    │
│           │ Validation + Audit Log                             │
│           ▼                                                    │
│  ┌─────────────────┐                                            │
│  │  Database       │                                            │
│  │  (MariaDB)      │                                            │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

> ⚠️ **ข้อห้าม:** Ollama/OpenRAG **ห้าม** อยู่บน QNAP NAS และ **ห้าม** มี Database Connection String

---

## Security Rules (Non-Negotiable)

### Rule 1: Physical Isolation

| ข้อกำหนด | รายละเอียด |
|----------|------------|
| **AI Host** | Admin Desktop (Desk-5439) เท่านั้น |
| **Forbidden Hosts** | QNAP NAS, Production Servers, Cloud VM |
| **Hardware** | i7-9700K / 32GB RAM / RTX 2060 Super 8GB |
| **Network** | LAN (192.168.x.x) — No Public IP |

### Rule 2: No Direct Database Access

```typescript
// ❌ FORBIDDEN — AI ห้ามเชื่อมต่อ Database โดยตรง
const connection = await mysql.createConnection({
  host: '192.168.1.100',
  user: 'ai_service',  // NEVER!
  password: '***',
  database: 'lcbp3_dms'
});

// ✅ CORRECT — AI สื่อสารผ่าน DMS Backend API เท่านั้น
const response = await fetch('http://192.168.1.100:3001/api/ai/analyze', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + ai_token },
  body: JSON.stringify({ text: extractedText })
});
```

### Rule 3: No Direct Storage Access

```bash
# ❌ FORBIDDEN — AI ห้ามเข้าถึง File System โดยตรง
mv /data/dms/uploads/TCC-COR-0001.pdf /final/path/
cp /staging_ai/*.pdf /processed/

# ✅ CORRECT — ใช้ StorageService ผ่าน API เท่านั้น
POST /api/storage/upload
POST /api/migration/commit_batch
```

### Rule 4: Validation Layer

```typescript
// Backend ตรวจสอบ AI Output ทุกครั้งก่อน Write
@Injectable()
export class AiValidationService {
  validateAiOutput(output: AiOutputDto): ValidationResult {
    // 1. Schema Validation (Zod/class-validator)
    const schemaCheck = this.validateSchema(output);

    // 2. Confidence Threshold (≥ 0.85 auto-approve, 0.60–0.84 review, < 0.60 reject)
    const confidenceCheck = this.checkConfidence(output.confidence);

    // 3. Enum Enforcement (Category must be from System Enum)
    const enumCheck = this.validateCategoryEnum(output.suggested_category);

    // 4. Audit Log Recording
    this.auditLog.record({
      action: 'AI_VALIDATION',
      source: 'AI_SERVICE',
      confidence: output.confidence,
      result: schemaCheck && confidenceCheck && enumCheck
    });

    return { isValid: schemaCheck && confidenceCheck && enumCheck };
  }
}
```

### Rule 5: Audit Logging

| Event | Log Level | Fields |
|-------|-----------|--------|
| AI Request | INFO | `timestamp`, `source_ip`, `model`, `prompt_hash` |
| AI Response | INFO | `timestamp`, `confidence`, `processing_time`, `response_hash` |
| Validation Pass | INFO | `record_id`, `confidence`, `validator` |
| Validation Fail | WARN | `record_id`, `reason`, `raw_response` |
| Unauthorized Access | ERROR | `source_ip`, `attempted_action`, `blocked_by` |

---

## AI Communication Contract

### API Endpoint Design

```typescript
// AI เรียก Backend (ผ่าน n8n หรือตรง)
POST /api/ai/analyze-document
Headers:
  - Authorization: Bearer {ai_service_token}
  - Idempotency-Key: {document_hash}
  - X-AI-Source: ollama | openrag
Body:
  {
    "extracted_text": "ข้อความจาก OCR...",
    "document_type_hint": "pdf",
    "source_file": "TCC-COR-2024-001.pdf"
  }

Response:
  {
    "is_valid": true,
    "confidence": 0.92,
    "suggested_category": "Correspondence",
    "extracted_metadata": { ... },
    "audit_log_id": "0195..."
  }
```

### Authentication for AI Services

| Service | Auth Method | Token Lifetime | Scope |
|---------|-------------|----------------|-------|
| **Ollama** | mTLS / IP Whitelist | Session-based | `ai:invoke` |
| **n8n → Backend** | JWT (Service Account) | 1 hour | `migration:write`, `ai:read` |
| **OpenRAG** | File-based (Shared NAS) | N/A | Write to `rag-output/` only |

---

## Data Flow Compliance

### Flow 1: Migration (ADR-017)

```
[Scanned PDF] → [OCR on Desktop] → [Ollama AI] → [JSON Output]
     │
     ▼
[DMS Backend API] → [Validation Layer] → [Audit Log]
     │
     ▼
[Staging Table: migration_review_queue]
     │
     ▼
[Human Review] → [Commit via Frontend] → [Permanent DB + Storage]
```

### Flow 2: RAG (OpenRAG)

```
[PDF Folder] → [OpenRAG on Desktop] → [JSON to rag-output/]
     │
     ▼
[n8n Poll JSON] → [DMS Backend API] → [Validation + Audit]
     │
     ▼
[Elasticsearch Index + MariaDB Metadata]
```

### Flow 3: Smart Categorization (ADR-017B)

```
[User Upload PDF] → [Temporary Storage]
     │
     ▼
[Queue Job] → [Ollama AI via API]
     │
     ▼
[Validation Layer] → [Suggestion to User]
     │
     ▼
[User Confirm] → [Final Category Assignment]
```

---

## Compliance Matrix

| Requirement | Implementation | Evidence |
|-------------|----------------|----------|
| **ISO 27001 A.9.4.1** | JWT + mTLS for AI Auth | Token logs in `audit_logs` |
| **ISO 27001 A.12.3.1** | IP Whitelist for AI Host | `192.168.x.x` only |
| **PDPA Data Minimization** | AI ไม่เก็บข้อมูลระยะยาว | Temporary processing only |
| **PDPA Security** | Physical Isolation + Encryption | TLS 1.3 for all API calls |
| **OWASP BOLA** | UUID for all identifiers | ADR-019 Compliance |
| **Zero Trust** | API-only communication | No direct DB/Storage access |

---

## Consequences

### Positive Consequences

1. ✅ **Security Hardened:** AI treated as untrusted component — all outputs validated
2. ✅ **Audit Trail Complete:** Every AI interaction logged with hash + timestamp
3. ✅ **Compliance Ready:** ISO 27001 + PDPA requirements met
4. ✅ **Operational Safety:** AI failures don't compromise Production Database
5. ✅ **Scalability:** Can add more AI services without security redesign

### Negative Consequences

1. ❌ **Complexity:** Need to maintain separate AI host + API contracts
2. ❌ **Latency:** Network round-trip between AI and Backend (LAN only, acceptable)
3. ❌ **Monitoring Overhead:** Need to monitor both QNAP and Desktop systems
4. ❌ **Token Management:** Service accounts for AI need rotation policy

### Mitigation Strategies

- **Health Check:** Ollama `/api/tags` + Backend `/health` monitoring every 60 seconds
- **Auto-Failover:** Switch to fallback model (mistral:7b) if primary model fails
- **Token Rotation:** Service account JWT rotated every 7 days
- **Network Redundancy:** อุปกรณ์สำรองสำหรับ Admin Desktop (เตรียมสำรอง)

---

## Security Checklist (Pre-Deployment)

### 🔴 Critical (Must Pass)

| Check | Command/Method | Expected Result |
|-------|---------------|-----------------|
| AI Host Isolation | `ping 192.168.1.100` from AI Host | Success (LAN only) |
| No DB Access from AI | `mysql -h qnap_ip -u root` from Desktop | **Connection Refused** |
| API Auth Required | `curl http://qnap:3001/api/ai/analyze` | 401 Unauthorized |
| Valid Token Works | `curl -H "Authorization: Bearer {valid}" ...` | 200 OK |
| Audit Log Written | `SELECT * FROM audit_logs WHERE source='AI_SERVICE'` | Records found |

### 🟡 Important (Should Pass)

| Check | Method | Expected Result |
|-------|--------|-----------------|
| TLS Enabled | `curl -v https://...` | TLS 1.3 handshake |
| IP Whitelist Active | Try from unauthorized IP | Blocked by Firewall |
| Token Expiration | Use expired JWT | 401 Token Expired |
| Idempotency Key | Replay same request | 200 OK (no duplicate write) |

---

## Related Documents

- [ADR-017: Ollama Data Migration Architecture](./ADR-017-ollama-data-migration.md) — Migration implementation following ADR-018
- [ADR-017B: Smart Legacy Document Digitization](./ADR-017B-ollama.md) — Smart categorization use case
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md) — General security strategy
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md) — UUID strategy for API security
- [03-07-OpenRAG.md](../03-Data-and-Storage/03-07-OpenRAG.md) — RAG architecture under ADR-018
- [03-05-n8n-migration-setup-guide.md](../03-Data-and-Storage/03-05-n8n-migration-setup-guide.md) — n8n setup with AI isolation

---

## Document History

| Version | Date       | Author       | Changes                                                  |
| ------- | ---------- | ------------ | -------------------------------------------------------- |
| 1.8.1   | 2026-03-27 | Security Lead| Initial ADR — AI Boundary Policy (Physical Isolation)    |
| 1.8.2   | 2026-04-03 | Tech Lead    | Updated — Aligned AI Model spec with ADR-017/017B        |

---

**Last Updated:** 2026-04-03
**Status:** Accepted
**Next Review:** 2026-06-01 (Quarterly security review)
