# Session 2026-08-19 — Uptime Kuma Status Page + CIFS Auto-remount

## Summary

ตั้งค่าให้ Devin สามารถอ่าน error จาก Uptime Kuma ได้โดยตรงผ่าน public Status Page API (slug `heartbeat`) และแก้ปัญหา CIFS mounts หลุดตั้งแต่ตอน boot ด้วย systemd automount ใน `/etc/fstab`

## ปัญหาที่พบ (Root Cause)

**Symptom:** ผู้ใช้สอบถามว่าสามารถอ่าน error จาก Uptime Kuma ที่ส่งเข้า Telegram ได้ไหม

**Discovery chain:**
1. ตรวจพบว่า environment นี้ไม่มี Telegram MCP server → อ่านจาก Telegram ไม่ได้
2. ลอง Uptime Kuma API ที่ `http://192.168.10.9:3001`:
   - `/metrics` → 401 (ต้องมี Bearer token ตั้งใน UI)
   - `/api/status-page/default` → 404 (Status Page ยังไม่ถูกสร้าง)
   - `/api/status-page/heartbeat/default` → 200 แต่ `heartbeatList` ว่าง
3. ผู้ใช้สร้าง Status Page slug `heartbeat` (ชื่อ "LCBP3 Internal") ใน Uptime Kuma UI
4. อ่าน `/api/status-page/heartbeat/heartbeat` สำเร็จ → พบ monitor 3 ตัว (CIFS Mount) ทั้งหมด `status=0` (PENDING) ตลอด 50 นาที
5. ตรวจสถานะ mount จริง: ทั้ง 3 ตัว NOT mounted
6. ตรวจ `dmesg`: `cifs_mount failed w/return code = -101` (`ENETUNREACH`) ที่ ~10s หลัง boot — network ยังไม่พร้อมตอน CIFS พยายาม mount
7. ตรวจ cron: `/etc/cron.d/np-dms-cifs-monitor` สร้างไว้ตั้งแต่ 31 ก.ค. และทำงานปกติทุกนาที (log 6.5MB) — push `down` เข้า Uptime Kuma ตลอด แต่ไม่มีใครดู

**Root Cause:** CIFS mounts หลุดทุกครั้งที่บู๊ตเพราะ network ยังไม่ up ทัน แม้ fstab มี `_netdev,nofail` ก็ตาม — `_netdev` รอ `network-online.target` แต่ CIFS ยังหลุดเพราะ network ไม่ stable พอ หลัง boot เสร็จ network กลับมาปกติ แต่ไม่มีอะไร remount อัตโนมัติ

## การแก้ไข (Fix)

### Phase 1: Manual remount (ops fix — ทันที)

| Action | ผล |
| --- | --- |
| `sudo mount -av` | remount CIFS ทั้ง 3 ตัวสำเร็จ (NAS reachable) |
| `sudo -u np-dms /opt/np-dms/scripts/push-monitors-cifs.sh` | push `up` เข้า Uptime Kuma → สถานะกลับเป็น UP |

### Phase 2: Auto-remount ตอน boot (systemd automount)

เปลี่ยน CIFS entries ใน `/etc/fstab` จาก "mount ตอน boot" เป็น "mount ตอนมีคน access ครั้งแรก" (lazy/automount) — ตอนนั้น network พร้อมแน่นอน

| ไฟล์ / Action | การเปลี่ยนแปลง |
| --- | --- |
| `/etc/fstab` | เพิ่ม `x-systemd.automount,x-systemd.mount-timeout=30` ใน 3 บรรทัด CIFS (temp, permanent, legacy) |
| `/etc/fstab.bak.20260819` | backup ก่อนแก้ |
| `sudo systemctl daemon-reload` | reload เพื่อให้ systemd-fstab-generator สร้าง automount units ใหม่ |

**Options ที่เพิ่ม:**
- `x-systemd.automount` — สร้าง automount unit (mount ตอน first access ไม่ใช่ตอน boot)
- `x-systemd.mount-timeout=30` — ถ้า mount ล้ม (network ยังไม่พร้อม) รอแค่ 30s ไม่ hang ตลอด

**วิธีการทำงานตอน boot ครั้งถัดไป:**
1. boot → network ขึ้น → `remote-fs.target` ทำงาน
2. `.automount` units start (แค่ตั้ง autofs trigger ไม่ mount จริง — ไม่ติด network ยังไม่พร้อม)
3. backend access `/mnt/asustor-uploads/*` → automount trigger → CIFS mount จริง (network พร้อมแล้ว)
4. ถ้า mount ล้ม → `TimeoutSec=30s` ไม่ hang ตลอด

### Phase 3: ยืนยัน cron ทำงานอยู่แล้ว

ไม่ต้องติดตั้งเพิ่ม — `/etc/cron.d/np-dms-cifs-monitor` สร้างไว้ตั้งแต่ 31 ก.ค. และทำงานปกติทุกนาที:

```
* * * * * np-dms /opt/np-dms/scripts/push-monitors-cifs.sh >> /opt/np-dms/logs/monitoring/cifs.log 2>&1
```

log ใน `cifs.log` มี entry ทุกนาที (6.5MB) — แค่เราไม่ได้ดู ทำให้ไม่รู้ว่า mount หลุดมานานแล้ว

## กฎที่ Lock แล้ว

| ID | Decision |
| --- | --- |
| UK-STATUS-1 | Uptime Kuma Status Page slug = `heartbeat` (ชื่อ "LCBP3 Internal") — public API ไม่ต้อง auth สำหรับ Devin อ่าน heartbeat |
| UK-STATUS-2 | Endpoint อ่าน heartbeat: `GET http://192.168.10.9:3001/api/status-page/heartbeat/heartbeat` (คืน `heartbeatList` + `uptimeList`) |
| UK-STATUS-3 | Endpoint อ่าน config: `GET http://192.168.10.9:3001/api/status-page/heartbeat` (คืน `config` + `publicGroupList` รายการ monitor) |
| CIFS-AUTOMOUNT-1 | CIFS entries ใน `/etc/fstab` ใช้ `x-systemd.automount,x-systemd.mount-timeout=30` — mount ตอน first access ไม่ใช่ตอน boot (แก้ network race ตอน boot) |
| CIFS-AUTOMOUNT-2 | ไม่ใช้ cron `@reboot mount -av` เพราะ automount ดีกว่า (lazy + ไม่ต้องระบุ delay ตายตัว) |
| CIFS-AUTOMOUNT-3 | ไม่เปลี่ยน `push-monitors-cifs.sh` เป็น auto-remount — ยังเป็น alert-only ตาม `CIFS-MON-1` (ป้องกัน data corruption จาก mount ผิด share) |

## Verification

- [x] Uptime Kuma UI reachable: `http://192.168.10.9:3001/api/entry-page` → HTTP 200
- [x] Status Page API: `/api/status-page/heartbeat/heartbeat` → HTTP 200, คืน heartbeat 3 monitor
- [x] Status Page config: `/api/status-page/heartbeat` → คืน `publicGroupList` รายการ monitor (id 22, 23, 24)
- [x] Manual remount: `mount -av` → ทั้ง 3 ตัว MOUNTED
- [x] Push script UP branch: `kuma=200` ทั้ง 3 ตัว, `mounted,write_ok` สำหรับ temp/permanent
- [x] fstab backup: `/etc/fstab.bak.20260819` สร้างก่อนแก้
- [x] fstab diff: เพิ่ม `x-systemd.automount,x-systemd.mount-timeout=30` ใน 3 บรรทัด CIFS
- [x] `systemctl daemon-reload` → exit 0
- [x] automount units generated: `mnt-asustor\x2d{uploads-temp,uploads-permanent,legacy}.automount` (loaded, generated)
- [x] automount units wired เข้า `remote-fs.target.wants/` (start ตอน boot หลัง network)
- [x] ทดสอบ automount จริง: `umount legacy` → `systemctl start legacy.automount` → `ls /mnt/asustor-legacy/` → MOUNTED อัตโนมัติ ✅
- [x] mount ปัจจุบันไม่กระทบ: temp/permanent ยังเป็น regular mount (จะใช้ automount ตอน reboot)
- [x] Uptime Kuma heartbeat หลัง fix: ทั้ง 3 monitor `status=UP`

## ไฟล์ที่สร้าง/แก้ไขทั้งหมด

**แก้ไข:**
- `/etc/fstab` — เพิ่ม `x-systemd.automount,x-systemd.mount-timeout=30` ใน 3 บรรทัด CIFS
- `/opt/np-dms-lcbp3/docs/MONITORING-PLAN-REV01.md` — เพิ่ม section "CIFS Auto-remount via systemd automount (2026-08-19)" + อัปเดต TODO

**สร้างใหม่:**
- `/etc/fstab.bak.20260819` — backup ก่อนแก้ fstab
- `/opt/np-dms-lcbp3/specs/88-logs/session-2026-08-19-uptime-kuma-status-page-cifs-automount.md` — session log นี้

**Uptime Kuma UI (สร้างโดยผู้ใช้):**
- Status Page slug `heartbeat` (ชื่อ "LCBP3 Internal") — publish แล้ว

## ข้อจำกัด / สิ่งที่ยังค้าง

- Status Page `heartbeat` มีแค่ CIFS monitor (Tier 4) — Tier 1-3 (Backend, Frontend, MariaDB, Redis, ES, Qdrant, Ollama, Gitea, n8n) ยังไม่ถูกเพิ่ม (ตาม TODO ใน `MONITORING-PLAN-REV01.md` section 10)
- `/metrics` ของ Uptime Kuma ยังต้อง Bearer token (ไม่ได้ใช้ เพราะใช้ Status Page API แทน)
- Telegram MCP server ยังไม่ได้ติดตั้ง — ถ้าต้องการอ่าน alert จาก Telegram ตรง ๆ ต้องติดตั้งเพิ่ม
- ยังไม่ได้ทดสอบ reboot จริง — automount ทดสอบด้วยการ `umount` + `systemctl start .automount` + access เท่านั้น (ต้อง reboot จริงเพื่อยืนยัน end-to-end ตอน boot)

## การดำเนินการถัดไป (Optional)

1. เพิ่ม Tier 1-3 monitor เข้าใน Status Page `heartbeat` (Backend, Frontend, MariaDB, Redis, ES, Qdrant, Ollama, Gitea, n8n)
2. ทดสอบ reboot จริงเพื่อยืนยัน automount ทำงาน end-to-end ตอน boot
3. ติดตั้ง logrotate สำหรับ `/opt/np-dms/logs/monitoring/cifs.log` (ตอนนี้ 6.5MB และโตทุกนาที)
