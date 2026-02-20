# LCBP3-DMS - Project Overview

**Project Name:** Laem Chabang Port Phase 3 - Document Management System (LCBP3-DMS)
**Version:** 1.8.0
**Status:** Active Development (~95% Complete)
**Last Updated:** 2026-02-20

---

## 📋 Table of Contents

- [Project Introduction](#-project-introduction)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Quick Links](#-quick-links)
- [Getting Started](#-getting-started)
- [Team & Stakeholders](#-team--stakeholders)

---

## 🎯 Project Introduction

LCBP3-DMS is a comprehensive Document Management System (DMS) designed specifically for the Laem Chabang Port Phase 3 construction project. The system manages construction documents, workflows, approvals, and communications between multiple organizations including port authority, consultants, contractors, and third parties.

### Project Objectives

1. **Centralize Document Management** - Single source of truth for all project documents
2. **Streamline Workflows** - Automated routing and approval processes
3. **Improve Collaboration** - Real-time access for all stakeholders
4. **Ensure Compliance** - Audit trails and document version control
5. **Enhance Efficiency** - Reduce paper-based processes and manual routing

### Project Scope

**In Scope:**

- Correspondence Management (Letters & Communications)
- RFA (Request for Approval) Management
- Drawing Management (Contract & Shop Drawings)
- Workflow Engine (Approvals & Routing)
- Document Numbering System
- File Storage & Management
- Search & Reporting
- User & Access Management
- Audit Logs & Notifications

**Out of Scope:**

- Financial Management & Billing
- Procurement & Material Management
- Project Scheduling (Gantt Charts)
- HR & Payroll Systems
- Mobile App (Phase 1 only)

---

## ✨ Key Features

### 📨 Correspondence Management

- Create, review, and track official letters
- Master-Revision pattern for version control
- Multi-level approval workflows
- Attachment management
- Automatic document numbering

### 📋 RFA Management

- Submit requests for approval
- Item-based RFA structure
- Response tracking (Approved/Approved with Comments/Rejected)
- Revision management
- Integration with workflow engine

### 📐 Drawing Management

- Contract Drawings (แบบคู่สัญญา)
- Shop Drawings (แบบก่อสร้าง) with revisions
- Version control & comparison
- Drawing linking and references

### ⚙️ Workflow Engine

- DSL-based workflow configuration
- Dynamic routing based on rules
- Parallel & sequential approvals
- Escalation & timeout handling
- Workflow history & audit trail

### 🗄️ Document Numbering

- Automatic number generation
- Template-based formatting
- Discipline-specific numbering
- Concurrent request handling (Double-lock mechanism)
- Annual reset support

### 🔍 Search & Discovery

- Full-text search (Elasticsearch)
- Advanced filtering
- Document metadata search
- Quick access to recent documents

### 🔐 Security & Access Control

- 4-Level Hierarchical RBAC (Global/Organization/Project/Contract)
- JWT-based authentication
- Permission-based access control
- Audit logging
- Session management

### 📧 Notifications

- Multi-channel (Email, LINE Notify, In-app)
- Workflow event notifications
- Customizable user preferences
- Async delivery (Queue-based)

---

## 🛠️ Technology Stack

### Backend

- **Framework:** NestJS (TypeScript)
- **Database:** MariaDB 11.8
- **Cache & Queue:** Redis 7.2
- **Search:** Elasticsearch 8.11
- **ORM:** TypeORM
- **Authentication:** JWT (JSON Web Tokens)
- **Authorization:** CASL (4-Level RBAC)
- **File Processing:** ClamAV (Virus Scanning)
- **Queue:** BullMQ

### Frontend

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn/UI
- **Server State:** TanStack Query
- **Client State:** Zustand
- **Form State:** React Hook Form + Zod
- **API Client:** Axios

### Infrastructure

- **Deployment:** Docker & Docker Compose
- **Platform:** QNAP Container Station
- **Reverse Proxy:** NGINX
- **Logging:** Winston
- **Monitoring:** Health Checks + Log Aggregation

---

## 📁 Project Structure

```
lcbp3/
├── backend/                    # NestJS Backend Application
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   ├── common/            # Shared utilities
│   │   ├── config/            # Configuration
│   │   └── migrations/        # Database migrations
│   ├── test/                  # Tests
│   └── package.json
│
├── frontend/                  # Next.js Frontend Application
│   ├── app/                   # App router pages
│   ├── components/            # React components
│   ├── lib/                   # Utilities
│   └── package.json
│
├── docs/                      # Source documentation
│   ├── 0_Requirements_V1_4_5.md
│   ├── 1_FullStackJS_V1_4_5.md
│   ├── 2_Backend_Plan_V1_4_4.md
│   ├── 3_Frontend_Plan_V1_4_4.md
│   └── 4_Data_Dictionary_V1_4_5.md
│
├── specs/                     # Technical Specifications
│   ├── 00-overview/          # Project overview & glossary
│   ├── 01-requirements/      # Functional requirements (21 docs)
│   ├── 02-architecture/      # System architecture
│   ├── 03-implementation/    # Implementation guidelines
│   ├── 04-operations/        # Deployment & operations
│   ├── 05-decisions/         # Architecture Decision Records (17 ADRs)
│   ├── 06-tasks/             # Development tasks & progress
│   ├── 07-database/          # Database schema v1.6.0 & seed data
│   └── 09-history/           # Archived implementations
│
├── docker-compose.yml         # Docker services configuration
└── README.md                  # Project README
```

---

## 🔗 Quick Links

### Documentation

| Category           | Document                                                                           | Description                           |
| ------------------ | ---------------------------------------------------------------------------------- | ------------------------------------- |
| **Overview**       | [Glossary](./00-02-glossary.md)                                                          | Technical terminology & abbreviations |
| **Overview**       | [Quick Start](./00-01-quick-start.md)                                                    | 5-minute getting started guide        |
| **Requirements**   | [Functional Requirements](../01-requirements/01-03-functional-requirements.md)        | Feature specifications                |
| **Requirements**   | [Document Numbering](../01-requirements/01-03.11-document-numbering.md)               | Document numbering requirements       |
| **Architecture**   | [System Architecture](../02-architecture/02-01-system-architecture.md)                   | Overall system design                 |
| **Architecture**   | [Data Model](../02-architecture/02-03-data-model.md)                                     | Database schema                       |
| **Architecture**   | [API Design](../02-architecture/02-02-api-design.md)                                     | REST API specifications               |
| **Implementation** | [Backend Guidelines](../03-implementation/03-02-backend-guidelines.md)                   | Backend coding standards              |
| **Implementation** | [Frontend Guidelines](../03-implementation/03-03-frontend-guidelines.md)                 | Frontend coding standards             |
| **Implementation** | [Document Numbering Implementation](../03-implementation/03-04-document-numbering.md)    | Document numbering implementation     |
| **Implementation** | [Testing Strategy](../03-implementation/03-05-testing-strategy.md)                       | Testing approach                      |
| **Operations**     | [Deployment Guide](../04-operations/04-01-deployment-guide.md)                           | How to deploy                         |
| **Operations**     | [Monitoring](../04-operations/04-03-monitoring-alerting.md)                              | Monitoring & alerts                   |
| **Operations**     | [Document Numbering Operations](../04-operations/04-08-document-numbering-operations.md) | Doc numbering ops guide               |
| **Decisions**      | [ADR Index](../05-decisions/README.md)                                             | Architecture decisions                |
| **Tasks**          | [Backend Tasks](../06-tasks/README.md)                                             | Development tasks                     |

### Key ADRs

1. [ADR-001: Unified Workflow Engine](../05-decisions/ADR-001-unified-workflow-engine.md)
2. [ADR-002: Document Numbering Strategy](../05-decisions/ADR-002-document-numbering-strategy.md)
3. [ADR-003: Two-Phase File Storage](../05-decisions/ADR-003-file-storage-approach.md)
4. [ADR-004: RBAC Implementation](../05-decisions/ADR-004-rbac-implementation.md)
5. [ADR-005: Technology Stack](../05-decisions/ADR-005-technology-stack.md)

---

## 🚀 Getting Started

### For Developers

1. **Read Documentation**

   - Start with [Quick Start Guide](./00-01-quick-start.md)
   - Review [System Architecture](../02-architecture/02-01-system-architecture.md)
   - Study [Backend](../03-implementation/03-02-backend-guidelines.md) / [Frontend](../03-implementation/03-03-frontend-guidelines.md) guidelines

2. **Setup Development Environment**

   - Clone repository
   - Install Docker & Docker Compose
   - Run `docker-compose up`
   - Access backend: `http://localhost:3000`
   - Access frontend: `http://localhost:3001`

3. **Start Coding**
   - Pick a task from [Backend Tasks](../06-tasks/README.md)
   - Follow coding guidelines
   - Write tests
   - Submit PR for review

### For Operations Team

1. **Infrastructure Setup**

   - Review [Environment Setup](../04-operations/04-02-environment-setup.md)
   - Configure QNAP Container Station
   - Setup Docker Compose

2. **Deployment**

   - Follow [Deployment Guide](../04-operations/04-01-deployment-guide.md)
   - Configure [Backup & Recovery](../04-operations/04-04-backup-recovery.md)
   - Setup [Monitoring](../04-operations/04-03-monitoring-alerting.md)

3. **Maintenance**
   - Review [Maintenance Procedures](../04-operations/04-05-maintenance-procedures.md)
   - Setup [Incident Response](../04-operations/04-07-incident-response.md)
   - Configure [Security Operations](../04-operations/04-06-security-operations.md)

---

## 👥 Team & Stakeholders

### Project Team

- **System Architect:** Nattanin Peancharoen
- **Backend Team Lead:** [Name]
- **Frontend Team Lead:** [Name]
- **DevOps Engineer:** [Name]
- **QA Lead:** [Name]
- **Database Administrator:** [Name]

### Stakeholders

- **Port Authority of Thailand (กทท.)** - Owner
- **Project Administrators (สค©.)** - Administrator
- **Design Consultants (TEAM)** - Designers
- **Project Supervisors (คคง.)** - Consultants
- **Contractors (ผรม.1-4)** - Construction

---

## 📊 Project Timeline

### Phase 1: Foundation (Weeks 1-4)

- Database setup & migrations
- Authentication & RBAC
- **Milestone:** User can login

### Phase 2: Core Infrastructure (Weeks 5-10)

- User Management & Master Data
- File Storage & Document Numbering
- Workflow Engine
- **Milestone:** Core services ready

### Phase 3: Business Modules (Weeks 11-17)

- Correspondence Management
- RFA Management
- **Milestone:** Core documents manageable

### Phase 4: Supporting Modules (Weeks 18-21)

- Drawing Management
- Circulation & Transmittal
- Search & Elasticsearch
- **Milestone:** Document ecosystem complete

### Phase 5: Services (Week 22)

- Notifications & Audit Logs
- **Milestone:** MVP ready for UAT

### Phase 6: Testing & Deployment (Weeks 23-24)

- User Acceptance Testing (UAT)
- Production deployment
- **Milestone:** Go-Live

---

## 📈 Success Metrics

### Technical Metrics

- **Uptime:** > 99.5%
- **API Response Time (P95):** < 500ms
- **Error Rate:** < 1%
- **Database Query Time (P95):** < 100ms

### Business Metrics

- **User Adoption:** > 90% of stakeholders using system
- **Document Processing Time:** 50% reduction vs manual
- **Search Success Rate:** > 95%
- **User Satisfaction:** > 4.0/5.0

---

## 🔐 Security & Compliance

- **Data Encryption:** At rest & in transit
- **Access Control:** 4-level RBAC
- **Audit Logging:** All user actions logged
- **Backup:** Daily automated backups
- **Disaster Recovery:** RTO 4h, RPO 24h
- **Security Scanning:** Automated vulnerability scans

---

## 📞 Support & Contact

### Development Support

- **Repository:** [Internal Git Repository]
- **Issue Tracker:** [Internal Issue Tracker]
- **Documentation:** This repository `/specs`

### Operations Support

- **Email:** <ops-team@example.com>
- **Phone:** [Phone Number]
- **On-Call:** [On-Call Schedule]

---

## 📝 Document Control

- **Version:** 1.8.0
- **Status:** Active Development
- **Last Updated:** 2026-02-20
- **Next Review:** 2026-03-31
- **Owner:** System Architect
- **Classification:** Internal Use Only

---

## 🔄 Version History

| Version | Date       | Description                                |
| ------- | ---------- | ------------------------------------------ |
| 1.8.0   | 2026-02-20 | Contract Categories Page Crash Fix         |
| 1.7.0   | 2025-12-18 | Schema refactoring, documentation updated  |
| 1.6.0   | 2025-12-13 | Schema refactoring, documentation updated  |
| 1.5.1   | 2025-12-09 | TASK-FE-011/012 completed, docs updated    |
| 1.5.1   | 2025-12-02 | Reorganized documentation structure        |
| 1.5.0   | 2025-12-01 | Complete specification with ADRs and tasks |
| 1.4.5   | 2025-11-30 | Updated architecture documents             |
| 1.4.4   | 2025-11-29 | Initial backend/frontend plans             |
| 1.0.0   | 2025-11-01 | Initial requirements                       |

---

**Welcome to LCBP3-DMS Project! 🚀**
