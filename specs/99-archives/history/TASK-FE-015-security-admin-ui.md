# TASK-FE-015: Security & System Administration UI

**ID:** TASK-FE-015
**Title:** Security & System Administration UI
**Category:** Administration
**Priority:** P2 (High)
**Effort:** 5-7 days
**Dependencies:** TASK-FE-010, TASK-BE-002, TASK-BE-011
**Assigned To:** Frontend Developer

---

## 📋 Overview

Provide advanced administrative tools for managing system security (RBAC), monitoring active user sessions, and viewing system-level error logs (specifically for critical features like Document Numbering).

---

## 🎯 Objectives

1. **RBAC Matrix Editor:** Visual interface to assign permissions to roles.
2. **Session Management:** View and revoke active user sessions/tokens.
3. **System Logs:** View specific error logs (e.g., `document_number_errors`) and Audit Logs.

---

## ✅ Acceptance Criteria

- [ ] **RBAC Matrix:** Grid view showing Roles (Columns) vs Permissions (Rows) with toggle switches.
- [ ] **Session Monitor:** List active users/sessions with "Force Logout" capability.
- [ ] **Numbering Logs:** Specific view for `document_number_audit` and `document_number_errors`.
- [ ] **Security:** These pages must be restricted to Super Admin only.

---

## 🔧 Implementation Steps

### Step 1: RBAC Matrix Component

```typescript
// File: src/components/admin/security/rbac-matrix.tsx
'use client';

import { Checkbox } from '@/components/ui/checkbox';
// ...

// Matrix layout:
// | Permission | Admin | User | Approver |
// |------------|-------|------|----------|
// | rfa.view   | [x]   | [x]  | [x]      |
// | rfa.create | [x]   | [ ]  | [ ]      |

export function RbacMatrix({ roles, permissions, matrix }) {
  const handleToggle = (roleId, permId) => {
     // Call API to toggle permission
  };

  return (
    <Table>
      {/* ... Render Matrix ... */}
    </Table>
  );
}
```

### Step 2: Active Sessions Page

```typescript
// File: src/app/(admin)/admin/security/sessions/page.tsx
'use client';

// List active refresh tokens or sessions from backend
// Columns: User, IP, Last Active, Device, Actions (Revoke)
```

### Step 3: Document Numbering Logs

```typescript
// File: src/app/(admin)/admin/logs/numbering/page.tsx
'use client';

// specific table for 'document_number_errors' and 'document_number_audit'
// Critical for diagnosing failed number generation
```

---

## 📦 Deliverables

- [ ] RBAC Configuration Page
- [ ] Active Sessions / Security Page
- [ ] Document Numbering Diagnostics Page

---

## 🔗 Related Documents

- [TASK-BE-002: Auth & RBAC](./TASK-BE-002-auth-rbac.md)
- [TASK-BE-011: Notification & Audit](./TASK-BE-011-notification-audit.md)
