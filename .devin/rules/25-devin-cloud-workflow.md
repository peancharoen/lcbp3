# Devin Cloud Workflow (Fork → PR)

> ใช้เฉพาะ agent ที่รันบน **Devin Cloud** (ทำงานในนาม Gitea user `devin-bot`) — agent บนเครื่อง admin (Devin Desktop / Windsurf / Claude Code ฯลฯ) ใช้ Commit Discipline (D264) + `2git.sh` ตามเดิม (ดู `09-commit-checklist.md`)

## Context

- Devin Cloud **ไม่มี native Gitea integration** (รองรับเฉพาะ GitHub / GitLab / Bitbucket / Azure DevOps) → ใช้ HTTPS + token (`GITEA_TOKEN` ใน Devin Secrets) ผ่าน `https://git.np-dms.work`
- GitHub `peancharoen/lcbp3` เป็น **one-way push mirror** จาก Gitea (`git push --mirror`) — ทุกอย่างที่ทำบน GitHub ถูกเขียนทับ/ลบในรอบ sync ถัดไป
- `main` ของ `np-dms/lcbp3` มี **branch protection**: push allowlist = `admin` เท่านั้น, ห้าม force push, merge ต้องมี approval + status check `ci-quality` / `ci-test`, protected files = `.gitea/workflows/**`, `2git.sh`, `2git.ps1`
- ทำงานบน **fork** เพราะ PR จาก fork ไม่ได้รับ repo secrets (เช่น `SSH_KEY` ที่ใช้ deploy) ใน Gitea Actions — bot มีสิทธิ์ **Read** บน repo หลักเท่านั้น

## CRITICAL RULES

| Remote     | URL                                           | สิทธิ์ของ `devin-bot` |
| ---------- | --------------------------------------------- | --------------------- |
| `origin`   | `https://git.np-dms.work/devin-bot/lcbp3.git` | Read + Write (fork)   |
| `upstream` | `https://git.np-dms.work/np-dms/lcbp3.git`    | Read only             |

- **ALWAYS** sync fork ก่อนเริ่มงาน: `git fetch upstream && git checkout main && git reset --hard upstream/main && git push origin main`
- **ALWAYS** ทำงานบน branch `devin/<topic>` (kebab-case เช่น `devin/fix-rfa-status-filter`) แตกจาก `main` ที่ sync แล้ว
- **ALWAYS** รัน verification (lint + test ของ workspace ที่แตะ — ดู AGENTS.md § Commands & Verification) ให้ผ่านก่อน push
- **ALWAYS** commit ตาม format `type(scope): description` — ห้ามใส่ `[skip CI]` / `[skip lint]` / `[skip test]` / `[deploy-only]`
- **ALWAYS** push ไป `origin` (fork) เท่านั้น: `git push origin devin/<topic>`
- **NEVER** push ไป `upstream` หรือ branch ใด ๆ ใน `np-dms/lcbp3`
- **NEVER** merge PR เอง — admin review + merge เท่านั้น

## ขั้นตอนต่อ Task

1. Sync fork (ตาม CRITICAL RULES)
2. `git checkout -b devin/<topic>`
3. แก้ไข + verification ผ่าน
4. Commit (`type(scope): description`)
5. `git push origin devin/<topic>`
6. เปิด PR `devin-bot:devin/<topic>` → `np-dms/lcbp3:main` (ดูหัวข้อ Opening the PR)
7. ถ้า `main` ขยับระหว่างรอ review → `git fetch upstream && git rebase upstream/main` แล้ว `git push --force-with-lease origin devin/<topic>` (force ได้เฉพาะ branch ของตัวเองบน fork)
8. ตอบ review comment ด้วย commit ใหม่บน branch เดิม — ห้ามเปิด PR ใหม่ซ้ำ

## Opening the PR

ใช้ Gitea MCP ตัวใดตัวหนึ่ง (ดู `19-mcp-gitea-tools.md`) หรือ REST API:

| วิธี                           | คำสั่ง                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `gitea-official` (Devin Cloud) | `pull_request_write` method `create` — `owner: "np-dms"`, `repo: "lcbp3"`, `head: "devin-bot:devin/<topic>"`, `base: "main"` |
| `gitea` (amonstack)            | `create_pull_request` — `owner: "np-dms"`, `repo: "lcbp3"`, `head: "devin-bot:devin/<topic>"`, `base: "main"`                |
| REST API                       | `POST https://git.np-dms.work/api/v1/repos/np-dms/lcbp3/pulls` + header `Authorization: token $GITEA_TOKEN`                  |

PR body ต้องมี:

- สรุปการเปลี่ยนแปลง (ทำไม + อะไร)
- ADR / spec ที่อ้างอิง (เช่น ADR-019, `05-02-backend-guidelines.md`)
- ผล verification (คำสั่งที่รัน + ผล pass/fail)
- ความเสี่ยง / สิ่งที่ reviewer ควรดูเป็นพิเศษ

## ห้าม (Devin Cloud)

- ❌ รัน `2git.sh` / `2git.ps1` (ใช้เฉพาะเครื่อง admin)
- ❌ แตะ GitHub (`peancharoen/lcbp3`) / ❌ ใช้ `gh` CLI
- ❌ แก้ `.gitea/workflows/**`, `2git.sh`, `2git.ps1` (protected files — PR merge ไม่ได้) เว้นแต่ได้รับคำสั่งชัดเจน
- ❌ ใช้ MCP tools ที่เขียนตรงเข้า repo หลัก (`create_or_update_file`, `delete_file`, `create_branch`, `delete_branch`, `create_tag` ฯลฯ บน `np-dms/lcbp3`) — ทำผ่าน git บน fork เท่านั้น
- ❌ `merge_pull_request` / `pull_request_write` method `merge` / `actions_config_write` (secrets/variables)
- ❌ commit token / credential (`GITEA_TOKEN` อยู่ใน Devin Secrets เท่านั้น) — ห้าม echo/log ค่า token
- ❌ เข้าถึง production DB, storage, Redis, Qdrant หรือ server `192.168.10.11` โดยตรง
- ❌ แก้ schema SQL, RBAC matrix หรือ ADR โดยไม่มีคำสั่งชัดเจน (ดู `05-forbidden-actions.md`)

## Related Documents

- `AGENTS.md` § Devin Cloud Workflow (Fork → PR)
- `09-commit-checklist.md` — Commit Discipline (D264) + `2git.sh` (เครื่อง admin)
- `19-mcp-gitea-tools.md` — Gitea MCP servers (`gitea` + `gitea-official`)
- `05-forbidden-actions.md` — Forbidden Actions & Out of Scope
