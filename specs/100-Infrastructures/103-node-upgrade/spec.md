# Feature Specification: Node.js Upgrade v22.20.0 → v24.15.0

**Feature Branch**: `103-node-upgrade`  
**Created**: 2026-05-05  
**Status**: Draft  
**Input**: User description: "การอัพเกรด node v22.20.0 เป็นv24.15.0"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Backend Node.js Upgrade (Priority: P1)

As a system administrator, I need to upgrade the Node.js runtime for the NAP-DMS backend from v22.20.0 to v24.15.0 to ensure the system runs on a supported LTS version with the latest security patches and performance improvements.

**Why this priority**: Node.js v22.x maintenance support ends in 2026, and v24.x is the current LTS with extended support through 2027. Running on an unsupported version creates security risks and blocks dependency updates.

**Independent Test**: Can be fully tested by upgrading Node.js in a staging environment, running the full test suite, and verifying all API endpoints respond correctly with expected performance metrics.

**Acceptance Scenarios**:

1. **Given** the backend is running Node.js v22.20.0, **When** the upgrade to v24.15.0 is applied, **Then** all backend services start successfully without errors
2. **Given** the upgraded backend, **When** the full test suite runs, **Then** 100% of tests pass with no new failures compared to pre-upgrade baseline
3. **Given** the upgraded backend, **When** API endpoints receive requests, **Then** response times remain within 5% of pre-upgrade performance baseline

---

### User Story 2 - Frontend Node.js Upgrade (Priority: P1)

As a system administrator, I need to upgrade the Node.js runtime for the NAP-DMS frontend build environment from v22.20.0 to v24.15.0 to ensure compatibility with the latest Next.js and build toolchain versions.

**Why this priority**: The frontend build pipeline requires Node.js v24+ for optimal compatibility with Next.js 15+ and React 19 features. Staying on v22 blocks framework updates.

**Independent Test**: Can be fully tested by upgrading Node.js in a staging environment, building the frontend application, and verifying all pages render correctly.

**Acceptance Scenarios**:

1. **Given** the frontend build uses Node.js v22.20.0, **When** the upgrade to v24.15.0 is applied, **Then** the production build completes without errors
2. **Given** the upgraded build environment, **When** the Next.js application builds, **Then** all TypeScript compilation passes with zero errors
3. **Given** the built application, **When** pages are served, **Then** all routes render correctly with no runtime errors

---

### User Story 3 - Dependency Compatibility Validation (Priority: P2)

As a developer, I need to validate that all project dependencies are compatible with Node.js v24.15.0 to prevent runtime errors and security vulnerabilities.

**Why this priority**: Major Node.js version upgrades can introduce breaking changes in native dependencies and Node-API modules. Validation prevents production issues.

**Independent Test**: Can be fully tested by running `npm audit` and dependency compatibility checks after the Node.js upgrade.

**Acceptance Scenarios**:

1. **Given** the upgraded Node.js environment, **When** dependency compatibility checks run, **Then** no critical compatibility warnings are reported
2. **Given** the upgraded environment, **When** `npm audit` executes, **Then** no new high-severity vulnerabilities are introduced by the Node.js upgrade

---

### User Story 4 - Rollback Capability (Priority: P2)

As a DevOps engineer, I need a documented and tested rollback procedure to revert to Node.js v22.20.0 in case the upgrade causes unforeseen production issues.

**Why this priority**: Production upgrades carry risk. A tested rollback plan ensures business continuity if issues arise post-deployment.

**Independent Test**: Can be fully tested by performing a rollback in staging and verifying services return to v22.20.0 baseline functionality.

**Acceptance Scenarios**:

1. **Given** the system is running Node.js v24.15.0, **When** the rollback procedure is executed, **Then** the system returns to Node.js v22.20.0 within 15 minutes
2. **Given** the rolled-back system, **When** services restart, **Then** all functionality works as it did before the upgrade attempt

---

### Edge Cases

- What happens when native modules (like bcrypt, sharp) fail to compile under Node.js v24?
- How does the system handle package-lock.json or pnpm-lock.yaml incompatibilities?
- What happens when environment variables specific to Node.js v22 are no longer valid in v24?
- How does the build process handle deprecated Node.js APIs that were removed in v24?
- What happens when the Docker base images for Node.js v24 are not yet available?
- How does the system handle memory allocation differences between Node.js v22 and v24?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST upgrade backend Node.js runtime from v22.20.0 to v24.15.0
- **FR-002**: System MUST upgrade frontend build environment Node.js from v22.20.0 to v24.15.0
- **FR-003**: System MUST ensure all existing tests pass on Node.js v24.15.0 without modification
- **FR-004**: System MUST update Docker base images to Node.js v24.15.0 (node:24.15.0-alpine or equivalent)
- **FR-005**: System MUST validate all native dependencies compile successfully on Node.js v24.15.0
- **FR-006**: System MUST update CI/CD pipelines to use Node.js v24.15.0
- **FR-007**: System MUST document any breaking changes or migration steps required for developers
- **FR-008**: System MUST provide rollback procedures to revert to Node.js v22.20.0 if needed

### Key Entities _(include if feature involves data)_

- **Node.js Runtime**: The JavaScript execution environment for backend and frontend build processes (target: v24.15.0 LTS)
- **Docker Base Image**: Container images specifying Node.js version (e.g., `node:24.15.0-alpine3.21`)
- **Package Dependencies**: npm/pnpm dependencies that may have native bindings requiring Node.js compatibility
- **CI/CD Pipeline**: GitHub Actions/Gitea workflows that specify Node.js version for builds and tests
- **Environment Configuration**: `.nvmrc`, `package.json` engines field, and documentation specifying Node.js requirements

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Backend services start successfully on Node.js v24.15.0 with zero startup errors
- **SC-002**: 100% of existing unit and integration tests pass on Node.js v24.15.0
- **SC-003**: API response times remain within 5% of pre-upgrade performance baseline
- **SC-004**: Frontend production build completes without errors or new warnings on Node.js v24.15.0
- **SC-005**: No new high or critical security vulnerabilities introduced by Node.js v24.15.0 (per `npm audit`)
- **SC-006**: All native dependencies (bcrypt, sharp, etc.) compile and function correctly on Node.js v24.15.0
- **SC-007**: Rollback to Node.js v22.20.0 completes within 15 minutes with full functionality restored
- **SC-008**: CI/CD pipelines execute successfully using Node.js v24.15.0 without workflow modifications

## Assumptions

- Node.js v24.15.0 LTS is available and stable at the time of upgrade
- Docker images for `node:24.15.0-alpine` are published and accessible
- The current codebase does not use deprecated Node.js APIs removed in v24
- pnpm is compatible with Node.js v24.15.0
- All third-party dependencies have Node.js v24-compatible versions available

## Dependencies

- Docker image availability for Node.js v24.15.0
- Gitea/CI runner access to Node.js v24.15.0
- Development team workstations capable of running Node.js v24.15.0
- Test environment availability for pre-production validation

## Notes

- Node.js v24 is the current LTS (Long Term Support) version as of 2025
- Node.js v22 enters maintenance mode in late 2025 and End-of-Life in 2026
- Key improvements in v24 include: improved permission model, experimental TypeScript support, and performance optimizations
- The upgrade should be scheduled during a low-usage maintenance window
- Consider running both versions in parallel during the transition period (blue-green deployment)
