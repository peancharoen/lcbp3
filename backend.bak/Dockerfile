# File: Dockerfile
# บันทึกการแก้ไข: (สร้างไฟล์)

# --- STAGE 1: Builder ---
# ติดตั้ง Dependencies และ Build โค้ด
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Copy package.json และ lock file
COPY package*.json ./

# ติดตั้ง Dependencies (สำหรับ Build)
RUN npm install

# Copy source code ทั้งหมด
COPY . .

# Build application
RUN npm run build

# ติดตั้งเฉพาะ Production Dependencies (สำหรับ Stage สุดท้าย)
RUN npm prune --production

# --- STAGE 2: Runner ---
# Image สุดท้ายที่มีขนาดเล็ก
FROM node:18-alpine

WORKDIR /usr/src/app

# (Security) สร้าง User ที่ไม่มีสิทธิ์ Root
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs
USER nestjs

# Copy Production Dependencies (จาก Stage 1)
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy Build Artifacts (จาก Stage 1)
COPY --from=builder /usr/src/app/dist ./dist

# Copy package.json (เผื่อจำเป็น)
COPY package*.json ./

# เปิด Port (อ่านจาก Environment Variable)
EXPOSE ${PORT:-3000}

# รัน Application
CMD [ "node", "dist/main" ]