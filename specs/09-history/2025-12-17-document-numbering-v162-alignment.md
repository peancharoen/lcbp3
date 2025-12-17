# 2025-12-17: Document Numbering Specs v1.6.2 Alignment

**Date:** 2025-12-17
**Type:** Specification Refactoring
**Related:** REQ-009-DocumentNumbering

---

## Summary

ปรับปรุง specification files ของ Document Numbering ให้สอดคล้องกับ Requirements v1.6.2

---

## Changes Made

### Updated Specifications

| File                                                  | From   | To     | Key Changes                             |
| ----------------------------------------------------- | ------ | ------ | --------------------------------------- |
| `05-decisions/ADR-002-document-numbering-strategy.md` | v2.0   | v3.0   | Version refs, compliance links, history |
| `04-operations/document-numbering-operations.md`      | v1.6.0 | v1.6.2 | Status→APPROVED, file paths fixed       |
| `03-implementation/document-numbering.md`             | v1.6.1 | v1.6.2 | ADR reference fixed                     |

### New Task Files

| File                                                  | Purpose                       |
| ----------------------------------------------------- | ----------------------------- |
| `06-tasks/TASK-BE-017-document-numbering-refactor.md` | Backend implementation tasks  |
| `06-tasks/TASK-FE-017-document-numbering-refactor.md` | Frontend implementation tasks |

---

## Key Decisions

1. **Single Source of Truth**: `document_number_counters` เป็น authoritative counter system
2. **Counter Key Structure**: Unified to 8 fields (project, orig, recip, type, sub_type, rfa_type, discipline, reset_scope)
3. **Number State Machine**: RESERVED → CONFIRMED → VOID/CANCELLED
4. **Deprecated Tokens**: `{ORG}`, `{TYPE}` replaced with explicit `{ORIGINATOR}`, `{RECIPIENT}`, `{CORR_TYPE}`

---

## Next Actions

- [ ] Execute TASK-BE-017 (Backend team)
- [ ] Execute TASK-FE-017 (Frontend team, after BE ready)
