# MONITORING-PLAN.md (Rev 01)

> แผนการตั้งค่า Uptime Kuma สำหรับ monitor infrastructure ของ LCBP3-DMS
> Uptime Kuma รันอยู่บน **ASUSTOR NAS (192.168.10.9)** — แยกเครื่องจาก services หลัก
> เกี่ยวข้องกับ ADR-016 (internal-only services, no host port binding), ADR-041 (Server Consolidation)
>
> **Rev 01 (2026-07-15):** อัปเดตหลัง ADR-041 consolidation สำเร็จ — ทุก service รันบน 192.168.10.11 แล้ว

---

## 1. Topology overview

| เครื่อง | IP | บทบาท |
|---|---|---|
| np-dms-lcbp3 (main server) | 192.168.10.11 | รัน MariaDB, Redis, Elasticsearch, Qdrant, Gitea, n8n, Backend, Frontend, ClamAV, OCR Sidecar, Ollama-metrics, PMA, Portainer |
| QNAP NAS | 192.168.10.8 | NPM (Nginx Proxy Manager) ports 80/443/81, MariaDB สำหรับ NPM |
| ASUSTOR NAS | 192.168.10.9 | Gitea Actions CI runner, **Uptime Kuma**, Primary NAS (CIFS uploads) |

> **ADR-041:** Server consolidation สำเร็จแล้ว — ทุก service ย้ายจาก QNAP + Desk-5439 มารันบน 192.168.10.11 (Ubuntu 26.04, RAM 64GB, RTX 5060 Ti 16GB)
> **Ollama:** รันเป็น native systemd service (ไม่ใช่ Docker) — ใช้ GPU ตรง (D11)

**ข้อจำกัดสำคัญ:** Uptime Kuma อยู่คนละเครื่องกับ service ส่วนใหญ่ที่ต้อง monitor → **Docker Container monitor type ใช้ได้เฉพาะ container ที่รันบน ASUSTOR เท่านั้น** (เช่น Gitea CI runner) ส่วน service บน 192.168.10.11 ต้องใช้ HTTP/TCP/Ping แทน

**Port binding (ADR-016 + ADR-041):** Service ที่ต้อง monitor ข้ามเครื่องใช้ **bind เฉพาะ LAN IP** (เช่น `192.168.10.11:9200:9200` ไม่ใช่ `0.0.0.0:9200:9200`) เพื่อไม่ expose public แต่ยอมให้ monitor จาก ASUSTOR เข้าถึงได้ — ยกเว้น service ที่ internal-only (ClamAV, n8n-db, docker-socket-proxy) ต้องใช้ Push monitor

---

## 2. Tier 1 — Public-facing (Critical)

| Monitor | Type | Target | Interval | Retries | Retry interval |
|---|---|---|---|---|---|
| LCBP3-DMS Frontend | HTTP(s) + Keyword (LCBP3 DMS)| `https://lcbp3.np-dms.work` | 60s | 3 | 20s |
| Backend API health | HTTP(s) - Json Query| `https://api.np-dms.work/health` | 60s | 3 | 20s |
| Gitea (Git Server) | HTTP(s) - Json Query| `https://git.np-dms.work/api/healthz` | 60s | 3 | 20s |
| n8n (Workflow) | HTTP(s) | `https://n8n.np-dms.work/healthz` | 120s | 3 | 30s |

Json Query (Backend): data.status == "ok"
Json Query (Gitea): status == "pass"

เปิด **Certificate Expiry Notification** ทุกตัว (แจ้งล่วงหน้า 14-21 วัน) — ใช้ wildcard cert `*.np-dms.work` (npm-31)

> **หมายเหตุ:** Frontend และ Backend แยก monitor เพราะ frontend อาจโหลดได้แต่ backend ล่ม — ต้องตรวจจับแยกกัน

---

## 3. Tier 2 — Internal infra ข้ามเครื่อง (LAN-bind ports)

| Monitor | Type | Target | Interval | Retries | หมายเหตุ |
|---|---|---|---|---|---|
| MariaDB | TCP Port | 192.168.10.11:3306 | 60s | 2 | bind 192.168.10.11:3306 ✅ |
| Redis | TCP Port | 192.168.10.11:6379 | 60s | 2 | bind 192.168.10.11:6379 ✅ |
| Elasticsearch cluster health | HTTP(s) + Auth | `http://192.168.10.11:9200/_cluster/health` | 120s | 3 | bind 192.168.10.11:9200 ✅ + ใส่ basic auth (elastic) |
| Qdrant | HTTP(s) | `http://192.168.10.11:6333/healthz` | 120s | 2 | bind 192.168.10.11:6333 ✅ |
| Ollama API | HTTP(s) | `http://192.168.10.11:11434/api/tags` | 180s | 2 | native systemd service |
| Ollama Metrics (Prometheus) | HTTP(s) | `http://192.168.10.11:9924/metrics` | 60s | 2 | ollama-metrics container — Prometheus format |
| Gitea SSH | TCP Port | 192.168.10.11:2222 | 60s | 2 | Git SSH access |
| Gitea HTTP (direct) | HTTP(s) | `http://192.168.10.11:3003/api/healthz` | 60s | 2 | bypass NPM — ตรวจ Gitea โดยตรง |
| n8n (direct) | HTTP(s) | `http://192.168.10.11:5678/healthz` | 120s | 2 | bypass NPM |
| PMA (phpMyAdmin) | HTTP(s) | `http://192.168.10.11:8080` | 120s | 2 | ถ้า PMA ล่มอาจบ่งบอกปัญหา MariaDB |
| Portainer | HTTPS | `https://192.168.10.11:9443` | 120s | 2 | Docker management UI |
| NPM (QNAP) | HTTP(s) | 192.168.10.8:81 | 60s | 2 | Edge proxy — SPOF ถ้าล่ม |
| QNAP NAS | Ping | 192.168.10.8 | 60s | 2 | |
| ASUSTOR NAS (self) | Ping | 192.168.10.9 | 60s | 2 | เช็ค loopback/self-host |
| Main Server (192.168.10.11) | Ping | 192.168.10.11 | 60s | 2 | เช็ค host reachable |

---

## 4. Tier 3 — Docker Container monitor (เฉพาะบน ASUSTOR เท่านั้น)

ต้อง mount `/var/run/docker.sock:/var/run/docker.sock:ro` ให้ Uptime Kuma container

| Monitor | Container name | Interval | Retries |
|---|---|---|---|
| Gitea Actions CI runner | ชื่อ container จริงบน ASUSTOR | 120s | 2 |
| Uptime Kuma เอง (self-health) | `uptime-kuma` | — | ใช้ built-in healthcheck ของ compose แทน |

> service อื่น (MariaDB, Redis, Elasticsearch, Qdrant, Ollama, Backend, Frontend, ClamAV, Gitea, n8n, OCR Sidecar) รันบน 192.168.10.11 — **ใช้ Docker Container type ไม่ได้** ต้องใช้ Tier 2 (HTTP/TCP) แทน

---

## 5. Tier 4 — Passive/Push monitor

สำหรับ service ที่ internal-only (ไม่ bind host port) และ system-level checks ที่ไม่สามารถ monitor ข้ามเครื่องได้

| Monitor | ใช้สำหรับ | Heartbeat interval | วิธีการ |
|---|---|---|---|
| ClamAV | ตรวจสอบ antivirus service ทำงาน (ADR-016) | 5 นาที | Push: backend ส่ง heartbeat รายงาน ClamAV status |
| n8n-db (PostgreSQL) | n8n workflow data — internal only | 5 นาที | Push: n8n ส่ง heartbeat หลัง job ทำงาน |
| docker-socket-proxy | read-only Docker API | 5 นาที | Push: n8n ตรวจสอบผ่าน Docker API |
| OCR Sidecar | OCR service health — bind 192.168.10.11:8765 ✅ | 3 นาที | Push หรือ HTTP: `http://192.168.10.11:8765/health` |
| Disk Space | ตรวจสอบ LVM volumes ไม่เต็ม | 5 นาที | Push: script ส่ง disk usage ของทุก LV |
| GPU Status (RTX 5060 Ti) | ตรวจสอบ GPU ทำงาน — Ollama ต้องใช้ | 5 นาที | Push: `nvidia-smi` exit code + VRAM usage |
| CIFS Mounts | ตรวจสอบ ASUSTOR mounts ไม่หลุด | 60s | Push: `mountpoint -q /mnt/asustor-uploads/temp` |
| Docker Daemon | ตรวจสอบ Docker daemon ทำงาน | 60s | Push: `docker info` exit code |
| Redis Queue Depth (BullMQ) | ตรวจสอบ queue ไม่ค้าง | 5 นาที | Push: script เช็ค queue length ผ่าน Redis CLI |
| Gitea Actions CI job completion | ให้ job เรียก push URL ตอนจบ | ตาม cron schedule จริง + buffer | Push URL |
| Backup job | ยืนยัน backup สำเร็จ | ตาม schedule backup | Push URL + ตรวจสอบ file exists + size |
| Gitea → GitHub push mirror sync | ยืนยัน mirror sync สำเร็จ | รายวัน | Push URL |

### Push Monitor Script (ตัวอย่าง)

```bash
#!/bin/bash
# /opt/np-dms/scripts/push-monitors.sh
# รันผ่าน cron ทุก 5 นาที — ส่ง heartbeat ไป Uptime Kuma
# แทน URL จริงจาก Uptime Kuma Push monitor setup

KUMA_BASE="https://uptime.np-dms.work/api/push"
# หรือใช้ LAN: "http://192.168.10.9:3001/api/push"

# --- Disk Space (แต่ละ LV) ---
for lv in /data/mariadb /data/elasticsearch /data/qdrant /data/postgres /opt/np-dms /opt/ollama /var/lib/docker; do
  usage=$(df "$lv" | awk 'NR==2 {print $5}' | tr -d '%')
  if [ "$usage" -lt 90 ]; then
    curl -sS -o /dev/null "${KUMA_BASE}/DISK-${lv//\//-}?status=up&msg=usage_${usage}pct&ping="
  fi
done

# --- GPU Status ---
if nvidia-smi &>/dev/null; then
  vram_used=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1)
  curl -sS -o /dev/null "${KUMA_BASE}/GPU-STATUS?status=up&msg=vram_${vram_used}MB&ping="
else
  curl -sS -o /dev/null "${KUMA_BASE}/GPU-STATUS?status=down&msg=nvidia-smi_failed&ping="
fi

# --- CIFS Mounts ---
for mnt in /mnt/asustor-uploads/temp /mnt/asustor-uploads/permanent /mnt/asustor-legacy; do
  if mountpoint -q "$mnt"; then
    curl -sS -o /dev/null "${KUMA_BASE}/MNT-${mnt//\//-}?status=up&msg=mounted&ping="
  else
    curl -sS -o /dev/null "${KUMA_BASE}/MNT-${mnt//\//-}?status=down&msg=not_mounted&ping="
  fi
done

# --- Docker Daemon ---
if docker info &>/dev/null; then
  curl -sS -o /dev/null "${KUMA_BASE}/DOCKER-DAEMON?status=up&msg=active&ping="
else
  curl -sS -o /dev/null "${KUMA_BASE}/DOCKER-DAEMON?status=down&msg=docker_info_failed&ping="
fi

# --- Redis Queue Depth (BullMQ) ---
REDIS_PASS=$(grep REDIS_PASSWORD /opt/np-dms/.env | cut -d= -f2)
for queue in ai-realtime ai-batch; do
  depth=$(docker exec cache redis-cli -a "$REDIS_PASS" --no-auth-warning LLEN "bull:${queue}:wait" 2>/dev/null)
  if [ "$depth" -lt 100 ]; then
    curl -sS -o /dev/null "${KUMA_BASE}/QUEUE-${queue}?status=up&msg=depth_${depth}&ping="
  else
    curl -sS -o /dev/null "${KUMA_BASE}/QUEUE-${queue}?status=down&msg=depth_${depth}_backlog&ping="
  fi
done

# --- ClamAV ---
if docker exec clamav clamdcheck.sh &>/dev/null; then
  curl -sS -o /dev/null "${KUMA_BASE}/CLAMAV?status=up&msg=active&ping="
else
  curl -sS -o /dev/null "${KUMA_BASE}/CLAMAV?status=down&msg=clamdcheck_failed&ping="
fi

# --- n8n-db (PostgreSQL) ---
if docker exec n8n-db pg_isready -h localhost -U n8n -d n8n &>/dev/null; then
  curl -sS -o /dev/null "${KUMA_BASE}/N8N-DB?status=up&msg=ready&ping="
else
  curl -sS -o /dev/null "${KUMA_BASE}/N8N-DB?status=down&msg=pg_isready_failed&ping="
fi
```

### Cron Setup

```bash
# /etc/cron.d/np-dms-monitors
*/5 * * * * np-dms /opt/np-dms/scripts/push-monitors.sh >> /opt/np-dms/logs/monitoring/push-monitors.log 2>&1
# CIFS mounts — ตรวจทุกนาที (critical ถ้าหลุด)
* * * * * np-dms /opt/np-dms/scripts/push-monitors-cifs.sh >> /opt/np-dms/logs/monitoring/cifs.log 2>&1
```

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

## 7. Alerting & Escalation

### Severity Levels

| Severity | นิยาม | ตัวอย่าง | Response Time |
|---|---|---|---|
| **Critical (P1)** | Service หลักล่ม — ผู้ใช้ใช้งานไม่ได้ | Frontend, Backend, MariaDB, NPM ล่ม | < 15 นาที |
| **Warning (P2)** | Service ลดประสิทธิภาพหรือ service รองล่ม | ClamAV, OCR Sidecar, Ollama, ES ล่ม | < 1 ชั่วโมง |
| **Info (P3)** | ข้อมูลเชิงสถิติ ไม่กระทบการใช้งาน | Disk > 80%, Queue depth สูง | ตรวจสอบในวันทำงาน |

### Notification Channels

| Channel | ใช้สำหรับ | หมายเหตุ |
|---|---|---|
| **Telegram Bot** | Critical + Warning (real-time) | สร้าง bot ผ่าน @BotFather, ส่งไป group ทีม |
| **Email** | Critical (เก็บ log + audit trail) | ส่งไป admin@np-dms.work |
| **Uptime Kuma Status Page** | Stakeholder visibility | แยก public (Tier 1) กับ internal (ทั้งหมด) |

### Escalation Path

1. **Alert trigger** → Uptime Kuma ส่งไป Telegram + Email
2. **ถ้าไม่ acknowledge ภายใน 15 นาที (P1)** → ส่งซ้ำทุก 5 นาที (สูงสุด 3 ครั้ง)
3. **ถ้าไม่ acknowledge ภายใน 30 นาที (P1)** → ส่ง SMS หรือโทร (ถ้าตั้งค่าไว้)

### Maintenance Window / Silence Policy

- ก่อน deploy หรือ backup → ตั้ง **Pause** ใน Uptime Kuma สำหรับ monitor ที่จะกระทบ
- บันทึก maintenance window ใน log: `/opt/np-dms/logs/monitoring/maintenance.log`
- หลัง maintenance เสร็จ → ยกเลิก Pause และตรวจสอบ monitor กลับมาปกติ

---

## 8. Backup Verification

| Backup Job | ที่เก็บ | ตรวจสอบ | Schedule |
|---|---|---|---|
| MariaDB dump | `/opt/np-dms/mariadb/backup/` | file exists + size > 1KB + checksum | รายวัน (cron) |
| Gitea dump | `/opt/np-dms/gitea/backup/` | file exists + size > 1KB | รายสัปดาห์ |
| n8n data | `/opt/np-dms/n8n/data/` | directory exists + file count | รายวัน |

> Push monitor ส่ง heartbeat หลัง backup job ทำงานเสร็จ — ถ้าไม่ได้รับ heartbeat ภายใน schedule + buffer ให้แจ้งเตือน

---

## 9. Status Page

Uptime Kuma มี built-in Status Page feature — ตั้งค่า 2 หน้า:

| Status Page | แสดง | Audience |
|---|---|---|
| **Public** | Tier 1 (Frontend, Backend, Gitea, n8n) | Stakeholder ภายนอก |
| **Internal** | ทุก Tier (1-4) | ทีม DevOps / Admin |

---

## 10. TODO / ยังไม่ confirm

- [ ] ชื่อ container จริงของ Gitea Actions CI runner บน ASUSTOR (สำหรับ Docker Container monitor)
- [ ] ตั้งค่า public hostname สำหรับ Uptime Kuma ผ่าน NPM (เช่น `uptime.np-dms.work`) ชี้ไปที่ `192.168.10.9:3001`
- [ ] สร้าง Telegram Bot และตั้งค่า notification channel ใน Uptime Kuma
- [ ] ตั้งค่า Email notification (SMTP) ใน Uptime Kuma
- [ ] สร้าง push monitor script จริง (`/opt/np-dms/scripts/push-monitors.sh`) และตั้งค่า cron
- [ ] สร้าง Uptime Kuma Status Page (public + internal)
- [ ] ทดสอบ push monitor script ทุกตัวก่อน enable alerting
- [ ] กำหนด retention policy สำหรับ Uptime Kuma data (default 365 วัน)
