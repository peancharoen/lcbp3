# 🛠️ Implementation Specification

> **แนวทางการพัฬนาและมาตรฐานทางเทคนิคของระบบ LCBP3-DMS**
>
> เอกสารชุดนี้รวบรวมมาตรฐานการเขียนโปรแกรม แนวทางการพัฒนา และรายละเอียดการนำสถาปัตยกรรมไปใช้งานจริง ทั้งในส่วนของ Backend และ Frontend

---

## 📊 Document Status

| Attribute          | Value                            |
| ------------------ | -------------------------------- |
| **Version**        | 1.8.1                            |
| **Status**         | Active                           |
| **Last Updated**   | 2026-03-16                       |
| **Owner**          | Nattanin Peancharoen             |
| **Classification** | Internal Technical Documentation |

---

## 📚 Table of Contents

- [🛠️ Implementation Specification](#️-implementation-specification)
  - [📊 Document Status](#-document-status)
  - [📚 Table of Contents](#-table-of-contents)
  - [🎯 หลักการพัฒนาหลัก (Core Principles)](#-หลักการพัฒนาหลัก-core-principles)
  - [📖 คู่มือการพัฒนา (Implementation Guides)](#-คู่มือการพัฒนา-implementation-guides)
    - [1. FullStack JS Guidelines](#1-fullstack-js-guidelines)
    - [2. Backend Guidelines](#2-backend-guidelines)
    - [3. Frontend Guidelines](#3-frontend-guidelines)
    - [4. Document Numbering System](#4-document-numbering-system)
  - [🧪 Testing Strategy](#-testing-strategy)
  - [🛠️ Technology Stack Recap](#️-technology-stack-recap)
  - [🔗 Related Documents](#-related-documents)

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

### 1. [FullStack JS Guidelines](./05-01-fullstack-js-guidelines.md)

**แนวทางการพัฒนาภาพรวมทั้งระบบ (v1.8.1 — includes NestJS 11 Patterns)**

- โครงสร้างโปรเจกต์ (Monorepo-like focus)
- Naming Conventions & Code Style
- Secrets & Environment Management
- Two-Phase File Storage Algorithm
- Double-Lock Mechanism for Numbering

### 2. [Backend Guidelines](./05-02-backend-guidelines.md)

**แนวทางการพัฒนา NestJS 11 Backend**

- Modular Architecture Detail
- DTO Validation & Transformer
- TypeORM Best Practices & Optimistic Locking
- JWT Authentication & CASL Authorization
- BullMQ for Background Jobs

### 3. [Frontend Guidelines](./05-03-frontend-guidelines.md)

**แนวทางการพัฒนา Next.js 16 Frontend**

- App Router Patterns
- Shadcn/UI & Tailwind Styling
- TanStack Query for Data Fetching
- React Hook Form + Zod for Client Validation
- API Client Interceptors (Auth & Idempotency)

### 4. [Document Numbering System](../01-Requirements/business-rules/01-02-02-doc-numbering-rules.md)

**รายละเอียดการนำระบบออกเลขที่เอกสารไปใช้งาน**

- Table Schema: Templates, Counters, Audit
- Double-Lock Strategy (Redis Redlock + Database VersionColumn)
- Reservation Flow (Phase 1: Reserve, Phase 2: Confirm)
- API Specs for Numbering Management

---

## 🧪 Testing Strategy

รายละเอียดอยู่ในเอกสาร: **[Testing Strategy](./05-04-testing-strategy.md)**

- **Unit Testing:** NestJS (Jest), React (Vitest)
- **Integration Testing:** API Endpoints (Supertest)
- **E2E Testing:** Playwright สำหรับ Critical Flows
- **Special Tests:** Concurrency Tests สำหรับ Document Numbering

---

## 🛠️ Technology Stack Recap

| Layer        | Primary Technology            | Secondary/Supporting      |
| ------------ | ----------------------------- | ------------------------- |
| **Backend**  | NestJS 11 (Express v5)        | TypeORM, BullMQ           |
| **Frontend** | Next.js 16.2.0 (React 19.2.4) | Shadcn/UI, Tailwind 4.2.2 |
| **Database** | MariaDB 11.8                  | Redis 7 (Cache/Lock)      |
| **Search**   | Elasticsearch                 | -                         |
| **Testing**  | Jest, Vitest                  | Playwright                |

---

## 🔗 Related Documents

- 📋 [Requirements Specification](../01-Requirements/README.md)
- 🏗️ [Architecture Specification](../02-Architecture/README.md)
- 🚀 [Operations Specification](../04-Infrastructure-OPS/README.md)

---

<div align="center">

**LCBP3-DMS Implementation Specification v1.8.1**

[FullStack](./05-01-fullstack-js-guidelines.md) • [Backend](./05-02-backend-guidelines.md) • [Frontend](./05-03-frontend-guidelines.md) • [Testing](./05-04-testing-strategy.md)

[Main README](../../README.md) • [Architecture](../02-Architecture/README.md) • [Requirements](../01-Requirements/README.md)

</div>
