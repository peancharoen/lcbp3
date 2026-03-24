# Version History

## [Unreleased]

### Correspondence Module — Phase 7 Complete (2026-03-24)

#### 📧 **Email Notification Wiring** (Phase 7.1)

- **Changed**: Notification `type` on correspondence events: `'SYSTEM'` → `'EMAIL'` in 3 places
  - `correspondence.service.ts` — cancel event
  - `correspondence-workflow.service.ts` — submit event (recipient orgs)
  - `due-date-reminder.service.ts` — due date cron
- **Effect**: `NotificationProcessor` now also dispatches Nodemailer email (immediate or digest per user preference) alongside in-app + WebSocket push

#### 🧪 **Unit Tests** (Phase 7.2)

- **Backend** (`due-date-reminder.service.spec.ts` — 8 tests):
  - No revisions → no notifications
  - Skip: no correspondence, CANCELLED, CLBOWN, no doc-control user found
  - Happy path: correct `userId`, `type: 'EMAIL'`, `link`, `entityId`
  - Error isolation: one failed revision doesn't stop others
  - `daysLeft` message format validation
- **Frontend** (`hooks/__tests__/use-circulation.test.ts` — 5 tests):
  - Cache key generation for `circulationKeys.byCorrespondence()`
  - Successful fetch, disabled when UUID empty, error handling, query key assertion

#### 📦 **Bulk Operations** (Phase 7.3)

- **Backend**: `BulkCancelDto` (`uuids[]` + `reason`) → `POST /correspondences/bulk-cancel` (returns `{ succeeded[], failed[] }`)
- **Backend**: `GET /correspondences/export-csv` — streams UTF-8 BOM CSV with all filtered correspondence data
- **Frontend**: **Export CSV** button in `/correspondences` filter bar — respects active search/status/revision filters, triggers browser download

### Correspondence Module — Phase 6 Complete (2026-03-24)

#### 🔖 **Tag Manager** (Phase 5 → 6 bridge)

- **New Entity**: `CorrespondenceTag` (`correspondence_tags` junction table) — composite PK, eager-loads `Tag`
- **Backend**: `getTags()`, `addTag()`, `removeTag()` in `CorrespondenceService`; `GET/POST/DELETE /:uuid/tags` endpoints
- **Frontend**: `correspondenceService.getTags/addTag/removeTag` → `useCorrespondenceTags`, `useAddTag`, `useRemoveTag` hooks → `TagManager` component in detail sidebar

#### 🔍 **Search Enhancement** (Phase 6.1)

- **Backend**: Added `status` filter to `SearchQueryDto` and `SearchService.search()` ES query
- **Frontend**: `SearchFilters` now controlled (accepts `filters` prop), proper status codes (`SUBOWN`, `CLBOWN`, `CCBOWN`), active filter badge count
- **Frontend**: Added pagination (Prev/Next) to `/search` page with `PAGE_SIZE = 20`
- **Frontend**: Improved result cards — type-colored icons, color-coded status badges, doc number prominence, correct drawing links

#### 🔄 **Circulation Status Card** (Phase 6.2)

- **Backend**: Added `correspondenceUuid` filter to `SearchCirculationDto`; `findAll` now joins correspondence + routings when filtering by UUID
- **Frontend**: `circulationService.getByCorrespondenceUuid()` → `useCirculationsByCorrespondence` hook → `CirculationStatusCard` component showing per-circulation status + routing assignees in correspondence detail sidebar

#### 📜 **Revision History UI** (Phase 6.3)

- **Frontend**: `RevisionHistory` component — vertical timeline showing all revisions sorted desc, active revision marker, color-coded status, date + remarks; rendered from existing `data.revisions` (no new endpoint needed)

#### ⏰ **Due Date Reminder Cron** (Phase 6.4)

- **Backend**: Registered `ScheduleModule.forRoot()` in `AppModule`
- **Backend**: `DueDateReminderService` — `@Cron(EVERY_DAY_AT_8AM)` queries revisions where `dueDate` between now and +3 days, skips CANCELLED/CLBOWN, sends in-app notification via `NotificationService` with link to correspondence

### CI/CD & Deployment Simplification (2026-03-24)

#### 🚀 **deploy.sh v2.0 — Rewrote deployment script**

- **Changed**: Replaced 9-step blue-green deployment with 3-step direct deploy
- **Step 1**: Build Docker images (backend + frontend) from source
- **Step 2**: `docker compose -f [compose_file] up -d --force-recreate`
- **Step 3**: Health check on `backend` container
- **Removed**: Blue/green directory switching, NGINX switching, `current` file tracking
- **Reason**: QNAP setup uses a single stack — simultaneous blue/green was not viable with shared container names

#### ⚙️ **ci-deploy.yml — CI pipeline improvements**

- **Added**: `pnpm/action-setup@v4` + `cache: 'pnpm'` for faster installs
- **Fixed**: `--watchAll=false` removed from backend test command (not a valid Jest flag)
- **Fixed**: `mkdir -p /share/np-dms/app/logs` before deploy to prevent `tee` error
- **Simplified**: Removed `tee` + `PIPESTATUS` — `set -e` handles errors

### Document Numbering System Fixes (2026-03-21)

#### 🔢 **Template Management Hardening**

- **Issue**: Save/Edit functionality failing due to missing fields and data complexity.
- **Fix (Backend)**: Added `disciplineId` and `isActive` to `DocumentNumberFormat` entity.
- **Fix (Backend)**: Implemented automated "Upsert" logic in `DocumentNumberingService` to handle business keys (Project + Type + Discipline).
- **Fix (Frontend)**: Refactored `numberingApi.saveTemplate` to sanitize DTOs and avoid sending nested relation objects.
- **Feature**: Added **Discipline** selection to the Template Editor UI for granular numbering rules.
- **Result**: Administrators can now successfully create, update, and manage numbering templates globally or per discipline.

### Build & Deployment Fixes (2026-03-20)

#### 🔧 **Backend Dependency Resolution**

- **Issue**: `ms` package not found during build
- **Fix**: Added `"ms": "^2.1.3"` to dependencies and `"@types/ms": "^2.1.0"` to devDependencies
- **Issue**: `CACHE_MANAGER` not available in UserModule and AuthModule
- **Fix**: Added global `CacheModule.register({ isGlobal: true, ttl: 300 })` to AppModule
- **Issue**: `UuidResolverService` not available despite `@Global()` decorator
- **Fix**: Added `CommonModule` import to AppModule to initialize global services
- **Result**: Backend starts successfully with all dependencies resolved

#### 🐳 **Docker Build Fixes**

- **Issue**: Next.js standalone build failed with pnpm symlink structure
- **Error**: `ENOENT: no such file or directory` creating standalone node_modules
- **Fix**: Temporarily disabled `output: "standalone"` in next.config.mjs
- **Fix**: Updated Dockerfile to copy full app and node_modules instead of standalone output
- **Result**: Frontend builds successfully in Docker (slightly larger image)

#### 📦 **Cache Architecture Update**

- **Before**: Local CacheModule imports in UserModule and AuthModule
- **After**: Global CacheModule in AppModule (TTL 5 minutes, in-memory)
- **Benefit**: All services (UserService, AuthService, JwtStrategy, IdempotencyInterceptor, MaintenanceModeGuard) can inject CACHE_MANAGER
- **Note**: Temporary solution until Redis store TypeScript issues are resolved

### Frontend Quality Refactor Pass (2026-03-20)

#### 🔧 **ESLint Hardening**

- Added `@typescript-eslint/no-explicit-any` as warning for TypeScript files
- Added `no-console` as warning for TypeScript files
- Added `eslint-plugin-react-hooks` rules (rules-of-hooks: error, exhaustive-deps: warn)

#### 🧹 **Eliminate `any` Types (69 → 4)**

- **admin pages**: Replaced `(projects as any[])` with typed `{ id?; uuid?; projectCode; projectName }` casts (6 pages)
- **drawings/upload-form.tsx**: Fixed discriminated union form errors with `Record<string, FieldError | undefined>`
- **generic-crud-table.tsx**: Added `ApiError` interface, replaced `any` with `Record<string, unknown>` generics
- **numbering components**: Updated `projectId` prop types to `number | string`, coerced with `Number()`
- **numbering/page.tsx**: Defined `ProjectItem` interface, typed find/filter operations
- **admin/user-dialog.tsx**: Typed roles, organizations, and mutation payloads with `CreateUserDto`
- **admin/security/rbac-matrix.tsx**: Typed API responses with explicit `Role[]` / `Permission[]` return types
- **numbering/template-tester.tsx**: Typed template project access, fixed `error: any` → `error: unknown`
- **numbering/template-editor.tsx**: Typed correspondence type lookup
- **rfas/detail.tsx**: Created `RFADetailData` / `RFADetailItem` interfaces
- **rfas/form.tsx**: Added `items` to `CreateRfaDto`, aligned DTO imports
- **correspondences/form.tsx**: Fixed `defaultValues as any` → `as FormData`
- **correspondences-content.tsx**: Removed `as any` on `useCorrespondences` params
- **drawings/list.tsx**: Replaced `as any` with `as DrawingSearchParams`
- **auth/auth-sync.tsx**: Typed NextAuth session user with explicit interface
- **migration/review/[id]/page.tsx**: Fixed `error: any` → `error: unknown` with typed response cast
- **reference pages** (disciplines, rfa-types, tags): Typed `fetchFn` mapping and `createFn` casts
- **Remaining 4**: All `zodResolver(formSchema) as any` — known zod 4 + @hookform/resolvers compat (marked with `eslint-disable`)

#### 🔇 **Remove Production Console Logs (53 → 4)**

- Removed all `console.log`, `console.warn`, `console.error` from production code
- **Kept**: 4 Next.js error boundary files (`error.tsx`, `global-error.tsx`) — required by framework
- **Replaced**: Redundant catch-block logging where `toast` already provides user feedback
- **Files cleaned**: `lib/auth.ts`, `lib/api/client.ts`, `lib/api/numbering.ts`, `lib/services/dashboard.service.ts`, all numbering components, admin pages, migration pages, workflow components, login page

#### 🔑 **Fix Index-as-Key Anti-pattern**

- **layout/sidebar.tsx**: Replaced `key={index}` with `key={item.href}` (desktop + mobile nav)
- **admin/page.tsx**: Replaced `key={index}` with `key={stat.title}` and `key={link.href}`

#### 📦 **Component Consolidation**

- **correspondences/form.tsx**: Replaced duplicate `FileUpload` import with canonical `FileUploadZone`
- **custom/file-upload-zone.tsx**: Removed unnecessary `as any` cast in File constructor

#### 📊 **Type System Improvements**

- **types/rfa.ts**: Added `items?: RFAItem[]` to `CreateRFADto`
- **types/dto/rfa/rfa.dto.ts**: Added `items?: RFAItem[]` to `CreateRfaDto` (DTO version)
- **Build**: ✅ `pnpm run build` passes with zero errors

### Build Fixes & Dependency Updates (2026-03-19)

#### 🔧 **Build Issues Fixed**

**Frontend Build**:

- **Fixed Tailwind CSS v4.2.2 PostCSS compatibility** → Downgraded to v3.4.3
- **Fixed Zod + React Hook Form compatibility** → @hookform/resolvers@3.9.0
- **Fixed ambiguous routes** → Removed conflicting `[id]` routes
- **Fixed TypeScript errors** → Added proper type casting in template-editor.tsx
- **Result**: ✅ Zero warnings, 57 routes generated

**Backend Build**:

- **Migrated cache-manager-redis-yet → cache-manager-redis-store@3.0.1**
- **Removed deprecated @types packages** → @types/cache-manager, @types/ioredis, @types/uuid
- **Updated import statements** → Redis store import path changed
- **Result**: ✅ Zero warnings, all dependencies compatible

#### 📦 **Package Updates**

```bash
# Frontend
tailwindcss: 4.2.2 → 3.4.3
@hookform/resolvers: 5.2.2 → 3.9.0

# Backend
cache-manager-redis-yet: 5.1.5 → cache-manager-redis-store: 3.0.1
Removed: @types/cache-manager@5.0.0, @types/ioredis@5.0.0, @types/uuid@11.0.0
```

#### 📊 **Build Performance**

- **Frontend**: 19.4s (57 routes, zero warnings)
- **Backend**: ~30s (18 modules, zero warnings)
- **Status**: ✅ Production Ready

#### 📝 **Documentation Updated**

- Updated AGENTS.md, .windsurfrules, CLAUDE.md, GEMINI.md
- Created build-status-2026-03-19.md
- Updated tech stack specifications

### Backend Security & Dependency Updates (2026-03-19)

#### 🛡️ Security Vulnerabilities Fixed

- **All 52 vulnerabilities resolved** (27 high + 20 moderate + 5 low severity)
- **Security overrides applied**: 30 package overrides via `pnpm audit --fix`
- **Current status**: "No known vulnerabilities found"
- **Critical patches applied**:
  - Webpack SSRF bypass (via @nestjs/cli)
  - qs DoS vulnerability (via @compodoc/compodoc)
  - Multiple package security updates (axios, ajv, multer, etc.)

#### 📦 Backend Dependency Updates

**Major Version Upgrades**:

- `@elastic/elasticsearch`: 8.19.1 → 9.3.4 (Major version jump)
- `nodemailer`: 7.0.11 → 8.0.3 (Major version jump)
- `uuid`: 11.1.0 → 13.0.0 (Major version jump)
- `@types/node`: 22.19.1 → 25.5.0 (Major version jump)

**Security & Compatibility Updates**:

- `eslint`: 9.39.1 → 9.39.1 (kept 9.x for typescript-eslint compatibility)
- `typescript-eslint`: 8.48.0 → 8.57.1 (Latest compatible version)
- `@types/uuid`: 10.0.0 → 11.0.0 (Deprecated package updated)
- `ajv`: 8.17.1 → 8.18.0
- `axios`: 1.13.2 → 1.13.6
- `multer`: 2.0.2 → 2.1.1

#### 🔧 Build & Test Configuration

- **Jest Configuration**: Added `transformIgnorePatterns` for UUID v13 ES modules compatibility
- **Build Verification**: Backend builds successfully after updates
- **Test Compatibility**: Sample tests pass (app.controller.spec.ts)
- **ESLint Compatibility**: Maintained 9.x for ecosystem compatibility

#### 📋 Package Management

- **pnpm audit**: Clean slate - 0 vulnerabilities
- **Dependency Resolution**: All peer dependency conflicts resolved
- **Deprecated Packages**: All stub type warnings acknowledged and documented

### Dependency Updates (2026-03-19)

#### Frontend Dependencies 📦

- **Security Updates**:
  - Next.js: 16.0.7 → 16.2.0 (fixes security vulnerability)
  - React: 19.0.0 → 19.2.4
  - React DOM: 19.0.0 → 19.2.4

- **ESLint Migration**:
  - ESLint: 8.57.1 → 9.39.1 (resolves deprecated warning)
  - eslint-config-next: 14.2.33 → 16.2.0
  - Created new `eslint.config.mjs` for ESLint 9 compatibility
  - Updated lint script to use ESLint directly

- **Package Cleanup**:
  - Removed deprecated `@types/uuid@11.0.0` (using built-in types from uuid@13.0.0)
  - Fixed TypeScript ESLint disable comments in template files

- **Other Updates** (25+ packages):
  - axios: 1.13.2 → 1.13.6
  - lucide-react: 0.555.0 → 0.577.0
  - react-day-picker: 9.12.0 → 9.14.0
  - react-hook-form: 7.66.1 → 7.71.2
  - react-dropzone: 14.3.8 → 15.0.0
  - zustand: 5.0.8 → 5.0.12
  - tailwind-merge: 3.4.0 → 3.5.0
  - zod: 4.1.13 → 4.3.6
  - vitest: 4.0.15 → 4.1.0
  - @types/node: 20.19.25 → 25.5.0
  - tailwindcss: 3.4.18 → 4.2.2
  - jsdom: 27.3.0 → 29.0.0

#### Documentation Updates 📚

- **CHANGELOG.md**: Added comprehensive dependency update section
- **README.md**: Updated tech stack versions
- **AGENTS.md**: Updated frontend stack versions
- **CONTRIBUTING.md**: No changes required (already up-to-date)

#### Quality Improvements ✅

- All deprecated package warnings resolved
- ESLint 9 configuration working correctly
- No peer dependency conflicts
- All tests passing (vitest configuration stable)

### In Progress

- UAT (User Acceptance Testing) — ตาม `01-05-acceptance-criteria.md`
- KPI Baseline Collection (As-Is Metrics ก่อน Go-Live)
- Legacy Data Migration — Tier 1 (2,000 docs Critical)
- Final Security Audit — ตาม `04-06-security-operations.md`
- Go-Live: Blue-Green Deploy บน QNAP Container Station

### NestJS 11 + Next.js 16 Migration (2026-03-16)

#### Backend 🔧

- **NestJS 11 Upgrade**: `@nestjs/*` v11, Express v5, removed `@nestjs/mapped-types`
- **RequestWithUser Interface**: Shared typed interface replacing `req: any` across 6 controllers (`auth`, `session`, `file-storage`, `workflow-engine`, `correspondence`, `jwt-refresh`)
- **MasterModule DI Fix**: Imported `UserModule` so `RbacGuard` can resolve `UserService`
- **TypeORM Fix**: Explicit typing for `DocumentNumberFormat` save/create overload resolution
- **Swagger**: Updated API version to 1.8.1

### Frontend 🎨

- **Next.js 16 Upgrade**: Next.js 16.0.7 → 16.2.0, React 19 → 19.2.4 (Security Fix)
- **ESLint 9 Migration**: ESLint 8.57.1 → 9.39.1, removed deprecated warnings
- **Dependency Updates**: Updated 25+ packages to latest stable versions
- **Deprecated Package Cleanup**: Removed `@types/uuid@11.0.0` (using built-in types)
- **proxy.ts Rename**: `middleware.ts` → `proxy.ts` (Next.js 16 deprecated `middleware` convention)
- **ADR-019 UUID Fixes — Drawing Admin Pages (5 pages)**:
  - `contract/volumes`, `contract/categories`, `contract/sub-categories`
  - `shop/main-categories`, `shop/sub-categories`
  - Changed `useState<number>` → `useState<string>`, removed `parseInt(uuid)`
- **ADR-019 UUID Fixes — Contract Page**:
  - Fixed edit form showing "New Contract" (`contract.uuid` → `contract.id` after `@Expose`)
  - Fixed blank Project dropdown (was using contract's UUID instead of project's UUID)
  - Fixed delete passing `undefined` uuid
  - Updated `Contract` interface to match serialized API response
- **ADR-019 UUID Fixes — Disciplines & RFA Types**:
  - `useContracts(projectId=1)` → optional param, fetches all contracts when unspecified
  - `useDisciplines(contractId?: number)` → `number | string`
- **ADR-019 UUID Fixes — Tags Page**:
  - Fixed Radix Select crash on empty `value=""` → `"__none__"` sentinel
  - Fixed Project Scope dropdown showing UUIDs (snake_case → camelCase field names)
- **DTO Updates**: `CreateContractDto`, `SearchContractDto`, `CreateShopMainCategoryDto`, etc. — `projectId: number` → `number | string`
- **Service Updates**: `drawing-master-data.service.ts`, `master-data.service.ts` — accept `string | number` for project/contract IDs

#### Documentation 📚

- **ADR-005**: Updated Backend Stack table (NestJS 11, Express v5)
- **Engineering Guidelines** (`05-01`): Added NestJS 11 specific patterns section
- **README.md**: Tech stack versions, status date, ADR-019 in roadmap
- **AGENTS.md**: Tech stack versions updated

---

## 1.8.1 Patch (2026-03-11)

### Summary

**Product Owner Documentation Complete** — ปิด 10/10 Documentation Gaps สำหรับ UAT Readiness
ระบบมีเอกสารครบถ้วนสำหรับ Stakeholder Sign-off และ Go-Live Process

### Documentation 📚 — 10/10 Gaps Closed

#### Gap 1: Product Vision Statement ✅ `specs/00-Overview/00-03-product-vision.md`

- Elevator Pitch, Problem Statement, Geoffrey Moore Vision Format
- Strategic Pillars: Speed / Security / Visibility
- Phase Roadmap (Now → 24 เดือน), Guardrails, Success Metrics

#### Gap 2: User Stories ✅ `specs/01-Requirements/01-04-user-stories.md`

- 27 User Stories ครอบคลุม 8 Epics
- MoSCoW Prioritization per Story
- Acceptance Criteria + Definition of Done

#### Gap 3: Acceptance Criteria (UAT) ✅ `specs/01-Requirements/01-05-acceptance-criteria.md`

- 35 Acceptance Criteria (All Modules)
- UAT Plan: 4 Phases, Sign-off Process
- Go-Live Criteria Matrix

#### Gap 4: UI/UX Wireframes ✅ `specs/01-Requirements/01-07-ui-wireframes.md`

- Screen Inventory: 26 Screens พร้อม Role + Priority
- Navigation Map / Site Map ครบทุก Route
- ASCII Wireframes: Login, Dashboard, Correspondence, RFA, Circulation, Admin
- Design System Tokens + Interaction Patterns

#### Gap 5: Stakeholder Sign-off & Risk ✅ `specs/00-Overview/00-04-stakeholder-signoff-and-risk.md`

- Sign-off Process 4-Step + Digital Sign Matrix
- Risk Register: 15 Risks (Impact × Probability Matrix)
- Change Control Policy + Emergency Change Process

#### Gap 6: KPI Baseline Data ✅ `specs/00-Overview/00-05-kpi-baseline.md`

- 14 KPIs พร้อม Baseline Collection Form
- SQL Measurement Queries + Grafana Dashboard Specs
- User Satisfaction Survey Template

#### Gap 7: Migration Business Scope ✅ `specs/03-Data-and-Storage/03-06-migration-business-scope.md`

- Data Scope: IN/OUT SCOPE (ปี 2564 → Go-Live)
- Migration Tiers: Tier 1 (2K Critical) / Tier 2 (10K) / Tier 3 (8K Archive)
- Excel Metadata Mapping (11 Columns → Field ใหม่)
- Organization Code Lookup Table
- Timeline: T-6 สัปดาห์ → Go-Live → T+30
- Go/No-Go Gates 3 ด่าน
- Data Security: AI Isolation (ADR-018) + Token 7 วัน + IP Whitelist

#### Gap 8: Release Management Policy ✅ `specs/04-Infrastructure-OPS/04-08-release-management-policy.md`

- SemVer Strategy + Git Flow (main/release/develop/hotfix)
- 5 Release Gates: Code Complete → QA → Staging → Approval → Production
- Quality Thresholds: TS 0 errors, ≥80% Test Coverage, 0 Critical Vuln
- Hotfix Process: P0 < 4h / P1 < 24h + Decision Tree
- Rollback Policy: SLA < 30 วิ (Blue-Green) + Auto-trigger Rules
- CI/CD Pipeline: 5 Stages (Quality → Security → Build → Integration → Release)
- Release Checklist + Security Pre-release Requirements

#### Gap 9: Training Plan ✅ `specs/00-Overview/00-06-training-plan.md`

- Curriculum แบ่งตาม Role (4 Roles)
- 4-Phase Training Timeline
- Hands-on Lab + Assessment Criteria

#### Gap 10: Edge Cases & Business Rules ✅ `specs/01-Requirements/01-06-edge-cases-and-rules.md`

- 37 Edge Cases ครอบคลุมทุก Module
- Business Logic Guards + Error Handling Matrix

### Architecture Decision Records 🏛️

- **ADR-018** (Patch 1.8.1): AI Boundary — Ollama Isolation Policy
  - Ollama ไม่มี Direct DB/Storage Access
  - AI Output ต้องผ่าน Backend Validation ก่อน Write
  - Migration Bot Token: IP Whitelist + 7-day Expiry

### READMEs Updated 📄

- `README.md`: Status badge v1.8.1, UAT Ready, 10/10 Gaps table, fixed schema commands, updated Roadmap
- `CONTRIBUTING.md`: Spec tree updated (new files), schema filenames corrected, category table updated
- `specs/00-Overview/README.md`: Quick Links table เพิ่ม Gap 4/7/8 links
- `specs/01-Requirements/README.md`: Gap documents registered
- `specs/03-Data-and-Storage/README.md`: Migration Scope registered
- `specs/04-Infrastructure-OPS/README.md`: Release Policy registered

## 1.8.0 (2026-02-24)

### Summary

**Documentation Realignment & Type Safety** - Comprehensive overhaul of the specifications structure and frontend codebase to enforce strict typing and consistency.

### Codebase Changes 💻

- **Frontend Type Safety**: Removed all `any` types from Frontend DTOs and Hooks. Implemented explicit types (`AuditLog[]`, `Record<string, unknown>`) avoiding implicit fallbacks.
- **Frontend Refactoring**: Refactored data fetching and mutations utilizing `TanStack Query` hooks aligned with real API endpoints.
- **Admin Pages Fixes**: Addressed crashes on Reference Data/Categories pages by introducing robust error handling and proper generic typing on DataTables.

### Documentation 📚

- **Specification Restructuring**: Restructured the entire `specs/` directory into 7 canonical layers (`00-Overview`, `01-Requirements`, `02-Architecture`, `03-Data-and-Storage`, `04-Infrastructure-OPS`, `05-Engineering-Guidelines`, `06-Decision-Records`).
- **Guidelines Synchronization**: Updated Engineering Guidelines (`05-1` to `05-4`) to reflect the latest state management (Zustand, React Hook Form) and testing strategies.
- **ADR Alignment**: Audited Architecture Decision Records (ADR 1 to 16) against actual implementation (e.g., LocalStorage JWT vs HTTP-Only cookies, bcrypt salt rounds).
- **Root Docs Update**: Fully updated `README.md` and `CONTRIBUTING.md` to reflect the current v1.8.0 folder structure and rules.
- **Cleanups**: Consolidated standalone infrastructure specs (formerly `08-infrastructure`) into `04-Infrastructure-OPS` and cleaned up legacy scripts and blank diagrams from the repository root.

## 1.7.0 (2025-12-18)

### Summary

**Schema Stabilization & Document Numbering Overhaul** - Significant schema updates to support advanced document numbering (reservations, varying reset scopes) and a unified workflow engine.

### Database Schema Changes 💾

#### Document Numbering System (V2) 🔢

- **`document_number_counters`**:
  - **Breaking Change**: Primary Key changed to 8-column Composite Key (`project_id`, `originator_id`, `recipient_id`, `type_id`, `sub_type_id`, `rfa_type_id`, `discipline_id`, `reset_scope`).
  - **New Feature**: Added `reset_scope` column to support flexible resetting (YEAR, MONTH, PROJECT, NONE).
  - **New Feature**: Added `version` column for Optimistic Locking.
- **`document_number_reservations`** (NEW):
  - Implemented Two-Phase Commit pattern (Reserve -> Confirm) for document numbers.
  - Prevents race conditions and gaps in numbering.
- **`document_number_errors`** (NEW):
  - Helper table for tracking numbering failures and deadlocks.
- **`document_number_audit`**:
  - Enhanced with reservation tokens and performance metrics.

#### Unified Workflow Engine 🔄

- **`workflow_definitions`**:
  - Updated structure to support compiled DSL and versioning.
  - Added `dsl` (JSON) and `compiled` (JSON) columns.
- **`workflow_instances`**:
  - Changed ID to UUID.
  - Added `entity_type` and `entity_id` for polymorphic polymorphism.
- **`workflow_histories`**:
  - Updated to link with UUID instances.

#### System & Audit 🛡️

- **`audit_logs`**:
  - Updated schema for better partitioning support (`created_at` in PK).
  - Standardized JSON details column.
- **`notifications`**:
  - Updated schema to support polymorphic entity linking.

#### Master Data

- **`disciplines`**:
  - Added relation to `correspondences` and `rfas`.

### Documentation 📚

- **Data Dictionary**: Updated to v1.7.0 with full index summaries and business rules.
- **Schema**: Released `lcbp3-v1.7.0-schema.sql` and `lcbp3-v1.7.0-seed.sql`.

## 1.6.0 (2025-12-13)

### Summary

**Schema Refactoring Release** - Major restructuring of correspondence and RFA tables for improved data consistency.

### Database Schema Changes 💾

#### Breaking Changes ⚠️

- **`correspondence_recipients`**: FK changed from `correspondence_revisions(correspondence_id)` → `correspondences(id)`
- **`rfa_items`**: Column renamed `rfarev_correspondence_id` → `rfa_revision_id`

#### Schema Refactoring

- **`correspondences`**: Reordered columns, `discipline_id` now inline (no ALTER TABLE)
- **`correspondence_revisions`**:
  - Renamed: `title` → `subject`
  - Added: `body TEXT`, `remarks TEXT`, `schema_version INT`
  - Added Virtual Columns: `v_ref_project_id`, `v_doc_subtype`
- **`rfas`**:
  - Changed to Shared PK pattern (no AUTO_INCREMENT)
  - PK now FK to `correspondences(id)`
- **`rfa_revisions`**:
  - Removed: `correspondence_id` (uses rfas.id instead)
  - Renamed: `title` → `subject`
  - Added: `body TEXT`, `remarks TEXT`, `due_date DATETIME`, `schema_version INT`
  - Added Virtual Column: `v_ref_drawing_count`

### Documentation 📚

- Updated Data Dictionary to v1.6.0
- Updated schema SQL files (`lcbp3-v1.6.0-schema.sql`, seed files)

## 1.5.1 (2025-12-10)

### Summary

**Major Milestone: System Feature Complete (~95%)** - Ready for UAT and production deployment.

All core modules implemented and operational. Backend and frontend fully integrated with comprehensive admin tools.

### Backend Completed ✅

#### Core Infrastructure

- ✅ All 18 core modules implemented and tested
- ✅ JWT Authentication with Refresh Token mechanism
- ✅ RBAC 4-Level (Global, Organization, Project, Contract) using CASL
- ✅ Document Numbering with Redis Redlock + Optimistic Locking
- ✅ Workflow Engine (DSL-based Hybrid Engine with legacy support)
- ✅ Two-Phase File Storage with ClamAV Virus Scanning
- ✅ Global Audit Logging with Interceptor
- ✅ Health Monitoring & Metrics endpoints

#### Business Modules

- ✅ **Correspondence Module** - Master-Revision pattern, Workflow integration, References
- ✅ **RFA Module** - Full CRUD, Item management, Revision handling, Approval workflow
- ✅ **Drawing Module** - Separated into Shop Drawing & Contract Drawing
- ✅ **Transmittal Module** - Document transmittal tracking
- ✅ **Circulation Module** - Circulation sheet management
- ✅ **Elasticsearch Integration** - Direct indexing, Full-text search (95% complete)

#### Supporting Services

- ✅ **Notification System** - Email and LINE notification integration
- ✅ **Master Data Management** - Consolidated service for Organizations, Projects, Disciplines, Types
- ✅ **User Management** - CRUD, Assignments, Preferences, Soft Delete
- ✅ **Dashboard Service** - Statistics and reporting APIs
- ✅ **JSON Schema Validation** - Dynamic schema validation for documents

### Frontend Completed ✅

#### Application Structure

- ✅ All 15 frontend tasks (FE-001 to FE-015) completed
- ✅ Next.js 14 App Router with TypeScript
- ✅ Complete UI implementation (17 component groups, 22 Shadcn/UI components)
- ✅ TanStack Query for server state management
- ✅ Zustand for client state management
- ✅ React Hook Form + Zod for form validation
- ✅ Responsive layout (Desktop & Mobile)

#### End-User Modules

- ✅ **Authentication UI** - Login, Token Management, Session Sync
- ✅ **RBAC UI** - `<Can />` component for permission-based rendering
- ✅ **Correspondence UI** - List, Create, Detail views with file uploads
- ✅ **RFA UI** - List, Create, Item management
- ✅ **Drawing UI** - Contract & Shop drawing lists, Upload forms
- ✅ **Search UI** - Global search bar, Advanced filtering with Elasticsearch
- ✅ **Dashboard** - Real-time KPI cards, Activity feed, Pending tasks
- ✅ **Circulation UI** - Circulation sheet management with DataTable
- ✅ **Transmittal UI** - Transmittal tracking and management

#### Admin Panel (10 Routes)

- ✅ **Workflow Configuration** - DSL Editor, Visual Builder, Workflow Definition management
- ✅ **Document Numbering Config** - Template Editor, Token Tester, Sequence Viewer
- ✅ **User Management** - CRUD, Role assignments, Preferences
- ✅ **Organization Management** - Organization CRUD and hierarchy
- ✅ **Project Management** - Project and contract administration
- ✅ **Reference Data Management** - CRUD for Disciplines, Types, Categories (6 modules)
- ✅ **Security Administration** - RBAC Matrix, Roles, Active Sessions (2 modules)
- ✅ **Audit Logs** - Comprehensive audit log viewer
- ✅ **System Logs** - System log monitoring
- ✅ **Settings** - System configuration

### Database 💾

- ✅ Schema v1.5.1 with standardized audit columns (`created_at`, `updated_at`, `deleted_at`)
- ✅ Complete seed data for all master tables
- ✅ Migration scripts and patches (`patch-audit-columns.sql`)
- ✅ Data Dictionary v1.5.1 documentation

### Documentation 📚

- ✅ Complete specs/ reorganization to v1.5.1
- ✅ 21 requirements documents in `specs/01-requirements/`
- ✅ 17 ADRs (Architecture Decision Records) in `specs/05-decisions/`
- ✅ Implementation guides for Backend & Frontend
- ✅ Operations guides for critical features (Document Numbering)
- ✅ Comprehensive progress reports updated
- ✅ Task archiving to `specs/09-history/` (27 completed tasks)

### Bug Fixes 🐛

- 🐛 Fixed role selection bug in User Edit form (2025-12-09)
- 🐛 Fixed workflow permissions - 403 error on workflow action endpoints
- 🐛 Fixed TypeORM relation errors in RFA and Drawing services
- 🐛 Fixed token refresh infinite loop in authentication
- 🐛 Fixed database schema alignment issues (audit columns)
- 🐛 Fixed "drawings.map is not a function" by handling paginated responses
- 🐛 Fixed invalid refresh token error loop

### Changed 📝

- 📝 Updated progress reports to reflect ~95% backend, 100% frontend completion
- 📝 Aligned all TypeORM entities with schema v1.5.1
- 📝 Enhanced data dictionary with business rules
- 📝 Archived 27 completed task files to `specs/09-history/`

## 1.5.0 (2025-11-30)

### Summary

Initial spec-kit structure establishment and documentation organization.

### Changed

- Changed the version to 1.5.0
- Modified to Spec-kit
