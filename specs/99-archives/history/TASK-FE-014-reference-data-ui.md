# TASK-FE-014: Reference Data & Lookups UI

**ID:** TASK-FE-014
**Title:** Reference Data & Lookups Management UI
**Category:** Administration
**Priority:** P3 (Low)
**Effort:** 3-5 days
**Dependencies:** TASK-FE-010, TASK-BE-012
**Assigned To:** Frontend Developer

---

## 📋 Overview

Build a generic or specific UI for managing various system lookup tables (Master Data) that are essential for the application but change infrequently. This includes Disciplines, Drawing Categories, RFA Types, and Tags.

---

## 🎯 Objectives

1. Manage **Correspondence Types** (and Sub-types)
2. Manage **RFA Types** and associated **Approve Codes**
3. Manage **Drawing Categories** (Main & Sub-categories)
4. Manage **Disciplines** (System-wide codes)
5. Manage **Tags** and other minor lookups

---

## ✅ Acceptance Criteria

- [ ] Admin can create/edit/delete Correspondence Types
- [ ] Admin can manage RFA Types and their Approve Codes
- [ ] Admin can configure Drawing Categories (Main/Sub)
- [ ] Admin can manage Disciplines (Code & Name)
- [ ] UI supports "Soft Delete" (Active/Inactive toggle)
- [ ] Updates reflect immediately in dropdowns across the system

---

## 🔧 Implementation Steps

### Step 1: Specific Lookup Pages vs Generic Table

Since these tables have similar structures (Code, Name, Description, IsActive), you can either build:
A. **Generic Master Data Component** (Recommended for simple tables)
B. **Dedicated Pages** for complex relations (like Categories -> Sub-categories)

#### Recommended Approach

- **Dedicated Page:** for RFA Types (due to relationship with Approve Codes)
- **Dedicated Page:** for Drawing Categories (Hierarchical)
- **Generic/Shared Page:** for Disciplines, Tags, Correspondence Types

### Step 2: RFA Configuration Page

```typescript
// File: src/app/(admin)/admin/reference/rfa-types/page.tsx
'use client';

import { useState } from 'react';
import { DataTable } from '@/components/common/data-table';
import { Button } from '@/components/ui/button';
// ... imports

export default function RfaConfigPage() {
  const [types, setTypes] = useState([]);

  // Columns: Code, Name, Contract, Active Status, Actions

  return (
     <div className="p-6">
        <div className="flex justify-between mb-6">
           <h1 className="text-2xl font-bold">RFA Types Configuration</h1>
           <Button>Add Type</Button>
        </div>
        <DataTable data={types} columns={/*...*/} />
     </div>
  );
}
```

### Step 3: Disciplines Management

```typescript
// File: src/app/(admin)/admin/reference/disciplines/page.tsx
'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Simple table to manage 'disciplines'
// Fields: discipline_code, code_name_th, code_name_en
```

### Step 4: Drawing Categories (Hierarchy)

```typescript
// File: src/app/(admin)/admin/reference/drawing-categories/page.tsx
// Needs to handle Main Category -> Sub Category relationship
```

---

## 📦 Deliverables

- [ ] RFA Types Management Page
- [ ] Drawing Categories Management Page
- [ ] Disciplines Management Page
- [ ] Correspondence Types Management Page
- [ ] Unified "Reference Data" Sidebar Group

---

## 🔗 Related Documents

- [TASK-BE-012: Master Data Management](./TASK-BE-012-master-data-management.md)
