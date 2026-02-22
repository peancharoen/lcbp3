---
title: 'Task: Backend Refactoring for Schema v1.7.0'
status: DONE
owner: Backend Team
created_at: 2025-12-23
related:
  - specs/01-requirements/01-03.11-document-numbering.md
  - specs/07-database/lcbp3-v1.7.0-schema.sql
  - specs/07-database/data-dictionary-v1.7.0.md
---

## Objective
Update backend entities and logic to align with schema v1.7.0 and revised document numbering specifications.

## Scope of Work

### 1. Drawing Module
- **Contract Drawings:**
  - Update `ContractDrawing` entity (map_cat_id, volume_page)
  - Create `ContractDrawingSubcatCatMap` entity
- **Shop Drawings:**
  - Update `ShopDrawingMainCategory` (add project_id)
  - Update `ShopDrawingSubCategory` (add project_id, remove main_cat_id)
  - Update `ShopDrawing` (remove title)
  - Update `ShopDrawingRevision` (add title, legacy_number)
- **As Built Drawings (New):**
  - Create entities for `asbuilt_drawings` and related tables.

### 2. Document Numbering Module
- **Counters:**
  - Update `DocumentNumberCounter` entity to match 8-part Composite Key.
  - Ensure strict typing for `reset_scope`.

## Definition of Done
- [x] All entities match v1.7.0 schema
- [x] Application compiles without type errors
- [x] Document Numbering service supports new key structure
