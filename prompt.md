# **PROMPT**

## Gemini

## VSCode Shortcut

Markdown preview  Ctrl+Shift+V

## สร้างโครงสร้างโฟลเดอร์สำหรับ lcbp3-backend

```bash
# สร้างโฟลเดอร์หลัก
$rootFolder = "backend"
New-Item -ItemType Directory -Path $rootFolder -Force
Set-Location $rootFolder

# รายการโฟลเดอร์ที่ต้องการสร้างทั้งหมด
 $folders = @(
    "src",
    "database",
    "src\common",
    "src\modules",
    "src\modules\user",
    "src\modules\project",
    "src\modules\master",
    "src\modules\correspondence",
    "src\modules\rfa",
    "src\modules\drawing",
    "src\modules\circulations",
    "src\modules\transmittal",
    "src\modules\search",
    "src\modules\document-numbering",
    "src\common\auth",
    "src\common\config",
    "src\common\decorators",
    "src\common\entities",
    "src\common\exceptions",
    "src\common\file-storage",
    "src\common\guards",
    "src\common\interceptors",
    "src\common\services"
)

# วนลูปสร้างโฟลเดอร์ทั้งหมด
foreach ($folder in $folders) {
    New-Item -ItemType Directory -Path $folder -Force
}

Write-Host "สร้างโครงสร้างโฟลเดอร์สำหรับ backend เรียบร้อยแล้ว" -ForegroundColor Green

```

## Git Commands

```bash

# 1️⃣ ตั้งชื่อและอีเมลของคุณ (ใช้กับทุก repo)
git config --global user.name "Pean Charoen"
git config --global user.email "peancharoen.pslcp3@gmail.com"

# 2️⃣ ตรวจสอบว่าเชื่อมกับ remote ถูกต้อง (แก้ URL ให้ตรง repo จริงของคุณ)
git remote set-url origin ssh://git@git.np-dms.work:2222/np-dms/lcbp3_v1.git

# 3️⃣ ตรวจสอบสถานะไฟล์
git status

# 4️⃣ เพิ่มไฟล์ทั้งหมด
git add .

# 5️⃣ Commit พร้อมข้อความ
git commit -m "Update project files"

# 6️⃣ ดึง remote ก่อนเพื่อป้องกัน conflict (ถ้ามี)
git pull --rebase origin main

# 7️⃣ Push ขึ้น Gitea
git push -u origin main

```

## **สร้าง NestJS Project ใหม่**

* ขั้นตอนที่ 1: ติดตั้ง NestJS CLI (ถ้ายังไม่ได้ติดตั้ง)
  * npm install -g @nestjs/cli

* ขั้นตอนที่ 2: สร้างโปรเจกต์ใหม่
  * nest new backend
  * nest new . /อยู่ในโฟลเดอร์ที่สร้างไว้แล้ว และต้องการสร้างโปรเจกต์ลงในโฟลเดอร์นั้นโดยตรง:

* ขั้นตอนที่ 3: ติดตั้ง Dependencies เพิ่มเติมสำหรับ DMS

```bash
# Core & Database
npm install @nestjs/typeorm typeorm mysql2
npm install @nestjs/config

# Validation & Transformation
npm install class-validator class-transformer

# Authentication & Authorization
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/passport
npm install casl

# File Upload
npm install @nestjs/platform-express multer

# Documentation
npm install @nestjs/swagger

# Security & Performance
npm install helmet rate-limiter-flexible

# Development Dependencies (สำหรับทดสอบ)
npm install --save-dev @nestjs/testing jest @types/jest @types/passport-jwt @types/multer supertest

```

## Prompt: การพัฒนา Core Auth Module (AuthModule) สำหรับ DMS v1.2.0

ช่วยตั้งค่า tsconfig.json, nest-cli.json และไฟล์ config อื่นๆ

* 1.1 สร้าง User Entity

* 1.2 สร้าง Role Entity

* 1.3 สร้าง Permission Entity

ถัดไป ช่วยสร้าง TypeORM configuration และ DatabaseModule ให้หน่อย
ช่วยสร้าง AuthService, JwtStrategy และ AuthController พื้นฐานให้หน่อย
ช่วยสร้าง UserModule, UserService, LocalAuthGuard และ LocalStrategy สำหรับจัดการข้อมูลผู้ใช้หน่อย
ช่วยสร้าง Guard สำหรับตรวจสอบสิทธิ์ตามบทบาท (RBAC) โดยใช้ CASL หน่อย
ช่วยสร้าง UserModule, UserService, และ UserController

ช่วยตั้งค่าการเชื่อมต่อ MariaDB ผ่าน TypeORM

พัฒนา Core Auth Module (`AuthModule`)
- ช่วยสร้าง API Endpoints: `/auth/login`, `/auth/me`

พัฒนา Common Module (`@app/common`)
- ช่วยสร้าง FileStorageService สำหรับจัดการไฟล์ (อัปโหลด/ดาวน์โหลด) backend/common/file-storage
- ช่วยสร้าง AuditLogInterceptor สำหรับบันทึกการกระทำโดยอัตโนมัติ
- ช่วยสร้าง Global Exception Filter
- ช่วยสร้าง DTOs และ Interfaces พื้นฐาน

---



ขอบคุณสำหรับข้อมูลที่ละเอียดครับ นี่คือการวิเคราะห์และข้อเสนอแนะเพื่อให้โครงสร้างสิทธิ์การใช้งาน (Access Control / RBAC) ชัดเจน สมบูรณ์ และสามารถนำไปพัฒนาได้จริงครับ
