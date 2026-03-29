# LCBP3-DMS App Summary

## What It Is

LCBP3-DMS is a document management system for the Laem Chabang Port Phase 3 construction project. Repo docs describe it as a system for managing construction documents, approvals, workflows, and cross-organization communication. The codebase is split into a Next.js frontend and a NestJS backend, with MariaDB, Redis, and Elasticsearch in the application stack.

## Who It's For

Primary users are document-heavy construction project teams working across multiple organizations. Repo evidence points especially to Document Control, Org Admin, Engineer/Reviewer, Superadmin, consultants, supervisors, and contractors.

## What It Does

- Manages correspondence records between organizations.
- Supports RFA workflows for technical approval requests.
- Tracks contract and shop drawings.
- Handles transmittals and circulation sheets.
- Applies 4-level RBAC / CASL-based access control.
- Generates document numbers with Redis-backed locking rules.
- Supports file upload and attachment handling with cleanup jobs.
- Exposes admin screens for users, orgs, projects, workflows, numbering, and audit logs.
- Provides search through an Elasticsearch-backed search module.
- Includes notification processing and a migration area for legacy document import.

\newpage

## How It Works

### Frontend

- `frontend/` is a Next.js 16 App Router app.
- Route groups in `frontend/app/` show three main surfaces: `(auth)`, `(dashboard)`, and `(admin)`.
- Installed frontend libraries indicate form validation and data fetching with React Hook Form, Zod, TanStack Query, and Zustand.
- `frontend/app/api/auth/[...nextauth]/route.ts`: Not found in repo via direct read during this task, but the route file exists in the app tree.

### Backend

- `backend/src/main.ts` boots a NestJS 11 app with Helmet, CORS, 50 MB body limits, global validation, response transformation, exception filtering, and Swagger.
- `backend/src/app.module.ts` wires Config, TypeORM for MariaDB, BullMQ, Redis, scheduling, throttling, logging, monitoring, resilience, and feature modules.
- Feature modules present in code include auth, user, project, organization, contract, correspondence, RFA, drawing, transmittal, circulation, workflow-engine, document-numbering, search, notification, audit-log, dashboard, master, and migration.

### Data Flow

- Browser -> Next.js UI -> backend API under `/api`.
- Backend validates requests, applies guards/interceptors, and persists entities to MariaDB through TypeORM.
- Redis is used in the running architecture for BullMQ queues and Redis module integration; repo specs also tie Redis to locking, caching, and idempotency patterns.
- Search requests flow through the NestJS search module into Elasticsearch.
- Notification work is queued through BullMQ and also exposes a WebSocket gateway.
- Migration services write through backend modules and the shared file-storage module rather than direct client-side data access.

## How To Run

1. Install workspace dependencies with `pnpm install` at repo root.
2. Start local infra from [`backend/docker-compose.yml`](/E:/np-dms/lcbp3/backend/docker-compose.yml) to bring up MariaDB, Redis, and Elasticsearch.
3. Prepare env files: `frontend/.env.example` -> `frontend/.env.local`; backend example env file: Not found in repo.
4. Load the SQL schema and seed data using the commands documented in [`README.md`](/E:/np-dms/lcbp3/README.md).
5. Run backend with `pnpm run start:dev` in `backend/`.
6. Run frontend with `pnpm run dev` in `frontend/`.

## Notes

- Minimal dev URLs from repo docs: frontend `http://localhost:3000`, backend `http://localhost:3001`, Swagger `/docs`.
- Exact production deployment topology is documented, but this summary keeps only the minimum local-start path.
