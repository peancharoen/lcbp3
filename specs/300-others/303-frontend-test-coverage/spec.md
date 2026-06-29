# Feature Specification: Frontend Test Coverage — Phased Improvement

**Feature Branch**: `303-frontend-test-coverage`
**Created**: 2026-06-13
**Status**: Draft
**Category**: 300 - Others (Quality Improvement)

## Background

รายงาน Code Coverage ของ Frontend (Istanbul.js) ณ วันที่ 2026-06-13 แสดงผลดังนี้:

| Metric     | Current   | Total      |
| ---------- | --------- | ---------- |
| Statements | 13.54%    | 679/5,012  |
| Branches   | 7.80%     | 301/3,857  |
| Functions  | 13.72%    | 253/1,844  |
| Lines      | 13.84%    | 656/4,738  |

โฟลเดอร์ที่มี Coverage > 0% อยู่แล้ว:

| Folder                     | Statements |
| -------------------------- | ---------- |
| `hooks`                    | 30.46%     |
| `hooks/ai`                 | 44.11%     |
| `components/ui`            | 31.69%     |
| `components/common`        | 26.66%     |
| `components/response-code` | 26.41%     |
| `components/correspondences`| 21.27%    |
| `lib/services`             | 16.64%     |
| `components/workflows`     | 15.38%     |
| `components/ai`            | 23.7%      |

โฟลเดอร์ที่เป็น 0% และมีขนาดใหญ่ที่สุด (เรียงตามจำนวน statements):

| Folder                     | Statements |
| -------------------------- | ---------- |
| `components/rfas`          | 0/254      |
| `components/numbering`     | 0/186      |
| `components/admin`         | 0/123      |
| `components/drawings`      | 0/106      |
| `components/layout`        | 0/146      |
| `components/workflow`      | 0/110      |
| `components/admin/ai`      | 0/278      |
| `components/transmittal`   | 0/66       |
| `lib/api`                  | 1/261      |

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Phase 1: ยก Coverage จาก 13% → 30% (Priority: P1)

ทีมพัฒนาสามารถรันคำสั่งทดสอบและเห็นตัวเลข Statement Coverage รวมของ Frontend ที่ไม่ต่ำกว่า **30%** โดยส่วนที่ถูกเพิ่มการทดสอบในระยะนี้คือ:
- `hooks/` (ทุก custom hook)
- `lib/services/` (service functions ที่ใช้บ่อยที่สุด)
- `components/correspondences/` (component หลักของระบบ)

**Why this priority**: hooks และ services เป็น Business Logic Layer ที่ส่งผลกระทบสูงสุดต่อความถูกต้องของระบบ DMS ทั้งหมด

**Independent Test**: รัน `npm run test:cov` แล้วดูผลรวม Statements Coverage ≥ 30%

**Acceptance Scenarios**:

1. **Given** ระบบมี Statement Coverage 13.54%, **When** ทีมเขียน Test สำหรับ hooks/ และ lib/services/ ครอบคลุมกรณีหลัก (happy path + error path), **Then** Statement Coverage รวมขึ้นเป็นอย่างน้อย 30%
2. **Given** มี Custom Hook ที่ใช้ดึงข้อมูล Correspondences, **When** เขียน test ครอบ success + error state, **Then** hook นั้นมี coverage ≥ 70%
3. **Given** มี Service function ที่ทำ API call, **When** เขียน test ด้วย mock และ assert ผลลัพธ์, **Then** function นั้นมี coverage ≥ 70%

---

### User Story 2 — Phase 2: ยก Coverage จาก 30% → 50% (Priority: P2)

ทีมพัฒนาสามารถรันคำสั่งทดสอบและเห็นตัวเลข Statement Coverage รวมที่ไม่ต่ำกว่า **50%** โดยระยะนี้เพิ่มการทดสอบในส่วน:
- `components/rfas/` (เอกสาร RFA — critical business feature)
- `components/numbering/` (ระบบเลขที่เอกสาร)
- `components/drawings/` (Shop Drawing / Contract Drawing)
- `lib/api/` (API client functions)
- `components/auth/` (authentication flow)

**Why this priority**: RFA และ Document Numbering เป็น Core Business Process ที่สร้างรายได้และมีความเสี่ยงสูงต่อการผิดพลาด

**Independent Test**: รัน `npm run test:cov` แล้วดู Statements Coverage ≥ 50%

**Acceptance Scenarios**:

1. **Given** `components/rfas/` มี 0% coverage, **When** เขียน test ครอบ form validation, status transition, และ list rendering, **Then** folder นั้นมี coverage ≥ 60%
2. **Given** `lib/api/` มี coverage เกือบ 0%, **When** เขียน test ด้วย mock HTTP client สำหรับ CRUD operations, **Then** API functions มี coverage ≥ 70%
3. **Given** `components/auth/` มี 0% coverage, **When** เขียน test ครอบ login form validation, **Then** coverage ≥ 70%

---

### User Story 3 — Phase 3: ยก Coverage จาก 50% → 70% (Priority: P3)

ทีมพัฒนาสามารถรันคำสั่งทดสอบและเห็นตัวเลข Statement Coverage รวมที่ไม่ต่ำกว่า **70%** โดยระยะนี้เพิ่มการทดสอบในส่วน:
- `components/admin/` ทั้งหมด (รวม admin/ai, admin/reference, admin/security)
- `components/workflow/` และ `components/workflows/`
- `components/layout/`
- `components/transmittal/`, `components/circulation/`
- `lib/stores/`, `lib/utils/`, `lib/i18n/`

**Why this priority**: ส่วน Admin และ Workflow เป็นระบบที่ซับซ้อนและมี edge case สูง แต่ใช้งานโดยผู้ดูแลระบบเท่านั้น จึงวางไว้ในระยะสุดท้าย

**Independent Test**: รัน `npm run test:cov` แล้วดู Statements Coverage ≥ 70%

**Acceptance Scenarios**:

1. **Given** `components/admin/` มี 0% coverage, **When** เขียน test ครอบ AI admin panel, reference management, security settings, **Then** folder นั้นมี coverage ≥ 60%
2. **Given** `components/workflow/` มี 0% coverage, **When** เขียน test ครอบ workflow state display และ transition triggers, **Then** folder นั้นมี coverage ≥ 65%
3. **Given** ระบบทั้งหมด, **When** รัน test suite หลังเขียนครบ Phase 3, **Then** Statement Coverage รวม ≥ 70%

---

### Edge Cases

- Component ที่มี async data fetching ต้องทดสอบทั้ง loading state, success state, และ error state
- Form validation ต้องทดสอบ edge case ของ input (ว่าง, ยาวเกิน, HTML injection)
- Component ที่ใช้ `publicId` ต้องทดสอบว่าไม่ส่ง `id` หรือ `uuid` ไปแทน (ADR-019)
- i18n keys ต้องทดสอบว่า render ค่าจาก translation file ไม่ใช่ hardcoded text

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ทุก Custom Hook ใน `hooks/` MUST มี test ครอบ happy path และ error path อย่างน้อย
- **FR-002**: ทุก Service function ใน `lib/services/` MUST มี test ด้วย mock HTTP client
- **FR-003**: Component ที่ render form MUST มี test ครอบ validation และ submission
- **FR-004**: Component ที่มี conditional rendering (เช่น สถานะเอกสาร) MUST มี test ครอบทุก branch
- **FR-005**: ต้องไม่เขียน test ที่ใช้ `parseInt` กับ `publicId` หรือมี `id ?? ''` fallback (ADR-019)
- **FR-006**: Test ทุกตัวต้อง mock HTTP calls ด้วย `vi.mock` หรือ MSW — ห้ามเรียก API จริง
- **FR-007**: Test files ต้องตั้งชื่อเป็น `*.spec.tsx` หรือ `*.spec.ts` และวางข้างๆ source file
- **FR-008**: แต่ละ Phase ต้อง **manual verify** โดยรัน `npm run test:cov` และยืนยันว่า Statement Coverage ถึงเป้าก่อน merge เข้า main branch — ไม่ต้องตั้ง CI threshold อัตโนมัติ
- **FR-009**: Coverage report ต้อง generate ใหม่หลังแต่ละ Phase เสร็จเพื่อยืนยันตัวเลข
- **FR-010**: ต้องใช้ Thai สำหรับ comment และ JSDoc ใน test files ตามมาตรฐานโปรเจกต์
- **FR-011**: หากการเขียน test พบว่า component มี bug จริง ต้อง **fix bug ในทันที** และ commit พร้อมกับ test ใน PR เดียวกัน — ห้าม skip หรือเขียน test ที่ยอมให้ fail ผ่านไป

## Clarifications

### Session 2026-06-13

- Q: Phase Gate ควร enforce ที่ระดับไหน? → A: Manual check — รัน `npm run test:cov` ดูตัวเลขก่อน merge แต่ละ Phase ไม่ต้องตั้ง CI threshold อัตโนมัติ
- Q: หากพบ bug ระหว่างเขียน test ควรทำอย่างไร? → A: Fix bug ทันที — แก้ bug แล้ว commit พร้อมกับ test ใน PR เดียวกัน ห้าม skip หรือปล่อยผ่าน

### Key Entities

- **Coverage Report**: HTML report ที่ generate โดย Istanbul.js จากการรัน `npm run test:cov`
- **Test Suite**: ชุดไฟล์ `*.spec.tsx / *.spec.ts` ที่เพิ่มขึ้นในแต่ละ Phase
- **Phase Gate**: เกณฑ์ Coverage % ที่ต้องผ่านก่อนจะ merge Phase นั้นและเริ่ม Phase ถัดไป

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 (Phase 1)**: Statement Coverage ของ Frontend ≥ 30% หลังจากเขียน test สำหรับ hooks/ และ lib/services/
- **SC-002 (Phase 2)**: Statement Coverage ≥ 50% หลังจากเพิ่ม test สำหรับ rfas/, numbering/, drawings/, lib/api/
- **SC-003 (Phase 3)**: Statement Coverage ≥ 70% หลังจากเพิ่ม test สำหรับ admin/, workflow/, layout/
- **SC-004**: Branch Coverage ตามไปอย่างน้อย 50% ของ Statement Coverage ในแต่ละ Phase
- **SC-005**: Test suite ทั้งหมดต้องผ่าน (0 failed) ก่อน merge แต่ละ Phase
- **SC-006**: ไม่มี test ที่ใช้ `any` type หรือ `console.log` ในโค้ด test

### Assumptions

- ใช้ Vitest + React Testing Library เป็น test framework หลัก (ตาม `05-04-testing-strategy.md`)
- Mock HTTP calls ด้วย `vi.mock` หรือ Mock Service Worker (MSW)
- ไม่ต้องเพิ่ม dependencies ใหม่หากสามารถใช้ tools ที่มีอยู่ได้
- การจัดลำดับ Phase ขึ้นอยู่กับขนาด (statements count) และความสำคัญทางธุรกิจ
- E2E Tests (Playwright) ไม่นับรวมใน Coverage report นี้ — เป็นแยกต่างหาก
