---
auto_execution_mode: 0
description: Convert existing tasks into actionable, dependency-ordered issues on Gitea for the current feature.
---

# Workflow: speckit.taskstoissues

1. **Context Analysis**:
   - The user may pass filters (e.g., phase, priority). Default: convert all pending tasks.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.windsurf/skills/speckit-taskstoissues/SKILL.md`
   - Also load `.agents/skills/_LCBP3-CONTEXT.md` for project conventions (labels, commit format).

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Use Gitea API (not GitHub) — target `git.np-dms.work/np-dms/lcbp3`.
   - Apply LCBP3 labels: `spec`, `adr`, `security`, `ux`, `backend`, `frontend`, `schema`, etc.
   - Use commit-format-compatible issue titles (per `specs/05-Engineering-Guidelines/05-05-git-conventions.md`).

4. **On Error**:
   - If `tasks.md` missing: Run `/05-speckit.tasks` first
   - If Gitea credentials missing: Report to user and provide manual issue-creation template
