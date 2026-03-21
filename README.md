# 📋 LCBP3-DMS - Document Management System

> **Laem Chabang Port Phase 3 - Document Management System**
> ระบบบริหารจัดการเอกสารโครงการแบบครบวงจร สำหรับโครงการก่อสร้างท่าเรือแหลมฉบังระยะที่ 3

[![Version](https://img.shields.io/badge/version-1.8.1-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Internal-red.svg)]()
[![Status](https://img.shields.io/badge/status-UAT%20Ready-brightgreen.svg)]()
[![Docs](https://img.shields.io/badge/docs-10%2F10%20Gaps%20Closed-success.svg)](./specs/00-Overview/README.md)

---

## 📈 Current Status (As of 2026-03-21)

**Version 1.8.1 (Patch) — UAT Ready, Security Hardened**

| Area                 | Status                   | หมายเหตุ                                 |
| -------------------- | ------------------------ | ---------------------------------------- |
| 🔧 **Backend**       | ✅ Production Ready      | NestJS 11, Express v5, 0 Vulnerabilities |
| 🎨 **Frontend**      | ✅ 100% Complete         | Next.js 16.2.0, React 19.2.4, ESLint 9   |
| 💾 **Database**      | ✅ Schema v1.8.0 Stable  | MariaDB 11.8, No-migration Policy        |
| 📘 **Documentation** | ✅ **10/10 Gaps Closed** | Product Vision → Release Policy          |
| 🤖 **AI Migration**  | 🔄 Pre-migration Setup   | n8n + Ollama (ADR-017/018)               |
| 🧪 **Testing**       | 🔄 UAT Preparation       | E2E + Acceptance Criteria ready          |
| 🚀 **Deployment**    | 📋 Pending Go-Live Gate  | Blue-Green on QNAP Container Station     |

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
- 🔄 **Workflow Engine** - DSL-based workflow สำหรับกระบวนการอนุมัติ
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

- **Node.js**: v20.x หรือสูงกว่า
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
│   └── package.json
│
├── specs/                      # 📘 Project Specifications v1.8.1 — 10/10 Gaps Closed
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
│   ├── 06-Decision-Records/    # 17+1 ADRs รวม ADR-018-ai-boundary
│   └── 99-archives/            # ประวัติการทำงานและ Tasks เก่า
│
├── docs/                       # 📚 Legacy documentation
├── infrastructure/             # 🐳 Docker & Deployment configs
│
├── .gemini/                    # 🤖 AI agent configuration
├── .agents/                    # Agent workflows and tools
├── AGENTS.md                   # AI agent rules & project context
├── GEMINI.md                   # AI coding guidelines
├── CONTRIBUTING.md             # Contribution guidelines
├── CHANGELOG.md                # Version history
└── pnpm-workspace.yaml         # Monorepo configuration
```

---

## 📚 เอกสารประกอบ

### เอกสารหลัก (specs/ folder)

| เอกสาร                  | คำอธิบาย                                     | Gap       | ไฟล์หลัก                                |
| ----------------------- | -------------------------------------------- | --------- | --------------------------------------- |
| **Product Vision**      | Vision, Strategic Pillars, Guardrails        | Gap 1 ✅  | `00-03-product-vision.md`               |
| **User Stories**        | 27 Stories, 8 Epics, MoSCoW                  | Gap 2 ✅  | `01-04-user-stories.md`                 |
| **Acceptance Criteria** | UAT Criteria, Sign-off Process               | Gap 3 ✅  | `01-05-acceptance-criteria.md`          |
| **UI/UX Wireframes**    | 26 Screens, ASCII Wireframes, Design System  | Gap 4 ✅  | `01-07-ui-wireframes.md`                |
| **Stakeholder & Risk**  | Sign-off, Risk Register, Change Control      | Gap 5 ✅  | `00-04-stakeholder-signoff-and-risk.md` |
| **KPI Baseline**        | 14 KPIs, SQL Queries, Grafana Specs          | Gap 6 ✅  | `00-05-kpi-baseline.md`                 |
| **Migration Scope**     | 20K Docs, 3 Tiers, Go/No-Go Gates            | Gap 7 ✅  | `03-06-migration-business-scope.md`     |
| **Release Policy**      | SemVer, 5 Gates, Hotfix, Rollback            | Gap 8 ✅  | `04-08-release-management-policy.md`    |
| **Training Plan**       | Curriculum per Role, UAT Training            | Gap 9 ✅  | `00-06-training-plan.md`                |
| **Edge Cases & Rules**  | 37 Edge Cases, Business Logic Guards         | Gap 10 ✅ | `01-06-edge-cases-and-rules.md`         |
| **Schema v1.8.0**       | Tables, Views, Indexes (3-file split)        | —         | `lcbp3-v1.8.0-schema-*.sql`             |
| **Data Dictionary**     | Field Meanings, Business Rules               | —         | `03-01-data-dictionary.md`              |
| **ADRs (17+2)**         | All Architecture Decisions incl. ADR-018/019 | —         | `06-Decision-Records/`                  |

### Schema & Seed Data (v1.8.0)

```bash
# Schema แบ่งเป็น 3 ไฟล์ (ADR-009: ไม่มี TypeORM Migrations)
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

- ✅ **JWT Authentication** - Access & Refresh Tokens
- ✅ **RBAC 4-Level** - Global, Organization, Project, Contract
- ✅ **Rate Limiting** - ป้องกัน Brute-force
- ✅ **Virus Scanning** - ClamAV สำหรับไฟล์ที่อัปโหลด
- ✅ **Input Validation** - ป้องกัน SQL Injection, XSS, CSRF
- ✅ **Idempotency** - ป้องกันการทำรายการซ้ำ
- ✅ **Audit Logging** - บันทึกการกระทำทั้งหมด

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
