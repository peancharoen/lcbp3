# TASK-BE-014: Backend Testing & Documentation Strategy

**Status:** Draft
**Owner:** TBD
**Priority:** High
**Related:**

- `specs/03-implementation/testing-strategy.md`
- `specs/03-implementation/backend-guidelines.md`

## 🎯 Objective

Establish a robust safety net and comprehensive documentation for the Backend (NestJS).
Goal: **Quality First, Self-Documenting Code.**

## 📋 Scope

### 1. Unit Testing (Target: 80% Coverage on Services)

Focus on Business Logic, not framework glue code.

- [/] **Unit Testing (Service Level):** <!-- In Progress -->
  - [x] `DocumentNumberingService` (Mock Redis/Redlock, Test Optimistic Lock).
  - [x] `FileStorageService` (Test Local Storage fs-extra).
  - [x] `WorkflowEngineService` (Test state transitions/Guard validation).
  - [x] `AuthService` (Critical: RBAC)

- [ ] **Feature Modules:**
  - [ ] `CorrespondenceService` & `CorrespondenceWorkflowService`
  - [ ] `RfaService` & `RfaWorkflowService`
  - [ ] `TransmittalService` & `CirculationService`

### 2. Integration / E2E Testing (Target: Critical User Journeys)

Verify end-to-end flows using a Test Database (Dockerized MariaDB).

- [ ] **Infrastructure:**
  - [ ] Ensure `docker-compose.test.yml` exists for isolated DB testing.
  - [ ] Setup Global Setup/Teardown for Jest E2E.
- [ ] **Scenarios:**
  - [ ] **Auth Flow:** Login -> JWT -> RBAC Rejection.
  - [ ] **Document Lifecycle:** Create -> Upload -> Submit -> Approve -> Complete.
  - [ ] **Search:** Create Doc -> Wait -> Search (Elasticsearch Mock/Real).

### 3. Documentation

- [/] **API Documentation (Swagger/OpenAPI):** <!-- In Progress -->
  - [x] Ensure all DTOs have `@ApiProperty()` (Verified in CreateCorrespondenceDto and others).
  - [x] Ensure all Controllers have `@ApiOperation()` and `@ApiResponse()` (Done for Auth & Correspondence).
  - [ ] Verify `http://localhost:3000/docs` covers 100% of endpoints.
- [/] **Code Documentation (Compodoc):** <!-- In Progress -->
  - [x] Install `@compodoc/compodoc`.
  - [x] Configure `tsconfig.doc.json`.
  - [x] Add `npm run doc` script.
  - [ ] Generate static HTML documentation.

## 🛠Implementation Details

### Tools

- **Unit/Integration:** `jest`, `ts-jest`, `@nestjs/testing`
- **E2E:** `supertest`
- **Docs:** `@nestjs/swagger`, `@compodoc/compodoc`

## ✅ Definition of Done

1. [ ] `npm run test` passes (Unit Tests).
2. [ ] `npm run test:e2e` passes (E2E Tests).
3. [ ] `npm run doc` generates valid HTML.
4. [ ] Swagger UI (`/docs`) is complete and usable.
5. [ ] **Testing Strategy Guide** is updated if new patterns emerge.
