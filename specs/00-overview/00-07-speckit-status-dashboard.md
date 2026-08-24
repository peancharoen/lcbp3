# Speckit Status Dashboard

**Generated**: 2026-08-24 (updated post-safety-fix)
**Total Features**: 38
**Repo**: `np-dms/lcbp3` @ branch `248-ai-engine-control-center`

## Overview

| # | Feature | Phase | Progress | Val | Blockers | Next Action |
|---|---------|-------|----------|-----|----------|-------------|
| **Infra** | | | | | | |
| 102 | infra-ops | Plan | — | — | 0 | Generate tasks.md |
| 103 | node-upgrade | Implement | 31% | — | 0 | Continue 34 open tasks |
| 134 | ai-model-change | Implement | 0% | — | 0 | Start 25 tasks |
| 140 | ocr-sidecar-refactor | Validate | 96% | PASS | 0 | Close 2 remaining tasks |
| 141 | server-consolidation | Implement | 0% | — | 0 | Start 49 tasks |
| 142 | ocr-prompt-cache-invalidation | Validate | 100% | — | 0 | Run validation |
| 143 | mcp-infra-upgrade | Implement | 0% | — | 0 | Start 42 tasks |
| 144 | rclone-gdrive-sync | Implement | 0% | — | 0 | Start 36 tasks |
| 145 | server-cli-tools | Specify | — | — | 0 | Generate plan.md |
| **Fullstack** | | | | | | |
| 201 | transmittals-circulation | Implement | 43% | — | 0 | Continue 33 open tasks |
| 202 | adr-021-integrated-workflow | Implement | 0% | — | 0 | Task list empty — review |
| 203 | unified-workflow-engine | Implement | 0% | — | 0 | Start 59 tasks |
| 204 | rfa-approval-refactor | Implement | 0% | — | 0 | Start 89 tasks |
| 224 | intent-classification | Validate | 100% | — | 0 | Run validation |
| 225 | ai-tool-layer-architecture | Implement | 0% | — | 0 | Start 8 tasks |
| 226 | document-chat-ui-pattern | Implement | 0% | — | 0 | Start 18 tasks |
| 227 | ai-admin-console | Validate | 12% | PASS | 0 | Continue 44 open tasks |
| 228 | migration-arch-refactor | Validate | 100% | PASS | 0 | Complete |
| 229 | dynamic-prompt-management | Validate | 100% | PASS | 0 | Complete |
| 230 | context-aware-prompt-templates | Validate | 100% | PASS | 0 | Complete |
| 231 | hermes-agent | Implement | 0% | — | 0 | Start 54 tasks |
| 231 | ocr-sandbox-two-step-flow | Specify | — | — | 0 | Generate plan.md |
| 232 | typhoon-ocr-integration | Validate | 96% | PASS | 0 | Close 2 remaining tasks |
| 233 | ai-model-ocr-runner-mgmt | Validate | 100% | PASS | 0 | Complete |
| 234 | rag-pipeline-enhancements | Validate | 0% | PASS | 0 | Start 37 tasks |
| 235 | ai-runtime-policy-refactor | Validate | 100% | PASS | 0 | Complete |
| 236 | unified-ocr-architecture | Implement | 0% | — | 0 | Start 82 tasks |
| 237 | unified-prompt-mgmt-ux-ui | Validate | 97% | PARTIAL | 3 | Fix 3 gaps before sign-off |
| 238 | ocr-ai-prompt-separation | Validate | 82% | PARTIAL | 0 | Continue 12 open tasks |
| 239 | ai-console-ux-refactor | Validate | 0% | PASS | 0 | Start 20 tasks |
| 240 | ai-console-collapsible-cards | Validate | 0% | PASS | 0 | Start 12 tasks |
| 241 | ocr-persist-sandbox | Implement | 0% | — | 0 | Start 27 tasks |
| 242 | migration-ai-pipeline | Implement | 0% | — | 0 | Start 67 tasks |
| 243 | tag-color-palette | Implement | 96% | — | 0 | Close 1 remaining task |
| 244 | native-backend-legacy-ingestion | Validate | 94% | PASS | 0 | Close 1 remaining task |
| **248** | **ai-engine-control-center** | **Validate** | **100%** | **PASS** | **0** | **Complete — 3 minor non-blocking items remain** |
| **Others** | | | | | | |
| 301 | unified-ai-arch | Implement | 0% | — | 0 | Start 32 tasks |
| 302 | ai-model-revision | Implement | 0% | — | 0 | Start 53 tasks |
| 303 | frontend-test-coverage | Validate | 100% | — | 0 | Run validation |

## Feature Details — Active/Recent

### 248-ai-engine-control-center (CURRENT)

```
Spec:  ██████████ 100%
Plan:  ██████████ 100%
Tasks: ██████████ 100% (21/21)
Val:   ██████████ PASS
```

**Status**: All 21 tasks done + 21 Gitea issues closed. Three rounds of fixes applied:
1. **Code review fixes** (9 bugs: 1 HIGH, 5 MEDIUM, 3 LOW) — all fixed with regression tests
2. **Safety gap fixes** (FR-007/008/009) — all 3 production safety requirements now Met
3. **FR-005 + ESLint fixes** — canonical model catalog with residency status + 18 backend ESLint errors resolved

**All 15 functional requirements now Met.** Validation status: **PASS**.

**Remaining non-blocking items** (UI enhancements / performance demos):
- US1-AC1: Per-core CPU percentages not shown (UI enhancement)
- US1-AC4: No estimated metrics during cold start (edge case)
- SC-001/SC-004/SC-005: Performance criteria not demonstrated (require runtime benchmarking)

**Recent Activity**:
- 25 files changed, +2500/-1300 lines (uncommitted)
- 23 new regression tests added (1083 total passing, was 1064)
- Backend build ✅ | Backend tests 1083 ✅ | Backend lint ✅ | Frontend build ✅ | Frontend lint ✅

---

### 237-unified-prompt-management-ux-ui

```
Spec:  ██████████ 100%
Plan:  ██████████ 100%
Tasks: █████████░ 97% (78/80)
Val:   █████████░ PARTIAL (3 gaps)
```

**Blockers**: 3 gaps require action before sign-off

**Next Action**: Resolve 3 validation gaps + close 2 remaining tasks

---

### 238-ocr-ai-prompt-separation

```
Spec:  ██████████ 100%
Plan:  ██████████ 100%
Tasks: ████████░░ 82% (56/68)
Val:   █████████░ PARTIAL
```

**Next Action**: Continue 12 open tasks

---

### 140-ocr-sidecar-refactor

```
Spec:  ██████████ 100%
Plan:  ██████████ 100%
Tasks: █████████░ 96% (63/65)
Val:   ██████████ PASS
```

**Next Action**: Close 2 remaining tasks for 100%

---

### 232-typhoon-ocr-integration

```
Spec:  ██████████ 100%
Plan:  ██████████ 100%
Tasks: █████████░ 96% (61/63)
Val:   ██████████ PASS
```

**Next Action**: Close 2 remaining tasks for 100%

---

### 244-native-backend-legacy-ingestion

```
Spec:  ██████████ 100%
Plan:  ██████████ 100%
Tasks: █████████░ 94% (17/18)
Val:   ██████████ PASS
```

**Next Action**: Close 1 remaining task for 100%

---

### 243-tag-color-palette

```
Spec:  ██████████ 100%
Plan:  ██████████ 100%
Tasks: █████████░ 96% (32/33)
Val:   —
```

**Next Action**: Close 1 task, then run validation

---

### 227-ai-admin-console

```
Spec:  ██████████ 100%
Plan:  ██████████ 100%
Tasks: ████░░░░░░ 12% (6/50)
Val:   ██████████ PASS
```

**Next Action**: Continue 44 open tasks

---

## Summary

| Metric | Count |
|--------|-------|
| Total features | 38 |
| Complete (100% tasks + PASS val) | **8** |
| Near-complete (>90% tasks) | **6** |
| In progress (1-90%) | **4** |
| Not started (0% tasks) | **19** |
| Plan only (no tasks) | **1** |
| Spec only (no plan) | **2** |
| Blocked (clarifications) | **0** |
| Validation FAIL | **0** |
| Validation PARTIAL | **2** (237, 238) |

### Phase Distribution

```
Specify:  ██░░░░░░░░  2 features (145, 231-ocr-sandbox)
Plan:     █░░░░░░░░░  1 feature  (102-infra-ops)
Implement:████████░░ 15 features (0% progress, awaiting start)
Validate: ██████████ 20 features (in validation or complete)
```

### Overall Project Completion

```
Tasks completed: 653 / 1458 = 45%
Features at 100%:  8 / 38  = 21%
Features PASS:    12 / 15 validated = 80%
```

### Priority Actions

1. **248-ai-engine-control-center**: ✅ **COMPLETE** — all 15 FRs Met, validation PASS. 3 minor non-blocking items remain (per-core CPU UI, cold-start estimates, performance demos)
2. **237-unified-prompt-mgmt-ux-ui**: Resolve 3 validation gaps for sign-off
3. **140, 232, 244, 243**: Close 1-2 remaining tasks each to reach 100%
4. **227-ai-admin-console**: 44 open tasks — largest active backlog
5. **19 features at 0%**: Need implementation start — prioritize by milestone dependency
