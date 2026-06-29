# Tasks: ADR-021 Integrated Workflow Context & Step-specific Attachments

**Branch**: `200-fullstacks/202-adr-021-integrated-workflow-context` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Location**: `specs/200-fullstacks/202-adr-021-integrated-workflow-context/`
**Input**: Comprehensive task breakdown from `specs/08-Tasks/ADR-021-workflow-context/tasks.md`
**Version**: 1.8.6 | **Date**: 2026-05-03

---

## Summary

This file provides a high-level task overview. For the **full detailed tasks** (with implementation notes, verification commands, and acceptance criteria), see:
👉 **`specs/200-fullstacks/202-adr-021-integrated-workflow-context/tasks.md`**

---

## Phase Overview

| Phase | Focus | Key Deliverables | Status |
|-------|-------|------------------|--------|
| **Phase 1** | Setup | Branch creation, dev environment verification | ⏳ Pending |
| **Phase 2** | Backend Foundation | SQL delta, Entity relations, Guards, Service extension | ⏳ Pending |
| **Phase 3** | Integrated Banner (US1) | `IntegratedBanner` component, 4 module integrations | ⏳ Pending |
| **Phase 4** | Workflow Lifecycle (US2) | `WorkflowLifecycle` component, vertical timeline | ⏳ Pending |
| **Phase 5** | Step Attachments (US3) | `use-workflow-action` hook, DTO extension, linking logic | ⏳ Pending |
| **Phase 6** | File Preview (US4) | `FilePreviewModal` component | ⏳ Pending |
| **Phase 7** | i18n & Testing (US5) | i18n keys, unit tests, component tests, E2E | ⏳ Pending |

---

## Critical Path Tasks (Phase 2)

| # | Task | File(s) | Dependencies |
|---|------|---------|--------------|
| T1 | Create SQL delta — add `workflow_history_id` to `attachments` | `deltas/04-*.sql` | None |
| T2 | Update `attachment.entity.ts` — add column + relation | `attachment.entity.ts` | T1 |
| T3 | Update `workflow-history.entity.ts` — add `@OneToMany` | `workflow-history.entity.ts` | T1 |
| T4 | Extend `WorkflowTransitionDto` — add `attachmentPublicIds` | `workflow-transition.dto.ts` | None |
| T5 | Create `WorkflowTransitionGuard` (CASL 4-Level) | `guards/workflow-transition.guard.ts` | None |
| T6 | Extend `processTransition()` — link attachments | `workflow-engine.service.ts` | T2, T3, T4 |
| T7 | Update Controller — idempotency + guard | `workflow-engine.controller.ts` | T5, T6 |
| T8 | Register guard in Module | `workflow-engine.module.ts` | T5 |

---

## Frontend Tasks Overview (Phases 3-6)

| # | Task | Component/Page | Dependencies |
|---|------|----------------|--------------|
| F1 | Add types — `WorkflowHistoryItem` | `types/workflow.ts` | T7 |
| F2 | Add DTO — `WorkflowTransitionWithAttachmentsDto` | `types/dto/workflow-engine/` | T4 |
| F3 | Create hook — `use-workflow-action.ts` | `hooks/` | F2 |
| F4 | Create component — `IntegratedBanner` | `components/workflow/` | F1 |
| F5 | Create component — `WorkflowLifecycle` | `components/workflow/` | F1 |
| F6 | Create component — `FilePreviewModal` | `components/common/` | F1 |
| F7-F10 | Integrate into 4 module pages | `rfas/`, `transmittals/`, `circulation/`, `correspondences/` | F3-F6 |

---

## Testing Tasks (Phase 7)

| # | Task | Target | Type |
|---|------|--------|------|
| G1 | Unit tests — `processTransition()` extended | `workflow-engine.service.spec.ts` | Backend |
| G2 | Unit tests — `WorkflowTransitionGuard` | `workflow-transition.guard.spec.ts` | Backend |
| G3 | Component tests — `IntegratedBanner` | `integrated-banner.test.tsx` | Frontend |
| G4 | Component tests — `WorkflowLifecycle` | `workflow-lifecycle.test.tsx` | Frontend |
| G5 | Component tests — `FilePreviewModal` | `file-preview-modal.test.tsx` | Frontend |
| G6 | E2E test — workflow with attachment | `test/workflow-with-attachment.e2e-spec.ts` | Integration |

---

## Verification Checkpoints

### Backend
```bash
# Schema check
grep -n "workflow_history_id" specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql

# Type check
cd backend && pnpm tsc --noEmit

# Unit tests
cd backend && pnpm test --testPathPattern=workflow-engine.service
cd backend && pnpm test --testPathPattern=workflow-transition.guard

# Integration test
curl -X POST http://localhost:3001/api/workflow-engine/instances/:id/transition \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"action":"APPROVE","comment":"OK","attachmentPublicIds":["<uuid>"]}'
```

### Frontend
```bash
# Type check
cd frontend && pnpm tsc --noEmit

# Component tests
cd frontend && pnpm test --run components/workflow/integrated-banner
cd frontend && pnpm test --run components/workflow/workflow-lifecycle
cd frontend && pnpm test --run components/common/file-preview-modal
```

---

## References

| Document | Path | Purpose |
|----------|------|---------|
| **Full Tasks** | `specs/08-Tasks/ADR-021-workflow-context/tasks.md` | Complete task breakdown with 360 lines of detail |
| **Data Model** | `specs/08-Tasks/ADR-021-workflow-context/data-model.md` | Entity definitions, SQL delta, DTO specs |
| **Quick Start** | `specs/08-Tasks/ADR-021-workflow-context/quickstart.md` | Developer onboarding guide |
| **Research** | `specs/08-Tasks/ADR-021-workflow-context/research.md` | Phase 0 findings and decisions |
| **Contracts** | `specs/08-Tasks/ADR-021-workflow-context/contracts/*.yaml` | API contracts |

---

## Definition of Done (Observable Outcomes)

| REQ | Done When |
|-----|-----------|
| **REQ-01** | Banner shows Doc No, Status, Priority badge, Approve/Reject buttons on all 4 module detail pages |
| **REQ-02** | Workflow tab displays Role + Handler + Description for every step without reload |
| **REQ-03** | Current step shows Indigo (#6366f1) with pulse animation; other steps distinct |
| **REQ-04** | Drag-drop works only in `PENDING_REVIEW`/`PENDING_APPROVAL`; disabled in terminal states |
| **REQ-05** | Clicking PDF/Image opens preview modal without page navigation |
| **REQ-06** | All UI text changes when switching EN/TH; no hardcoded strings |
