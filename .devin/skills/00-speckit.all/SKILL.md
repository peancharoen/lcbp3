---
name: 00-speckit.all
description: Run the full speckit pipeline from specification to validation in one command.
version: 1.9.0
scope: feature
depends-on:
  - 102-speckit.specify
  - 103-speckit.clarify
  - 104-speckit.plan
  - 105-speckit.tasks
  - 106-speckit.analyze
  - 107-speckit.implement
  - 108-speckit.checker
  - 109-speckit.tester
  - 110-speckit.reviewer
  - 111-speckit.validate
handoffs: []
---

# 00-speckit.all — Full Lifecycle Pipeline

> 📌 See [`_LCBP3-CONTEXT.md`](../_LCBP3-CONTEXT.md) for LCBP3-specific conventions applied to all speckit skills.

This skill orchestrates the **complete development lifecycle**, from specification through implementation and validation. For the preparation-only pipeline (steps 1-5), use `/01-speckit.prepare` instead.

## Preparation Phase (Steps 1-5)

1. **Specify** (`/102-speckit.specify`):
   - Invoke the `102-speckit.specify` skill with the user's feature description.
   - Creates: `spec.md`

2. **Clarify** (`/103-speckit.clarify`):
   - Invoke the `103-speckit.clarify` skill to resolve ambiguities.
   - Updates: `spec.md`

3. **Plan** (`/104-speckit.plan`):
   - Invoke the `104-speckit.plan` skill to create the technical design.
   - Creates: `plan.md`

4. **Tasks** (`/105-speckit.tasks`):
   - Invoke the `105-speckit.tasks` skill to generate the task breakdown.
   - Creates: `tasks.md`

5. **Analyze** (`/106-speckit.analyze`):
   - Invoke the `106-speckit.analyze` skill to validate consistency across spec, plan, and tasks.
   - Output: Analysis report
   - **Gate**: If critical issues are found, stop and fix before proceeding.

## Implementation Phase (Steps 6-7)

6. **Implement** (`/107-speckit.implement`):
   - Invoke the `107-speckit.implement` skill to execute all tasks from `tasks.md` with anti-regression protocols.
   - Output: Working implementation

7. **Check** (`/108-speckit.checker`):
   - Invoke the `108-speckit.checker` skill to run static analysis (linters, type checkers, security scanners).
   - Output: Checker report

## Verification Phase (Steps 8-10)

8. **Test** (`/109-speckit.tester`):
   - Invoke the `109-speckit.tester` skill to run tests with coverage.
   - Output: Test + coverage report

9. **Review** (`/110-speckit.reviewer`):
   - Invoke the `110-speckit.reviewer` skill to perform code review.
   - Output: Review report with findings

10. **Validate** (`/111-speckit.validate`):
    - Invoke the `111-speckit.validate` skill to verify implementation matches spec requirements.
    - Output: Validation report (pass/fail)

## Usage

```
/00-speckit.all "Build a user authentication system with OAuth2 support"
```

## Pipeline Comparison

| Pipeline             | Steps                     | Use When                                |
| -------------------- | ------------------------- | --------------------------------------- |
| `/01-speckit.prepare` | 1-5 (Specify → Analyze)   | Planning only — you'll implement later  |
| `/00-speckit.all`     | 1-10 (Specify → Validate) | Full lifecycle in one pass              |

## On Error

If any step fails, stop the pipeline and report:

- Which step failed
- The error message
- Suggested remediation (e.g., "Run `/103-speckit.clarify` to resolve ambiguities before continuing")
