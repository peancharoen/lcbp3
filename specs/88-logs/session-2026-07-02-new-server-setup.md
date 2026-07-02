# Session 17 — 2026-07-02 (New Server Setup)

## Summary

ย้ายการทำงานจาก Windows (PowerShell) มายัง Linux server ใหม่ (`np-dms-lcbp3`) — ติดตั้ง pnpm, แปลง `2git.ps1` เป็น `2git.sh`, แก้ permission issues สำหรับ `pnpm install`, เพิ่ม GitHub SSH key และ remote

## ปัญหาที่พบ (Root Cause)

1. **`pnpm` ไม่ได้ติดตั้งบน Linux server** — มีแค่ `npm` 9.2.0
2. **`pnpm install` ค้าง 40+ นาที** — สาเหตุจริง: `frontend/node_modules` และ `.husky/_/` เป็นของ `root` (จากการ copy หรือ docker) ทำให้ pnpm ไม่สามารถ recreate ได้ → ค้างเงียบ
3. **Husky `prepare` script ล้มเหลว** — `.husky/_/husky.sh` เป็นของ root → `EACCES` ตอน unlink
4. **GitHub remote ไม่มีบน server ใหม่** — มีแค่ `origin` (Gitea)
5. **GitHub SSH key ไม่ได้เพิ่ม** — `Permission denied (publickey)`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `2git.sh` | สร้าง bash script ใหม่ แปลงจาก `2git.ps1` (PowerShell → bash) |
| `node_modules/`, `frontend/node_modules/`, `.husky/` | `sudo chown -R nattanin:nattanin` แก้ ownership |
| git remote | `git remote add github git@github.com:peancharoen/lcbp3.git` |
| GitHub SSH key | เพิ่ม `ssh-ed25519 ...nattanin@np-dms-lcbp3` ไป GitHub Settings |

## กฎที่ Lock แล้ว

- **OS Rules เปลี่ยน:** Server ใหม่เป็น Linux (Ubuntu/Debian) — ใช้ bash commands ได้ปกติ ไม่ต้องจำกัดเฉพาะ PowerShell เหมือนเดิม
- **2git.sh** ใช้แทน `2git.ps1` บน Linux — รองรับ argument สำหรับ commit message เหมือนเดิม
- **pnpm workspace** ต้องรัน `pnpm install` จาก root ไม่ใช่จาก `backend/` หรือ `frontend/` แยก
- **CI=true** ต้องใช้เมื่อรัน `pnpm install` แบบ non-interactive (ข้าม prompt ยืนยันลบ node_modules)

## Verification

- [x] `pnpm install` สำเร็จ (1648 packages, 3 workspace projects)
- [x] `git commit` ผ่าน husky pre-commit hook (lint-staged + tsc --noEmit)
- [x] `git push origin main` สำเร็จ (Gitea)
- [x] `git push github main` สำเร็จ (GitHub)
- [x] `2git.sh` ใช้งานได้ (executable, รองรับ argument)
