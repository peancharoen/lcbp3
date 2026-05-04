---
auto_execution_mode: 0
description: Tell the agent to zoom out and give broader context or a higher-level perspective. Use when you're unfamiliar with a section of code or need to understand how it fits into the bigger picture.
---

# Workflow: zoom-out

1. **Context Analysis**:
   - The user is unfamiliar with a section of code or needs broader context. Treat this as the primary input.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.windsurf/skills/zoom-out/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Go up a layer of abstraction and give a map of all relevant modules and callers.
   - Use the project's domain glossary vocabulary.

4. **On Error**:
   - No specific error handling - this is an exploratory skill.
