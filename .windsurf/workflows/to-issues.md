---
auto_execution_mode: 0
description: Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices.
---

# Workflow: to-issues

1. **Context Analysis**:
   - The user wants to convert a plan into issues. Treat this as the primary input for the skill.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.windsurf/skills/to-issues/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Draft vertical slices (HITL or AFK) → Quiz user → Publish to issue tracker.
   - Each slice delivers a narrow but complete path through every layer.

4. **On Error**:
   - If issue tracker not configured: Run `/setup-matt-pocock-skills` first
   - If user wants different granularity: Iterate on slice sizes
