# การ Deploy Application (Backend + Frontend) บน QNAP

> 📍 **Version:** v1.7.0
> 🖥️ **Server:** QNAP TS-473A (Container Station)
> 🔗 **Docker Compose Path:** `/share/np-dms/app/docker-compose.yml`

---

## 📋 Prerequisites

ก่อน deploy ต้องมี services เหล่านี้รันอยู่แล้ว:

| Service        | Container Name | Docker Compose                     | Status |
| :------------- | :------------- | :--------------------------------- | :----- |
| MariaDB        | `mariadb`      | `lcbp3-db` (MariaDB_setting.md)    | ✅      |
| Redis          | `cache`        | `services` (04_Service_setting.md) | ✅      |
| Elasticsearch  | `search`       | `services` (04_Service_setting.md) | ✅      |
| NPM            | `npm`          | `lcbp3-npm` (NPM_setting.md)       | ✅      |
| Docker Network | `lcbp3`        | `docker network create lcbp3`      | ✅      |

---

## 1. Build Docker Images

### Option A: Build บน Dev Machine แล้ว Transfer

```bash
# อยู่ที่ workspace root (nap-dms.lcbp3/)

# Build Backend
docker build -f backend/Dockerfile -t lcbp3-backend:latest .

# Build Frontend (NEXT_PUBLIC_API_URL bake เข้าไปตอน build)
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api \
  -t lcbp3-frontend:latest .

# Export เป็น .tar เพื่อ Transfer
docker save lcbp3-backend:latest | gzip > lcbp3-backend.tar.gz
docker save lcbp3-frontend:latest | gzip > lcbp3-frontend.tar.gz

# Transfer ไปยัง QNAP (ผ่าน SCP หรือ Shared Folder)
scp lcbp3-*.tar.gz admin@192.168.10.8:/share/np-dms/app/
```

### Option B: Build บน QNAP โดยตรง (SSH)

```bash
# SSH เข้า QNAP
ssh admin@192.168.10.8

# Clone หรือ Pull code จาก Gitea
cd /share/np-dms/app/source
git pull origin main

# Build images
docker build -f backend/Dockerfile -t lcbp3-backend:latest .
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api \
  -t lcbp3-frontend:latest .
```

---

## 2. Load Images บน QNAP (เฉพาะ Option A)

```bash
# SSH เข้า QNAP
ssh admin@192.168.10.8

# Load images
docker load < /share/np-dms/app/lcbp3-backend.tar.gz
docker load < /share/np-dms/app/lcbp3-frontend.tar.gz

# ตรวจสอบ
docker images | grep lcbp3
```

---

## 3. สร้าง Directories และกำหนดสิทธิ์

```bash
# สร้าง directories สำหรับ volumes
mkdir -p /share/dms-data/uploads/temp
mkdir -p /share/dms-data/uploads/permanent
mkdir -p /share/dms-data/logs/backend
mkdir -p /share/np-dms/app

# กำหนดสิทธิ์ให้ non-root user ใน container (UID 1001)
chown -R 1001:1001 /share/dms-data/uploads
chown -R 1001:1001 /share/dms-data/logs/backend
chmod -R 750 /share/dms-data/uploads
```

---

## 4. Deploy ผ่าน Container Station

### 4.1 Copy docker-compose.yml

คัดลอกไฟล์ `specs/08-infrastructure/docker-compose-app.yml` ไปยัง QNAP:

```bash
# วางไฟล์ที่ path
/share/np-dms/app/docker-compose.yml
```

### 4.2 สร้าง Application ใน Container Station

1. เปิด **Container Station** บน QNAP Web UI
2. ไปที่ **Applications** → **Create**
3. เลือก **Create Application**
4. ตั้งชื่อ Application: `lcbp3-app`
5. วาง (Paste) เนื้อหาจาก `docker-compose-app.yml`
6. แก้ไข Environment Variables ตามต้องการ (โดยเฉพาะ Secrets)
7. กด **Create** เพื่อ deploy

> ⚠️ **สำคัญ:** ตรวจสอบ environment variables ก่อน deploy:
> - `DB_PASSWORD` — Password ของ MariaDB
> - `REDIS_PASSWORD` — Password ของ Redis
> - `JWT_SECRET` — Secret key สำหรับ JWT Tokens
> - `AUTH_SECRET` — Secret key สำหรับ NextAuth

### 4.3 ตรวจสอบ Container Status

ใน Container Station → Applications → `lcbp3-app`:
- ✅ `backend` — Status: **Running** (healthy)
- ✅ `frontend` — Status: **Running** (healthy)

---

## 5. Verify Deployment

### ตรวจสอบ Health

```bash
# Backend health (จากภายใน Docker network)
docker exec frontend wget -qO- http://backend:3000/health

# Frontend (ผ่าน NPM)
curl -I https://lcbp3.np-dms.work

# Backend API (ผ่าน NPM)
curl -I https://backend.np-dms.work/api
```

### ตรวจสอบ Logs

```bash
# ดู logs ใน Container Station UI
# หรือผ่าน CLI:
docker logs -f backend
docker logs -f frontend
```

---

## 6. Update / Re-deploy

เมื่อต้องการ deploy version ใหม่:

```bash
# 1. Build images ใหม่ (บน Dev Machine)
docker build -f backend/Dockerfile -t lcbp3-backend:latest .
docker build -f frontend/Dockerfile -t lcbp3-frontend:latest .

# 2. Export & Transfer
docker save lcbp3-backend:latest | gzip > lcbp3-backend.tar.gz
docker save lcbp3-frontend:latest | gzip > lcbp3-frontend.tar.gz
scp lcbp3-*.tar.gz admin@192.168.10.8:/share/np-dms/app/

# 3. Load บน QNAP
ssh admin@192.168.10.8
docker load < /share/np-dms/app/lcbp3-backend.tar.gz
docker load < /share/np-dms/app/lcbp3-frontend.tar.gz

# 4. Restart ใน Container Station
#    Applications → lcbp3-app → Restart
```

---

## 📦 Resource Summary

| Service      | Image                   | CPU Limit | Memory Limit | Port |
| :----------- | :---------------------- | :-------- | :----------- | :--- |
| **backend**  | `lcbp3-backend:latest`  | 2.0       | 1.5 GB       | 3000 |
| **frontend** | `lcbp3-frontend:latest` | 2.0       | 2 GB         | 3000 |

> 📖 NPM Proxy Hosts ตั้งค่าเรียบร้อยแล้ว:
> - `lcbp3.np-dms.work` → `frontend:3000`
> - `backend.np-dms.work` → `backend:3000`
