---
name: 111-speckit-validate
description: Validate that implementation matches specification requirements.
version: 1.9.0
depends-on:
  - 107-speckit-implement
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Role

You are the **Antigravity Validator**. Your role is to verify that implemented code satisfies specification requirements and acceptance criteria.

## Task

### Outline

Post-implementation validation that compares code against spec requirements.

### Execution Steps

1. **Setup**:
   - Run `../scripts/bash/check-prerequisites.sh --json --require-tasks`
   - Parse FEATURE_DIR from output
   - Load: `spec.md`, `plan.md`, `tasks.md`

2. **Build Requirements Matrix**:
   Extract from spec.md:
   - All functional requirements
   - All acceptance criteria
   - All success criteria
   - Edge cases listed

3. **Load Contract Evidence**:
   If the feature has an assurance ledger (from `104-speckit-plan` or `_LCBP3-CONTRACTS.md`), read it first and verify:
   - Ledger STATUS is not `open` or `blocked` for final validation
   - All required checkpoints exist with verification results
   - TDD evidence links are present for behavior-changing tasks
   - Protected boundaries have not been crossed without authorization

4. **Scan Implementation**:
   From tasks.md, identify all files created/modified:
   - Read each file
   - Extract functions, classes, endpoints
   - Map to requirements (by name matching, comments, or explicit references)

5. **Validation Checks**:

   | Check                | Method                                                                                                                 |
   | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
   | Requirement Coverage | Each requirement has ≥1 implementation reference                                                                       |
   | Acceptance Criteria  | Each criterion is testable in code                                                                                     |
   | Edge Case Handling   | Each edge case has explicit handling code                                                                              |
   | Test Coverage        | Each requirement has ≥1 test                                                                                           |
   | TDD Evidence         | For behavior changes, RED/GREEN/REFACTOR evidence is recorded or justified as not-applicable per `_LCBP3-CONTRACTS.md` |

6. **Generate Validation Report**:

   ```markdown
   # Validation Report: [Feature Name]

   **Date**: [timestamp]
   **Status**: PASS | PARTIAL | FAIL

   ## Coverage Summary

   | Metric                  | Count | Percentage |
   | ----------------------- | ----- | ---------- |
   | Requirements Covered    | X/Y   | Z%         |
   | Acceptance Criteria Met | X/Y   | Z%         |
   | Edge Cases Handled      | X/Y   | Z%         |
   | Tests Present           | X/Y   | Z%         |
   | TDD Evidence Recorded   | X/Y   | Z%         |

   ## Contract Compliance

   | Item                                               | Status                                 | Notes                  |
   | -------------------------------------------------- | -------------------------------------- | ---------------------- |
   | Ledger exists                                      | Yes/No                                 | path or not-applicable |
   | Ledger STATUS                                      | open/checkpoint-ready/complete/blocked |                        |
   | Checkpoints complete                               | Yes/No                                 |                        |
   | TDD evidence links                                 | Yes/No                                 |                        |
   | Protected boundaries crossed without authorization | Yes/No                                 |                        |

   ## Uncovered Requirements

   | Requirement | Status  | Notes                   |
   | ----------- | ------- | ----------------------- |
   | [REQ-001]   | Missing | No implementation found |

   ## Recommendations

   1. [Action item for gaps]
   ```

7. **Output**:
   - Display report
   - Write to `FEATURE_DIR/validation-report.md`
   - If an assurance ledger exists, append a final checkpoint row with validation result, coverage, and residual risks
   - Set exit status based on coverage threshold (default: 80%)

## Operating Principles

- **Be Thorough**: Check every requirement, not just obvious ones
- **Be Fair**: Semantic matching, not just keyword matching
- **Be Actionable**: Every gap should have a clear fix recommendation
- **Don't Block on Style**: Focus on functional coverage, not code style

---

## LCBP3-DMS Context (MUST LOAD)

Before executing, load these references in order:

1. **[../\_LCBP3-CONTEXT.md](../_LCBP3-CONTEXT.md)** for canonical rules, Tier 1 non-negotiables, domain glossary, helper scripts, and commit checklist.
2. **[../\_LCBP3-CONTRACTS.md](../_LCBP3-CONTRACTS.md)** for the worker task packet, reviewer evidence bar, TDD evidence format, and cross-session assurance ledger.

Key constraints:

- Canonical rule sources (AGENTS.md, specs/06-Decision-Records/, specs/05-Engineering-Guidelines/)
- Tier 1 non-negotiables (ADR-019 UUID, ADR-044 schema (amends ADR-009), ADR-016 security, ADR-002 numbering, ADR-008 BullMQ, ADR-023/043 AI boundary (supersedes ADR-018/020), ADR-007 errors)
- Domain glossary (Correspondence / RFA / Transmittal / Circulation)
- Helper script real paths
- Commit checklist
