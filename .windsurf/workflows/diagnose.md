---
auto_execution_mode: 0
description: Disciplined diagnosis loop for hard bugs and performance regressions. Reproduce → minimise → hypothesise → instrument → fix → regression-test.
---

# Workflow: diagnose

1. **Context Analysis**:
   - The user has provided a bug report or performance regression. Treat this as the primary input for the skill.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.windsurf/skills/diagnose/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Execute phases: Build feedback loop → Reproduce → Hypothesise → Instrument → Fix → Regression test → Cleanup

4. **On Error**:
   - If cannot build a feedback loop: Ask user for environment access, captured artifacts, or production instrumentation
   - If no correct seam for regression test: Flag architectural issues to improve-codebase-architecture
