# Session — 2026-06-14 (Frontend Test Coverage & TypeORM Fix)

## Summary

Fixed frontend test coverage issues (722 tests passing) and resolved TypeORM connection error by adding RfaWorkflow entity to RfaModule registration. Successfully deployed to production.

## ปัญหาที่พบ (Root Cause)

### Issue 1: Frontend Test Coverage Directory Error
- **Error**: Vitest coverage directory `.tmp` was being removed during test run, causing `ENOENT` error
- **Root Cause**: Race condition or cleanup process interfering with coverage temporary files
- **Fix**: Ran tests without coverage flag initially, then with coverage after cleanup

### Issue 2: TypeORM Entity Metadata Not Found
- **Error**: `Entity metadata for RfaRevision#workflows was not found`
- **Root Cause**: `RfaWorkflow` entity was referenced in `@OneToMany` relation in `RfaRevision` but not registered in `TypeOrmModule.forFeature()` in `RfaModule`
- **Fix**: Added `RfaWorkflow` import and registration to `RfaModule`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------------- |
| `frontend/components/admin/ai/__tests__/` | Added 6 new test files (ContextConfigEditor, PromptEditor, RuntimeParametersPanel, SandboxTabs, VersionHistory, PromptTypeDropdown) |
| `frontend/components/layout/__tests__/` | Added 5 new test files (GlobalSearch, NotificationsDropdown, ProjectSwitcher, Sidebar, UserMenu) |
| `frontend/.gitignore` | Updated to exclude test artifacts |
| `frontend/vitest.setup.ts` | Updated for better test configuration |
| `backend/src/modules/rfa/rfa.module.ts` | Added `RfaWorkflow` import and registration in `TypeOrmModule.forFeature()` |

## กฎที่ Lock แล้ว

- **TypeORM Entity Registration**: All entities referenced in `@OneToMany`/`@ManyToOne` relations must be registered in the module's `TypeOrmModule.forFeature()` array
- **Test Coverage**: Frontend test coverage now at 51.62% statements (722 tests passing across 103 test files)

## Verification

- [x] Frontend tests pass: 722/722 tests passing (103 test files)
- [x] Backend TypeORM connection successful
- [x] Deployment to QNAP successful
- [x] No ESLint errors in committed code
