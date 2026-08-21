# Session 2026-08-21 — phpMyAdmin TempDir Fix + BooDark Theme + Hardening + Docs

## Summary

แก้ปัญหา phpMyAdmin TempDir not accessible และติดตั้ง BooDark 1.2.0 theme พร้อม hardening ครบ 4 ระดับ (Security, Storage DB, UI/UX, Performance) และอัพเดทเอกสาร 04-Infrastructure-OPS 5 ไฟล์

## ปัญหาที่พบ (Root Cause)

### 1. TempDir not accessible

- **อาการ:** phpMyAdmin แสดง warning "The $cfg['TempDir'] (/var/lib/phpmyadmin/tmp) is not accessible"
- **สาเหตุ:** Host directory `/opt/np-dms/pma/tmp` owned by `np-dms:np-dms` (UID 1001) แต่ Apache ใน container รันเป็น `www-data` (UID 33) → ไม่มีสิทธิ์เขียน
- **แก้ไข:** `docker exec pma chown -R 33:33 /var/lib/phpmyadmin/tmp`

### 2. blowfish_secret regenerate ทุก recreate

- **สาเหตุ:** `config.secret.inc.php` ไม่ได้ bind-mount → entrypoint script generate ใหม่ทุกครั้ง → session หมดอายุทั้งหมด
- **แก้ไข:** สร้าง stable blowfish_secret + bind-mount จาก host

## การแก้ไข (Fix)

### Phase 1: TempDir Fix + BooDark Theme Installation

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `/opt/np-dms/pma/tmp` | chown เป็น `33:33` (www-data) |
| `/opt/np-dms/pma/themes/boodark/` | สร้างใหม่ — BooDark 1.2.0 theme (SHA256 verified) |
| `docker-compose.yml` (source + deployed) | เพิ่ม bind-mount `themes/boodark` |

### Phase 2: Hardening (4 ระดับ)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `/opt/np-dms/pma/zzz-custom.ini` | เพิ่ม `expose_php=Off`, `session.cookie_secure=On`, `session.cookie_samesite=Strict`, opcache tuning |
| `/opt/np-dms/pma/config.user.inc.php` | เพิ่ม storage DB config, `LoginCookieValidity=3600`, `MaxRows=200`, `DefaultTabTable=sql`, `SendErrorReports=never`, `QueryHistoryDB=true`, `ThemeDefault=boodark` |
| `/opt/np-dms/pma/config.secret.inc.php` | สร้างใหม่ — stable blowfish_secret (bind-mount) |
| `docker-compose.yml` (source + deployed) | เพิ่ม bind-mount `config.secret.inc.php` |
| MariaDB | สร้าง database `phpmyadmin` + user `pma` + 19 storage tables (create_tables.sql) |

### Phase 3: Documentation Update

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `04-00-docker-compose/np-dms-lcbp3/README.md` | เพิ่ม section "phpMyAdmin Configuration" (config files, security, storage DB, OPcache, theme) |
| `04-01-docker-compose.md` | เพิ่ม note อ้างอิง config ปัจจุบันใน Appendix A (QNAP legacy) |
| `04-02-backup-recovery.md` | เพิ่ม phpmyadmin DB + PMA config files ใน backup schedule + backup scripts |
| `04-05-maintenance-procedures.md` | เพิ่ม section phpMyAdmin maintenance (Twig cache, version check, theme update, recreate) |
| `04-06-security-operations.md` | เพิ่ม section phpMyAdmin hardening (PHP, session, access control, audit checklist) |

## กฎที่ Lock แล้ว

- **D128** — phpMyAdmin Hardening Pattern (ดู `memory/project-memory-override.md`)

## Verification

- [x] TempDir writable by www-data
- [x] BooDark theme served HTTP 200 (356 KB CSS)
- [x] `expose_php=Off` — `X-Powered-By` header หายไป
- [x] `session.cookie_secure=On`, `session.cookie_samesite=Strict`
- [x] blowfish_secret ถาวร (bind-mount, ไม่ regenerate)
- [x] Storage DB connection สำเร็จ (19 tables accessible)
- [x] Control user `pma` เขียนได้ (insert + rollback test)
- [x] OPcache settings applied (256MB memory, 20000 files)
- [x] PMA config ครบ (LoginCookieValidity=3600, MaxRows=200, ThemeDefault=boodark)
- [x] Container recreate สำเร็จ ไม่มี errors ใน logs
- [x] Compose validate ผ่าน (ทั้ง source + deployed)
- [x] 2 commits pushed to origin/main

## Commits

- `edfbac40` — `feat(infra): add phpMyAdmin BooDark theme + stable blowfish_secret bind-mount`
- `06299e87` — `docs(infra): document phpMyAdmin hardening + BooDark theme + storage DB`
