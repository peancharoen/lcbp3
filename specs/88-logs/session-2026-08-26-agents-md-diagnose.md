# Session — 2026-08-26 (AGENTS.md Diagnose & Fix 5 Issues)

## Summary

Diagnose ปัญหา 5 จุดใน `AGENTS.md` ตามกระบวนการ Diagnose (Phase 1-6) และแก้ไขทั้งหมด พร้อม sync ไปยัง `.agents/rules/` และ `.devin/rules/` — เป็นการปิด documentation drift ที่ทำให้ agent เดาผิดบ่อย

## ปัญหาที่พบ (Root Cause)

เป็น documentation drift — ข้อมูลใน `AGENTS.md` ล้าสมัยหรือขาดหายไป เนื่องจากไม่ได้ sync ตามการเปลี่ยนแปลงจริง (ADR-041, D81, ADR-047, ESLint config):

1. **ไม่มี Commands & Verification section** — agent เดาคำสั่ง build/test/lint เอง และเดาผิดบ่อยสุดคือ frontend `pnpm test` = vitest watch mode (hang ไม่จบ) ทั้งที่ CI ใช้ `pnpm test run`
2. **ESLint ห้าม parseInt ทุกกรณี** — `backend/eslint.config.mjs` ใช้ `no-restricted-syntax` แบน `parseInt()` และ unary `+` ทั้งหมด แต่ CI grep gate ตรวจแค่ `parseInt(.*uuid` — agent ที่อ่านแค่ CI gate จะเขียน `parseInt(page, 10)` สำหรับ pagination แล้ว fail ESLint
3. **Admin Desktop → np-dms-lcbp3** — stale claim บรรทัดที่ 69 อ้างว่า Ollama รันบน "Admin Desktop" ทั้งที่ ADR-041 decommissioned Desk-5439 ไปแล้ว
4. **skill count 21 → 35** — D81 ยืนยัน 35 skills แต่ AGENTS.md ยังเขียน 21
5. **ADR-047 ไม่ถูกอ้างถึง** — ADR-047 (Native Backend Legacy Ingestion, Accepted 2026-08-20) แก้ไข ADR-028+042 และแนะนำ `migration_review_queue` lifecycle แต่ไม่อยู่ใน AGENTS.md

## การแก้ไข (Fix)

| ไฟล์                                       | การเปลี่ยนแปลง                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                | เพิ่ม Commands & Verification section (build/test/lint ทั้ง backend/frontend/root + CI pipeline order) |
| `AGENTS.md`                                | เพิ่ม ESLint blanket ban note ใน Identifier Strategy section                                            |
| `AGENTS.md`                                | แก้ "Admin Desktop" → `np-dms-lcbp3` (post-ADR-041) บรรทัด 69                                           |
| `AGENTS.md`                                | แก้ skill count 21 → 35 (บรรทัด 6 + 339) + เพิ่ม `.devin/skills/` ↔ sync notation                       |
| `AGENTS.md`                                | เพิ่ม ADR-047 ใน Tier 3 Migration Pipeline (บรรทัด 106)                                                  |
| `AGENTS.md`                                | Bump version 1.9.13 → 1.9.14 + Change Log entry                                                         |
| `.devin/rules/01-adr-019-uuid.md`          | เพิ่ม ESLint blanket ban note                                                                           |
| `.agents/rules/01-adr-019-uuid.md`         | Synced ESLint blanket ban note                                                                          |
| `.devin/rules/08-development-flow.md`      | เพิ่ม ADR-047 ใน Migration Pipeline section + trigger table                                             |
| `.agents/rules/08-development-flow.md`     | Synced ADR-047 changes                                                                                  |
| `.agents/rules/14-context-aware-triggers.md` | เพิ่ม ADR-047 ใน "Migration refactor" trigger                                                          |
| `memory/project-memory-override.md`        | แก้ stale "Admin Desktop" ใน Key Environment Variables (OLLAMA_BASE_URL) + เพิ่ม D164                    |

## กฎที่ Lock แล้ว

- **D164 — AGENTS.md Documentation Drift Fix:** แก้ drift 5 จุดใน AGENTS.md (Commands section, ESLint parseInt scope, Admin Desktop→np-dms-lcbp3, skill count 21→35, ADR-047 reference); sync ไป `.agents/rules/` + `.devin/rules/`; version 1.9.13 → 1.9.14

## Verification

- [x] `grep` ยืนยันไม่มี stale "21 skill" หรือ "Admin Desktop" (นอก changelog) ใน AGENTS.md
- [x] `git diff -w` ยืนยันทุกการเปลี่ยนแปลงเป็น content-only (ไม่มี whitespace corruption)
- [x] `.agents/rules/` ↔ `.devin/rules/` sync ครบทุกไฟล์ที่แก้
- [x] ADR-047 ปรากฏใน Tier 3 + trigger tables ทั้ง 3 ไฟล์ (`.agents/rules/14`, `.agents/rules/08`, `.devin/rules/08`)
- [x] Commands & Verification section ระบุ trap ของ frontend `pnpm test` (watch mode) ชัดเจน
