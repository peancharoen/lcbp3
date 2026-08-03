---
auto_execution_mode: 0
description: Turn the current conversation context into a PRD and publish it to the project issue tracker.
---

# Workflow: to-prd

1. **Context Analysis**:
   - The user wants to create a PRD from the current context. Treat this as the primary input for the skill.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.agents/skills/to-prd/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Synthesize current conversation and codebase understanding into a PRD.
   - Do NOT interview the user - use existing knowledge.

4. **On Error**:
   - If issue tracker not configured: Run `/setup-matt-pocock-skills` first
   - If user expectations unclear: Confirm major modules with user
