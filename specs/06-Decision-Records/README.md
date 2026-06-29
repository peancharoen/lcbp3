# Architecture Decision Records (ADRs)

**Version:** 1.9.8
**Last Updated:** 2026-06-02
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

| ADR | Title | Status | Date | Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-017](./ADR-017-ollama-data-migration.md) | Ollama Data Migration Architecture | ❌ Superseded | 2026-02-26 | ถูกแทนที่โดย ADR-023: Unified AI Architecture |
| [ADR-017B](./ADR-017B-ai-document-classification.md) | AI Document Classification | ❌ Superseded | 2026-03-27 | ถูกแทนที่โดย ADR-023: Unified AI Architecture |
| [ADR-018](./ADR-018-ai-boundary.md) | AI Boundary Policy | ❌ Superseded | 2026-03-27 | ถูกแทนที่โดย ADR-023: Unified AI Architecture |
| [ADR-020](./ADR-020-ai-intelligence-integration.md) | AI Intelligence Integration Architecture | ❌ Superseded | 2026-04-03 | ถูกแทนที่โดย ADR-023: Unified AI Architecture |
| [ADR-022](./ADR-022-retrieval-augmented-generation.md) | Retrieval-Augmented Generation (RAG) | ❌ Superseded | 2026-04-20 | ถูกแทนที่โดย ADR-023: Unified AI Architecture |
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
| [ADR-033](./ADR-033-active-model-and-ocr-management.md) | Active Model & OCR Runner Management | ✅ Accepted | 2026-06-02 | Synchronous Model Loading, GPU VRAM Auto-release และ API Key sidecar protection |
| [ADR-034](./ADR-034-AI-model-change.md) | AI Model Change — Thai-Optimized Model Stack | ✅ Accepted | 2026-06-03 | เปลี่ยนเป็น np-dms-ai (Typhoon2.5) + np-dms-ocr (Typhoon OCR) — Supersede ADR-023A Section 2.1 |
| [ADR-035](./ADR-035-ai-pipeline-flow-architecture.md) | AI Pipeline Flow Architecture | ✅ Accepted | 2026-06-05 | 4 Flows (Sandbox, Migration, Auto-fill, RAG); BGE-M3 แทนที่ nomic-embed-text; OCR Sidecar routing |

---

## 🔍 ADR Categories

### 1. Business Logic & Workflows

- **ADR-001:** Unified Workflow Engine - ใช้ JSON DSL แทน Hard-coded routing tables

### 2. Data Integrity & Concurrency

- **ADR-002:** Document Numbering - Double-lock (Redis Redlock + DB Optimistic) เพื่อป้องกัน Race Condition
  - 📋 [Requirements](../01-Requirements/01-03.11-document-numbering.md)
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

- **ADR-023:** Unified AI Architecture - สถาปัตยกรรม AI หลักของระบบ ครอบคลุม Boundary, Workflows, RAG และ Hardware Isolation
- **ADR-023A:** AI Model Revision - 2-Model Stack (gemma4:e4b Q8_0 + nomic-embed-text), BullMQ 2-Queue, OCR auto-detect
- **ADR-024 ถึง ADR-030:** Runtime dynamic system (Intent Classifier, Tool Layer, Chat UI, Dynamic prompts & contexts)
- **ADR-032 & ADR-033:** OCR integration, Synchronous Loading, GPU VRAM Auto-release และ FastAPI API Key Protection

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

**Version:** 1.9.8 (Added ADR-033 Active Model & OCR Runner Management)
**Last Review:** 2026-06-02
**Next Review:** 2026-12-02
