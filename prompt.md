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

ขออภัยอย่างยิ่งในความผิดพลาดที่เกิดขึ้นครับ เข้าใจครับว่าทำให้เสียเวลามาก

สำหรับการ **"ตั้งค่า"** หรือ **"กำหนดค่า"** ให้ผมตรวจสอบข้อมูลก่อนนั้น ในระบบ AI แบบนี้ **ไม่มีเมนู Settings หรือปุ่มกดให้คุณเข้าไปตั้งค่าได้โดยตรงครับ**

การควบคุมพฤติกรรมของผมต้องทำผ่าน **"คำสั่ง (Prompt)"** ที่คุณพิมพ์เข้ามาเท่านั้นครับ เพื่อป้องกันไม่ให้เกิดเหตุการณ์แบบนี้อีก คุณสามารถใช้เทคนิคการสั่งงานดังนี้เพื่อ **"บังคับ"** ให้ผมตรวจสอบข้อมูลครับ:

1.  **สั่งให้ "อ่านและสรุปก่อน" (Verify First):**
    * ก่อนให้ผมเขียนโค้ด ให้สั่งว่า *"ช่วยอ่านไฟล์ `01_lcbp3_v1_4_3.sql` แล้วสรุปโครงสร้างตาราง audit_logs ที่มีอยู่จริงให้ดูก่อน"*
    * วิธีนี้จะบังคับให้ผมต้องไปดึงข้อมูลจากไฟล์มาประมวลผลก่อนที่จะเริ่ม "จินตนาการ" หรือเขียนโค้ดใหม่ครับ

2.  **ใช้คำสั่ง "ห้ามเดา" (Strict Constraints):**
    * เติมประโยคท้ายคำสั่งว่า *"ห้ามใช้โครงสร้างสมมติ ให้ยึดตามไฟล์แนบ `ชื่อไฟล์` เท่านั้น หากไม่เจอข้อมูลให้ถามกลับ"*

3.  **อ้างอิงชื่อไฟล์ชัดเจน:**
    * ระบุชื่อไฟล์ในคำสั่งเสมอ เช่น *"อ้างอิงจาก `Backend Plan`..."* หรือ *"ตาม `Data Dictionary`..."* (ซึ่งคุณทำได้ดีแล้วครับ แต่ผมประมวลผลพลาดเองในรอบนี้)

**สรุป:**
คุณไม่ต้องไปตั้งค่าที่ไหนครับ แต่ใช้การ **"สั่งให้ผมทวนข้อมูลจากไฟล์"** เป็นขั้นตอนแรกก่อนเริ่มงาน จะช่วยลดโอกาสผิดพลาดได้มากที่สุดครับ

ตอนนี้ผมพร้อมทำงานต่อโดยยึดข้อมูลจากไฟล์ `01_lcbp3_v1_4_3.sql` และไฟล์อื่นๆ ที่คุณให้มาอย่างเคร่งครัดครับ มีส่วนไหนให้ผมดำเนินการต่อไหมครับ?