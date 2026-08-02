# Session 2026-08-01 #3 — copy-env.sh Backup Retention + Deploy Workflow Clarification

## Summary

(1) เพิ่ม backup retention ให้ `copy-env.sh` เก็บเฉพาะ 2 ไฟล์ล่าสุด (ลบของเก่าอัตโนมัติ)
(2) อธิบาย workflow การ deploy `/opt/np-dms/03-application` — กรณีไหนใช้ `docker compose up -d`,
กรณีไหนต้อง build ใหม่ผ่าน `deploy.sh`

## ปัญหาที่พบ (Root Cause)

### Issue 1: copy-env.sh สะสม backup ไม่จำกัด

- **สาเหตุ:** `copy_file()` และ `copy_dir()` สร้าง `.bak.<TIMESTAMP>` ทุกครั้งที่รัน โดยไม่มี cleanup
- **อาการ:** ไฟล์ backup สะสมเรื่อยๆ ตามจำนวนครั้งที่รัน script (disk waste)
- **ผลกระทบ:** พบใน `/opt/np-dms/03-application/` มี backup 2 ไฟล์หลังรัน 2 ครั้ง — จะเพิ่มขึ้นเรื่อยๆ

### Issue 2: สงสัยว่าจะ deploy Layer 3 ยังไง

- compose ใช้ `image: lcbp3-backend:${BACKEND_IMAGE_TAG:-latest}` (ไม่มี `build:` section)
- ถ้าแก้ code แล้วรันแค่ `docker compose up -d` จะใช้ image เดิม → code ใหม่ไม่เข้า
- ต้อง build ใหม่ก่อน → ใช้ `deploy.sh` (ADR-015: tag git SHA + auto-rollback + retention)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `/opt/np-dms/copy-env.sh` | เพิ่มตัวแปร `KEEP_BACKUPS=2` + ฟังก์ชัน `cleanup_backups()` ที่ใช้ `find -printf '%T@ %p'` เรียงตาม mtime (ใหม่→เก่า) แล้วลบไฟล์ที่เกินจำนวนที่กำหนด; เรียกใน `copy_file` หลัง copy สำเร็จ และใน `copy_dir` สำหรับทุกไฟล์ที่ backup ในรอบนั้น |

### Deploy Workflow Matrix (clarification, ไม่มีการแก้ code)

| สถานการณ์ | วิธีที่ถูก | เหตุผล |
|---|---|---|
| เปลี่ยนเฉพาะ `.env` / compose file | `docker compose --env-file ../.env up -d` | env inject ตอน container start |
| แก้ code backend/frontend | `deploy.sh` (build + restart) | `up -d` ใช้ image เดิม ไม่มี code ใหม่ |
| แก้ code + ต้องการ rollback | `deploy.sh` เท่านั้น | ADR-015: tag git SHA + auto-rollback |
| หลัง host reboot | `dockerup.sh` หรือ `up -d` ตรงๆ | ใช้ image เดิม |

## กฎที่ Lock แล้ว

- **D68: Backup Retention Pattern** — script ที่สร้าง `.bak.<TIMESTAMP>` ต้องมี cleanup logic
  เก็บเฉพาะ N ไฟล์ล่าสุด (configurable via `KEEP_BACKUPS`); ใช้ `find -printf '%T@ %p'` +
  `sort -rn` เรียงตาม mtime (แม่นยำกว่า parsing timestamp ในชื่อไฟล์); ต้อง log `[PURGE]`
  สำหรับทุกไฟล์ที่ถูกลบ; ต้องไม่ cleanup ถ้า copy ล้มเหลว (รักษา backup ที่มีอยู่)
- **D69: Layer 3 Deploy Decision** — `03-application/docker-compose.yml` ใช้ `image:` (ไม่มี `build:`)
  ดังนั้น `docker compose up -d` เพียงพอเฉพาะกรณีเปลี่ยน env/compose; ถ้าแก้ code ต้องใช้
  `deploy.sh` (build + tag SHA + health check + auto-rollback ตาม ADR-015); ห้ามใช้ `up -d`
  เพื่อ deploy code ใหม่เด็ดขาด

## Verification

- [x] `bash -n /opt/np-dms/copy-env.sh` — Syntax OK
- [x] ตรวจสอบ backup ที่มีอยู่ใน `/opt/np-dms/03-application/` — มี 2 ไฟล์ (ตรงตาม `KEEP_BACKUPS=2`)
- [x] อ่าน `deploy.sh` + `docker-compose.yml` ยืนยันว่าใช้ `image:` (ไม่มี `build:`) → ต้อง build ผ่าน deploy.sh
