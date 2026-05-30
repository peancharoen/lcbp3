# 📚 LCBP3-DMS Specifications Directory

**Version:** 1.9.5 (AI Intent/Tool Layer/Chat/Admin Console ADRs + Migration Arch Refactor)
**Last Updated:** 2026-05-22
**Project:** LCBP3-DMS (Laem Chabang Port Phase 3 - Document Management System)
**Status:** ✅ Production Ready — 10/10 Documentation Gaps Closed • Hybrid Specs Structure Applied

---

เอกสารในโฟลเดอร์ `specs/` ทั้งหมดเป็น **Source of Truth** หรือคัมภีร์หลักสำหรับการพัฒนาระบบ LCBP3-DMS ข้อมูลทั้งหมดถูกอัปเดตและปรับให้มีความสอดคล้องกัน (Modular) ตามมาตรฐานของโปรเจกต์ โครงสร้างด้านล่างคือสารบัญ (Index) ของเอกสารทั้งหมดในระบบ

---

## 📂 Directory Structure (v1.9.5)

```text
specs/
├── 00-Overview/                 # ภาพรวมระบบ + Product Vision + KPI + Training
│   ├── 00-01-quick-start.md     # คู่มือเริ่มต้นสำหรับนักพัฒนา
│   ├── 00-02-glossary.md        # คำศัพท์และตัวย่อในระบบ DMS
│   ├── 00-03-product-vision.md  # ★ Gap 1: Product Vision, Strategic Pillars, Guardrails
│   ├── 00-04-stakeholder-signoff-and-risk.md  # ★ Gap 5: Sign-off, Risk Register, Change Control
│   ├── 00-05-kpi-baseline.md    # ★ Gap 6: 14 KPIs, SQL Queries, Grafana Specs
│   ├── 00-06-training-plan.md   # ★ Gap 9: Training Curriculum per Role (4 Phases)
│   └── README.md                # แนะนำโครงสร้างธุรกิจและบริบทระบบ
│
├── 01-Requirements/             # Business Requirements & Modularity (Core)
│   ├── 01-01-objectives.md      # วัตถุประสงค์และการประเมินความสำเร็จของระบบ
│   ├── 01-02-business-rules/    # กฎเหล็กของ DMS (ห้ามละเมิด)
│   ├── 01-03-modules/           # สเปคของแต่ละระบบย่อย (Correspondences, Drawings, RFAs)
│   ├── 01-04-user-stories.md    # ★ Gap 2: 27 User Stories, 8 Epics, MoSCoW Priority
│   ├── 01-05-acceptance-criteria.md  # ★ Gap 3: UAT Acceptance Criteria, Sign-off Process
│   ├── 01-06-edge-cases-and-rules.md # ★ Gap 10: 37 Edge Cases, Business Logic Guards
│   ├── 01-07-ui-wireframes.md   # ★ Gap 4: 26 Screens, Navigation Map, Design System
│   └── README.md                # สารบัญและรายละเอียดขอบเขตแต่ละ Module
│
├── 02-Architecture/             # สถาปัตยกรรมระบบ (System & Network)
│   ├── 02-01-system-context.md  # System overview
│   ├── 02-02-software-architecture.md # โครงสร้างซอฟต์แวร์ฝั่ง Frontend & Backend
│   ├── 02-03-network-design.md  # Network Segmentation (VLAN, QNAP Production / ASUSTOR Monitoring)
│   ├── 02-04-api-design.md      # API specifications & Error Handling
│   └── README.md                # สรุปรูปแบบโครงสร้างของ Architecture
│
├── 03-Data-and-Storage/         # โครงสร้างฐานข้อมูลและการจัดการไฟล์
│   ├── 03-01-data-dictionary.md # รวมและอธิบายทุก Field ในฐานข้อมูล
│   ├── 03-02-db-indexing.md     # Index recommendations, Soft-delete strategy
│   ├── 03-03-file-storage.md    # Secure File Handling (Outside webroot, QNAP Mounts)
│   ├── 03-04-legacy-data-migration.md  # Legacy Data Migration จาก Excel (ADR-017)
│   ├── 03-05-n8n-migration-setup-guide.md  # n8n Workflow Setup + Ollama Integration
│   ├── 03-06-migration-business-scope.md   # ★ Gap 7: Migration Scope, 3 Tiers, Go/No-Go Gates
│   ├── 03-07-OpenRAG.md         # OpenRAG Architecture & Implementation
│   ├── lcbp3-v1.9.0-schema-01-drop.sql     # Schema: DROP statements
│   ├── lcbp3-v1.9.0-schema-02-tables.sql   # Schema: CREATE TABLE (Source of Truth)
│   ├── lcbp3-v1.9.0-schema-03-views-indexes.sql  # Schema: Views + Indexes
│   ├── lcbp3-v1.9.0-seed-basic.sql         # Seed: Master Data
│   ├── lcbp3-v1.9.0-seed-permissions.sql   # Seed: CASL Permission Matrix
│   ├── deltas/                  # Schema delta files (ADR-009 incremental changes)
│   └── README.md                # ภาพรวม Data Strategy
│
├── 04-Infrastructure-OPS/       # โครงสร้างพื้นฐานและการปฏิบัติการ
│   ├── 04-00-docker-compose/    # 🔒 Live compose stacks (QNAP + ASUSTOR) — v1.8.9 hardened
│   │   ├── SECURITY-MIGRATION-v1.8.6.md  # Full 27-finding hardening runbook
│   │   ├── README.md                     # Stack overview + secret roadmap
│   │   ├── x-base.yml                    # Shared YAML anchors
│   │   └── .env.template                 # Master env template
│   ├── 04-01-docker-compose.md  # DEV/PROD Docker configuration
│   ├── 04-02-backup-recovery.md # Disaster Recovery & DB Backup
│   ├── 04-03-monitoring.md      # KPI, Audit Logging, Grafana/Prometheus
│   ├── 04-04-deployment-guide.md# ขั้นตอน Deploy ด้วย Blue-Green (Gitea Actions)
│   ├── 04-05-maintenance-procedures.md # วิธีดูแลรักษาระบบเบื้องต้น
│   ├── 04-06-security-operations.md # การจัดการความปลอดภัยและใบรับรอง
│   ├── 04-07-incident-response.md   # วิธีรับมือเหตุฉุกเฉิน
│   ├── 04-08-release-management-policy.md  # ★ Gap 8: SemVer, 5 Gates, Hotfix, Rollback
│   └── README.md                # Infrastructure & Operations Guide
│
├── 05-Engineering-Guidelines/   # มาตรฐานการพัฒนาและการเขียนโค้ด
│   ├── 05-01-fullstack-js-guidelines.md # JS/TS Guidelines + NestJS 11 Patterns
│   ├── 05-02-backend-guidelines.md      # NestJS Backend, Error Handling
│   ├── 05-03-frontend-guidelines.md     # UI/UX, React Hook Form, State Strategy
│   ├── 05-04-testing-strategy.md        # Unit/E2E Testing ยุทธศาสตร์
│   ├── 05-05-git-cheatsheet.md          # การใช้ Git สำหรับทีมงาน
│   ├── 05-05-git-conventions.md         # Git Conventions (branch/commit naming)
│   ├── 05-06-code-snippets.md           # Reusable code patterns
│   ├── 05-07-hybrid-uuid-implementation-plan.md  # ADR-019 Implementation Guide
│   ├── 05-08-i18n-guidelines.md         # Localization rules
│   └── README.md                        # ภาพรวมเป้าหมายงาน Engineering
│
├── 06-Decision-Records/         # Architecture Decision Records (28 ADRs)
│   ├── ADR-001 to ADR-017...    # ไฟล์อธิบายสถาปัตยกรรม (ADR)
│   ├── ADR-018-ai-boundary.md   # ★ Patch 1.8.1: AI/Ollama Isolation Policy (Superseded by ADR-023)
│   ├── ADR-019-hybrid-identifier-strategy.md  # ★ Hybrid ID: INT PK + UUIDv7 Public API
│   ├── ADR-021-integrated-workflow-context.md  # ★ Workflow Engine & Step-specific Attachments
│   ├── ADR-022-retrieval-augmented-generation.md  # RAG Architecture
│   ├── ADR-023-unified-ai-architecture.md  # ★ Unified AI Architecture (Consolidates ADR-017/017B/018/020/022)
│   ├── ADR-023A-unified-ai-architecture.md  # ★ AI Model Revision: 2-Model Stack + BullMQ 2-Queue
│   ├── ADR-024-intent-classification-strategy.md  # ★ AI Intent Classification Strategy
│   ├── ADR-025-ai-tool-layer-architecture.md  # ★ AI Tool Layer Architecture
│   ├── ADR-026-document-chat-ui-pattern.md  # ★ Document Chat UI Pattern
│   ├── ADR-027-ai-admin-console-and-dynamic-control.md  # ★ AI Admin Panel & Dynamic Control
│   ├── ADR-028-migration-architecture-refactor.md  # ★ Migration Architecture Refactor (Staging Queue)
│   └── README.md                # รายชื่อ ADR ทั้งหมดพร้อมสถานะและวันที่
│
├── 100-Infrastructures/         # Feature Work: Infrastructure (Deployment, Monitoring, Docker Compose, Network)
│   ├── 102-infra-ops/           # Infrastructure Operations & Deployment Automation
│   ├── 103-node-upgrade/        # Node.js Upgrade Planning & Execution
│   └── README.md                # Category guide
│
├── 200-fullstacks/              # Feature Work: Fullstack Development (Backend + Frontend features, Workflow Engine, API)
│   ├── 201-transmittals-circulation/  # Transmittals + Circulation Integration
│   ├── 202-adr-021-integrated-workflow-conte/  # ADR-021 Integrated Workflow Context
│   ├── 203-unified-workflow-engine/   # Unified Workflow Engine
│   ├── 204-rfa-approval-refactor/     # RFA Approval Refactor
│   ├── 224-intent-classification/     # AI Intent Classification
│   ├── 225-ai-tool-layer-architecture/ # AI Tool Layer Architecture
│   ├── 226-document-chat-ui-pattern/  # Document Chat UI Pattern
│   ├── 227-ai-admin-console/          # AI Admin Console
│   ├── 228-migration-arch-refactor/   # Migration Architecture Refactor
│   ├── 232-typhoon-ocr-integration/   # Typhoon OCR Integration (Typhoon OCR-3B + typhoon2.1-gemma3-4b)
│   └── README.md                # Category guide
│
├── 300-others/                  # Feature Work: Documentation, Research, Non-code tasks
│   ├── 301-unified-ai-arch/     # Unified AI Architecture Research
│   ├── 302-ai-model-revision/   # AI Model Revision Research
│   └── README.md                # Category guide
│
├── 08-Tasks/                    # Task documents
│
├── 88-logs/                     # Logs
│
└── 99-archives/                 # ประวัติการทำงานและ Tasks เก่า
    ├── history/                 # ประวัติเก่า
    ├── tasks/                   # Task ที่อดีตเคยถูกใช้งาน
    └── obsolete-specs/          # เอกสารสเปคเวอร์ชันเก่า (V1.4.2 ฯลฯ)
```

> **★** = เอกสารใหม่จาก v1.8.1 Patch (Product Owner Documentation — 10/10 Gaps Closed)

---

## 📋 Document Index: 10 Documentation Gaps (v1.8.1)

| Gap    | เอกสาร                                 | ไฟล์                                                       | สถานะ |
| ------ | -------------------------------------- | ---------------------------------------------------------- | ----- |
| **1**  | Product Vision Statement               | `00-Overview/00-03-product-vision.md`                      | ✅    |
| **2**  | User Stories (27 Stories, 8 Epics)     | `01-Requirements/01-04-user-stories.md`                    | ✅    |
| **3**  | Acceptance Criteria & UAT Plan         | `01-Requirements/01-05-acceptance-criteria.md`             | ✅    |
| **4**  | UI/UX Wireframes (26 Screens)          | `01-Requirements/01-07-ui-wireframes.md`                   | ✅    |
| **5**  | Stakeholder Sign-off & Risk Register   | `00-Overview/00-04-stakeholder-signoff-and-risk.md`        | ✅    |
| **6**  | KPI Baseline Data (14 KPIs)            | `00-Overview/00-05-kpi-baseline.md`                        | ✅    |
| **7**  | Migration Business Scope (~20K Docs)   | `03-Data-and-Storage/03-06-migration-business-scope.md`    | ✅    |
| **8**  | Release Management Policy              | `04-Infrastructure-OPS/04-08-release-management-policy.md` | ✅    |
| **9**  | Training Plan (per Role, 4 Phases)     | `00-Overview/00-06-training-plan.md`                       | ✅    |
| **10** | Edge Cases & Business Rules (37 rules) | `01-Requirements/01-06-edge-cases-and-rules.md`            | ✅    |

---

## 🔑 Quick Reference: Critical Files

> Before writing ANY code, verify these files first.

| เอกสาร               | Path                                                        | ใช้เมื่อ                            |
| -------------------- | ----------------------------------------------------------- | ----------------------------------- |
| **Schema Tables**    | `03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`     | ก่อนเขียน Query ทุกครั้ง            |
| **Data Dictionary**  | `03-Data-and-Storage/03-01-data-dictionary.md`              | ตรวจ Field Meaning + Business Rules |
| **Seed Permissions** | `03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql`     | ตรวจ CASL Permission Matrix         |
| **Edge Cases**       | `01-Requirements/01-06-edge-cases-and-rules.md`             | 37 Rules ป้องกัน Bug                |
| **Migration Scope**  | `03-Data-and-Storage/03-06-migration-business-scope.md`     | งาน Migration Bot                   |
| **Release Policy**   | `04-Infrastructure-OPS/04-08-release-management-policy.md`  | ก่อน Deploy / Hotfix                |
| **UAT Criteria**     | `01-Requirements/01-05-acceptance-criteria.md`              | ตรวจความสมบูรณ์ Feature             |
| **Infra Hardening**  | `04-Infrastructure-OPS/04-00-docker-compose/SECURITY-MIGRATION-v1.8.6.md` | Compose security runbook (v1.8.9) |
| **ADR-009**          | `06-Decision-Records/ADR-009-db-strategy.md`                | Schema Change Process               |
| **ADR-018**          | `06-Decision-Records/ADR-018-ai-boundary.md`                | AI/Ollama Integration Rules (Superseded by ADR-023) |
| **ADR-019**          | `06-Decision-Records/ADR-019-hybrid-identifier-strategy.md` | Hybrid ID Strategy (INT + UUIDv7)   |
| **ADR-021**          | `06-Decision-Records/ADR-021-integrated-workflow-context.md` | Workflow Context & Step Attachments |
| **ADR-023**          | `06-Decision-Records/ADR-023-unified-ai-architecture.md`    | Unified AI Architecture             |
| **ADR-023A**         | `06-Decision-Records/ADR-023A-unified-ai-architecture.md`   | 2-Model Stack + BullMQ 2-Queue      |
| **ADR-024**          | `06-Decision-Records/ADR-024-intent-classification-strategy.md` | AI Intent Classification        |
| **ADR-025**          | `06-Decision-Records/ADR-025-ai-tool-layer-architecture.md` | AI Tool Layer Architecture          |
| **ADR-026**          | `06-Decision-Records/ADR-026-document-chat-ui-pattern.md`   | Document Chat UI Pattern            |
| **ADR-027**          | `06-Decision-Records/ADR-027-ai-admin-console-and-dynamic-control.md` | AI Admin Console & Dynamic Control |
| **ADR-028**          | `06-Decision-Records/ADR-028-migration-architecture-refactor.md` | Migration Arch Refactor (Staging Queue) |

---

## 🎯 Important Rules สำหรับนักพัฒนา (Must Follow)

1. **The Specs are the Source of Truth:** ก่อนเริ่มงานเสมอ ให้อ่าน Requirement, Architecture และ ADR ถ้าเจอประโยคไหนที่คุณคิดไว้แล้วขัดแย้งกับ Specs ให้ยึดจากใน `specs/` เป็นคำตอบสุดท้าย

2. **Never Invent Tables / Columns:** ห้ามสร้างคอลัมน์ใหม่ในหัวเอง ให้ดู Schema ใน `03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` สำหรับโครงสร้าง Table ทั้งหลัก และ Reference — Schema แบ่งเป็น 3 ไฟล์ (01-drop / 02-tables / 03-views-indexes)

3. **Double-Lock Numbering:** ระบบออกเลขเอกสารมีความอ่อนไหวสูง เนื่องจากมีหลาย User พร้อมกัน ต้องใช้ **Redis Redlock** ควบคู่กับ **DB Optimistic Lock** เพื่อแก้ Race Condition (ADR-002)

4. **Follow Blue-Green Deployment:** โปรเจกต์พึ่งพาการทำ Blue-Green Environment เพื่อ Downtime ขั้นต่ำ ต้องผ่าน **5 Release Gates** ก่อน Deploy ทุกครั้ง — ดู `04-08-release-management-policy.md`

5. **No `any` Types:** ไม่อนุญาตให้ใช้ `any` ในโค้ด พยายามใช้ Validation ผ่าน DTO / Zod แบบ Strongly-typed เสมอ — **Enforced ✅** (0 remaining in backend as of v1.9.0, ดูเทคนิคที่ `05-02-backend-guidelines.md`)

6. **AI Isolation (ADR-023/023A):** Ollama ต้องรันบน **Admin Desktop** (Desk-5439) เท่านั้น — ห้ามรันบน QNAP/Production Server ห้ามมี Direct DB Access โดยเด็ดขาด AI Output ต้องผ่าน Backend Validation ก่อน Write ทุกครั้ง ใช้ 2-Model Stack (gemma4:e2b + nomic-embed-text) + BullMQ 2-Queue (ai-realtime/ai-batch)

7. **UAT Sign-off Required:** ห้าม Close UAT โดยไม่มี Acceptance Criteria ✅ ครบทุกข้อ — ดู `01-05-acceptance-criteria.md`

8. **Migration Gate Required:** ห้ามเริ่ม Legacy Migration โดยไม่ผ่าน Go/No-Go Gate #1 — ดู `03-06-migration-business-scope.md`

---

## 🏛️ ADR Reference (All 28 ADRs)

| ADR        | Topic                           | Key Decision                                              | สถานะ    |
| ---------- | ------------------------------- | --------------------------------------------------------- | -------- |
| ADR-001    | Workflow Engine                 | Unified state machine for document workflows              | ✅ Active |
| ADR-002    | Doc Numbering                   | Redis Redlock + DB optimistic locking                     | ✅ Active |
| ADR-003    | API Design                      | RESTful API design strategy                               | ✅ Active |
| ADR-004    | DB Schema Design                | Schema design patterns & normalization                    | ✅ Active |
| ADR-005    | Technology Stack                | NestJS 11 + Next.js + MariaDB + Redis                     | ✅ Active |
| ADR-006    | Redis Caching                   | Cache strategy and invalidation patterns                  | ✅ Active |
| ADR-007    | Error Handling                  | Layered error classification + user-friendly messages     | ✅ Active |
| ADR-008    | Email Notification              | BullMQ queue-based email/LINE/in-app                      | ✅ Active |
| ADR-009    | DB Strategy                     | No TypeORM migrations — modify schema SQL directly        | ✅ Active |
| ADR-010    | Logging/Monitoring              | Prometheus + Loki + Grafana stack                         | ✅ Active |
| ADR-011    | App Router                      | Next.js App Router with RSC patterns                      | ✅ Active |
| ADR-012    | UI Components                   | Shadcn/UI component library                               | ✅ Active |
| ADR-013    | Form Handling                   | React Hook Form + Zod validation                          | ✅ Active |
| ADR-014    | State Management                | TanStack Query (server) + Zustand (client)                | ✅ Active |
| ADR-015    | Deployment                      | Docker Compose + Gitea CI/CD + Blue-Green                 | ✅ Active |
| ADR-016    | Security                        | JWT + CASL RBAC + Helmet.js + ClamAV                      | ✅ Active |
| ADR-017    | Ollama Migration                | Local AI + n8n for legacy data import                     | ✅ Active |
| ADR-017B   | AI Document Classification      | ML classification for document categorization             | ✅ Active |
| ADR-018 ★  | AI Boundary (Patch 1.8.1)       | AI isolation — no direct DB/storage access                | Superseded by ADR-023 |
| ADR-019 ★  | Hybrid Identifier Strategy      | INT PK (internal) + UUIDv7 (public API)                   | ✅ Active |
| ADR-020    | AI Intelligence Integration     | AI integration pipeline architecture                      | ✅ Active |
| ADR-021 ★  | Integrated Workflow Context     | Workflow Engine & step-specific attachments               | ✅ Active |
| ADR-022    | Retrieval Augmented Generation  | RAG architecture for document search                      | ✅ Active |
| ADR-023 ★  | Unified AI Architecture         | Consolidates ADR-017/017B/018/020/022                     | ✅ Active |
| ADR-023A ★ | AI Model Revision               | 2-Model stack + BullMQ 2-Queue + OCR auto-detect          | ✅ Active |
| ADR-024 ★  | Intent Classification Strategy  | AI intent classification for user queries (2026-05-19)    | ✅ Active |
| ADR-025 ★  | AI Tool Layer Architecture      | Tool layer pattern for AI capability composition          | ✅ Active |
| ADR-026 ★  | Document Chat UI Pattern        | Document-centric chat UI (2026-05-19)                     | ✅ Active |
| ADR-027 ★  | AI Admin Console & Dynamic Ctrl | AI Admin Panel + dynamic model/prompt control (2026-05-20) | ✅ Active |
| ADR-028 ★  | Migration Architecture Refactor | Staging Queue & post-migration cleanup (2026-05-22)       | ✅ Active |

> **Priority:** `06-Decision-Records` > `05-Engineering-Guidelines` > others
