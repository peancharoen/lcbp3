# TASK-BEFE-001: System Refactoring for Scale & Security (v2.0)

> **Status:** REVIEW
> **Priority:** HIGH
> **Target Version:** v2.0.0
> **Effort:** 4 Weeks (Phased)

---

## 🎯 Objective

Refactor the DMS system (Backend & Frontend) to support **High Scalability (100k+ Documents)**, **Enhanced Security (RBAC/Audit)**, and **Enterprise-Grade UX**. This task consolidates three key initiatives:
1.  **Advanced Storage Management:** Optimize file storage for large datasets (Data Integrity).
2.  **Admin Panel Refactor:** Secure and reorganize the administrative interface.
3.  **Document Management Interface:** Improve frontend performance and usability for large document lists.

---

## 📅 Roadmap & Phases

| Phase       | Focus Area                   | Key Deliverables                                                  |
| :---------- | :--------------------------- | :---------------------------------------------------------------- |
| **Phase 1** | **Security & Core Fixes**    | Admin Bypass Removal, Session Kill Switch, Storage Permissions    |
| **Phase 2** | **Data Integrity & Storage** | New Storage Logic (Issue Date), Schema Adjustments, Bulk RBAC API |
| **Phase 3** | **Frontend Foundation**      | Server-side DataTable, New Folder Structure, API Optimization     |
| **Phase 4** | **UX & Migration**           | Admin UI Reorg, Document Tabs, Legacy Data Migration              |

---

## 🛠️ Implementation Checklist

### 1. Advanced Storage Management (Backend)

**Goal:** Shift from "Upload Date" to "Issue Date" storage logic and implement deep directory structures for performance.

#### 1.1 Database Schema (Data Integrity)
- [ ] **Verify Date Columns:** Ensure `rfa`, `correspondence`, `drawing_revisions` have a reliable `issue_date` or `document_date`.
- [ ] **Update Attachments Table:** Add `reference_date` column to `attachments` to freeze the storage path date (prevents broken paths if document date changes).

#### 1.2 FileStorageService Refactor
- [ ] **Update `commit()` Logic:** Change storage path generation logic.
    - *Old:* `/permanent/YYYY/MM/uuid.pdf` (based on execution time)
    - *New:* `/permanent/{DocumentType}/{YYYY}/{MM}/{uuid}.pdf` (based on `issue_date`)
- [ ] **Fail-safe Logic:** Implement fallback to `created_at` if `issue_date` is missing.

#### 1.3 Infrastructure & Security
- [ ] **Deep Directory Structure:** Implement logic to handle nested folders to verify Inode limits.
- [ ] **Path Isolation:** Ensure Web Server (NestJS) has `ReadOnly` access to `permanent` storage, `Write` only for specific services.
- [ ] **Streaming Proxy:** Enforce file access via API Stream only (Check RBAC -> Stream File), never expose direct static paths.

#### 1.4 Data Migration (Legacy Support)
- [ ] **Develop Migration Script:**
    1. Scan `attachments` where `is_temporary = false`.
    2. Retrieve `issue_date` from parent entity.
    3. Move file to new structure.
    4. Update `stored_path` in DB.

---

### 2. Admin Panel Refactor (Frontend & Backend)

**Goal:** Secure the Admin Panel and reorganize the UI for better usability.

#### 2.1 Critical Security Fixes (Immediate)
- [ ] **Remove Hardcoded Bypass:** Delete `const isAdmin = true;` in `frontend/app/(admin)/layout.tsx`. Validate `session.user.role` from JWT.
- [ ] **Middleware Enforcement:** Update `frontend/middleware.ts` to strictly require `ADMIN` or `DC` roles for `/admin/**` routes.
- [ ] **Session Kill Switch:** Implement Backend endpoint and Frontend UI to revoke active user sessions.

#### 2.2 Backend Optimization
- [ ] **Bulk RBAC Update:** Create `PUT /roles/permissions/bulk` endpoint to handle multiple permission changes in a single transaction (Fixes Loop API issue).
- [ ] **Audit Log Pagination:** Update `AuditLogService` to support Server-side Pagination (`page`, `limit`, `filters`).

#### 2.3 Frontend Reorganization (UI/UX)
- [ ] **Refactor Folder Structure:** Group admin pages logically:
    - `/admin/access-control/` (Users, Roles, Sessions)
    - `/admin/doc-control/` (Numbering, Workflows, Master Data)
    - `/admin/monitoring/` (Audit Logs, Health)
    - `/admin/settings/`
- [ ] **Shared Components:** Implement `AdminPageHeader` and `AdminDataTable` for consistency.

---

### 3. Document Management Interface (Frontend)

**Goal:** Support browsing 100k+ documents with high performance and better UX.

#### 3.1 Performance (Server-Side Logic)
- [ ] **Update Hooks:** Refactor `useDrawings` (and others) to accept `page`, `limit`, `sort`, `filter` params.
- [ ] **ServerDataTable Component:** Create a reusable Table component that handles Server-side pagination and sorting events efficiently.

#### 3.2 UI Structure & Navigation
- [ ] **Tabbed Interface:** Split documents by category (e.g., Contract / Shop / As-Built) using Tabs to load data lazily.
- [ ] **Visual Cues:** Add distinct Badges for Revision Status (e.g., "Current" vs "Superseded").

#### 3.3 Data Integrity Features
- [ ] **Pre-upload Validation:** Implement `NumberPreviewCard` to check Document Number availability in real-time before submission.
- [ ] **Revision Guard:** Validate `nextPossibleRevision` to prevent skipping revisions (e.g., A -> C).

---

## 📂 Technical Guidelines

### Backend: Bulk Permission DTO
```typescript
export class BulkRolePermissionDto {
  @IsNumber()
  roleId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionChangeDto)
  changes: PermissionChangeDto[];
}
```

### Frontend: Sidebar Navigation Structure
```typescript
const adminMenu = [
  { title: "Overview", items: [{ title: "Dashboard", href: "/admin/dashboard" }] },
  { title: "Access Control", items: [
      { title: "Users", href: "/admin/access-control/users" },
      { title: "Roles & Matrix", href: "/admin/access-control/roles" }
    ]
  },
  // ...
];
```

---

## ✅ Acceptance Criteria

1.  **Security:** Non-admin users MUST NOT access any `/admin` route.
2.  **Performance:** Document lists with 100k records must load first page in < 200ms.
3.  **Data Integrity:** Files are stored in structure `/permanent/{Type}/{Year}/{Month}/`.
4.  **Reliability:** Bulk Permission updates are atomic (all or nothing).