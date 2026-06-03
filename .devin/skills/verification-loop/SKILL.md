---
name: verification-loop
description: A comprehensive verification system for LCBP3-DMS development sessions with build, type check, lint, test, security scan, and diff review phases.
version: 1.9.0
scope: verification
depends-on: []
handoffs-to: [speckit-checker, speckit-tester]
user-invocable: true
---

# Verification Loop Skill

A comprehensive verification system for LCBP3-DMS development sessions.

## LCBP3 Context

See [`_LCBP3-CONTEXT.md`](../_LCBP3-CONTEXT.md) for project-specific verification requirements:
- Backend: NestJS with TypeScript strict mode
- Frontend: Next.js with TypeScript strict mode
- Package manager: pnpm
- Coverage goals: Backend 70%+, Business Logic 80%+
- Security: ADR-016, ADR-018, ADR-019, ADR-023 compliance

## When to Use

Invoke this skill:
- After completing a feature or significant code change
- Before creating a PR
- When you want to ensure quality gates pass
- After refactoring
- Before deploying to staging/production

## Verification Phases

### Phase 1: Build Verification

```bash
# Backend build
cd backend
pnpm build 2>&1 | tail -20

# Frontend build
cd frontend
pnpm build 2>&1 | tail -20
```

If build fails, STOP and fix before continuing.

### Phase 2: Type Check

```bash
# Backend TypeScript
cd backend
pnpm typecheck 2>&1 | head -30

# Frontend TypeScript
cd frontend
pnpm typecheck 2>&1 | head -30
```

Report all type errors. Fix critical ones before continuing.

### Phase 3: Lint Check

```bash
# Backend lint
cd backend
pnpm lint 2>&1 | head -30

# Frontend lint
cd frontend
pnpm lint 2>&1 | head -30
```

### Phase 4: Test Suite

```bash
# Backend tests with coverage
cd backend
pnpm test -- --coverage 2>&1 | tail -50

# Frontend unit tests
cd frontend
pnpm test 2>&1 | tail -50

# Frontend E2E tests (if applicable)
cd frontend
npx playwright test 2>&1 | tail -50
```

Report:
- Total tests: X
- Passed: X
- Failed: X
- Coverage: X%

### Phase 5: Security Scan

```bash
# Check for hardcoded secrets
grep -rn "sk-" --include="*.ts" --include="*.tsx" . 2>/dev/null | head -10
grep -rn "api_key" --include="*.ts" --include="*.tsx" . 2>/dev/null | head -10
grep -rn "password" --include="*.ts" --include="*.tsx" . 2>/dev/null | head -10

# Check for console.log (forbidden in committed code)
grep -rn "console.log" --include="*.ts" --include="*.tsx" backend/src/ frontend/src/ 2>/dev/null | head -10

# Check for any types (forbidden)
grep -rn ": any" --include="*.ts" --include="*.tsx" backend/src/ frontend/src/ 2>/dev/null | head -10

# Check for parseInt on UUID (ADR-019 violation)
grep -rn "parseInt(" --include="*.ts" --include="*.tsx" backend/src/ frontend/src/ 2>/dev/null | head -10
```

### Phase 6: ADR Compliance Check

```bash
# Check for id ?? '' fallback (ADR-019 violation)
grep -rn "id ?? ''" --include="*.ts" --include="*.tsx" frontend/src/ 2>/dev/null | head -10

# Check for Number() on UUID (ADR-019 violation)
grep -rn "Number(" --include="*.ts" --include="*.tsx" frontend/src/ 2>/dev/null | head -10

# Check for + operator on UUID (ADR-019 violation)
grep -rn "+ publicId\|+ id" --include="*.ts" --include="*.tsx" frontend/src/ 2>/dev/null | head -10
```

### Phase 7: Diff Review

```bash
# Show what changed
git diff --stat
git diff HEAD~1 --name-only

# Show detailed changes
git diff
```

Review each changed file for:
- Unintended changes
- Missing error handling (ADR-007)
- Potential edge cases
- UUID handling (ADR-019)
- Security vulnerabilities (ADR-016)
- AI boundary violations (ADR-018/023)

## Output Format

After running all phases, produce a verification report:

```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed, Z% coverage)
Security:  [PASS/FAIL] (X issues)
ADR:       [PASS/FAIL] (X violations)
Diff:      [X files changed]

Overall:   [READY/NOT READY] for PR

Issues to Fix:
1. ...
2. ...
```

## Continuous Mode

For long sessions, run verification every 15 minutes or after major changes:

```markdown
Set a mental checkpoint:
- After completing each function
- After finishing a component
- Before moving to next task

Run: /verify
```

## Integration with LCBP3 Skills

This skill complements:
- **speckit-checker**: Runs static analysis (lint, typecheck)
- **speckit-tester**: Runs tests with coverage verification
- **speckit-security-audit**: Performs security review against OWASP Top 10

This skill provides a unified verification loop that combines all checks into a single report.

## LCBP3-Specific Checks

### Tier 1 — CRITICAL (CI BLOCKER)

- [ ] **Security**: Auth, RBAC, Validation implemented
- [ ] **UUID Strategy (ADR-019)**: No `parseInt` / `Number` / `+` on UUID
- [ ] **Database correctness**: Schema verified before writing queries
- [ ] **File upload security**: ClamAV + whitelist implemented
- [ ] **AI validation boundary (ADR-018/023)**: AI via DMS API only
- [ ] **Error handling (ADR-007)**: Layered error classification
- [ ] **Forbidden patterns**: Zero `any`, zero `console.log`, UUID misuse

### Tier 2 — IMPORTANT (CODE REVIEW)

- [ ] **Architecture patterns**: Thin controller, business logic in service
- [ ] **Test coverage**: 80%+ business logic, 70%+ backend overall
- [ ] **Cache invalidation**: Implemented when data modified
- [ ] **Naming conventions**: Follow domain terminology

### Tier 3 — GUIDELINES

- [ ] **Code style**: Prettier formatting
- [ ] **Comment completeness**: Thai comments, JSDoc on public methods
- [ ] **Minor optimizations**: Performance improvements where applicable

## References

- LCBP3 AGENTS.md: `AGENTS.md` (repo root)
- ADR-007 Error Handling: `specs/06-Decision-Records/ADR-007-error-handling-strategy.md`
- ADR-016 Security: `specs/06-Decision-Records/ADR-016-security-authentication.md`
- ADR-019 UUID: `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md`
- ADR-018 AI Boundary: `specs/06-Decision-Records/ADR-018-ai-boundary.md`
- ADR-023 AI Architecture: `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md`
