---
auto_execution_mode: 0
description: Triage issues through a state machine driven by triage roles. Use when user wants to create an issue, triage issues, review incoming bugs or feature requests, prepare issues for an AFK agent, or manage issue workflow.
---

# Workflow: triage

1. **Context Analysis**:
   - The user wants to triage issues. Treat this as the primary input for the skill.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.agents/skills/triage/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Show what needs attention OR Triage specific issue OR Quick state override.
   - Apply triage roles: bug/enhancement + needs-triage/needs-info/ready-for-agent/ready-for-human/wontfix.

4. **On Error**:
   - If issue tracker not configured: Run `/setup-matt-pocock-skills` first
   - If state roles conflict: Flag and ask maintainer before proceeding
   - If no reproduction possible: Mark as `needs-info`
