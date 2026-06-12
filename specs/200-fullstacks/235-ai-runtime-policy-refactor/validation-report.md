// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/validation-report.md
// Change Log:
// - 2026-06-11: Initial validation report for feature 235

# Validation Report: AI Runtime Policy Refactor

**Date**: 2026-06-11
**Feature**: `235-ai-runtime-policy-refactor`
**Status**: PARTIAL

## Coverage Summary

| Metric | Count | Percentage |
| --- | ---: | ---: |
| Requirements Covered | 22/25 | 88% |
| Acceptance Criteria Met | 14/19 | 74% |
| Edge Cases Handled | 6/7 | 86% |
| Tests Present | 18/25 | 72% |

## What Was Validated

- Workstream A evidence found in backend DTO/service/response contract and tests:
  [create-ai-job.dto.ts](./backend/src/modules/ai/dto/create-ai-job.dto.ts),
  [ai-job-response.dto.ts](./backend/src/modules/ai/dto/ai-job-response.dto.ts),
  [ai.service.ts](./backend/src/modules/ai/ai.service.ts),
  [ai.controller.spec.ts](./backend/src/modules/ai/tests/ai.controller.spec.ts),
  [ai-policy.service.spec.ts](./backend/src/modules/ai/tests/ai-policy.service.spec.ts),
  [ai.service.spec.ts](./backend/src/modules/ai/ai.service.spec.ts)
- Workstream B evidence found in:
  [ocr.service.ts](./backend/src/modules/ai/services/ocr.service.ts),
  [vram-monitor.service.ts](./backend/src/modules/ai/services/vram-monitor.service.ts),
  [ocr-residency.spec.ts](./backend/src/modules/ai/tests/ocr-residency.spec.ts),
  [vram-monitor.service.spec.ts](./backend/src/modules/ai/tests/vram-monitor.service.spec.ts),
  [residency_policy.py](./specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/residency_policy.py)
- Workstream C evidence found in:
  [app.py](./specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py),
  [ai-batch.processor.ts](./backend/src/modules/ai/processors/ai-batch.processor.ts),
  [test_retrieval_fallback.py](./specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/tests/test_retrieval_fallback.py)
- Workstream D evidence found in:
  [bullmq.config.ts](./backend/src/config/bullmq.config.ts),
  [ai-realtime.processor.ts](./backend/src/modules/ai/processors/ai-realtime.processor.ts),
  [queue-policy.spec.ts](./backend/src/modules/ai/tests/queue-policy.spec.ts)
- User-facing canonical naming evidence found in:
  [page.tsx](./frontend/app/(admin)/admin/ai/page.tsx),
  [OcrSandboxPromptManager.tsx](./frontend/components/admin/ai/OcrSandboxPromptManager.tsx),
  [admin-ai.service.ts](./frontend/lib/services/admin-ai.service.ts)

## Requirement Matrix

| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| FR-A01 | Covered | DTO forbidden fields + controller integration tests | HTTP 400 path implemented |
| FR-A02 | Partial | DTO still accepts `payload` and `projectPublicId` | Spec text conflicts with rag-query/query + tenant isolation contract |
| FR-A03 | Covered | `AiPolicyService.getProfileForJobType()` + `AiService.submitUnifiedJob()` | Backend assigns profile from job type |
| FR-A04 | Covered | Admin Console + OCR Sandbox UI | Visibility exists in UI; enforcement is by contract removal, not separate guard |
| FR-A05 | Covered | `AiPolicyService.createJobPayload()` | Mapping includes profile, canonical model, snapshot params |
| FR-A06 | Covered | deterministic switch in `getProfileForJobType()` | No unmapped internal job type found |
| FR-A07 | Covered | backend DTOs, frontend normalization, sandbox badge mapping | Canonical labels present across layers inspected |
| FR-A08 | Covered | worker audit writes `effectiveProfile`, `canonicalModel`, `snapshotParamsJson` | enqueue-time false success log removed |
| FR-A09 | Covered | `createJobPayload()` snapshot + worker uses payload snapshot | Predictable per-dispatch parameters |
| FR-B01 | Covered | `AiPolicyService` default policy map + DB/cache lookup | Runtime policy layer exists |
| FR-B02 | Covered | `OcrService.calculateOcrResidency()` | Dynamic keep_alive decision implemented |
| FR-B03 | Covered | deep-analysis/high-pressure branches + residency tests | Safe OCR unload path exists |
| FR-B04 | Covered | residency window branch + tests | Positive keep_alive path exists |
| FR-B05 | Covered | VRAM query failure fallback + tests | Safe default `keep_alive=0` exists |
| FR-B06 | Covered | `OcrService` logs decision context | Log behavior implemented, not live-verified |
| FR-C01 | Covered | `/embed` headroom check + CPU fallback | Sidecar code present |
| FR-C02 | Covered | `/rerank` headroom check + CPU fallback | Sidecar code present |
| FR-C03 | Covered | `/embed` + `/rerank` timeout -> HTTP 504 | No partial result path found |
| FR-C04 | Covered | device/reason logging in sidecar | Log behavior implemented |
| FR-C05 | Partial | `rag-query` backend path exists | No executed integration/manual proof that fallback path completes end-to-end |
| FR-C06 | Covered | env threshold usage + safe default in VRAM query failure | Configurable threshold present |
| FR-D01 | Partial | config default=2 + processor logic + unit tests | No live worker concurrency proof beyond unit tests |
| FR-D02 | Covered | lightweight job classification list | Matches spec set |
| FR-D03 | Covered | `AiService.submitUnifiedJob()` + realtime redirect tests | `rag-query` stays in `ai-batch` |
| FR-D04 | Covered | active-job counter + queue policy tests | Resume now waits for all realtime jobs |

## Acceptance Criteria Gaps

| Scenario | Status | Notes |
| --- | --- | --- |
| US1-3 Admin Console shows canonical names only | Partial | Code supports it, but no manual browser validation recorded |
| US1-5 OCR Sandbox reveals effective profile/modelUsed | Partial | UI/service evidence exists, but no executed sandbox validation record |
| US2-4 OCR logs residency decision with headroom | Partial | Logging code exists; no captured runtime log artifact |
| US3-4 RAG still answers under CPU fallback | Partial | Code path exists; no completed end-to-end run |
| US5-1 executable cutover gate | Partial | backend targeted tests passed, but sidecar pytest was not executed in this validation pass |
| US5-2 Admin Console labels manual check | Missing | T032 still unchecked |
| US5-3 OCR Sandbox behavior across headroom scenarios | Missing | T032 still unchecked |

## Edge Case Review

| Edge Case | Status | Notes |
| --- | --- | --- |
| VRAM query failure -> `keep_alive: 0` | Handled | explicit safe default in backend + sidecar |
| caller sends forbidden profile/model fields | Handled | DTO/controller tests cover this |
| admin-only large-context when VRAM insufficient | Partial | spec branch is stale after contract removal; no current caller path exists |
| OCR job races with main model generation | Handled | high-pressure/deep-analysis path forces unload |
| CPU fallback timeout must fail clearly | Handled | 504 implemented |
| Ollama `/api/ps` schema drift after cutover | Handled | safe default `available=0` path exists |
| headroom snapshot/request race acceptable | Handled | implementation follows spec assumption; no stronger synchronization introduced |

## Success Criteria Notes

| Success Criterion | Status | Notes |
| --- | --- | --- |
| SC-001 | Likely Met | automated rejection tests exist |
| SC-002 | Partial | code normalization exists; no full manual surface sweep attached |
| SC-003 | Not Validated | no latency measurement artifact |
| SC-004 | Partial | fallback code exists; no executed end-to-end proof |
| SC-005 | Partial | backend tests executed, sidecar pytest/manual cutover not completed |
| SC-006 | Partial | concurrency config + unit tests exist, no throughput measurement |

## Key Findings

1. Implementation is broadly aligned with the runtime-policy refactor design, especially on policy mapping, canonical naming, adaptive OCR residency, retrieval CPU fallback, and queue pause/resume correctness.
2. Validation cannot be promoted to `PASS` yet because the feature still lacks the manual Gate 1–4 evidence from [quickstart.md](./quickstart.md) and this pass did not execute the Python sidecar pytest suite.
3. The spec artifact set contains one material inconsistency: FR-A02 says `CreateAiJobDto` should only expose `type`, `documentPublicId`, and `attachmentPublicId`, but the same spec and implemented contract require `payload.query` and `projectPublicId` for `rag-query`. The code follows the richer contract, not the literal FR-A02 text.
4. [quickstart.md](./quickstart.md) is stale against the implemented Option B contract in at least Gate 1C, 1D, and 4A because it still sends `executionProfile` / `large-context` style caller input that the new DTO now forbids.

## Recommendations

1. Complete T032 by running the manual Gate 1–4 flow on a real backend + OCR sidecar environment and append the captured results to this feature folder.
2. Run `pytest specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/tests -v` once the sidecar environment is ready, then update this report with the result.
3. Reconcile FR-A02 and `quickstart.md` with the actual Option B contract so the validation target and operator guide no longer contradict the implementation.
4. Add one end-to-end proof for FR-C05/SC-004: force GPU pressure, submit `rag-query`, and capture both successful response and sidecar `device=cpu` log.
5. Add one concurrency-focused execution proof for FR-D01/SC-006 if the team wants `PASS` to include runtime throughput evidence rather than unit-level proof only.
