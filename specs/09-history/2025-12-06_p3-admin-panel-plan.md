# P3-1: Frontend Admin Panel Implementation Plan

## Goal
Implement a functional Admin Panel for User and Master Data Management, connected to existing Backend APIs.

## Scope
1.  **Admin Layout**: Sidebar navigation and layout structure at `/app/(admin)`.
2.  **User Management**:
    *   List Users (`GET /users`) with pagination/filtering.
    *   Create/Edit User (`POST /users`, `PATCH /users/:id`).
    *   Assign Roles (`POST /users/assign-role`).
3.  **Organization Management**:
    *   List Organizations (`GET /organizations`).
    *   Create/Edit Organization (`POST`, `PATCH`).

## Implementation Steps

### 1. Admin Layout & Navigation
- **File**: `app/(admin)/layout.tsx`
- **File**: `components/admin/admin-sidebar.tsx`
- **Logic**: Ensure only users with `ADMIN` role can access.

### 2. User Management
- **Page**: `app/(admin)/admin/users/page.tsx`
- **Components**:
    *   `components/admin/users/user-table.tsx` (using `tanstack/react-table`)
    *   `components/admin/users/user-dialog.tsx` (Create/Edit Form with Zod validation)

### 3. Organization Management
- **Page**: `app/(admin)/admin/organizations/page.tsx`
- **Components**:
    *   `components/admin/orgs/org-table.tsx`
    *   `components/admin/orgs/org-dialog.tsx`

## Dependencies
- Backend Endpoints: verified (`UserController`, `OrganizationController`).
- UI Components: `Table`, `Dialog`, `Form` (Shadcn/UI - already installed).

## Verification
- [ ] Login as Admin.
- [ ] Navigate to `/admin/users`.
- [ ] Create a new user and verify in DB/List.
- [ ] Edit user details.
- [ ] Create a new Organization.
