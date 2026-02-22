---
title: 'Task: Frontend Refactoring for Schema v1.7.0'
status: IN_PROGRESS
owner: Frontend Team
created_at: 2025-12-23
related:
  - specs/06-tasks/TASK-BE-018-v170-refactor.md
  - specs/07-database/data-dictionary-v1.7.0.md
---

## Objective
Update frontend application to align with the refactored backend (v1.7.0 schema). This includes supporting new field mappings, new As Built drawing type, and updated document numbering logic.

## Scope of Work

### 1. Type Definitions & API Client
- **Types**: Update `Drawing`, `ContractDrawing`, `ShopDrawing` interfaces to match new backend entities (e.g. `mapCatId`, `projectId` in categories).
- **API**: Update `drawing.service.ts` to support new filter parameters (`mapCatId`) and new endpoints for As Built drawings.

### 2. Drawing Upload Form (`DrawingUploadForm`)
- **General**: Refactor to support dynamic fields based on Drawing Type.
- **Contract Drawings**:
  - Replace `subCategoryId` with `mapCatId` (fetch from `contract-drawing-categories`?).
  - Add `volumePage` input.
- **Shop Drawings**:
  - Remove `sheetNumber` (if not applicable) or map to `legacyDrawingNumber`.
  - Add `legacyDrawingNumber` input.
  - Handle `title` input (sent as revision title).
  - Use Project-specific categories.
- **As Built Drawings (New)**:
  - Add "AS_BUILT" option.
  - Implement form fields similar to Shop Drawings (or Contract depending on spec).

### 3. Drawing List & Views (`DrawingList`)
- **Contract Drawings**: Show `volumePage`.
- **Shop Drawings**:
  - Display `legacyDrawingNumber`.
  - Display Title from *Current Revision*.
  - Remove direct title column from sort/filter if backend doesn't support it anymore on master.
- **As Built Drawings**:
  - Add new Tab/Page for As Built.
  - Implement List View.

### 4. Logic & Hooks
- Update `useDrawings`, `useCreateDrawing` hooks to handle new types.
- Ensure validation schemas (`zod`) match backend constraints.

## Definition of Done
- [x] Contract Drawing Upload works with `mapCatId` and `volumePage`
- [x] Shop Drawing Upload works with `legacyDrawingNumber` and Revision Title
- [x] As Built Drawing Upload and List implemented
- [x] Drawing List displays correct columns for all types
- [x] No TypeScript errors
