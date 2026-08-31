# Test Report

**Date**: 2026-08-31  
**Feature**: 250-ai-metadata-extraction-contract  
**Frameworks**: Jest (backend) / Vitest (frontend)  
**Status**: **FAIL** — all tests passed, but backend coverage thresholds were not met

## Summary

### Backend (Jest)

| Metric      | Value |
| ----------- | ----- |
| Test Suites | 154 / 156 passed (2 skipped) |
| Tests       | 2252 / 2263 passed (11 skipped) |
| Failed      | 0 |
| Duration    | 29.89 s |
| Statements  | ≥ 70% (threshold 70%, no failure reported) |
| Lines       | ≥ 70% (threshold 70%, no failure reported) |
| Branches    | 61.63% (threshold 70%, FAIL) |
| Functions   | 58.33% (threshold 70%, FAIL) |

### Frontend (Vitest)

| Metric      | Value |
| ----------- | ----- |
| Test Files  | 143 passed (143) |
| Tests       | 996 passed (996) |
| Failed      | 0 |
| Duration    | 25.88 s |
| Statements  | 54.95% |
| Lines       | 55.48% |
| Branches    | 43.95% |
| Functions   | 54.45% |

## Failed Tests

No test failures in either suite. The backend suite exited with exit code 1 solely because configured Jest `coverageThreshold` for branches and functions were not satisfied.

## Backend Coverage Threshold Failures

| File | Statements | Branches | Functions | Lines |
| ---- | ---------- | -------- | --------- | ----- |
| `src/modules/ai/services/ocr.service.ts` | 60.52% | 30.00% | 35.71% | 60.52% |
| `src/modules/ai/services/ai-policy.service.ts` | — | 73.03% | — | — |
| `src/modules/ai/services/node-metrics.service.ts` | — | 67.18% | — | — |
| `src/modules/ai/services/sandbox-ocr-engine.service.ts` | — | 77.77% | — | — |
| `src/modules/ai/services/vram-monitor.service.ts` | — | 76.36% | — | — |
| `src/modules/document-numbering/services/document-numbering.service.ts` | — | 74.56% | — | — |
| `src/modules/document-numbering/services/manual-override.service.ts` | — | 66.66% | — | — |
| `src/modules/migration/services/legacy-ingestion.service.ts` | — | 75.18% | — | — |
| `src/modules/monitoring/services/bullmq-metrics.service.ts` | — | 47.82% | — | — |
| `src/modules/reminder/services/escalation.service.ts` | — | 78.37% | — | — |
| `src/modules/response-code/services/notification-trigger.service.ts` | — | 75.00% | — | — |
| `src/modules/review-team/services/consensus.service.ts` | — | 77.77% | — | — |
| `src/modules/review-team/services/task-creation.service.ts` | — | 78.57% | — | — |

Jest also reported: `Coverage data for ./src/modules/*/services/*.spec.ts was not found` (the spec file threshold pattern has no matching coverage data).

## Frontend Low-Coverage Areas

Selected directories with the lowest line coverage from the Vitest run:

| Directory / File | Statements | Branches | Functions | Lines |
| ---------------- | ---------- | -------- | --------- | ----- |
| `components/reminder` | 0.00% | 0.00% | 0.00% | 0.00% |
| `components/review-task` | 0.00% | 0.00% | 0.00% | 0.00% |
| `components/review-team` | 0.00% | 0.00% | 0.00% | 0.00% |
| `components/rfa` | 0.00% | 0.00% | 0.00% | 0.00% |
| `hooks/use-migration-review.ts` | 0.00% | 0.00% | 0.00% | 0.00% |
| `hooks/use-reference-data.ts` | 0.00% | 0.00% | 0.00% | 0.00% |
| `hooks/use-search.ts` | 0.00% | 0.00% | 0.00% | 0.00% |
| `lib/auth.ts` | 22.09% | 24.56% | 30.00% | 21.68% |
| `lib/services/document...ai.service.ts` | 19.71% | 43.85% | 11.76% | 19.28% |
| `components/response-code` | 26.41% | 17.33% | 20.83% | 26.53% |

## Commands Executed

```bash
# Backend (Jest with coverage)
pnpm --filter backend test:cov

# Frontend (Vitest with coverage)
pnpm --filter lcbp3-frontend test:coverage
```

## Next Actions

1. Raise backend branch coverage in `ocr.service.ts` (currently 30%) and `bullmq-metrics.service.ts` (47.82%) by adding unit tests for conditional branches and error paths.
2. Raise backend function coverage in `ocr.service.ts` (currently 35.71%) by covering unused public methods and helper functions.
3. Add backend tests for the remaining branch-threshold services (`ai-policy`, `manual-override`, `legacy-ingestion`, `notification-trigger`, `consensus`, `task-creation`, `escalation`, `node-metrics`, `vram-monitor`, `sandbox-ocr-engine`, `document-numbering`) to reach the 80% service branch threshold.
4. Investigate the 2 skipped backend test suites and 11 skipped tests to determine if they should be enabled or removed.
5. Add frontend tests for the completely uncovered component groups (`reminder`, `review-task`, `review-team`, `rfa`) and low-coverage hooks/services (`use-search`, `use-reference-data`, `use-migration-review`, `lib/auth.ts`, `document...ai.service.ts`).
