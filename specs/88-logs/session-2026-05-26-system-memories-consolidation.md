# Session 9 — 2026-05-26 (System Memories Consolidation)

## QNAP SSH Key Authentication & CI/CD Deployment

### Infrastructure

- QNAP `192.168.10.8` — target deploy server (runs Gitea + app containers)
- ASUSTOR `192.168.10.9` — Gitea runner

### SSH Key Setup (Persistent)

- Private key: `/etc/config/ssh/gitea-runner`
- Public key: `/etc/config/ssh/gitea-runner.pub`
- Fingerprint: `SHA256:OhPbRe9vi4aWTyzBqCQ6T3MLl+JK9lFtH5bPrx+ICPw`
- Authorized keys: `/etc/config/ssh/authorized_keys` (symlinked from `/root/.ssh/`)
- QNAP SSH config: `/etc/config/ssh/sshd_config` (persistent — ใช้อันนี้เท่านั้น ไม่ใช่ `/etc/ssh/sshd_config`)

### Critical Fix: AuthorizedKeysFile

```
AuthorizedKeysFile /etc/config/ssh/authorized_keys
```

ต้องใช้ **absolute path** — ถ้าใช้ `.ssh/authorized_keys` จะ resolve ไปที่ `/share/homes/admin/.ssh/` ซึ่งผิด (admin home = `/share/homes/admin` แต่ symlink อยู่ที่ `/root/.ssh`)

### Reload QNAP SSH daemon

```bash
kill -HUP $(ps | grep "/usr/sbin/sshd -f /etc/config" | grep -v grep | awk '{print $1}')
```

ไม่มี `pgrep` และไม่มี `systemctl` บน QNAP

### Gitea Secrets

| Secret | Value |
|--------|-------|
| HOST | `192.168.10.8` |
| PORT | `22` |
| USERNAME | `admin` |
| SSH_KEY | private key content from `/etc/config/ssh/gitea-runner` |

### deploy.sh Fix

```bash
# scripts/deploy.sh line 10 — correct path:
COMPOSE_FILE="$SOURCE_DIR/specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/docker-compose-app.yml"
```

ไม่ใช่ `...04-00-docker-compose/docker-compose-app.yml` (ขาด `QNAP/app/`)

### Root Causes (ทั้งหมด)

1. `authorized_keys` เสียหาย — 2 keys บรรทัดเดียว
2. SSH key pair หายหลัง reboot — QNAP `/` เป็น RAM, ต้องเก็บใน `/etc/config/`
3. `AuthorizedKeysFile` ใช้ relative path — resolve ผิด directory
4. HOST secret ชี้ไปผิด server (Go SSH) — แก้เป็น `192.168.10.8:22`
5. `deploy.sh` COMPOSE_FILE path ผิด — ขาด `QNAP/app/` subdirectory

## Backend TransformInterceptor Double Registration Bug

### Issue

API responses were double-wrapped `{ data: { data: actualData } }` causing frontend detail pages to fail loading data.

### Root Cause

TransformInterceptor registered in TWO places:

1. `backend/src/main.ts`: `app.useGlobalInterceptors(new TransformInterceptor())`
2. `backend/src/common/common.module.ts`: `{ provide: APP_INTERCEPTOR, useClass: TransformInterceptor }`

### Fix

Removed duplicate registration from `main.ts` (keep only APP_INTERCEPTOR in CommonModule).

### Why list page still worked

Paginated responses were re-detected as paginated by second interceptor, preventing double-nesting. Non-paginated (detail) endpoints were affected.

### Verification

`curl http://localhost:3001/api/correspondences/{uuid}` now returns single-wrapped `{ data: {...} }` instead of double-wrapped.

### Pattern to Avoid

Never register global interceptors/filters in both `main.ts` AND via `APP_INTERCEPTOR`/`APP_FILTER` providers.

## ADR-021 Integration: Transmittals & Circulation

### Summary

Successfully integrated ADR-021 (Integrated Workflow Context & Step-specific Attachments) into Transmittals and Circulation modules. All backend services, frontend pages, and tests are wired to the Unified Workflow Engine.

### Backend Changes (B1-B9)

- **WorkflowEngineService**: Added `getInstanceByEntity(entityType, entityId)` for polymorphic workflow instance lookup
- **TransmittalService**:
  - Expose `workflowInstanceId`, `workflowState`, `availableActions` in `findOneByUuid()`
  - Added purpose filter to `findAll()`
  - Added `submit()` with EC-RFA-004 validation (prevents submission if any item correspondence is DRAFT)
  - Starts workflow instance `TRANSMITTAL_FLOW_V1` and updates CorrespondenceRevision status
- **TransmittalController**: Added `POST /:uuid/submit` endpoint with RBAC and Audit
- **TransmittalModule**: Imported `WorkflowEngineModule` and `CorrespondenceRevision`
- **CirculationService**:
  - Expose workflow fields in `findOneByUuid()`
  - Added `reassignRouting()` (EC-CIRC-001) for PENDING routing reassignment
  - Added `forceClose()` (EC-CIRC-002) with transactional rollback and reason validation
- **CirculationController**: Added `PATCH /:uuid/routing/:routingId/reassign` and `POST /:uuid/force-close`
- **Circulation Entity**: Added `deadlineDate` column for EC-CIRC-003 Overdue badge
- **Schema Delta**: `05-add-circulation-deadline.sql` per ADR-009 (no migrations)

### Frontend Changes (F1-F7)

- **Types**: Extended `Transmittal` and `Circulation` interfaces with workflow fields; added `deadlineDate` to Circulation
- **Hooks**: Created `useTransmittal()` and extended `useCirculation()` hooks with TanStack Query
- **Detail Pages**:
  - Both wired with `IntegratedBanner` and `WorkflowLifecycle` using live workflow data
  - Circulation page includes EC-CIRC-003 Overdue badge logic (`isOverdue()`)
- **List Page**: Added purpose filter dropdown to `transmittals/page.tsx`

### Tests (T1-T2): 19/19 Passing

- **TransmittalService**: 7 tests covering EC-RFA-004 validation, workflow instance creation, and error cases
- **CirculationService**: 12 tests covering EC-CIRC-001 (reassign), EC-CIRC-002 (forceClose), EC-CIRC-003 (deadlineDate exposure)

### Key Technical Decisions

- Followed ADR-019 UUID handling (no parseInt, use string UUIDs)
- Used ADR-009 direct schema edits (no TypeORM migrations)
- Enforced RBAC with CASL guards and Audit decorators
- Implemented transactional force-close with proper rollback
- Maintained existing patterns for error handling and service architecture

### Remaining Work

- I1: i18n keys for new workflow actions (low priority)

## Correspondence Detail Display Fixes

### Issue

`/correspondences/[uuid]` detail display inconsistency

### Fix

Made backend `findOneByUuid` query deterministic with explicit relation joins and revision ordering (rev.revisionNumber DESC, rev.createdAt DESC), and normalized recipient_type values in frontend detail page before TO/CC filtering to handle whitespace variants per schema (e.g., 'CC ').

### Files Modified

- `backend/src/modules/correspondence/correspondence.service.ts`
- `frontend/components/correspondences/detail.tsx`

## Correspondence Create Permission Bypass

### Issue

Users without primaryOrganizationId could not create documents even with system.manage_all permission

### Fix

In backend CorrespondenceService.create flow, users without primaryOrganizationId can still create when they have system.manage_all and provide originatorId. Validation now resolves originator organization under that permission instead of immediately throwing 'User must belong to an organization to create documents'. Added regression test in correspondence.service.spec.ts.

### Extension

Applied same pattern to RFA, Transmittal, and Circulation create endpoints — they now accept optional originatorId and allow creation for users with system.manage_all even when primaryOrganizationId is null. Added permission-gated impersonation checks in their services to prevent unauthorized cross-organization creation.

## Playwright E2E Testing Setup

### Test Stack

- **Backend**: Jest (Unit + Integration + E2E)
- **Frontend**: Vitest (Unit) + Playwright (E2E)

### MCP Server Setup (Devin)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

### Devin Cascade Tools

- `browser_navigate` - เปิด URL
- `browser_click` - คลิก element
- `browser_type` - พิมพ์ข้อความ
- `browser_take_screenshot` - ถ่าย screenshot
- `browser_evaluate` - รัน JavaScript

### Run E2E Tests

```bash
cd frontend
npx playwright test                    # Run all
npx playwright test --ui               # Debug mode
npx playwright test --headed           # See browser
npx playwright show-report             # Generate report
```

### E2E Script Location

`frontend/e2e/workflow-adr021.spec.ts`

## Tag Creation and Contract UUID Fixes

### Issue 1

`/admin/doc-control/reference/tags` needed a list-level Project dropdown filter and Tag creation could fail due to TypeORM Tag entity column-name mismatches.

### Fix

Added selectedProjectId filter in frontend tags page and mapped backend Tag entity fields to schema names (project_id, tag_name, color_code, created_by, created_at, updated_at, deleted_at).

### Issue 2

Frontend contract detail page typecheck failure — `contract.project?.id` vs `contract.project?.publicId`

### Fix

In `frontend/app/(admin)/admin/doc-control/contracts/page.tsx`, handleEdit must read nested project UUID from contract.project?.id (not project?.publicId) because Contract.project is typed and returned as { id: string; projectCode; projectName }.
