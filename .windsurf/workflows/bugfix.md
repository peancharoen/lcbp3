---
auto_execution_mode: 0
description: Quick bugfix workflow with minimal impact. Focused on surgical fixes without unrelated refactoring.
---

# Workflow: bugfix

1. **Context Analysis**:
   - The user has reported a bug. Treat the bug description or logs as the primary input.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.agents/skills/bugfix/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Phases: Analysis → Planning → Execution → Finalization

4. **Safety Check**:
   - Always ensure Tier 1 rules (Security, UUID v7, DB Schema) are NOT violated.
   - Refer to `AGENTS.md` for the full list of forbidden patterns.
