# 📋 Requirements Specification v1.5.0

## Status: first-draft

**Date:** 2025-11-30

---

## 📑 Table of Contents

1. [Objectives & Goals](./01-objectives.md)
2. [System Architecture & Technology](./02-architecture.md)
3. [Functional Requirements](./03-functional-requirements.md)
   - [3.1 Project & Organization Management](./03.1-project-management.md)
   - [3.2 Correspondence Management](./03.2-correspondence.md)
   - [3.3 RFA Management](./03.3-rfa.md)
   - [3.4 Contract Drawing Management](./03.4-contract-drawing.md)
   - [3.5 Shop Drawing Management](./03.5-shop-drawing.md)
   - [3.6 Unified Workflow](./03.6-unified-workflow.md)
   - [3.7 Transmittals Management](./03.7-transmittals.md)
   - [3.8 Circulation Sheet Management](./03.8-circulation-sheet.md)
   - [3.9 Revisions Management](./03.9-revisions.md)
   - [3.10 File Handling](./03.10-file-handling.md)
   - [3.11 Document Numbering](./03.11-document-numbering.md)
   - [3.12 JSON Details](./03.12-json-details.md)
4. [Access Control & RBAC](./04-access-control.md)
5. [UI/UX Requirements](./05-ui-ux.md)
6. [Non-Functional Requirements](./06-non-functional.md)
7. [Testing Requirements](./07-testing.md)

---

## 🔄 Recent Changes

See [CHANGELOG.md](../../CHANGELOG.md) for detailed version history.

### v1.4.5 (2025-11-30)

- ✅ Added comprehensive security requirements
- ✅ Enhanced resilience patterns
- ✅ Added performance targets
- ⚠️ **Breaking:** Changed document numbering from stored procedure to app-level locking

---

## 📊 Compliance Matrix

| Requirement                   | Status      | Owner        | Target Release |
| ----------------------------- | ----------- | ------------ | -------------- |
| FR-001: Correspondence CRUD   | ✅ Done     | Backend Team | v1.0           |
| FR-002: RFA Workflow          | In Progress | Backend Team | v1.1           |
| NFR-001: API Response < 200ms | Planned     | DevOps       | v1.2           |

---

## 📬 Feedback

Found issues? [Open an issue](https://github.com/your-org/lcbp3-dms/issues/new?template=spec-issue.md)
