# Quick Start: Rclone Google Drive Sync — Offsite Repo Backup & Specs Sharing

> 📖 **Runbook ต้นฉบับ**: รายละเอียดเต็มรูปแบบอยู่ที่ [`docs/Rclone gdrive sync setup.md`](../../../docs/Rclone%20gdrive%20sync%20setup.md)
> เอกสารนี้สรุป key steps และเชื่อมโยงกับ spec/plan/tasks ใน `specs/100-Infrastructures/144-rclone-gdrive-sync/`

## Prerequisites

- เครื่อง server `np-dms-lcbp3` (192.168.10.11) เข้าถึงได้ ในนาม user `np-dms`
- เครื่อง Windows ที่มี browser (สำหรับ OAuth flow บน headless server)
- Google Cloud project `lcbp3-dms` ที่ enable Google Drive API แล้ว
- Uptime Kuma รันอยู่ที่ `https://uptime.np-dms.work`
- ทำตาม `docs/Rclone gdrive sync setup.md` ขั้นตอนที่ 1-2 ก่อน (ติดตั้ง rclone + สร้าง OAuth Client)

## Phase 1: ติดตั้ง rclone + สร้าง Google OAuth Client

ดูรายละเอียดเต็มที่: [`docs/Rclone gdrive sync setup.md` §1-2](../../../docs/Rclone%20gdrive%20sync%20setup.md)

```bash
# บน server (Linux)
curl https://rclone.org/install.sh | sudo bash
rclone version
```

```powershell
# บนเครื่อง Windows (สำหรับ OAuth flow)
winget install Rclone.Rclone
# ปิด-เปิด PowerShell ใหม่
rclone version
```

**สร้าง Google OAuth Client** ใน Google Cloud Console (project `lcbp3-dms`):
1. APIs & Services → Library → ตรวจ "Google Drive API" ว่า Enabled
2. APIs & Services → Credentials → `+ Create credentials` → **OAuth client ID** → **Desktop app** (ไม่ใช่ Web) → ตั้งชื่อ `rclone-desktop` → Create
3. Copy **Client ID** และ **Client Secret**
4. APIs & Services → OAuth consent screen → Audience → **Test users** → เพิ่ม email ที่จะ authorize (เช่น `peancharoen@gmail.com`)

> ⚠️ ถ้าไม่เพิ่ม Test user จะเจอ `403: access_denied` ตอน login ผ่าน browser

> 💡 ใช้ OAuth Client ของตัวเองเพราะ shared client_id ของ rclone โดน Google rate limit บ่อย — ไม่เหมาะกับงาน cron

## Phase 2: Config rclone remote `gdrive`

ดูรายละเอียดเต็มที่: [`docs/Rclone gdrive sync setup.md` §3](../../../docs/Rclone%20gdrive%20sync%20setup.md)

```bash
# รันในนาม user np-dms บน server
rclone config
```

ลำดับคำตอบ:

| Prompt | ค่าที่ใส่ |
|---|---|
| `n) New remote` | `n` |
| `name>` | `gdrive` |
| `Storage>` | `drive` |
| `client_id>` | paste Client ID จาก Phase 1 |
| `client_secret>` | paste Client Secret จาก Phase 1 |
| `scope>` | `1` (Full access) |
| `root_folder_id>` | เว้นว่าง (Enter) |
| `service_account_file>` | เว้นว่าง (Enter) |
| `Edit advanced config?` | `n` |
| `Use web browser to automatically authenticate?` | `n` (server headless) |

หลังตอบ `n` ที่ auto config, rclone จะแสดงคำสั่งให้นำไปรันบนเครื่อง Windows:
```
rclone authorize "drive" "eyJjbGllbnRfaWQ...(ยาว)"
```

### บนเครื่อง Windows
1. Paste คำสั่งเต็มที่ได้มา รันใน PowerShell
2. Login Google ด้วย account ที่เป็น Test user → กด Allow
3. Copy token ก้อนยาว (ระหว่าง "Paste the following into your remote machine --->" กับ "<---End paste")

### กลับมาที่ server
1. Paste token ที่ prompt `config_token>`
2. `Configure this as a Shared Drive (Team Drive)?` → `n` (ถ้าใช้ My Drive ปกติ)
3. `y) Yes this is OK` → `y`
4. `q) Quit config` → `q`

### ทดสอบ
```bash
rclone lsd gdrive:
```
ควรเห็นรายชื่อ folder ใน Google Drive

## Phase 3: เตรียม folder ปลายทาง + log directory

ดูรายละเอียดเต็มที่: [`docs/Rclone gdrive sync setup.md` §4](../../../docs/Rclone%20gdrive%20sync%20setup.md)

```bash
rclone mkdir gdrive:backups/lcbp3-repo
rclone mkdir gdrive:shared/lcbp3-specs

sudo mkdir -p /var/log/rclone
sudo chown np-dms:np-dms-dev /var/log/rclone
```

## Phase 4: ทดสอบด้วย dry-run

ดูรายละเอียดเต็มที่: [`docs/Rclone gdrive sync setup.md` §5](../../../docs/Rclone%20gdrive%20sync%20setup.md)

```bash
# Job A - Backup repo ทั้งหมด
rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo \
  --exclude ".git/**" \
  --exclude "node_modules/**" \
  --exclude "dist/**" \
  --exclude ".env" \
  --dry-run -v

# Job B - แชร์ docs/specs
rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs --dry-run -v
```

> ⚠️ ตรวจ log ว่าไม่มี `.env` หรือ `.git` หลุดไปก่อนรันจริง

## Phase 5: Uptime Kuma Push Monitor

ดูรายละเอียดเต็มที่: [`docs/Rclone gdrive sync setup.md` §9](../../../docs/Rclone%20gdrive%20sync%20setup.md)

ไปที่ `uptime.np-dms.work` → **+ Add New Monitor**:

| Field | ค่า |
|---|---|
| Monitor Type | `Push` |
| Friendly Name | `rclone - Backup repo` (แยกอีกตัวสำหรับ `rclone - Specs sync`) |
| Heartbeat Interval | มากกว่ารอบ cron เล็กน้อย (เช่น backup daily → ~1500 วินาที) |

บันทึกแล้วจะได้ **Push URL**:
```
https://uptime.np-dms.work/api/push/<token>?status=up&msg=OK&ping=
```

ทำซ้ำสำหรับ specs sync (คนละ token)

> ⚠️ ใช้แค่ `<base URL>?status=up&msg=...` เท่านั้น — อย่า copy ทั้ง URL ที่ Uptime Kuma แสดงมาเต็ม ๆ มาต่อ query string เพิ่ม จะกลายเป็น URL ซ้อนกันสองชุดและได้ error 404

Token ปัจจุบัน:
- `rclone - Backup repo` = `RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi`
- `rclone - Specs sync` = `va1hlAh8fawmq1nfjZAkoMCncx907wZX`

## Phase 6: ตั้ง Cron + Uptime Kuma push

ดูรายละเอียดเต็มที่: [`docs/Rclone gdrive sync setup.md` §6 + §9](../../../docs/Rclone%20gdrive%20sync%20setup.md)

```bash
sudo crontab -u np-dms -e
```

เลือก editor (nano = ตัวเลือก 1) แล้วเพิ่ม:

```cron
0 1 * * * /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" --log-file=/var/log/rclone/backup.log --log-level INFO && curl -fsS "https://uptime.np-dms.work/api/push/RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi?status=up&msg=OK" || curl -fsS "https://uptime.np-dms.work/api/push/RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi?status=down&msg=rclone_failed"'

0 8,10,12,14,16,18 * * * /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs --log-file=/var/log/rclone/specs.log --log-level INFO && curl -fsS "https://uptime.np-dms.work/api/push/va1hlAh8fawmq1nfjZAkoMCncx907wZX?status=up&msg=OK" || curl -fsS "https://uptime.np-dms.work/api/push/va1hlAh8fawmq1nfjZAkoMCncx907wZX?status=down&msg=rclone_failed"'
```

| Job | เวลา | รายละเอียด |
|---|---|---|
| Backup repo | 01:00 ทุกวัน | Full backup, exclude `.git`, `node_modules`, `dist`, `.env` |
| Sync specs/docs | 08:00, 10:00, 12:00, 14:00, 16:00, 18:00 | แชร์เอกสารกับทีม |

บันทึกด้วย `Ctrl+O` → Enter → ออกด้วย `Ctrl+X`

ตรวจสอบ:
```bash
sudo crontab -u np-dms -l
```

### ทดสอบรันทันที (ไม่ต้องรอ cron)

ดูรายละเอียดเต็มที่: [`docs/Rclone gdrive sync setup.md` §7 + §9](../../../docs/Rclone%20gdrive%20sync%20setup.md)

```bash
# Specs sync
sudo -u np-dms /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs -v && curl -fsS "https://uptime.np-dms.work/api/push/va1hlAh8fawmq1nfjZAkoMCncx907wZX?status=up&msg=OK"'

# Backup repo
sudo -u np-dms /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" -v && curl -fsS "https://uptime.np-dms.work/api/push/RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi?status=up&msg=OK"'
```

> ⚠️ **ข้อควรระวัง:** รันคำสั่งตรง ๆ ในนาม user นั้น (ไม่ต้องผ่าน `sudo -u np-dms` ซ้อนถ้า login เป็น np-dms อยู่แล้ว) เพราะ `sudo -u` อาจไม่ set `$HOME` ให้ถูกต้อง ทำให้ rclone หา config file ที่ `~/.config/rclone/rclone.conf` ไม่เจอ และ fail แบบเงียบ ๆ (exit code 1 โดยไม่มี error message และ log ว่างเปล่า)

ตรวจผลลัพธ์:
```bash
rclone size gdrive:backups/lcbp3-repo
```

เช็คใน Uptime Kuma UI ว่า monitor ขึ้นสถานะ "Up" และ heartbeat ล่าสุดตรงกับเวลาที่รัน (สำเร็จควรได้ response `{"ok":true}`)

## Phase 7: ตั้ง logrotate

ดูรายละเอียดเต็มที่: [`docs/Rclone gdrive sync setup.md` §8](../../../docs/Rclone%20gdrive%20sync%20setup.md)

```bash
sudo nano /etc/logrotate.d/rclone
```

ใส่เนื้อหา:
```
/var/log/rclone/*.log {
  weekly
  rotate 4
  compress
  missingok
  notifempty
}
```

| Option | ความหมาย |
|---|---|
| `weekly` | หมุน log ทุกสัปดาห์ |
| `rotate 4` | เก็บย้อนหลัง 4 รอบ (~1 เดือน) แล้วลบตัวเก่าสุด |
| `compress` | บีบอัดไฟล์เก่าเป็น `.gz` |
| `missingok` | ไม่ error ถ้าไฟล์ log ยังไม่มี |
| `notifempty` | ไม่หมุน log ถ้าไฟล์ว่างเปล่า |

ทดสอบ syntax (dry-run):
```bash
sudo logrotate -d /etc/logrotate.d/rclone
```

บังคับรันจริงเพื่อทดสอบ:
```bash
sudo logrotate -f /etc/logrotate.d/rclone
ls -la /var/log/rclone/
```

## Troubleshooting

ดูตารางเต็มที่: [`docs/Rclone gdrive sync setup.md` §10](../../../docs/Rclone%20gdrive%20sync%20setup.md)

| ปัญหา | สาเหตุ | วิธีแก้ |
|---|---|---|
| `Continue using the shared client_id anyway?` | rclone default client_id โดน Google rate limit | สร้าง OAuth client ของตัวเอง (Phase 1) |
| `rclone: The term 'rclone' is not recognized` | ยังไม่ได้ติดตั้ง rclone บน Windows | `winget install Rclone.Rclone` แล้วเปิด terminal ใหม่ |
| `Error 403: access_denied` ตอน login Google | Email ไม่อยู่ใน Test users list | เพิ่ม email ใน Test users (Phase 1) |
| `Email addresses must be associated with an active Google Account` | พิมพ์ email ผิด | ตรวจสะกด email |
| `echo $?` ได้ `1` โดยไม่มี error, log ว่างเปล่า | รันผ่าน `sudo -u np-dms` ทำให้ `$HOME` ผิด | รันตรง ๆ โดยไม่ผ่าน `sudo -u` ถ้า login เป็น user นั้น |
| Uptime Kuma ได้ 404 ตอน push | copy ทั้ง URL ที่ Uptime Kuma แสดงมาเต็ม ๆ แล้วต่อ query string ซ้อนอีกชุด | ใช้แค่ `<base URL>?status=up&msg=...` เท่านั้น |

## หมายเหตุเพิ่มเติม

- **ไม่ใช้ `bisync`** เพราะทั้งสอง job เป็น one-way (local → Drive); ทีมไม่ควรแก้ไฟล์บน Drive แล้วคาดหวังให้ sync กลับเข้า repo — workflow การแก้โค้ด/เอกสารควรผ่าน Gitea ปกติ
- ใช้ full path `/usr/bin/rclone` ใน crontab เพราะ cron ไม่โหลด `$PATH` แบบ shell ปกติ
- การ alert เมื่อ sync ล้มเหลวอยู่ในระดับ Tier 4 ตาม [`docs/MONITORING-PLAN.md`](../../../docs/MONITORING-PLAN.md) — ผูก Notification channel (Telegram Bot / Email admin@np-dms.work) ในหน้า Edit Monitor ของ Uptime Kuma
