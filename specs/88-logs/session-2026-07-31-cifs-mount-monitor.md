# Session 2026-07-31 — CIFS Mount Monitor + Telegram Alert

## Summary

แก้ bug HTTP 400 ที่ `/api/ai/admin/sandbox/ocr` (root cause: CIFS mounts หลุด → EACCES ใน backend container) และเพิ่ม CIFS mount monitoring script + Telegram notification channel ใน Uptime Kuma เพื่อป้องกัน bug ซ้ำ

## ปัญหาที่พบ (Root Cause)

**Symptom:** `POST /api/ai/admin/sandbox/ocr` คืน HTTP 400 — `BadRequestException: File upload failed`

**Root Cause Chain:**
1. `FileStorageService.upload` โยน `BadRequestException: File upload failed` เพราะ `fs.writeFile` ไปที่ `/app/uploads/temp` ล้มเหลวด้วย **`EACCES: permission denied`**
2. ตรวจใน backend container: `/app/uploads/temp` เป็น `root:root` mode 755 ทั้งที่ container รันเป็น user `nestjs` (uid=1001)
3. **สาเหตุเชิงโครงสร้าง:** ASUSTOR CIFS mounts (`/mnt/asustor-uploads/{temp,permanent}` + `/mnt/asustor-legacy`) ไม่ได้ถูก mount อยู่ ทั้งที่ `/etc/fstab` มี entry แล้ว (มี `nofail,_netdev` ทำให้ boot ผ่านแม้ NAS ไม่พร้อม)
4. Docker bind-mount `/mnt/asustor-uploads/temp → /app/uploads/temp` เลย bind ไปที่ local dir ว่างของ root แทน CIFS share → container เขียนไม่ได้

## การแก้ไข (Fix)

### Phase 1: Bugfix (ops fix — ไม่มี code change)

| ไฟล์ / Action | การเปลี่ยนแปลง |
| -------------- | ---------------- |
| `sudo mount /mnt/asustor-uploads/{temp,permanent,legacy}` | Mount CIFS shares คืน (NAS reachable, cred file ครบ) |
| `docker restart backend` | Restart container เพื่อให้ bind-mount ใหม่เข้า CIFS share (mount namespace ไม่ propagate mount ใหม่เข้า container เดิม) |

**ผล:** `/app/uploads/{temp,permanent}` กลายเป็น `nestjs:nestjs` mode 0777, write test ผ่าน

### Phase 2: CIFS Mount Monitor Script

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------- |
| `/opt/np-dms/scripts/push-monitors-cifs.sh` | สร้าง script ตรวจ CIFS mounts ทุกนาที + push สถานะไป Uptime Kuma (alert-only, ไม่ auto-remount) |
| `/opt/np-dms/scripts/.cifs-monitor.env` | สร้าง config file (KUMA_BASE, CURL_TIMEOUT, MOUNTS, WRITABLE_MOUNTS, TOKEN_MAP) — permission 600 (มี push token = secret) |
| `/etc/cron.d/np-dms-cifs-monitor` | สร้าง cron รันทุกนาทีเป็น user `np-dms` |
| `/opt/np-dms/logs/monitoring/cifs.log` | log output (cron เขียนต่อท้าย) |

**Script behavior:**
- ตรวจ `mountpoint -q` สำหรับ 3 mounts
- ตรวจ write permission เพิ่มสำหรับ temp/permanent (`touch` + `rm` test file) — จับได้ทั้งกรณี mount หลุด และกรณี mount ขึ้นแต่ permission ผิด
- Push ไป Uptime Kuma ด้วย token จริงจาก `TOKEN_MAP` (ทางเลือก A)
- ถ้า mount path ไม่มีใน TOKEN_MAP → log `[SKIP]` + exit 1

### Phase 3: Telegram Notification Channel (Uptime Kuma UI — ผ่าน Playwright)

| Action | รายละเอียด |
| -------------- | ---------------- |
| สร้าง notification channel | "NP-DMS Telegram Alert" (type: Telegram, Bot: @npdms_alert_bot, Chat ID: -1003715908854 = group "np-dms-lcbp3") |
| เชื่อม channel → monitor 3 ตัว | CIFS Mount — uploads/temp (ID 22), uploads/permanent (ID 23), legacy (ID 24) |
| ตั้งค่า monitor | Heartbeat Interval: 300-309s → **60s** (ตรงกับ cron), Retries: 3, Retry Interval: 20s |
| ทดสอบ alert จริง | ลด retries เป็น 1 ชั่วคราว → push down → Kuma mark DOWN at 14:24:43 → push up → Kuma mark UP at 14:25:02 → ตั้ง retries กลับเป็น 3 |

### Phase 4: Documentation Update

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------- |
| `docs/MONITORING-PLAN-REV01.md` | เพิ่ม section "CIFS Mount Monitor — Implementation (2026-07-31)" พร้อม push tokens จริง + ขั้นตอนถัดไป |

## กฎที่ Lock แล้ว

| ID | Decision |
| --- | --- |
| CIFS-MON-1 | CIFS mount monitor = **alert-only** (ไม่ auto-remount) — ต้องมี human intervention เพื่อ mount คืน (ป้องกัน data corruption จาก mount ผิด share) |
| CIFS-MON-2 | Push token = secret → เก็บใน `.cifs-monitor.env` permission 600 ไม่ commit ใน repo |
| CIFS-MON-3 | ใช้ token จริงจาก Uptime Kuma (TOKEN_MAP) ไม่ใช้ convention token (ทางเลือก A) — ง่ายกว่า ไม่ต้องแก้ SQLite |
| CIFS-MON-4 | Heartbeat Interval = 60s ตรงกับ cron ทุกนาที (ตั้งใน Uptime Kuma UI ทุก monitor) |
| CIFS-MON-5 | ตรวจ write permission เพิ่มสำหรับ temp/permanent (ไม่ใช่แค่ mountpoint) — จับกรณี mount ขึ้นแต่ permission ผิด (เหมือน bug ที่แก้) |

## Verification

- [x] Bug fix: `docker exec backend touch /app/uploads/temp/.write-test` → CONTAINER WRITE OK
- [x] Script UP branch: ทุก mount `kuma=200` (ก่อนหน้านี้เป็น 404)
- [x] Script DOWN branch: จำลองด้วย path ที่ไม่ใช่ mountpoint → `[DOWN] not_mounted` + exit 1
- [x] Script SKIP branch: path ที่ไม่มีใน TOKEN_MAP → `[SKIP]` + exit 1
- [x] Cron รันจริง: log มี 10+ รอบ (ทุกนาที)
- [x] Uptime Kuma Test notification → "Sent Successfully"
- [x] Alert จริง: Kuma บันทึก DOWN event (1 down จาก 14 checks) + UP event หลัง push up คืน
- [x] Telegram bot ส่งข้อความได้ (test message ตรงๆ API ผ่าน)

## ไฟล์ที่สร้าง/แก้ไขทั้งหมด

**สร้างใหม่:**
- `/opt/np-dms/scripts/push-monitors-cifs.sh` (5130 bytes, exec 755)
- `/opt/np-dms/scripts/.cifs-monitor.env` (1725 bytes, perm 600)
- `/etc/cron.d/np-dms-cifs-monitor` (591 bytes, perm 644)
- `/opt/np-dms/logs/monitoring/cifs.log` (auto-generated by cron)

**แก้ไข:**
- `/opt/np-dms-lcbp3/docs/MONITORING-PLAN-REV01.md` (เพิ่ม section CIFS Mount Monitor Implementation)

**Uptime Kuma UI (ผ่าน Playwright):**
- Notification channel: "NP-DMS Telegram Alert"
- Monitor 22, 23, 24: เชื่อม channel + ตั้ง Heartbeat Interval=60s
