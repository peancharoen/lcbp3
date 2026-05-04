---
auto_execution_mode: 0
description: Perform a security-focused audit of the codebase against OWASP Top 10, CASL authorization, and LCBP3-DMS security requirements.
---

# Workflow: speckit.security-audit

1. **Context Analysis**:
   - The user may pass a scope hint: `backend`, `frontend`, `both`, or specific module paths (defaults to `both`).

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.windsurf/skills/speckit-security-audit/SKILL.md`
   - Also load `.agents/skills/_LCBP3-CONTEXT.md` for project-specific rules.

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - This is READ-ONLY — never modify code during the audit.
   - Output a structured report with Critical / High / Medium / Low severity.

4. **On Error**:
   - If scope unclear: Default to `both` (backend + frontend)
   - If `specs/06-Decision-Records/ADR-016-security-authentication.md` missing: Warn and proceed with OWASP Top 10 + CASL checks only
