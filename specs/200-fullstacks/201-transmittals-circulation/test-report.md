# Test Report

**Date**: 2026-05-03
**Framework**: Jest
**Status**: PASS (Thresholds partially unmet)

## Summary

| Metric      | Value |
| ----------- | ----- |
| Total Tests | 340   |
| Passed      | 340   |
| Failed      | 0     |
| Skipped     | 0     |
| Duration    | 40.7s |
| Coverage    | Varies (some thresholds unmet) |

## Failed Tests

No tests failed. All 340 tests passed successfully.

However, the test suite exited with code `1` because some files did not meet the configured coverage thresholds (e.g., `virtual-column.service.ts`, `metrics.service.ts`, `maintenance-mode.guard.ts`).

## Coverage by File (Notable Exceptions)

| File | Lines | Branches | Functions |
| ----------- | ----- | -------- | --------- |
| `src/modules/json-schema/services/virtual-column.service.ts` | 22.97% | < 80% | 0% |
| `src/modules/monitoring/services/metrics.service.ts` | 68.75% | 0% | 0% |
| `src/common/guards/maintenance-mode.guard.ts` | 0% | 0% | 0% |
| `src/common/interceptors/idempotency.interceptor.ts` | >90% | 88.23% | >90% |
| `src/common/interceptors/performance.interceptor.ts` | >90% | 88.88% | >90% |

## Next Actions

1. The test coverage for recently modified files (`correspondence.service.ts`, `circulation.service.ts`, `circulation.controller.ts`) is passing the tests correctly, but the overall project thresholds are still failing in some unrelated utility modules.
2. Consider increasing coverage in `virtual-column.service.ts` and `metrics.service.ts` to satisfy global coverage thresholds.
