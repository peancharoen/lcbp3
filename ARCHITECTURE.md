# Architecture

## Current Structure

- `backend/`: NestJS application with shared `CommonModule`, TypeORM entities, BullMQ queue integration, and feature modules such as `rfa`, `review-team`, `response-code`, `delegation`, `reminder`, and `distribution`.
- `frontend/`: Next.js dashboard application with route groups under `app`, shared components under `components`, and feature hooks under `hooks`.
- `specs/`: Core specifications plus categorized feature work. The active RFA approval refactor lives in `specs/200-fullstacks/204-rfa-approval-refactor`.

## RFA Approval Refactor

- `review-team`: review team CRUD, member assignment, review task creation, aggregate status, consensus, and veto override.
- `response-code`: response code lookup, matrix rules, implications, and notification triggering.
- `delegation`, `reminder`, `distribution`: supporting modules for proxy assignment, scheduled reminders, and post-approval distribution. Delegation resolution is applied during parallel review task creation while preserving `delegatedFromUserId` for audit/display.
- `distribution`: schema-aligned Distribution Matrix CRUD, BullMQ queueing, approval listener integration, draft Transmittal creation, and `/distribution-matrices` admin UI.
- Queue names are centralized in `backend/src/modules/common/constants/queue.constants.ts`.
