# Session 2026-08-24 — Solweaver Process Patterns Adoption (Phases 1-3)

## Summary

นำแนวคิด bounded worker contracts, evidence-based review, TDD evidence, และ durable cross-session ledger จาก public Solweaver repository มาปรับใช้กับ LCBP3 skill pack (`.agents/skills` และ `.devin/skills`) แบบ native โดยไม่แทนที่ Speckit pipeline ที่มีอยู่ แบ่งเป็น 3 phases และ commit ทั้งหมดแล้ว

## การแก้ไข (Fix / Add)

| ไฟล์ | การเปลี่ยนแปลง |
| ----- | --------------- |
| `_LCBP3-CONTRACTS.md` (`.agents` + `.devin`) | กำหนด worker task packet, reviewer evidence bar, TDD evidence format, durable assurance ledger |
| `107-speckit-implement/SKILL.md` (`.agents` + `.devin`) | บังคับ bounded task packet และ TDD evidence |
| `110-speckit-reviewer/SKILL.md` (`.agents` + `.devin`) | บังคับ evidence bar สำหรับ Critical/High findings |
| `112-speckit-security-audit/SKILL.md` (`.agents` + `.devin`) | ใช้ evidence bar กับ security findings |
| `security-review/SKILL.md` (`.agents` + `.devin`) | ใช้ evidence bar กับ security review |
| `104-speckit-plan/SKILL.md` (`.agents` + `.devin`) | ตัดสินใจสร้าง ledger สำหรับ cross-session/high-risk feature |
| `104-speckit-plan/templates/ledger-template.md` (`.agents` + `.devin`) | template ทั่วไป |
| `104-speckit-plan/templates/migration-ledger-template.md` (`.agents` + `.devin`) | template สำหรับ ADR-028 migration |
| `104-speckit-plan/templates/ai-pipeline-ledger-template.md` (`.agents` + `.devin`) | template สำหรับ ADR-023/ADR-042 AI pipeline |
| `105-speckit-tasks/SKILL.md` (`.agents` + `.devin`) | เพิ่ม ledger maintenance tasks และ TDD evidence links |
| `111-speckit-validate/SKILL.md` (`.agents` + `.devin`) | ตรวจ ledger status และ TDD evidence |
| `verification-loop/SKILL.md` (`.agents` + `.devin`) | Phase 8: Contract Compliance / Ledger Check |
| `resume-pending-work/SKILL.md` (`.agents` + `.devin`) | อ่าน assurance ledger ก่อนทำงานต่อ |
| `audit-skills.sh` | ขยาย `REQUIRED_CONTRACT_SKILLS` เป็น 9 skills |
| `audit-skills.ps1` | ขยาย `requiredContractSkills` เป็น 9 skills |

## กฎที่ Lock แล้ว

- Critical/High reviewer/security findings ต้องมี evidence ครบ: violated contract, reachable path, impact, file/line refs, evidence gap, fix
- TDD evidence ต้องบันทึกตอนทำงาน: RED → GREEN → REFACTOR; tests หลัง implement ไม่นับเป็น evidence ย้อนหลัง
- Cross-session/Tier 3/high-risk work ต้องใช้ durable assurance ledger ใน repo
- Protected boundaries (deploy, merge, migration, auth, AI boundary, data integrity) ห้าม cross ถ้า ledger ยัง open/blocked
- `.agents/skills` กับ `.devin/skills` ต้อง sync

## Commits

- `7727d7ab` — docs(skills): ผสาน Solweaver bounded contracts เข้า LCBP3 skill pack (Phases 1+2)
- `1a3c2bed` — docs(skills): ผสาน Solweaver ledger workflow เข้า Speckit pipeline (Phase 3)

## Verification

- `./.agents/scripts/bash/audit-skills.sh` ผ่าน: 35 skills healthy, contract reference audit ผ่านทั้ง 9 skills, version consistency ผ่าน, specs integrity ผ่าน
- `diff` ระหว่าง `.agents/skills` และ `.devin/skills` ตรงกันทุกไฟล์ที่แก้ไข
