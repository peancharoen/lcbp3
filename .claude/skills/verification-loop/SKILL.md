---
name: verification-loop
description: A comprehensive verification system for LCBP3-DMS development sessions with build, type check, lint, test, security scan, and diff review phases.
version: 1.9.0
scope: verification
depends-on: []
handoffs-to: [108-speckit.checker, 109-speckit.tester]
user-invocable: true
---

# Verification Loop Skill

A comprehensive verification system for LCBP3-DMS development sessions.

## LCBP3 Context

Load these references before running verification:

1. [`_LCBP3-CONTEXT.md`](../_LCBP3-CONTEXT.md) for project-specific verification requirements:
   - Backend: NestJS with TypeScript strict mode
   - Frontend: Next.js with TypeScript strict mode
   - Package manager: pnpm
   - Coverage goals: Backend 70%+, Business Logic 80%+
   - Security: ADR-016, ADR-019, ADR-023/043 (AI boundary — supersedes archived ADR-018/020) compliance
2. [`_LCBP3-CONTRACTS.md`](../_LCBP3-CONTRACTS.md) for the cross-session assurance ledger, TDD evidence format, and reviewer evidence bar.

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

### Phase 8: Contract Compliance / Ledger Check

Before declaring READY for PR, verify contract artifacts per `_LCBP3-CONTRACTS.md`:

1. **Assurance ledger** (if the feature has one):
   - Read `LEDGER_LOCATION` from `specs/200-fullstacks/<feature>/ledger.md` or equivalent
   - Confirm `STATUS` is `complete` or `checkpoint-ready` (not `open` or `blocked`)
   - Confirm final checkpoint has verification results and TDD evidence links
   - Confirm no protected boundary was crossed without authorization

2. **TDD evidence**:
   - For every behavior-changing diff, locate the associated TDD evidence record
   - Verify it contains RED command/output, GREEN command/output, and REFACTOR command/output (or a justified not-applicable reason)
   - Tests written after implementation do not satisfy this requirement

3. **Reviewer evidence bar**:
   - If `110-speckit-reviewer` or `112-speckit-security-audit` reported CRITICAL/HIGH findings, confirm each has: violated contract, reachable path, impact, file references, evidence gap, and fix

If ledger status is `open`/`blocked` or TDD evidence is missing for behavior changes, set overall status to **NOT READY**.

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
Ledger:    [N/A/OK/BLOCKED] (status)
TDD:       [PASS/FAIL] (X/Y behavior changes with evidence)
Contract:  [PASS/FAIL] (ledger + evidence bar)

Overall:   [READY/NOT READY] for PR

Issues to Fix:
1. ...
2. ...
```

## 🚫 No Fake Evidence Rule

> **ห้ามรายงานว่า test ผ่าน / build สำเร็จ ถ้าไม่ได้รันจริง**
> ถ้ารันไม่ได้ ให้ระบุเหตุผลอย่างชัดเจนแทน

## ✅ Mandatory Output (ทุก verification ต้องมีครบ)

รายงานท้ายงานต้องมี 5 หัวข้อนี้เสมอ:

### 1. Pipeline trace

ลำดับขั้นตอนที่ทำจริง: Understand → Plan → Execute → Verify → Handoff

### 2. Commands run

รายการคำสั่งที่รันจริงพร้อมผลสรุป:

```
✅ pnpm run build          → Pass (0 errors)
✅ pnpm run lint           → Pass (0 warnings)
✅ pnpm run test           → 42 passed, 0 failed
❌ ไม่ได้รัน: e2e tests    → เหตุผล: ต้องการ DB จริง, ไม่มีใน CI environment
```

### 3. Verification / Evidence

หลักฐานจริง เช่น build output, test result, diff, screenshot, link

### 4. Limitations / Risks

สิ่งที่ยังไม่ได้ตรวจ, ความเสี่ยง, ข้อจำกัดของ environment

### 5. Next steps

งานที่ต้องทำต่อหลัง verification

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

- **108-speckit.checker**: Runs static analysis (lint, typecheck)
- **109-speckit.tester**: Runs tests with coverage verification
- **112-speckit.security-audit**: Performs security review against OWASP Top 10

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
- ADR-023/043 AI Boundary (current): `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md` + `specs/06-Decision-Records/ADR-043-ai-architecture-current-state.md` (Single Source of Truth)
- ADR-018 AI Boundary (archived): `specs/06-Decision-Records/archive/ADR-018-ai-boundary.md` (superseded by ADR-023 → ADR-043)
