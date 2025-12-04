# 📋 **แผนการพัฒนา Backend (NestJS) - LCBP3-DMS v1.5.1**

**สถานะ:** DRAFT
**วันที่:** 2025-12-04
**อ้างอิง:** Requirements v1.5.1 & FullStackJS Guidelines v1.5.1
**Classification:** Internal Technical Documentation

---

## 🎯 **ภาพรวมโครงการ (Project Overview)**

พัฒนา Backend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) เวอร์ชัน 1.5.1 โดยเน้นการปรับปรุงสถาปัตยกรรมหลัก 3 ส่วนสำคัญ:
1.  **Unified Workflow Engine:** ระบบ Workflow แบบ Dynamic ที่ยืดหยุ่น รองรับการกำหนด Rule ผ่าน DSL
2.  **Advanced Document Numbering:** ระบบสร้างเลขที่เอกสารที่ซับซ้อน (8-component key) พร้อม Double-Lock Mechanism ป้องกัน Race Condition
3.  **Enhanced Master Data:** การจัดการข้อมูลหลักที่ครอบคลุม (Discipline, SubType) และ JSON Schema Management

---

## 📐 **สถาปัตยกรรมระบบ (System Architecture)**

### **Technology Stack**

-   **Framework:** NestJS (TypeScript, ESM)
-   **Database:** MariaDB 10.11 (ใช้ Virtual Columns & Partitioning)
-   **ORM:** TypeORM (Optimistic Locking)
-   **Workflow Engine:** Custom DSL-based Engine (State Machine)
-   **Queue:** BullMQ (Redis) สำหรับ Async Jobs & Notifications
-   **Locking:** Redis (Redlock) + DB Pessimistic Fallback
-   **Search:** Elasticsearch
-   **Validation:** Zod / Class-validator / AJV (JSON Schema)

### **โครงสร้างโมดูล (Module Structure)**

```
📁src
├── 📁common              # Shared utilities, guards, decorators
├── 📁config              # Configuration setup
├── 📁database            # Migrations & Seeds
├── 📁modules
│   ├── 📁auth            # Authentication (JWT)
│   ├── 📁user            # User & RBAC Management
│   ├── 📁master-data     # Organization, Project, Type, Discipline (NEW)
│   ├── 📁document-numbering # Numbering Service (Updated)
│   ├── 📁workflow-engine # Unified Workflow Engine (NEW)
│   ├── 📁correspondence  # Correspondence Management
│   ├── 📁rfa             # RFA Management
│   ├── 📁drawing         # Drawing Management
│   ├── 📁transmittal     # Transmittal Management
│   ├── 📁circulation     # Circulation Management
│   ├── 📁file-storage    # File Upload & Handling
│   ├── 📁json-schema     # JSON Schema Registry (NEW)
│   ├── 📁search          # Elasticsearch Integration
│   ├── 📁notification    # Notification System
│   └── 📁monitoring      # Health & Metrics
└── main.ts
```

---

## 🗓️ **แผนการพัฒนาแบบ Phase-Based**

### **Phase 1: Core Foundation & Master Data (Week 1-2)**

**Goal:** เตรียมโครงสร้างพื้นฐานและข้อมูลหลักให้พร้อมสำหรับโมดูลอื่น

#### **[ ] T1.1 Master Data Module (Enhanced)**
-   **Objective:** จัดการข้อมูลหลักทั้งหมดรวมถึงตารางใหม่ใน v1.5.1
-   **Tasks:**
    -   [ ] Implement `OrganizationService` (CRUD)
    -   [ ] Implement `ProjectService` & `ContractService`
    -   [ ] Implement `TypeService` (Correspondence, RFA, Drawing)
    -   [ ] **[NEW]** Implement `DisciplineService` (CRUD for `disciplines` table)
    -   [ ] **[NEW]** Implement `CorrespondenceSubTypeService`
    -   [ ] **[NEW]** Implement `CodeService` (RFA Approve Codes, Status Codes)
-   **Deliverables:** API สำหรับจัดการ Master Data ทั้งหมด

#### **[ ] T1.2 User & Auth Module**
-   **Objective:** ระบบผู้ใช้งานและสิทธิ์ (RBAC)
-   **Tasks:**
    -   [ ] Implement `AuthService` (Login, Refresh Token)
    -   [ ] Implement `UserService` & `UserPreferenceService`
    -   [ ] Implement RBAC Guards (Global, Org, Project, Contract scopes)
-   **Deliverables:** Secure Authentication & Authorization

---

### **Phase 2: Document Numbering & File Storage (Week 3)**

**Goal:** ระบบเลขที่เอกสารที่ถูกต้องแม่นยำและระบบไฟล์ที่ปลอดภัย

#### **[ ] T2.1 Document Numbering Module (Major Update)**
-   **Objective:** ระบบสร้างเลขที่เอกสารแบบ 8-component key พร้อม Double-Lock
-   **Tasks:**
    -   [ ] Update `DocumentNumberCounter` entity (8-column PK)
    -   [ ] Implement `DocumentNumberingService` with **Redlock**
    -   [ ] Implement **DB Optimistic Lock** fallback strategy
    -   [ ] Implement Token Parser (`{DISCIPLINE}`, `{SUB_TYPE}`, `{RFA_TYPE}`)
    -   [ ] Create `DocumentNumberAudit` & `DocumentNumberError` tables
-   **Deliverables:** Race-condition free numbering system

#### **[ ] T2.2 File Storage Service**
-   **Objective:** Two-Phase Storage Strategy
-   **Tasks:**
    -   [ ] Implement `Upload` (Phase 1: Temp storage)
    -   [ ] Implement `Commit` (Phase 2: Move to permanent)
    -   [ ] Integrate **ClamAV** for virus scanning
    -   [ ] Implement Cleanup Job for orphan files
-   **Deliverables:** Secure file upload system

---

### **Phase 3: Unified Workflow Engine (Week 4-5)**

**Goal:** ระบบ Workflow กลางที่ยืดหยุ่นและ Configurable

#### **[ ] T3.1 Workflow Engine Core**
-   **Objective:** สร้าง Engine สำหรับรัน Workflow ตาม DSL
-   **Tasks:**
    -   [ ] Design DSL Schema (JSON)
    -   [ ] Implement `DslParserService` & Validator
    -   [ ] Implement `WorkflowEngineService` (State Machine)
    -   [ ] Implement `GuardExecutor` (Permission/Condition checks)
    -   [ ] Implement `EffectExecutor` (Actions after transition)
-   **Deliverables:** Functional Workflow Engine

#### **[ ] T3.2 Workflow Integration**
-   **Objective:** เชื่อมต่อ Engine เข้ากับ Business Modules
-   **Tasks:**
    -   [ ] Create Standard Workflow Definitions (Correspondence, RFA)
    -   [ ] Implement `WorkflowInstance` creation logic
    -   [ ] Create API for Workflow Actions (Approve, Reject, Comment)
-   **Deliverables:** Integrated Workflow System

---

### **Phase 4: Business Logic Modules (Week 6-7)**

**Goal:** ฟังก์ชันการทำงานหลักของระบบเอกสาร

#### **[ ] T4.1 Correspondence Module**
-   **Objective:** จัดการหนังสือโต้ตอบ
-   **Tasks:**
    -   [ ] Update Entity to support `discipline_id`
    -   [ ] Integrate with **Document Numbering**
    -   [ ] Integrate with **Workflow Engine**
    -   [ ] Implement CRUD & Revision handling

#### **[ ] T4.2 RFA Module**
-   **Objective:** จัดการเอกสารขออนุมัติ
-   **Tasks:**
    -   [ ] Update Entity to support `discipline_id`
    -   [ ] Implement RFA-specific workflow logic
    -   [ ] Implement RFA Item linking (Drawings)

#### **[ ] T4.3 Drawing Module**
-   **Objective:** จัดการแบบก่อสร้าง (Shop Drawing, Contract Drawing)
-   **Tasks:**
    -   [ ] Implement `ShopDrawingService` & `ContractDrawingService`
    -   [ ] Implement Revision Control for Drawings
    -   [ ] Implement Drawing Numbering Logic

#### **[ ] T4.4 Transmittal Module**
-   **Objective:** จัดการใบนำส่งเอกสาร (Transmittal)
-   **Tasks:**
    -   [ ] Implement `TransmittalService` (Create, View, PDF)
    -   [ ] Implement `TransmittalItem` linking (Correspondence, RFA, Drawing)
    -   [ ] Implement Transmittal Numbering (Type 901)
    -   [ ] Generate PDF Transmittal Letter

#### **[ ] T4.5 Circulation Module**
-   **Objective:** จัดการใบเวียนภายใน (Circulation Sheet)
-   **Tasks:**
    -   [ ] Implement `CirculationService` (Create, Assign, Complete)
    -   [ ] Implement `CirculationAssignee` tracking (Multiple users)
    -   [ ] Implement Circulation Numbering (Type 900)
    -   [ ] Integrate with Workflow for completion tracking

---

### **Phase 5: System, Search & Monitoring (Week 8)**

**Goal:** ระบบสนับสนุนและการตรวจสอบ

#### **[ ] T5.1 JSON Schema & Preferences**
-   **Objective:** จัดการ Dynamic Data และ User Settings
-   **Tasks:**
    -   [ ] Implement `JsonSchemaService` (Registry & Validation)
    -   [ ] Implement `UserPreferenceService`
    -   [ ] Implement Virtual Column management

#### **[ ] T5.2 Search & Logs**
-   **Objective:** การค้นหาและตรวจสอบ
-   **Tasks:**
    -   [ ] Implement **Elasticsearch** Sync
    -   [ ] Implement **Audit Log** with Partitioning
    -   [ ] Setup **Prometheus/Grafana** metrics

---

## 🛡️ **Security & Performance Guidelines**

1.  **Double-Locking:** ใช้ Redis Lock คู่กับ DB Optimistic Lock เสมอสำหรับ Critical Sections
2.  **Input Validation:** ใช้ Zod/DTO Validation ทุกจุด โดยเฉพาะ JSON Fields
3.  **Rate Limiting:** บังคับใช้ Rate Limit ตาม User Role
4.  **Audit Logging:** บันทึกทุกการกระทำที่สำคัญลง `audit_logs`
5.  **Partitioning:** ใช้ Partitioning สำหรับตารางขนาดใหญ่ (`audit_logs`, `notifications`)

---

**End of Backend Plan V1.5.1**
