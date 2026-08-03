# ADR-022: Retrieval-Augmented Generation (RAG) System

**Status:** Superseded by [ADR-023: Unified AI Architecture](./ADR-023-unified-ai-architecture.md)
**Date:** 2026-04-19
**Decision Makers:** Development Team, System Architect
**Related Documents:**

- [RAG Implementation Guide v1.1.2](../08-Tasks/ADR-022-Retrieval-Augmented-Generation/LCBP3-RAG-Implementation-Guide-v1.1.2.md)
- [Implementation Plan](../08-Tasks/ADR-022-Retrieval-Augmented-Generation/plan.md)
- [Tasks](../08-Tasks/ADR-022-Retrieval-Augmented-Generation/tasks.md)
- [ADR-018: AI Boundary](./ADR-018-ai-boundary.md)
- [ADR-020: AI Intelligence Integration](./ADR-020-ai-intelligence-integration.md)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากเอกสาร:

- **ADR-020 AI Integration** — ระบุว่า DMS ต้องรองรับ Document Q&A แต่ไม่มี retrieval mechanism
  - เหตุผล: LLM อย่างเดียวไม่รู้ข้อมูลเอกสารของโครงการ — ต้องมี context injection จากเอกสารจริง
- **01-03-modules** — ผู้ใช้ต้องการค้นหาข้อมูลจากเอกสาร Correspondence/RFA/Drawing แบบ natural language
  - เหตุผล: Full-text search ให้แค่ keyword match — ไม่เข้าใจ semantic และภาษาไทย

### แก้ไขความขัดแย้ง:

- **ADR-018 AI Isolation** vs **RAG Cloud API**: Typhoon API ใช้ cloud LLM ซึ่งขัดกับ on-premises policy
  - การตัดสินใจ: CONFIDENTIAL documents → local Ollama เท่านั้น; PUBLIC/INTERNAL → Typhoon primary + Ollama failover

---

## Context and Problem Statement

LCBP3-DMS เก็บเอกสารโครงการก่อสร้างขนาดใหญ่ (Correspondence, RFA, Drawing, Contract) ทั้งหมดในภาษาไทยและอังกฤษ ผู้ใช้ต้องการค้นหาและถามคำถามจากเอกสารเหล่านี้แบบ conversational Q&A โดยได้คำตอบพร้อม citation ที่อ้างอิงได้

### Key Problems

1. **Semantic Gap:** Full-text search หา keyword ได้แต่ไม่เข้าใจความหมาย เช่น "ปัญหาเรื่องการส่งมอบ" ≠ "delay in delivery"
2. **Thai Language:** MariaDB FULLTEXT ไม่รองรับ tokenization ภาษาไทยอย่างถูกต้อง
3. **Hallucination Risk:** LLM ที่ไม่มี context จะตอบจาก training data — ไม่ใช่เอกสารโครงการจริง
4. **Security Isolation:** เอกสาร CONFIDENTIAL ห้ามส่งไป cloud AI ใดๆ (ADR-018)
5. **Multi-tenancy:** เอกสารของแต่ละโครงการต้องแยก query scope อย่างเด็ดขาด

---

## Decision Drivers

- **Accuracy:** คำตอบต้องมา from เอกสารจริง พร้อม citation ที่ตรวจสอบได้
- **Security (ADR-018):** CONFIDENTIAL → local Ollama only; ห้าม cloud API
- **Thai Language:** ต้องรองรับ PyThaiNLP tokenization ก่อน embed
- **Multi-tenancy:** Qdrant `project_public_id` payload filter — non-negotiable
- **Performance SLO:** Typhoon primary p95 < 3s; Ollama fallback p95 < 10s

---

## Considered Options

### Option 1: Full-text Search Only (MariaDB FULLTEXT)

**แนวทาง:** ใช้ MariaDB FULLTEXT ที่มีอยู่แล้ว + prompt LLM ด้วย raw search results

**ข้อดี:** ไม่ต้อง infra เพิ่ม, deploy ง่าย

**ข้อเสีย:** Thai tokenization แย่, ไม่มี semantic understanding, recall ต่ำ

---

### Option 2: Vector Search Only (Qdrant + Ollama)

**แนวทาง:** Embed ทุก chunk → เก็บใน Qdrant → query ด้วย vector similarity เท่านั้น

**ข้อดี:** Semantic search ดี, รองรับภาษาไทย

**ข้อเสีย:** Keyword exact match แย่กว่า FULLTEXT, miss เลขที่เอกสารที่พิมพ์ตรงๆ

---

### Option 3: Hybrid RAG — Vector + Keyword + Re-rank ✅ **SELECTED**

**แนวทาง:** Hybrid search (0.7 vector + 0.3 keyword) → score-based re-rank → context build → LLM generate

**ข้อดี:**
- ดีที่สุดทั้ง semantic และ exact match
- PyThaiNLP preprocessing ก่อน embed → Thai language accuracy สูง
- Qdrant tiered multitenancy → tenant isolation สมบูรณ์
- Typhoon primary + Ollama failover → availability สูง

**ข้อเสีย:** Complex infrastructure (Qdrant + Redis + BullMQ + PyThaiNLP microservice)

---

## Decision Outcome

**เลือก Option 3: Hybrid RAG**

### Core Architecture

| Component | Technology | Role |
|-----------|-----------|------|
| Vector Store | Qdrant v1.16+ | Tiered multitenancy (`project_public_id` is_tenant=true) |
| Embedding | nomic-embed-text (Ollama) | 768-dim Thai+English vectors |
| Thai NLP | PyThaiNLP microservice | Tokenize + normalize ก่อน embed |
| Queue | BullMQ (rag:ocr, rag:thai-preprocess, rag:embedding) | Async ingestion pipeline |
| LLM Primary | Typhoon API | PUBLIC + INTERNAL (p95 < 3s) |
| LLM Fallback | Ollama local | CONFIDENTIAL + Typhoon down (p95 < 10s) |
| Cache | Redis | Query cache key: SHA256(question+projectPublicId+classificationCeiling) |

### Key Decisions (Clarified 2026-04-19)

| # | Decision | Rationale |
|---|----------|-----------|
| Q1 | Tiered multitenancy (single collection + is_tenant=true) | Qdrant v1.16+ native; no collection-per-project overhead |
| Q2 | Auto-failover Typhoon→Ollama | Availability > consistency for non-CONFIDENTIAL |
| Q3 | PyThaiNLP preprocessing | Thai tokenization critical for embed quality |
| Q4 | rag_status in `attachments` table | Single source of truth per file (ADR-009) |
| Q5 | Split SLO: Typhoon < 3s / Ollama < 10s | Realistic targets per LLM path |

### Edge Cases Enforced (Red Team 2026-04-19)

| EC | Rule |
|----|------|
| EC-RAG-001 | BullMQ jobId = attachmentId (native dedup — ป้องกัน concurrent ingestion) |
| EC-RAG-002 | reIngest() cleanup: DELETE chunks → DELETE Qdrant → PENDING (ordered) |
| EC-RAG-003 | QdrantService.OnModuleInit: auto-create collection; collectionReady flag + 503 |
| EC-RAG-004 | maxClassification ห้ามรับจาก client — server-derived จาก user role เท่านั้น |
| EC-RAG-005 | Cache key = SHA256(question+projectPublicId+classificationCeiling); CONFIDENTIAL bypass cache |

---

## Consequences

### Positive

- ✅ Q&A ภาษาไทยจากเอกสารโครงการพร้อม citation ที่ตรวจสอบได้
- ✅ ADR-018 compliant — CONFIDENTIAL ไม่ออกนอก on-premises
- ✅ Multi-tenant isolation ระดับ Qdrant payload filter
- ✅ Auto-failover → high availability

### Negative / Trade-offs

- ⚠️ Infrastructure complexity เพิ่มขึ้น (Qdrant + PyThaiNLP microservice)
- ⚠️ Initial indexing ใช้เวลา — existing documents ต้อง batch re-index
- ⚠️ Ollama fallback p95 < 10s อาจ UX ไม่ดีสำหรับ CONFIDENTIAL users

### Risks

- Qdrant volume loss → vectors ต้อง re-index ทั้งหมด (mitigated: Qdrant snapshot backup §19.7)
- PyThaiNLP microservice down → ingestion queue stuck (mitigated: 3-retry DLQ + FAILED status)
