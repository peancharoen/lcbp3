---
auto_execution_mode: 0
description: Run the full speckit pipeline from specification to analysis in one command.
---

# Workflow: speckit.all

This meta-workflow orchestrates the **complete development lifecycle**, from specification through implementation and validation. For the preparation-only pipeline (steps 1-5), use `/speckit.prepare` instead.

## Preparation Phase (Steps 1-5)

1. **Specify** (`/speckit.specify`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.specify/SKILL.md`
   - Execute with user's feature description
   - Creates: `spec.md`

2. **Clarify** (`/speckit.clarify`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.clarify/SKILL.md`
   - Execute to resolve ambiguities
   - Updates: `spec.md`

3. **Plan** (`/speckit.plan`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.plan/SKILL.md`
   - Execute to create technical design
   - Creates: `plan.md`

4. **Tasks** (`/speckit.tasks`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.tasks/SKILL.md`
   - Execute to generate task breakdown
   - Creates: `tasks.md`

5. **Analyze** (`/speckit.analyze`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.analyze/SKILL.md`
   - Execute to validate consistency across spec, plan, and tasks
   - Output: Analysis report
   - **Gate**: If critical issues found, stop and fix before proceeding

## Implementation Phase (Steps 6-7)

6. **Implement** (`/speckit.implement`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.implement/SKILL.md`
   - Execute all tasks from `tasks.md` with anti-regression protocols
   - Output: Working implementation

7. **Check** (`/speckit.checker`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.checker/SKILL.md`
   - Run static analysis (linters, type checkers, security scanners)
   - Output: Checker report

## Verification Phase (Steps 8-10)

8. **Test** (`/speckit.tester`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.tester/SKILL.md`
   - Run tests with coverage
   - Output: Test + coverage report

9. **Review** (`/speckit.reviewer`):
   - Use the `view_file` tool to read: `.agents/skills/speckit.reviewer/SKILL.md`
   - Perform code review
   - Output: Review report with findings

10. **Validate** (`/speckit.validate`):
    - Use the `view_file` tool to read: `.agents/skills/speckit.validate/SKILL.md`
    - Verify implementation matches spec requirements
    - Output: Validation report (pass/fail)

## Usage

```
/speckit.all "Build a user authentication system with OAuth2 support"
```

## Pipeline Comparison

| Pipeline           | Steps                     | Use When                               |
| ------------------ | ------------------------- | -------------------------------------- |
| `/speckit.prepare` | 1-5 (Specify → Analyze)   | Planning only — you'll implement later |
| `/speckit.all`     | 1-10 (Specify → Validate) | Full lifecycle in one pass             |

## On Error

If any step fails, stop the pipeline and report:

- Which step failed
- The error message
- Suggested remediation (e.g., "Run `/speckit.clarify` to resolve ambiguities before continuing")
