# SSH Setting — QNAP & ASUSTOR

> คู่มือการตั้งค่าและใช้งาน SSH สำหรับ NAS ทั้ง 2 เครื่องในโปรเจกต์ NAP-DMS

---

## 📋 ข้อมูลการเชื่อมต่อ

| รายการ        | QNAP (TS-464)      | ASUSTOR (AS5402T)   |
| ------------- | ------------------ | ------------------- |
| **Role**      | Application Server | Monitoring / Backup |
| **IP**        | `192.168.10.8`     | `192.168.10.9`      |
| **SSH Port**  | `22`               | `22`                |
| **Username**  | `nattanin`         | `nattanin`          |
| **SSH Alias** | `qnap`             | `asustor`           |

---

## 1. เปิดใช้งาน SSH บน NAS

### 1.1 QNAP

1. เข้า **QTS Web UI** → `http://192.168.10.8:8080`
2. ไปที่ **Control Panel → Network & File Services → Telnet / SSH**
3. เปิด ✅ **Allow SSH connection**
4. ตั้ง Port เป็น `22`
5. คลิก **Apply**

### 1.2 ASUSTOR

1. เข้า **ADM Web UI** → `http://192.168.10.9:8000`
2. ไปที่ **Settings → Terminal & SNMP**
3. เปิด ✅ **Enable SSH service**
4. ตั้ง Port เป็น `22`
5. คลิก **Apply**

---

## 2. ตั้งค่า SSH Key (Client → NAS)

### 2.1 สร้าง SSH Key (ทำครั้งเดียวบนเครื่อง Client)

```powershell
# ตรวจสอบว่ามี key อยู่แล้วหรือไม่
ls ~/.ssh/id_ed25519*

# ถ้ายังไม่มี → สร้างใหม่
ssh-keygen -t ed25519 -C "nattanin@np-dms"
```

> **หมายเหตุ:** กด Enter ผ่าน passphrase ได้ หรือตั้ง passphrase เพื่อความปลอดภัยเพิ่มเติม

### 2.2 คัดลอก Public Key ไปยัง NAS

```powershell
# QNAP
ssh-copy-id -i ~/.ssh/id_ed25519.pub nattanin@192.168.10.8

# ASUSTOR
ssh-copy-id -i ~/.ssh/id_ed25519.pub nattanin@192.168.10.9
```

> **ถ้า `ssh-copy-id` ไม่มีบน Windows** ให้ทำ manual:

```powershell
# อ่าน public key
cat ~/.ssh/id_ed25519.pub

# SSH เข้า NAS ด้วย password ก่อน แล้วเพิ่ม key
ssh nattanin@192.168.10.8
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... your-email@example.com" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

### 2.3 ทดสอบการเชื่อมต่อ

```powershell
# ต้องเข้าได้โดยไม่ต้องใส่ password
ssh nattanin@192.168.10.8
ssh nattanin@192.168.10.9
```

---

## 3. ตั้งค่า SSH Config (Client)

ไฟล์: `~/.ssh/config` (Windows: `C:\Users\<username>\.ssh\config`)

```ssh-config
Host gitea
    HostName git.np-dms.work
    User git
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes

Host qnap
    HostName 192.168.10.8
    User nattanin
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes

Host asustor
    HostName 192.168.10.9
    User nattanin
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

### การใช้งาน Alias

```powershell
# แทนที่จะพิมพ์ ssh nattanin@192.168.10.8
ssh qnap

# แทนที่จะพิมพ์ ssh nattanin@192.168.10.9
ssh asustor

# Git push ไป Gitea (ใช้ alias gitea)
git push gitea main
```

---

## 4. คำสั่ง SSH ที่ใช้บ่อย

### 4.1 การเชื่อมต่อ

```powershell
# เชื่อมต่อปกติ
ssh qnap
ssh asustor

# เชื่อมต่อพร้อมระบุ port (กรณี port ไม่ใช่ 22)
ssh -p 2222 nattanin@192.168.10.8
```

### 4.2 คัดลอกไฟล์ (SCP)

```powershell
# คัดลอกไฟล์จาก Local → NAS
scp ./myfile.txt qnap:/share/np-dms/data/

# คัดลอกไฟล์จาก NAS → Local
scp qnap:/share/np-dms/data/myfile.txt ./

# คัดลอก Folder (recursive)
scp -r ./myfolder qnap:/share/np-dms/data/
```

### 4.3 รันคำสั่งบน NAS โดยไม่ต้อง Login

```powershell
# ดู Docker containers ที่กำลังรัน
ssh qnap "docker ps"

# ดู Disk usage
ssh qnap "df -h"

# ดู logs ของ container
ssh qnap "docker logs --tail 50 lcbp3-backend"

# Restart container
ssh qnap "docker restart lcbp3-backend"
```

### 4.4 Port Forwarding (Tunnel)

```powershell
# Forward port 3306 ของ QNAP มาที่ localhost:3306 (MariaDB)
ssh -L 3306:localhost:3306 qnap

# Forward port 9200 (Elasticsearch)
ssh -L 9200:localhost:9200 qnap

# Forward port 3000 (Grafana จาก ASUSTOR)
ssh -L 3000:localhost:3000 asustor
```

---

## 5. Hardening (เพิ่มความปลอดภัย)

> กำหนดค่าบน NAS แต่ละเครื่อง — ไฟล์: `/etc/ssh/sshd_config`

```bash
# ปิด login ด้วย password (ใช้ key เท่านั้น)
PasswordAuthentication no

# ปิด root login
PermitRootLogin no

# อนุญาตเฉพาะ user ที่ต้องการ
AllowUsers nattanin

# Restart SSH service (QNAP)
/etc/init.d/login_server.sh restart

# Restart SSH service (ASUSTOR)
/etc/init.d/sshd restart
```

> ⚠️ **คำเตือน:** ก่อนปิด `PasswordAuthentication` ให้แน่ใจว่า SSH Key ใช้งานได้แล้ว มิฉะนั้นจะเข้าไม่ได้ — ต้อง login ผ่าน Web UI เพื่อแก้ไข

---

## 6. Troubleshooting

| ปัญหา                            | สาเหตุ                      | วิธีแก้                                                                  |
| ------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| `Connection refused`            | SSH ไม่ได้เปิดบน NAS          | เปิด SSH ผ่าน Web UI (ตาม Section 1)                                    |
| `Permission denied (publickey)` | Key ไม่ตรงหรือ permission ผิด | ตรวจ `chmod 700 ~/.ssh` และ `chmod 600 ~/.ssh/authorized_keys` บน NAS |
| `Host key verification failed`  | IP เปลี่ยนแต่ key เก่ายังอยู่     | `ssh-keygen -R 192.168.10.8` แล้วเชื่อมต่อใหม่                             |
| `Connection timed out`          | Firewall block หรือ IP ผิด   | ตรวจ ACL ใน `03_Securities.md` และ ping ทดสอบ                         |
| `Network is unreachable`        | อยู่คนละ VLAN / subnet       | ตรวจ routing ใน `02_Network_daigram.md`                               |
