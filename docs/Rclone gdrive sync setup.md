# Setup: Sync LCBP3-DMS Repo กับ Google Drive ผ่าน rclone

## วัตถุประสงค์
1. **Backup repo ทั้งหมด** จาก `/opt/np-dms-lcbp3` ไป Google Drive แบบ one-way (daily)
2. **แชร์ folder specs/docs** กับทีมผ่าน Google Drive แบบ one-way sync (ทุก 2 ชม. ในเวลาทำงาน)

รันในนาม user **`np-dms`** บนเครื่อง `np-dms-lcbp3` (192.168.10.11)

---

## 1. ติดตั้ง rclone

### บน server (Linux)
```bash
curl https://rclone.org/install.sh | sudo bash
rclone version
```

### บนเครื่อง Windows ที่มี browser (สำหรับขั้นตอน OAuth)
```powershell
winget install Rclone.Rclone
```
ปิด-เปิด PowerShell ใหม่ แล้วเช็ค:
```powershell
rclone version
```

---

## 2. สร้าง Google OAuth Client ของตัวเอง

**เหตุผล:** shared client_id ของ rclone (ที่ใช้ default) โดน rate limit บ่อยจาก Google เนื่องจากผู้ใช้ rclone ทั่วโลกใช้ client_id เดียวกัน ไม่เหมาะกับงาน cron ที่รันต่อเนื่อง

ใช้ Google Cloud project ที่มีอยู่แล้ว (`lcbp3-dms`) ซึ่ง enable Google Drive API ไว้แล้ว

### ขั้นตอน
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) → เลือก project `lcbp3-dms`
2. **APIs & Services → Library** → ค้นหา "Google Drive API" → ตรวจว่า Enabled แล้ว
3. **APIs & Services → Credentials** → `+ Create credentials` → เลือก **OAuth client ID** (ไม่ใช่ Service account)
4. **Application type** → เลือก **Desktop app** (ไม่ใช่ Web application)
5. ตั้งชื่อ เช่น `rclone-desktop` → Create
6. Copy **Client ID** และ **Client Secret** เก็บไว้

### ตั้งค่า OAuth consent screen (Test users)
1. **APIs & Services → OAuth consent screen → Audience**
2. เลื่อนไปที่ **Test users** → `+ Add users`
3. เพิ่ม email ที่จะใช้ authorize (เช่น `peancharoen@gmail.com`)
4. Save

> **หมายเหตุ:** ถ้าไม่เพิ่ม test user จะเจอ error `403: access_denied` ตอน login ผ่าน browser

---

## 3. Config rclone remote

รันบน server ในนาม user `np-dms`:
```bash
rclone config
```

ลำดับคำตอบ:
| Prompt | ค่าที่ใส่ |
|---|---|
| `n) New remote` | `n` |
| `name>` | `gdrive` |
| `Storage>` | `drive` |
| `client_id>` | (paste Client ID จากขั้นตอน 2) |
| `client_secret>` | (paste Client Secret จากขั้นตอน 2) |
| `scope>` | `1` (Full access) |
| `root_folder_id>` | เว้นว่าง (Enter) |
| `service_account_file>` | เว้นว่าง (Enter) |
| `Edit advanced config?` | `n` |
| `Use web browser to automatically authenticate?` | `n` (เพราะ server เป็น headless ไม่มี browser) |

หลังตอบ `n` ที่ auto config, rclone จะแสดงคำสั่งให้นำไปรันบนเครื่องที่มี browser:
```
rclone authorize "drive" "eyJjbGllbnRfaWQ...(ยาว)"
```

### บนเครื่อง Windows (มี browser)
1. Paste คำสั่งเต็มที่ได้มา รันใน PowerShell
2. Login Google ด้วย account ที่เป็น test user → กด Allow
3. Terminal จะแสดง token ก้อนยาว (ระหว่าง "Paste the following into your remote machine --->" กับ "<---End paste")
4. Copy token ทั้งก้อน

### กลับมาที่ server
1. Paste token ที่ prompt `config_token>`
2. `Configure this as a Shared Drive (Team Drive)?` → ตอบ `n` (ถ้าใช้ My Drive ปกติ)
3. `y) Yes this is OK` → กด `y`
4. `q) Quit config` → กด `q`

### ทดสอบ
```bash
rclone lsd gdrive:
```
ควรเห็นรายชื่อ folder ใน Google Drive

---

## 4. เตรียม folder ปลายทางและ log directory

```bash
rclone mkdir gdrive:backups/lcbp3-repo
rclone mkdir gdrive:shared/lcbp3-specs

sudo mkdir -p /var/log/rclone
sudo chown np-dms:np-dms-dev /var/log/rclone
```

---

## 5. ทดสอบด้วย dry-run

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
ตรวจ log ว่าไม่มี `.env` หรือ `.git` หลุดไปก่อนรันจริง

---

## 6. ตั้ง Cron (ในนาม user np-dms)

```bash
sudo crontab -u np-dms -e
```
เลือก editor (nano = ตัวเลือก 1) แล้วเพิ่ม:

```cron
0 1 * * * /usr/bin/rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" --log-file=/var/log/rclone/backup.log --log-level INFO

0 8,10,12,14,16,18 * * * /usr/bin/rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs --log-file=/var/log/rclone/specs.log --log-level INFO
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

---

## 7. ทดสอบรันทันที (ไม่ต้องรอ cron)

```bash
/usr/bin/rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" -v
echo $?
```

> **ข้อควรระวัง:** รันคำสั่งตรง ๆ ในนาม user นั้น (ไม่ต้องผ่าน `sudo -u np-dms` ซ้อนถ้า login เป็น np-dms อยู่แล้ว) เพราะ `sudo -u` อาจไม่ set `$HOME` ให้ถูกต้อง ทำให้ rclone หา config file ที่ `~/.config/rclone/rclone.conf` ไม่เจอ และ fail แบบเงียบ ๆ (exit code 1 โดยไม่มี error message และ log ว่างเปล่า)

ตรวจผลลัพธ์:
```bash
rclone size gdrive:backups/lcbp3-repo
```

---

## 8. ตั้ง logrotate

ป้องกัน log ไฟล์ที่ `/var/log/rclone/` โตไม่จำกัด:

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
| `rotate 4` | เก็บย้อนหลัง 4 รอบ (~1 เดือน) แล้วลบตัวเก่าสุดทิ้ง |
| `compress` | บีบอัดไฟล์เก่าเป็น `.gz` |
| `missingok` | ไม่ error ถ้าไฟล์ log ยังไม่มี |
| `notifempty` | ไม่หมุน log ถ้าไฟล์ว่างเปล่า |

ทดสอบ syntax (dry-run):
```bash
sudo logrotate -d /etc/logrotate.d/rclone
```

บังคับรันจริงเพื่อทดสอบทันที:
```bash
sudo logrotate -f /etc/logrotate.d/rclone
ls -la /var/log/rclone/
```

---

## 9. ต่อเข้า Uptime Kuma Push Monitor (Tier 4)

ใช้ Push/passive monitor ของ Uptime Kuma (Tier 4 ตาม MONITORING-PLAN.md) เพื่อ alert เมื่อ rclone sync ล้มเหลว — cron จะยิง HTTP request บอกสถานะไปหา Uptime Kuma หลัง sync เสร็จทุกครั้ง

### สร้าง Push Monitor ใน Uptime Kuma UI
ไปที่ `uptime.np-dms.work` → **+ Add New Monitor**

| Field | ค่า |
|---|---|
| Monitor Type | `Push` |
| Friendly Name | `rclone - Backup repo` (สร้างแยกอีกตัวสำหรับ `rclone - Specs sync`) |
| Heartbeat Interval | ตั้งมากกว่ารอบ cron เล็กน้อย เช่น backup รายวัน ตั้ง ~1500 วินาที |

บันทึกแล้วจะได้ **Push URL** รูปแบบ:
```
https://uptime.np-dms.work/api/push/<token>?status=up&msg=OK&ping=
```
ทำซ้ำสร้าง monitor ที่สองสำหรับ specs sync (คนละ token)

### แก้ crontab ให้ push สถานะหลังรันเสร็จ

```bash
sudo crontab -u np-dms -e
```

```cron
0 1 * * * /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" --log-file=/var/log/rclone/backup.log --log-level INFO && curl -fsS "https://uptime.np-dms.work/api/push/RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi?status=up&msg=OK" || curl -fsS "https://uptime.np-dms.work/api/push/RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi?status=down&msg=rclone_failed"'

0 8,10,12,14,16,18 * * * /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs --log-file=/var/log/rclone/specs.log --log-level INFO && curl -fsS "https://uptime.np-dms.work/api/push/va1hlAh8fawmq1nfjZAkoMCncx907wZX?status=up&msg=OK" || curl -fsS "https://uptime.np-dms.work/api/push/va1hlAh8fawmq1nfjZAkoMCncx907wZX?status=down&msg=rclone_failed"'
```

> **ข้อควรระวัง:** ใช้แค่ `<base URL>?status=up&msg=...` เท่านั้น — อย่า copy ทั้ง URL ที่ Uptime Kuma แสดงมาเต็ม ๆ (ซึ่งมี `?status=up&msg=OK&ping=` ติดมาอยู่แล้ว) มาต่อ query string เพิ่มอีกชุด จะกลายเป็น URL ซ้อนกันสองชุดและได้ error 404

Token ปัจจุบัน: `rclone - Backup repo` = `RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi`, `rclone - Specs sync` = `va1hlAh8fawmq1nfjZAkoMCncx907wZX`

### ทดสอบทันที
```bash
# Specs sync
sudo -u np-dms /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3/specs gdrive:shared/lcbp3-specs -v && curl -fsS "https://uptime.np-dms.work/api/push/va1hlAh8fawmq1nfjZAkoMCncx907wZX?status=up&msg=OK"'

# Backup repo
sudo -u np-dms /bin/sh -c '/usr/bin/rclone sync /opt/np-dms-lcbp3 gdrive:backups/lcbp3-repo --exclude ".git/**" --exclude "node_modules/**" --exclude "dist/**" --exclude ".env" -v && curl -fsS "https://uptime.np-dms.work/api/push/RD64Hz4JdgbWKAJLoLVGHjDmjowMwfHi?status=up&msg=OK"'
```
เช็คใน Uptime Kuma UI ว่า monitor ขึ้นสถานะ "Up" และ heartbeat ล่าสุดตรงกับเวลาที่รัน (สำเร็จควรได้ response `{"ok":true}`)

### ตั้ง alert (ถ้าต้องการ)
ผูก Notification channel (Telegram Bot / Email admin@np-dms.work ที่ตั้งไว้แล้วสำหรับ Tier 1-3) เข้ากับ monitor นี้ในหน้า Edit Monitor เพื่อรับแจ้งเตือนเมื่อ sync ล้มเหลว

---

## 10. Troubleshooting ที่เจอระหว่างทำ

| ปัญหา | สาเหตุ | วิธีแก้ |
|---|---|---|
| `Continue using the shared client_id anyway?` | rclone default client_id โดน Google rate limit | สร้าง OAuth client ของตัวเอง (ขั้นตอน 2) |
| `rclone: The term 'rclone' is not recognized` | ยังไม่ได้ติดตั้ง rclone บนเครื่อง Windows | `winget install Rclone.Rclone` แล้วเปิด terminal ใหม่ |
| `Error 403: access_denied` ตอน login Google | Email ที่ login ไม่อยู่ใน Test users list ของ OAuth consent screen | เพิ่ม email ใน Test users (ขั้นตอน 2) |
| `Email addresses must be associated with an active Google Account` | พิมพ์ email ผิด (typo) | ตรวจสอบการสะกด email ให้ถูกต้อง |
| `echo $?` ได้ `1` โดยไม่มี error message, log ว่างเปล่า | รันผ่าน `sudo -u np-dms` ทำให้ `$HOME` ไม่ถูกต้อง, rclone หา config ไม่เจอ | รันคำสั่งตรง ๆ โดยไม่ผ่าน `sudo -u` ถ้า login เป็น user นั้นอยู่แล้ว |

---

## หมายเหตุเพิ่มเติม
- **ไม่ใช้ `bisync`** เพราะทั้งสอง job เป็น one-way (local → Drive); ทีมไม่ควรแก้ไฟล์บน Drive แล้วคาดหวังให้ sync กลับเข้า repo — workflow การแก้โค้ด/เอกสารควรผ่าน Gitea ปกติ
- ใช้ full path `/usr/bin/rclone` ใน crontab เพราะ cron ไม่โหลด `$PATH` แบบ shell ปกติ
