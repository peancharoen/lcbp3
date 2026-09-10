# Test Report

**Date**: 2026-09-10 (updated)
**Feature**: 254-rag-attachment-chunks
**Branch**: `main` (merged, commit `dd880227`)
**Frameworks**: Jest 30 (backend) + Vitest 4.1.11 (frontend)
**Status**: PASS

## Summary

| Metric | Backend | Frontend | RAG E2E | Total |
|--------|---------|----------|---------|-------|
| Total Tests | 2881 | 1056 | 45 | 3982 |
| Passed | 2864 | 1056 | 45 | 3965 |
| Failed | 0 | 0 | 0 | 0 |
| Skipped | 17 | 0 | 0 | 17 |
| Duration | 8.7s | 26.3s | 2.6s | ~37s |
| Suites | 198 (195 passed, 3 skipped) | 574 | 7 | — |

## Coverage Improvement — Feature 254 Core Files

| File | Stmts (before) | Stmts (after) | Branch (before) | Branch (after) | Funcs (before) | Funcs (after) |
|------|---------------|---------------|-----------------|----------------|----------------|---------------|
| `rag-attachment-ingest.processor.ts` | 17.9% | **100.0%** | 0% | **60.5%** | 0% | **100.0%** |
| `rag-generation-lock.service.ts` | 46.8% | **100.0%** | 0% | **66.7%** | 0% | **100.0%** |
| `rag-attachment-ingestion.service.ts` | 54.6% | **98.8%** | 50.0% | **76.2%** | 37.5% | **100.0%** |
| `rag-generation.service.ts` | 52.8% | **97.7%** | 44.4% | **77.1%** | 57.1% | **100.0%** |
| `rag-attachment.controller.ts` | 100.0% | **100.0%** | 44.8% | **60.0%** | 100.0% | **100.0%** |

### Summary
- **Statement coverage**: All 5 target files now ≥97.7% (was ≥17.9%)
- **Function coverage**: All 5 target files now 100% (was ≥0%)
- **Branch coverage**: Improved from 0-50% to 60-77% across all files

## New Test Files Created

| File | Tests | Coverage Target |
|------|-------|-----------------|
| `rag-generation-lock.service.spec.ts` | 3 | Lock acquire/fail/key format |
| `rag-attachment-ingest.processor.spec.ts` | 10 | Full pipeline + all error paths |

## Existing Specs Expanded

| File | Tests (before) | Tests (after) | New coverage |
|------|----------------|---------------|--------------|
| `rag-attachment-ingestion.service.spec.ts` | 5 | 20 | markVerified, activate, markFailed, getStatus, isValidChecksum, force path |
| `rag-generation.service.spec.ts` | 4 | 18 | activate, markFailed, getStatus, overrideClassification, error paths |
| `rag-attachment.controller.spec.ts` | 4 | 13 | query endpoint, force=true, classificationService path, empty Idempotency-Key |

## RAG E2E Breakdown

| Suite | Tests | Status |
|-------|-------|--------|
| `rag-attachment-api` | 6 | ✅ PASS |
| `rag-attachment-ingestion` | 6 | ✅ PASS |
| `rag-attachment-schema` | 5 | ✅ PASS (fixed: DB entity registration) |
| `rag-classification` | 8 | ✅ PASS |
| `rag-cross-project` | 6 | ✅ PASS |
| `rag-generation-replacement` | 6 | ✅ PASS |
| `rag-zip-ingestion` | 8 | ✅ PASS |

## Fixes Applied

### E2E Schema Test Fix
- **File**: `backend/test/rag-attachment-schema.e2e-spec.ts`
- **Issue**: `autoLoadEntities: true` didn't load all entities needed for `Attachment` relations (`WorkflowHistory`, `User`)
- **Fix**: Changed to `entities: [__dirname + '/../src/**/*.entity{.ts,.js}']` glob pattern (matches production config)
- **Result**: 5/5 schema tests now pass with MariaDB at `192.168.10.11:3306`

## Verification Commands

```bash
# Backend unit tests
cd backend && npx jest --config jest.config.js --forceExit
# Result: 2864 passed, 0 failed, 17 skipped

# RAG E2E tests (requires MariaDB)
DB_HOST=192.168.10.11 DB_USERNAME=center DB_PASSWORD=... DB_DATABASE=lcbp3 \
  npx jest --config ./test/jest-e2e.json --testPathPatterns="rag-" --forceExit
# Result: 45 passed, 0 failed

# Frontend tests
cd frontend && npx vitest run
# Result: 1056 passed, 0 failed

# ESLint
cd backend && npx eslint src/modules/ai/**/*.spec.ts
# Result: 0 errors
```
