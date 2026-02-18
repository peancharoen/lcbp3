# การติดตั้ง Rocket.Chat บน QNAP

> 📍 **Version:** v1.0.0 (Chat Service)
> 🖥️ **Server:** QNAP TS-473A (Container Station)
> 🔗 **Docker Compose Path:** `/share/np-dms/rocketchat/docker-compose.yml`
> 🌐 **Domain:** `chat.np-dms.work`

---

## 📋 Prerequisites

ก่อนติดตั้ง ต้องมั่นใจว่า:
1.  **Docker Network** `lcbp3` ถูกสร้างแล้ว (ตรวจสอบด้วย `docker network ls`)
2.  **Nginx Proxy Manager (NPM)** รันอยู่เพื่อจัดการ SSL และ Domain

---

## 1. เตรียม Directories

สร้าง folder สำหรับเก็บข้อมูลเพื่อให้ข้อมูลไม่หายเมื่อลบ container:

```bash
# SSH เข้า QNAP
ssh admin@192.168.10.8

# สร้าง directories
mkdir -p /share/np-dms/rocketchat/uploads
mkdir -p /share/np-dms/rocketchat/data/db
mkdir -p /share/np-dms/rocketchat/data/dump

# Permissions: 
# MongoDB ใน Docker ปกติใช้ uid 999 หรือ root, Rocket.Chat ใช้ uid 1000 หรือ root
# การสร้าง folder ผ่าน ssh admin ปกติจะเป็น admin:administrators
```

---

## 2. Docker Compose Configuration

สร้างไฟล์ `docker-compose.yml` ที่ `/share/np-dms/rocketchat/docker-compose.yml`:

```yml
x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"

services:
  mongodb:
    <<: [*restart_policy, *default_logging]
    image: docker.io/library/mongo:7.0
    container_name: mongodb
    command: mongod --oplogSize 128 --replSet rs0 --bind_ip_all
    volumes:
      - /share/np-dms/rocketchat/data/db:/data/db
      - /share/np-dms/rocketchat/data/dump:/dump
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
    networks:
      - lcbp3

  # Service สำหรับ Init Replica Set อัตโนมัติ (รันแล้วจบ)
  mongo-init-replica:
    image: docker.io/library/mongo:7.0
    command: >
      bash -c "for i in `seq 1 30`; do
        mongosh --host mongodb --eval 'rs.initiate({ _id: \"rs0\", members: [ { _id: 0, host: \"mongodb:27017\" } ] })' && break;
        sleep 1;
      done"
    depends_on:
      - mongodb
    networks:
      - lcbp3

  rocketchat:
    <<: [*restart_policy, *default_logging]
    image: registry.rocket.chat/rocketchat/rocket.chat:latest
    container_name: rocketchat
    volumes:
      - /share/np-dms/rocketchat/uploads:/app/uploads
    environment:
      - PORT=3000
      - ROOT_URL=https://chat.np-dms.work
      - MONGO_URL=mongodb://mongodb:27017/rocketchat?replicaSet=rs0
      - MONGO_OPLOG_URL=mongodb://mongodb:27017/local?replicaSet=rs0
      - DEPLOY_METHOD=docker
      - ACCOUNTS_AVATAR_STORE_PATH=/app/uploads
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
    depends_on:
      - mongodb
    networks:
      - lcbp3
    expose:
      - "3000"

networks:
  lcbp3:
    external: true
```

> **📝 Note:**
> - **MongoDB Replica Set (`rs0`):** จำเป็นสำหรับ Rocket.Chat เพื่อใช้ Oplog
> - **Expose:** เราเปิด port 3000 ภายใน network `lcbp3` เท่านั้น ไม่ expose ออก host โดยตรง เพื่อความปลอดภัยและให้ผ่าน NPM
> - **Resources:** กำหนด CPU/Memory Limit เพื่อป้องกันไม่ให้กินทรัพยากรเครื่อง QNAP มากเกินไป

---

## 3. Deployment

1.  ไปที่ **Container Station** บน QNAP
2.  เลือกเมนู **Applications** -> **Create**
3.  ตั้งชื่อ Application: `lcbp3-chat`
4.  วาง Code จาก `docker-compose.yml` ด้านบนลงไป
5.  Check Env Variable Validations
6.  กด **Create**

---

## 4. Nginx Proxy Manager (NPM) Setup

ต้องตั้งค่า Proxy Host ที่ NPM เพื่อให้เข้าใช้งานผ่าน `https://chat.np-dms.work` ได้

1.  Login **NPM Admin** (`https://npm.np-dms.work`)
2.  ไปที่ **Hosts** -> **Proxy Hosts** -> **Add Proxy Host**
3.  **Details Tab:**
    *   **Domain Names:** `chat.np-dms.work`
    *   **Scheme:** `http`
    *   **Forward Hostname:** `rocketchat` (ชื่อ service ใน docker-compose)
    *   **Forward Port:** `3000`
    *   **Cache Assets:** ✅
    *   **Block Common Exploits:** ✅
    *   **Websockets Support:** ✅ (⚠️ สำคัญมากสำหรับ Real-time chat)
4.  **SSL Tab:**
    *   **SSL Certificate:** Request a new SSL Certificate (Let's Encrypt) หรือใช้ Wildcard เดิมที่มี
    *   **Force SSL:** ✅
    *   **HTTP/2 Support:** ✅
5.  กด **Save**

---

## 5. Verification

1.  เปิด Browser เข้าไปที่ `https://chat.np-dms.work`
2.  จะพบหน้า **Setup Wizard**
3.  กรอกข้อมูล Admin และ Organization เพื่อเริ่มใช้งาน

---

## 6. Configuration & Initial Setup

### 6.1 Setup Wizard (First Run)
เมื่อเข้าสู่ระบบครั้งแรก จะพบกับ **Setup Wizard** ให้กรอกข้อมูลดังนี้:

1.  **Admin Info:**
    *   **Name:** Administrator (หรือชื่อผู้ดูแลระบบ)
    *   **Username:** `admin` (แนะนำให้เปลี่ยนเพื่อความปลอดภัย)
    *   **Email:** `admin@np-dms.work`
    *   **Password:** (ตั้งรหัสผ่านที่ซับซ้อนและบันทึกใน Secrets Management)

2.  **Organization Info:**
    *   **Organization Type:** Government / Public Sector
    *   **Organization Name:** Laem Chabang Port Phase 3
    *   **Industry:** Construction / Infrastructure
    *   **Size:** 51-100 (หรือตามจริง)
    *   **Country:** Thailand

3.  **Server Info:**
    *   **Site Name:** LCBP3 DMS Chat
    *   **Language:** English / Thai
    *   **Server Type:** Private Team
    *   **2FA:** แนะนำให้เปิด Two Factor Authentication (Optional)

4.  **Register Server:**
    *   **Standalone:** เลือก "Keep standalone" หากต้องการความเป็นส่วนตัวสูงสุด (Privacy-first / Air-gapped)
    *   **Registered:** หากต้องการใช้ Mobile App Push Notification Gateway ของ Rocket.Chat (ฟรีจำกัดจำนวน)

> **💡 Tip:** หากเลือก Standalone จะไม่มี Push Notification ไปยังมือถือ (iOS/Android) แต่ยังใช้งานผ่าน Browser และ Desktop App ได้ปกติ

### 6.2 Post-Installation Settings
หลังจาก Setup เสร็จสิ้น แนะนำให้ตรวจสอบค่าเหล่านี้ใน **Administration**:

1.  **General > Site URL:** ต้องเป็น `https://chat.np-dms.work`
2.  **General > Force SSL:** ต้องเป็น `True`
3.  **File Upload > File Upload:** เปิดใช้งาน
4.  **File Upload > Max File Size:** ปรับตามนโยบาย (Default 2MB อาจน้อยไป แนะนำ 50MB+)
    *   *หมายเหตุ: ต้องสัมพันธ์กับ `client_max_body_size` ใน NPM ด้วย*

---

## 7. Maintenance

### Backup Strategy
ข้อมูลสำคัญจะอยู่ที่ Path บน QNAP:
*   `/share/np-dms/rocketchat/data/db` (Database)
*   `/share/np-dms/rocketchat/uploads` (Files)

ระบบ Backup (Restic บน ASUSTOR) ควรสั่ง backup folder `/share/np-dms/` ทั้งหมดอยู่แล้ว

### Troubleshooting
หากเข้าเว็บไม่ได้ หรือขึ้น 502 Bad Gateway:
1.  เช็ค Logs Rocket.Chat: `docker logs -f rocketchat`
2.  เช็ค Logs MongoDB: `docker logs -f mongodb` (ดูว่า Replica Set init หรือยัง)
3.  เช็ค NPM: มั่นใจว่า Forward Hostname ถูกต้อง (`rocketchat` ต้องอยู่ใน network เดียวกันคือ `lcbp3`)

---

## 📦 Resource Summary

| Service        | Image                                         | CPU Limit | Memory Limit | Port  |
| :------------- | :-------------------------------------------- | :-------- | :----------- | :---- |
| **mongodb**    | `mongo:7.0`                                   | 1.0       | 1 GB         | 27017 |
| **rocketchat** | `registry.rocket.chat/rocketchat/rocket.chat` | 1.0       | 1 GB         | 3000  |