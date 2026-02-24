---
trigger: always_on
description: Control which shell commands the agent may run automatically.
allowAuto:
  - 'pnpm test:watch'
  - 'pnpm test:debug'
  - 'pnpm test:e2e'
  - 'git status'
  - 'git log --oneline'
  - 'git diff'
  - 'git branch'
  - 'tsc --noEmit'
denyAuto:
  - 'rm -rf'
  - 'Remove-Item'
  - 'git push --force'
  - 'git reset --hard'
  - 'git clean -fd'
  - 'curl | bash'
  - 'docker compose down'
  - 'DROP TABLE'
  - 'TRUNCATE'
  - 'DELETE FROM'
alwaysReview: true
scopes:
  - 'backend/src/**'
  - 'backend/test/**'
  - 'frontend/app/**'
---

# Execution Rules

- Only auto-execute commands that are explicitly listed in `allowAuto`.
- Commands in `denyAuto` must always be blocked, even if manually requested.
- All shell operations that create, modify, or delete files in `backend/src/`, `backend/test/`, or `frontend/app/` require human review.
- Alert before running any SQL that modifies data (INSERT/UPDATE/DELETE/DROP/TRUNCATE).
- Alert if environment variables related to DB connection or secrets (DATABASE_URL, JWT_SECRET, passwords) would be displayed or logged.
- Never auto-execute commands that expose sensitive credentials via MCP tools or shell output.
