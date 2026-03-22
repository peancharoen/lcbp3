# Task: Frontend Schema v1.6.0 Adaptation

**Status:** ✅ Completed
**Priority:** P1 (High - Breaking Changes)
**Estimated Effort:** 2-3 days
**Dependencies:** TASK-BE-015 (Backend Migration)
**Owner:** Frontend Team

---

## 📋 Overview

อัพเดท Frontend Types, Services และ Forms ให้รองรับ Schema v1.6.0

---

## 🎯 Objectives

- [x] Update TypeScript Interfaces/Types
- [x] Update Form Components (field names)
- [x] Update API Service Calls
- [x] Update List/Table Columns
- [x] Verify E2E functionality

---

## 📊 Business Rule Changes Analysis

### 1. Correspondence Revisions ⚠️ UI IMPACT

| Change     | Old Field | New Field | Business Rule                                   |
| ---------- | --------- | --------- | ----------------------------------------------- |
| **Rename** | `title`   | `subject` | Form label เปลี่ยนจาก "หัวเรื่อง" เป็น "เรื่อง" |
| **Add**    | -         | `body`    | เพิ่ม Rich Text Editor สำหรับเนื้อความ          |
| **Add**    | -         | `remarks` | เพิ่ม Textarea สำหรับหมายเหตุ                   |
| **Add**    | -         | `dueDate` | เพิ่ม Date Picker สำหรับกำหนดส่ง                |

**UI Impact:**

- Correspondence Form: เพิ่ม 3 fields ใหม่
- Correspondence List: เปลี่ยน column header
- Correspondence Detail: แสดง body และ remarks

### 2. Correspondence Recipients ⚠️ RELATION CHANGE

| Before                     | After                    | Business Rule                     |
| -------------------------- | ------------------------ | --------------------------------- |
| Recipients ผูกกับ Revision | Recipients ผูกกับ Master | ผู้รับคงที่ตลอด Revisions ทั้งหมด |

**UI Impact:**

- ย้าย Recipients Selection ออกจาก Revision Form
- ไปอยู่ใน Master Correspondence Form แทน
- Recipients จะไม่เปลี่ยนเมื่อสร้าง New Revision

### 3. RFA System 🔄 ARCHITECTURE CHANGE

| Change           | Description                | Business Rule                                      |
| ---------------- | -------------------------- | -------------------------------------------------- |
| **Shared ID**    | RFA.id = Correspondence.id | สร้าง Correspondence ก่อน แล้ว RFA ใช้ ID เดียวกัน |
| **Subject**      | `title` → `subject`        | เหมือนกับ Correspondence                           |
| **Body/Remarks** | เพิ่ม fields ใหม่          | เหมือนกับ Correspondence                           |
| **Due Date**     | เพิ่ม field                | กำหนดวันที่ต้องตอบกลับ                             |

**UI Impact:**

- RFA Form: เพิ่ม body, remarks, dueDate
- RFA Creation Flow: อาจต้อง adjust การ submit

### 4. RFA Items ⚠️ API CHANGE

| Before                   | After           | Impact                                        |
| ------------------------ | --------------- | --------------------------------------------- |
| `rfaRevCorrespondenceId` | `rfaRevisionId` | เปลี่ยน property name ใน API request/response |

---

## 🛠️ Implementation Steps

### 1. Update TypeScript Types

```typescript
// lib/types/correspondence.ts

// BEFORE
interface CorrespondenceRevision {
  title: string;
  // ...
}

// AFTER
interface CorrespondenceRevision {
  subject: string; // renamed from title
  body?: string; // NEW
  remarks?: string; // NEW
  dueDate?: string; // NEW
  schemaVersion?: number; // NEW
  // ...
}

// Move recipients to master level
interface Correspondence {
  // ...existing fields
  recipients: CorrespondenceRecipient[]; // MOVED from revision
}
```

```typescript
// lib/types/rfa.ts

// BEFORE
interface RfaRevision {
  correspondenceId: number;
  title: string;
  // ...
}

// AFTER
interface RfaRevision {
  // correspondenceId: REMOVED
  subject: string; // renamed from title
  body?: string; // NEW
  remarks?: string; // NEW
  dueDate?: string; // NEW
  // ...
}

// BEFORE
interface RfaItem {
  rfaRevCorrespondenceId: number;
  // ...
}

// AFTER
interface RfaItem {
  rfaRevisionId: number; // renamed
  // ...
}
```

### 2. Update Form Components

```typescript
// app/(dashboard)/correspondences/new/page.tsx
// app/(dashboard)/correspondences/[id]/edit/page.tsx

// CHANGES:
// 1. Rename form field: title → subject
// 2. Add new fields: body, remarks, dueDate
// 3. Move recipients to master section (not revision)

<FormField name="subject" label="เรื่อง" required />  {/* was: title */}
<FormField name="body" label="เนื้อความ" type="richtext" />  {/* NEW */}
<FormField name="remarks" label="หมายเหตุ" type="textarea" />  {/* NEW */}
<FormField name="dueDate" label="กำหนดส่ง" type="date" />  {/* NEW */}
```

### 3. Update List Columns

```typescript
// components/correspondence/correspondence-list.tsx

const columns = [
  // BEFORE: { header: 'หัวเรื่อง', accessorKey: 'title' }
  // AFTER:
  { header: 'เรื่อง', accessorKey: 'subject' },
  { header: 'กำหนดส่ง', accessorKey: 'dueDate' }, // NEW column
];
```

### 4. Update API Services

```typescript
// lib/services/correspondence.service.ts
// lib/services/rfa.service.ts

// Update DTO property names in API calls
// Ensure field mapping matches backend changes
```

---

## 🗂️ Files to Modify

### Types

| File                          | Status | Changes                                 |
| ----------------------------- | ------ | --------------------------------------- |
| `lib/types/correspondence.ts` | ✅     | title→subject, add body/remarks/dueDate |
| `lib/types/rfa.ts`            | ✅     | Same + remove correspondenceId          |

### Forms

| File                                                 | Status | Changes                |
| ---------------------------------------------------- | ------ | ---------------------- |
| `app/(dashboard)/correspondences/new/page.tsx`       | ✅     | Add new fields, rename |
| `app/(dashboard)/correspondences/[id]/edit/page.tsx` | ✅     | Same                   |
| `app/(dashboard)/rfas/new/page.tsx`                  | ✅     | Add new fields, rename |
| `app/(dashboard)/rfas/[id]/edit/page.tsx`            | ✅     | Same                   |

### Lists/Tables

| File                                                | Status | Changes       |
| --------------------------------------------------- | ------ | ------------- |
| `components/correspondence/correspondence-list.tsx` | ✅     | Column rename |
| `components/rfa/rfa-list.tsx`                       | ✅     | Column rename |

### Services

| File                                     | Status | Changes     |
| ---------------------------------------- | ------ | ----------- |
| `lib/services/correspondence.service.ts` | ✅     | DTO mapping |
| `lib/services/rfa.service.ts`            | ✅     | DTO mapping |

---

## ✅ Verification

### Manual Testing

1. **Correspondence Flow:**
   - [ ] Create new correspondence → verify subject, body, remarks saved
   - [ ] Edit existing → verify field display correctly
   - [ ] List view shows "เรื่อง" column

2. **RFA Flow:**
   - [ ] Create new RFA → verify new fields
   - [ ] Add RFA Items → verify API works with new field names
   - [ ] Due date displays and functions correctly

3. **Recipients:**
   - [ ] Recipients assigned at master level
   - [ ] Creating new revision doesn't reset recipients

### E2E Tests

```bash
pnpm test:e2e -- --grep "correspondence"
pnpm test:e2e -- --grep "rfa"
```

---

## 📚 Related Documents

- [TASK-BE-015](./TASK-BE-015-schema-v160-migration.md) - Backend Migration
- [Schema v1.6.0](../07-database/lcbp3-v1.6.0-schema.sql)
- [CHANGELOG v1.6.0](../../CHANGELOG.md)

---

## 🚨 Risks & Mitigation

| Risk                   | Impact | Mitigation                   |
| ---------------------- | ------ | ---------------------------- |
| Field name mismatch    | High   | Coordinate with backend team |
| Form validation errors | Medium | Test all forms thoroughly    |
| List display issues    | Low    | Update column configs        |

---

## 📌 Notes

- ต้องรอ Backend deploy ก่อน จึงจะ test ได้
- Recipients logic change อาจส่งผลต่อ business flow
- Consider feature flag for gradual rollout
