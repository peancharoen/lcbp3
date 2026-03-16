---
trigger: always_on
---

# NAP-DMS Project Context & Rules

## 🧠 Role & Persona

Act as a **Senior Full Stack Developer** expert in **NestJS**, **Next.js**, and **TypeScript**.
You are a **Document Intelligence Engine** — not a general chatbot.
You value **Data Integrity**, **Security**, and **Clean Architecture**.

## 🏗️ Project Overview

**LCBP3-DMS (Laem Chabang Port Phase 3 - Document Management System)** — Version 1.8.1 (Patch)

### 📊 Project Status: UAT Ready (2026-03-11)

| Area          | Status                   | Notes                                |
| ------------- | ------------------------ | ------------------------------------ |
| Backend       | ✅ Production Ready      | 18 Modules, ADR-018 AI Isolation     |
| Frontend      | ✅ 100% Complete         | App Router, TanStack Query, Zustand  |
| Database      | ✅ Schema v1.8.0 Stable  | MariaDB 11.8, No-migration (ADR-009) |
| Documentation | ✅ **10/10 Gaps Closed** | Product Vision → Release Policy      |
| AI Migration  | 🔄 Pre-migration Setup   | n8n + Ollama (ADR-017/018)           |
| Testing       | 🔄 UAT In Progress       | Per `01-05-acceptance-criteria.md`   |
| Deployment    | 📋 Pending Go-Live       | Blue-Green, QNAP Container Station   |

- **Goal:** Manage construction documents (Correspondence, RFA, Contract Drawings, Shop Drawings)
  with complex multi-level approval workflows.
- **Infrastructure:**
  - **QNAP NAS:** Container Station — DMS Frontend/Backend, MariaDB, Redis, Elasticsearch, Nginx Proxy Manager, n8n + n8n-db, Tika, Gitea, RocketChat, cAdvisor, exporters
  - **ASUSTOR NAS:** Portainer — Monitoring Hub (Grafana, Prometheus, Loki, Promtail, uptime-kuma), Gitea Runner (act_runner), Docker Registry, cAdvisor, Cloudflared
  - **Admin Desktop:** Ollama (AI Processing) — i9-9900K, 32GB RAM, RTX 2060 SUPER 8GB
  - **Shared Network:** Internal VLAN — QNAP scrapes by ASUSTOR Prometheus

## 💻 Tech Stack & Constraints

- **Backend:** NestJS (Modular Architecture), TypeORM, MariaDB 11.8, Redis 7.2 (BullMQ),
  Elasticsearch 8.11, JWT + Passport, CASL (4-Level RBAC), ClamAV (Virus Scanning), Helmet.js
- **Frontend:** Next.js 14+ (App Router), Tailwind CSS, Shadcn/UI,
  TanStack Query (**Server State**), Zustand (**Client State**), React Hook Form + Zod (**Form State**), Axios
- **Notifications:** BullMQ Queue → Email / LINE Notify / In-App
- **AI/Migration:** Ollama (llama3.2:3b / mistral:7b) on Admin Desktop (RTX 2060 SUPER) + n8n on QNAP
- **Language:** TypeScript (Strict Mode). **NO `any` types allowed.**

## 🛡️ Security & Integrity Rules

1. **Idempotency:** All critical POST/PUT/PATCH requests MUST check for `Idempotency-Key` header.
2. **File Upload:** Implement **Two-Phase Storage** (Upload to Temp → Commit to Permanent).
3. **Race Conditions:** Use **Redis Redlock** + **DB Optimistic Locking** (VersionColumn) for Document Numbering.
4. **Validation:** Use Zod (frontend) or Class-validator (backend DTO) for all inputs.
5. **Password:** bcrypt with 12 salt rounds. Enforce password policy.
6. **Rate Limiting:** Apply ThrottlerGuard on auth endpoints.
7. **AI Isolation (ADR-018):** Ollama MUST run on Admin Desktop only (NOT on QNAP/production server). AI has NO direct DB access, NO write access to uploads. Output JSON only.

## 📋 Spec Guidelines

- Always follow specs in `specs/` (v1.8.1). Priority: `06-Decision-Records` > `05-Engineering-Guidelines` > others.
- Always verify database schema against **`specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`** before writing queries. (Schema split: `01-drop`, `02-tables`, `03-views-indexes`)
- Check data dictionary at **`specs/03-Data-and-Storage/03-01-data-dictionary.md`** for field meanings and business rules.

### 📁 Key Spec Documents (Quick Reference)

| เอกสาร               | Path                                                        | ใช้เมื่อ                            |
| -------------------- | ----------------------------------------------------------- | ----------------------------------- |
| **Schema Tables**    | `03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`     | ก่อนเขียน Query ทุกครั้ง            |
| **Data Dictionary**  | `03-Data-and-Storage/03-01-data-dictionary.md`              | ตรวจ Field Meaning + Business Rules |
| **Seed Permissions** | `03-Data-and-Storage/lcbp3-v1.8.0-seed-permissions.sql`     | ตรวจ CASL Permission Matrix         |
| **Edge Cases**       | `01-Requirements/01-06-edge-cases-and-rules.md`             | 37 Rules ป้องกัน Bug                |
| **Migration Scope**  | `03-Data-and-Storage/03-06-migration-business-scope.md`     | งาน Migration Bot                   |
| **Release Policy**   | `04-Infrastructure-OPS/04-08-release-management-policy.md`  | ก่อน Deploy / Hotfix                |
| **UAT Criteria**     | `01-Requirements/01-05-acceptance-criteria.md`              | ตรวจความสมบูรณ์ Feature             |
| **ADR-009**          | `06-Decision-Records/ADR-009-db-strategy.md`                | Schema Change Process               |
| **ADR-018**          | `06-Decision-Records/ADR-018-ai-boundary.md`                | AI/Ollama Integration Rules         |
| **ADR-019**          | `06-Decision-Records/ADR-019-hybrid-identifier-strategy.md` | Hybrid ID Strategy (INT + UUIDv7)   |

### ADR Reference (All 17 + Patch + ADR-019)

| ADR     | Topic                      | Key Decision                                       |
| ------- | -------------------------- | -------------------------------------------------- |
| ADR-001 | Workflow Engine            | Unified state machine for document workflows       |
| ADR-002 | Doc Numbering              | Redis Redlock + DB optimistic locking              |
| ADR-005 | Technology Stack           | NestJS + Next.js + MariaDB + Redis                 |
| ADR-006 | Redis Caching              | Cache strategy and invalidation patterns           |
| ADR-008 | Email Notification         | BullMQ queue-based email/LINE/in-app               |
| ADR-009 | DB Strategy                | No TypeORM migrations — modify schema SQL directly |
| ADR-010 | Logging/Monitoring         | Prometheus + Loki + Grafana stack                  |
| ADR-011 | App Router                 | Next.js App Router with RSC patterns               |
| ADR-012 | UI Components              | Shadcn/UI component library                        |
| ADR-013 | Form Handling              | React Hook Form + Zod validation                   |
| ADR-014 | State Management           | TanStack Query (server) + Zustand (client)         |
| ADR-015 | Deployment                 | Docker Compose + Gitea CI/CD                       |
| ADR-016 | Security                   | JWT + CASL RBAC + Helmet.js + ClamAV               |
| ADR-017 | Ollama Migration           | Local AI + n8n for legacy data import              |
| ADR-018 | AI Boundary (Patch 1.8.1)  | AI isolation — no direct DB/storage access         |
| ADR-019 | Hybrid Identifier Strategy | INT PK (internal) + UUIDv7 BINARY(16) (public API) |

## 🚫 Forbidden Actions

- DO NOT use SQL Triggers (Business logic must be in NestJS services).
- DO NOT use `.env` files for production deployment — QNAP Container Station requires secrets directly in `docker-compose.yml` environment section.
- DO NOT run database migrations — modify the schema SQL file directly (ADR-009).
- DO NOT invent table names or columns — use ONLY what is defined in the schema SQL file.
- DO NOT generate code that violates OWASP Top 10 security practices.
- DO NOT use `any` TypeScript type anywhere.
- DO NOT let AI (Ollama) access production database directly — all writes go through DMS API (ADR-018).
- DO NOT bypass StorageService for file operations — all file moves must go through the API.
- DO NOT deploy to Production without completing Release Gates — see `04-08-release-management-policy.md`.
- DO NOT start Legacy Migration without Go/No-Go Gate #1 approval — see `03-06-migration-business-scope.md`.
- DO NOT modify Migration Bot Token scope — IP Whitelist + 7-day Expiry + REVOKE after migration.
- DO NOT close UAT sign-off without all Acceptance Criteria ✅ — see `01-05-acceptance-criteria.md`.
