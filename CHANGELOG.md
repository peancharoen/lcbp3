# Version History

## [Unreleased]

### In Progress
- E2E Testing & UAT preparation
- Performance optimization and load testing
- Production deployment preparation

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

### Summary
