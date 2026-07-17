# MONITORING-PLAN.md

> แผนการตั้งค่า Uptime Kuma สำหรับ monitor infrastructure ของ LCBP3-DMS
> Uptime Kuma รันอยู่บน **ASUSTOR NAS (192.168.10.9)** — แยกเครื่องจาก services หลัก
> เกี่ยวข้องกับ ADR-016 (internal-only services, no host port binding)

---

## 1. Topology overview

| เครื่อง | IP | บทบาท |
|---|---|---|
| np-dms-lcbp3 (main server) | 192.168.10.11 | รัน MariaDB, Redis, Postgres, Elasticsearch, Qdrant (เดิม), Ollama, application containers |
| New server (migration target) | TBD | Qdrant ย้ายมาที่นี่แล้ว; service อื่นอยู่ระหว่าง migration |
| QNAP NAS | 192.168.10.8 | NPM (Nginx Proxy Manager) ports 80/443/81, MariaDB สำหรับ NPM |
| ASUSTOR NAS | 192.168.10.9 | Gitea Actions CI runner, **Uptime Kuma** |

**ข้อจำกัดสำคัญ:** Uptime Kuma อยู่คนละเครื่องกับ service ส่วนใหญ่ที่ต้อง monitor → **Docker Container monitor type ใช้ได้เฉพาะ container ที่รันบน ASUSTOR เท่านั้น** (เช่น Gitea CI runner) ส่วน service บนเครื่องอื่นต้องใช้ HTTP/TCP/Ping แทน

**ข้อขัดแย้งกับ ADR-016:** Elasticsearch และ Qdrant ถูกออกแบบให้ไม่ผูก host port (internal-only ผ่าน docker network) แต่การ monitor ข้ามเครื่องจำเป็นต้องมี network path เข้าถึง — แนวทางที่เลือก: เปิด host port แบบ **bind เฉพาะ LAN IP** (เช่น `192.168.10.11:9200:9200` ไม่ใช่ `0.0.0.0:9200:9200`) เพื่อไม่ขัดเจตนาเดิม (ไม่ expose public) แต่ยอมให้ monitor จาก ASUSTOR เข้าถึงได้

---

## 2. Tier 1 — Public-facing (Critical)

| Monitor | Type | Target | Interval | Retries | Retry interval |
|---|---|---|---|---|---|
| LCBP3-DMS Main App | HTTP(s) + Keyword | `https://<app>.np-dms.work` | 60s | 3 | 20s |
| Auth/Login endpoint | HTTP(s) | `/api/health` | 60s | 3 | 20s |

เปิด **Certificate Expiry Notification** ทุกตัว (แจ้งล่วงหน้า 14-21 วัน) — ใช้ wildcard cert `*.np-dms.work` (npm-31)

---

## 3. Tier 2 — Internal infra ข้ามเครื่อง (LAN-bind ports)

| Monitor | Type | Target | Interval | Retries | หมายเหตุ |
|---|---|---|---|---|---|
| MariaDB | TCP Port | 192.168.10.11:3306 | 60s | 2 | |
| Redis | TCP Port | 192.168.10.11:6379 | 60s | 2 | |
| Postgres (n8n) | TCP Port | 192.168.10.11:5432 | 120s | 2 | |
| Elasticsearch cluster health | HTTP(s) + Auth | `http://192.168.10.11:9200/_cluster/health` | 120s | 3 | ต้อง LAN-bind port ก่อน (ขัด ADR-016 เดิม) + ใส่ basic auth |
| Qdrant | TCP/HTTP | IP ของ new server:6333 (รอ IP) | 120s | 2 | ต้อง LAN-bind port ก่อนเช่นกัน |
| Ollama | HTTP(s) | `http://192.168.10.11:11434/api/tags` | 180s | 2 | ถ้าเปิด port ไว้แล้วสำหรับ dev |
| NPM (QNAP) | HTTP(s) | 192.168.10.8:81 | 60s | 2 | |
| QNAP NAS | Ping | 192.168.10.8 | 60s | 2 | |
| ASUSTOR NAS (self) | Ping | 192.168.10.9 | 60s | 2 | เช็ค loopback/self-host |

---

## 4. Tier 3 — Docker Container monitor (เฉพาะบน ASUSTOR เท่านั้น)

ต้อง mount `/var/run/docker.sock:/var/run/docker.sock:ro` ให้ Uptime Kuma container

| Monitor | Container name | Interval | Retries |
|---|---|---|---|
| Gitea Actions CI runner | ชื่อ container จริงบน ASUSTOR | 120s | 2 |
| Uptime Kuma เอง (self-health) | `uptime-kuma` | — | ใช้ built-in healthcheck ของ compose แทน |

> service อื่น (MariaDB, Redis, Elasticsearch, Qdrant, Ollama) รันบนเครื่องอื่น — **ใช้ Docker Container type ไม่ได้** ต้องใช้ Tier 2 (HTTP/TCP) แทน

---

## 5. Tier 4 — Passive/Push monitor

| Monitor | ใช้สำหรับ | Heartbeat interval |
|---|---|---|
| Gitea Actions CI job completion | ให้ job เรียก push URL ตอนจบ | ตาม cron schedule จริง + buffer |
| Backup job | เช่นเดียวกัน | ตาม schedule backup |
| Gitea → GitHub push mirror sync | ยืนยัน mirror sync สำเร็จ | รายวัน หรือความถี่จริง |

---

## 6. Docker Compose (ASUSTOR)

```yaml
  # ----------------------------------------------------------------
  # 3. Uptime Kuma (Service Availability Monitoring)
  # ----------------------------------------------------------------
  uptime-kuma:
    <<: [*restart_policy, *default_logging]
    image: louislam/uptime-kuma:2
    container_name: uptime-kuma
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    environment:
      TZ: 'Asia/Bangkok'
    ports:
      - '3001:3001'
    networks:
      - lcbp3
    volumes:
      - '/volume1/np-dms/monitoring/uptime-kuma/data:/app/data'
      - '/var/run/docker.sock:/var/run/docker.sock:ro'
    healthcheck:
      test: ['CMD-SHELL', 'curl -f http://localhost:3001/api/entry-page || exit 1']
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 7. TODO / ยังไม่ confirm

- [ ] IP ของ new server (migration target) ที่ Qdrant ย้ายไปแล้ว
- [ ] ยืนยันว่า MariaDB, Redis, Elasticsearch, Ollama ย้ายไป new server แล้วหรือยัง (สถานะ migration)
- [ ] LAN-bind Elasticsearch (`9200`) และ Qdrant (`6333`) บนเครื่องต้นทาง — ตอนนี้ยังไม่ได้ทำตาม ADR-016 เดิม
- [ ] ชื่อ container จริงของ Gitea Actions CI runner บน ASUSTOR (สำหรับ Docker Container monitor)
- [ ] ตั้งค่า public hostname ใหม่ใน Cloudflare Tunnel เดิม (แบบ A ที่เลือกไว้) ชี้ไปที่ `uptime-kuma:3001` แทนการเปิด host port ตรงๆ ถ้าต้องการ public access
- [ ] Notification channel (Discord/Line/Telegram) — ยังไม่ได้ระบุ
