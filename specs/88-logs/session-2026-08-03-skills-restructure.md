# Session N — 2026-08-03 (Skills Restructure + Stale Refs Cleanup)

## Summary

ย้าย workflows ทั้งหมดจาก `.agents/workflows/` + `.devin/workflows/` ไป archive และแปลงเป็น skills ใน `.agents/skills/` + `.devin/skills/` ตามโมเดลการทำงานของ Devin CLI ที่ใช้ slash commands (`/skill-name`) เรียก `SKILL.md` โดยตรง ไม่ได้ invoke workflows พร้อมแก้ stale refs ทั้งหมด (schema v1.7.0/v1.8.0 → v1.9.0, Desk-5439 → np-dms-lcbp3, .windsurf/.agents paths → relative/slash commands)

## ปัญหาที่พบ (Root Cause)

1. **sync-agent-configs.sh** sync จาก `.agents/` ไป `.windsurf/` แทน `.devin/` (Devin ไม่ได้อ่าน `.windsurf/`)
2. **Devin CLI ไม่ invoke workflows** — ใช้ slash commands เรียก `SKILL.md` ใน `.devin/skills/` โดยตรง
3. **Workflows ซ้ำซ้อน** — 27 ไฟล์เป็น wrapper ที่ชี้ไป skills ที่มีอยู่แล้ว
4. **Broken stubs** — 5 ไฟล์อ้างถึง skills ที่ไม่มีอยู่ (tdd, to-issues, to-prd, triage, zoom-out)
5. **Stale refs ใน skills/rules** — schema v1.7.0/v1.8.0, Desk-5439, `.windsurf/` paths

## การแก้ไข (Fix)

| ไฟล์/Dir | การเปลี่ยนแปลง |
|---------|---------------|
| `scripts/sync-agent-configs.sh` + `.ps1` | แก้ sync target จาก `.windsurf/` → `.devin/` |
| `.agents/rules/00-project-context.md` + `.devin/rules/` | เปลี่ยน `.agents/skills/` → `./skills/` |
| `.agents/rules/08-development-flow.md` + `.devin/rules/` | เปลี่ยน `./workflows/*.md` → `/skill-name` slash commands |
| `.agents/rules/14-context-aware-triggers.md` + `.devin/rules/` | อัปเดต relative paths |
| `.agents/skills/00-speckit.all/` (new) | สร้างจาก workflow `00-speckit.all.md` |
| `.agents/skills/01-speckit.prepare/` (new) | สร้างจาก workflow `01-speckit.prepare.md` |
| `.agents/skills/101-112-speckit.*` (renamed) | เปลี่ยนชื่อจาก `speckit-*` + อัปเดต `name:` field + cross-refs |
| `.agents/skills/201-206-speckit.*` (renamed) | เปลี่ยนชื่อ utility skills + อัปเดต cross-refs |
| `.agents/skills/check-real-app/` (new) | แปลงจาก workflow |
| `.agents/skills/create-backend-module/` (new) | แปลงจาก workflow + ลบ `// turbo` + schema v1.9.0 |
| `.agents/skills/create-frontend-page/` (new) | แปลงจาก workflow |
| `.agents/skills/deploy/` (new) | แปลงจาก workflow + schema v1.7.0 → v1.9.0 |
| `.agents/skills/resume-pending-work/` (new) | แปลงจาก workflow |
| `.agents/skills/schema-change/` (new) | แปลงจาก workflow + ลบ `// turbo` + schema v1.9.0 |
| `.agents/skills/diagnose/SKILL.md` | ลบ `/improve-codebase-architecture` (skill ไม่มีอยู่) |
| `.agents/skills/save-memory/SKILL.md` | เพิ่ม Section 4 (MCP Knowledge Graph) + อัปเดตโครงสร้าง Memory |
| `.agents/skills/110-speckit.reviewer/SKILL.md` | Merge Tier 1 rules + Bug Focus จาก `review.md` workflow |
| `.agents/skills/verification-loop/SKILL.md` | Merge "No Fake Evidence Rule" + Mandatory Output จาก workflow |
| `.agents/skills/112-speckit.security-audit/SKILL.md` | schema v1.8.0 → v1.9.0 |
| `.agents/skills/_LCBP3-CONTEXT.md` | schema v1.8.0 → v1.9.0 |
| `.agents/skills/nestjs-best-practices/` (6 ไฟล์) | schema v1.8.0 → v1.9.0 + sync lcbp3-ai-boundary.md |
| `.agents/skills/security-review/SKILL.md` | Desk-5439 → np-dms-lcbp3 |
| `.agents/skills/skills.md` | อัปเดต dependency matrix ด้วยชื่อ skills ใหม่ |
| `specs/99-archives/old-workflows-wrapper/` | ย้าย workflows 40 ไฟล์ (20 wrapper + 7 LCBP3 + 5 broken + 8 group B) |

## กฎที่ Lock แล้ว

- **Devin CLI ใช้ slash commands** (`/skill-name`) เรียก `SKILL.md` ใน `.devin/skills/` โดยตรง — ไม่ invoke `.devin/workflows/`
- **`.agents/` เป็น canonical source** — sync ไป `.devin/` ผ่าน `sync-agent-configs.sh`
- **Skill naming**: `NNN-speckit.<name>` (101-112 main, 201-206 utility), `00-01` for meta
- **stale refs ห้ามมี**: schema v1.7.0/v1.8.0, Desk-5439 (ยกเว้น "formerly Desk-5439"), `.windsurf/` paths, `.agents/workflows/` paths

## Verification

- [x] `.agents/skills/` ↔ `.devin/skills/` in sync (35 skills ทั้งคู่)
- [x] `name:` field ตรงกับ directory name ทุก skill
- [x] ไม่มี old `speckit-*` references เหลือใน skills
- [x] ไม่มี `Desk-5439` (ยกเว้น "formerly" historical context)
- [x] ไม่มี schema `v1.7.0`/`v1.8.0` ใน skills
- [x] ไม่มี `.windsurf/` หรือ `.agents/workflows/` paths ใน skills/rules
- [x] `.devin/workflows/` และ `.agents/workflows/` ว่าง (40 ไฟล์ archived)
- [x] `diagnose` ไม่อ้าง `/improve-codebase-architecture` อีก
- [x] `save-memory` มี Section 4 (MCP Knowledge Graph) ครบ
- [x] `110-speckit.reviewer` มี Tier 1 rules + Bug Focus จาก `review.md`
- [x] `verification-loop` มี "No Fake Evidence Rule" + Mandatory Output
