# 📋 **แผนการพัฒนา Frontend (Next.js) - LCBP3-DMS v1.5.1**

**สถานะ:** DRAFT
**วันที่:** 2025-12-04
**อ้างอิง:** Requirements v1.5.1 & FullStackJS Guidelines v1.5.1
**Classification:** Internal Technical Documentation

---

## 🎯 **ภาพรวมโครงการ (Project Overview)**

พัฒนา Frontend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) เวอร์ชัน 1.5.1 โดยเน้นการรองรับฟีเจอร์ใหม่ใน Backend v1.5.1 ได้แก่ **Unified Workflow Engine**, **Advanced Document Numbering**, และ **Enhanced Master Data Management** พร้อมทั้งปรับปรุง UX/UI ให้ทันสมัยและใช้งานง่าย

---

## 📐 **สถาปัตยกรรมระบบ (System Architecture)**

### **Technology Stack**

- **Framework:** Next.js 14+ (App Router, React 18, TypeScript)
- **Styling:** Tailwind CSS + Shadcn/UI
- **State Management:**
  - **Server:** TanStack Query (React Query)
  - **Client:** Zustand
  - **Form:** React Hook Form + Zod
- **Workflow Visualization:** ReactFlow (สำหรับ Workflow Builder)
- **Editor:** Monaco Editor (สำหรับ DSL Editing)
- **Validation:** Zod + AJV (JSON Schema)

### **โครงสร้างโมดูล (Module Structure)**

```
📁src
├── 📁app
│   ├── 📁(auth)          # Login, Forgot Password
│   ├── 📁(dashboard)     # Main App Layout
│   │   ├── 📁admin       # Admin Panel (Users, Master Data, Config)
│   │   ├── 📁correspondences
│   │   ├── 📁rfas
│   │   ├── 📁drawings
│   │   ├── 📁transmittals
│   │   ├── 📁circulations
│   │   └── 📁tasks
│   └── 📁api             # NextAuth & Proxy
├── 📁components
│   ├── 📁admin           # Admin-specific components
│   ├── 📁workflow        # Workflow Builder & Visualizer
│   ├── 📁numbering       # Numbering Template Editor
│   └── 📁ui              # Shadcn UI Components
└── 📁lib
    ├── 📁api             # API Clients
    └── 📁stores          # Zustand Stores
```

---

## 🗓️ **แผนการพัฒนาแบบ Phase-Based**

### **Phase 1: Foundation & UI Components (Week 1)**

**Goal:** เตรียมโครงสร้างโปรเจกต์และ Component พื้นฐาน

#### **[ ] F1.1 Project Setup & Design System**

- **Tasks:**
  - [ ] Setup Next.js 14 + Tailwind + Shadcn/UI
  - [ ] Configure Axios with **Idempotency Interceptor**
  - [ ] Implement Base Layout (Sidebar, Navbar, Breadcrumbs)
  - [ ] Setup **TanStack Query** & **Zustand**

#### **[ ] F1.2 Authentication UI**

- **Tasks:**
  - [ ] Login Page with Form Validation
  - [ ] Integrate NextAuth.js with Backend
  - [ ] Implement RBAC Guard (Protect Routes based on Permissions)

---

### **Phase 2: Admin & Master Data (Week 2-3)**

**Goal:** ระบบจัดการผู้ใช้และข้อมูลหลัก (รองรับ v1.5.1 Requirements)

#### **[ ] F2.1 User & Role Management**

- **Tasks:**
  - [ ] User List & CRUD (Admin only)
  - [ ] Role Assignment UI
  - [ ] Permission Matrix Viewer

#### **[ ] F2.2 Enhanced Master Data UI**

- **Tasks:**
  - [ ] **Organization Management:** CRUD + Logo Upload
  - [ ] **Project & Contract Management:** CRUD + Relations
  - [ ] **[NEW] Discipline Management:** CRUD for `disciplines`
  - [ ] **[NEW] Sub-Type Management:** CRUD for `correspondence_sub_types`

#### **[ ] F2.3 System Configuration**

- **Tasks:**
  - [ ] **[NEW] Document Numbering Config:**
    - Template Editor (Monaco/Visual)
    - Sequence Viewer
  - [ ] **[NEW] Workflow Configuration:**
    - Workflow List
    - DSL Editor (Monaco)
    - Visual Builder (ReactFlow)

---

### **Phase 3: Core Modules (Week 4-5)**

**Goal:** โมดูลหลัก Correspondence และ RFA

#### **[ ] F3.1 Correspondence Module**

- **Tasks:**
  - [ ] List View with Advanced Filters
  - [ ] **Create/Edit Form:**
    - Add **Discipline Selector** (Dynamic based on Contract)
    - Add **Sub-Type Selector** (Dynamic based on Type)
    - File Upload (Two-Phase)
  - [ ] Detail View with History & Comments

#### **[ ] F3.2 RFA Module**

- **Tasks:**
  - [ ] RFA List & Dashboard
  - [ ] **Dynamic RFA Form:**
    - Fields change based on RFA Type (DWG, MAT, MES)
    - Item List Management
  - [ ] **Approval Interface:**
    - Approve/Reject/Comment Actions
    - Workflow Status Visualization

---

### **Phase 4: Advanced Modules (Week 6-7)**

**Goal:** โมดูล Drawing, Transmittal และ Circulation

#### **[ ] F4.1 Drawing Module**

- **Tasks:**
  - [ ] Shop Drawing & Contract Drawing Lists
  - [ ] Revision Management UI
  - [ ] Drawing Viewer (PDF/Image)

#### **[ ] F4.2 Transmittal Module**

- **Tasks:**
  - [ ] Transmittal Creation Form (Select Documents to send)
  - [ ] Transmittal Letter Preview (PDF Generation)
  - [ ] Transmittal History

#### **[ ] F4.3 Circulation Module**

- **Tasks:**
  - [ ] Circulation Sheet Creation (Select Assignees)
  - [ ] "My Tasks" Dashboard for Circulation
  - [ ] Completion & Tracking UI

---

### **Phase 5: Search & Dashboard (Week 8)**

**Goal:** การค้นหาและหน้า Dashboard

#### **[ ] F5.1 Advanced Search**

- **Tasks:**
  - [ ] Unified Search Interface (Elasticsearch)
  - [ ] Faceted Filters (Type, Date, Project, Status)

#### **[ ] F5.2 Dashboard & Monitoring**

- **Tasks:**
  - [ ] Personal Dashboard (My Tasks, Pending Approvals)
  - [ ] Project Dashboard (KPIs, Stats)
  - [ ] **Admin Audit Logs Viewer**

---

## 🛡️ **Security & Performance Guidelines**

1.  **Client-Side Validation:** ใช้ Zod Validate Form ก่อนส่งเสมอ
2.  **Optimistic Updates:** ใช้ React Query `onMutate` เพื่อความลื่นไหล
3.  **Code Splitting:** ใช้ `React.lazy` และ `Next.js Dynamic Imports` สำหรับ Component ใหญ่ๆ (เช่น Monaco Editor, ReactFlow)
4.  **Secure Storage:** ห้ามเก็บ Token ใน LocalStorage (ใช้ HttpOnly Cookie ผ่าน NextAuth)

---

**End of Frontend Plan V1.5.1**
