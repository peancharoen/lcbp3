// File: docs/local-dev-setup.md
// Change Log
// - 2026-05-22: แก้ไข IP Address ของเซิร์ฟเวอร์ AI จาก 192.168.10.100 เป็น 192.168.10.8 เพื่อให้ตรงกับสภาพแวดล้อมจริง
# Local Dev Setup Guide

> วิธีตั้งค่าและรัน Development Environment สำหรับ LCBP3 NAP-DMS
> อัปเดตล่าสุด: 2026-05-18

---

## Prerequisites

| Tool | Required Version |
|---|---|
| **Node.js** | `>=24.0.0` |
| **pnpm** | `>=10.33.0` |
| **Docker Desktop** | สำหรับ services stack |

ตรวจสอบ version:
```bash
node -v
pnpm -v
docker -v
```

---

## 1. Services Stack (Docker Compose)

รัน `docker-compose up -d` ใน `backend/`:

```bash
docker compose up -d
```

| Service | Port | Credentials |
|---|---|---|
| **MariaDB** | `3306` | user: `admin` / pass: `Center2025` / DB: `lcbp3_dev` |
| **Redis** | `16379` | password: `Center2025` |
| **Elasticsearch** | `9200` | No auth (dev mode) |
| **Qdrant** | `6333` | No auth |
| **phpMyAdmin** | `8080` | optional — ใช้ดู DB ผ่านเว็บ |

---

## 2. Environment Files

### Backend — `backend/.env`

Copy จาก `.env.example`:

```bash
cp backend/.env.example backend/.env
```

ค่าหลักที่ต้องแก้:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=admin
DB_PASSWORD=Center2025
DB_DATABASE=lcbp3_dev

REDIS_HOST=localhost
REDIS_PORT=16379
REDIS_PASSWORD=Center2025

JWT_SECRET=<สร้างด้วย openssl rand -base64 32>

# AI services (ถ้าไม่ใช้ AI ให้ปล่อยค่าเดิมได้)
OLLAMA_URL=http://192.168.10.8:11434
AI_HOST_URL=http://192.168.10.8:11434
AI_QDRANT_URL=http://192.168.10.8:6333
```

### Frontend — `frontend/.env.local`

Copy จาก `.env.example`:

```bash
cp frontend/.env.example frontend/.env.local
```

ค่าหลักที่ต้องแก้:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
AUTH_SECRET=<สร้างด้วย openssl rand -base64 32>
```

---

## 3. Install Dependencies

จาก root ของ project:

```bash
pnpm install
```

---

## 4. Start Dev Servers

```bash
# รันทั้ง backend + frontend พร้อมกัน (recommended)
pnpm dev

# หรือแยกรัน
pnpm dev:backend    # NestJS → http://localhost:3001
pnpm dev:frontend   # Next.js → http://localhost:3000
```

---

## 5. Seed Database (ครั้งแรก)

ถ้า DB ว่างหรือเพิ่ง setup ใหม่:

```bash
pnpm --filter backend seed
```

---

## Checklist ก่อน run

- [ ] Node.js `>=24` + pnpm `>=10.33.0` ติดตั้งแล้ว
- [ ] `docker compose up -d` รันใน `backend/` และ services ทุกตัว healthy
- [ ] `backend/.env` สร้างแล้ว และตั้ง `JWT_SECRET`
- [ ] `frontend/.env.local` สร้างแล้ว และตั้ง `AUTH_SECRET`
- [ ] `pnpm install` ที่ root สำเร็จ
- [ ] `pnpm --filter backend seed` รันแล้ว (ครั้งแรก)
- [ ] `pnpm dev` และ backend + frontend start สำเร็จ

---

## Dev URLs

| Service | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:3001/api |
| **Swagger UI** | http://localhost:3001/api/docs |
| **phpMyAdmin** | http://localhost:8080 |
| **Elasticsearch** | http://localhost:9200 |
| **Qdrant Dashboard** | http://localhost:6333/dashboard |
