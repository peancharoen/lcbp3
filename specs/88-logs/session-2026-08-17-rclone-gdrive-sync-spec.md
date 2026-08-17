# Session Log — Rclone Google Drive Sync Spec Migration

**Date:** 2026-08-17
**Topic:** Migrate `docs/Rclone gdrive sync setup.md` into `specs/100-Infrastructures/144-rclone-gdrive-sync/`
**Scope:** Documentation retro-fit (no source code changes)

## Summary

ย้าย runbook `docs/Rclone gdrive sync setup.md` (ที่ใช้งานจริงบน `np-dms-lcbp3` แล้ว) เข้าสู่ specs structure ตามรูปแบบ speckit ของโปรเจกต์ (อ้างอิง `143-mcp-infra-upgrade` เป็นต้นแบบ) สร้าง spec/plan/tasks/quickstart/checklist ครบ และ cross-link กับ `04-02-backup-recovery.md` (Offsite Backup section)

## ปัญหาที่พบ (Root Cause)

`docs/Rclone gdrive sync setup.md` เป็น runbook ที่ใช้งานจริงแต่อยู่นอก specs structure — ทำให้:
- Agent ในอนาคตไม่เจอเอกสารนี้ผ่าน `100-Infrastructures/` index
- ไม่มี cross-link กับ `04-02-backup-recovery.md` ที่พูดถึง Offsite Backup อย่างกว้าง ๆ
- ไม่มี formal spec/plan/tasks ตามรูปแบบ speckit ที่ใช้กันในโปรเจกต์

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/100-Infrastructures/144-rclone-gdrive-sync/spec.md` | สร้างใหม่ — formal spec 3 user stories (Backup P1, Specs sharing P2, Monitoring/Log P3) + NFRs + implementation notes |
| `specs/100-Infrastructures/144-rclone-gdrive-sync/plan.md` | สร้างใหม่ — implementation plan 8 phases + Constitution Check (ADR-016/010) + risks/mitigations + verification plan |
| `specs/100-Infrastructures/144-rclone-gdrive-sync/tasks.md` | สร้างใหม่ — 36 tasks ทั้งหมด mark `[X]` (implement จริงแล้ว) + success criteria tracking |
| `specs/100-Infrastructures/144-rclone-gdrive-sync/quickstart.md` | สร้างใหม่ — step-by-step 7 phases ที่อ้างอิงกลับไป runbook ต้นฉบับ (หลีกเลี่ยง single source of truth แตก) |
| `specs/100-Infrastructures/144-rclone-gdrive-sync/checklists/requirements.md` | สร้างใหม่ — spec quality + security (ADR-016) + observability (ADR-010) checklists |
| `specs/100-Infrastructures/README.md` | เพิ่ม list `144-rclone-gdrive-sync` และเติมรายการ 102-143 ที่ขาดหายไป |
| `specs/04-Infrastructure-OPS/04-02-backup-recovery.md` | อัปเดต Offsite Backup section ให้อ้างอิง spec ใหม่ + runbook ต้นฉบับ แทนคำว่า "optional" |

## กฎที่ Lock แล้ว

- **D108:** Rclone GDrive Offsite Backup — one-way sync เท่านั้น (ไม่ใช้ `bisync`); ห้าม sync `.env`/`.git` (ใช้ `--exclude`); ใช้ OAuth Client ของตัวเอง (ไม่ใช่ shared rclone client_id); รันในนาม user `np-dms` ผ่าน `sudo crontab -u np-dms -e` (ห้าม `sudo -u` ซ้อนใน crontab — `$HOME` ผิด → fail เงียบ ๆ); full path `/usr/bin/rclone` ใน crontab; Uptime Kuma Push Monitor (Tier 4) + logrotate weekly; 2 jobs: Backup repo 00:00 และ 12:00 ทุกวัน + Sync specs ทุก 4 ชม. 03/07/11/15/19/23.

## Verification

- [x] โครงสร้างไฟล์ตรงตาม convention ของ `100-Infrastructures/` (spec/plan/tasks/quickstart/checklists/requirements.md)
- [x] ทุกไฟล์มี `// File:` header และ `// Change Log:` ตามกฎ TypeScript §3 (เฉพาะ spec.md/plan.md — quickstart/tasks/checklist เป็น .md ล้วนตามต้นแบบ 143)
- [x] quickstart.md ใช้ relative links อ้างอิงกลับ `docs/Rclone gdrive sync setup.md` (ไม่คัดลอกเนื้อหาซ้ำ)
- [x] ไม่มี `any`, `console.log`, ไม่มี secret ในเอกสาร (push token ของ Uptime Kuma เป็น public push URL ตาม design — ไม่ใช่ secret)
- [x] `04-02-backup-recovery.md` Offsite Backup section อ้างอิง spec ใหม่
- [x] `100-Infrastructures/README.md` list 144 ครบ

## Architectural Impact

ไม่มี — เป็น documentation retro-fit ของ infrastructure runbook ที่ใช้งานจริงอยู่แล้ว เป้าหมายคือทำให้ spec นี้เข้าสู่ระบบ speckit structure เพื่อ cross-link กับ `04-02-backup-recovery.md` และให้ agent ในอนาคตเจอเอกสารนี้ผ่าน `100-Infrastructures/` ได้

## Risks & Follow-up

- **Token ใน tasks.md/quickstart.md**: push token ของ Uptime Kuma ถูกฝังในเอกสาร — หากต้องการ rotate ในอนาคต ต้องอัปเดตทั้ง crontab จริงและเอกสารนี้
- **`docs/Rclone gdrive sync setup.md` ยังคงอยู่**: คงไว้เป็น runbook ต้นฉบับและให้ quickstart.md อ้างอิงกลับ หากต้องการให้ย้ายเนื้อหาทั้งหมดมาที่ specs และลบไฟล์เดิม แจ้งได้
- **ไม่ได้ทำ cross-link กลับจาก `docs/MONITORING-PLAN.md`**: หากต้องการให้ MONITORING-PLAN.md อ้างอิง spec นี้ในส่วน Tier 4 แจ้งได้
