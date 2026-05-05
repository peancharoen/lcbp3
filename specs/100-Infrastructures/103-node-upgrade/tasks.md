# Tasks: Node.js Upgrade v22.20.0 → v24.15.0

**Input**: Design documents from `/specs/100-Infrastructures/103-node-upgrade/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)

---

## Phase 1: Setup (Environment Preparation)

**Purpose**: Verify local environment readiness and create feature branch

- [ ] T001 [P] Verify Node.js v24.15.0 is available: `nvm install 24.15.0` and confirm installation
- [ ] T002 Create feature branch: `git checkout -b 103-node-upgrade`
- [ ] T003 [P] Verify pnpm 9.x compatibility with Node.js v24: check pnpm documentation
- [ ] T004 Pull latest Docker image: `docker pull node:24.15.0-alpine3.21`

---

## Phase 2: Foundational (Configuration Updates)

**Purpose**: Update all configuration files to specify Node.js v24.15.0

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Update `backend/package.json` engines field: `"node": ">=24.0.0"`
- [x] T006 [P] Update `frontend/package.json` engines field: `"node": ">=24.0.0"`
- [x] T007 [P] Create `backend/.nvmrc` with content: `24.15.0`
- [x] T008 [P] Create `frontend/.nvmrc` with content: `24.15.0`
- [x] T009 Update `.gitea/workflows/ci-deploy.yml`: change `node-version: '22.20.0'` to `node-version: '24.15.0'`

**Checkpoint**: Foundation ready - configuration files updated, user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Backend Node.js Upgrade (Priority: P1) 🎯 MVP

**Goal**: Upgrade backend to run on Node.js v24.15.0 with 100% test pass rate

**Independent Test**: Run full backend test suite, verify all API endpoints respond correctly, confirm 100% tests pass

### Docker & Build for Backend

- [x] T010 [P] Update `backend/Dockerfile`: change `FROM node:22-alpine` to `FROM node:24-alpine` (all 3 stages)
- [ ] T011 Regenerate `backend/pnpm-lock.yaml`: `rm -rf node_modules pnpm-lock.yaml && pnpm install` (uses Node.js v24)
- [ ] T012 Test backend Docker build: `docker build -t nap-dms-backend:v24-test .` - verify no errors

### Native Dependencies Validation

- [ ] T013 Verify bcrypt compiles: check Docker build output for bcrypt compilation success
- [ ] T014 Verify sqlite3 compiles: check Docker build output for sqlite3 compilation success
- [ ] T015 [P] Verify argon2 compiles: check Docker build output for argon2 compilation success

### Testing Backend

- [ ] T016 Run backend unit tests: `cd backend && pnpm test` - must show 100% pass
- [ ] T017 Run backend e2e tests: `cd backend && pnpm run test:e2e` - must show 100% pass
- [ ] T018 Verify backend starts: `cd backend && pnpm start:dev` - confirm no startup errors
- [ ] T019 API performance baseline: Run load test (k6) and verify response times within 5% of v22 baseline

**Checkpoint**: Backend Node.js upgrade complete - fully functional and independently testable

---

## Phase 4: User Story 2 - Frontend Node.js Upgrade (Priority: P1)

**Goal**: Upgrade frontend build environment to Node.js v24.15.0 with successful production build

**Independent Test**: Run frontend production build, verify all pages render correctly, TypeScript compilation passes

### Docker & Build for Frontend

- [x] T020 [P] Update `frontend/Dockerfile`: change `FROM node:22-alpine` to `FROM node:24-alpine` (all 3 stages)
- [ ] T021 Regenerate `frontend/pnpm-lock.yaml`: `rm -rf node_modules pnpm-lock.yaml && pnpm install` (uses Node.js v24)
- [ ] T022 Test frontend Docker build: `docker build -t nap-dms-frontend:v24-test .` - verify no errors

### Build Validation

- [ ] T023 Run TypeScript compilation: `cd frontend && pnpm tsc --noEmit` - verify zero errors
- [ ] T024 Run frontend production build: `cd frontend && pnpm build` - verify completes without errors or new warnings

### Testing Frontend

- [ ] T025 Run frontend unit tests: `cd frontend && pnpm test` - must show 100% pass
- [ ] T026 Verify build output: Check `.next/` directory generated with all expected files
- [ ] T027 Run Next.js dev server: `cd frontend && pnpm dev` - verify no runtime errors on initial page load

**Checkpoint**: Frontend Node.js upgrade complete - fully functional and independently testable

---

## Phase 5: User Story 3 - Dependency Compatibility Validation (Priority: P2)

**Goal**: Validate all project dependencies are compatible with Node.js v24.15.0, no new security vulnerabilities

**Independent Test**: Run `npm audit` and dependency compatibility checks, confirm no critical issues

### Security Audit

- [ ] T028 [P] Run backend audit: `cd backend && pnpm audit` - document any high/critical findings
- [ ] T029 [P] Run frontend audit: `cd frontend && pnpm audit` - document any high/critical findings
- [ ] T030 Verify no new vulnerabilities: Compare audit results with pre-upgrade baseline - no new high/critical issues

### Native Dependency Deep Check

- [ ] T031 Verify sharp functionality: Test image processing operations in backend (if applicable)
- [ ] T032 Verify all native modules load: Run backend with `NODE_DEBUG=module` and check for load errors
- [ ] T033 Check for deprecated API usage: Run `node --trace-deprecation` during tests, document any warnings

### Dependency Report

- [ ] T034 Create compatibility report: Document all dependencies and their Node.js v24 compatibility status

**Checkpoint**: Dependency validation complete - all packages compatible, no new security issues

---

## Phase 6: User Story 4 - Rollback Capability (Priority: P2)

**Goal**: Document and test rollback procedure to revert to Node.js v22.20.0 within 15 minutes

**Independent Test**: Perform rollback in staging environment, verify services return to v22.20.0 baseline functionality

### Rollback Documentation

- [ ] T035 Create rollback runbook: Document exact steps to revert to v22.20.0 in `docs/node-rollback.md`
- [ ] T036 Document rollback triggers: Define criteria that would trigger rollback (e.g., >5% performance regression, test failures)

### Rollback Testing

- [ ] T037 Test rollback procedure: In staging environment, revert Dockerfile and package.json to v22.20.0
- [ ] T038 Verify rollback timing: Confirm complete rollback completes within 15 minutes
- [ ] T039 Verify post-rollback functionality: Run tests after rollback, confirm 100% pass rate restored
- [ ] T040 Test git revert approach: `git revert HEAD` and verify clean rollback

### Rollback Automation (Optional Enhancement)

- [ ] T041 [P] Create rollback script: `scripts/rollback-node.sh` that automates the revert process

**Checkpoint**: Rollback capability verified - procedure tested, documented, and executable within 15 minutes

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation updates, and merge preparation

### Documentation Updates

- [ ] T042 Update `README.md`: Add Node.js v24.15.0 requirement to prerequisites section
- [ ] T043 Update developer onboarding docs: Reference new `.nvmrc` files for version management
- [ ] T044 Update `CHANGELOG.md`: Add entry for Node.js v24.15.0 upgrade

### Final Validation

- [ ] T045 Run quickstart.md validation: Follow quickstart.md steps exactly, verify all steps pass
- [ ] T046 CI/CD pipeline test: Push branch and verify Gitea Actions workflow passes with Node.js v24.15.0
- [ ] T047 Staging deployment: Deploy to staging environment, run smoke tests for 30 minutes
- [ ] T048 Performance comparison: Compare API response times (v22 vs v24) - document results

### Merge Preparation

- [ ] T049 Create merge request: Push `103-node-upgrade` branch, create MR to `main` with detailed description
- [ ] T050 Final review checklist: Verify all 8 success criteria from spec.md are met

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - Can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 US1, P1 US2, P2 US3, P2 US4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on US1 (but US1 should pass first)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on US1/US2 for dependency testing
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - No dependencies, but should test after US1/US2 complete

### Within Each User Story

- Docker updates first (no dependencies)
- Lockfile regeneration depends on package.json updates
- Testing depends on successful builds
- Validation depends on successful tests

### Parallel Opportunities

| Parallel Group | Tasks |
|----------------|-------|
| Setup | T001, T003, T004 |
| Foundational | T005, T006, T007, T008, T009 |
| Backend Docker | T010, T013, T014, T015 |
| Frontend Docker | T020 |
| Security Audits | T028, T029 |
| Documentation | T042, T043, T044 |

---

## Parallel Example: Backend Upgrade (User Story 1)

```bash
# Phase 2 Foundational (all in parallel):
Task: "Update backend/package.json engines field"
Task: "Create backend/.nvmrc"
Task: "Update .gitea/workflows/ci-deploy.yml"

# Phase 3 Backend Upgrade (parallel where [P] marked):
Task: "Update backend/Dockerfile base image"
Task: "Verify bcrypt compiles"
Task: "Verify sqlite3 compiles"
Task: "Verify argon2 compiles"

# Sequential after Docker build:
Task: "Regenerate backend/pnpm-lock.yaml"
Task: "Test backend Docker build"
Task: "Run backend unit tests"
Task: "Run backend e2e tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Backend Upgrade)
4. **STOP and VALIDATE**: Test backend independently
5. Deploy to staging if backend passes all tests

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Backend) → Test independently → Deploy to staging (MVP!)
3. Add User Story 2 (Frontend) → Test independently → Deploy to staging
4. Add User Story 3 (Dependency Validation) → Test independently
5. Add User Story 4 (Rollback) → Test independently
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Backend)
   - Developer B: User Story 2 (Frontend)
   - Developer C: User Story 3 (Dependency Validation)
   - Developer D: User Story 4 (Rollback)
3. Stories complete and integrate independently

---

## Task Count Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Setup | 4 | - |
| Foundational | 5 | - |
| US1 - Backend | 10 | US1 |
| US2 - Frontend | 7 | US2 |
| US3 - Dependencies | 7 | US3 |
| US4 - Rollback | 6 | US4 |
| Polish | 6 | - |
| **Total** | **45** | - |

### Parallel Opportunities Identified: 6 groups

---

## Success Criteria Tracking

| Criteria | Task(s) | Status |
|----------|---------|--------|
| SC-001: Backend starts without errors | T018 | ⬜ |
| SC-002: 100% tests pass | T016, T017, T025 | ⬜ |
| SC-003: API within 5% performance | T019 | ⬜ |
| SC-004: Frontend build success | T024 | ⬜ |
| SC-005: No new vulnerabilities | T030 | ⬜ |
| SC-006: Native deps compile | T013, T014, T015 | ⬜ |
| SC-007: Rollback within 15 min | T038 | ⬜ |
| SC-008: CI/CD passes | T046 | ⬜ |

---

## Notes

- All file paths are relative to repository root
- [P] tasks can be executed in parallel by different team members
- Each user story should be independently completable and testable
- Commit after each logical group of tasks
- Stop at any checkpoint to validate story independently
- Target completion: 3-5 days for full feature (parallel team)
- Single developer: 5-7 days sequential
