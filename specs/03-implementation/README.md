# 🛠️ Implementation Specification

> **แนวทางการพัฬนาและมาตรฐานทางเทคนิคของระบบ LCBP3-DMS**
>
> เอกสารชุดนี้รวบรวมมาตรฐานการเขียนโปรแกรม แนวทางการพัฒนา และรายละเอียดการนำสถาปัตยกรรมไปใช้งานจริง ทั้งในส่วนของ Backend และ Frontend

---

## 📊 Document Status

| Attribute          | Value                            |
| ------------------ | -------------------------------- |
| **Version**        | 1.7.0                            |
| **Status**         | Active                           |
| **Last Updated**   | 2025-12-18                       |
| **Owner**          | Nattanin Peancharoen             |
| **Classification** | Internal Technical Documentation |

---

## 📚 Table of Contents

- [หลักการพัฒนาหลัก (Core Principles)](#-หลักการพัฒนาหลัก-core-principles)
- [คู่มือการพัฒนา (Implementation Guides)](#-คู่มือการพัฒนา-implementation-guides)
- [มาตรฐานการเขียนโปรแกรม (Coding Standards)](#-มาตรฐานการเขียนโปรแกรม-coding-standards)
- [Technology Stack Recap](#-technology-stack-recap)
- [Testing Strategy](#-testing-strategy)
- [Related Documents](#-related-documents)

---

## 🎯 หลักการพัฒนาหลัก (Core Principles)

เพื่อให้ระบบมีความมั่นคง ยืดหยุ่น และดูแลรักษาง่าย การพัฒนาต้องยึดหลักการดังนี้:

1.  **Type Safety Everywhere** - ใช้ TypeScript อย่างเข้มงวด ห้ามใช้ `any`
2.  **Modular Dependency** - แยก Logic ตาม Module หลีกเลี่ยง Circular Dependency
3.  **Idempotency** - การสร้างหรือแก้ไขข้อมูลต้องรองรับการกดซ้ำได้ (Idempotency-Key)
4.  **Security by Default** - ตรวจสอบ Permission (RBAC) และ Validation ในทุก Endpoint
5.  **Fail Fast & Log Everything** - ดักจับ Error ตั้งแต่เนิ่นๆ และบันทึก Audit Logs ที่สำคัญ

---

## 📖 คู่มือการพัฒนา (Implementation Guides)

### 1. [FullStack JS Guidelines](./03-01-fullftack-js-v1.7.0.md)
**แนวทางการพัฒนาภาพรวมทั้งระบบ (v1.7.0)**
- โครงสร้างโปรเจกต์ (Monorepo-like focus)
- Naming Conventions & Code Style
- Secrets & Environment Management
- Two-Phase File Storage Algorithm
- Double-Lock Mechanism for Numbering

### 2. [Backend Guidelines](./03-02-backend-guidelines.md)
**แนวทางการพัฒนา NestJS Backend**
- Modular Architecture Detail
- DTO Validation & Transformer
- TypeORM Best Practices & Optimistic Locking
- JWT Authentication & CASL Authorization
- BullMQ for Background Jobs

### 3. [Frontend Guidelines](./03-03-frontend-guidelines.md)
**แนวทางการพัฒนา Next.js Frontend**
- App Router Patterns
- Shadcn/UI & Tailwind Styling
- TanStack Query for Data Fetching
- React Hook Form + Zod for Client Validation
- API Client Interceptors (Auth & Idempotency)

### 4. [Document Numbering System](./03-04-document-numbering.md)
**รายละเอียดการนำระบบออกเลขที่เอกสารไปใช้งาน**
- Table Schema: Templates, Counters, Audit
- Double-Lock Strategy (Redis Redlock + Database VersionColumn)
- Reservation Flow (Phase 1: Reserve, Phase 2: Confirm)
- API Specs for Numbering Management

---

## 🧪 Testing Strategy

รายละเอียดอยู่ในเอกสาร: **[Testing Strategy](./03-05-testing-strategy.md)**

- **Unit Testing:** NestJS (Jest), React (Vitest)
- **Integration Testing:** API Endpoints (Supertest)
- **E2E Testing:** Playwright สำหรับ Critical Flows
- **Special Tests:** Concurrency Tests สำหรับ Document Numbering

---

## 🛠️ Technology Stack Recap

| Layer        | Primary Technology | Secondary/Supporting |
| ------------ | ------------------ | -------------------- |
| **Backend**  | NestJS (Node.js)   | TypeORM, BullMQ      |
| **Frontend** | Next.js 14+        | Shadcn/UI, Tailwind  |
| **Database** | MariaDB 11.8       | Redis 7 (Cache/Lock) |
| **Search**   | Elasticsearch      | -                    |
| **Testing**  | Jest, Vitest       | Playwright           |

---

## 🔗 Related Documents

- 📋 [Requirements Specification](../01-requirements/README.md)
- 🏗️ [Architecture Specification](../02-architecture/README.md)
- 🚀 [Operations Specification](../04-operations/README.md)
- 🎯 [Active Tasks](../06-tasks/README.md)

---

<div align="center">

**LCBP3-DMS Implementation Specification v1.7.0**

[FullStack](./03-01-fullftack-js-v1.7.0.md) • [Backend](./03-02-backend-guidelines.md) • [Frontend](./03-03-frontend-guidelines.md) • [Testing](./03-05-testing-strategy.md)

[Main README](../../README.md) • [Architecture](../02-architecture/README.md) • [Requirements](../01-requirements/README.md)

</div>
