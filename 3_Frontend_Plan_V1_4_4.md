# 📋 **แผนการพัฒนา Frontend (Next.js) - LCBP3-DMS v1.4.4**

**สถานะ:** FINAL GUIDELINE Rev.04
**วันที่:** 2025-11-26
**อ้างอิง:** Requirements v1.4.3 & FullStackJS Guidelines v1.4.3
**Classification:** Internal Technical Documentation

## 🎯 **ภาพรวมโครงการ**

พัฒนา Frontend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) ที่มีความทันสมัย รองรับการทำงานบนอุปกรณ์ต่างๆ ได้อย่างสมบูรณ์ มีประสบการณ์ผู้ใช้ที่ราบรื่น และรองรับการทำงานแบบ Offline เบื้องต้น

---

## 📐 **สถาปัตยกรรมระบบ**

### **Technology Stack**

- **Framework:** Next.js 14+ (App Router, React 18, TypeScript, ESM)
- **Styling:** Tailwind CSS + PostCSS
- **UI Components:** shadcn/ui + Radix UI Primitives
- **State Management:**
  - **Server State:** TanStack Query (React Query)
  - **Client State:** Zustand
  - **Form State:** React Hook Form + Zod
- **API Client:** Axios (พร้อม Idempotency Interceptor)
- **Authentication:** NextAuth.js (รองรับ JWT)
- **File Upload:** Custom Hook + Drag & Drop
- **Testing:**
  - **Unit/Integration:** Vitest + React Testing Library
  - **E2E:** Playwright
  - **Mocking:** MSW (Mock Service Worker)
- **Development:**
  - **Package Manager:** pnpm
  - **Linting:** ESLint + Prettier
  - **Type Checking:** TypeScript Strict Mode

### **โครงสร้างโปรเจกต์**

```
📁frontend
├── .env.local
├── .eslintrc.json
├── .gitignore
├── components.json
├── middleware.ts
├── next-env.d.ts
├── next.config.mjs
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
├── 📁app
│   ├── 📁(auth)
│   │   └── 📁login
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── 📁(dashboard)
│   │   └── 📁admin
│   │       ├──📁users
│   │       │   └── page.tsx
│   │       ├──📁correspondences
│   │       │   └── 📁new
│   │       │   │   └── page.tsx
│   │       │   └── page.tsx
│   │       ├──📁dashboard
│   │       │   └── page.tsx
│   │       ├──📁profile
│   │       │   └── page.tsx
│   │       ├──📁projects
│   │       │   ├──📁new
│   │       │   │   └── page.tsx
│   │       │   └── page.tsx
│   │       └── layout.tsx
│   ├── 📁api
│   │   └── 📁auth
│   │       └── 📁[...nextauth]
│   │           └── route.ts
│   ├── 📁demo
│   │   └── page.tsx
│   ├── 📁fonts
│   │   ├── GeistMonoVF.woff
│   │   └── GeistVF.woff
│   ├── favicon.ico
│   ├── globals copy.css
│   ├── globals.css
│   ├── layout copy.tsx
│   ├── layout.tsx
│   └── page.tsx
├── 📁components
│   ├── 📁custom
│   │   ├── file-upload-zone.tsx
│   │   ├── responsive-data-table.tsx
│   │   └── workflow-visualizer.tsx
│   ├── 📁dashboard
│   │   └── recent-activity.tsx
│   ├── 📁forms
│   │   └── file-upload.tsx
│   ├── 📁layout
│   │   ├── dashboard-shell.tsx
│   │   ├── navbar.tsx
│   │   ├── sidebar.tsx
│   │   └── user-nav.tsx
│   ├── 📁tables
│   └── 📁ui
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── calendar.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── popover.tsx
│       ├── progress.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── switch.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       └── textarea.tsx
├── 📁config
│   └── menu.ts
├── 📁lib
│   ├── 📁api
│   │   └── client.ts
│   ├── 📁auth
│   ├── 📁hooks
│   ├── 📁services
│   │   ├── circulation.service.ts
│   │   ├── contract-drawing.service.ts
│   │   ├── correspondence.service.ts
│   │   ├── index.ts
│   │   ├── json-schema.service.ts
│   │   ├── master-data.service.ts
│   │   ├── monitoring.service.ts
│   │   ├── notification.service.ts
│   │   ├── project.service.ts
│   │   ├── rfa.service.ts
│   │   ├── search.service.ts
│   │   ├── shop-drawing.service.ts
│   │   ├── transmittal.service.ts
│   │   ├── user.service.ts
│   │   └── workflow-engine.service.ts
│   ├── 📁stores
│   │   ├── draft-store.ts
│   │   └── ui-store.ts
│   ├── auth.ts
│   └── utils.ts
├── 📁providers
│   ├── query-provider.tsx
│   └── session-provider.tsx
├── 📁public
├── 📁styles
└── 📁types
    └── 📁dto
        └── next-auth.d.ts
        ├── 📁circulation
        │   ├── create-circulation.dto.ts
        │   ├── search-circulation.dto.ts
        │   └── update-circulation-routing.dto.ts
        ├── 📁correspondence
        │   ├── add-reference.dto.ts
        │   ├── create-correspondence.dto.ts
        │   ├── search-correspondence.dto.ts
        │   ├── submit-correspondence.dto.ts
        │   └── workflow-action.dto.ts
        ├── 📁drawing
        │   ├── contract-drawing.dto.ts
        │   └── shop-drawing.dto.ts
        ├── 📁json-schema
        │   └── json-schema.dto.ts
        ├── 📁master
        │   ├── discipline.dto.ts
        │   ├── number-format.dto.ts
        │   ├── sub-type.dto.ts
        │   └── tag.dto.ts
        ├── 📁monitoring
        │   └── set-maintenance.dto.ts
        ├── 📁notification
        │   └── notification.dto.ts
        ├── 📁project
        │   └── project.dto.ts
        ├── 📁rfa
        │   └── rfa.dto.ts
        ├── 📁search
        │   └── search-query.dto.ts
        ├── 📁transmittal
        │   └── transmittal.dto.ts
        ├── 📁user
        │   └── user.dto.ts
        └── 📁workflow-engine
            └── workflow-engine.dto.ts
```

---

## 🗓️ **แผนการพัฒนาแบบ Phase-Based**

### **Phase 0: Foundation & Configuration (สัปดาห์ที่ 1)**

**Milestone:** โครงสร้างพื้นฐานพร้อม รองรับ Development Workflow ที่มีประสิทธิภาพ

### **Phase 0: Tasks**

- **[ ] F0.1 Project Setup & Tooling**

  - [ ] Initialize Next.js 14+ project with TypeScript
  - [ ] Configure pnpm workspace
  - [ ] Setup ESLint, Prettier, and pre-commit hooks
  - [ ] Configure Tailwind CSS with PostCSS
  - [ ] Setup shadcn/ui components
  - [ ] Configure absolute imports and path aliases
  - [ ] **Deliverable:** Development environment ready
  - [ ] **Dependencies:** None

- **[ ] F0.2 Design System & UI Components**

  - [ ] Setup color palette and design tokens
  - [ ] Create responsive design breakpoints
  - [ ] Implement core shadcn/ui components:
    - [ ] Button, Input, Label, Form
    - [ ] Card, Table, Badge
    - [ ] Dialog, Dropdown, Select
    - [ ] Tabs, Accordion
  - [ ] Create custom design system components:
    - [ ] DataTable (responsive)
    - [ ] FileUpload **zone**
    - [ ] Workflow visualization
  - [ ] **Deliverable:** Consistent UI component library
  - [ ] **Dependencies:** F0.1

- **[ ] F0.3 API Client & Authentication**

  - [ ] Setup Axios client with interceptors:
    - [ ] Idempotency-Key header injection
    - [ ] Authentication token management
    - [ ] Error handling and retry logic
  - [ ] Configure NextAuth.js for JWT authentication
  - [ ] Create auth hooks (useAuth, usePermissions)
  - [ ] Setup API route handlers for auth callbacks
  - [ ] **Security:** Implement secure token storage
  - [ ] **Deliverable:** Secure API communication layer
  - [ ] **Dependencies:** F0.1

- **[ ] F0.4 State Management Setup**
  - [ ] Configure TanStack Query for server state:
    - [ ] Query client setup
    - [ ] Default configurations
    - [ ] Error boundaries
  - [ ] Create Zustand stores:
    - [ ] Auth store (user, permissions)
    - [ ] UI store (theme, sidebar state)
    - [ ] Draft store (form auto-save)
  - [ ] Setup React Hook Form with Zod integration
  - [ ] Create form validation schemas
  - [ ] **Deliverable:** Robust state management system
  - [ ] **Dependencies:** F0.1, F0.3

### **Phase 0: Testing - Foundation**

#### **F0.T1 Component Test Suite**

- [ ] **Unit Tests:** Core UI components (Button, Input, Card)
- [ ] **Integration Tests:** Form validation, API client interceptors
- [ ] **Visual Tests:** Component styling and responsive behavior

#### **F0.T2 Authentication Test Suite**

- [ ] **Unit Tests:** Auth hooks, token management
- [ ] **Integration Tests:** Login/logout flow, permission checks
- [ ] **Security Tests:** Token security, API authentication

---

### **Phase 1: Core Application Structure (สัปดาห์ที่ 2)**

**Milestone:** Layout หลักพร้อมใช้งาน การนำทางและ Authentication ทำงานได้

### **Phase 1: Tasks**

- **[ ] F1.1 Main Layout & Navigation**

  - [ ] Create App Shell layout:
    - [ ] Navbar with user menu and notifications
    - [ ] Collapsible sidebar with navigation
    - [ ] Main content area with responsive design
  - [ ] Implement navigation menu structure:
    - [ ] Dashboard, Correspondences, RFAs, Drawings, etc.
    - [ ] Dynamic menu based on user permissions
  - [ ] Create breadcrumb navigation component
  - [ ] Implement mobile-responsive sidebar (drawer)
  - [ ] Maintenance Mode Integration:
    - [ ] Implement a Global Middleware/Wrapper ที่ตรวจสอบสถานะ Maintenance Mode ผ่าน API/Service ก่อนการ Render หน้า หากสถานะเป็น true ให้ Redirect ผู้ใช้ (ยกเว้น Admin) ไปยังหน้า /maintenance ทันที เพื่อให้สอดคล้องกับ Logic ของ Backend.
  - [ ] **Accessibility:** Ensure keyboard navigation and screen reader support
  - [ ] **Deliverable:** Fully functional application layout
  - [ ] **Dependencies:** F0.2, F0.3

- **[ ] F1.2 Authentication Pages**

  - [ ] Create login page with form validation
  - [ ] Implement forgot password flow
  - [ ] Create registration page (admin-only)
  - [ ] Setup protected route middleware
  - [ ] Implement route-based permission checks
  - [ ] **Security:** Rate limiting on auth attempts, secure password requirements
  - [ ] **Deliverable:** Complete authentication flow
  - [ ] **Dependencies:** F0.3, F1.1

- **[ ] F1.3 Dashboard & Landing**

  - [ ] Create public landing page for non-authenticated users
  - [ ] Implement main dashboard with:
    - [ ] KPI cards (document counts, pending tasks)
    - [ ] "My Tasks" table from v_user_tasks
    - [ ] Recent activity feed
    - [ ] Security metrics display
  - [ ] Create dashboard widgets system
  - [ ] Implement data fetching with TanStack Query
  - [ ] **Performance:** Optimize dashboard data loading
  - [ ] **Deliverable:** Functional dashboard with real data
  - [ ] **Dependencies:** F0.4, F1.1

- **[ ] F1.4 Responsive Design System**
  - [ ] Implement mobile-first responsive design
  - [ ] Create card view components for mobile tables
  - [ ] Setup touch-friendly interactions
  - [ ] Optimize images and assets for mobile
  - [ ] Test across multiple device sizes
  - [ ] **UX:** Ensure seamless mobile experience
  - [ ] **Deliverable:** Fully responsive application
  - [ ] **Dependencies:** F0.2, F1.1

### **Phase 1: Testing - Core Structure**

- **[ ] F1.T1 Layout Test Suite**

- [ ] **Unit Tests:** Navigation components, layout responsiveness
- [ ] **Integration Tests:** Route protection, permission-based navigation
- [ ] **E2E Tests:** Complete user navigation flow

- **[ ] F1.T2 Dashboard Test Suite**

- [ ] **Unit Tests:** Dashboard components, data formatting
- [ ] **Integration Tests:** Data fetching and display, real-time updates
- [ ] **Performance Tests:** Dashboard loading performance

---

### **Phase 2: User Management & Security (สัปดาห์ที่ 3)**

**Milestone:** การจัดการผู้ใช้และสิทธิ์แบบสมบูรณ์

### **Phase 2: Tasks**

- **[ ] F2.1 User Profile & Settings**

  - [ ] Create user profile page:
    - [ ] Personal information display/edit
    - [ ] Password change functionality
    - [ ] Notification preferences
  - [ ] Implement profile picture upload
  - [ ] Create user settings page
  - [ ] **Security:** Secure password change with current password verification
  - [ ] **Deliverable:** Complete user self-service management
  - [ ] **Dependencies:** F1.1, F0.4

- **[ ] F2.2 Admin Panel - User Management**

  - [ ] Create user list with search and filters
  - [ ] Implement user creation form
  - [ ] Create user edit interface
  - [ ] Implement bulk user operations
  - [ ] Add user activity tracking display
  - [ ] **Security:** Admin-only access enforcement
  - [ ] **Deliverable:** Comprehensive user management interface
  - [ ] **Dependencies:** F1.1, F2.1

- **[ ] F2.3 Admin Panel - Role Management**

  - [ ] Create role list and management interface
  - [ ] Implement role creation and editing
  - [ ] Create permission assignment interface
  - [ ] Implement role-based access control visualization
  - [ ] Add role usage statistics
  - [ ] **Security:** Permission hierarchy enforcement
  - [ ] **Deliverable:** Complete RBAC management system
  - [ ] **Dependencies:** F2.2

- **[ ] F2.4 Permission Integration**
  - [ ] Implement CASL ability integration
  - [ ] Create permission-based UI components:
    - [ ] ProtectedButton, ProtectedLink
    - [ ] Conditional rendering based on permissions
  - [ ] Setup real-time permission updates
  - [ ] Implement permission debugging tools
  - [ ] **Security:** Frontend-backend permission consistency
  - [ ] **Deliverable:** Seamless permission enforcement throughout app
  - [ ] **Dependencies:** F0.3, F2.3

### **Phase 2: User Management & Admin Panel (สัปดาห์ที่ 3)**

- **[ ] F2.5 Admin Panel - Master Data Management (Req 6B)** (New)
  - [ ] Create "Disciplines Management" page (CRUD)
  - [ ] Create "Sub-Types Management" page (CRUD + Mapping Number)
  - [ ] Create "Numbering Format" configuration page (Template Editor)
  - [ ] **Deliverable:** UI for Admin to configure system master data
  - [ ] **Dependencies:** F2.1

### **Phase 2: Testing - User Management**

- **[ ] F2.T1 User Management Test Suite**

- [ ] **Unit Tests:** User CRUD operations, form validation
- [ ] **Integration Tests:** User-role assignment, permission propagation
- [ ] **Security Tests:** Permission escalation attempts, admin access control

- **[ ] F2.T2 RBAC Test Suite**

- [ ] **Unit Tests:** Permission checks, role validation
- [ ] **Integration Tests:** Multi-level permission enforcement, UI element protection
- [ ] **E2E Tests:** Complete role-based workflow testing

---

### **Phase 3: Project Structure (สัปดาห์ที่ 4)**

**Milestone:** การจัดการโครงสร้างโปรเจกต์และองค์กร

### **Phase 3: Tasks**

- **[ ] F3.1 Project Management UI**

  - [ ] Create project list with search and filters
  - [ ] Implement project creation and editing
  - [ ] Create project detail view
  - [ ] Implement project dashboard with statistics
  - [ ] Add project member management
  - [ ] **UX:** Intuitive project navigation and management
  - [ ] **Deliverable:** Complete project management interface
  - [ ] **Dependencies:** F1.1, F2.4

- **[ ] F3.2 Organization Management**

  - [ ] Create organization list and management
  - [ ] Implement organization creation and editing
  - [ ] Create organization detail view
  - [ ] Add organization user management
  - [ ] Implement organization hierarchy visualization
  - [ ] **Business Logic:** Proper organization-project relationships
  - [ ] **Deliverable:** Comprehensive organization management
  - [ ] **Dependencies:** F3.1

- **[ ] F3.3 Contract Management**
  - [ ] Create contract list within projects
  - [ ] Implement contract creation and editing
  - [ ] Create contract detail view
  - [ ] Add contract party management
  - [ ] Implement contract document associations
  - [ ] **Business Logic:** Contract-project-organization relationships
  - [ ] **Deliverable:** Complete contract management system
  - [ ] **Dependencies:** F3.1, F3.2

### **Phase 3: Testing - Project Structure**

- **[ ] F3.T1 Project Management Test Suite**
  - [ ] **Unit Tests:** Project CRUD operations, validation
  - [ ] **Integration Tests:** Project-organization relationships, member management
  - [ ] **Business Logic Tests:** Project hierarchy, access control

---

### **Phase 4: Correspondence System (สัปดาห์ที่ 5-6)**

**Milestone:** ระบบจัดการเอกสารโต้ตอบแบบสมบูรณ์

### **Phase 4: Tasks**

- **[ ] F4.1 Correspondence List & Search**

  - [ ] Create correspondence list with advanced filtering:
    - [ ] Filter by type, status, project, organization
    - [ ] Search by title, document number, content
    - [ ] Date range filtering
  - [ ] Implement responsive data table:
    - [ ] Desktop: Full table view
    - [ ] Mobile: Card view conversion
  - [ ] Add bulk operations (export, status change)
  - [ ] Implement real-time updates
  - [ ] **Performance:** Virtual scrolling for large datasets
  - [ ] **Deliverable:** High-performance correspondence listing
  - [ ] **Dependencies:** F1.1, F3.1

- **[ ] F4.2 Correspondence Creation Form**

  - [ ] Create dynamic form generator based on JSON schema
  - [ ] Implement form with multiple sections:
    - [ ] Basic information (type, title, recipients)
    - [ ] Content and details (JSON schema-based)
    - [ ] File attachments
    - [ ] Routing template selection
  - [ ] [New] Implement "Originator Selector" component: Dropdown สำหรับเลือกองค์กรผู้ส่ง (แสดงเฉพาะเมื่อผู้ใช้มีสิทธิ์ system.manage_all หรือสิทธิ์พิเศษ) หากไม่เลือกให้ใช้ Organization ของผู้ใช้ตามปกติ
  - [ ] **[New] Discipline Selector:** Add Dropdown for Disciplines (Dependent on Contract/Project)
  - [ ] **[New] Sub-Type Selector:** Add Dropdown for Sub-types (Dependent on Type)
  - [ ] Logic: Show/Hide selectors based on Document Type configuration
  - [ ] Add draft auto-save functionality
  - [ ] Implement form validation with Zod
  - [ ] **UX:** Intuitive form with progress indication
  - [ ] **Deliverable:** Flexible correspondence creation interface
  - [ ] **Dependencies:** F0.4, F4.1

- **[ ] F4.3 Correspondence Detail View**

  - [ ] Create comprehensive detail page:
    - [ ] Document header with metadata
    - [ ] Content display based on type
    - [ ] Revision history
    - [ ] Related documents
    - [ ] Workflow status visualization
  - [ ] Implement document actions:
    - [ ] Edit, withdraw, cancel (with permissions)
    - [ ] Download, print
    - [ ] Create related documents
  - [ ] Add comments and activity timeline
  - [ ] **UX:** Clean, readable document presentation
  - [ ] **Deliverable:** Complete document detail experience
  - [ ] **Dependencies:** F4.1, F4.2

- **[ ] F4.4 File Upload Integration**
  - [ ] Create drag-and-drop file upload component
  - [ ] Implement file type validation and preview
  - [ ] Add virus scan status indication
  - [ ] Create file management interface:
    - [ ] Mark files as main/supporting documents
    - [ ] Reorder and manage attachments
    - [ ] File security status display
  - [ ] Implement two-phase upload progress
  - [ ] **Security:** File type restrictions, size limits, virus scan integration
  - [ ] **Deliverable:** Secure and user-friendly file management
  - [ ] **Dependencies:** F0.2, F4.2

### **Phase 4: Testing - Correspondence System**

- **[ ] F4.T1 Correspondence Test Suite**

  - [ ] **Unit Tests:** Form validation, file upload components
  - [ ] **Integration Tests:** Complete document lifecycle, file attachment flow
  - [ ] **E2E Tests:** End-to-end correspondence creation and management

- **[ ] F4.T2 File Upload Test Suite**
  - [ ] **Unit Tests:** File validation, type checking
  - [ ] **Integration Tests:** Two-phase upload process, virus scan integration
  - [ ] **Security Tests:** Malicious file upload attempts, security feedback

---

### **Phase 5: Workflow Management (สัปดาห์ที่ 7)**

**Milestone:** ระบบ Visualization และจัดการ Workflow

### **Phase 5: Tasks**

- **[ ] F5.1 Workflow Visualization Component**

  - [ ] Create horizontal workflow progress visualization
  - [ ] Implement step status indicators (pending, active, completed, skipped)
  - [ ] Add due date and assignee information
  - [ ] Create interactive workflow diagram
  - [ ] Implement workflow history timeline
  - [ ] **UX:** Clear visual representation of complex workflows
  - [ ] **Deliverable:** Intuitive workflow visualization
  - [ ] **Dependencies:** F4.3

- **[ ] F5.2 Routing Template Management**

  - [ ] Create routing template list and editor
  - [ ] Implement drag-and-drop step configuration
  - [ ] Add step configuration (purpose, duration, assignee rules)
  - [ ] Create template preview functionality
  - [ ] Implement template versioning
  - [ ] **Business Logic:** Proper step sequencing and validation
  - [ ] **Deliverable:** Comprehensive routing template management
  - [ ] **Dependencies:** F3.1, F4.2

- **[ ] F5.3 Workflow Step Actions**

  - [ ] Create step action interface:
    - [ ] Approve, reject, request changes
    - [ ] Add comments and attachments
    - [ ] Forward to other users
  - [ ] Implement bulk step actions
  - [ ] Add action confirmation with reason required
  - [ ] Create step delegation functionality
  - [ ] **UX:** Streamlined step completion process
  - [ ] **Deliverable:** Efficient workflow step management
  - [ ] **Dependencies:** F5.1

- **[ ] F5.4 Real-time Status Updates**
  - [ ] Implement WebSocket connections for real-time updates
  - [ ] Create status change notifications
  - [ ] Add auto-refresh for workflow states
  - [ ] Implement optimistic updates for better UX
  - [ ] Create update history and audit trail
  - [ ] **Performance:** Efficient real-time data synchronization
  - [ ] **Deliverable:** Real-time workflow monitoring
  - [ ] **Dependencies:** F5.1, F9.2

### **Phase 5: Testing - Workflow Management**

- **[ ] F5.T1 Workflow Test Suite**
  - [ ] **Unit Tests:** Workflow visualization, step status logic
  - [ ] **Integration Tests:** Complete workflow execution, real-time updates
  - [ ] **E2E Tests:** Multi-step workflow with different user roles

---

### **Phase 6: Drawing System (สัปดาห์ที่ 8)**

**Milestone:** ระบบจัดการแบบแปลนแบบสมบูรณ์

### **Phase 6: Tasks**

- **[ ] F6.1 Contract Drawings Management**

  - [ ] Create contract drawing list with categorization
  - [ ] Implement drawing upload and metadata management
  - [ ] Create drawing preview and viewer
  - [ ] Add drawing version control
  - [ ] Implement drawing search and filtering
  - [ ] **UX:** Efficient drawing navigation and access
  - [ ] **Deliverable:** Comprehensive contract drawing management
  - [ ] **Dependencies:** F3.1, F4.4

- **[ ] F6.2 Shop Drawings Management**

  - [ ] Create shop drawing list with revision tracking
  - [ ] Implement shop drawing creation and revision system
  - [ ] Create drawing comparison interface
  - [ ] Add drawing approval status tracking
  - [ ] Implement bulk drawing operations
  - [ ] **Business Logic:** Proper revision control and approval workflows
  - [ ] **Deliverable:** Complete shop drawing management system
  - [ ] **Dependencies:** F6.1

- **[ ] F6.3 Drawing Revision System**

  - [ ] Create revision history interface
  - [ ] Implement revision comparison functionality
  - [ ] Add revision notes and change tracking
  - [ ] Create revision approval workflow
  - [ ] Implement revision rollback capability
  - [ ] **UX:** Clear visualization of changes between revisions
  - [ ] **Deliverable:** Robust drawing revision control
  - [ ] **Dependencies:** F6.2

- **[ ] F6.4 Drawing References**
  - [ ] Create drawing reference management
  - [ ] Implement cross-drawing references
  - [ ] Add reference validation and integrity checks
  - [ ] Create reference visualization
  - [ ] Implement reference impact analysis
  - [ ] **Business Logic:** Maintain reference integrity during changes
  - [ ] **Deliverable:** Comprehensive drawing reference system
  - [ ] **Dependencies:** F6.2, F6.3

### **Phase 6: Testing - Drawing System**

- **[ ] F6.T1 Drawing Management Test Suite**
  - [ ] **Unit Tests:** Drawing CRUD operations, revision logic
  - [ ] **Integration Tests:** Drawing approval workflows, reference management
  - [ ] **E2E Tests:** Complete drawing lifecycle with revisions

---

### **Phase 7: RFA System (สัปดาห์ที่ 9-10)**

**Milestone:** ระบบขออนุมัติแบบสมบูรณ์พร้อม Dynamic Forms

### **Phase 7: Tasks**

- **[ ] F7.1 RFA List & Dashboard**

  - [ ] Create RFA dashboard with status overview
  - [ ] Implement advanced RFA filtering and search
  - [ ] Create RFA calendar view for deadlines
  - [ ] Add RFA statistics and reporting
  - [ ] Implement RFA bulk operations
  - [ ] **UX:** Comprehensive RFA overview and management
  - [ ] **Deliverable:** Complete RFA dashboard and listing
  - [ ] **Dependencies:** F4.1, F5.1

- **[ ] F7.2 RFA Creation with Dynamic Forms**

  - [ ] Create RFA type-specific form generator
  - [ ] Implement dynamic form fields based on RFA type:
    - [ ] RFA_DWG: Shop drawing selection
    - [ ] RFA_DOC: Document specifications
    - [ ] RFA_MES: Method statement details
    - [ ] RFA_MAT: Material specifications
  - [ ] Add form validation with JSON schema
  - [ ] Implement form data persistence and recovery
  - [ ] **UX:** Intuitive form experience for complex RFA types
  - [ ] Dynamic Form & Schema Validation: สร้าง Component Dynamic Form Generator ที่:
    - [ ] Fetch Schema: ดึงโครงสร้าง JSON Schema ที่ถูกต้องตาม rfa_type จาก Backend (ตาราง json_schemas ที่สร้างใหม่) ก่อนการ Render Form.
    - [ ] Client-side Validation: Implement AJV (Another JSON Schema Validator) หรือไลบรารีที่เทียบเท่า เพื่อทำ Client-side Validation บนข้อมูล JSON ก่อนส่ง Submit.
    - [ ] Implement dynamic form fields based on RFA type: RFA_DWG, RFA_DOC, RFA_MES, RFA_MAT.
    - [ ] Add form data persistence and recovery.
  - [ ] **[New] Discipline & Sub-Type Integration:** Ensure RFA forms capture these fields correctly for numbering generation.
  - [ ] **Deliverable:** Flexible RFA creation system
  - [ ] **Dependencies:** F4.2, F6.2

- **[ ] F7.3 RFA Workflow Integration**

  - [ ] Integrate RFA with unified workflow engine
  - [ ] Create RFA-specific workflow steps and actions
  - [ ] Implement RFA approval interface
  - [ ] Add RFA workflow history and tracking
  - [ ] Create RFA workflow templates
  - [ ] **Business Logic:** Proper RFA approval sequencing and validation
  - [ ] **Deliverable:** Seamless RFA workflow integration
  - [ ] **Dependencies:** F5.1, F7.2

- **[ ] F7.4 RFA Approval Interface**
  - [ ] Create RFA review and approval interface
  - [ ] Implement side-by-side document comparison
  - [ ] Add approval comments and attachments
  - [ ] Create conditional approval workflows
  - [ ] Implement approval delegation and escalation
  - [ ] **UX:** Efficient approval process for technical reviews
  - [ ] **Deliverable:** Comprehensive RFA approval system
  - [ ] **Dependencies:** F7.1, F7.3

### **Phase 7: Testing - RFA System**

- **[ ] F7.T1 RFA Test Suite**
  - [ ] **Unit Tests:** RFA form generation, validation logic
  - [ ] **Integration Tests:** Complete RFA lifecycle, workflow integration
  - [ ] **E2E Tests:** Multi-type RFA creation and approval workflows

---

### **Phase 8: Internal Workflows (สัปดาห์ที่ 11)**

**Milestone:** ระบบใบเวียนและการจัดการงานภายใน

### **Phase 8: Tasks**

- **[ ] F8.1 Circulation Management**

  - [ ] Create circulation list and management interface
  - [ ] Implement circulation creation from correspondence
  - [ ] Create circulation template management
  - [ ] Add circulation status tracking
  - [ ] Implement circulation search and filtering
  - [ ] **Business Logic:** Proper circulation-correspondence relationships
  - [ ] **Deliverable:** Comprehensive circulation management
  - [ ] **Dependencies:** F4.1, F5.2

- **[ ] F8.2 Task Assignment Interface**

  - [ ] Create task assignment interface with user selection
  - [ ] Implement task priority and deadline setting
  - [ ] Add task dependency management
  - [ ] Create task progress tracking
  - [ ] Implement task reassignment and delegation
  - [ ] **UX:** Intuitive task management and assignment
  - [ ] **Deliverable:** Efficient task assignment system
  - [ ] **Dependencies:** F8.1

- **[ ] F8.3 Internal Approval Flows**
  - [ ] Create internal approval workflow interface
  - [ ] Implement multi-level approval processes
  - [ ] Add approval chain visualization
  - [ ] Create approval delegation system
  - [ ] Implement approval deadline management
  - [ ] **Business Logic:** Proper approval hierarchy and escalation
  - [ ] **Deliverable:** Robust internal approval system
  - [ ] **Dependencies:** F8.1, F8.2

### **Phase 8: Testing - Internal Workflows**

- **[ ] F8.T1 Circulation Test Suite**
  - [ ] **Unit Tests:** Circulation creation, task assignment logic
  - [ ] **Integration Tests:** Complete circulation workflow, internal approvals
  - [ ] **E2E Tests:** End-to-end circulation with task completion

---

### **Phase 9: Advanced Features (สัปดาห์ที่ 12)**

**Milestone:** ฟีเจอร์ขั้นสูงและการปรับปรุงประสบการณ์ผู้ใช้

### **Phase 9: Tasks**

- **[ ] F9.1 Advanced Search Interface**

  - [ ] Create unified search interface across all document types
  - [ ] Implement faceted search with multiple filters
  - [ ] Add search result highlighting and relevance scoring
  - [ ] Create saved search and search templates
  - [ ] Implement search result export functionality
  - [ ] **Performance:** Efficient search with large datasets
  - [ ] **Deliverable:** Powerful cross-document search system
  - [ ] **Dependencies:** F4.1, F7.1

- **[ ] F9.2 Notification System**

  - [ ] Create notification center with real-time updates
  - [ ] Implement notification preferences management
  - [ ] Add notification grouping and digest views
  - [ ] Create actionable notifications with quick actions
  - [ ] Implement notification read/unread status
  - [ ] **UX:** Non-intrusive but effective notification delivery
  - [ ] **Deliverable:** Comprehensive notification management
  - [ ] **Dependencies:** F1.3, F5.4

- **[ ] F9.3 Reporting & Analytics**

  - [ ] Create reporting dashboard with customizable widgets
  - [ ] Implement data visualization components (charts, graphs)
  - [ ] Add report scheduling and export
  - [ ] Create ad-hoc reporting interface
  - [ ] Implement performance metrics tracking
  - [ ] **Business Logic:** Accurate data aggregation and reporting
  - [ ] **Deliverable:** Powerful reporting and analytics system
  - [ ] **Dependencies:** F1.3, F7.1

- **[ ] F9.4 Mobile Optimization**
  - [ ] Implement touch-optimized interactions
  - [ ] Create mobile-specific navigation patterns
  - [ ] Add offline capability for critical functions
  - [ ] Optimize images and assets for mobile networks
  - [ ] Implement mobile-specific performance optimizations
  - [ ] **UX:** Seamless mobile experience comparable to desktop
  - [ ] **Deliverable:** Fully optimized mobile application
  - [ ] **Dependencies:** F1.4

### **Phase 9: Testing - Advanced Features**

- **[ ] F9.T1 Advanced Features Test Suite**
  - [ ] **Unit Tests:** Search algorithms, notification logic
  - [ ] **Integration Tests:** Cross-module search, real-time notifications
  - [ ] **Performance Tests:** Search performance, mobile responsiveness

---

### **Phase 10: Testing & Polish (สัปดาห์ที่ 13-14)**

**Milestone:** แอปพลิเคชันที่ผ่านการทดสอบและปรับปรุงอย่างสมบูรณ์

### **Phase 10: Tasks**

- **[ ] F10.1 Comprehensive Testing**

  - [ ] Idempotency Testing: เพิ่มการทดสอบเฉพาะสำหรับ Axios Interceptor เพื่อจำลองการส่ง Request POST/PUT/DELETE ที่มี Idempotency-Key ซ้ำไปยัง Mock API (MSW) เพื่อยืนยันว่า Client-side ไม่ส่ง Key ซ้ำในการทำงานปกติ และไม่เกิด Side Effect จากการ Replay Attack.
  - [ ] Write unit tests for all components and utilities
  - [ ] Create integration tests for critical user flows
  - [ ] Implement E2E tests for complete workflows
  - [ ] Perform cross-browser compatibility testing
  - [ ] Conduct accessibility testing (WCAG 2.1 AA)
  - [ ] **Quality:** 80%+ test coverage, all critical paths tested
  - [ ] **Deliverable:** Fully tested application
  - [ ] **Dependencies:** All previous phases

- **[ ] F10.2 Performance Optimization**

  - [ ] Implement code splitting and lazy loading
  - [ ] Optimize bundle size and asset delivery
  - [ ] Add performance monitoring and metrics
  - [ ] Implement caching strategies for static assets
  - [ ] Optimize API call patterns and reduce over-fetching
  - [ ] **Performance:** Core Web Vitals targets met
  - [ ] **Deliverable:** High-performance application
  - [ ] **Dependencies:** F10.1

- **[ ] F10.3 Security Hardening**

  - [ ] Conduct security audit and penetration testing
  - [ ] Implement Content Security Policy (CSP)
  - [ ] Add security headers and protections
  - [ ] Conduct dependency vulnerability scanning
  - [ ] Implement secure coding practices review
  - [ ] **Security:** No critical security vulnerabilities
  - [ ] **Deliverable:** Security-hardened application
  - [ ] **Dependencies:** F10.1

- **[ ] F10.4 Documentation**
  - [ ] Create user documentation and guides
  - [ ] Write technical documentation for developers
  - [ ] Create API integration documentation
  - [ ] Add inline code documentation
  - [ ] Create deployment and maintenance guides
  - [ ] **Quality:** Comprehensive and up-to-date documentation
  - [ ] **Deliverable:** Complete documentation suite
  - [ ] **Dependencies:** F10.1

### **Phase 10: Testing - Final Validation**

- **[ ] F10.T1 Final Test Suite**
  - [ ] **Performance Tests:** Load testing, stress testing
  - [ ] **Security Tests:** Final security audit, vulnerability assessment
  - [ ] **User Acceptance Tests:** Real user testing, feedback incorporation
  - [ ] **Compatibility Tests:** Cross-browser, cross-device testing

---

## 📊 **สรุป Timeline**

| Phase    | ระยะเวลา       | จำนวนงาน     | Output หลัก                          |
| -------- | -------------- | ------------ | ------------------------------------ |
| Phase 0  | 1 สัปดาห์      | 4            | Foundation & Tooling Ready           |
| Phase 1  | 1 สัปดาห์      | 4            | Core Application Structure           |
| Phase 2  | 1 สัปดาห์      | 4            | User Management & Security           |
| Phase 3  | 1 สัปดาห์      | 3            | Project Structure Management         |
| Phase 4  | 2 สัปดาห์      | 4            | Correspondence System                |
| Phase 5  | 1 สัปดาห์      | 4            | Workflow Management                  |
| Phase 6  | 1 สัปดาห์      | 4            | Drawing System                       |
| Phase 7  | 2 สัปดาห์      | 4            | RFA System (Dynamic Forms)           |
| Phase 8  | 1 สัปดาห์      | 3            | Internal Workflows                   |
| Phase 9  | 1 สัปดาห์      | 4            | Advanced Features                    |
| Phase 10 | 2 สัปดาห์      | 4            | Testing & Polish (Idempotency Test)  |
| **รวม**  | **14 สัปดาห์** | **39 Tasks** | **Production-Ready Frontend v1.4.2** |

---

## 🎯 **Critical Success Factors**

1. **User Experience First:** ทุกฟีเจอร์ต้องออกแบบเพื่อประสบการณ์ผู้ใช้ที่ดี
2. **Responsive Design:** รองรับการใช้งานบนอุปกรณ์ทุกรูปแบบ
3. **Performance:** Core Web Vitals ต้องอยู่ในเกณฑ์ที่ดี
4. **Accessibility:** ต้องเป็นไปตามมาตรฐาน WCAG 2.1 AA
5. **Security:** ป้องกัน XSS, CSRF และความเสี่ยงด้านความปลอดภัยอื่นๆ
6. **Offline Support:** รองรับการทำงานแบบ Offline เบื้องต้น
7. **Real-time Updates:** การอัปเดตสถานะแบบ Real-time
8. **Testing Coverage:** ครอบคลุมการทดสอบทุก Critical Path
9. **Documentation:** เอกสารครบถ้วนสำหรับผู้ใช้และนักพัฒนา

---

## 📋 **Quality Assurance Checklist**

### **ก่อน Production Deployment**

- [ ] **Performance:** Core Web Vitals ผ่านเกณฑ์
- [ ] **Accessibility:** WCAG 2.1 AA compliant
- [ ] **Security:** Security audit ผ่าน
- [ ] **Testing:** Test coverage ≥ 80%
- [ ] **Browser Compatibility:** ทำงานได้บนเบราว์เซอร์หลัก
- [ ] **Mobile Responsive:** ใช้งานได้ดีบนมือถือ
- [ ] **Documentation:** เอกสารครบถ้วน
- [ ] **User Acceptance:** ได้รับการยอมรับจากผู้ใช้

---

## 🚀 **ขั้นตอนถัดไป**

1. **Approve แผนนี้** → ปรับแต่งตาม Feedback
2. **Coordinate กับ Backend Team** → Sync API Specifications
3. **เริ่มพัฒนา Phase 0** → Setup Foundation
4. **Regular Sync** → ประสานงานกับ Backend ทุกสัปดาห์
5. **User Testing** → ทดสอบกับผู้ใช้จริงระหว่างพัฒนา
6. **Deploy to Production** → Week 15 (พร้อม Backend)

## **Document Control:**

- **Document:** Frontend Development Plan v1.4.3
- **Version:** 1.4
- **Date:** 2025-11-26
- **Author:** NAP LCBP3-DMS & Gemini
- **Status:** FINAL-Rev.04
- **Classification:** Internal Technical Documentation
- **Approved By:** Nattanin

---

`End of Frontend Development Plan v1.4.4 (ฉบับปรับปรุง)`
