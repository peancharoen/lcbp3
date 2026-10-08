# Session — 2026-10-08 (Org-role per-context pipeline: PR #29–#32 + docs slim-down)

## Summary

Review → fix → merge → deploy PR #29 (org role per contract/project), #30 (user-grouping), #31 (role-assignment API/UI); browser-verify บน production พบ bug role update ไม่ persist → hotfix PR #32; อัปเดต root/rules/specs docs และลด `AGENTS.md` 497→107 บรรทัด

## ปัญหาที่พบ (Root Cause)

| ปัญหา | Root cause |
| --- | --- |
| PR #30 `reminder_rules` delta พัง | ตารางจริงเป็น legacy shape — delta ต้อง reconcile (ไม่ใช่ create) |
| PR #30 group-routing claim race | read-then-write — แก้เป็น conditional UPDATE atomic |
| PR #30 primary org ซ้ำได้ | MariaDB ไม่มี partial index → generated column + UNIQUE |
| `PATCH …/organizations/:orgUuid` 200 แต่ role ไม่เปลี่ยน (PR #31) | `repo.save(link)` บน entity ที่โหลด `organizationRole` → relation เก่า cascade เขียนทับ `roleId` ใหม่ |
| Merge ไม่ได้ | admin เป็น PR author (self-approve ไม่ได้); `devin-bot` review ไม่ official → ใช้ `nattanin` |
| Deploy run 839 fail | registry `192.168.10.9:5000` push timeout (infra flake) → rerun failed job |
| `main` ถูก reset ทับ docs commit | auto-sync process (D294) → ทำงานใน worktree/branch แยก |

## การแก้ไข (Fix)

| PR / Commit | การเปลี่ยนแปลง |
| --- | --- |
| #29 `a1515fd2` | drop `organizations.role_id` → role อยู่บน `contract_organizations`/`project_organizations` (delta post-deploy, run 833) |
| #30 `fdbb1476` | departments/user_groups/user_organizations, atomic group claim, `uk_user_primary_org`, `chk_channel_single_scope` =1, `@IsUUID recipientRef` (delta pre-merge zero-gap, run 837) |
| #31 `40877227` | `GET /organizations/roles` + project/contract org-link CRUD + `OrganizationLinksDialog` (run 839) |
| #32 `fc00ef26` | `updateOrganizationRole` ใช้ `repo.update()` + `findOneOrFail` refetch (Project+Contract) + regression tests (run 841) |
| `d12b8350`, `ba7a4cc9` | docs: CHANGELOG v1.9.16, CONTEXT, ARCHITECTURE, README, rules mirrors, specs/.devin READMEs |
| `5a1c77fe` | `AGENTS.md` 497→107; ใหม่ `.devin/rules/26-commands-verification.md`; changelog → `specs/88-logs/agents-md-changelog.md` |

## กฎที่ Lock แล้ว

D358–D364 ใน `memory/project-memory-override.md` (signing, delta timing, channel scope, roleName identifier, primary-org guard, worktree gotchas, TypeORM FK update)

## Verification

- [x] CI 836/838/840 success; deploy 833/837/839/841 success
- [x] Playwright (production): project dialog add EN→THIRD PARTY (POST 201) → PATCH GUEST → GET/UI/DB = GUEST; contract dialog ผรม.2 CONTRACTOR→GUEST→revert CONTRACTOR (DB ยืนยันทุกขั้น); mobile 390×844 render OK; console 0 errors (1 a11y warning: DialogContent Description)
- [x] Temp Gitea tokens revoked (ลบจาก `access_token` โดยตรง — token API ต้อง basic auth); fork branches + worktrees ลบแล้ว
- [ ] Test link `EN → GUEST` ยังค้างบน LCBP3-C2 (รอตัดสินใจเก็บ/ลบ)
