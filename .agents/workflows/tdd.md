---
auto_execution_mode: 0
description: Test-driven development with red-green-refactor loop. Use when user wants to build features or fix bugs using TDD, mentions red-green-refactor, wants integration tests, or asks for test-first development.
---

# Workflow: tdd

1. **Context Analysis**:
   - The user wants to build features or fix bugs using TDD. Treat this as the primary input for the skill.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.agents/skills/tdd/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Plan → Tracer Bullet → Incremental Loop → Refactor
   - One test at a time, only enough code to pass current test.

4. **On Error**:
   - If interface changes are needed: Confirm with user first
   - If unsure which behaviors to test: Ask user to prioritize
