# Task: Circulation & Transmittal UI

**Status:** Not Started
**Priority:** P2 (Medium)
**Estimated Effort:** 5-7 days
**Dependencies:** TASK-FE-005, TASK-BE-009
**Owner:** Frontend Team

---

## 📋 Overview

Implement the **Circulation** (Internal Distribution) and **Transmittal** (External Submission) modules in the Frontend. These interfaces will allow users to manage document distribution, track assignees, and generate transmittal slips.

---

## 🎯 Objectives

- ✅ **Circulation UI:** Create, View, and Track internal circulations.
- ✅ **Transmittal UI:** Create Transmittals, Manage Items, and Print/Export PDF.
- ✅ **Integration:** Connect with Backend APIs for data persistence and workflow actions.
- ✅ **UX/UI:** User-friendly document selection and assignee management.

---

## 📝 Acceptance Criteria

### 1. Circulation Module

- [ ] **List View:** Display circulations with status, due date, and progress indicators.
- [ ] **Create Form:**
  - [ ] Select Subject/Title.
  - [ ] **Assignee Selector:** Multi-select users for Main/Action/Info roles.
  - [ ] **Document Linker:** Search and select existing Correspondence/RFAs to attach.
- [ ] **Detail View:**
  - [ ] Show overall status.
  - [ ] List of assignees with their individual status (Pending/Completed).
  - [ ] Action button for Assignee to "Complete" their task with remarks.

### 2. Transmittal Module

- [ ] **List View:** Display transmittals with transmittal number, recipient, and date.
- [ ] **Create Form:**
  - [ ] Header info (Attention To, Organization, Date).
  - [ ] **Item Manager:** Add/Remove documents (Correspondence/RFA/Drawing) to the transmittal list.
  - [ ] Specify "Number of Copies" for each item.
- [ ] **Detail View:** Read-only view of the transmittal slip.
- [ ] **PDF Export:** Button to download the generated Transmittal PDF.

---

## 🛠️ Implementation Steps

### 1. API Services & Types

Create TypeScript interfaces and API service methods.

```typescript
// types/circulation.ts
export interface Circulation {
  id: number;
  circulation_number: string;
  subject: string;
  due_date: string;
  status: 'active' | 'completed';
  assignees: CirculationAssignee[];
  correspondences: Correspondence[]; // Linked docs
}

export interface CirculationAssignee {
  id: number;
  user_id: number;
  user_name: string; // Mapped from User entity
  status: 'pending' | 'completed';
  remarks?: string;
}

// services/circulation-service.ts
// - getCirculations(params)
// - getCirculationById(id)
// - createCirculation(data)
// - completeAssignment(id, assigneeId, data)
```

```typescript
// types/transmittal.ts
export interface Transmittal {
  id: number;
  transmittal_number: string;
  attention_to: string;
  transmittal_date: string;
  items: TransmittalItem[];
}

export interface TransmittalItem {
  document_type: 'correspondence' | 'rfa' | 'drawing';
  document_id: number;
  document_number: string;
  document_title: string;
  number_of_copies: number;
}

// services/transmittal-service.ts
// - getTransmittals(params)
// - getTransmittalById(id)
// - createTransmittal(data)
// - downloadTransmittalPDF(id)
```

### 2. UI Components

#### Circulation

- **`components/circulation/circulation-list.tsx`**: DataTable with custom columns.
- **`components/circulation/circulation-form.tsx`**:
  - Use `Combobox` for searching Users.
  - Use `DocumentSelector` (shared component) for linking Correspondence/RFAs.
- **`components/circulation/assignee-status-card.tsx`**: Component to show assignee progress.

#### Transmittal

- **`components/transmittal/transmittal-list.tsx`**: Standard DataTable.
- **`components/transmittal/transmittal-form.tsx`**:
  - Header fields (Recipient, Date, etc.)
  - **Items Table**: Dynamic rows to add documents.
    - Column 1: Document Type (Select).
    - Column 2: Document Search (AsyncSelect).
    - Column 3: Copies (Input Number).
    - Action: Remove Row.

### 3. Pages & Routing

- `app/(dashboard)/circulation/page.tsx`: List View
- `app/(dashboard)/circulation/new/page.tsx`: Create View
- `app/(dashboard)/circulation/[id]/page.tsx`: Detail View
- `app/(dashboard)/transmittals/page.tsx`: List View
- `app/(dashboard)/transmittals/new/page.tsx`: Create View
- `app/(dashboard)/transmittals/[id]/page.tsx`: Detail View

---

## 🧪 Testing Strategy

- **Unit Tests:** Test form validation logic (e.g., at least one assignee required).
- **Integration Tests:** Mock API calls to verify data loading and submission.
- **E2E Tests:**
  1. Login as User A.
  2. Create a Circulation and assign to User B.
  3. Logout and Login as User B.
  4. Verify notification/dashboard task.
  5. Complete the assignment.
  6. Verify Circulation status updates.

---

## 📚 Resources

- [Figma Design - Circulation](https://figma.com/...) (Internal Link)
- [Backend Task: BE-009](../TASK-BE-009-circulation-transmittal.md)
