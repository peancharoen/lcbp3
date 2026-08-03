---
auto_execution_mode: 0
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise.
---

# Workflow: grill-with-docs

1. **Context Analysis**:
   - The user has provided a plan to stress-test. Treat this as the primary input for the skill.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.agents/skills/grill-with-docs/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Ask questions one at a time, waiting for feedback before continuing.
   - Update CONTEXT.md and ADRs inline as terms are resolved.

4. **On Error**:
   - If CONTEXT.md or docs/adr/ don't exist: Create them lazily when first term is resolved
