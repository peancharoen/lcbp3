# Quickstart: Unified Document CRUD Management

**Date**: 2026-09-06
**Branch**: `253-unified-doc-crud`

## Prerequisites

- Node.js 20+ / pnpm 9+
- MariaDB 11.8 (running)
- Redis (running)
- Elasticsearch (running)
- Qdrant (running)
- Ollama (running, optional for vector sync)

## Setup

```bash
# Clone and checkout branch
git checkout 253-unified-doc-crud

# Install dependencies
cd backend && pnpm install
cd ../frontend && pnpm install

# Apply schema changes (ADR-044 — direct SQL, no migration)
# Review and apply: specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql
# New permissions: edit_metadata, bulk_*, maintenance_*

# Start backend
cd backend && pnpm start:dev

# Start frontend
cd frontend && pnpm dev
```

## Verification Checklist

### Backend

```bash
# Type check
cd backend && pnpm tsc --noEmit

# Lint
cd backend && pnpm lint

# Unit tests
cd backend && pnpm test

# Integration tests (side effects pipeline)
cd backend && pnpm test -- --testPathPattern="side-effects"
```

### Frontend

```bash
# Type check
cd frontend && pnpm tsc --noEmit

# Lint
cd frontend && pnpm lint

# Unit tests
cd frontend && pnpm test

# E2E tests (Playwright)
cd frontend && pnpm playwright test --grep="document-actions"
```

## Key Endpoints to Verify

1. `POST /rfas/:uuid/cancel` — Cancel RFA (new)
2. `POST /transmittals/:uuid/cancel` — Cancel Transmittal (new)
3. `POST /drawings/:uuid/cancel` — Soft-delete Drawing (new)
4. `PATCH /correspondences/:uuid/metadata` — Metadata Patch (new)
5. `POST /rfas/bulk-cancel` — Bulk Cancel RFA (new)
6. `DELETE /transmittals/:uuid` — Hard-Delete Transmittal (new)
7. `GET /maintenance/numbering/gaps` — Numbering gap audit (new)
8. `POST /maintenance/orphan-cleanup/scan` — Orphan scan (new)

## Key Frontend Pages to Verify

1. `/correspondences` — Row actions dropdown + bulk action bar
2. `/rfas` — Row actions dropdown + bulk action bar
3. `/transmittals` — Row actions dropdown + bulk action bar
4. `/drawings` — Row actions dropdown + bulk action bar
5. `/circulation` — Row actions dropdown + force-close
6. `/admin/doc-control/maintenance` — 4-tab Maintenance Console
