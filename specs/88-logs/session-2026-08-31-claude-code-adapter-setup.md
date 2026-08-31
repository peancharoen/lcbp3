# Session — 2026-08-31 (Claude Code Adapter Setup)

## Summary

ตั้งค่า `.claude/` folder ให้ Claude Code ใช้งาน native mechanism ได้ครบ (settings/agents/skills/commands) โดยยึดหลัก "thin adapter" เดิมของ `CLAUDE.md` — ไม่ copy policy ซ้ำ ชี้กลับไป `AGENTS.md` + `.devin/rules/` เสมอ; อัปเดต `AGENTS.md` ให้มี Claude Code ในตาราง Collaboration & Sub-agents Commands

## ปัญหาที่พบ (Root Cause)

`.claude/` ยังไม่มีในโปรเจกต์ — Claude Code ไม่มี native subagent/slash-command/skill-discovery ใช้งาน ต้องพึ่ง `CLAUDE.md` อย่างเดียว (อ่าน `AGENTS.md` แบบ manual ทุกครั้ง ไม่มี allowlist ทำให้ permission prompt ถี่, ไม่มี subagent เฉพาะทางสำหรับงาน Tier 1/specialized)

`.agents/README.md` มี compatibility note อยู่แล้วว่า "rename `.agents` → `.claude` เพื่อให้ Claude Code ใช้ skill ได้เหมือนกัน" แต่ยังไม่มีใครทำจริง

## การแก้ไข (Fix)

| ไฟล์/โฟลเดอร์ | การเปลี่ยนแปลง |
| --- | --- |
| `.claude/skills/` | คัดลอกทั้ง 35 skills จาก `.agents/skills/` ตรงๆ (identical to `.devin/skills/`) — ทำให้ Claude Code `Skill` tool ค้นพบและเรียกใช้ได้อัตโนมัติตาม description |
| `.claude/settings.json` | permissions allowlist ตามตาราง "Commands & Verification" ใน `AGENTS.md`: `allow` = pnpm scripts ปลอดภัย + `git status/diff/log` + MCP read-only tools (mariadb query/describe, redis get/list, qdrant read, memory read, fetch); `ask` = mutation (git push/merge/rebase, DB insert/update/delete, redis set/delete, merge PR); `deny` = frontend `pnpm test` (vitest watch mode hang), `git push origin main`, `git push --force`, `git reset --hard`, `rm -rf` |
| `.claude/agents/security-review.md` | subagent ใหม่ — Tier 1 security gatekeeper (UUID/RBAC/upload/AI boundary), ชี้ไป `AGENTS.md` + `.devin/rules/02-security.md` + `.devin/rules/01-adr-019-uuid.md` + skill `security-review` |
| `.claude/agents/schema-change.md` | subagent ใหม่ — verify schema จริงก่อนเสนอ DDL, ชี้ไป `specs/03-Data-and-Storage/` + ADR-044 delta convention, ห้าม DDL ผ่าน MCP |
| `.claude/agents/spec-researcher.md` | subagent ใหม่ — read-only ADR/spec lookup, ชี้ไป `.devin/rules/12-key-spec-files.md` + `14-context-aware-triggers.md` |
| `.claude/commands/{deploy,schema-change,security-review,bugfix,save-memory}.md` | slash command บาง ๆ ห่อ skill ที่ใช้บ่อย (`.claude/skills/<name>/SKILL.md`) ให้เรียกด้วย `/deploy` ฯลฯ ได้ |
| `AGENTS.md` | v1.9.15 → v1.9.16; เพิ่มแถว Claude Code ในตาราง "Collaboration & Sub-agents Commands" (`Agent` tool/`subagent_type` + `/<command>` → `.claude/agents/` + `.claude/commands/`); เพิ่ม changelog entry |

## กฎที่ Lock แล้ว

- **D186 — Claude Code adapter = `.claude/` mirror ของ `.agents/skills/` + thin subagents/commands:** ห้าม copy policy จาก `AGENTS.md`/`.devin/rules/` ลงในไฟล์ `.claude/agents/*.md` หรือ `.claude/commands/*.md` โดยตรง — ให้ชี้ path กลับไปเสมอ (เช่นเดียวกับ `CLAUDE.md` เดิม); เมื่อ `.devin/skills/`/`.agents/skills/` อัปเดต (เพิ่ม/แก้ skill) ต้อง sync มา `.claude/skills/` ด้วยเพื่อไม่ให้ drift (เหมือนที่ `.kilocode/` และ `.qwen/` sync บางส่วนอยู่แล้ว)

## Verification

- [x] `.claude/skills/<name>/SKILL.md` มีอยู่จริงสำหรับทุก skill ที่ command อ้างถึง (deploy, schema-change, security-review, bugfix, save-memory)
- [x] `.claude/settings.json` เป็น valid JSON
- [x] AGENTS.md เพิ่มแถว Claude Code ในตารางแล้ว, changelog bump v1.9.16
- [ ] ยังไม่ commit — รอ user สั่ง commit
- [ ] ยังไม่ได้ทดสอบเรียก `/deploy`, `/schema-change` ฯลฯ จริงใน session ใหม่ (ต้อง restart Claude Code session เพื่อ pick up `.claude/commands/`)
