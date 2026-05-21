// File: docs/deployment-setup-guide.md
# คู่มือการตั้งค่าและการ Deploy ระบบ (Deployment Setup Guide)

> **Project:** NAP-DMS (LCBP3)  
> **Version:** 1.9.5  
> **Last Updated:** 2026-05-21  
> **Stack:** NestJS + Next.js + MariaDB + Redis + Elasticsearch + Qdrant  
> **Target Platform:** QNAP TS-473A (Container Station) + ASUSTOR AS5403T (Gitea Runner)

---

## 🏗️ 1. สถาปัตยกรรมระบบการ Deploy (Deployment Architecture)

ระบบ DMS แยกการทำงานออกเป็นเซิร์ฟเวอร์หลัก 2 เครื่องเพื่อความปลอดภัยและประสิทธิภาพสูงสุด (Server Role Separation):
- **QNAP Server (TS-473A) - `192.168.10.8` (VLAN 10):** เป็นเซิร์ฟเวอร์หลักที่รันฐานข้อมูล, Cache, Search Engine และรัน Application Containers (Frontend + Backend) รวมถึง Git Server (Gitea) และ Nginx Proxy Manager (NPM)
- **ASUSTOR Server (AS5403T) - `192.168.10.9` (VLAN 10):** เป็นเซิร์ฟเวอร์สำหรับรัน CI/CD Gitea Runner (`act_runner`) เพื่อแยกโหลดการ Build โค้ดออกจากโปรดักชันเซิร์ฟเวอร์

```
[ ASUSTOR Runner ] (192.168.10.9)
       │
       │ SSH (Via Private Key)
       ▼
[ QNAP TS-473A ] (192.168.10.8)
       ├── Git Pull & Build (BuildKit)
       └── Restart Stack (docker compose --force-recreate)
```

---

## 🔐 2. การตั้งค่า SSH Key Authentication (Persistent SSH Setup)

เนื่องจาก QNAP จะรีเซ็ต Directory `/` ไปเป็น RAM หลังการ Reboot ทำให้เกิดปัญหา SSH Key หาย เราจำเป็นต้องตั้งค่าให้เป็น Persistent SSH:

### 2.1 บน ASUSTOR (Gitea Runner)
สร้าง SSH Key Pair และเก็บไว้ในโฟลเดอร์ถาวร:
- **Private Key:** `/etc/config/ssh/gitea-runner`
- **Public Key:** `/etc/config/ssh/gitea-runner.pub`

### 2.2 บน QNAP (Target Server)
1. นำเนื้อหา Public Key ไปเพิ่มในไฟล์ `authorized_keys`:
   ```bash
   mkdir -p /etc/config/ssh
   # เพิ่ม public key ลงไป (ต้องอยู่ภายในบรรทัดเดียว ห้ามเว้นวรรคผิดพลาด)
   nano /etc/config/ssh/authorized_keys
   ```
2. แก้ไขไฟล์คอนฟิก SSH ของ QNAP (สำคัญมาก: ต้องแก้ไฟล์ที่ **`/etc/config/ssh/sshd_config`** เท่านั้น ไม่ใช่ `/etc/ssh/sshd_config`):
   ```ini
   # ตั้งค่า AuthorizedKeysFile ชี้ไปที่ absolute path ของโฟลเดอร์คอนฟิกถาวร
   AuthorizedKeysFile /etc/config/ssh/authorized_keys
   ```
   *หมายเหตุ: ห้ามใช้ relative path เช่น `.ssh/authorized_keys` เด็ดขาด เพราะระบบจะไปหาที่ `/share/homes/admin/.ssh/` แทนที่จะเป็น `/root/.ssh/`*

3. Reload QNAP SSH daemon (เนื่องจาก QNAP ไม่มี `pgrep` และ `systemctl` ให้ใช้คำสั่งนี้):
   ```bash
   kill -HUP $(ps | grep "/usr/sbin/sshd -f /etc/config" | grep -v grep | awk '{print $1}')
   ```

---

## 📁 3. การเตรียมโครงสร้างโฟลเดอร์บน QNAP

ล็อกอินเข้า QNAP ผ่าน SSH และรันคำสั่งเตรียม Directory โครงสร้างพื้นฐาน:

```bash
# 1. โฟลเดอร์หลักสำหรับ App Source และ Build Script
mkdir -p /share/np-dms/app/source

# Clone repository (ครั้งแรกครั้งเดียว)
cd /share/np-dms/app/source
git clone https://git.np-dms.work/np-dms/lcbp3.git

# 2. โฟลเดอร์สำหรับเก็บไฟล์อัปโหลดและ Logs
mkdir -p /share/np-dms/data/uploads/temp
mkdir -p /share/np-dms/data/uploads/permanent
mkdir -p /share/np-dms/data/logs/backend

# 3. ตั้งค่าสิทธิ์โฟลเดอร์ (UID 1001 คือ NestJS User ภายใน Container)
chown -R 1001:1001 /share/np-dms/data/uploads
chown -R 1001:1001 /share/np-dms/data/logs/backend
chmod -R 750 /share/np-dms/data/uploads

# 4. โฟลเดอร์สำหรับ persistent volumes ของ DB/Services อื่นๆ
mkdir -p /volume1/lcbp3/volumes/mariadb-data
mkdir -p /volume1/lcbp3/volumes/redis-data
mkdir -p /volume1/lcbp3/volumes/elastic-data
```

---

## 📝 4. การจัดการ Environment Variables (`.env`)

สร้างไฟล์ `.env` ที่ **`/share/np-dms/app/.env`** บน QNAP โดยตรง  
⚠️ *กฎความปลอดภัย (Tier 1): ห้าม Commit ไฟล์นี้ขึ้น Git หรือเก็บในโฟลเดอร์ Source Code เด็ดขาด!*

```dotenv
# File: /share/np-dms/app/.env

# Application Configuration
NODE_ENV=production
APP_NAME=LCBP3-DMS
NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api
AUTH_URL=https://lcbp3.np-dms.work

# Database (MariaDB native UUID v7 - ADR-019)
DB_HOST=mariadb
DB_PORT=3306
DB_USERNAME=lcbp3_user
DB_PASSWORD=<STRONG_DATABASE_PASSWORD>
DB_DATABASE=lcbp3_dms
DB_POOL_SIZE=20

# Redis Cache & BullMQ (ADR-008)
REDIS_HOST=cache
REDIS_PORT=6379
REDIS_PASSWORD=<STRONG_REDIS_PASSWORD>
REDIS_DB=0

# Security Credentials (Tier 1)
JWT_SECRET=<สร้างด้วย openssl rand -base64 32>
AUTH_SECRET=<สร้างด้วย openssl rand -base64 32>

# File Upload Security (Tier 1)
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=52428800 # 50MB
ALLOWED_FILE_TYPES=.pdf,.doc,.docx,.xls,.xlsx,.dwg,.zip

# ClamAV Antivirus
CLAMAV_HOST=lcbp3-clamav
CLAMAV_PORT=3310

# AI Services Boundary (ADR-023/ADR-023A - Isolation on Admin Desktop)
OLLAMA_URL=http://192.168.10.100:11434
AI_HOST_URL=http://192.168.10.100:11434
AI_QDRANT_URL=http://192.168.10.100:6333
```

---

## 🔄 5. การตั้งค่า CI/CD Gitea Actions

ใน Gitea Web UI ไปที่ repository → **Settings** → **Actions** → **Secrets** เพื่อเพิ่มตัวแปรลับ (Secrets) ที่ใช้เชื่อมต่อ SSH ไปยัง QNAP:

| Secret Name | Value | คำอธิบาย |
| :--- | :--- | :--- |
| `HOST` | `192.168.10.8` | IP Address ของ QNAP (VLAN 10) |
| `PORT` | `22` | พอร์ต SSH (Default: 22) |
| `USERNAME` | `admin` | สิทธิ์แอดมินในการควบคุม Container ของ QNAP |
| `SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | เนื้อหาในไฟล์คีย์ส่วนตัวจาก ASUSTOR (`/etc/config/ssh/gitea-runner`) |

---

## 🚀 6. ขั้นตอนการ Deploy

### 6.1 การ Deploy อัตโนมัติ (Automated CI/CD)
เมื่อมีการ Push โค้ดไปยังกิ่ง `main` ระบบ Gitea Actions จะรับงานไปรันบน ASUSTOR Runner:
1. เชื่อมต่อ SSH ไปยัง QNAP (สิทธิ์ `admin` ผ่าน SSH Key)
2. สั่ง `git pull` ดึงโค้ดล่าสุดลงโฟลเดอร์ `/share/np-dms/app/source/lcbp3`
3. เรียกใช้สคริปต์ `@/scripts/deploy.sh` ของโครงการเพื่อทำการ build และ deploy

### 6.2 การ Deploy ด้วยตนเอง (Manual Deploy)
หากพบปัญหาเรื่องเน็ตเวิร์ก หรือต้องการรัน Deploy เองตรงจาก QNAP:
```bash
# 1. SSH เข้า QNAP
ssh admin@192.168.10.8

# 2. ไปที่โฟลเดอร์ Repository และ pull โค้ดล่าสุด
cd /share/np-dms/app/source/lcbp3
git pull origin main

# 3. รันสคริปต์ Deploy
bash scripts/deploy.sh
```

### รายละเอียดการทำงานของ `deploy.sh`:
- **Build Step (BuildKit):** รันคำสั่ง Build Image ในแบบขนานกัน (Parallel) เพื่อลดเวลาก่อสร้าง:
  ```bash
  docker build -f backend/Dockerfile -t lcbp3-backend:latest . &
  docker build -f frontend/Dockerfile -t lcbp3-frontend:latest . &
  ```
- **Recreate Container:** ใช้ `--force-recreate` ควบคู่กับ Environment file โปรดักชัน:
  ```bash
  docker compose --env-file /share/np-dms/app/.env -f specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/docker-compose-app.yml up -d --force-recreate
  ```
- **Health Check:** ตรวจสอบความถูกต้องของการสตาร์ตระบบ (Timeout 60 วินาที) ก่อนรายงานผลความสำเร็จ

---

## 🆘 7. การกู้คืนระบบและการแก้ปัญหา (Rollback & Troubleshooting)

### 7.1 การ Rollback ระบบ
หากหลังจาก Deploy พบว่าระบบทำงานบกพร่อง (Critical Bug):
1. **ผ่าน Gitea UI:** ไปที่แท็บ **Actions** → เลือกกิ่งที่มีเสถียรภาพตัวล่าสุด (Stable Commit) → กดปุ่ม **Re-run Jobs**
2. **รันคำสั่งตรงบน QNAP (SSH):**
   ```bash
   cd /share/np-dms/app/source/lcbp3
   # ตรวจหาแฮชคอมมิตก่อนหน้าที่มีความเสถียร
   git log --oneline -10
   # ย้อนกลับโค้ด
   git checkout <stable-commit-hash>
   # รันสร้างและดีพลอยใหม่ด้วยโค้ดเดิม
   bash scripts/deploy.sh
   ```

### 7.2 ปัญหาตู้คอนเทนเนอร์ค้าง (Container Removal Timeout)
หากตอน Deploy มีอาการค้างที่กระบวนการลบตู้อันเดิม:
```bash
# Force stop และลบตู้อันที่ค้าง
docker kill backend frontend 2>/dev/null || true
docker rm -f backend frontend 2>/dev/null || true

# ทำความสะอาด Cache และ Prune ของตกค้าง
docker system prune -f --volumes

# รีสตาร์ตตู้ Stack ทั้งหมดใหม่อีกครั้ง
bash scripts/deploy.sh
```

---

// Change Log:
// - 2026-05-21: จัดทำเอกสารคู่มือขั้นตอนการเซ็ตอัปการ Deploy สำหรับทีมปฏิบัติการและผู้พัฒนา (v1.9.5)
