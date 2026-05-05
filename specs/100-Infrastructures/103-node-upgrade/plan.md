# Implementation Plan: Node.js Upgrade v22.20.0 → v24.15.0

**Branch**: `103-node-upgrade` | **Date**: 2026-05-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification for upgrading Node.js from v22.20.0 to v24.15.0

## Summary

Upgrade NAP-DMS backend (NestJS) and frontend (Next.js) build environments from Node.js v22.20.0 to v24.15.0 LTS. This upgrade ensures continued security support through 2027, enables Next.js 15+ and React 19 features, and provides performance improvements. The implementation involves Docker image updates, CI/CD pipeline changes, dependency validation, and comprehensive testing with a documented rollback procedure.

## Technical Context

**Language/Version**: Node.js v24.15.0 LTS (current LTS as of 2025)  
**Primary Dependencies**: 
- Backend: NestJS 10.x, TypeScript 5.x, TypeORM 0.3.x
- Frontend: Next.js 14.x, React 18.x
- Package Manager: pnpm 9.x

**Storage**: N/A (infrastructure upgrade - no data model changes)  
**Testing**: 
- Backend: Jest with Supertest for e2e
- Frontend: Vitest with React Testing Library

**Target Platform**: Linux (QNAP/ASUSTOR NAS), Docker containers with Alpine Linux  
**Project Type**: Web application (backend + frontend)  
**Performance Goals**: API response times within 5% of v22.20.0 baseline  
**Constraints**: 
- 15-minute maximum rollback time
- Zero-downtime deployment preferred
- Must maintain compatibility with existing pnpm lockfile

**Scale/Scope**: 
- 2 environments (backend + frontend)
- ~50 native dependencies to validate (bcrypt, sharp, sqlite3, etc.)
- CI/CD pipelines in Gitea Actions

## Constitution Check

_เช็คกฎ AGENTS.md ก่อนเริ่ม - Node.js upgrade เป็น infrastructure ไม่มีผลต่อ ADRs หลัก_

| ADR | Applicable | Notes |
|-----|------------|-------|
| ADR-009 (Schema) | ❌ N/A | No database changes |
| ADR-019 (UUID) | ❌ N/A | No identifier changes |
| ADR-016 (Security) | ⚠️ Partial | Verify audit/security libs compile |
| ADR-007 (Errors) | ❌ N/A | No code changes |
| ADR-008 (BullMQ) | ⚠️ Partial | Verify BullMQ native deps on v24 |

**GATE STATUS**: ✅ PASS - Infrastructure upgrade with minimal code impact

## Project Structure

### Documentation (this feature)

```text
specs/100-Infrastructures/103-node-upgrade/
├── plan.md              # This file
├── research.md          # Phase 0: Node.js v24 breaking changes & compatibility
├── data-model.md        # N/A (no data changes)
├── quickstart.md        # Developer upgrade guide
├── contracts/           # N/A (no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── Dockerfile           # UPDATE: node:24.15.0-alpine
├── package.json         # UPDATE: engines.node field
├── .nvmrc              # CREATE/UPDATE: 24.15.0
└── pnpm-lock.yaml      # Regenerate on v24

frontend/
├── Dockerfile           # UPDATE: node:24.15.0-alpine
├── package.json         # UPDATE: engines.node field
├── .nvmrc              # CREATE/UPDATE: 24.15.0
└── pnpm-lock.yaml      # Regenerate on v24

.gitea/workflows/
├── ci-deploy.yml        # UPDATE: node-version: 24.15.0

.gitea/
└── workflows/           # Any additional CI files
```

**Structure Decision**: Infrastructure-focused update touching 2 main directories (backend/, frontend/) plus CI configuration. No new source code directories required.

## Phase 0: Research & Unknown Resolution

### Research Topics

**RT-001: Node.js v24 Breaking Changes**
- Research: Node.js v24 release notes and breaking changes vs v22
- Decision: Use v24.15.0 (LTS) which is stable
- Rationale: LTS ensures stability and long-term support
- Alternatives: v23 (not LTS), stay on v22 (End-of-Life 2026)

**RT-002: Native Module Compatibility**
- Research: Check bcrypt, sharp, sqlite3, argon2 compatibility with Node.js v24
- Decision: Test compilation in staging environment first
- Rationale: Native modules using N-API v8+ are generally compatible
- Alternatives: Use pure-JS alternatives (slower), pin to older versions

**RT-003: pnpm Compatibility**
- Research: pnpm 9.x compatibility with Node.js v24
- Decision: pnpm 9.x fully supports Node.js v18-v24
- Rationale: pnpm maintains compatibility across Node.js LTS versions
- Alternatives: Switch to npm/yarn (unnecessary disruption)

**RT-004: Docker Image Availability**
- Research: `node:24.15.0-alpine` image availability and size
- Decision: Use `node:24.15.0-alpine3.21` (or latest alpine)
- Rationale: Alpine-based images are smaller and standard for production
- Alternatives: `node:24.15.0-slim` (larger), `node:24.15.0` (full, much larger)

### Research Output: research.md

```markdown
# Research: Node.js v24.15.0 Upgrade

## Breaking Changes Assessment

Node.js v24 มี breaking changes หลักๆ ดังนี้:
1. **Permission Model**: Experimental permission model changes (ไม่กระทบ DMS)
2. **Buffer**: `Buffer()` constructor deprecation warnings (check codebase)
3. **Crypto**: Some crypto algorithm deprecations (verify hash usage)
4. **URL**: `url.parse()` further deprecated (เราใช้ new URL() อยู่แล้ว)

## Native Dependencies Status

| Package | Node v24 Support | Notes |
|---------|------------------|-------|
| bcrypt | ✅ v5.1.1+ | Uses N-API v8 |
| sharp | ✅ v0.33.0+ | Prebuilt binaries available |
| sqlite3 | ✅ v5.1.6+ | Uses node-gyp |
| argon2 | ✅ v0.40.0+ | N-API based |

## Docker Image

- `node:24.15.0-alpine3.21` - 190MB (compressed)
- ใช้ Alpine 3.21 (latest stable)
- มี `libc6-compat` สำหรับ native modules

## CI/CD Impact

- Gitea Actions runner รองรับ Node.js v24 ผ่าน `actions/setup-node`
- ไม่ต้องแก้ไข workflow structure มาก
- แค่เปลี่ยน node-version parameter
```

## Phase 1: Design & Contracts

### Data Model

**N/A** - Infrastructure upgrade does not modify data models.

No `data-model.md` required for this feature.

### API Contracts

**N/A** - No API changes.

No `contracts/` directory required for this feature.

### Quickstart Guide

Output: `quickstart.md`

```markdown
# Quick Start: Node.js v24.15.0 Upgrade

## Prerequisites

- Node.js v24.15.0 installed locally (via nvm: `nvm install 24.15.0`)
- pnpm 9.x (`npm i -g pnpm@9`)
- Docker Desktop (for testing container builds)

## Local Development Upgrade

### 1. อัพเดท Node.js เวอร์ชัน

```bash
# ใช้ nvm (recommended)
nvm install 24.15.0
nvm use 24.15.0
node --version  # ตรวจสอบ v24.15.0

# หรือดาวน์โหลดจาก nodejs.org โดยตรง
```

### 2. รีเจนเนอเรท lockfile

```bash
# Backend
cd backend
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Frontend  
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 3. รันเทสต์

```bash
# Backend
cd backend
pnpm test

# Frontend
cd frontend
pnpm test
```

### 4. Build Docker Images

```bash
# Backend
cd backend
docker build -t nap-dms-backend:v24-test .

# Frontend
cd frontend
docker build -t nap-dms-frontend:v24-test .
```

## Rollback Procedure

หากพบปัญหาใน production:

```bash
# 1. Revert Dockerfile กลับไป node:22.20.0-alpine
# 2. Revert package.json engines field
# 3. Revert .nvmrc
# 4. Rebuild และ redeploy

# ใช้ git revert:
git revert HEAD  # ถ้า upgrade เป็น commit ล่าสุด
# หรือ
.git checkout main -- backend/Dockerfile frontend/Dockerfile
```

## Verification Checklist

- [ ] `node --version` แสดง v24.15.0
- [ ] Backend start ได้ไม่มี error
- [ ] Frontend build สำเร็จ
- [ ] 100% tests pass
- [ ] Docker build สำเร็จทั้ง backend และ frontend
```

## Complexity Tracking

**No complexity violations** - This is a straightforward infrastructure upgrade within existing project structure.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| N/A | - | - |

## Implementation Phases

### Phase 1: Preparation
1. Create feature branch `103-node-upgrade`
2. Update `.nvmrc` files (backend/, frontend/)
3. Update `package.json` engines fields
4. Update Dockerfiles base images

### Phase 2: CI/CD Updates
1. Update `.gitea/workflows/ci-deploy.yml` node-version
2. Test CI pipeline on feature branch

### Phase 3: Local Validation
1. Regenerate pnpm-lock.yaml files
2. Run full test suites
3. Verify native dependencies compile

### Phase 4: Staging Deployment
1. Deploy to staging environment
2. Run integration tests
3. Performance baseline comparison

### Phase 5: Production Rollout
1. Schedule maintenance window
2. Deploy with blue-green strategy
3. Monitor for 24 hours
4. Document any issues

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Native deps fail to compile | Medium | High | Test all native deps in staging; keep rollback ready |
| Performance regression | Low | Medium | Benchmark before/after; 5% threshold for rollback |
| CI/CD breakage | Low | Medium | Test CI on feature branch first |
| Developer workstation issues | Medium | Low | Document nvm upgrade steps; provide support |

## Success Validation

- ✅ All tests pass (Jest/Vitest)
- ✅ Docker builds succeed
- ✅ CI/CD pipelines green
- ✅ Staging environment stable 24 hours
- ✅ Performance within 5% baseline
- ✅ Rollback tested and documented
