---
auto_execution_mode: 0
description: A comprehensive verification system for LCBP3-DMS development sessions with build, type check, lint, test, security scan, and diff review phases
---

This workflow invokes the verification-loop skill to perform comprehensive verification of LCBP3-DMS code changes.

Invoke the verification-loop skill when:
- After completing a feature or significant code change
- Before creating a PR
- When you want to ensure quality gates pass
- After refactoring
- Before deploying to staging/production
