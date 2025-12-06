# 📋 LCBP3-DMS - Document Management System

> **Laem Chabang Port Phase 3 - Document Management System**
>
> ระบบบริหารจัดการเอกสารโครงการแบบครบวงจร สำหรับโครงการก่อสร้างท่าเรือแหลมฉบังระยะที่ 3

[![Version](https://img.shields.io/badge/version-1.5.1-blue.svg)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/license-Internal-red.svg)]()
[![Status](https://img.shields.io/badge/status-Active%20Development-green.svg)]()

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

---

## 🏗️ สถาปัตยกรรมระบบ

### Technology Stack

#### Backend (NestJS)

```typescript
{
  "framework": "NestJS (TypeScript, ESM)",
  "database": "MariaDB 11.8",
  "orm": "TypeORM",
  "authentication": "JWT + Passport",
  "authorization": "CASL (RBAC)",
  "search": "Elasticsearch",
  "cache": "Redis",
  "queue": "BullMQ",
  "fileUpload": "Multer + ClamAV",
  "notification": "Nodemailer + n8n (LINE)",
  "documentation": "Swagger"
}
```

#### Frontend (Next.js)

```typescript
{
  "framework": "Next.js 14+ (App Router)",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "components": "shadcn/ui",
  "stateManagement": {
    "server": "TanStack Query (React Query)",
    "forms": "React Hook Form + Zod",
    "ui": "useState/useReducer"
  },
  "testing": "Vitest + Playwright"
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
# Import schema
mysql -u root -p lcbp3_dev < docs/8_lcbp3_v1_4_5.sql

# Import seed data
mysql -u root -p lcbp3_dev < docs/8_lcbp3_v1_4_5_seed.sql
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
├── backend/                 # NestJS Backend
│   ├── src/
│   │   ├── common/         # Shared modules
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/
│   │   │   ├── user/
│   │   │   ├── project/
│   │   │   ├── correspondence/
│   │   │   ├── rfa/
│   │   │   ├── drawing/
│   │   │   ├── workflow-engine/
│   │   │   └── ...
│   │   └── main.ts
│   ├── test/
│   └── package.json
│
├── frontend/               # Next.js Frontend
│   ├── app/               # App Router
│   ├── components/        # React Components
│   ├── lib/              # Utilities
│   └── package.json
│
├── docs/                  # 📚 Legacy documentation
│   └── ...
│
├── specs/                 # 📘 Project Specifications (v1.5.1)
│   ├── 00-overview/       # Project overview & glossary
│   ├── 01-requirements/   # Functional requirements
│   ├── 02-architecture/   # System architecture & ADRs
│   ├── 03-implementation/ # Implementation guidelines
│   ├── 04-operations/     # Deployment & operations
│   ├── 05-decisions/      # Architecture Decision Records
│   ├── 06-tasks/          # Active tasks
│   ├── 07-database/       # Database schema & seed data
│   └── 09-history/        # Implementation history
│
├── infrastructure/        # Docker & Deployment
│   └── Markdown/         # Legacy docs
│
└── pnpm-workspace.yaml
```

---

## 📚 เอกสารประกอบ

### เอกสารหลัก (specs/ folder)

| เอกสาร             | คำอธิบาย                         | โฟลเดอร์                    |
| ------------------ | ------------------------------ | -------------------------- |
| **Overview**       | ภาพรวมโครงการ, Glossary        | `specs/00-overview/`       |
| **Requirements**   | ข้อกำหนดระบบและฟังก์ชันการทำงาน      | `specs/01-requirements/`   |
| **Architecture**   | สถาปัตยกรรมระบบ, ADRs           | `specs/02-architecture/`   |
| **Implementation** | แนวทางการพัฒนา Backend/Frontend | `specs/03-implementation/` |
| **Database**       | Schema v1.5.1 + Seed Data      | `specs/07-database/`       |

### Schema & Seed Data

```bash
# Import schema
mysql -u root -p lcbp3_dev < specs/07-database/lcbp3-v1.5.1-schema.sql

# Import seed data
mysql -u root -p lcbp3_dev < specs/07-database/lcbp3-v1.5.1-seed.sql
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

### Version 1.5.1 (Current - Dec 2025)

- ✅ Core Infrastructure
- ✅ Authentication & Authorization (JWT + CASL RBAC)
- ✅ **CASL RBAC 4-Level** - Global, Org, Project, Contract
- ✅ **Workflow DSL Parser** - Zod validation & state machine
- ✅ Correspondence Module (Master-Revision Pattern)
- ✅ **Document Number Audit** - Compliance tracking
- ✅ **All Token Types** - Including {RECIPIENT}
- 🔄 RFA Module
- 🔄 Drawing Module
- ✅ Swagger API Documentation

### Version 1.6.0 (Planned)

- 📋 Advanced Reporting
- 📊 Dashboard Analytics
- 🔔 Enhanced Notifications (LINE/Email)
- 🔄 E2E Tests for Critical APIs
- 📈 Prometheus Metrics

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
