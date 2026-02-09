# การตั้งค่า Redis และ Elasticsearch

---

## **📝 คำอธิบายและข้อควรพิจารณา**

* 1 Redis (Service: cache)

  * Image: redis:7-alpine มีขนาดเล็กและทันสมัย

  * Port: ไม่ได้ expose port 6379 ออกมาที่ Host QNAP เพราะตามสถาปัตยกรรม Service backend (NestJS) จะคุยกับ cache (Redis) ผ่าน lcbp3 network ภายในโดยตรง ซึ่งปลอดภัยกว่าครับ

  * Volume: map data ไปที่ /share/Container/cache/data เผื่อใช้ Redis ในการทำ Persistent Cache (ถ้าต้องการแค่ Locking อาจจะไม่จำเป็นต้อง map volume ก็ได้ครับ)

  * User ID: Image redis:7-alpine รันด้วย user redis (UID 999)

* 2 Elasticsearch (Service: search)

  * Image: elasticsearch:8.11.1 ผมเลือกเวอร์ชัน 8 ที่ใหม่และระบุชัดเจน (ไม่ใช้ latest) เพื่อความเสถียรครับ

  * Port: ไม่ได้ expose port 9200 ออกมาที่ Host เช่นกัน เพราะ NPM_setting.md ระบุว่า npm (Nginx Proxy Manager) จะ forward search.np-dms.work ไปยัง service search ที่ port 9200 ผ่าน lcbp3 network ครับ

  * Environment (สำคัญมาก):

    * discovery.type: "single-node": ต้องมี ไม่อย่างนั้น Elasticsearch V.8 จะไม่ยอม start ถ้าไม่พบ node อื่นใน cluster

    * xpack.security.enabled: "false": เพื่อความสะดวกในการพัฒนาระยะแรก NestJS จะได้เชื่อมต่อ API port 9200 ได้เลย (หากเปิดใช้งานจะต้องตั้งค่า SSL และ Token ซึ่งซับซ้อนกว่ามาก)

    * ES_JAVA_OPTS: "-Xms1g -Xmx1g": เป็น Best Practice ที่ต้องกำหนด Heap Size ให้ Elasticsearch (ในที่นี้คือ 1GB)

    * User ID: Image elasticsearch รันด้วย user elasticsearch (UID 1000)

---

## กำหนดสิทธิ

```bash
# สร้าง Directory
mkdir -p /share/np-dms/services/cache/data
mkdir -p /share/np-dms/services/search/data

# กำหนดสิทธิ์ให้ตรงกับ User ID ใน Container
# Redis (UID 999)
chown -R 999:999 /share/np-dms/services/cache/data
chmod -R 750 /share/np-dms/services/cache/data

# Elasticsearch (UID 1000)
chown -R 1000:1000 /share/np-dms/services/search/data
chmod -R 750 /share/np-dms/services/search/data
```

## Docker file

```yml
# File: /share/np-dms/services/docker-compose.yml (หรือไฟล์ที่คุณใช้รวม)
# DMS Container v1_7_0: เพิ่ม Application name: services
#Services 'cache' (Redis) และ 'search' (Elasticsearch)

x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"

networks:
  lcbp3:
    external: true

services:
  # ----------------------------------------------------------------
  # 1. Redis (สำหรับ Caching และ Distributed Lock)
  # Service Name: cache (ตามที่ NPM และ Backend Plan อ้างอิง)
  # ----------------------------------------------------------------
  cache:
    <<: [*restart_policy, *default_logging]
    image: redis:7-alpine # ใช้ Alpine image เพื่อให้มีขนาดเล็ก
    container_name: cache
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 2G # Redis เป็น in-memory, ให้ memory เพียงพอต่อการใช้งาน
        reservations:
          cpus: "0.25"
          memory: 512M
    environment:
      TZ: "Asia/Bangkok"
    networks:
      - lcbp3 # เชื่อมต่อ network ภายในเท่านั้น
    volumes:
      - "/share/np-dms/services/cache/data:/data" # Map volume สำหรับเก็บข้อมูล (ถ้าต้องการ persistence)
    healthcheck:
      test: ["CMD", "redis-cli", "ping"] # ตรวจสอบว่า service พร้อมใช้งาน
      interval: 10s
      timeout: 5s
      retries: 5

  # ----------------------------------------------------------------
  # 2. Elasticsearch (สำหรับ Advanced Search)
  # Service Name: search (ตามที่ NPM และ Backend Plan อ้างอิง)
  # ----------------------------------------------------------------
  search:
    <<: [*restart_policy, *default_logging]
    image: elasticsearch:8.11.1 # แนะนำให้ระบุเวอร์ชันชัดเจน (V.8)
    container_name: search
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "2.0" # Elasticsearch ใช้ CPU และ Memory ค่อนข้างหนัก
          memory: 4G
        reservations:
          cpus: "0.5"
          memory: 2G
    environment:
      TZ: "Asia/Bangkok"
      # --- Critical Settings for Single-Node ---
      discovery.type: "single-node" # สำคัญมาก: กำหนดให้รันแบบ 1 node
      # --- Security (Disable for Development) ---
      # ปิด xpack security เพื่อให้ NestJS เชื่อมต่อง่าย (backend -> search:9200)
      # หากเป็น Production จริง ควรเปิดใช้งานและตั้งค่า token/cert ครับ
      xpack.security.enabled: "false"
      # --- Performance Tuning ---
      # กำหนด Heap size (1GB) ให้เหมาะสมกับ memory limit (4GB)
      ES_JAVA_OPTS: "-Xms1g -Xmx1g"
    networks:
      - lcbp3 # เชื่อมต่อ network ภายใน (NPM จะ proxy port 9200 จากภายนอก)
    volumes:
      - "/share/np-dms/services/search/data:/usr/share/elasticsearch/data" # Map volume สำหรับเก็บ data/indices
    healthcheck:
      # รอจนกว่า cluster health จะเป็น yellow หรือ green
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\\\"status\":\"yellow\"'"]
      interval: 30s
      timeout: 10s
      retries: 5

```
