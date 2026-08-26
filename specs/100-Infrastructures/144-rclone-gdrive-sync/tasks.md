# Tasks: Rclone Google Drive Sync — Offsite Repo Backup & Specs Sharing

**Input**: Design documents from `/specs/100-Infrastructures/144-rclone-gdrive-sync/`
**Prerequisites**: plan.md, spec.md, quickstart.md
**Source runbook**: `docs/Rclone gdrive sync setup.md`

**Organization**: Tasks grouped by phase (setup → config → validation → monitoring → cron → logrotate → docs).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different systems, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = Backup repo, US2 = Specs sharing, US3 = Monitoring/Log)

---

## Phase 1: Prerequisites (rclone install + Google OAuth Client)

**Purpose**: เตรียม dependencies ก่อนเริ่ม config

- [X] T001 [P] ติดตั้ง rclone บน server (Linux): `curl https://rclone.org/install.sh | sudo bash` แล้วตรวจ `rclone version`
- [X] T002 [P] ติดตั้ง rclone บนเครื่อง Windows (สำหรับ OAuth flow): `winget install Rclone.Rclone` แล้วเปิด terminal ใหม่และตรวจ `rclone version`
- [X] T003 สร้าง Google OAuth Client (Desktop app type) ใน project `lcbp3-dms` — APIs & Services → Credentials → + Create credentials → OAuth client ID → Desktop app → ตั้งชื่อ `rclone-desktop` → copy Client ID + Client Secret
- [X] T004 ตรวจ Google Drive API ว่า Enabled แล้วใน project `lcbp3-dms` (APIs & Services → Library → "Google Drive API")
- [X] T005 เพิ่ม Test users ใน OAuth consent screen (APIs & Services → OAuth consent screen → Audience → Test users → เพิ่ม `peancharoen@gmail.com`)

---

## Phase 2: Configure rclone remote `gdrive`

**Purpose**: ตั้งค่า remote `gdrive` บน server ในนาม user `np-dms`

- [X] T006 [US1] รัน `rclone config` ในนาม user `np-dms` และตอบ prompt ตามลำดับ: `n` (New remote) → `gdrive` (name) → `drive` (Storage) → paste Client ID → paste Client Secret → `1` (Full access) → Enter (root_folder_id ว่าง) → Enter (service_account_file ว่าง) → `n` (advanced config) → `n` (auto config — headless)
- [X] T007 [US1] รับคำสั่ง `rclone authorize "drive" "eyJjbGllbnRfaWQ..."` จาก prompt ของ server แล้วนำไปรันบนเครื่อง Windows ที่มี browser
- [X] T008 [US1] บน Windows: login Google ด้วย account ที่เป็น Test user → กด Allow → copy token ก้อนยาว (ระหว่าง "Paste the following..." กับ "<---End paste")
- [X] T009 [US1] กลับมาที่ server: paste token ที่ prompt `config_token>` → ตอบ `n` (Shared Drive) → `y` (Yes this is OK) → `q` (Quit config)
- [X] T010 [US1] ทดสอบ remote: `rclone lsd gdrive:` ควรเห็นรายชื่อ folder ใน Google Drive

---

## Phase 3: Prepare destination folders + log directory

**Purpose**: เตรียมพื้นที่ปลายทางบน Drive และ log directory บน server

- [X] T011 [P] [US1] สร้าง folder ปลายทาง Job A: `rclone mkdir gdrive:backups/lcbp3-repo`
- [X] T012 [P] [US2] สร้าง folder ปลายทาง Job B: `rclone mkdir gdrive:shared/lcbp3-specs`
- [X] T013 [P] [US3] สร้าง log directory: `sudo mkdir -p /var/log/rclone && sudo chown np-dms:np-dms-dev /var/log/rclone`

---

## Phase 4: Dry-run validation

**Purpose**: ตรวจ exclude patterns ก่อนรันจริง เพื่อยืนยันไม่มี secret หลุด

- [X] T014 [US1] Dry-run Job A: `rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" --dry-run -v` แล้วตรวจ log ว่าไม่มี `.env` หรือ `.git` หลุดไป
- [X] T015 [US2] Dry-run Job B: `rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs --dry-run -v` แล้วตรวจ log ว่า transfer เฉพาะไฟล์ใต้ `specs/` เท่านั้น

---

## Phase 5: Uptime Kuma Push Monitors

**Purpose**: สร้าง Push Monitor 2 ตัวใน Uptime Kuma UI เพื่อรับ heartbeat จาก cron

- [X] T016 [US3] สร้าง Push Monitor `rclone - Backup repo` ใน Uptime Kuma UI — Monitor Type: Push, Heartbeat Interval: ~43800 วินาที (มากกว่ารอบ cron 12 ชม. เล็กน้อย) — บันทึก Push URL และ token `<BACKUP_REPO_PUSH_TOKEN>`
- [X] T017 [US3] สร้าง Push Monitor `rclone - Specs sync` ใน Uptime Kuma UI — Heartbeat Interval: ~15000 วินาที (มากกว่ารอบ cron 4 ชม. เล็กน้อย) — บันทึก Push URL และ token `<SPECS_SYNC_PUSH_TOKEN>`
- [X] T018 [US3] ผูก Notification channel (Telegram Bot / Email admin@np-dms.work) เข้ากับ monitor ทั้งสองตัว

---

## Phase 6: Cron schedule + Uptime Kuma push

**Purpose**: ตั้ง cron 2 jobs ในนาม user `np-dms` พร้อม push สถานะไป Uptime Kuma

- [X] T019 [US1] เปิด crontab: `sudo crontab -u np-dms -e` (เลือก editor nano = ตัวเลือก 1)
- [X] T020 [US1] เพิ่ม Job A (Backup repo เวลา 00:00 และ 12:00 ทุกวัน พร้อม Uptime Kuma push):
  ```cron
  0 0,12 * * * /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" --log-file=/var/log/rclone/backup.log --log-level INFO && curl -fsS "https://uptime.np-dms.work/api/push/<BACKUP_REPO_PUSH_TOKEN>?status=up&msg=OK" || curl -fsS "https://uptime.np-dms.work/api/push/<BACKUP_REPO_PUSH_TOKEN>?status=down&msg=rclone_failed"'
  ```
- [X] T021 [US2] เพิ่ม Job B (Sync specs เวลา 03:00, 07:00, 11:00, 15:00, 19:00, 23:00 ทุกวัน พร้อม Uptime Kuma push):
  ```cron
  0 3,7,11,15,19,23 * * * /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs --log-file=/var/log/rclone/specs.log --log-level INFO && curl -fsS "https://uptime.np-dms.work/api/push/<SPECS_SYNC_PUSH_TOKEN>?status=up&msg=OK" || curl -fsS "https://uptime.np-dms.work/api/push/<SPECS_SYNC_PUSH_TOKEN>?status=down&msg=rclone_failed"'
  ```
- [X] T022 บันทึก crontab (`Ctrl+O` → Enter → `Ctrl+X`) แล้วตรวจ `sudo crontab -u np-dms -l` ว่ามี 2 jobs ครบ
- [X] T023 [US1] ทดสอบ Job A ทันที (ไม่ต้องรอ cron): รันคำสั่ง sync ตรง ๆ ในนาม user `np-dms` แล้วตรวจ `echo $?` = 0 และ `rclone size gdrive:backups/lcbp3-repo` รายงานขนาด > 0
- [X] T024 [US2] ทดสอบ Job B ทันที: รันคำสั่ง sync ตรง ๆ แล้วตรวจโครงสร้าง folder ใน `gdrive:shared/lcbp3-specs` ตรงกับ local
- [X] T025 [US3] ทดสอบ Uptime Kuma push ทันที: รัน sync + curl แบบ manual แล้วตรวจ UI ว่า monitor ขึ้น "Up" และ heartbeat ล่าสุดตรงเวลา (response ควรเป็น `{"ok":true}`)

---

## Phase 7: Logrotate

**Purpose**: ป้องกัน log ไฟล์โตไม่จำกัด

- [X] T026 [US3] สร้าง `/etc/logrotate.d/rclone` ด้วย config:
  ```
  /var/log/rclone/*.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
  }
  ```
- [X] T027 [US3] ทดสอบ dry-run syntax: `sudo logrotate -d /etc/logrotate.d/rclone` ผ่านโดยไม่มี error
- [X] T028 [US3] บังคับรันจริงเพื่อทดสอบ: `sudo logrotate -f /etc/logrotate.d/rclone` แล้วตรวจ `ls -la /var/log/rclone/` ว่ามี `.1.gz` ถูกสร้างขึ้น

---

## Phase 8: Documentation

**Purpose**: ย้าย runbook เข้าสู่ specs structure และ cross-link กับ core specs

- [X] T029 [P] คง `docs/Rclone gdrive sync setup.md` ไว้เป็น runbook ต้นฉบับ (ไม่ลบ)
- [X] T030 สร้าง `specs/100-Infrastructures/144-rclone-gdrive-sync/spec.md` (formal spec ตามรูปแบบ speckit)
- [X] T031 สร้าง `specs/100-Infrastructures/144-rclone-gdrive-sync/plan.md` (implementation plan)
- [X] T032 สร้าง `specs/100-Infrastructures/144-rclone-gdrive-sync/tasks.md` (this file)
- [X] T033 สร้าง `specs/100-Infrastructures/144-rclone-gdrive-sync/quickstart.md` (step-by-step guide ที่อ้างอิง runbook ต้นฉบับ)
- [X] T034 [P] สร้าง `specs/100-Infrastructures/144-rclone-gdrive-sync/checklists/requirements.md`
- [X] T035 [P] อัปเดต `specs/100-Infrastructures/README.md` ให้ list `144-rclone-gdrive-sync`
- [X] T036 อัปเดต `specs/04-Infrastructure-OPS/04-02-backup-recovery.md` Offsite Backup section ให้อ้างอิง spec นี้

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Prerequisites)**: No dependencies — ติดตั้ง rclone + สร้าง OAuth Client
- **Phase 2 (Configure remote)**: Depends on Phase 1 — BLOCKS ทุก phase ถัดไป
- **Phase 3 (Prepare folders + log dir)**: Depends on Phase 2 — T011/T012/T013 ทำ parallel ได้
- **Phase 4 (Dry-run)**: Depends on Phase 3 — T014/T015 ทำ parallel ได้
- **Phase 5 (Uptime Kuma)**: Depends on Phase 2 (ต้องมี remote ก่อนจะรู้ว่าจะ monitor อะไร) — ทำ parallel กับ Phase 3/4 ได้
- **Phase 6 (Cron)**: Depends on Phase 3, 4, 5 — ต้องมี folder ปลายทาง + dry-run ผ่าน + Uptime Kuma token ก่อน
- **Phase 7 (Logrotate)**: Depends on Phase 3 (ต้องมี log dir ก่อน) — ทำ parallel กับ Phase 6 ได้
- **Phase 8 (Docs)**: ทำได้ทุกเมื่อ — แต่ควรทำหลัง implementation เสร็จเพื่อให้เอกสารตรงกับสถานะจริง

### Parallel Opportunities

- Phase 1: T001/T002 parallel (Linux + Windows install)
- Phase 3: T011/T012/T013 all parallel
- Phase 4: T014/T015 parallel
- Phase 5: T016/T017 parallel (สร้าง 2 monitors ใน UI)
- Phase 7 + Phase 6: ทำ parallel ได้ (คนละระบบ — logrotate vs crontab)
- Phase 8: T029/T034/T035 parallel (คนละไฟล์)

---

## Task Count Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Prerequisites | 5 | - |
| Configure remote | 5 | US1 |
| Prepare folders + log | 3 | US1/US2/US3 |
| Dry-run validation | 2 | US1/US2 |
| Uptime Kuma | 3 | US3 |
| Cron + push | 7 | US1/US2/US3 |
| Logrotate | 3 | US3 |
| Documentation | 8 | - |
| **Total** | **36** | - |

### Parallel Opportunities Identified: 6 groups

---

## Success Criteria Tracking

| Criteria | Task(s) | Status |
|----------|---------|--------|
| SC-001: rclone ติดตั้งบน server และ Windows | T001, T002 | ✅ |
| SC-002: Google OAuth Client สร้าง + Test users เพิ่ม | T003, T004, T005 | ✅ |
| SC-003: remote `gdrive` config สำเร็จ | T006-T010 | ✅ |
| SC-004: folder ปลายทาง + log dir สร้าง | T011, T012, T013 | ✅ |
| SC-005: dry-run ไม่มี `.env`/`.git` หลุด | T014, T015 | ✅ |
| SC-006: Uptime Kuma Push Monitor 2 ตัว | T016, T017, T018 | ✅ |
| SC-007: crontab มี 2 jobs ครบ + push | T019-T022 | ✅ |
| SC-008: sync จริงผ่าน + ไม่มี secret หลุด | T023, T024 | ✅ |
| SC-009: Uptime Kuma รับ heartbeat "Up" | T025 | ✅ |
| SC-010: logrotate dry-run + force ผ่าน | T027, T028 | ✅ |
| SC-011: docs เข้าสู่ specs structure + cross-link | T030-T036 | ✅ |
