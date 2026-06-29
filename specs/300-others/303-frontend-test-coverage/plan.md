# Implementation Plan: Frontend Test Coverage — Phased Improvement

**Branch**: `303-frontend-test-coverage` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/300-others/303-frontend-test-coverage/spec.md`

## Summary

เพิ่ม Unit Test และ Integration Test สำหรับ Frontend (Next.js + TypeScript) เพื่อยก Statement Coverage จาก 13.54% ขึ้นเป็นระยะๆ (Phase 1: ≥30%, Phase 2: ≥50%, Phase 3: ≥70%) โดยใช้ Vitest + React Testing Library เป็น test framework หลัก ตามลำดับความสำคัญทางธุรกิจของระบบ NAP-DMS

## Technical Context

**Language/Version**: TypeScript 5.x (Strict mode)
**Primary Dependencies**: Vitest, @testing-library/react, @testing-library/user-event
**Storage**: N/A (Frontend test only — mock HTTP calls)
**Testing**: Vitest + React Testing Library + vi.mock (ไม่ใช้ MSW เป็น default)
**Target Platform**: Next.js App Router (frontend only)
**Performance Goals**: Test suite ทั้งหมดรันเสร็จใน < 60 วินาที
**Constraints**: ต้อง mock HTTP ทุกครั้ง — ห้ามเรียก API จริง; ห้ามใช้ `any` หรือ `console.log`
**Scale/Scope**: ~5,012 statements, ~1,844 functions ใน frontend codebase

## Constitution Check

_GATE: Must pass before Phase 0 research._

| Gate | Status | Notes |
|------|--------|-------|
| ADR-019 UUID: ห้าม `parseInt` / `id ?? ''` บน publicId | ✅ PASS | test ต้องใช้ `publicId` ตรงๆ ในทุก mock data |
| ADR-016 Security: CASL guard ใน component | ✅ PASS | test coverage สำหรับ auth ต้อง mock permission context |
| TypeScript Strict: ZERO `any` | ✅ PASS | เป็น scope ของ test files ที่ต้องปฏิบัติ |
| ZERO `console.log` | ✅ PASS | test files ต้องไม่มี console.log |
| Thai comments | ✅ PASS | JSDoc และ comments ใน test ต้องเป็นภาษาไทย |
| i18n: ห้าม hardcode text | ✅ PASS | test ควร assert ด้วย i18n key หรือ mock translation |
| No `DROP`/`RENAME` schema | ✅ N/A | งาน test ไม่มี schema change |
| File headers (`// File: path`) | ✅ PASS | ทุก test file ต้องมี file header |

## Project Structure

### Documentation (this feature)

```text
specs/300-others/303-frontend-test-coverage/
├── spec.md              ✅ Created
├── plan.md              ✅ This file
├── research.md          ⏳ Phase 0 output (pending)
└── tasks.md             📋 Phase 1 output (speckit-tasks)
```

### Source Code Layout (test files เพิ่มข้างๆ source)

```text
frontend/
├── components/
│   ├── correspondences/
│   │   ├── CorrespondenceList.tsx
│   │   ├── CorrespondenceList.spec.tsx   ← NEW (Phase 1)
│   │   ├── CorrespondenceForm.tsx
│   │   └── CorrespondenceForm.spec.tsx   ← NEW (Phase 1)
│   ├── rfas/
│   │   └── *.spec.tsx                    ← NEW (Phase 2)
│   ├── numbering/
│   │   └── *.spec.tsx                    ← NEW (Phase 2)
│   ├── admin/
│   │   └── *.spec.tsx                    ← NEW (Phase 3)
│   └── workflow/
│       └── *.spec.tsx                    ← NEW (Phase 3)
├── hooks/
│   └── *.spec.ts                         ← NEW (Phase 1)
└── lib/
    ├── services/
    │   └── *.spec.ts                     ← NEW (Phase 1)
    └── api/
        └── *.spec.ts                     ← NEW (Phase 2)
```

---

## Phase 1 Design: Test Architecture Patterns

### Pattern A — Custom Hook Test

```typescript
// File: hooks/use-[name].spec.ts
// Change Log: [DATE] - สร้างใหม่สำหรับ Phase 1 Coverage
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// สร้าง QueryClient wrapper สำหรับทุก hook test
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
```

### Pattern B — Service Function Test

```typescript
// File: lib/services/[name].service.spec.ts
// Change Log: [DATE] - สร้างใหม่สำหรับ Phase 1 Coverage
import { vi, describe, it, expect, beforeEach } from 'vitest';

// mock HTTP client ก่อนเสมอ
vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
```

### Pattern C — React Component Test

```typescript
// File: components/[module]/[Component].spec.tsx
// Change Log: [DATE] - สร้างใหม่สำหรับ Phase Coverage
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
// mock data ต้องใช้ publicId เสมอ (ADR-019)
const mockItem = {
  publicId: '019505a1-7c3e-7000-8000-abc123def456', // UUIDv7
  // ห้ามใช้ id: 1 หรือ uuid: '...'
};
```

---

## Phase Roadmap

### Phase 1 — Foundation (13% → 30%)

**เป้าหมาย**: เพิ่ม test ในส่วนที่มี coverage อยู่แล้วบางส่วนให้ครบขึ้น

| โฟลเดอร์ | Coverage ปัจจุบัน | เป้าหมาย | Priority |
|----------|-------------------|----------|---------|
| `hooks/` | 30.46% | ≥ 70% | P1 |
| `hooks/ai` | 44.11% | ≥ 80% | P1 |
| `lib/services/` | 16.64% | ≥ 70% | P1 |
| `components/correspondences/` | 21.27% | ≥ 60% | P1 |
| `components/common/` | 26.66% | ≥ 60% | P1 |
| `components/ui/` | 31.69% | ≥ 60% | P2 |

**ไฟล์ที่ต้องสร้าง**: ประมาณ 15-25 spec files

### Phase 2 — Core Business (30% → 50%)

**เป้าหมาย**: ครอบคลุม Core Business Feature ที่เป็น 0%

| โฟลเดอร์ | Coverage ปัจจุบัน | เป้าหมาย | Priority |
|----------|-------------------|----------|---------|
| `components/rfas/` | 0% | ≥ 60% | P1 |
| `components/numbering/` | 0% | ≥ 60% | P1 |
| `lib/api/` | 0.38% | ≥ 70% | P1 |
| `components/drawings/` | 0% | ≥ 50% | P2 |
| `components/auth/` | 0% | ≥ 70% | P2 |
| `components/workflows/` | 15.38% | ≥ 60% | P2 |

**ไฟล์ที่ต้องสร้าง**: ประมาณ 20-30 spec files

### Phase 3 — Admin & Infrastructure (50% → 70%)

**เป้าหมาย**: ครอบคลุมส่วน Admin, Layout, และ Workflow Engine

| โฟลเดอร์ | Coverage ปัจจุบัน | เป้าหมาย | Priority |
|----------|-------------------|----------|---------|
| `components/admin/` | 0% | ≥ 60% | P1 |
| `components/admin/ai` | 0% | ≥ 60% | P1 |
| `components/workflow/` | 0% | ≥ 65% | P1 |
| `components/layout/` | 0% | ≥ 50% | P2 |
| `components/transmittal/` | 0% | ≥ 60% | P2 |
| `components/circulation/` | 0% | ≥ 60% | P2 |
| `lib/stores/` | 6.06% | ≥ 60% | P2 |
| `lib/utils/` | 0% | ≥ 80% | P3 |

**ไฟล์ที่ต้องสร้าง**: ประมาณ 25-35 spec files

---

## Verification Plan

### แต่ละ Phase

```powershell
# รันจาก E:\np-dms\lcbp3\frontend
cd E:\np-dms\lcbp3\frontend
npm run test:cov

# ดูตัวเลขสรุปที่ terminal output
# ยืนยัน Statements % ถึงเป้าก่อน merge
```

### Definition of Done (แต่ละ Phase)

- [ ] Statement Coverage ≥ เป้าของ Phase นั้น
- [ ] ไม่มี test fail (0 failed)
- [ ] ไม่มี `any` หรือ `console.log` ใน test files
- [ ] ทุก test file มี `// File:` header
- [ ] ทุก mock data ใช้ `publicId` (UUIDv7) ไม่ใช่ `id` ตัวเลข (ADR-019)
- [ ] Bug ที่พบระหว่างเขียน test ถูก fix และ commit ใน PR เดียวกัน

### Coverage Run Record

| Date | Command | Test Files | Tests | Statements | Branches | Functions | Lines | Status |
|------|---------|------------|-------|------------|----------|-----------|-------|--------|
| 2026-06-14 | `pnpm --filter lcbp3-frontend exec vitest run --coverage` | 92 passed | 692 passed | 51.62% | 41.03% | 50.27% | 52.47% | Phase 2 gate passed (≥50% statements) |
