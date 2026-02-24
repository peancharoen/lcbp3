# Version History

## [Unreleased]

### In Progress

- Continuous Integration & End-to-End Test (E2E) Improvements
- Advanced Analytics Dashboard Planning

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
