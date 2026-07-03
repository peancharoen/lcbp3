# Session — 2026-07-03 (Deploy Permission Fix)

## Summary

แก้ปัญหา CI deploy ล้มเหลวด้วย `Permission denied` เมื่อ `cp` พยายามเขียนทับ `docker-compose.yml` ใน runtime dir ที่ root เป็นเจ้าของ เพิ่ม ownership guard + เปลี่ยน `cp` เป็น `install` เพื่อป้องกันระยะยาว

## ปัญหาที่พบ (Root Cause)

- ไฟล์ `docker-compose.yml` ใน `/opt/np-dms/{01-infrastructure,02-platform,03-application}/` เป็นของ `root:root` (สร้างตอน initial server setup โดย root)
- CI deploy รันในชื่อ user `np-dms` (uid=1001)
- `cp` พยายามเขียนทับไฟล์ที่ root เป็นเจ้าของ → Permission denied (ต้องการ file write permission ไม่ใช่ directory write permission)
- Directory เป็นของ `np-dms:np-dms` แต่ไฟล์ข้างในเป็นของ `root:root`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `scripts/deploy.sh` | เพิ่ม step `[0/4]` ownership guard — ตรวจสอบ owner ของ runtime compose files ทุกชั้นก่อน deploy; เปลี่ยน `cp` → `install -m 644` (สร้างไฟล์ใหม่เสมอ ใช้ directory write permission) |
| `scripts/rollback.sh` | เพิ่ม step `[0/4]` ownership guard เดียวกัน |
| Server (one-time) | `sudo chown np-dms:np-dms /opt/np-dms/{01-infrastructure,02-platform,03-application}/docker-compose.yml` |

## กฎที่ Lock แล้ว

- **D34:** Deploy/rollback scripts ต้องมี ownership guard ตรวจสอบ runtime compose files ก่อนดำเนินการ และใช้ `install` แทน `cp` เพื่อหลีกเลี่ยง Permission denied จาก root-owned files

## Verification

- [x] Ownership guard ทำงาน — แสดง error พร้อมคำสั่งแก้ไขเมื่อพบ wrong ownership
- [x] `install -m 644` สร้างไฟล์ใหม่สำเร็จ (ใช้ directory write permission ไม่ใช่ file write)
- [x] ไฟล์ทั้ง 3 layers ถูก `chown` เป็น `np-dms:np-dms` แล้วบน server
- [ ] CI deploy สำเร็จหลัง push commit นี้
