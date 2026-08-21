# Architecture Decision Records (ADRs)

**Version:** 1.9.13
**Last Updated:** 2026-08-03
**Project:** LCBP3-DMS (Laem Chabang Port Phase 3 - Document Management System)

---

## 📋 What are ADRs?

Architecture Decision Records (ADRs) เป็นเอกสารที่บันทึก **ประวัติการตัดสินใจทางสถาปัตยกรรมที่สำคัญ** ของโปรเจกต์ โดยระบุ:

- **Context**: เหตุผลที่ต้องตัดสินใจ
- **Gap Analysis**: ปิด Gap จาก Requirements และแก้ไขความขัดแย้ง
- **Impact Analysis**: ผลกระทบต่อ Components และการเปลี่ยนแปลงที่ต้องทำ
- **Options Considered**: ทางเลือกที่พิจารณา (พร้อม Pros/Cons)
- **Decision**: สิ่งที่เลือก และเหตุผล
- **Version Dependencies**: ความสัมพันธ์ระหว่าง ADRs
- **Consequences**: ผลที่ตามมา (ดีและไม่ดี)
- **Review Cycle**: การทบทวน ADRs เป็นระยะ

**วัตถุประสงค์:**

1. ทำให้ทีมเข้าใจ "ทำไม" นอกเหนือจาก "ทำอย่างไร"
2. ป้องกันการสงสัยว่า "ทำไมถึงออกแบบแบบนี้" ในอนาคต
3. ช่วยในการ Onboard สมาชิกใหม่
4. บันทึกประวัติศาสตร์การพัฒนาโปรเจกต์
5. เชื่อมโยงการตัดสินใจกับ Requirements และ Acceptance Criteria
6. วิเคราะห์ผลกระทบอย่างเป็นระบบ
7. จัดการ Version Dependencies ระหว่าง ADRs

---

## 📚 ADR Index

### Core Architecture Decisions

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-001](./ADR-001-unified-workflow-engine.md) | Unified Workflow Engine | ✅ Accepted | 2026-02-24 | ใช้ DSL-based Workflow Engine สำหรับ Correspondences, RFAs, และ Circulations |
| [ADR-002](./ADR-002-document-numbering-strategy.md) | Document Numbering Strategy | ✅ Accepted | 2026-02-24 | Double-lock mechanism (Redis + DB Optimistic Lock) สำหรับเลขที่เอกสาร |

### Security & Access Control

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-016](./ADR-016-security-authentication.md) | Security & Authentication Strategy | ✅ Accepted | 2026-02-24 | JWT + bcrypt + OWASP Security Best Practices |

### Technology & Infrastructure

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-004](./ADR-004-database-schema-design-strategy.md) | Database Schema Design Strategy | ✅ Accepted | 2026-04-04 | Selective Normalization + Standard Patterns (UUID, Soft Delete, Audit) |
| [ADR-005](./ADR-005-technology-stack.md) | Technology Stack Selection | ✅ Accepted | 2026-02-24 | Full Stack TypeScript: NestJS 11 + Next.js 16 + MariaDB + Redis |
| [ADR-006](./ADR-006-redis-caching-strategy.md) | Redis Usage & Caching Strategy | ✅ Accepted | 2026-02-24 | Redis สำหรับ Distributed Lock, Cache, Queue, และ Rate Limiting |
| [ADR-009](./ADR-009-database-migration-strategy.md) | Database Migration & Deployment | ✅ Accepted | 2026-02-24 | TypeORM Migrations พร้อม Blue-Green Deployment |
| [ADR-015](./ADR-015-deployment-infrastructure.md) | Deployment & Infrastructure Strategy | ✅ Accepted | 2026-02-24 | Docker Compose with Blue-Green Deployment on QNAP |

### API & Integration

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-003](./ADR-003-api-design-strategy.md) | API Design Strategy | ✅ Accepted | 2026-04-04 | Hybrid REST + Action Strategy สำหรับ Resource และ Workflow Operations |
| [ADR-007](./ADR-007-error-handling-strategy.md) | Error Handling & Recovery | ✅ Accepted | 2026-04-04 | Layered Error Classification พร้อม User-friendly Messages และ Recovery Actions |
| [ADR-008](./ADR-008-email-notification-strategy.md) | Email & Notification Strategy | ✅ Accepted | 2026-02-24 | BullMQ + Redis Queue สำหรับ Multi-channel Notifications (Email, LINE, In-app) |
| [ADR-031](./ADR-031-hermes-agent-telegram-devops-bridge.md) | Hermes Agent & Telegram DevOps Bridge | ✅ Accepted | 2026-05-28 | Hermes DevOps Telegram Bridge สำหรับอ่าน diagnostics และ staged rollout |

### Observability

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-010](./ADR-010-logging-monitoring-strategy.md) | Logging & Monitoring Strategy | ✅ Accepted | 2026-02-24 | Winston Structured Logging พร้อม Future ELK Stack Integration |

### Frontend Architecture

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-011](./ADR-011-nextjs-app-router.md) | Next.js App Router & Routing | ✅ Accepted | 2025-12-01 | App Router with Server Components and Nested Layouts |
| [ADR-012](./ADR-012-ui-component-library.md) | UI Component Library (Shadcn/UI) | ✅ Accepted | 2026-02-24 | Shadcn/UI + Tailwind CSS for Full Component Ownership |
| [ADR-013](./ADR-013-form-handling-validation.md) | Form Handling & Validation | ✅ Accepted | 2026-02-24 | React Hook Form + Zod for Type-Safe Forms |
| [ADR-014](./ADR-014-state-management.md) | State Management Strategy | ✅ Accepted | 2026-02-24 | Zustand for Client State + Server Components |

### Data & Identity

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-019](./ADR-019-hybrid-identifier-strategy.md) | Hybrid Identifier Strategy | ✅ Accepted | 2026-03-11 | INT PK (internal) + UUIDv7 (public API) on 14 tables |

### AI & Data Integration

> ⭐ **Single Source of Truth:** สถาปัตยกรรม AI ปัจจุบันรวมอยู่ใน [ADR-043](./ADR-043-ai-architecture-current-state.md) — อ่านที่นี่ก่อนเพื่อทราบ "สถาปัตยกรรม AI ปัจจุบันคืออะไร" (restatement ของ ADR ที่ active ทั้งหมด + ปิด drift ของ ADR-035 ↔ ADR-040)

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-043](./ADR-043-ai-architecture-current-state.md) | ⭐ AI Architecture — Current State (Single Source of Truth) | ✅ Accepted | 2026-08-03 | Consolidation ADR — restatement ของ ADR-023, 023A, 024–028, 030, 032–037, 040–042; ปิด drift ADR-035 ↔ ADR-040; archive กลุ่ม A (017, 017B, 018, 020, 022) |
| [ADR-017](./archive/ADR-017-ollama-data-migration.md) | Ollama Data Migration Architecture | ❌ Superseded (archived) | 2026-02-26 | ถูกแทนที่โดย ADR-023 → ADR-043; ย้ายไป `archive/` |
| [ADR-017B](./archive/ADR-017B-ai-document-classification.md) | AI Document Classification | ❌ Superseded (archived) | 2026-03-27 | ถูกแทนที่โดย ADR-023 → ADR-043; ย้ายไป `archive/` |
| [ADR-018](./archive/ADR-018-ai-boundary.md) | AI Boundary Policy | ❌ Superseded (archived) | 2026-03-27 | ถูกแทนที่โดย ADR-023 → ADR-043; ย้ายไป `archive/` |
| [ADR-020](./archive/ADR-020-ai-intelligence-integration.md) | AI Intelligence Integration Architecture | ❌ Superseded (archived) | 2026-04-03 | ถูกแทนที่โดย ADR-023 → ADR-043; ย้ายไป `archive/` |
| [ADR-022](./archive/ADR-022-retrieval-augmented-generation.md) | Retrieval-Augmented Generation (RAG) | ❌ Superseded (archived) | 2026-04-20 | ถูกแทนที่โดย ADR-023 → ADR-043; ย้ายไป `archive/` |
| [ADR-023](./ADR-023-unified-ai-architecture.md) | Unified AI Architecture | ✅ Accepted | 2026-05-14 | สถาปัตยกรรม AI หลักแบบรวมศูนย์ (Boundary, RAG, Workflows และ Isolation) |
| [ADR-023A](./ADR-023A-unified-ai-architecture.md) | AI Model Revision | ✅ Accepted | 2026-05-15 | 2-Model Stack (gemma4:e4b Q8_0 + nomic-embed-text), BullMQ 2-Queue, RAG embed scope, OCR auto-detect |
| [ADR-024](./ADR-024-intent-classification-strategy.md) | Intent Classification Strategy | ✅ Accepted | 2026-05-20 | Hybrid Pattern→LLM Fallback กับ ai_intent_patterns ใน DB และ caching 5 นาที |
| [ADR-025](./ADR-025-ai-tool-layer-architecture.md) | AI Tool Layer Architecture | ✅ Accepted | 2026-05-21 | Server-side tool dispatch พร้อม CASL permission validation สำหรับ AI assistant |
| [ADR-026](./ADR-026-document-chat-ui-pattern.md) | Document Chat UI Pattern | ✅ Accepted | 2026-05-22 | แผง Side-panel Chat UI และ useAiChat() custom hook พร้อม streaming output |
| [ADR-027](./ADR-027-ai-admin-console-and-dynamic-control.md) | AI Admin Console & Dynamic Control | ✅ Accepted | 2026-05-22 | ระบบควบคุม prompts, models และ intents ใน UI แบบ dynamic โดยไม่ต้อง redeploy |
| [ADR-028](./ADR-028-migration-architecture-refactor.md) | Migration Architecture Refactor | ✅ Accepted | 2026-05-23 | Staging Queue, go/no-go gates และ post-migration cleanup pipeline |
| [ADR-029](./ADR-029-dynamic-prompt-management.md) | Dynamic Prompt Management | ✅ Accepted | 2026-05-25 | การเก็บ prompt templates ใน DB (`ai_prompts`) และ Redis cache TTL 60s |
| [ADR-030](./ADR-030-context-aware-prompt-templates.md) | Context-Aware Prompt Templates | ✅ Accepted | 2026-05-26 | Dynamic prompts ที่ทำงานสัมพันธ์ตามประเภทเอกสาร สิทธิ์ และ workflow step |
| [ADR-032](./ADR-032-typhoon-ocr-integration.md) | Typhoon OCR Integration | ✅ Accepted | 2026-05-30 | Typhoon OCR-3B และ typhoon2.1-gemma3-4b บน Admin Desktop |
| [ADR-033](./ADR-033-active-model-and-ocr-management.md) | Active Model & OCR Runner Management | ⚠️ Accepted (§7 superseded by ADR-040) | 2026-06-02 | Synchronous Model Loading, GPU VRAM Auto-release; §7 (X-API-Key) superseded by ADR-040 D6 (network isolation) — Phase 2 removal complete |
| [ADR-034](./ADR-034-AI-model-change.md) | AI Model Change — Thai-Optimized Model Stack | ✅ Accepted | 2026-06-03 | เปลี่ยนเป็น np-dms-ai (typhoon2.5-qwen3-4b) + np-dms-ocr (Typhoon OCR) — Supersede ADR-023A Section 2.1 |
| [ADR-035](./ADR-035-ai-pipeline-flow-architecture.md) | AI Pipeline Flow Architecture | ⚠️ Accepted (amended by ADR-040) | 2026-06-05 | 4 Flows (Sandbox, Migration, Auto-fill, RAG); BGE-M3 แทนที่ nomic-embed-text; OCR Sidecar routing — OCR engine routing, `/normalize`, model identity amended by ADR-040 |
| [ADR-036](./ADR-036-unified-ocr-architecture.md) | Unified AI Model Architecture — Sandbox-Production Parity | 📋 Proposed (§5 amended by ADR-040) | 2026-06-13 | Sandbox-Production Parity สำหรับ np-dms-ai และ np-dms-ocr; Profile-Only Parameter Governance; §5 sidecar contract amended by ADR-040 |
| [ADR-037](./ADR-037-unified-prompt-management-ux-ui.md) | Unified Prompt Management UX/UI | ✅ Implemented | 2026-06-14 | Unified Prompt Management UX/UI — extends ADR-029 prompt_type scope |
| [ADR-040](./ADR-040-ocr-sidecar-refactor.md) | OCR Sidecar Refactor — Pure Compute Worker | ✅ Accepted (Phase 1 + Phase 2 implemented) | 2026-06-20 | Sidecar เป็น pure compute worker; ลบ `/normalize` endpoint; engine เดียว np-dms-ocr; path traversal hardening; amends ADR-035 + ADR-036 §5; supersedes ADR-033 §7; Phase 2 (X-API-Key removal) complete |
| [ADR-041](./ADR-041-server-consolidation.md) | Single-Host Server Consolidation | ⚠️ Implemented (D2/D6 amended by ADR-045) | 2026-06-20 | ย้าย services ทั้งหมดไปรวมบน np-dms-lcbp3; 4-layer Docker compose; QNAP = NAS/backup only (no Docker post-ADR-045); ASUSTOR = Primary NAS; T016 (X-API-Key removal) complete |
| [ADR-042](./ADR-042-sandbox-project-and-ocr-text-persistence.md) | Sandbox Project + OCR Text Persistence | 📋 Proposed | 2026-07-27 | Sandbox Project (DB-committing Full Pipeline Test) + OCR text persistence (แยก rag-prepare เป็น OCR-persist + embed-document) |
| [ADR-043](./ADR-043-ai-architecture-current-state.md) | ⭐ AI Architecture — Current State (Single Source of Truth) | ✅ Accepted | 2026-08-03 | Consolidation ADR — restatement ของ ADR ที่ active ทั้งหมด; ปิด drift ADR-035 ↔ ADR-040; archive กลุ่ม A (017, 017B, 018, 020, 022) |
| [ADR-044](./ADR-044-database-schema-strategy-amendment.md) | Database Schema Strategy Amendment — No TypeORM Migrations | ✅ Accepted | 2026-08-03 | Amends ADR-009 — formalize "no TypeORM migrations, edit schema SQL directly via delta files" as current decision; resolves internal contradiction in ADR-009 |
| [ADR-045](./ADR-045-edge-proxy-topology-amendment.md) | Edge Proxy Topology Amendment — Cloudflare Tunnel as Sole Edge | ✅ Accepted | 2026-08-03 | Amends ADR-041 D2/D6 — formalize Cloudflare Tunnel on np-dms-lcbp3 as sole edge proxy; QNAP no Docker (NAS/backup only); NPM demoted to internal router |
| [ADR-046](./ADR-046-tag-color-palette-key.md) | Tag Color Palette Key — `tags.color_code` เป็น Palette Key Enum | ✅ Accepted | 2026-08-18 | เปลี่ยน `tags.color_code` จาก free-form string เป็น 14 palette key enum; frontend = source of truth (`TAG_PALETTE`), backend mirror สำหรับ `@IsIn` validation; SQL delta normalize legacy values → `'default'`; related ADR-019/030/044 |
| [ADR-047](./ADR-047-native-backend-legacy-ingestion.md) | Native Backend Legacy Ingestion & OCR Persistence | 📋 Proposed | 2026-08-20 | ย้าย Legacy Ingestion จาก n8n สู่ NestJS Module (Streaming Excel + BullMQ ai-batch + OCR Persistence + Review Queue UI + CLI); amends ADR-028/042, supersedes 03-04 §3 |

---

## 🔍 ADR Categories

### 1. Business Logic & Workflows

- **ADR-001:** Unified Workflow Engine - ใช้ JSON DSL แทน Hard-coded routing tables

### 2. Data Integrity & Concurrency

- **ADR-002:** Document Numbering - Double-lock (Redis Redlock + DB Optimistic) เพื่อป้องกัน Race Condition
  - 📋 [Requirements](../99-archives/01-03.11-document-numbering.md)
  - 📘 [Implementation Guide](../05-Engineering-Guidelines/05-02-backend-guidelines.md)
  - 📗 [Operations Guide](../04-Infrastructure-OPS/04-04-deployment-guide.md)
- **ADR-009:** Database Migration - TypeORM Migrations พร้อม Blue-Green Deployment

### 3. Security & Access Control

- **ADR-016:** Security - JWT Authentication + OWASP Best Practices และ API Key header Protection สำหรับ sidecars

### 4. Infrastructure & Performance

- **ADR-004:** Database Schema Design - Selective Normalization + Standard Patterns
- **ADR-005:** Technology Stack - TypeScript ecosystem (NestJS 11, Next.js 16)
- **ADR-006:** Redis - Caching และ Distributed coordination
- **ADR-015:** Deployment - Docker Compose with Blue-Green Deployment

### 5. API & Integration

- **ADR-003:** API Design - Hybrid REST + Action Strategy สำหรับ Resource และ Workflow Operations
- **ADR-007:** Error Handling - Layered Classification (Validation / Business / System) พร้อม Recovery Actions
- **ADR-008:** Notification - BullMQ Queue สำหรับ Multi-channel notifications
- **ADR-031:** Hermes Agent - Telegram DevOps Bridge สำหรับอ่าน diagnostics และ devops commands

### 6. Observability & Monitoring

- **ADR-010:** Logging - Winston Structured Logging พร้อม Future ELK Stack

### 7. Frontend Architecture

- **ADR-011:** Next.js App Router - Server Components และ Nested Layouts
- **ADR-012:** UI Components - Shadcn/UI + Tailwind CSS
- **ADR-013:** Form Handling - React Hook Form + Zod Validation
- **ADR-014:** State Management - Zustand + Server Components

### 8. Data & Identity

- **ADR-019:** Hybrid Identifier Strategy - INT PK (internal) + UUIDv7 (public API) บน 14 tables

### 9. AI & Data Integration

- **ADR-043:** ⭐ AI Architecture — Current State (Single Source of Truth) — restatement ของ ADR ที่ active ทั้งหมด + ปิด drift ADR-035 ↔ ADR-040; อ่านที่นี่ก่อน
- **ADR-017, 017B, 018, 020, 022:** Archived (`archive/`) — ถูกแทนที่โดย ADR-023 → ADR-043
- **ADR-023:** Unified AI Architecture - สถาปัตยกรรม AI หลักของระบบ ครอบคลุม Boundary, Workflows, RAG และ Hardware Isolation
- **ADR-023A:** AI Model Revision - 2-Model Stack (gemma4:e4b Q8_0 + nomic-embed-text), BullMQ 2-Queue, OCR auto-detect
- **ADR-024 ถึง ADR-030:** Runtime dynamic system (Intent Classifier, Tool Layer, Chat UI, Dynamic prompts & contexts)
- **ADR-032 & ADR-033:** OCR integration, Synchronous Loading, GPU VRAM Auto-release; ADR-033 §7 (X-API-Key) superseded by ADR-040 D6
- **ADR-034 & ADR-035:** Thai-Optimized Model Stack (np-dms-ai + np-dms-ocr) + AI Pipeline Flow Architecture (4 Flows, BGE-M3) — ADR-035 OCR sidecar contract amended by ADR-040
- **ADR-036 & ADR-037:** Sandbox-Production Parity (§5 amended by ADR-040) + Unified Prompt Management UX/UI
- **ADR-040:** OCR Sidecar Refactor — Pure compute worker, ลบ `/normalize`, engine เดียว `np-dms-ocr`, path traversal hardening (amends ADR-035 + ADR-036 §5; supersedes ADR-033 §7; Phase 2 X-API-Key removal complete)
- **ADR-041:** Server Consolidation — ย้ายทุก services ไป np-dms-lcbp3 (single-host Docker); T016 (X-API-Key removal) complete
- **ADR-042:** Sandbox Project + OCR Text Persistence — DB-committing full pipeline test + แยก rag-prepare เป็น 2 jobs
- **ADR-047:** Native Backend Legacy Ingestion & OCR Persistence — ย้าย Ingestion จาก n8n สู่ NestJS Module (Streaming Excel, BullMQ ai-batch, Staging Queue, OCR Editor UI, RAG Sync)

> 📖 **AI Document Ingestion Flow walkthrough:** ดู [`02-Architecture/02-05-ai-document-ingestion-flow.md`](../02-architecture/02-05-ai-document-ingestion-flow.md) สำหรับ end-to-end flow (Production + Sandbox)

---

## How to Read ADRs

### ADR Structure

แต่ละ ADR มีโครงสร้างดังนี้ (Enhanced Template v1.2):

1. **Gap Analysis & Purpose**: เชื่อมโยงกับ Requirements และแก้ไขความขัดแย้ง
2. **Context**: ปัญหาหรือสถานการณ์ที่ต้องตัดสินใจ
3. **Decision Drivers**: ปัจจัยที่มีผลต่อการตัดสินใจ
4. **Considered Options**: ทางเลือกที่พิจารณา (พร้อม Pros/Cons)
5. **Decision Outcome**: สิ่งที่เลือก และเหตุผล
6. **🔍 Impact Analysis**: ผลกระทบต่อ Components และ Required Changes
7. **📋 Version Dependency Matrix**: ความสัมพันธ์ระหว่าง ADRs และ Version Compatibility
8. **Consequences**: ผลที่ตามมา (Positive/Negative/Mitigation)
9. **🔄 Review Cycle & Maintenance**: 定期的なレビュー
10. **Implementation Details**: รายละเอียดการ Implement (Code examples)
11. **Related ADRs**: ADR อื่นที่เกี่ยวข้อง

---

**Version:** 1.9.12 (Added ADR-036/037/040/041/042 + ADR-035 amendment note)
**Last Review:** 2026-07-30
**Next Review:** 2027-01-30
