---
trigger: always_on
---

# Development Flow

## 🔴 Critical Work — DB / API / Security / Workflow Engine

**MUST complete all steps:**

1. **Glossary check** — verify domain terms in `00-02-glossary.md`
2. **Read the spec** — select from Key Spec Files table
3. **Check schema** — verify table/column in `lcbp3-v1.9.0-schema-02-tables.sql`
4. **Check data dictionary** — confirm field meanings + business rules
5. **Scan edge cases** — `01-06-edge-cases-and-rules.md`
6. **Check ADRs** — verify decisions align (ADR-009, ADR-018, ADR-019)
7. **Write code** — TypeScript strict, no `any`, no `console.log`

## 🟡 Normal Work — UI / Feature / Integration

- Follow existing patterns in codebase.
- Check spec for relevant module only.
- **Hybrid Specs Organization:**
  - Place new Infrastructure tasks in `specs/100-Infrastructures/`
  - Place new Feature/Workflow tasks in `specs/200-fullstacks/`
  - Place Documentation/Research in `specs/300-others/`
- Ensure no forbidden patterns (`any`, `console.log`, UUID misuse) are introduced.

## 🟢 Quick Fix — Bug Fix / Typo / Style

- Fix directly
- Add minimal test if logic changed
- Check forbidden patterns before commit

## Context-Aware Triggers

| Request              | Files to Check                                                       | Expected Response                                   |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| "สร้าง API ใหม่"     | `05-02-backend-guidelines.md`, `lcbp3-v1.9.0-schema-02-tables.sql`   | NestJS Controller + Service + DTO + CASL Guard      |
| "แก้ฟอร์ม frontend"  | `05-03-frontend-guidelines.md`, `01-06-edge-cases.md`                | RHF+Zod + TanStack Query + Thai comments            |
| "เพิ่ม field ใหม่"   | `ADR-009`, `data-dictionary.md`, `lcbp3-v1.9.0-schema-02-tables.sql` | Edit SQL directly + update Data Dictionary + Entity |
| "ตรวจสอบ UUID"       | `ADR-019`, `05-07-hybrid-uuid-implementation-plan.md`                | UUIDv7 MariaDB native UUID + TransformInterceptor   |
| "สร้าง migration"    | `ADR-009`, `03-06-migration-business-scope.md`                       | Edit SQL schema directly + n8n workflow             |
| "ตรวจสอบ permission" | `seed-permissions.sql`, `ADR-016`                                    | CASL 4-Level RBAC matrix                            |
| "deploy production"  | `04-08-release-management-policy.md`, `ADR-015`                      | Release Gates + Blue-Green strategy                 |
| "เพิ่ม test"         | `05-04-testing-strategy.md`                                          | Coverage goals + test patterns                      |
