# Architecture Decision Records (ADRs)

**Version:** 1.8.5
**Last Updated:** 2026-04-10
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
5. **ใหม่!** เชื่อมโยงการตัดสินใจกับ Requirements และ Acceptance Criteria
6. **ใหม่!** วิเคราะห์ผลกระทบอย่างเป็นระบบ
7. **ใหม่!** จัดการ Version Dependencies ระหว่าง ADRs

---

## 📚 ADR Index

### Core Architecture Decisions

| ADR                                                 | Title                       | Status      | Date       | Summary                                                                      |
| --------------------------------------------------- | --------------------------- | ----------- | ---------- | ---------------------------------------------------------------------------- |
| [ADR-001](./ADR-001-unified-workflow-engine.md)     | Unified Workflow Engine     | ✅ Accepted | 2026-02-24 | ใช้ DSL-based Workflow Engine สำหรับ Correspondences, RFAs, และ Circulations |
| [ADR-002](./ADR-002-document-numbering-strategy.md) | Document Numbering Strategy | ✅ Accepted | 2026-02-24 | Double-lock mechanism (Redis + DB Optimistic Lock) สำหรับเลขที่เอกสาร        |

### Security & Access Control

| ADR                                             | Title                              | Status      | Date       | Summary                                      |
| ----------------------------------------------- | ---------------------------------- | ----------- | ---------- | -------------------------------------------- |
| [ADR-016](./ADR-016-security-authentication.md) | Security & Authentication Strategy | ✅ Accepted | 2026-02-24 | JWT + bcrypt + OWASP Security Best Practices |

### Technology & Infrastructure

| ADR                                                 | Title                                | Status                | Date       | Summary                                                         |
| --------------------------------------------------- | ------------------------------------ | --------------------- | ---------- | --------------------------------------------------------------- |
| [ADR-004](./ADR-004-database-schema-design-strategy.md) | Database Schema Design Strategy  | ✅ Accepted           | 2026-04-04 | Selective Normalization + Standard Patterns (UUID, Soft Delete, Audit) |
| [ADR-005](./ADR-005-technology-stack.md)            | Technology Stack Selection           | ✅ Accepted           | 2026-02-24 | Full Stack TypeScript: NestJS 11 + Next.js 16 + MariaDB + Redis |
| [ADR-006](./ADR-006-redis-caching-strategy.md)      | Redis Usage & Caching Strategy       | ✅ Accepted           | 2026-02-24 | Redis สำหรับ Distributed Lock, Cache, Queue, และ Rate Limiting  |
| [ADR-009](./ADR-009-database-migration-strategy.md) | Database Migration & Deployment      | ✅ Accepted (Pending) | 2026-02-24 | TypeORM Migrations พร้อม Blue-Green Deployment                  |
| [ADR-015](./ADR-015-deployment-infrastructure.md)   | Deployment & Infrastructure Strategy | ✅ Accepted           | 2026-02-24 | Docker Compose with Blue-Green Deployment on QNAP               |

### API & Integration

| ADR                                                 | Title                         | Status                       | Date       | Summary                                                                       |
| --------------------------------------------------- | ----------------------------- | ---------------------------- | ---------- | ----------------------------------------------------------------------------- |
| [ADR-003](./ADR-003-api-design-strategy.md)         | API Design Strategy           | ✅ Accepted                  | 2026-04-04 | Hybrid REST + Action Strategy สำหรับ Resource และ Workflow Operations         |
| [ADR-007](./ADR-007-error-handling-strategy.md)     | Error Handling & Recovery     | ✅ Accepted                  | 2026-04-04 | Layered Error Classification พร้อม User-friendly Messages และ Recovery Actions |
| [ADR-008](./ADR-008-email-notification-strategy.md) | Email & Notification Strategy | ✅ Accepted (Pending Review) | 2026-02-24 | BullMQ + Redis Queue สำหรับ Multi-channel Notifications (Email, LINE, In-app) |

### Observability

| ADR                                                 | Title                         | Status                | Date       | Summary                                                       |
| --------------------------------------------------- | ----------------------------- | --------------------- | ---------- | ------------------------------------------------------------- |
| [ADR-010](./ADR-010-logging-monitoring-strategy.md) | Logging & Monitoring Strategy | ✅ Accepted (Pending) | 2026-02-24 | Winston Structured Logging พร้อม Future ELK Stack Integration |

### Frontend Architecture

| ADR                                              | Title                            | Status      | Date       | Summary                                               |
| ------------------------------------------------ | -------------------------------- | ----------- | ---------- | ----------------------------------------------------- |
| [ADR-011](./ADR-011-nextjs-app-router.md)        | Next.js App Router & Routing     | ✅ Accepted | 2025-12-01 | App Router with Server Components and Nested Layouts  |
| [ADR-012](./ADR-012-ui-component-library.md)     | UI Component Library (Shadcn/UI) | ✅ Accepted | 2026-02-24 | Shadcn/UI + Tailwind CSS for Full Component Ownership |
| [ADR-013](./ADR-013-form-handling-validation.md) | Form Handling & Validation       | ✅ Accepted | 2026-02-24 | React Hook Form + Zod for Type-Safe Forms             |
| [ADR-014](./ADR-014-state-management.md)         | State Management Strategy        | ✅ Accepted | 2026-02-24 | Zustand for Client State + Server Components          |

### Data & Identity

| ADR                                                | Title                      | Status      | Date       | Summary                                              |
| -------------------------------------------------- | -------------------------- | ----------- | ---------- | ---------------------------------------------------- |
| [ADR-019](./ADR-019-hybrid-identifier-strategy.md) | Hybrid Identifier Strategy | ✅ Accepted | 2026-03-11 | INT PK (internal) + UUIDv7 (public API) on 14 tables |

### AI & Data Integration

| ADR                                             | Title                              | Status        | Date       | Summary                                                                      |
| ----------------------------------------------- | ---------------------------------- | ------------- | ---------- | ---------------------------------------------------------------------------- |
| [ADR-017](./ADR-017-ollama-data-migration.md)  | Ollama Data Migration Architecture | ✅ Accepted   | 2026-02-26 | On-premise AI (Ollama) สำหรับ Migration 20,000+ PDFs พร้อม Validation Layer |
| [ADR-017B](./ADR-017B-ai-document-classification.md) | AI Document Classification | ✅ Accepted | 2026-03-27 | AI-powered document classification ตาม ADR-018 (AI Isolation) |
| [ADR-018](./ADR-018-ai-boundary.md)            | AI Boundary Policy                 | ✅ Accepted   | 2026-03-27 | Physical Isolation + API-only communication (Zero Trust for AI)              |
| [ADR-020](./ADR-020-ai-intelligence-integration.md) | AI Intelligence Integration Architecture | 🔄 Proposed | 2026-04-03 | Unified AI Pipeline สำหรับ RFA-First (Legacy Migration + New Ingestion)    |

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

- **ADR-016:** Security - JWT Authentication + OWASP Best Practices

### 4. Infrastructure & Performance

- **ADR-004:** Database Schema Design - Selective Normalization + Standard Patterns
- **ADR-005:** Technology Stack - TypeScript ecosystem (NestJS 11, Next.js 16)
- **ADR-006:** Redis - Caching และ Distributed coordination
- **ADR-015:** Deployment - Docker Compose with Blue-Green Deployment

### 5. API & Integration

- **ADR-003:** API Design - Hybrid REST + Action Strategy สำหรับ Resource และ Workflow Operations
- **ADR-007:** Error Handling - Layered Classification (Validation / Business / System) พร้อม Recovery Actions
- **ADR-008:** Notification - BullMQ Queue สำหรับ Multi-channel notifications

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

- **ADR-017:** Ollama Data Migration - On-premise AI (Ollama) สำหรับ Migration 20,000+ PDFs
- **ADR-017B:** Smart Document Digitization - AI-powered categorization สำหรับเอกสารเก่า
- **ADR-018:** AI Boundary Policy - Physical Isolation + API-only communication (Zero Trust)
- **ADR-020:** AI Intelligence Integration - Unified AI Pipeline สำหรับ RFA-First approach

---

## 📖 How to Read ADRs

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
9. **🔄 Review Cycle & Maintenance**: กำหนดการทบทวนและ Version History
10. **Implementation Details**: รายละเอียดการ Implement (Code examples)
11. **Related ADRs**: ADR อื่นที่เกี่ยวข้อง

### Reading Tips

- เริ่มจาก **Context** เพื่อเข้าใจปัญหา
- ดู **Considered Options** เพื่อเข้าใจ Trade-offs
- อ่าน **Consequences** เพื่อรู้ว่าต้อง Maintain อย่างไร
- ดู **Related ADRs** เพื่อเข้าใจภาพรวม

---

## 🆕 Enhanced Template & Review Process (v1.8.2)

### New Features

#### 🎯 Gap Analysis & Purpose
- **ปิด Gap จากเอกสาร**: ระบุว่า ADR นี้แก้ไข Requirement ใด
- **แก้ไขความขัดแย้ง**: ระบุว่า ADR นี้แก้ไขความขัดแย้งระหว่าง Requirements ใด

#### 🔍 Impact Analysis
- **Affected Components**: ระดับผลกระทบ (🔴 High, 🟡 Medium, 🟢 Low)
- **Required Changes**: แบ่งเป็น Critical/Important/Nice-to-Have
- **Cross-Module Dependencies**: Mermaid diagram แสดงความสัมพันธ์

#### 📋 Version Dependency Matrix
- **Dependency Types**: Core, Required, Used By, Conflicts, Supersedes
- **Version Compatibility**: ระบุ version ที่ ADR มีผลบังคับใช้
- **Implementation Status**: ✅ Implemented, 🔄 In Progress, ⚠️ Must Resolve

#### 🔄 Review Cycle & Maintenance
- **Review Schedule**: ทบทวนทุก 6 เดือนสำหรับ Core ADRs
- **Review Checklist**: ตรวจสอบความเป็นปัจจุบัน
- **Version History**: Tracking การเปลี่ยนแปลงของ ADR

### Review Process

- **Initial Review**: 7 วันทำการสำหรับ ADR ใหม่
- **Scheduled Review**: ทุก 6 เดือนสำหรับ Core ADRs
- **Triggered Review**: เมื่อมี Major version upgrade หรือ Critical issue

📖 **ดูรายละเอียด**: [ADR Review Process](./ADR-REVIEW-PROCESS.md)

---

## 🆕 Creating New ADRs

### When to Create an ADR?

สร้าง ADR เมื่อ:

- ✅ เลือก Technology/Framework หลัก
- ✅ ออกแบบ Architecture Pattern สำคัญ
- ✅ แก้ปัญหาซับซ้อนที่มีหลาย Alternatives
- ✅ Trade-offs ที่มีผลกระทบระยะยาว
- ✅ ตัดสินใจที่ยากจะ Revert (Irreversible decisions)

**ไม่ต้องสร้าง ADR สำหรับ:**

- ❌ การเลือก Library เล็กๆ ที่เปลี่ยนได้ง่าย
- ❌ Implementation details ที่ไม่กระทบ Architecture
- ❌ Coding style หรือ Naming conventions

### ADR Template

ใช้ **Enhanced ADR Template v1.2** สำหรับ ADR ใหม่ทั้งหมด:

📋 **Template**: [ADR-TEMPLATE-enhanced.md](./ADR-TEMPLATE-enhanced.md)

**Key Sections (ต้องรวมทุกอย่าง):**
- ✅ Gap Analysis & Purpose
- ✅ Impact Analysis (Components + Required Changes + Dependencies)
- ✅ Version Dependency Matrix
- ✅ Review Cycle & Maintenance
- ✅ Cross-Module Dependencies (Mermaid diagram)

**Quick Start:**
```bash
# Copy template
cp ADR-TEMPLATE-enhanced.md ADR-XXX-title.md
# Edit with your specific content
```

---

## 🔄 ADR Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Proposed: Create new ADR
    Proposed --> Accepted: Team agrees
    Proposed --> Rejected: Team disagrees
    Accepted --> Deprecated: No longer relevant
    Accepted --> Superseded: Replaced by new ADR
    Deprecated --> [*]
    Superseded --> [*]
    Rejected --> [*]
```

### Status Definitions

- **Proposed**: รอการ Review และ Approve
- **Accepted**: ผ่านการ Review แล้ว กำลังใช้งาน
- **Deprecated**: เลิกใช้แล้ว แต่ยังอยู่ในระบบ
- **Superseded**: ถูกแทนที่โดย ADR อื่น
- **Rejected**: ไม่ผ่านการ Approve

---

## 📊 ADR Impact Map

```mermaid
graph TB
    ADR001[ADR-001<br/>Unified Workflow] --> Corr[Correspondences]
    ADR001 --> RFA[RFAs]
    ADR001 --> Circ[Circulations]

    ADR002[ADR-002<br/>Document Numbering] --> Corr
    ADR002 --> RFA

    ADR016[ADR-016<br/>Security & Auth] --> Auth[Authentication]
    ADR016 --> Guards[Guards]

    ADR005[ADR-005<br/>Tech Stack] --> Backend[Backend]
    ADR005 --> Frontend[Frontend]
    ADR005 --> DB[(Database)]

    ADR006[ADR-006<br/>Redis] --> Cache[Caching]
    ADR006 --> Lock[Locking]
    ADR006 --> Queue[Job Queue]
    ADR006 --> ADR002
    ADR006 --> ADR016
```

---

## 🔗 Related Documentation

- [System Architecture](../02-architecture/02-01-system-architecture.md) - สถาปัตยกรรมระบบโดยรวม
- [Data Model](../02-architecture/02-03-data-model.md) - โครงสร้างฐานข้อมูล
- [API Design](../02-architecture/02-02-api-design.md) - การออกแบบ API
- [Backend Guidelines](../03-implementation/03-02-backend-guidelines.md) - มาตรฐานการพัฒนา Backend
- [Frontend Guidelines](../03-implementation/03-03-frontend-guidelines.md) - มาตรฐานการพัฒนา Frontend

---

## 📝 Review Process

### Before Merging

1. สร้าง ADR ใน `specs/05-decisions/ADR-XXX-title.md`
2. Update ADR Index ใน `README.md` นี้
3. Link ADR ไปยัง Related Documents
4. Request Review จากทีม
5. อภิปรายและปรับแก้ตาม Feedback
6. Update Status เป็น "Accepted"
7. Merge to main branch

### Review Checklist

- ☐ Context ชัดเจน เข้าใจปัญหา
- ☐ มี Options อย่างน้อย 2-3 ทางเลือก
- ☐ Pros/Cons ครบถ้วน
- ☐ Decision Rationale มีเหตุผลรองรับ
- ☐ Consequences ระบุทั้งดีและไม่ดี
- ☐ Related ADRs linked ถูกต้อง
- ☐ Code examples (ถ้ามี) อ่านง่าย

---

## 🎯 Best Practices

### Writing Good ADRs

1. **Be Concise:** ไม่เกิน 3-4 หน้า (except code examples)
2. **Focus on "Why":** อธิบายเหตุผลมากกว่า "How"
3. **List Alternatives:** แสดงว่าพิจารณาหลายทางเลือก
4. **Be Honest:** ระบุ Cons และ Risks จริงๆ
5. **Use Diagrams:** Visualize ด้วย Mermaid diagrams
6. **Link References:** ใส่ Link ไปเอกสารอ้างอิง

### Common Mistakes

- ❌ เขียนยาวเกินไป (วนเวียน)
- ❌ ไม่มี Alternatives (แสดงว่าไม่ได้พิจารณา)
- ❌ Consequences ไม่จริงใจ (แต่งว่าดีอย่างเดียว)
- ❌ Implementation details มากเกินไป
- ❌ ไม่ Update เมื่อ Decision เปลี่ยน

---

## 📚 External Resources

- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR Tools](https://github.com/npryce/adr-tools)
- [Architecture Decision Records in Action](https://www.thoughtworks.com/insights/blog/architecture/architecture-decision-records-in-action)

---

## 📧 Contact

หากมีคำถามเกี่ยวกับ ADRs กรุณาติดต่อ:

- **System Architect:** Nattanin Peancharoen
- **Development Team Lead:** [Name]

---

**Version:** 1.8.5 (Added ADR-003, ADR-004, ADR-007)
**Last Review:** 2026-04-10
**Next Review:** 2026-10-10

---

## 📚 Enhanced Documentation

- **[Enhanced ADR Template](./ADR-TEMPLATE-enhanced.md)** - Template ใหม่พร้อม Impact Analysis
- **[ADR Review Process](./ADR-REVIEW-PROCESS.md)** - กระบวนการทบทวนและ Version Management
- **[Version Dependency Matrix](./VERSION-DEPENDENCIES.md)** - ความสัมพันธ์ระหว่าง ADRs (สร้างในอนาคต)
