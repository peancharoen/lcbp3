---
description: Run the Tier 1 security audit (UUID, RBAC, upload, AI boundary) on current changes
---

Delegate to the `security-review` subagent (`.claude/agents/security-review.md`) or follow `.claude/skills/security-review/SKILL.md` directly against the current diff (`git diff`) or the path given. Report CONFIRMED/PLAUSIBLE findings with file:line, Tier 1 items only unless asked otherwise. Target: $ARGUMENTS
