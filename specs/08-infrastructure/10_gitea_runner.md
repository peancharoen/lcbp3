# การติดตั้ง Gitea Actions Runner (act_runner) บน ASUSTOR

คู่มือนี้สำหรับติดตั้ง **act_runner** บน ASUSTOR เพื่อเชื่อมต่อกับ Gitea ที่รันอยู่บน QNAP

> ⚠️ **Note:** Gitea อยู่บน **QNAP** แต่ Runner อยู่บน **ASUSTOR** ตามหลัก Server Role Separation
> (QNAP = Application, ASUSTOR = Infrastructure)

## 🏗️ โครงสร้างการติดตั้ง
*   **Platform:** ASUSTOR AS5403T (Infrastructure Server)
*   **Method:** Portainer Stack หรือ Docker Compose
*   **Path:** `/volume1/np-dms/gitea-runner/`

---

## 🚀 ขั้นตอนการติดตั้ง

### 1. รับ Registration Token
1. เข้า Gitea Web UI (`https://git.np-dms.work`) ไปที่ **Site Administration** -> **Actions** -> **Runners**
2. กดปุ่ม **Create new Runner**
3. คัดลอก **Registration Token** มาเก็บไว้

### 2. เตรียม Directory บน ASUSTOR
```bash
# SSH เข้า ASUSTOR
ssh admin@192.168.10.9

# สร้างโฟลเดอร์เก็บข้อมูล
mkdir -p /volume1/np-dms/gitea-runner/data
```

### 3. สร้าง Docker Compose

สร้างไฟล์ `/volume1/np-dms/gitea-runner/docker-compose.yml` หรือใช้ Portainer Stack:

```yaml
# File: /volume1/np-dms/gitea-runner/docker-compose.yml
# Deploy on: ASUSTOR AS5403T
# เชื่อมต่อกับ Gitea บน QNAP ผ่าน Domain URL

version: "3.8"

services:
  runner:
    image: gitea/act_runner:latest
    container_name: gitea-runner
    restart: always
    environment:
      # ใช้ Domain URL เพื่อเชื่อมต่อ Gitea ข้ามเครื่อง (QNAP)
      - GITEA_INSTANCE_URL=https://git.np-dms.work
      - GITEA_RUNNER_REGISTRATION_TOKEN=คัดลอก_TOKEN_มาวางที่นี่
      - GITEA_RUNNER_NAME=asustor-runner
      # Label ต้องตรงกับ runs-on ใน deploy.yaml
      - GITEA_RUNNER_LABELS=ubuntu-latest:docker://node:18-bullseye,self-hosted:docker://node:18-bullseye
    volumes:
      - /volume1/np-dms/gitea-runner/data:/data
      - /var/run/docker.sock:/var/run/docker.sock
```

### 4. สั่งรัน Runner
```bash
cd /volume1/np-dms/gitea-runner
docker compose up -d
```

---

## 🔍 การตรวจสอบภายหลังการติดตั้ง
1. กลับไปที่หน้า **Settings -> Actions -> Runners** ใน Gitea (QNAP)
2. สถานะควรเปลี่ยนเป็น **Total: 1** และมีจุดสีเขียวหน้า `asustor-runner`
3. ลองกด **Run workflow** ในแถบ Actions เพื่อทดสอบ

## ⚠️ ข้อควรระวัง
*   **Network:** ASUSTOR ต้องเข้าถึง `https://git.np-dms.work` ได้ (ผ่าน DNS/NPM)
*   **Disk Cleanup:** รัน `docker image prune -a` เป็นระยะเพื่อลบ cache images เก่า
