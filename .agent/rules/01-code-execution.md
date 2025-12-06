---
trigger: always_on
---

---

description: Control which shell commands the agent may run automatically.
allowAuto: ["pnpm test:watch", "pnpm test:debug", "pnpm test:e2e", "git status"]
denyAuto: ["rm -rf", "Remove-Item", "git push --force", "curl | bash"]
alwaysReview: true
scopes: ["backend/src/**", "backend/test/**", "frontend/app/**"]

---

# Execution Rules

- Only auto-execute commands that are explicitly listed in `allowAuto`.
- Commands in denyAuto must always be blocked, even if manually requested.
- All shell operations that create, modify, or delete files in `backend/src/` or `backend/test/` or `frontend/app/`require human review.
- Alert if environment variables related to DB connection or secrets would be displayed or logged.
