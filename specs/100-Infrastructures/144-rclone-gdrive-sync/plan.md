// File: specs/100-Infrastructures/144-rclone-gdrive-sync/plan.md
// Change Log:
// - 2026-08-17: Initial implementation plan — migrated from docs/Rclone gdrive sync setup.md

# Implementation Plan: Rclone Google Drive Sync — Offsite Repo Backup & Specs Sharing

**Branch**: `144-rclone-gdrive-sync` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification for syncing the LCBP3-DMS repo and `specs/` folder to Google Drive via rclone (one-way, cron-scheduled, Uptime Kuma-monitored)

## Summary

ติดตั้ง rclone บนเครื่อง `np-dms-lcbp3` (192.168.10.11) และตั้งค่า remote `gdrive` โดยใช้ OAuth Client ของตัวเองใน Google Cloud project `lcbp3-dms` (หลีกเลี่ยง shared client_id ที่โดน Google rate limit) เนื่องจาก server เป็น headless ต้อง authenticate ผ่านเครื่อง Windows ที่มี browser แล้ว copy token กลับมา จากนั้นตั้ง cron สอง job ในนาม user `np-dms`: Job A backup repo ทั้งหมดเวลา 01:00 ทุกวัน (exclude `.git`, `node_modules`, `dist`, `.env`) และ Job B sync `specs/` กับทีมเวลา 08-18 ทุก 2 ชม. ทั้งสอง job push สถานะไป Uptime Kuma Push Monitor (Tier 4) และมี logrotate คุมขนาด log ที่ `/var/log/rclone/`

งานนี้เป็น **infrastructure-only** — ไม่มีการเปลี่ยนแปลง source code ของ backend/frontend ทั้งหมดอยู่ในรูปแบบของ system config (rclone config, crontab, logrotate, Uptime Kuma UI) และเอกสาร

## Technical Context

**Language/Version**: N/A (infrastructure tooling)
**Primary Dependencies**:
- `rclone` (Linux server + Windows สำหรับ OAuth flow)
- Google Drive API (enabled ใน project `lcbp3-dms` อยู่แล้ว)
- Google OAuth Client ID (Desktop app type — สร้างใหม่)
- `cron` (user `np-dms` crontab)
- `logrotate` (system package)
- `curl` (สำหรับ push สถานะไป Uptime Kuma)
- Uptime Kuma (รันอยู่แล้วที่ `https://uptime.np-dms.work`)

**Storage**:
- ต้นทาง: `/opt/np-dms-lcbp3` (repo) และ `/opt/np-dms-lcbp3/specs` (docs)
- ปลายทาง: Google Drive — `gdrive:backups/lcbp3-repo` (Job A) และ `gdrive:shared/lcbp3-specs` (Job B)
- Log: `/var/log/rclone/backup.log` และ `/var/log/rclone/specs.log`
- rclone config: `~/.config/rclone/rclone.conf` ของ user `np-dms`

**Testing**:
- Dry-run sync ก่อนรันจริงทุกครั้ง (`--dry-run -v`) เพื่อตรวจ exclude patterns
- รัน sync ทันทีหลังตั้ง cron เพื่อยืนยันว่าผ่าน
- ตรวจ `rclone size` และ `rclone ls --include ".env"` หลัง sync เพื่อยืนยันไม่มี secret หลุด
- ตรวจ Uptime Kuma UI ว่า heartbeat ขึ้นตรงเวลา
- ตรวจ `sudo logrotate -d` (dry-run) ก่อนบังคับรันด้วย `-f`

**Target Platform**: Linux (host server `np-dms-lcbp3` at 192.168.10.11) + Windows (สำหรับ OAuth flow เท่านั้น)
**Project Type**: Infrastructure / DevOps runbook (no application code changes)
**Performance Goals**: sync ทั้ง repo ใน Job A ควรเสร็จภายในหน้าต่าง 01:00-06:00 (ก่อนเริ่มเวลาทำงาน)
**Constraints**:
- ห้าม sync `.env` และ `.git/` (security + ขนาด)
- ห้ามใช้ shared rclone client_id (rate limit)
- ห้ามรันผ่าน `sudo -u np-dms` ซ้อนใน crontab (ทำให้ `$HOME` ผิด → rclone หา config ไม่เจอ → fail เงียบ ๆ)
- ห้ามใช้ `bisync` — one-way เท่านั้น (ทีมไม่ควรแก้ไฟล์บน Drive)
- ต้องใช้ full path `/usr/bin/rclone` ใน crontab (cron ไม่โหลด `$PATH`)

**Scale/Scope**:
- 1 rclone installation (Linux server)
- 1 rclone installation (Windows — เฉพาะตอน OAuth flow)
- 1 Google OAuth Client (Desktop app type)
- 2 cron jobs (Job A + Job B)
- 2 Uptime Kuma Push Monitors
- 1 logrotate config
- 2 log files

## Constitution Check

_เช็คกฎ AGENTS.md ก่อนเริ่ม — infrastructure กระทบ security (secret handling) และ observability (logging/monitoring)_

| ADR | Applicable | Notes |
|-----|------------|-------|
| ADR-016 (Security) | ✅ Yes | ห้าม sync `.env` และ secret อื่น ๆ — ใช้ `--exclude ".env"` เสมอ; OAuth token เก็บใน `~/.config/rclone/rclone.conf` ของ user `np-dms` เท่านั้น |
| ADR-010 (Logging & Monitoring) | ✅ Yes | log ไปที่ `/var/log/rclone/` ระดับ INFO + logrotate weekly; Uptime Kuma Push Monitor เป็น Tier 4 ตาม MONITORING-PLAN.md |
| ADR-007 (Errors) | ⚠️ Partial | cron ใช้ `&& curl status=up || curl status=down` เพื่อ push สถานะ — ไม่ใช่ exception handling แบบ code แต่เป็น operational error signaling |
| ADR-009 (Schema) | ❌ N/A | ไม่มี DB schema changes |
| ADR-019 (UUID) | ❌ N/A | ไม่มี identifier changes |
| ADR-008 (BullMQ) | ❌ N/A | ไม่มี queue changes — cron เป็น external scheduler |
| ADR-023/023A (AI Boundary) | ❌ N/A | ไม่เกี่ยวกับ AI infrastructure |
| ADR-002 (Numbering) | ❌ N/A | ไม่มี Redis changes |
| ADR-041 (Server Consolidation) | ✅ Context | รันบน `np-dms-lcbp3` หลัง consolidation — สอดคล้องกับแผน |

**GATE STATUS**: ✅ PASS — Infrastructure runbook ที่ไม่กระทบ application code ข้อหลักคือ ADR-016 (ห้าม sync secret) และ ADR-010 (logging + monitoring) ซึ่งจัดการผ่าน exclude patterns + logrotate + Uptime Kuma

## Project Structure

### Documentation (this feature)

```text
specs/100-Infrastructures/144-rclone-gdrive-sync/
├── spec.md              # Feature specification
├── plan.md              # This file
├── tasks.md             # Task list (all phases)
├── quickstart.md        # Step-by-step setup guide (migrated from docs/)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### System Config (outside repo — host system)

```text
# rclone configuration
~/.config/rclone/rclone.conf           # user np-dms — remote "gdrive" with OAuth token

# Cron schedule (user np-dms crontab)
/var/spool/cron/crontabs/np-dms        # 2 jobs: Job A (01:00 daily) + Job B (08-18 every 2h)

# Log management
/var/log/rclone/                       # log directory (owned by np-dms:np-dms-dev)
├── backup.log                         # Job A log
└── specs.log                          # Job B log
/etc/logrotate.d/rclone                # weekly rotate 4 compress

# Uptime Kuma (existing instance at uptime.np-dms.work)
└── Push Monitors:
    ├── "rclone - Backup repo"         # token: RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi
    └── "rclone - Specs sync"          # token: va1hlAh8fawmq1nfjZAkoMCncx907wZX

# Google Cloud (project lcbp3-dms)
└── OAuth Client ID (Desktop app)      # client_id + client_secret ของตัวเอง
    └── OAuth consent screen Test users: peancharoen@gmail.com (+ เพิ่มตามต้องการ)
```

### Source Documentation (in repo)

```text
docs/
└── Rclone gdrive sync setup.md        # runbook ต้นฉบับ (คงไว้ — quickstart.md อ้างอิงกลับ)

specs/04-Infrastructure-OPS/
└── 04-02-backup-recovery.md           # อัปเดต Offsite Backup section ให้อ้างอิง spec นี้
```

**Structure Decision**: ไม่มี source code changes — ทุกอย่างอยู่ในรูปแบบ system config (rclone, cron, logrotate, Uptime Kuma UI, Google Cloud Console) และเอกสาร

## Implementation Phases

### Phase 1: Prerequisites (rclone install + Google OAuth Client)

- ติดตั้ง rclone บน server (Linux) และเครื่อง Windows (สำหรับ OAuth flow)
- สร้าง Google OAuth Client (Desktop app type) ใน project `lcbp3-dms`
- เพิ่ม Test users ใน OAuth consent screen

### Phase 2: Configure rclone remote `gdrive`

- รัน `rclone config` บน server ในนาม user `np-dms`
- ใส่ client_id/client_secret ของตัวเอง
- เลือก `n` ที่ auto config (headless) → รับคำสั่ง `rclone authorize` → รันบน Windows → copy token กลับมา paste ที่ server
- ทดสอบ `rclone lsd gdrive:` ว่าเห็น folder

### Phase 3: Prepare destination folders + log directory

- `rclone mkdir gdrive:backups/lcbp3-repo`
- `rclone mkdir gdrive:shared/lcbp3-specs`
- `sudo mkdir -p /var/log/rclone && sudo chown np-dms:np-dms-dev /var/log/rclone`

### Phase 4: Dry-run validation

- รัน Job A และ Job B แบบ `--dry-run -v` เพื่อตรวจ exclude patterns ว่าไม่มี `.env`/`.git` หลุด

### Phase 5: Uptime Kuma Push Monitors

- สร้าง Push Monitor 2 ตัวใน Uptime Kuma UI (`rclone - Backup repo`, `rclone - Specs sync`)
- บันทึก Push URL และ token

### Phase 6: Cron schedule + Uptime Kuma push

- `sudo crontab -u np-dms -e` เพิ่ม 2 jobs พร้อม `&& curl status=up || curl status=down`
- ทดสอบรันทันที (ไม่ต้องรอ cron) เพื่อยืนยันว่าผ่านและ Uptime Kuma ขึ้น "Up"

### Phase 7: Logrotate

- สร้าง `/etc/logrotate.d/rclone` (weekly rotate 4 compress missingok notifempty)
- ทดสอบ dry-run ด้วย `logrotate -d` แล้วบังคับรันด้วย `-f`

### Phase 8: Documentation

- คง `docs/Rclone gdrive sync setup.md` ไว้เป็น runbook ต้นฉบับ
- สร้าง `specs/100-Infrastructures/144-rclone-gdrive-sync/` (spec/plan/tasks/quickstart/checklist)
- อัปเดต `specs/04-Infrastructure-OPS/04-02-backup-recovery.md` Offsite Backup section ให้อ้างอิง spec นี้
- อัปเดต `specs/100-Infrastructures/README.md` ให้ list 144

## Complexity Tracking

> No constitution check violations — table not needed.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `.env` หลุดไป Google Drive | Low | High (secret leak) | `--exclude ".env"` เสมอ + dry-run ก่อนรันจริง + ตรวจ `rclone ls --include ".env"` หลัง sync |
| Google rate limit บน shared client_id | High (ถ้าใช้ default) | Medium (sync fail) | ใช้ OAuth Client ของตัวเอง (project `lcbp3-dms`) |
| `sudo -u np-dms` ทำให้ `$HOME` ผิด → rclone fail เงียบ ๆ | Medium | High (sync ไม่ทำงานโดยไม่รู้) | รันคำสั่งตรง ๆ ในนาม user นั้น ไม่ผ่าน `sudo -u` ซ้อน; Uptime Kuma จะ alert ถ้า cron ไม่ยิง |
| OAuth token หมดอายุ | Low | Medium (sync หยุดจนกว่าจะ re-auth) | rclone เก็บ refresh token อัตโนมัติ — ตรวจ Uptime Kuma alert ถ้า sync ล้มเหลว |
| Google Drive quota เต็ม | Low | High (sync หยุด) | ตรวจ quota ใน Google Drive เป็นครั้งคราว; exclude `node_modules`/`dist`/`.git` ช่วยลดขนาด |
| URL ซ้อนกันสองชุดจาก copy Push URL เต็ม ๆ | Medium | Low (alert ไม่ถึง) | ใช้แค่ `<base URL>?status=up&msg=...` เท่านั้น — ไม่ copy ทั้ง URL ที่ Uptime Kuma แสดง |
| ทีมแก้ไฟล์บน Drive แล้วคาดหวังให้ sync กลับ | Low | Low (one-way sync จะ overwrite) | ไม่ใช้ `bisync`; ระบุชัดในเอกสารว่า workflow การแก้โค้ด/เอกสารต้องผ่าน Gitea |

## Verification Plan

| Criterion | Verification Method |
|-----------|---------------------|
| rclone ติดตั้งและใช้งานได้ | `rclone version` บน server และ Windows |
| remote `gdrive` config ถูกต้อง | `rclone lsd gdrive:` แสดงรายชื่อ folder |
| ไม่มี secret หลุดไป Drive | `rclone ls gdrive:backups/lcbp3-repo --include ".env"` คืนค่าว่าง |
| Job A sync สำเร็จ | `rclone size gdrive:backups/lcbp3-repo` รายงานขนาด > 0 |
| Job B sync สำเร็จ | โครงสร้าง folder ใน `gdrive:shared/lcbp3-specs` ตรงกับ local |
| crontab ถูกต้อง | `sudo crontab -u np-dms -l` แสดง 2 jobs ครบ |
| Uptime Kuma รับ heartbeat | ตรวจ UI ว่า monitor ขึ้น "Up" ตรงเวลารัน |
| logrotate ทำงาน | `sudo logrotate -d /etc/logrotate.d/rclone` dry-run ผ่าน; `sudo logrotate -f` สร้าง `.1.gz` |
