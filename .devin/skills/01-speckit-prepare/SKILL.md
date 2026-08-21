---
name: 01-speckit-prepare
description: Execute the full preparation pipeline (Specify → Clarify → Plan → Tasks → Analyze) in sequence.
version: 1.9.0
scope: feature
depends-on:
  - 102-speckit-specify
  - 103-speckit-clarify
  - 104-speckit-plan
  - 105-speckit-tasks
  - 106-speckit-analyze
handoffs:
  - 107-speckit-implement
---

# 01-speckit-prepare — Preparation Pipeline

> 📌 See [`_LCBP3-CONTEXT.md`](../_LCBP3-CONTEXT.md) for LCBP3-specific conventions applied to all speckit skills.

This skill orchestrates the sequential execution of the Speckit preparation phase (steps 1-5). For the full lifecycle (steps 1-10), use `/00-speckit-all` instead.

## Steps

1. **Step 1: Specify**
   - Goal: Create or update the `spec.md` based on user input.
   - Invoke the `102-speckit-specify` skill.

2. **Step 2: Clarify**
   - Goal: Refine the `spec.md` by identifying and resolving ambiguities.
   - Invoke the `103-speckit-clarify` skill.

3. **Step 3: Plan**
   - Goal: Generate `plan.md` from the finalized spec.
   - Invoke the `104-speckit-plan` skill.

4. **Step 4: Tasks**
   - Goal: Generate actionable `tasks.md` from the plan.
   - Invoke the `105-speckit-tasks` skill.

5. **Step 5: Analyze**
   - Goal: Validate consistency across all design artifacts (spec, plan, tasks).
   - Invoke the `106-speckit-analyze` skill.
   - **Gate**: If critical issues are found, stop and fix before proceeding.

## Usage

```
/01-speckit-prepare "Build a user authentication system with OAuth2 support"
```

## Pipeline Comparison

| Pipeline             | Steps                     | Use When                                |
| -------------------- | ------------------------- | --------------------------------------- |
| `/01-speckit-prepare` | 1-5 (Specify → Analyze)   | Planning only — you'll implement later  |
| `/00-speckit-all`     | 1-10 (Specify → Validate) | Full lifecycle in one pass              |

## On Error

If any step fails, stop the pipeline and report:

- Which step failed
- The error message
- Suggested remediation (e.g., "Run `/103-speckit-clarify` to resolve ambiguities before continuing")
