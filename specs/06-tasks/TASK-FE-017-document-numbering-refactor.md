# TASK-FE-017: Document Numbering Frontend Refactor

---
status: TODO
priority: HIGH
estimated_effort: 2-3 days
dependencies:
  - TASK-BE-017-document-numbering-refactor.md
  - specs/01-requirements/03.11-document-numbering.md (v1.6.2)
  - specs/03-implementation/document-numbering.md (v1.6.2)
---

## Objective

Refactor Frontend Document Numbering ตาม specification v1.6.2:
- ป้องกัน User แก้ไขเลขที่เอกสาร
- สร้าง Admin Dashboard ด้วย Metrics
- Implement Admin Tools (Manual Override, Void/Replace)

---

## Implementation Checklist

### 1. User Mode Forms (Create/Edit)

#### 1.1 Correspondence Form
- [ ] **Create Mode**: แสดง "Auto Generated" หรือ Preview เลขที่เอกสาร
- [ ] **Edit Mode**: ช่อง Document No เป็น **Read-Only** เสมอ
- [ ] **API Integration**: ตัดการส่ง field `documentNumber` ไป Backend ใน Edit mode

#### 1.2 RFA Form
- [ ] Same as above - Read-Only document number

#### 1.3 Transmittal Form
- [ ] Same as above - Read-Only document number

**Files:**
- `frontend/components/correspondences/form.tsx`
- `frontend/components/rfas/form.tsx`
- `frontend/components/transmittals/form.tsx`

---

### 2. Admin Dashboard (`/admin/numbering`)

#### 2.1 Tab Structure
```
/admin/numbering
├── Templates (existing - keep as is)
├── Metrics & Audit (NEW)
└── Admin Tools (NEW)
```

#### 2.2 Templates Tab (Existing)
- [ ] Keep current functionality
- [ ] เป็น Tab แรก (default)

#### 2.3 Metrics & Audit Tab (NEW)
- [ ] Fetch metrics from `GET /admin/document-numbering/metrics`
- [ ] Display:
  - Sequence utilization gauge
  - Lock wait time chart
  - Generation rate chart
  - Recent errors table
  - Audit logs table with filters

#### 2.4 Admin Tools Tab (NEW)
- [ ] **Manual Override Form**:
  - Input: document_type, document_number, reason
  - Calls `POST /admin/document-numbering/manual-override`

- [ ] **Void & Replace Form**:
  - Input: document_id, reason
  - Calls `POST /admin/document-numbering/void-and-replace`

- [ ] **Bulk Import Form**:
  - Upload CSV/Excel file
  - Preview before import
  - Calls `POST /admin/document-numbering/bulk-import`

---

### 3. API Integration

#### 3.1 New API Endpoints
```typescript
// services/document-numbering.service.ts (frontend)

interface NumberingMetrics {
  sequenceUtilization: number;
  lockWaitTimeP95: number;
  generationRate: number;
  recentErrors: ErrorEntry[];
}

// GET /admin/document-numbering/metrics
getMetrics(): Promise<NumberingMetrics>

// POST /admin/document-numbering/manual-override
manualOverride(dto: ManualOverrideDto): Promise<void>

// POST /admin/document-numbering/void-and-replace
voidAndReplace(dto: VoidReplaceDto): Promise<{ newDocumentNumber: string }>

// POST /admin/document-numbering/bulk-import
bulkImport(file: File): Promise<ImportResult>

// GET /document-numbering/logs/audit
getAuditLogs(params: AuditQueryParams): Promise<PaginatedAuditLogs>
```

#### 3.2 DTOs
```typescript
interface ManualOverrideDto {
  documentType: string;
  documentNumber: string;
  reason: string;
}

interface VoidReplaceDto {
  documentId: number;
  reason: string;
}

interface AuditQueryParams {
  operation?: 'RESERVE' | 'CONFIRM' | 'CANCEL' | 'MANUAL_OVERRIDE' | 'VOID' | 'GENERATE';
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
  page?: number;
  limit?: number;
}
```

---

### 4. Components to Create

| Component          | Path                                            | Description                 |
| ------------------ | ----------------------------------------------- | --------------------------- |
| MetricsDashboard   | `components/numbering/metrics-dashboard.tsx`    | Metrics charts and gauges   |
| AuditLogsTable     | `components/numbering/audit-logs-table.tsx`     | Filterable audit log viewer |
| ManualOverrideForm | `components/numbering/manual-override-form.tsx` | Admin tool form             |
| VoidReplaceForm    | `components/numbering/void-replace-form.tsx`    | Admin tool form             |
| BulkImportForm     | `components/numbering/bulk-import-form.tsx`     | CSV/Excel uploader          |

---

### 5. UI/UX Requirements

#### 5.1 Document Number Display
- ใช้ Badge หรือ Chip style สำหรับ Document Number
- สี: Info (blue) สำหรับ Auto-generated
- สี: Warning (amber) สำหรับ Manual Override
- สี: Destructive (red) สำหรับ Voided

#### 5.2 Admin Tools Access Control
- ซ่อน Admin Tools tab สำหรับ users ที่ไม่มี permission `system.manage_settings`
- แสดง confirmation dialog ก่อน Manual Override / Void

---

## Files to Create/Modify

| Action | Path                                                     |
| ------ | -------------------------------------------------------- |
| MODIFY | `frontend/app/(admin)/admin/numbering/page.tsx`          |
| CREATE | `frontend/components/numbering/metrics-dashboard.tsx`    |
| CREATE | `frontend/components/numbering/audit-logs-table.tsx`     |
| CREATE | `frontend/components/numbering/manual-override-form.tsx` |
| CREATE | `frontend/components/numbering/void-replace-form.tsx`    |
| CREATE | `frontend/components/numbering/bulk-import-form.tsx`     |
| MODIFY | `frontend/services/document-numbering.service.ts`        |
| MODIFY | `frontend/components/correspondences/form.tsx`           |

---

## Acceptance Criteria

- [ ] Document Number เป็น Read-Only ใน Edit mode ทุก form
- [ ] Admin Dashboard แสดง Metrics ได้ถูกต้อง
- [ ] Manual Override ทำงานได้และบันทึก Audit
- [ ] Void/Replace สร้างเลขใหม่และ link กับเอกสารเดิม
- [ ] Permission check ถูกต้องสำหรับ Admin Tools

---

## References

- [Requirements v1.6.2](../01-requirements/01-03.11-document-numbering.md)
- [Frontend Guidelines](../03-implementation/03-03-frontend-guidelines.md)
- [REQ-009 Original Task](REQ-009-DocumentNumbering.md)
