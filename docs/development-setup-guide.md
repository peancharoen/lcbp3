# คู่มือการตั้งค่าและเริ่มต้น Development (Development Setup Guide)

> **LCBP3-DMS — Document Management System**
> เอกสารนี้ครอบคลุมขั้นตอนการตั้งค่า environment สำหรับการพัฒนาทั้ง Backend และ Frontend
> 
> อัปเดตล่าสุด: 2026-05-20

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [การติดตั้งเครื่องมือพื้นฐาน](#การติดตั้งเครื่องมือพื้นฐาน)
3. [การตั้งค่า Docker Services Stack](#การตั้งค่า-docker-services-stack)
4. [การตั้งค่า Environment Variables](#การตั้งค่า-environment-variables)
5. [การติดตั้ง Dependencies](#การติดตั้ง-dependencies)
6. [การตั้งค่า Database](#การตั้งค่า-database)
7. [การเริ่มต้น Backend Development](#การเริ่มต้น-backend-development)
8. [การเริ่มต้น Frontend Development](#การเริ่มต้น-frontend-development)
9. [การทดสอบระบบ](#การทดสอบระบบ)
10. [การ Debug และ Troubleshooting](#การ-debug-และ-troubleshooting)
11. [Checklist ก่อนเริ่มทำงาน](#checklist-ก่อนเริ่มทำงาน)

---

## Prerequisites

### ระบบที่รองรับ

- **Operating System**: Windows 10/11, macOS, Linux
- **RAM**: ขั้นต่ำ 8GB (แนะนำ 16GB)
- **Disk Space**: ขั้นต่ำ 10GB

### เครื่องมือที่ต้องการ

| Tool | Minimum Version | Recommended | หมายเหตุ |
|------|----------------|--------------|-----------|
| **Node.js** | >=24.0.0 | 24.15.0 LTS | ใช้ LTS version |
| **pnpm** | >=10.33.0 | 10.33.0 | Package manager |
| **Docker Desktop** | >=24.x | Latest | สำหรับ services stack |
| **Git** | >=2.x | Latest | Version control |

---

## การติดตั้งเครื่องมือพื้นฐาน

### 1. ติดตั้ง Node.js

ดาวน์โหลดจาก: https://nodejs.org/

```bash
# ตรวจสอบ version หลังติดตั้ง
node -v
# ควรได้: v24.15.0 หรือสูงกว่า
```

### 2. ติดตั้ง pnpm

```bash
# ติดตั้ง pnpm ผ่าน npm
npm install -g pnpm

# หรือใช้ standalone installer
# ดูที่: https://pnpm.io/installation

# ตรวจสอบ version
pnpm -v
# ควรได้: 10.33.0 หรือสูงกว่า
```

### 3. ติดตั้ง Docker Desktop

ดาวน์โหลดจาก: https://www.docker.com/products/docker-desktop/

- เลือก Docker Desktop for Windows/Mac/Linux
- ติดตั้งและรัน Docker Desktop
- ตรวจสอบว่า Docker ทำงานได้:

```bash
docker -v
# ควรได้: Docker version 24.x.x

docker ps
# ควรแสดง container list (ว่างหรือมี container)
```

### 4. ติดตั้ง Git

ดาวน์โหลดจาก: https://git-scm.com/

```bash
git --version
# ควรได้: git version 2.x.x
```

---

## การตั้งค่า Docker Services Stack

Services Stack ประกอบด้วย:
- **MariaDB** - Database
- **Redis** - Cache & Queue
- **Elasticsearch** - Search engine
- **Qdrant** - Vector store (AI)
- **ClamAV** - Virus scanning
- **phpMyAdmin** - Database management tool

### 1. Clone Repository

```bash
git clone https://git.np-dms.work/np-dms/lcbp3.git
cd lcbp3
```

### 2. รัน Docker Services

```bash
cd backend
docker compose up -d
```

ตรวจสอบสถานะ services:

```bash
docker compose ps
```

ควรเห็น services ทั้งหมดในสถานะ "Up" หรือ "healthy"

| Service | Port | Credentials |
|---------|------|-------------|
| **MariaDB** | 3306 | user: `admin` / pass: `Center2025` / DB: `lcbp3_dev` |
| **Redis** | 16379 | password: `Center2025` |
| **Elasticsearch** | 9200 | No auth (dev mode) |
| **Qdrant** | 6333 | No auth |
| **ClamAV** | 3310 | No auth |
| **phpMyAdmin** | 8080 | user: `admin` / pass: `Center2025` |

### 3. ตรวจสอบ Services Health

```bash
# ตรวจสอบ MariaDB
docker compose exec mariadb mysql -u admin -pCenter2025 -e "SHOW DATABASES;"

# ตรวจสอบ Redis
docker compose exec redis redis-cli -a Center2025 ping
# ควรได้: PONG

# ตรวจสอบ Elasticsearch
curl http://localhost:9200/_cluster/health
```

---

## การตั้งค่า Environment Variables

### Backend Environment Variables

สร้างไฟล์ `.env` ใน `backend/`:

```bash
cd backend
cp .env.example .env
```

แก้ไขค่าสำคัญใน `backend/.env`:

```dotenv
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=admin
DB_PASSWORD=Center2025
DB_DATABASE=lcbp3_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=16379
REDIS_PASSWORD=Center2025

# JWT - สร้างด้วยคำสั่ง: openssl rand -base64 32
JWT_SECRET=<ใส่ค่าที่สร้างจาก openssl>

# File Storage
UPLOAD_DEST=./uploads
MAX_FILE_SIZE=52428800

# ClamAV
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# AI Services (ถ้ามี AI Host)
AI_HOST_URL=http://192.168.10.100:11434
AI_QDRANT_URL=http://192.168.10.100:6333
OLLAMA_URL=http://192.168.10.100:11434
OLLAMA_MODEL_MAIN=gemma4:e4b
OLLAMA_MODEL_EMBED=nomic-embed-text
```

**สร้าง JWT_SECRET:**

```bash
openssl rand -base64 32
```

### Frontend Environment Variables

สร้างไฟล์ `.env.local` ใน `frontend/`:

```bash
cd frontend
cp .env.example .env.local
```

แก้ไขค่าใน `frontend/.env.local`:

```dotenv
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# NextAuth Configuration - สร้างด้วย: openssl rand -base64 32
AUTH_SECRET=<ใส่ค่าที่สร้างจาก openssl>
```

**สร้าง AUTH_SECRET:**

```bash
openssl rand -base64 32
```

**⚠️ สำคัญ:** JWT_SECRET และ AUTH_SECRET ต้องเป็นค่าที่ต่างกัน

---

## การติดตั้ง Dependencies

### ติดตั้ง Dependencies ทั้งหมด (Monorepo)

จาก root directory ของ project:

```bash
cd lcbp3
pnpm install
```

คำสั่งนี้จะติดตั้ง dependencies สำหรับ:
- Root workspace
- Backend
- Frontend

### ติดตั้งเฉพาะ Backend

```bash
cd backend
pnpm install
```

### ติดตั้งเฉพาะ Frontend

```bash
cd frontend
pnpm install
```

---

## การตั้งค่า Database

### 1. Import Schema (ครั้งแรกเท่านั้น)

ถ้า database ว่างหรือเพิ่งสร้างใหม่:

```bash
# จาก root directory
mysql -u admin -pCenter2025 lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-01-drop.sql
mysql -u admin -pCenter2025 lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql
mysql -u admin -pCenter2025 lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-03-views-indexes.sql
```

### 2. Import Seed Data

```bash
mysql -u admin -pCenter2025 lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-basic.sql
mysql -u admin -pCenter2025 lcbp3_dev < specs/03-Data-and-Storage/lcbp3-v1.8.0-seed-permissions.sql
```

### 3. หรือใช้คำสั่ง Seed จาก Backend

```bash
cd backend
pnpm seed
```

### 4. ตรวจสอบ Database

ผ่าน phpMyAdmin: http://localhost:8080

หรือผ่าน command line:

```bash
mysql -u admin -pCenter2025 lcbp3_dev
mysql> SHOW TABLES;
mysql> SELECT COUNT(*) FROM users;
mysql> SELECT COUNT(*) FROM organizations;
```

---

## การเริ่มต้น Backend Development

### 1. รัน Development Server

```bash
cd backend
pnpm run start:dev
```

หรือจาก root directory:

```bash
pnpm dev:backend
```

Backend จะรันที่: http://localhost:3001

### 2. เข้าถึง API Documentation

- **Swagger UI**: http://localhost:3001/api/docs
- **API Root**: http://localhost:3001/api

### 3. คำสั่งที่มีประโยชน์

```bash
# รันใน watch mode (auto-reload)
pnpm run start:dev

# Build สำหรับ production
pnpm run build

# รัน production build
pnpm run start:prod

# Run unit tests
pnpm run test

# Run e2e tests
pnpm run test:e2e

# Run test coverage
pnpm run test:cov

# Lint code
pnpm run lint

# Format code
pnpm run format
```

### 4. โครงสร้าง Backend

```
backend/
├── src/
│   ├── common/          # Shared utilities, guards, decorators
│   ├── config/          # Configuration module
│   ├── database/        # Database entities
│   ├── modules/         # Feature modules
│   │   ├── auth/
│   │   ├── user/
│   │   ├── project/
│   │   ├── correspondence/
│   │   ├── rfa/
│   │   ├── drawing/
│   │   ├── workflow-engine/
│   │   ├── ai/
│   │   └── ...
│   └── main.ts
├── test/                # Unit & E2E tests
├── uploads/             # File upload storage
└── package.json
```

### 5. การสร้าง Module ใหม่

ใช้ NestJS CLI:

```bash
cd backend
npx nest g module modules/<module-name>
npx nest g controller modules/<module-name>
npx nest g service modules/<module-name>
```

---

## การเริ่มต้น Frontend Development

### 1. รัน Development Server

```bash
cd frontend
pnpm run dev
```

หรือจาก root directory:

```bash
pnpm dev:frontend
```

Frontend จะรันที่: http://localhost:3000

### 2. เข้าถึง Application

- **Frontend**: http://localhost:3000
- **Login**: ใช้ credentials จาก seed data

### 3. คำสั่งที่มีประโยชน์

```bash
# รัน development server
pnpm run dev

# Build สำหรับ production
pnpm run build

# Start production server
pnpm run start

# Run unit tests (Vitest)
pnpm run test

# Run E2E tests (Playwright)
pnpm run test:e2e

# Lint code
pnpm run lint

# Type check
pnpm run type-check
```

### 4. โครงสร้าง Frontend

```
frontend/
├── app/                 # Next.js App Router
│   ├── (admin)/         # Admin panel routes
│   ├── (auth)/          # Authentication pages
│   ├── (dashboard)/     # Main dashboard routes
│   └── api/             # API routes
├── components/          # React Components
├── lib/                 # Utilities & API clients
├── hooks/               # Custom React hooks
├── types/               # TypeScript definitions
├── public/              # Static assets
└── package.json
```

### 5. การสร้าง Page ใหม่

ใช้ Next.js App Router:

```bash
cd frontend/app/(dashboard)/<feature>
mkdir <feature>
```

สร้าง `page.tsx` และ `layout.tsx` ตามโครงสร้างที่มีอยู่

---

## การทดสอบระบบ

### 1. ทดสอบ Backend API

```bash
# ทดสอบ health check
curl http://localhost:3001/api

# ทดสอบ login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@np-dms.work","password":"<password>"}'
```

### 2. ทดสอบ Frontend

เปิด browser ไปที่: http://localhost:3000

- ลอง login ด้วย credentials จาก seed data
- เข้าไปดูหน้า dashboard
- ทดสอบสร้าง/แก้ไขข้อมูล

### 3. รัน Tests

**Backend:**

```bash
cd backend
pnpm run test           # Unit tests
pnpm run test:e2e       # E2E tests
```

**Frontend:**

```bash
cd frontend
pnpm run test           # Vitest unit tests
pnpm run test:e2e       # Playwright E2E tests
```

---

## การ Debug และ Troubleshooting

### ปัญหาที่พบบ่อย

#### 1. Docker Services ไม่รัน

```bash
# ตรวจสอบ logs
docker compose logs

# รันใหม่
docker compose down
docker compose up -d

# ตรวจสอบ port conflicts
netstat -ano | findstr :3306
```

#### 2. Database Connection Error

ตรวจสอบ:
- Docker services รันอยู่หรือไม่
- Credentials ใน `.env` ตรงกับ services หรือไม่
- Database ถูกสร้างแล้วหรือยัง

```bash
# ทดสอบ connection
docker compose exec mariadb mysql -u admin -pCenter2025 lcbp3_dev
```

#### 3. Backend ไม่รัน

ตรวจสอบ:
- Dependencies ติดตั้งครบหรือไม่
- Environment variables ตั้งค่าถูกต้องหรือไม่
- Port 3001 ไม่ถูกใช้โดย process อื่น

```bash
# ตรวจสอบ port
netstat -ano | findstr :3001

# ลบ process ถ้าจำเป็น
taskkill /PID <PID> /F
```

#### 4. Frontend ไม่รัน

ตรวจสอบ:
- Dependencies ติดตั้งครบหรือไม่
- `NEXT_PUBLIC_API_URL` ชี้ไปที่ backend ที่ถูกต้อง
- Port 3000 ไม่ถูกใช้โดย process อื่น

#### 5. TypeScript Errors

```bash
# Backend type check
cd backend
pnpm run build

# Frontend type check
cd frontend
pnpm run type-check
```

### การ Debug ด้วย VS Code

**Backend:**
1. เปิด folder `backend/` ใน VS Code
2. กด F5 หรือไปที่ Run and Debug
3. เลือก "Launch NestJS"

**Frontend:**
1. เปิด folder `frontend/` ใน VS Code
2. กด F5 หรือไปที่ Run and Debug
3. เลือก "Launch Next.js"

---

## Checklist ก่อนเริ่มทำงาน

### Prerequisites

- [ ] Node.js >=24.0.0 ติดตั้งแล้ว
- [ ] pnpm >=10.33.0 ติดตั้งแล้ว
- [ ] Docker Desktop ติดตั้งและรันอยู่
- [ ] Git ติดตั้งแล้ว
- [ ] Repository clone เรียบร้อย

### Docker Services

- [ ] `docker compose up -d` รันใน `backend/` แล้ว
- [ ] ทุก services อยู่ในสถานะ "Up" หรือ "healthy"
- [ ] MariaDB สามารถเชื่อมต่อได้
- [ ] Redis สามารถเชื่อมต่อได้
- [ ] Elasticsearch สามารถเชื่อมต่อได้

### Environment Variables

- [ ] `backend/.env` สร้างแล้ว
- [ ] `JWT_SECRET` ตั้งค่าแล้ว (ใช้ค่าที่ generate)
- [ ] `frontend/.env.local` สร้างแล้ว
- [ ] `AUTH_SECRET` ตั้งค่าแล้ว (ใช้ค่าที่ generate)
- [ ] `JWT_SECRET` และ `AUTH_SECRET` เป็นค่าที่ต่างกัน
- [ ] Database credentials ตรงกับ Docker services

### Database

- [ ] Schema import เรียบร้อย (ครั้งแรก)
- [ ] Seed data import เรียบร้อย (ครั้งแรก)
- [ ] ตรวจสอบว่า tables ถูกสร้างแล้ว
- [ ] ตรวจสอบว่า seed data มีอยู่

### Dependencies

- [ ] `pnpm install` ที่ root สำเร็จ
- [ ] Backend dependencies ติดตั้งครบ
- [ ] Frontend dependencies ติดตั้งครบ

### Development Servers

- [ ] Backend รันที่ http://localhost:3001
- [ ] Frontend รันที่ http://localhost:3000
- [ ] Swagger UI เข้าถึงได้ที่ http://localhost:3001/api/docs
- [ ] ไม่มี error ใน console logs

### Testing

- [ ] ทดสอบ login ผ่าน frontend ได้
- [ ] ทดสอบ API endpoints ผ่าน Swagger ได้
- [ ] Unit tests รันผ่าน (backend)
- [ ] Unit tests รันผ่าน (frontend)

---

## ทรัพยากรเพิ่มเติม

### เอกสารประกอบ

- **Project README**: `README.md`
- **Backend Guidelines**: `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md`
- **Frontend Guidelines**: `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md`
- **ADR-019 UUID Strategy**: `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md`
- **ADR-007 Error Handling**: `specs/06-Decision-Records/ADR-007-error-handling-strategy.md`

### Tools & Documentation

- **NestJS Docs**: https://docs.nestjs.com/
- **Next.js Docs**: https://nextjs.org/docs
- **TypeORM Docs**: https://typeorm.io/
- **React Hook Form**: https://react-hook-form.com/
- **TanStack Query**: https://tanstack.com/query/latest

### Dev URLs

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:3001/api |
| **Swagger UI** | http://localhost:3001/api/docs |
| **phpMyAdmin** | http://localhost:8080 |
| **Elasticsearch** | http://localhost:9200 |
| **Qdrant Dashboard** | http://localhost:6333/dashboard |

---

## การปิดระบบ Development

```bash
# หยุด backend และ frontend (Ctrl+C)

# หยุด Docker services
cd backend
docker compose down

# หรือหยุดและลบ volumes (ข้อมูล DB จะหาย)
docker compose down -v
```

---

## คำถามที่พบบ่อย (FAQ)

### Q: ต้องรัน Docker services ทุกครั้งหรือไม่?
A: ใช่ ต้องรัน `docker compose up -d` ใน `backend/` ก่อนเริ่ม development ทุกครั้ง

### Q: สามารถรันเฉพาะ backend หรือ frontend ได้ไหม?
A: ได้ ใช้คำสั่ง `pnpm dev:backend` หรือ `pnpm dev:frontend` จาก root directory

### Q: JWT_SECRET และ AUTH_SECRET ต้องเหมือนกันหรือไม่?
A: ไม่ ต้องเป็นค่าที่ต่างกันเพื่อความปลอดภัย

### Q: ต้อง import schema ทุกครั้งหรือไม่?
A: ไม่ ต้อง import เฉพาะครั้งแรกเท่านั้น หรือเมื่อมีการเปลี่ยนแปลง schema

### Q: ถ้าต้องการ reset database ทั้งหมด?
A: รัน `docker compose down -v` แล้ว import schema ใหม่

---

## ข้อควรระวัง

⚠️ **Security:**
- ห้าม commit `.env` หรือ `.env.local` ไฟล์
- ห้ามใช้ค่า secrets จริงใน production
- เปลี่ยน password สำหรับ production environment

⚠️ **Data Integrity:**
- อย่าแก้ไข database schema โดยตรงโดยไม่ทำตาม ADR-009
- ใช้ seed data สำหรับ development เท่านั้น

⚠️ **Performance:**
- ปิด Docker services เมื่อไม่ใช้งานเพื่อประหยัด resources
- ใช้ watch mode สำหรับ development เท่านั้น (ไม่ใช่ production)

---

**สำหรับคำถามเพิ่มเติม หรือปัญหาที่พบ กรุณาติดต่อทีม Development หรือสร้าง Issue ใน Gitea**
