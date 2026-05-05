# Quick Start: Node.js v24.15.0 Upgrade

## Prerequisites

- Node.js v24.15.0 installed locally (via nvm หรือโหลดจาก nodejs.org)
- pnpm 9.x (`npm i -g pnpm@9`)
- Docker Desktop (สำหรับ test container builds)

## Local Development Upgrade

### 1. อัพเดท Node.js เวอร์ชัน

```bash
# ใช้ nvm (recommended)
nvm install 24.15.0
nvm use 24.15.0
node --version  # ตรวจสอบ v24.15.0

# หรือดาวน์โหลดจาก nodejs.org โดยตรง
# https://nodejs.org/download/release/v24.15.0/
```

### 2. รีเจนเนอเรท lockfile

```bash
# Backend
cd backend
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Frontend  
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 3. รันเทสต์

```bash
# Backend
cd backend
pnpm test
pnpm run test:e2e

# Frontend
cd frontend
pnpm test
```

### 4. Build Docker Images (Local Test)

```bash
# Backend
cd backend
docker build -t nap-dms-backend:v24-test .

# Frontend
cd frontend  
docker build -t nap-dms-frontend:v24-test .
```

## Rollback Procedure

หากพบปัญหาใน production:

```bash
# 1. Revert Dockerfile กลับไป node:22.20.0-alpine
git checkout HEAD~1 -- backend/Dockerfile frontend/Dockerfile

# 2. Revert package.json engines field
git checkout HEAD~1 -- backend/package.json frontend/package.json

# 3. Revert .nvmrc
git checkout HEAD~1 -- backend/.nvmrc frontend/.nvmrc

# 4. Rebuild และ redeploy
git commit -m "chore(node): rollback to v22.20.0"
```

## Verification Checklist

ก่อน commit:

- [ ] `node --version` แสดง v24.15.0
- [ ] `backend/.nvmrc` มีค่า `24.15.0`
- [ ] `frontend/.nvmrc` มีค่า `24.15.0`
- [ ] `backend/package.json` engines.node เป็น `>=22.0.0` (หรือ `24.15.0`)
- [ ] `frontend/package.json` engines.node เป็น `>=22.0.0` (หรือ `24.15.0`)
- [ ] `backend/Dockerfile` FROM เป็น `node:24.15.0-alpine3.21`
- [ ] `frontend/Dockerfile` FROM เป็น `node:24.15.0-alpine3.21`
- [ ] `.gitea/workflows/ci-deploy.yml` node-version เป็น `24.15.0`
- [ ] Backend start ได้ไม่มี error (`pnpm start:dev`)
- [ ] Frontend build สำเร็จ (`pnpm build`)
- [ ] 100% tests pass (backend + frontend)
- [ ] Docker build สำเร็จทั้ง backend และ frontend

## Common Issues

### Native Module Build Failures

```bash
# ถ้า bcrypt/sharp build ไม่ผ่าน
cd backend
pnpm rebuild
# หรือ
npm rebuild bcrypt --build-from-source
```

### pnpm Lockfile Issues

```bash
# ถ้ามีปัญหา lockfile
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Docker Build Cache

```bash
# เคลียร์ cache ถ้า Docker build มีปัญหา
docker build --no-cache -t nap-dms-backend:v24-test .
```

## Next Steps

หาก local test ผ่านหมด:

1. Commit changes: `git commit -m "chore(node): upgrade to v24.15.0"`
2. Push to branch: `git push origin 103-node-upgrade`
3. Create PR/MR to main branch
4. Wait for CI/CD to pass
5. Deploy to staging for validation
6. Schedule production deployment
