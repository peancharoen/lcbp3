# Implementation Plan: Attachment Manual Re-OCR

**Branch**: `257-attachment-manual-re-ocr` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)
**Governing ADR**: [ADR-055](../../06-Decision-Records/ADR-055-attachment-manual-re-ocr.md) (D1–D16 — authoritative over this plan on conflict)

## Summary

Admin-only, human-in-the-loop re-OCR of a single PDF attachment. Trigger enqueues onto the revived dedicated `QUEUE_NP_DMS_OCR` (concurrency 1, no priority); state lives in two Redis keys (status pointer + tokenized payload, 72h TTL); confirm runs one DB transaction then `RagAdminService.reingest()` (force=true) and deletes both keys. Two prerequisite bugfixes ride along: `NpDmsOcrProcessor` failure reporting (D10) and an `ai_processing_status='DONE'` terminal-state guard in `ai-batch.processor.ts` (D9.3). Frontend adds a Re-OCR row action + 3-phase full-screen dialog in the RAG console. **No schema change.**

## Technical Context

**Language/Version**: TypeScript strict (NestJS 11 backend, Next.js 16 frontend)
**Primary Dependencies**: BullMQ (`@nestjs/bullmq`), `@nestjs-modules/ioredis`, TypeORM, CASL `RbacGuard`, TanStack Query, React Hook Form/Zod, shadcn/ui (AlertDialog/Dialog), existing `file-preview-modal`
**Storage**: MariaDB `attachments` (existing columns only) + Redis (2 keys, TTL 72h). N/A for new tables (ADR-044 unaffected)
**Testing**: Jest (backend), Vitest `run` (frontend — never watch mode)
**Target Platform**: Linux server `np-dms-lcbp3`; GPU sidecar OCR (RTX 2060 Super, 4000 MB VRAM gate)
**Project Type**: web (backend + frontend)
**Performance Goals**: status poll is lightweight (pointer only; text returned only on `completed`); worst-case wait = (waiting + active) × 180s
**Constraints**: ADR-019 (UUID publicId only, no `parseInt`/`+`), ADR-016 (RBAC, Idempotency-Key, Throttle), ADR-023/023A (AI boundary), ADR-007 (BusinessException + Thai userMessage), ADR-008 (BullMQ), ADR-002 n/a, no `any`/`console.log`
**Scale/Scope**: single attachment, admin-only, a handful of jobs at a time; no batch

No NEEDS CLARIFICATION remain (see [research.md](./research.md)).

## Constitution Check

| Gate | Result |
| ---- | ------ |
| ADR-019 UUID — `:publicId` string only, no INT id exposed | PASS |
| ADR-016 — `JwtAuthGuard, RbacGuard, AiEnabledGuard`, `rag.admin.write` / `rag.manage`, `Idempotency-Key` required, `@Throttle`, `@Audit` | PASS (D11) |
| ADR-044 — no schema change, no migrations | PASS |
| ADR-023/023A — AI via DMS API + BullMQ only; Qdrant writes only through existing generation lifecycle (projectPublicId filter unchanged) | PASS |
| ADR-008 — long work on BullMQ, none inline | PASS |
| ADR-007 — layered errors (422/410/409/503/404) with `userMessage` + `recoveryAction` | PASS |
| Two-phase upload / ClamAV | N/A (no upload) |
| Human-in-the-loop | PASS — core of design |
| Domain terms (Workflow Engine/Correspondence) | N/A |
| Tier 3 (AI runtime) → ledger required | See Ledger Decision |

Post-design re-check: PASS, no violations; Complexity Tracking empty.

## Project Structure

### Documentation

```text
specs/200-fullstacks/257-attachment-manual-re-ocr/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── ledger.md
├── contracts/re-ocr-api.md
├── checklists/requirements.md
└── tasks.md            # produced by /105-speckit-tasks
```

### Source Code

```text
backend/src/
├── common/file-storage/
│   ├── attachment-re-ocr.service.ts        # NEW  trigger/status/confirm (+ .spec.ts)
│   ├── dto/re-ocr.dto.ts                   # NEW  engineType validation, confirm body
│   ├── file-storage.controller.ts          # EDIT 3 endpoints (+ spec)
│   └── file-storage.module.ts              # EDIT register QUEUE_NP_DMS_OCR, provide service
└── modules/ai/
    ├── ai-queue.service.ts                 # EDIT enqueueAttachmentReOcr()
    └── processors/
        ├── np-dms-ocr-processor.ts         # EDIT D10 + D15 (+ spec new/extended)
        └── ai-batch.processor.ts           # EDIT DONE-guard (+ spec)

frontend/
├── components/admin/ai/rag-console/
│   ├── ReOcrButton.tsx                     # NEW row action (rag.admin.write only)
│   ├── ReOcrDialog.tsx                     # NEW 3-phase full-screen dialog
│   ├── ReOcrDiffView.tsx                   # NEW side-by-side <pre> + PDF pane + search
│   └── rag-admin-i18n.ts                   # EDIT i18n keys
├── hooks/                                  # NEW useReOcr* (TanStack Query, poll 3s)
└── lib/services/                           # NEW re-ocr API client (+ types)
```

**Structure Decision**: Web app. Service lives in `file-storage` (D2/D13) using `ModuleRef.get(..., {strict:false})` lazy lookup for `AiQueueService`/`RagAdminService`, following the precedent at `file-storage.service.ts:486-499`.

## Implementation Phases

Ordering respects dependencies; each phase is independently verifiable.

1. **P-A Pipeline fixes (US4, blocking prerequisites)**: D10 failure reporting in `NpDmsOcrProcessor` (both throw paths; final-attempt-only `failed`); D9.3 DONE-guard in `ai-batch.processor.ts`. Separate commit per ADR notes.
2. **P-B Job contract (D15)**: extend `NpDmsOcrJobData` (`attachmentPublicId`, `reOcrToken`, `forceRefresh`); processor writes pointer per transition, payload on success, skips cache read, empty→failed, shrink `warning`, conditional VRAM gate (D7), `triggeredBy*` preserved.
3. **P-C Backend service + endpoints (US1–3)**: `enqueueAttachmentReOcr()` (with `checkAiUnavailableLocks`, `jobId=re-ocr:{id}:{token}`); `AttachmentReOcrService` guards (D12 mime/exists, D9 status + in-flight verify via queue `getJob`), status contract (D14, `identical`), confirm transaction + `reingest()` + key deletion (D6); controller decorators (D11); module wiring.
4. **P-D Frontend (US1–3)**: entry action, dialog phases, resume-by-click, diff + PDF pane + search, AlertDialog, i18n, polling.
5. **P-E Verification**: unit/integration tests per ADR test list, `check-real-app` browser pass, security review.

## Ledger Decision

**Required.** Tier 3 AI-runtime work, touches protected boundaries (AI boundary, data integrity of source-of-truth text), shared ingestion path, likely multi-session. Ledger: [ledger.md](./ledger.md), `ASSURANCE_UNIT_ID=lcbp3/ai/attachment-manual-re-ocr` (generic template; AI-pipeline template not needed as no sandbox/ingestion-flow ownership changes).

## Complexity Tracking

No constitution violations to justify.
