// File: specs/100-Infrastructures/144-rclone-gdrive-sync/spec.md
// Change Log:
// - 2026-08-17: Initial specification — migrated from docs/Rclone gdrive sync setup.md
// - 2026-08-17: Update cron schedule to 00:00/12:00 and 03/07/11/15/19/23 to match deployed crontab

# Feature Specification: Rclone Google Drive Sync — Offsite Repo Backup & Specs Sharing

**Feature Branch**: `144-rclone-gdrive-sync`
**Created**: 2026-08-17
**Status**: Implemented
**Category**: 100-Infrastructures
**Source**: `docs/Rclone gdrive sync setup.md` (runbook ที่ใช้งานจริงบน `np-dms-lcbp3` แล้ว)
**Input**: User description: "ตั้ง sync ระหว่าง repo `/opt/np-dms-lcbp3` กับ Google Drive ผ่าน rclone — (1) backup repo ทั้งหมด เวลา 00:00 และ 12:00 ทุกวัน, (2) แชร์ folder specs/docs กับทีมทุก 4 ชม. (03:00, 07:00, 11:00, 15:00, 19:00, 23:00)"

## บทสรุป

ติดตั้งและตั้งค่า rclone เพื่อ sync ข้อมูลจากเครื่อง `np-dms-lcbp3` (192.168.10.11) ไป Google Drive แบบ one-way ในนาม user `np-dms` ผ่าน cron สอง job:

- **Job A — Backup repo**: `rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo` เวลา 00:00 และ 12:00 ทุกวัน (exclude `.git`, `node_modules`, `dist`, `.env`)
- **Job B — Sync specs/docs**: `rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs` เวลา 03:00, 07:00, 11:00, 15:00, 19:00, 23:00 ทุกวัน

ทั้งสอง job ผูกกับ Uptime Kuma Push Monitor (Tier 4 ตาม `docs/MONITORING-PLAN.md`) เพื่อ alert เมื่อ sync ล้มเหลว และมี logrotate คุมขนาด log ที่ `/var/log/rclone/`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Backup Repo ไป Google Drive รายวัน (Priority: P1)

As a DevOps administrator, I need the entire LCBP3-DMS repository (`/opt/np-dms-lcbp3`) to be backed up to Google Drive daily so that we have an offsite backup in case the compute server or local NAS fails.

**Why this priority**: Offsite backup เป็นกลไกสำคัญใน disaster recovery (อ้างอิง `04-Infrastructure-OPS/04-02-backup-recovery.md` "Offsite Backup" section) — หากเครื่อง `np-dms-lcbp3` หรือ ASUSTOR/QNAP เสีย ต้องสามารถกู้ repo กลับมาได้

**Independent Test**: รัน `rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ... -v` ด้วยตนเอง แล้วตรวจด้วย `rclone size gdrive:backups/lcbp3-repo` ว่าได้ขนาดที่ไม่ใช่ 0 และไม่มี `.env`/`.git` หลุดไป

**Acceptance Scenarios**:

1. **Given** rclone ติดตั้งและ config remote `gdrive` แล้ว, **When** รัน `rclone lsd gdrive:`, **Then** ระบบแสดงรายชื่อ folder ใน Google Drive โดยไม่มี error
2. **Given** remote `gdrive` ใช้งานได้, **When** รัน `rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" --dry-run -v`, **Then** dry-run log ไม่แสดงการ transfer ของ `.git/`, `node_modules/`, `dist/`, หรือ `.env`
3. **Given** dry-run ผ่าน, **When** รัน sync จริง, **Then** `rclone size gdrive:backups/lcbp3-repo` รายงานขนาด > 0 และ `rclone ls gdrive:backups/lcbp3-repo --include ".env"` คืนผลลัพธ์ว่าง (ไม่มี `.env` หลุดไป)
4. **Given** cron job ของ user `np-dms` มี Job A ตั้งเวลา 00:00 และ 12:00 ทุกวัน, **When** ตรวจ `sudo crontab -u np-dms -l`, **Then** พบบรรทัด Job A ครบทั้ง exclude flags + log-file + Uptime Kuma push
5. **Given** Job A รันสำเร็จ, **When** ตรวจ Uptime Kuma monitor `rclone - Backup repo`, **Then** heartbeat ล่าสุดมีสถานะ "Up" และเวลาตรงกับการรัน

---

### User Story 2 - แชร์ Specs/Docs กับทีมผ่าน Google Drive (Priority: P2)

As a project lead, I need the `specs/` folder shared to Google Drive every 4 hours so that team members without direct repo access can read the latest specifications and ADRs.

**Why this priority**: การแชร์ specs/docs ช่วยให้ทีมอ่านเอกสารล่าสุดได้โดยไม่ต้อง clone repo ทั้งหมด — เป็น one-way sync (ทีมไม่ควรแก้ไฟล์บน Drive แล้วคาดหวังให้ sync กลับ)

**Independent Test**: รัน `rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs -v` แล้วเปิดดูใน Google Drive ว่าโครงสร้าง folder `lcbp3-specs/` ตรงกับ local

**Acceptance Scenarios**:

1. **Given** remote `gdrive` ใช้งานได้, **When** รัน `rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs --dry-run -v`, **Then** dry-run แสดงการ transfer เฉพาะไฟล์ใต้ `specs/` เท่านั้น
2. **Given** dry-run ผ่าน, **When** รัน sync จริง, **Then** โครงสร้าง folder ใน `gdrive:shared/lcbp3-specs` ตรงกับ local `specs/`
3. **Given** cron job ของ user `np-dms` มี Job B ตั้งเวลา 03:00, 07:00, 11:00, 15:00, 19:00, 23:00, **When** ตรวจ `sudo crontab -u np-dms -l`, **Then** พบบรรทัด Job B ครบทั้ง log-file + Uptime Kuma push
4. **Given** Job B รันสำเร็จ, **When** ตรวจ Uptime Kuma monitor `rclone - Specs sync`, **Then** heartbeat ล่าสุดมีสถานะ "Up"

---

### User Story 3 - Monitoring & Log Management (Priority: P3)

As a DevOps administrator, I need rclone sync failures to alert via Uptime Kuma and log files to rotate so that I am notified of issues and the disk is not filled by growing logs.

**Why this priority**: การ monitor และจัดการ log เป็น cross-cutting concern ที่ทำให้ Job A/B สามารถ trust ได้ในระยะยาว — ไม่งั้น sync อาจ fail แบบเงียบ ๆ โดยไม่มีใครรู้

**Independent Test**: รัน `sudo logrotate -f /etc/logrotate.d/rclone` แล้วตรวจ `ls -la /var/log/rclone/` ว่ามีไฟล์ `.1.gz` ถูกสร้างขึ้น

**Acceptance Scenarios**:

1. **Given** Push Monitor สองตัวถูกสร้างใน Uptime Kuma (`rclone - Backup repo`, `rclone - Specs sync`), **When** ตรวจ Push URL ของแต่ละ monitor, **Then** ได้ URL รูปแบบ `https://uptime.np-dms.work/api/push/<token>?status=up&msg=OK&ping=`
2. **Given** crontab มี `&& curl ... status=up || curl ... status=down` ต่อท้ายทุก job, **When** sync สำเร็จ, **Then** Uptime Kuma บันทึก heartbeat "Up"; **When** sync ล้มเหลว, **Then** Uptime Kuma บันทึก heartbeat "Down" พร้อม `msg=rclone_failed`
3. **Given** `/etc/logrotate.d/rclone` มี config `weekly rotate 4 compress missingok notifempty`, **When** รัน `sudo logrotate -d /etc/logrotate.d/rclone`, **Then** syntax dry-run ผ่านโดยไม่มี error
4. **Given** logrotate config ถูกต้อง, **When** รัน `sudo logrotate -f /etc/logrotate.d/rclone`, **Then** ไฟล์ log เดิมถูกหมุนเป็น `.1.gz` และไฟล์ log ใหม่ถูกสร้างขึ้น
5. **Given** Notification channel (Telegram Bot / Email) ผูกกับ monitor แล้ว, **When** sync ล้มเหลว, **Then** admin ได้รับการแจ้งเตือน

---

## Non-Functional Requirements

### Security
- **ห้าม sync `.env`** และไฟล์ secret อื่น ๆ — ใช้ `--exclude ".env"` เสมอ (สอดคล้องกับ ADR-016 Security)
- **ห้าม sync `.git/`** — ป้องกัน history และ git objects หลุดไปยัง Drive
- **OAuth Client เป็นของตัวเอง** (project `lcbp3-dms`) ไม่ใช้ shared client_id ของ rclone เพื่อหลีกเลี่ยง Google rate limit
- **Test users** ใน OAuth consent screen ต้องระบุ email ที่ใช้ authorize ไว้ชัดเจน
- **Token เก็บใน `~/.config/rclone/rclone.conf`** ของ user `np-dms` เท่านั้น

### Reliability
- **One-way sync เท่านั้น** — ไม่ใช้ `bisync` เพราะทีมไม่ควรแก้ไฟล์บน Drive แล้วคาดหวังให้ sync กลับเข้า repo (workflow การแก้โค้ด/เอกสารต้องผ่าน Gitea)
- **Full path `/usr/bin/rclone`** ใน crontab เพราะ cron ไม่โหลด `$PATH` แบบ shell ปกติ
- **รันในนาม user `np-dms`** ผ่าน `sudo crontab -u np-dms -e` — ห้ามรันผ่าน `sudo -u np-dms` ซ้อนใน crontab เพราะจะทำให้ `$HOME` ไม่ถูกต้อง ทำให้ rclone หา config ไม่เจอและ fail แบบเงียบ ๆ

### Observability
- **Log file** ที่ `/var/log/rclone/backup.log` และ `/var/log/rclone/specs.log` ระดับ INFO
- **Logrotate** ที่ `/etc/logrotate.d/rclone` (weekly, rotate 4, compress)
- **Uptime Kuma Push Monitor** (Tier 4 ตาม `docs/MONITORING-PLAN.md`) — push สถานะหลัง sync เสร็จทุกครั้ง

### Operational
- **Cron schedule**:
  - Job A (Backup repo): `0 0,12 * * *` (00:00 และ 12:00 ทุกวัน)
  - Job B (Sync specs): `0 3,7,11,15,19,23 * * *` (ทุก 4 ชม.)
- **Exclude patterns (Job A)**: `.git/**`, `node_modules/**`, `dist/**`, `.env`
- **Retention**: ควบคุมโดย Google Drive เอง (ไม่มี retention policy เฉพาะ rclone) — ดู `04-02-backup-recovery.md` สำหรับ retention ของ backup อื่น ๆ

---

## Implementation Notes

### สถาปัยกรรมการ sync

```
np-dms-lcbp3 (192.168.10.11)
└── /opt/np-dms-lcbp3/                ──┐
    ├── (repo ทั้งหมด)                  │ Job A (00:00, 12:00 daily)
    │   exclude: .git, node_modules,    │   → gdrive:backups/lcbp3-repo
    │            dist, .env             │
    └── specs/                          ──┘
                                        ──┐ Job B (03/07/11/15/19/23 ทุก 4 ชม.)
                                          │   → gdrive:shared/lcbp3-specs
                                          ──┘
                                              ↓
                                    Uptime Kuma Push Monitor
                                    (https://uptime.np-dms.work)
```

### การ authenticate บน headless server

เนื่องจาก server เป็น headless (ไม่มี browser) ต้องใช้เทคนิค "authorize บนเครื่อง Windows ที่มี browser แล้ว copy token กลับมา paste ที่ server" — ดูรายละเอียดใน `quickstart.md` §3

### การเลือกใช้ OAuth Client ของตัวเอง

Shared client_id ของ rclone (default) โดน Google rate limit บ่อยเพราะผู้ใช้ทั่วโลกใช้ client_id เดียวกัน — ไม่เหมาะกับงาน cron ที่รันต่อเนื่อง จึงสร้าง OAuth Client ของตัวเองใน Google Cloud project `lcbp3-dms` (Drive API ถูก enable ไว้แล้ว)

### การเลือกใช้ Push Monitor แทน Active Monitor

Push/passive monitor เหมาะกับ cron job เพราะ:
- cron ยิง HTTP request บอกสถานะไปหา Uptime Kuma หลัง sync เสร็จ
- ถ้า cron ไม่ยิง (เช่น server ดับ) Uptime Kuma จะ alert ตาม Heartbeat Interval ที่ตั้งไว้
- ไม่ต้องเปิด port ให้ Uptime Kuma เข้ามา poll

### ข้อควรระวังเฉพาะ

1. **อย่า copy ทั้ง URL ที่ Uptime Kuma แสดงมาเต็ม ๆ** (ซึ่งมี `?status=up&msg=OK&ping=` ติดมาอยู่แล้ว) มาต่อ query string เพิ่มอีกชุด — จะกลายเป็น URL ซ้อนกันสองชุดและได้ error 404 ใช้แค่ `<base URL>?status=up&msg=...` เท่านั้น
2. **อย่ารันผ่าน `sudo -u np-dms` ซ้อนใน crontab** ถ้า login เป็น user นั้นอยู่แล้ว — `$HOME` จะไม่ถูกต้อง ทำให้ rclone หา config ไม่เจอและ fail แบบเงียบ ๆ (exit code 1 โดยไม่มี error message และ log ว่างเปล่า)
3. **ต้องเพิ่ม email ใน Test users** ของ OAuth consent screen ไม่งั้นจะเจอ `403: access_denied` ตอน login ผ่าน browser

---

## Related Documents

- `docs/Rclone gdrive sync setup.md` — runbook ต้นฉบับ (ที่ใช้งานจริง)
- `specs/100-Infrastructures/144-rclone-gdrive-sync/quickstart.md` — คู่มือ step-by-step
- `specs/04-Infrastructure-OPS/04-02-backup-recovery.md` — Backup & Disaster Recovery (Offsite Backup section)
- `docs/MONITORING-PLAN.md` — Uptime Kuma Tier 4 monitoring strategy
- `specs/06-Decision-Records/ADR-016-*.md` — Security (secret handling)
- `specs/06-Decision-Records/ADR-010-*.md` — Logging & Monitoring strategy
