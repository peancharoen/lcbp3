# การติดตั้ง Monitoring Stack บน ASUSTOR

## **📝 คำอธิบายและข้อควรพิจารณา**

> ⚠️ **หมายเหตุ**: Monitoring Stack ทั้งหมดติดตั้งบน **ASUSTOR AS5403T** ไม่ใช่ QNAP
> เพื่อแยก Application workload ออกจาก Infrastructure/Monitoring workload

Stack สำหรับ Monitoring ประกอบด้วย:

| Service           | Port                         | Purpose                           | Host    |
| :---------------- | :--------------------------- | :-------------------------------- | :------ |
| **Prometheus**    | 9090                         | เก็บ Metrics และ Time-series data  | ASUSTOR |
| **Grafana**       | 3000                         | Dashboard สำหรับแสดงผล Metrics      | ASUSTOR |
| **Node Exporter** | 9100                         | เก็บ Metrics ของ Host system       | Both    |
| **cAdvisor**      | 8080 (ASUSTOR) / 8088 (QNAP) | เก็บ Metrics ของ Docker containers | Both    |
| **Uptime Kuma**   | 3001                         | Service Availability Monitoring   | ASUSTOR |
| **Loki**          | 3100                         | Log aggregation                   | ASUSTOR |
| **Promtail**      | -                            | Log shipper (Sender)              | ASUSTOR |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ASUSTOR AS5403T (Monitoring Hub)                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ Prometheus  │───▶│   Grafana   │    │ Uptime Kuma │                 │
│  │   :9090     │    │   :3000     │    │   :3001     │                 │
│  └──────┬──────┘    └─────────────┘    └─────────────┘                 │
│         │                                                               │
│         │ Scrape Metrics                                                │
│         ▼                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │node-exporter│    │  cAdvisor   │    │  Promtail   │                 │
│  │   :9100     │    │   :8080     │    │  (Log Ship) │                 │
│  │  (Local)    │    │  (Local)    │    │   (Local)   │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
         │ Remote Scrape
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       QNAP TS-473A (App Server)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │node-exporter│    │  cAdvisor   │    │  Backend    │                 │
│  │   :9100     │    │   :8080     │    │ /metrics    │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## กำหนดสิทธิ (บน ASUSTOR)

```bash
# SSH เข้า ASUSTOR
ssh admin@192.168.10.9

# สร้าง Directory
mkdir -p /volume1/np-dms/monitoring/prometheus/data
mkdir -p /volume1/np-dms/monitoring/prometheus/config
mkdir -p /volume1/np-dms/monitoring/grafana/data
mkdir -p /volume1/np-dms/monitoring/uptime-kuma/data
mkdir -p /volume1/np-dms/monitoring/loki/data
mkdir -p /volume1/np-dms/monitoring/promtail/config

# กำหนดสิทธิ์ให้ตรงกับ User ID ใน Container
# Prometheus (UID 65534 - nobody)
chown -R 65534:65534 /volume1/np-dms/monitoring/prometheus
chmod -R 750 /volume1/np-dms/monitoring/prometheus

# Grafana (UID 472)
chown -R 472:472 /volume1/np-dms/monitoring/grafana/data
chmod -R 750 /volume1/np-dms/monitoring/grafana/data

# Uptime Kuma (UID 1000)
chown -R 1000:1000 /volume1/np-dms/monitoring/uptime-kuma/data
chmod -R 750 /volume1/np-dms/monitoring/uptime-kuma/data

# Loki (UID 10001)
chown -R 10001:10001 /volume1/np-dms/monitoring/loki/data
chmod -R 750 /volume1/np-dms/monitoring/loki/data

# Promtail (Runs as root to read docker logs - no specific chown needed for config dir if created by admin)
# But ensure config file is readable
chmod -R 755 /volume1/np-dms/monitoring/promtail/config
```

---

## 🔗 สร้าง Docker Network (ทำครั้งแรกครั้งเดียว)

> ⚠️ **ต้องสร้าง network ก่อน deploy docker-compose ทุกตัว** เพราะทุก service ใช้ `lcbp3` เป็น external network

### สร้างผ่าน Portainer (แนะนำ)

1. เปิด **Portainer** → เลือก Environment ของ ASUSTOR
2. ไปที่ **Networks** → **Add network**
3. กรอกข้อมูล:
   - **Name:** `lcbp3`
   - **Driver:** `bridge`
4. กด **Create the network**

### สร้างผ่าน SSH

```bash
# SSH เข้า ASUSTOR
ssh admin@192.168.10.9

# สร้าง external network
docker network create lcbp3

# ตรวจสอบ
docker network ls | grep lcbp3
docker network inspect lcbp3
```

> 📖 **QNAP** ก็ต้องมี network ชื่อ `lcbp3` เช่นกัน (สร้างผ่าน Container Station หรือ SSH)
> ดู [README.md – Quick Reference](README.md#-quick-reference) สำหรับคำสั่งบน QNAP

---

## Note: NPM Proxy Configuration (NPM รันบน QNAP → Forward ไป ASUSTOR)

> ⚠️ เนื่องจาก NPM อยู่บน **QNAP** แต่ Monitoring services อยู่บน **ASUSTOR**
> ต้องใช้ **IP Address** (`192.168.10.9`) แทนชื่อ container (resolve ข้ามเครื่องไม่ได้)

| Domain Names           | Scheme | Forward Hostname | Forward Port | Block Common Exploits | Websockets | Force SSL | HTTP/2 |
| :--------------------- | :----- | :--------------- | :----------- | :-------------------- | :--------- | :-------- | :----- |
| grafana.np-dms.work    | `http` | `192.168.10.9`   | 3000         | [x]                   | [x]        | [x]       | [x]    |
| prometheus.np-dms.work | `http` | `192.168.10.9`   | 9090         | [x]                   | [ ]        | [x]       | [x]    |
| uptime.np-dms.work     | `http` | `192.168.10.9`   | 3001         | [x]                   | [x]        | [x]       | [x]    |

---

## Docker Compose File (ASUSTOR)

```yaml
# File: /volume1/np-dms/monitoring/docker-compose.yml
# DMS Container v1.8.0: Application name: lcbp3-monitoring
# Deploy on: ASUSTOR AS5403T
# Services: prometheus, grafana, node-exporter, cadvisor, uptime-kuma, loki, promtail

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
  # 1. Prometheus (Metrics Collection & Storage)
  # ----------------------------------------------------------------
  prometheus:
    <<: [*restart_policy, *default_logging]
    image: prom/prometheus:v2.48.0
    container_name: prometheus
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
        reservations:
          cpus: "0.25"
          memory: 256M
    environment:
      TZ: "Asia/Bangkok"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    networks:
      - lcbp3
    volumes:
      - "/volume1/np-dms/monitoring/prometheus/config:/etc/prometheus:ro"
      - "/volume1/np-dms/monitoring/prometheus/data:/prometheus"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:9090/-/healthy"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ----------------------------------------------------------------
  # 2. Grafana (Dashboard & Visualization)
  # ----------------------------------------------------------------
  grafana:
    <<: [*restart_policy, *default_logging]
    image: grafana/grafana:10.2.2
    container_name: grafana
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
    environment:
      TZ: "Asia/Bangkok"
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: "Center#2025"
      GF_SERVER_ROOT_URL: "https://grafana.np-dms.work"
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-piechart-panel
    ports:
      - "3000:3000"
    networks:
      - lcbp3
    volumes:
      - "/volume1/np-dms/monitoring/grafana/data:/var/lib/grafana"
    depends_on:
      - prometheus
    healthcheck:
      test: ["CMD-SHELL", "wget --spider -q http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ----------------------------------------------------------------
  # 3. Uptime Kuma (Service Availability Monitoring)
  # ----------------------------------------------------------------
  uptime-kuma:
    <<: [*restart_policy, *default_logging]
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    environment:
      TZ: "Asia/Bangkok"
    ports:
      - "3001:3001"
    networks:
      - lcbp3
    volumes:
      - "/volume1/np-dms/monitoring/uptime-kuma/data:/app/data"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3001/api/entry-page || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ----------------------------------------------------------------
  # 4. Node Exporter (Host Metrics - ASUSTOR)
  # ----------------------------------------------------------------
  node-exporter:
    <<: [*restart_policy, *default_logging]
    image: prom/node-exporter:v1.7.0
    container_name: node-exporter
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 128M
    environment:
      TZ: "Asia/Bangkok"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    networks:
      - lcbp3
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:9100/metrics"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ----------------------------------------------------------------
  # 5. cAdvisor (Container Metrics - ASUSTOR)
  # ----------------------------------------------------------------
  cadvisor:
    <<: [*restart_policy, *default_logging]
    image: gcr.io/cadvisor/cadvisor:v0.47.2
    container_name: cadvisor
    privileged: true
    devices:
      - /dev/kmsg
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    environment:
      TZ: "Asia/Bangkok"
    ports:
      - "8088:8088"
    networks:
      - lcbp3
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ----------------------------------------------------------------
  # 6. Loki (Log Aggregation)
  # ----------------------------------------------------------------
  loki:
    <<: [*restart_policy, *default_logging]
    image: grafana/loki:2.9.0
    container_name: loki
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M
    environment:
      TZ: "Asia/Bangkok"
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - "3100:3100"
    networks:
      - lcbp3
    volumes:
      - "/volume1/np-dms/monitoring/loki/data:/loki"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3100/ready"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ----------------------------------------------------------------
  # 7. Promtail (Log Shipper)
  # ----------------------------------------------------------------
  promtail:
    <<: [*restart_policy, *default_logging]
    image: grafana/promtail:2.9.0
    container_name: promtail
    user: "0:0"
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    environment:
      TZ: "Asia/Bangkok"
    command: -config.file=/etc/promtail/promtail-config.yml
    networks:
      - lcbp3
    volumes:
      - "/volume1/np-dms/monitoring/promtail/config:/etc/promtail:ro"
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "/var/lib/docker/containers:/var/lib/docker/containers:ro"
    depends_on:
      - loki
```

---

## QNAP Node Exporter & cAdvisor

ติดตั้ง node-exporter และ cAdvisor บน QNAP เพื่อให้ Prometheus บน ASUSTOR scrape metrics ได้:

```yaml
# File: /share/np-dms/monitoring/docker-compose.yml (QNAP)
# เฉพาะ exporters เท่านั้น - metrics ถูก scrape โดย Prometheus บน ASUSTOR

version: '3.8'

networks:
  lcbp3:
    external: true

services:
  node-exporter:
    image: prom/node-exporter:v1.7.0
    container_name: node-exporter
    restart: unless-stopped
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    networks:
      - lcbp3
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:v0.47.2
    container_name: cadvisor
    restart: unless-stopped
    privileged: true
    ports:
      - "8088:8080"
    networks:
      - lcbp3
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /sys/fs/cgroup:/sys/fs/cgroup:ro

  mysqld-exporter:
    image: prom/mysqld-exporter:v0.15.0
    container_name: mysqld-exporter
    restart: unless-stopped
    user: root
    command:
      - '--config.my-cnf=/etc/mysql/my.cnf'
    ports:
      - "9104:9104"
    networks:
      - lcbp3
    volumes:
      - "/share/np-dms/monitoring/mysqld-exporter/.my.cnf:/etc/mysql/my.cnf:ro"
```

---

## Prometheus Configuration

สร้างไฟล์ `/volume1/np-dms/monitoring/prometheus/config/prometheus.yml` บน ASUSTOR:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Prometheus self-monitoring (ASUSTOR)
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # ============================================
  # ASUSTOR Metrics (Local)
  # ============================================

  # Host metrics from Node Exporter (ASUSTOR)
  - job_name: 'asustor-node'
    static_configs:
      - targets: ['node-exporter:9100']
        labels:
          host: 'asustor'

  # Container metrics from cAdvisor (ASUSTOR)
  - job_name: 'asustor-cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
        labels:
          host: 'asustor'

  # ============================================
  # QNAP Metrics (Remote - 192.168.10.8)
  # ============================================

  # Host metrics from Node Exporter (QNAP)
  - job_name: 'qnap-node'
    static_configs:
      - targets: ['192.168.10.8:9100']
        labels:
          host: 'qnap'

  # Container metrics from cAdvisor (QNAP)
  - job_name: 'qnap-cadvisor'
    static_configs:
      - targets: ['192.168.10.8:8088']
        labels:
          host: 'qnap'

  # Backend NestJS application (QNAP)
  - job_name: 'backend'
    static_configs:
      - targets: ['192.168.10.8:3000']
        labels:
          host: 'qnap'
    metrics_path: '/metrics'

  # MariaDB Exporter (QNAP)
  - job_name: 'mariadb'
    static_configs:
      - targets: ['192.168.10.8:9104']
        labels:
          host: 'qnap'
```

---

## Uptime Kuma Monitors

เมื่อ Uptime Kuma พร้อมใช้งาน ให้เพิ่ม monitors ต่อไปนี้:

| Monitor Name  | Type | URL / Host                         | Interval |
| :------------ | :--- | :--------------------------------- | :------- |
| QNAP NPM      | HTTP | https://npm.np-dms.work            | 60s      |
| Frontend      | HTTP | https://lcbp3.np-dms.work          | 60s      |
| Backend API   | HTTP | https://backend.np-dms.work/health | 60s      |
| MariaDB       | TCP  | 192.168.10.8:3306                  | 60s      |
| Redis         | TCP  | 192.168.10.8:6379                  | 60s      |
| Elasticsearch | HTTP | http://192.168.10.8:9200           | 60s      |
| Gitea         | HTTP | https://git.np-dms.work            | 60s      |
| n8n           | HTTP | https://n8n.np-dms.work            | 60s      |
| Grafana       | HTTP | https://grafana.np-dms.work        | 60s      |
| QNAP Host     | Ping | 192.168.10.8                       | 60s      |
| ASUSTOR Host  | Ping | 192.168.10.9                       | 60s      |

---

## Grafana Dashboards

### Recommended Dashboards to Import

| Dashboard ID | Name                         | Purpose                        |
| :----------- | :--------------------------- | :----------------------------- |
| 1860         | Node Exporter Full           | Host system metrics            |
| 14282        | cAdvisor exporter            | Container metrics              |
| 11074        | Node Exporter for Prometheus | Node overview                  |
| 893          | Docker and Container         | Docker overview                |
| 7362         | MySQL                        | MySQL view                     |
| 1214         | Redis                        | Redis view                     |
| 14204        | Elasticsearch                | Elasticsearch view             |
| 13106        | MySQL/MariaDB Overview       | Detailed MySQL/MariaDB metrics |


### Import Dashboard via Grafana UI

1. Go to **Dashboards → Import**
2. Enter Dashboard ID (e.g., `1860`)
3. Select Prometheus data source
4. Click **Import**

---

## 🚀 Deploy lcbp3-monitoring บน ASUSTOR

### 📋 Prerequisites Checklist

| #    | ขั้นตอน                                                                                              | Status |
| :--- | :------------------------------------------------------------------------------------------------- | :----- |
| 1    | SSH เข้า ASUSTOR ได้ (`ssh admin@192.168.10.9`)                                                      | ✅      |
| 2    | Docker Network `lcbp3` สร้างแล้ว (ดูหัวข้อ [สร้าง Docker Network](#-สร้าง-docker-network-ทำครั้งแรกครั้งเดียว)) | ✅      |
| 3    | สร้าง Directories และกำหนดสิทธิ์แล้ว (ดูหัวข้อ [กำหนดสิทธิ](#กำหนดสิทธิ-บน-asustor))                              | ✅      |
| 4    | สร้าง `prometheus.yml` แล้ว (ดูหัวข้อ [Prometheus Configuration](#prometheus-configuration))            | ✅      |
| 5    | สร้าง `promtail-config.yml` แล้ว (ดูหัวข้อ [Step 1.2](#step-12-สร้าง-promtail-configyml))                | ✅      |

---

### Step 1: สร้าง prometheus.yml

```bash
# SSH เข้า ASUSTOR
ssh admin@192.168.10.9

# สร้างไฟล์ prometheus.yml
cat > /volume1/np-dms/monitoring/prometheus/config/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'asustor-node'
    static_configs:
      - targets: ['node-exporter:9100']
        labels:
          host: 'asustor'

  - job_name: 'asustor-cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
        labels:
          host: 'asustor'

  - job_name: 'qnap-node'
    static_configs:
      - targets: ['192.168.10.8:9100']
        labels:
          host: 'qnap'

  - job_name: 'qnap-cadvisor'
    static_configs:
      - targets: ['192.168.10.8:8088']
        labels:
          host: 'qnap'

  - job_name: 'backend'
    static_configs:
      - targets: ['192.168.10.8:3000']
        labels:
          host: 'qnap'
    metrics_path: '/metrics'
EOF

# ตรวจสอบ
cat /volume1/np-dms/monitoring/prometheus/config/prometheus.yml
```

### Step 1.2: สร้าง promtail-config.yml

ต้องสร้าง Config ให้ Promtail อ่าน logs จาก Docker containers และส่งไป Loki:

```bash
# สร้างไฟล์ promtail-config.yml
cat > /volume1/np-dms/monitoring/promtail/config/promtail-config.yml << 'EOF'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'
EOF

# ขั้นตอนการเตรียมระบบที่ QNAP (ก่อน Deploy Stack)

### 1. สร้าง Monitoring User ใน MariaDB
รันคำสั่ง SQL นี้ผ่าน **phpMyAdmin** หรือ `docker exec`:
```sql
CREATE USER 'exporter'@'%' IDENTIFIED BY 'Center2025' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT, SELECT, SLAVE MONITOR ON *.* TO 'exporter'@'%';
FLUSH PRIVILEGES;
```

### 2. สร้างไฟล์คอนฟิก .my.cnf บน QNAP
เพื่อให้ `mysqld-exporter` อ่านรหัสผ่านที่มีตัวอักษรพิเศษได้ถูกต้อง:

1. **SSH เข้า QNAP** (หรือใช้ File Station สร้าง Folder):
   ```bash
   ssh admin@192.168.10.8
   ```
2. **สร้าง Directory สำหรับเก็บ Config**:
   ```bash
   mkdir -p /share/np-dms/monitoring/mysqld-exporter
   ```
3. **สร้างไฟล์ .my.cnf**:
   ```bash
   cat > /share/np-dms/monitoring/mysqld-exporter/.my.cnf << 'EOF'
[client]
user=exporter
password=Center2025
host=mariadb
EOF
   ```
4. **กำหนดสิทธิ์ไฟล์** (เพื่อให้ Container อ่านไฟล์ได้):
   ```bash
   chmod 644 /share/np-dms/monitoring/mysqld-exporter/.my.cnf
   ```

# ตรวจสอบ
cat /volume1/np-dms/monitoring/promtail/config/promtail-config.yml
```

---

### Step 2: Deploy ผ่าน Portainer (แนะนำ)

1. เปิด **Portainer** → เลือก Environment ของ **ASUSTOR**
2. ไปที่ **Stacks** → **Add stack**
3. กรอกข้อมูล:
   - **Name:** `lcbp3-monitoring`
   - **Build method:** เลือก **Web editor**
4. วาง (Paste) เนื้อหาจาก [Docker Compose File (ASUSTOR)](#docker-compose-file-asustor) ด้านบน
5. กด **Deploy the stack**

> ⚠️ **สำคัญ:** ตรวจสอบ Password ของ Grafana (`GF_SECURITY_ADMIN_PASSWORD`) ใน docker-compose ก่อน deploy

### Deploy ผ่าน SSH (วิธีสำรอง)

```bash
# SSH เข้า ASUSTOR
ssh admin@192.168.10.9

# คัดลอก docker-compose.yml ไปยัง path
# (วางไฟล์ที่ /volume1/np-dms/monitoring/docker-compose.yml)

# Deploy
cd /volume1/np-dms/monitoring
docker compose up -d

# ตรวจสอบ container status
docker compose ps
```

---

### Step 3: Verify Services

```bash
# ตรวจสอบ containers ทั้งหมด
docker ps --filter "name=prometheus" --filter "name=grafana" \
  --filter "name=uptime-kuma" --filter "name=node-exporter" \
  --filter "name=cadvisor" --filter "name=loki" --filter "name=promtail"
```

| Service           | วิธีตรวจสอบ                                                          | Expected Result                       |
| :---------------- | :----------------------------------------------------------------- | :------------------------------------ |
| ✅ **Prometheus**  | `curl http://192.168.10.9:9090/-/healthy`                          | `Prometheus Server is Healthy`        |
| ✅ **Grafana**     | เปิด `https://grafana.np-dms.work` (หรือ `http://192.168.10.9:3000`) | หน้า Login                             |
| ✅ **Uptime Kuma** | เปิด `https://uptime.np-dms.work` (หรือ `http://192.168.10.9:3001`)  | หน้า Setup                             |
| ✅ **Node Exp.**   | `curl http://192.168.10.9:9100/metrics \| head`                    | Metrics output                        |
| ✅ **cAdvisor**    | `curl http://192.168.10.9:8080/healthz`                            | `ok`                                  |
| ✅ **Loki**        | `curl http://192.168.10.9:3100/ready`                              | `ready`                               |
| ✅ **Promtail**    | เช็ค Logs: `docker logs promtail`                                   | ไม่ควรมี Error + เห็น connection success |

---

### Step 4: Deploy QNAP Exporters

ติดตั้ง node-exporter และ cAdvisor บน QNAP เพื่อให้ Prometheus scrape ข้ามเครื่องได้:

#### ผ่าน Container Station (QNAP)

1. เปิด **Container Station** บน QNAP Web UI
2. ไปที่ **Applications** → **Create**
3. ตั้งชื่อ Application: `lcbp3-exporters`
4. วาง (Paste) เนื้อหาจาก [QNAP Node Exporter & cAdvisor](#qnap-node-exporter--cadvisor)
5. กด **Create**

#### ตรวจสอบจาก ASUSTOR

```bash
# ตรวจว่า Prometheus scrape QNAP ได้
curl -s http://localhost:9090/api/v1/targets | grep -E '"qnap-(node|cadvisor)"'

# หรือเปิด Prometheus UI → Targets
# URL: http://192.168.10.9:9090/targets
# ดูว่า qnap-node, qnap-cadvisor เป็น State: UP
```

---

### Step 5: ตั้งค่า Grafana & Uptime Kuma

#### Grafana — First Login

1. เปิด `https://grafana.np-dms.work`
2. Login: `admin` / `Center#2025` (หรือ password ที่ตั้งไว้)
3. ไปที่ **Connections** → **Data sources** → **Add data source**
4. เลือก **Prometheus**
   - URL: `http://prometheus:9090`
   - กด **Save & Test** → ต้องขึ้น ✅
5. Import Dashboards (ดูรายละเอียดในหัวข้อ [6. Grafana Dashboards Setup](#6-grafana-dashboards-setup))

#### Uptime Kuma — First Setup

1. เปิด `https://uptime.np-dms.work`
2. สร้าง Admin account
3. เพิ่ม Monitors ตาม [ตาราง Uptime Kuma Monitors](#uptime-kuma-monitors)

---

### 6. Grafana Dashboards Setup

เพื่อการ Monitor ที่สมบูรณ์ แนะนำให้ Import Dashboards ต่อไปนี้:

#### 6.1 Host Monitoring (Node Exporter)
*   **Concept:** ดู resource ของเครื่อง Host (CPU, RAM, Disk, Network)
*   **Dashboard ID:** `1860` (Node Exporter Full)
*   **วิธี Import:**
    1. ไปที่ **Dashboards** → **New** → **Import**
    2. ช่อง **Import via grafana.com** ใส่เลข `1860` กด **Load**
    3. เลือก Data source: **Prometheus**
    4. กด **Import**

#### 6.2 Container Monitoring (cAdvisor)
*   **Concept:** ดู resource ของแต่ละ Container (เชื่อม Logs ด้วย)
*   **Dashboard ID:** `14282` (Cadvisor exporter)
*   **วิธี Import:**
    1. ใส่เลข `14282` กด **Load**
    2. เลือก Data source: **Prometheus**
    3. กด **Import**

#### 6.3 Logs Monitoring (Loki Integration)
เพื่อให้ Dashboard ของ Container แสดง Logs จาก Loki ได้ด้วย:

1. เปิด Dashboard **Cadvisor exporter** ที่เพิ่ง Import มา
2. กดปุ่ม **Add visualization** (หรือ Edit dashboard)
3. เลือก Data source: **Loki**
4. ในช่อง Query ใส่: `{container="$name"}`
    *   *(Note: `$name` มาจาก Variable ของ Dashboard 14282)*
5. ปรับ Visualization type เป็น **Logs**
6. ตั้งชื่อ Panel ว่า **"Container Logs"**
7. กด **Apply** และ **Save Dashboard**

ตอนนี้เราจะเห็นทั้ง **กราฟการกินทรัพยากร** และ **Logs** ของ Container นั้นๆ ในหน้าเดียวกันครับ

#### 6.4 Integrated Dashboard (Recommended)

ผมได้เตรียม JSON file ที่รวม Metrics และ Logs ไว้ให้แล้วครับ:

1.  ไปที่ **Dashboards** → **New** → **Import**
2.  ลากไฟล์ หรือ Copy เนื้อหาจากไฟล์:
    `specs/08-infrastructure/grafana/dashboards/lcbp3-docker-monitoring.json`
3.  กด **Load** และ **Import**

## 7.3 Backup / Export Dashboards

เมื่อปรับแต่ง Dashboard จนพอใจแล้ว ควร Export เก็บเป็นไฟล์ JSON ไว้ backup หรือ version control:

1.  เปิด Dashboard ที่ต้องการ backup
2.  ไปที่ปุ่ม **Share Dashboard** (ไอคอน 🔗 หรือ Share มุมซ้ายบน)
3.  เลือกTab **Export**
4.  เปิดตัวเลือก **Export for sharing externally** (เพื่อให้ลบ hardcoded value)
5.  กด **Save to file**
6.  นำไฟล์ JSON มาเก็บไว้ที่ path: `specs/08-infrastructure/grafana/dashboards/`

---

> 📝 **หมายเหตุ**: เอกสารนี้อ้างอิงจาก Architecture Document **v1.8.0** - Monitoring Stack deploy บน ASUSTOR AS5403T

