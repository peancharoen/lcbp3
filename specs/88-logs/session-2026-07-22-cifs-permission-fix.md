# Session — 2026-07-22 (CIFS Permission Fix for Backend Container)

## Summary

แก้ปัญหา `EACCES: permission denied` เมื่อ backend container (user `nestjs` uid=1001) เขียนไฟล์ไปยัง CIFS mount (`/mnt/asustor-uploads/temp` และ `/permanent`) ที่ mount จาก ASUSTOR NAS — ปัญหาทำให้ OCR Sandbox API (`POST /ai/admin/sandbox/ocr`) คืน 400 Bad Request เพราะ `FileStorageService.upload()` ไม่สามารถ `fs.writeFile` ได้

## ปัญหาที่พบ (Root Cause)

CIFS mount ใน `/etc/fstab` ใช้ `uid=1000,gid=1000` แต่ backend container รันด้วย `uid=1001(nestjs), gid=65533(nogroup)`:

| จุด | uid | gid | เขียนได้? |
|---|---|---|---|
| Host (user `np-dms`) | 1000 | 1000 | ✅ (เป็น owner ของ mount point) |
| Host (`sudo -u #1001`) | 1001 | 1001 | ✅ |
| Container `backend` | **1001** | **65533** (nogroup) | ❌ |

CIFS `dir_mode=0755` (default) ทำให้:
- Owner (uid 1001): rwx ✅ — container มี uid ตรง
- Group (gid 1001): r-x ❌ — container gid 65533 ≠ 1001
- Other: r-x ❌

Container ตกเป็น "other" เพราะ gid ไม่ตรง → ไม่มีสิทธิ์เขียน

**สาเหตุเพิ่มเติม:** แม้เปลี่ยน fstab และ remount แล้ว  container ยังใช้ mount namespace เดิม (สร้างตอน container start) — ต้อง `docker restart backend` เพื่อให้เห็น mount options ใหม่

## การแก้ไข (Fix)

### 1. แก้ `/etc/fstab` — CIFS mount options

เปลี่ยนจาก:
```
uid=1000,gid=1000,vers=3.0
```
เป็น:
```
uid=1001,gid=1001,noperm,file_mode=0777,dir_mode=0777,vers=3.0
```

สำหรับ `asustor-uploads/temp` และ `asustor-uploads/permanent` (เฉพาะ uploads — legacy mount ยังคง uid=1000,gid=1000 เพราะ read-only)

- `uid=1001,gid=1001` — ตรงกับ container user `nestjs`
- `noperm` — ข้าม local POSIX permission check ให้ SMB server คุมสิทธิ์แทน
- `file_mode=0777,dir_mode=0777` — บังคับ permission ที่ CIFS client รายงาน (ไม่ใช่ permission จริงบน ASUSTOR — สิทธิ์จริงยังคุมด้วย SMB share permission)

### 2. Remount + Restart container

```bash
sudo systemctl daemon-reload
sudo umount /mnt/asustor-uploads/temp /mnt/asustor-uploads/permanent
sudo mount -a
docker restart backend
```

### 3. อัปเดต MIGRATION-PLAN.md

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `/etc/fstab` | `uid=1000,gid=1000` → `uid=1001,gid=1001,noperm,file_mode=0777,dir_mode=0777` สำหรับ uploads mounts |
| `MIGRATION-PLAN.md` (Section 0.14) | อัปเดต CIFS mount commands ให้ตรงกับ fstab จริง |
| `MIGRATION-PLAN.md` (Section 0.15) | เพิ่ม container write test: `docker exec backend touch /app/uploads/temp/.test` |

## กฎที่ Lock แล้ว

- CIFS uploads mount ต้องใช้ `uid=1001,gid=1001` ตรงกับ backend container user `nestjs` (Dockerfile UID 1001)
- ต้องมี `noperm,file_mode=0777,dir_mode=0777` เพื่อป้องกัน GID mismatch (container gid=65533 vs mount gid=1001)
- หลังเปลี่ยน CIFS mount options ต้อง `docker restart` container เพื่อรับ mount namespace ใหม่
- Legacy mount (read-only) ยังคง `uid=1000,gid=1000` เพราะไม่ต้องเขียน

## Verification

- [x] Host write test: `touch /mnt/asustor-uploads/temp/.host-test` → OK
- [x] Host uid=1001 write test: `sudo -u '#1001' touch /mnt/asustor-uploads/temp/.uid1001-test` → OK
- [x] Container `stat /app/uploads/temp` หลัง restart: `Uid: 1001, Gid: 1001, Access: 0777` ✅
- [x] Container write test: `docker exec backend touch /app/uploads/temp/.perm-test` → **WRITE OK**
