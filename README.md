# 📋 LCBP3-DMS - Document Management System

> **Laem Chabang Port Phase 3 - Document Management System**
> ระบบบริหารจัดการเอกสารโครงการแบบครบวงจร สำหรับโครงการก่อสร้างท่าเรือแหลมฉบังระยะที่ 3

[![Version](https://img.shields.io/badge/version-1.8.11-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Internal-red.svg)]()
[![Status](https://img.shields.io/badge/status-UAT%20Ready-brightgreen.svg)]()
[![Docs](https://img.shields.io/badge/docs-10%2F10%20Gaps%20Closed-success.svg)](./specs/00-Overview/README.md)

---

## 📈 Current Status (As of 2026-04-18)

**Version 1.8.11 — Node.js v24.15.0 LTS Upgrade**

> v1.8.10 (Network Infra Guide v3.1) shipped Apr 28; v1.8.11 (Node.js v24.15.0 LTS) shipped May 5.

| Area                   | Status                   | หมายเหตุ                                                           |
| ---------------------- | ------------------------ | ------------------------------------------------------------------ |
| 🔧 **Backend**         | ✅ Production Ready      | NestJS 11, Express v5, 0 Vulnerabilities                           |
| 🎨 **Frontend**        | ✅ 100% Complete         | Next.js 16.2.0, React 19.2.4, ESLint 9                             |
| 💾 **Database**        | ✅ Schema v1.8.0 Stable  | MariaDB 11.8, No-migration Policy                                  |
| 📘 **Documentation**   | ✅ **10/10 Gaps Closed** | Product Vision → Release Policy                                    |
| 🤖 **AI Migration**    | 🔄 Pre-migration Setup   | n8n + Ollama (ADR-017/018)                                         |
| 🔄 **Workflow Engine** | ✅ ADR-021 Integrated    | Transmittals & Circulation with Integrated Context                 |
| 🧪 **Testing**         | 🔄 UAT Preparation       | E2E + Acceptance Criteria ready                                    |
| 🚀 **Deployment**      | 📋 Pending Go-Live Gate  | Blue-Green on QNAP Container Station                               |
| 🔒 **Infrastructure**  | ✅ Hardened (v1.8.9)     | Compose stacks audited; secrets, auth, container hardening applied |

---

## 🎯 ภาพรวมโครงการ

LCBP3-DMS เป็นระบบบริหารจัดการเอกสารโครงการที่ออกแบบมาเพื่อรองรับการทำงานของโครงการก่อสร้างขนาดใหญ่ โดยเน้นที่:

- **ความปลอดภัยสูงสุด** - Security-first approach ด้วย RBAC 4 ระดับ
- **ความถูกต้องของข้อมูล** - Data Integrity ผ่าน Transaction และ Locking Mechanisms
- **ความยืดหยุ่น** - Unified Workflow Engine รองรับ Workflow ที่ซับซ้อน
- **ความทนทาน** - Resilience Patterns และ Error Handling ที่ครอบคลุม

### ✨ ฟีเจอร์หลัก

- 📝 **Correspondence Management** - จัดการเอกสารโต้ตอบระหว่างองค์กร
- 🔧 **RFA Management** - ระบบขออนุมัติเอกสารทางเทคนิค
- 📐 **Drawing Management** - จัดการแบบก่อสร้างและแบบคู่สัญญา
- 🔄 **Workflow Engine** - DSL-based workflow สำหรับกระบวนการอนุมัติ (ADR-021 Integrated Context)
- 📊 **Advanced Search** - ค้นหาเอกสารด้วย Elasticsearch
- 🔐 **RBAC 4-Level** - ควบคุมสิทธิ์แบบละเอียด (Global, Organization, Project, Contract)
- 📁 **Two-Phase File Storage** - จัดการไฟล์แบบ Transactional พร้อม Virus Scanning
- 🔢 **Document Numbering** - สร้างเลขที่เอกสารอัตโนมัติ ป้องกัน Race Condition
- 🤖 **AI-Assisted Migration** - Ollama + n8n นำเข้าเอกสารเก่า ~20,000 ไฟล์ (ADR-017/018)

---

## 🏗️ สถาปัตยกรรมระบบ

### Technology Stack

#### Backend (NestJS)

```typescript
{
  "framework": "NestJS 11 (TypeScript, Express v5)",
  "database": "MariaDB 11.8",
  "orm": "TypeORM",
  "authentication": "JWT + Passport",
  "authorization": "CASL (RBAC)",
  "search": "Elasticsearch 9.3.4",
  "cache": "Redis",
  "queue": "BullMQ",
  "fileUpload": "Multer + ClamAV",
  "notification": "Nodemailer 8.0.3 + n8n (LINE)",
  "documentation": "Swagger",
  "security": "0 vulnerabilities (as of 2026-03-19)"
}
```

#### Frontend (Next.js)

```typescript
{
  "framework": "Next.js 16.2.0 (App Router, proxy.ts)",
  "language": "TypeScript",
  "styling": "Tailwind CSS 4.2.2",
  "components": "shadcn/ui",
  "stateManagement": {
    "server": "TanStack Query (React Query)",
    "forms": "React Hook Form 7.71.2 + Zod 4.3.6",
    "ui": "useState/useReducer"
  },
  "testing": "Vitest 4.1.0 + Playwright",
  "linting": "ESLint 9.39.1"
}
```

#### Infrastructure

- **Server**: QNAP TS-473A (AMD Ryzen V1500B, 32GB RAM)
- **Containerization**: Docker + Docker Compose (Container Station)
- **Reverse Proxy**: Nginx Proxy Manager
- **Version Control**: Gitea (Self-hosted)
- **Domain**: `np-dms.work`

### โครงสร้างระบบ

```
┌─────────────────┐
│  Nginx Proxy    │ ← SSL/TLS Termination
│    Manager      │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬──────────┐
    │         │            │          │
┌───▼───┐ ┌──▼──┐  ┌─────▼────┐ ┌──▼──┐
│Next.js│ │NestJS│ │Elasticsearch│ │ n8n │
│Frontend│ │Backend│ │  Search   │ │Workflow│
└───────┘ └──┬──┘  └──────────┘ └─────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───▼───┐ ┌─▼──┐ ┌──▼────┐
│MariaDB│ │Redis│ │ClamAV │
│  DB   │ │Cache│ │ Scan  │
└───────┘ └────┘ └───────┘
```

---

## 🚀 เริ่มต้นใช้งาน

### ข้อกำหนดระบบ

- **Node.js**: v24.15.0 LTS (>=24.0.0)
- **pnpm**: v8.x หรือสูงกว่า
- **Docker**: v24.x หรือสูงกว่า
- **MariaDB**: 11.8
- **Redis**: 7.x

### การติดตั้ง

#### 1. Clone Repository

```bash
git clone https://git.np-dms.work/lcbp3/lcbp3-dms.git
cd lcbp3-dms
```

#### 2. ติดตั้ง Dependencies

```bash
# ติดตั้ง dependencies ทั้งหมด (backend + frontend)
pnpm install
```

#### 3. ตั้งค่า Environment Variables

**Backend:**

```bash
cd backend
cp .env.example .env
# แก้ไข .env ตามความเหมาะสม
```

**Frontend:**

```bash
cd frontend
cp .env.local.example .env.local
# แก้ไข .env.local ตามความเหมาะสม
```

#### 4. ตั้งค่า Database

```bash
# Import schema (v1.8.0 — ดู ADR-009: No migrations, แก้ไข SQL ตรง)
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-01-drop.sql
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-03-views-indexes.sql

# Import seed data
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-basic.sql
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-permissions.sql
```

#### 5. รัน Development Server

**Backend:**

```bash
cd backend
pnpm run start:dev
```

**Frontend:**

```bash
cd frontend
pnpm run dev
```

### การเข้าถึงระบบ

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **API Documentation**: `http://localhost:3001/api`

### ข้อมูลเข้าสู่ระบบเริ่มต้น

```
Superadmin:
  Username: admin@np-dms.work
  Password: (ดูใน seed data)
```

---

## 📁 โครงสร้างโปรเจกต์

```
lcbp3-dms/
├── backend/                    # 🔧 NestJS Backend
│   ├── src/
│   │   ├── common/             # Shared utilities, guards, decorators
│   │   ├── config/             # Configuration module
│   │   ├── database/           # Database entities & migrations
│   │   ├── modules/            # Feature modules (18 modules)
│   │   │   ├── auth/           # JWT Authentication
│   │   │   ├── user/           # User management & RBAC
│   │   │   ├── project/        # Project & Contract management
│   │   │   ├── correspondence/ # Correspondence module
│   │   │   ├── rfa/            # Request for Approval
│   │   │   ├── drawing/        # Contract & Shop Drawings
│   │   │   ├── workflow-engine/# DSL Workflow Engine
│   │   │   ├── document-numbering/ # Auto numbering
│   │   │   ├── transmittal/    # Transmittal management
│   │   │   ├── circulation/    # Circulation sheets
│   │   │   ├── search/         # Elasticsearch integration
│   │   │   ├── dashboard/      # Statistics & reporting
│   │   │   ├── notification/   # Email/LINE notifications
│   │   │   ├── monitoring/     # Health checks & metrics
│   │   │   ├── master/         # Master data management
│   │   │   ├── organizations/  # Organization management
│   │   │   └── json-schema/    # JSON Schema validation
│   │   └── main.ts
│   ├── test/                   # Unit & E2E tests
│   └── uploads/                 # File upload storage (temp/ + permanent/)
│   └── package.json
│
├── frontend/                   # 🎨 Next.js Frontend
│   ├── app/                    # App Router
│   │   ├── (admin)/            # Admin panel routes
│   │   │   └── admin/
│   │   │       ├── workflows/  # Workflow configuration
│   │   │       ├── numbering/  # Document numbering config
│   │   │       ├── users/      # User management
│   │   │       └── ...
│   │   ├── (auth)/             # Authentication pages
│   │   ├── (dashboard)/        # Main dashboard routes
│   │   │   ├── correspondences/
│   │   │   ├── rfas/
│   │   │   ├── drawings/
│   │   │   └── ...
│   │   └── api/                # API routes (NextAuth)
│   ├── components/             # React Components (15 groups)
│   │   ├── ui/                 # Shadcn/UI components
│   │   ├── layout/             # Layout components
│   │   ├── common/             # Shared components
│   │   ├── correspondences/    # Correspondence UI
│   │   ├── rfas/               # RFA UI
│   │   ├── drawings/           # Drawing UI
│   │   ├── workflows/          # Workflow builder
│   │   ├── numbering/          # Numbering config UI
│   │   ├── dashboard/          # Dashboard widgets
│   │   ├── search/             # Search components
│   │   └── ...
│   ├── lib/                    # Utilities & API clients
│   │   ├── api/                # API client functions
│   │   ├── services/           # Business logic services
│   │   └── stores/             # Zustand state stores
│   ├── types/                  # TypeScript definitions
│   └── public/                 # Static assets (locales, favicon, robots.txt)
│   └── package.json
│
├── specs/                      # 📘 Project Specifications v1.8.7 - 10/10 Gaps Closed
│   ├── 00-Overview/            # ภาพรวม: Product Vision, KPI Baseline, Training, Stakeholder
│   │   ├── 00-03-product-vision.md       # Gap 1 — Product Vision Statement
│   │   ├── 00-04-stakeholder-signoff-and-risk.md  # Gap 5 — Risk & Sign-off
│   │   ├── 00-05-kpi-baseline.md         # Gap 6 — KPI Baseline & 14 Metrics
│   │   └── 00-06-training-plan.md        # Gap 9 — Training Curriculum
│   ├── 01-Requirements/        # Requirements: User Stories, UAT, UI Wireframes, Edge Cases
│   │   ├── 01-04-user-stories.md         # Gap 2 — 27 User Stories (8 Epics)
│   │   ├── 01-05-acceptance-criteria.md  # Gap 3 — UAT Acceptance Criteria
│   │   ├── 01-06-edge-cases-and-rules.md # Gap 10 — 37 Edge Cases
│   │   └── 01-07-ui-wireframes.md        # Gap 4 — 26 Screens, Navigation Map
│   ├── 02-Architecture/        # สถาปัตยกรรมระบบ (4 docs)
│   ├── 03-Data-and-Storage/    # Schema v1.8.0 (split 3 files) + 03-06-migration-business-scope.md
│   ├── 04-Infrastructure-OPS/  # Ops: Deploy, Monitoring, Security + 04-08-release-management-policy.md
│   ├── 05-Engineering-Guidelines/ # มาตรฐานการพัฒนา Backend/Frontend
│   ├── 06-Decision-Records/    # 22 ADRs (ADR-001~021 + ADR-017B)
│   ├── 08-Tasks/               # Task documentation and implementation plans
│   └── 99-archives/            # History and old Tasks
│
├── docs/                       # 📚 Legacy documentation
├── infrastructure/             # 🐳 Docker & Deployment configs
├── scripts/                    # Utility scripts (bash + powershell)
│   ├── bash/                   # Bash scripts
│   ├── powershell/             # PowerShell scripts
│
├── .agents/                    # AI agent workflows and tools
│   ├── skills/                 # Agent skills (nestjs-best-practices, next-best-practices, speckit-*)
│   ├── scripts/                # Agent utility scripts
│   ├── tests/                  # Agent integration tests
│
├── .windsurf/                  # Windsurf AI workflows
│   ├── workflows/              # Speckit workflow definitions (00-speckit.all, 01-speckit.constitution, etc.)
│
├── .github/                    # GitHub Actions workflows
│   ├── workflows/              # CI/CD pipeline definitions
│   ├── PULL_REQUEST_TEMPLATE.md
│
├── .gitea/                     # Gitea configuration
├── .gemini/                    # Gemini AI agent configuration
├── .vscode/                    # VS Code settings and extensions
├── .husky/                     # Git hooks
│
├── AGENTS.md                   # AI agent rules & project context (v1.8.9) [★ primary]
├── GEMINI.md                   # AI coding guidelines [legacy — kept for backward compat]
├── CONTRIBUTING.md             # Contribution guidelines (+ AI-Assisted section)
├── CHANGELOG.md                # Version history
├── README.md                   # This file
├── package.json                # Root package.json (monorepo)
├── pnpm-workspace.yaml         # Monorepo configuration
├── lcbp3.code-workspace        # VS Code workspace configuration
│
├── output/                     # Build and output files
│   ├── pdf/                    # Generated PDF documentation
│
└──
```

---

## 📚 เอกสารประกอบ

### เอกสารหลัก (specs/ folder)

| เอกสาร                  | คำอธิบาย                                                         | Gap       | ไฟล์หลัก                                |
| ----------------------- | ---------------------------------------------------------------- | --------- | --------------------------------------- |
| **Product Vision**      | Vision, Strategic Pillars, Guardrails                            | Gap 1 ✅  | `00-03-product-vision.md`               |
| **User Stories**        | 27 Stories, 8 Epics, MoSCoW                                      | Gap 2 ✅  | `01-04-user-stories.md`                 |
| **Acceptance Criteria** | UAT Criteria, Sign-off Process                                   | Gap 3 ✅  | `01-05-acceptance-criteria.md`          |
| **UI/UX Wireframes**    | 26 Screens, ASCII Wireframes, Design System                      | Gap 4 ✅  | `01-07-ui-wireframes.md`                |
| **Stakeholder & Risk**  | Sign-off, Risk Register, Change Control                          | Gap 5 ✅  | `00-04-stakeholder-signoff-and-risk.md` |
| **KPI Baseline**        | 14 KPIs, SQL Queries, Grafana Specs                              | Gap 6 ✅  | `00-05-kpi-baseline.md`                 |
| **Migration Scope**     | 20K Docs, 3 Tiers, Go/No-Go Gates                                | Gap 7 ✅  | `03-06-migration-business-scope.md`     |
| **Release Policy**      | SemVer, 5 Gates, Hotfix, Rollback                                | Gap 8 ✅  | `04-08-release-management-policy.md`    |
| **Training Plan**       | Curriculum per Role, UAT Training                                | Gap 9 ✅  | `00-06-training-plan.md`                |
| **Edge Cases & Rules**  | 37 Edge Cases, Business Logic Guards                             | Gap 10 ✅ | `01-06-edge-cases-and-rules.md`         |
| **Schema v1.8.0**       | Tables, Views, Indexes (3-file split)                            | —         | `lcbp3-v1.8.0-schema-*.sql`             |
| **Data Dictionary**     | Field Meanings, Business Rules                                   | —         | `03-01-data-dictionary.md`              |
| **ADRs (22)**           | All Architecture Decisions incl. ADR-003/004/007/018/019/020/021 | -         | `06-Decision-Records/`                  |

---

#### Complete Specifications File Listing

**00-Overview/ - Project Overview & Vision (7 files)**
| File | Description |
| ---- | ----------- |
| `00-01-quick-start.md` | Quick start guide for the project |
| `00-02-glossary.md` | Technical terminology and domain vocabulary |
| `00-03-product-vision.md` | **Gap 1** - Product Vision, Strategic Pillars, Guardrails |
| `00-04-stakeholder-signoff-and-risk.md` | **Gap 5** - Stakeholder Sign-off, Risk Register |
| `00-05-kpi-baseline.md` | **Gap 6** - 14 KPIs, SQL Queries, Grafana Specs |
| `00-06-training-plan.md` | **Gap 9** - Training Curriculum per Role |
| `README.md` | Overview section index |

**01-Requirements/ - System Requirements (23 files)**
| File | Description |
| ---- | ----------- |
| `01-01-objectives.md` | Project objectives and goals |
| `01-02-business-rules/` | Business Rules (5 files) |
| `01-02-01-rbac-matrix.md` | RBAC 4-Level permission matrix |
| `01-02-02-doc-numbering-rules.md` | Document numbering business rules |
| `01-02-03-ui-ux-rules.md` | UI/UX design rules and guidelines |
| `01-02-04-non-functional-rules.md` | Non-functional requirements |
| `01-02-05-testing-rules.md` | Testing requirements and rules |
| `01-03-modules/` | Feature Modules (11 files) |
| `01-03-00-index.md` | Modules overview index |
| `01-03-01-project-management.md` | Project & Contract management |
| `01-03-02-correspondence.md` | Correspondence management |
| `01-03-02a-correspondence-rfa-unified-ux-flow.md` | Correspondence-RFA unified UX flow |
| `01-03-03-rfa.md` | Request for Approval (RFA) |
| `01-03-04-contract-drawing.md` | Contract drawing management |
| `01-03-05-shop-drawing.md` | Shop drawing management |
| `01-03-06-unified-workflow.md` | Unified workflow engine |
| `01-03-07-transmittals.md` | Transmittal management |
| `01-03-08-circulation-sheet.md` | Circulation sheet management |
| `01-03-09-logs.md` | System logs and audit trails |
| `01-03-10-json-details.md` | JSON schema details |
| `01-04-user-stories.md` | **Gap 2** - 27 User Stories, 8 Epics, MoSCoW |
| `01-05-acceptance-criteria.md` | **Gap 3** - UAT Acceptance Criteria |
| `01-06-edge-cases-and-rules.md` | **Gap 10** - 37 Edge Cases, Business Logic |
| `01-07-ui-wireframes.md` | **Gap 4** - 26 Screens, ASCII Wireframes |
| `README.md` | Requirements section index |

**02-Architecture/ - System Architecture (5 files)**
| File | Description |
| ---- | ----------- |
| `02-01-system-context.md` | System context and boundaries |
| `02-02-software-architecture.md` | Software architecture patterns |
| `02-03-network-design.md` | Network design and topology |
| `02-04-api-design.md` | API design principles |
| `README.md` | Architecture section index |

**03-Data-and-Storage/ - Database & Storage (31 files)**
| File | Description |
| ---- | ----------- |
| `0.md` | Data and storage overview |
| `03-01-data-dictionary.md` | Field meanings, business rules |
| `03-02-db-indexing.md` | Database indexing strategy |
| `03-03-file-storage.md` | File storage architecture |
| `03-04-legacy-data-migration.md` | Legacy data migration plan |
| `03-05-n8n-migration-setup-guide.md` | n8n migration setup guide |
| `03-06-migration-business-scope.md` | **Gap 7** - Migration Business Scope |
| `03-07-OpenRAG.md` | OpenRAG integration |
| `lcbp3-v1.8.0-schema-*.sql` | Schema files (3 files: drop, tables, views-indexes) |
| `lcbp3-v1.8.0-seed-*.sql` | Seed data files (2 files: basic, permissions) |
| `deltas/` | Schema delta files (3 files) |
| `*.sql` | Additional SQL files (22 files) |

**04-Infrastructure-OPS/ - Infrastructure & Operations (21 files)**
| File | Description |
| ---- | ----------- |
| `04-01-docker-compose.md` | Docker Compose configuration |
| `04-02-backup-recovery.md` | Backup and recovery procedures |
| `04-03-monitoring.md` | System monitoring setup |
| `04-04-deployment-guide.md` | Deployment procedures |
| `04-05-security-operations.md` | Security operations guide |
| `04-06-disaster-recovery.md` | Disaster recovery plan |
| `04-07-incident-response.md` | Incident response procedures |
| `04-08-release-management-policy.md` | **Gap 8** - Release Management Policy |
| `04-09-performance-monitoring.md` | Performance monitoring |
| `04-10-capacity-planning.md` | Capacity planning guide |
| `04-11-maintenance-windows.md` | Maintenance windows |
| `04-12-service-level-agreement.md` | SLA definitions |
| `04-13-change-management.md` | Change management process |
| `04-14-configuration-management.md` | Configuration management |
| `04-15-logging-strategy.md` | Logging strategy |
| `04-16-alerting.md` | Alerting setup |
| `04-17-scaling-strategy.md` | Scaling strategy |
| `04-18-cost-optimization.md` | Cost optimization |
| `04-19-compliance.md` | Compliance requirements |
| `04-20-documentation-maintenance.md` | Documentation maintenance |
| `README.md` | Infrastructure section index |

**05-Engineering-Guidelines/ - Development Standards (10 files)**
| File | Description |
| ---- | ----------- |
| `05-01-fullstack-js-guidelines.md` | Fullstack JavaScript guidelines |
| `05-02-backend-guidelines.md` | Backend development guidelines |
| `05-03-frontend-guidelines.md` | Frontend development guidelines |
| `05-04-testing-strategy.md` | Testing strategy and procedures |
| `05-05-git-conventions.md` | Git workflow conventions |
| `05-06-code-snippets.md` | Code snippet patterns |
| `05-07-hybrid-uuid-implementation-plan.md` | UUID implementation plan (ADR-019) |
| `05-08-i18n-guidelines.md` | Internationalization guidelines |
| `05-09-performance-guidelines.md` | Performance guidelines |
| `README.md` | Engineering guidelines index |

**06-Decision-Records/ - Architecture Decisions (26 files)**
| File | Description |
| ---- | ----------- |
| `ADR-001-unified-workflow-engine.md` | Unified Workflow Engine |
| `ADR-002-document-numbering-strategy.md` | Document Numbering Strategy |
| `ADR-003-api-design-strategy.md` | API Design Strategy |
| `ADR-004-database-schema-design-strategy.md` | Database Schema Design |
| `ADR-005-security-strategy.md` | Security Strategy |
| `ADR-006-frontend-architecture.md` | Frontend Architecture |
| `ADR-007-error-handling-strategy.md` | Error Handling Strategy |
| `ADR-008-email-notification-strategy.md` | Email Notification Strategy |
| `ADR-009-database-migration-strategy.md` | Database Migration Strategy |
| `ADR-010-cache-strategy.md` | Cache Strategy |
| `ADR-011-testing-strategy.md` | Testing Strategy |
| `ADR-012-logging-strategy.md` | Logging Strategy |
| `ADR-013-monitoring-strategy.md` | Monitoring Strategy |
| `ADR-014-deployment-strategy.md` | Deployment Strategy |
| `ADR-015-performance-strategy.md` | Performance Strategy |
| `ADR-016-security-authentication.md` | Security Authentication |
| `ADR-017-ollama-data-migration.md` | Ollama Data Migration |
| `ADR-017B-ai-document-classification.md` | AI Document Classification |
| `ADR-018-ai-boundary.md` | AI Boundary Policy |
| `ADR-019-hybrid-identifier-strategy.md` | Hybrid Identifier Strategy |
| `ADR-020-ai-intelligence-integration.md` | AI Intelligence Integration |
| `ADR-021-workflow-context.md` | **Integrated Workflow Context** |
| `README.md` | ADR registry index |

**08-Tasks/ - Task Documentation (12 files)**
| File | Description |
| ---- | ----------- |
| `Task BE-AI-01.md` | Backend AI Task 01 |
| `Task BE-API-01.md` | Backend API Task 01 |
| `Task BE-DB-01.md` | Backend Database Task 01 |
| `Task BE-ERR-01.md` | Backend Error Handling Task 01 |
| `ADR-021-workflow-context/` | ADR-021 Implementation (4 files) |
| `contracts/` | Contract tasks |
| `data-model.md` | Data model documentation |
| `plan.md` | Implementation plan |
| `quickstart.md` | Quick start guide |
| `README.md` | Tasks section index |

**001-Transmittals-Circulation/ - Feature Specification (3 files)**
| File | Description |
| ---- | ----------- |
| `plan.md` | Transmittals & Circulation implementation plan |
| `spec.md` | Feature specification |
| `tasks.md` | Task breakdown |

**88-logs/ - Project Logs (1 file)**
| File | Description |
| ---- | ----------- |
| `CI-error.md` | CI/CD error logs |

**99-archives/ - Archived Documentation (308 files)**
| File | Description |
| ---- | ----------- |
| `docs/` | Archived documentation |
| `history/` | Project history |
| `skills-backup/` | Skills backup |
| `tasks/` | Archived tasks |

**feat/ - Feature Development (1 folder)**
| Folder | Description |
| ------ | ----------- |
| `adr-021-integrated-workflow-context/` | ADR-021 feature development |

**Root Level Files**
| File | Description |
| ---- | ----------- |
| `README.md` | Specifications main index |

---

### Schema & Seed Data (v1.8.0)

```bash
# Schema 3 files (ADR-009: No TypeORM Migrations)
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-01-drop.sql
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-03-views-indexes.sql

# Seed Data
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-basic.sql
mysql -u root -p lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-permissions.sql
```

### Legacy Documentation

เอกสารเก่าอยู่ใน `docs/` folder

---

## 🔧 Development Guidelines

### Coding Standards

#### ภาษาที่ใช้

- **Code**: ภาษาอังกฤษ (English)
- **Comments & Documentation**: ภาษาไทย (Thai)

#### TypeScript Rules

```typescript
// ✅ ถูกต้อง
interface User {
  user_id: number; // Property: snake_case
  firstName: string; // Variable: camelCase
  isActive: boolean; // Boolean: Verb + Noun
}

// ❌ ผิด
interface User {
  userId: number; // ไม่ใช้ camelCase สำหรับ property
  first_name: string; // ไม่ใช้ snake_case สำหรับ variable
  active: boolean; // ไม่ใช้ Verb + Noun
}
```

#### File Naming

```
user-service.ts          ✅ kebab-case
UserService.ts           ❌ PascalCase
user_service.ts          ❌ snake_case
```

### Git Workflow

```bash
# สร้าง feature branch
git checkout -b feature/correspondence-module

# Commit message format
git commit -m "feat(correspondence): add create correspondence endpoint"

# Types: feat, fix, docs, style, refactor, test, chore
```

### Testing

```bash
# Backend
cd backend
pnpm test              # Unit tests
pnpm test:e2e         # E2E tests
pnpm test:cov         # Coverage

# Frontend
cd frontend
pnpm test             # Unit tests
pnpm test:e2e         # Playwright E2E
```

---

## 🔐 Security

### Security Features

- ✅ **JWT Authentication** - Access & Refresh Tokens (separate `AUTH_SECRET`)
- ✅ **RBAC 4-Level** - Global, Organization, Project, Contract
- ✅ **Rate Limiting** - ป้องกัน Brute-force
- ✅ **Virus Scanning** - ClamAV สำหรับไฟล์ที่อัปโหลด (mandatory)
- ✅ **Input Validation** - ป้องกัน SQL Injection, XSS, CSRF
- ✅ **Idempotency** - ป้องกันการทำรายการซ้ำ
- ✅ **Audit Logging** - บันทึกการกระทำทั้งหมด
- ✅ **Container Hardening (v1.8.9)** - `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, non-root `user:`, pinned image tags, MongoDB + Registry auth

### Security Best Practices

1. **ห้ามเก็บ Secrets ใน Git**
   - ใช้ `.env` สำหรับ Development
   - ใช้ `docker-compose.override.yml` (gitignored)

2. **Password Policy**
   - ความยาวขั้นต่ำ: 8 ตัวอักษร
   - ต้องมี uppercase, lowercase, number, special character
   - เปลี่ยน password ทุก 90 วัน

3. **File Upload**
   - White-list file types: PDF, DWG, DOCX, XLSX, ZIP
   - Max size: 50MB
   - Virus scan ทุกไฟล์

---

## 🧪 Testing Strategy

### Test Pyramid

```
       /\
      /  \     E2E Tests (10%)
     /____\
    /      \   Integration Tests (20%)
   /________\
  /          \ Unit Tests (70%)
 /____________\
```

### Coverage Goals

- **Backend**: 70%+ overall
  - Business Logic: 80%+
  - Controllers: 70%+
  - Utilities: 90%+
- **Frontend**: 60%+ overall

---

## 📊 Monitoring & Observability

### Health Checks

```bash
# Backend health
curl http://localhost:3001/health

# Database health
curl http://localhost:3001/health/db

# Redis health
curl http://localhost:3001/health/redis
```

### Metrics

- API Response Time
- Error Rates
- Cache Hit Ratio
- Database Connection Pool
- File Upload Performance

---

## 🚢 Deployment

### Production Deployment

```bash
# Build backend
cd backend
pnpm run build

# Build frontend
cd frontend
pnpm run build

# Deploy with Docker Compose
docker-compose -f docker-compose.yml up -d
```

### Environment-specific Configs

- **Development**: `.env`, `docker-compose.override.yml`
- **Staging**: Environment variables ใน Container Station
- **Production**: Docker secrets หรือ Vault

---

## 🤝 Contributing

กรุณาอ่าน [CONTRIBUTING.md](./CONTRIBUTING.md) สำหรับรายละเอียดเกี่ยวกับ:

- Code of Conduct
- Development Process
- Pull Request Process
- Coding Standards
- **AI-Assisted Contributions** (AGENTS.md + `.agents/skills/` skill pack + Windsurf slash commands)

### 🤖 For AI Agents (Windsurf Cascade, Codex CLI, opencode, Amp, Antigravity)

ไฟล์กลางสำหรับ AI assistants:

| Priority | File                                                                     | Purpose                                                                                       |
| -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1        | [`AGENTS.md`](./AGENTS.md)                                               | Quick-reference rules (Tier 1/2/3 enforcement, ADR-019 March 2026 pattern, forbidden actions) |
| 2        | [`.agents/skills/_LCBP3-CONTEXT.md`](./.agents/skills/_LCBP3-CONTEXT.md) | Shared context appendix injected into every speckit-\* skill                                  |
| 3        | [`.agents/skills/README.md`](./.agents/skills/README.md)                 | Skill-pack layout + slash-command invocation guide                                            |
| 4        | `specs/06-Decision-Records/`                                             | 22 ADRs (architectural decisions)                                                             |

**Slash commands:** `/02-speckit.specify` → `/04-speckit.plan` → `/05-speckit.tasks` → `/07-speckit.implement` → `/10-speckit.reviewer` → `/12-speckit.security-audit`

**Health checks:** `bash ./.agents/scripts/bash/audit-skills.sh` or `pwsh ./.agents/scripts/powershell/audit-skills.ps1`

---

## 📝 License

This project is **Internal Use Only** - ลิขสิทธิ์เป็นของโครงการ LCBP3

---

## 👥 Team

- **Project Manager**: [์Nattanin Peancharoen]
- **Tech Lead**: [Nattanin Peancharoen]
- **Backend Team**: [Nattanin Peancharoen]
- **Frontend Team**: [Nattanin Peancharoen]

---

## 📞 Support

สำหรับคำถามหรือปัญหา กรุณาติดต่อ:

- **Email**: <support@np-dms.work>
- **Internal Chat**: [ระบุช่องทาง]
- **Issue Tracker**: [Gitea Issues](https://git.np-dms.work/lcbp3/lcbp3-dms/issues)

---

## 🗺️ Roadmap

### ✅ Version 1.8.9 (Apr 2026) — Infrastructure Hardening + Agent Skill Pack Rebuild

**Agent skill pack rebuilt (`.agents/skills/` @ v1.8.9) — 2026-04-22:**

- ✅ 20 skills standardized (2 best-practices + 18 speckit-\*) — shared `_LCBP3-CONTEXT.md` appendix
- ✅ ADR-019 drift removed: `publicId` exposed directly (no `@Expose({ name: 'id' })` rename); `id ?? ''` fallback eliminated
- ✅ Dead references cleaned: `GEMINI.md` → `AGENTS.md`; `.specify/memory/` → `AGENTS.md`; `v1.7.0` → `v1.8.0` schema
- ✅ New rules: workflow-engine (ADR-001/002/021), file-two-phase-upload (ADR-016), ai-boundary (ADR-018/020), no-typeorm-migrations (ADR-009), i18n, two-phase-upload (frontend)
- ✅ `.windsurf/workflows/` path fixes (18 files) + 2 new wrappers (`12-speckit.security-audit`, `util-speckit.taskstoissues`)
- ✅ `specs/03-Data-and-Storage/deltas/` directory bootstrapped (ADR-009 incremental SQL)
- ✅ Regenerated `nestjs-best-practices/AGENTS.md` (188KB, 45 rules × 11 categories incl. LCBP3 project-specific)
- ✅ Helper scripts fixed (bash + pwsh): BASE_DIR, CRLF, color enum, version extraction

**Docker Compose stacks fully hardened — 27 findings across 4 phases:**

- ✅ **Phase 1 (C1–C6 + H6):** Secrets extracted to `env_file`; JWT_SECRET/AUTH_SECRET split; Redis `--requirepass`; Elasticsearch internal-only; MariaDB root/app user split; ClamAV service added; filename typo fixed
- ✅ **Phase 2 (H1–H5, H7):** n8n docker-socket-proxy (read-only); ASUSTOR cAdvisor port fix; QNAP exporters expose-only; all `:latest` tags pinned to verified semver
- ✅ **Phase 3 (M1–M9):** Healthchecks + resource limits on all services; backend/frontend `read_only` + `cap_drop: [ALL]` + non-root `user`; MongoDB `--auth --keyFile`; Registry htpasswd auth; phpMyAdmin via NPM only
- ✅ **Phase 4 (L1–L5 + S1–S4):** Removed `stdin_open`/`tty` from production services; trimmed legacy comments; shared `x-base.yml` anchors; per-stack `.env.example`; secret-manager roadmap (Swarm / Infisical / SOPS)

**New files:** `specs/04-Infrastructure-OPS/04-00-docker-compose/README.md`, `SECURITY-MIGRATION-v1.8.6.md`, `x-base.yml`, 9 per-stack `.env.example` files.

### ✅ Version 1.8.7 (Apr 2026) — ADR-021 Integration Complete

- ✅ ADR-021 (Integrated Workflow Context) — Transmittals & Circulation workflow integration
- ✅ IntegratedBanner + WorkflowLifecycle components for real-time workflow status
- ✅ EC-RFA-004, EC-CIRC-001, EC-CIRC-002 workflow validations implemented
- ✅ 19/19 tests passing for new workflow features
- ✅ **Total: 22 ADRs** ครอบคลุมทุก Architectural Decision (ADR-001~021 + ADR-017B)

### ✅ Version 1.8.5 (Apr 2026) — ADR Documentation Complete

- ✅ ADR-003 (API Design Strategy) — Hybrid REST + Action Pattern registered
- ✅ ADR-004 (Database Schema Design Strategy) — Selective Normalization registered
- ✅ ADR-007 (Error Handling & Recovery) — Layered Classification registered
- ✅ ADR-020 (AI Intelligence Integration) — Unified AI Pipeline proposed
- ✅ **Total: 21 ADRs** ครอบคลุมทุก Architectural Decision (ADR-001~020 + ADR-017B)

### ✅ Version 1.8.0 (Feb 2026) — Schema & Type Safety

- ✅ Schema v1.8.0 (3-file split + ADR-009 No-Migration Policy)
- ✅ Purge ทุก `any` type จาก Frontend (Strict TypeScript)
- ✅ Specs restructure เป็น 7 canonical layers
- ✅ 17 ADRs ครอบคลุมทุก Architectural Decision

### ✅ Version 1.8.1 Patch (Mar 2026) — Product Owner Documentation & Security Hardening

**10/10 Documentation Gaps Closed + 52 Security Vulnerabilities Fixed:**

| Gap | เอกสาร                                     | สถานะ |
| --- | ------------------------------------------ | ----- |
| 1   | Product Vision Statement                   | ✅    |
| 2   | User Stories (27 Stories, 8 Epics)         | ✅    |
| 3   | Acceptance Criteria & UAT Plan             | ✅    |
| 4   | UI/UX Wireframes (26 Screens)              | ✅    |
| 5   | Stakeholder Sign-off & Risk Register       | ✅    |
| 6   | KPI Baseline Data (14 KPIs)                | ✅    |
| 7   | Migration Business Scope (20K Docs)        | ✅    |
| 8   | Release Management Policy (SemVer + Gates) | ✅    |
| 9   | Training Plan (per Role, 4 phases)         | ✅    |
| 10  | Edge Cases & Business Rules (37 rules)     | ✅    |

**Security Hardening (2026-03-19):**

- ✅ All 52 vulnerabilities resolved (27 high + 20 moderate + 5 low)
- ✅ Major package updates: Elasticsearch 9.3.4, Nodemailer 8.0.3, UUID 13.0.0
- ✅ Security overrides applied via `pnpm audit --fix`
- ✅ Current status: "No known vulnerabilities found"

- ✅ ADR-018: AI Boundary (Ollama Isolation มี No Direct DB/Storage Access)
- ✅ ADR-019: Hybrid Identifier Strategy (INT PK + UUIDv7 Public API)
- ✅ Migration n8n Workflow + AI Isolation Plan

### ✅ NestJS 11 + Next.js 16 Migration (Mar 2026)

- ✅ Backend upgraded to **NestJS 11** (Express v5, `@nestjs/*` v11)
- ✅ Shared `RequestWithUser` typed interface (replaced `req: any` across 6 controllers)
- ✅ Frontend upgraded to **Next.js 16** (React 19)
- ✅ Renamed `middleware.ts` → `proxy.ts` (Next.js 16 convention)
- ✅ ADR-019 UUID fixes: Drawing admin pages (5), Contracts, Disciplines, Tags, RFA Types
- ✅ Fixed contract edit form (UUID mismatch), disciplines dropdown (hardcoded projectId), tags crash (empty Select value)

### 🔄 ADR-019 Hybrid UUID Migration (Mar 2026)

- ✅ **Phase 1-4**: Schema, entities, API layer — all 14 tables migrated
- ✅ **Phase 5 (Partial)**: Frontend routes, services, hooks migrated to UUID
- ✅ Drawing search: `projectUuid` sent to backend, resolved in controller
- ✅ Drawing detail page: mock API replaced with real UUID-based services
- 🔄 **Phase 5.4 (Pending)**: FK reference UUID migration — `correspondences/form.tsx`, `user-dialog.tsx`, `numbering/template-tester.tsx`, `rfas/page.tsx` still use `parseInt()` on UUID values (see `specs/05-Engineering-Guidelines/05-07-hybrid-uuid-implementation-plan.md`)
- 📋 **Phase 6**: Unit + integration tests for UUID-based routes

### 🔄 Next: Go-Live Preparation

- 🔄 **UAT**: ทำ User Acceptance Testing ตาม `01-05-acceptance-criteria.md`
- 🔄 **KPI Baseline Collection**: เก็บ As-Is Metrics ก่อน Go-Live
- 🔄 **Legacy Migration**: เริ่ม Tier 1 (2,000 เอกสาร Critical) T-3 สัปดาห์
- 🔄 **Security Audit**: ตาม `04-06-security-operations.md`
- 📋 **Go-Live**: Blue-Green Deploy บน QNAP Container Station

### 📅 Version 1.9.0+ (Planned — Post Go-Live)

- 📊 Advanced Reporting & Grafana KPI Dashboards (ตาม `00-05-kpi-baseline.md`)
- 🔔 Real-time Notifications (WebSocket)
- 🔍 Queue-based Elasticsearch Indexing (BullMQ)
- 🚀 Performance Optimization & Caching Strategy
- 📱 Mobile App (React Native) — Phase 3 Vision

---

## 📖 Additional Resources

### API Documentation

- Swagger UI: `http://localhost:3001/api`
- Postman Collection: [ดาวน์โหลด](./docs/postman/)

### Architecture Diagrams

- [System Architecture](./diagrams/system-architecture.md)
- [Database ERD](./diagrams/database-erd.md)
- [Workflow Engine](./diagrams/workflow-engine.md)

### Learning Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeORM Documentation](https://typeorm.io/)

---

<div align="center">

**Built with ❤️ for LCBP3 Project**

[Documentation](./docs) • [Issues](https://git.np-dms.work/lcbp3/lcbp3-dms/issues) • [Changelog](./CHANGELOG.md)

</div>
