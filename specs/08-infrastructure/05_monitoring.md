# การติดตั้ง Monitoring Stack บน ASUSTOR

## **📝 คำอธิบายและข้อควรพิจารณา**

> ⚠️ **หมายเหตุ**: Monitoring Stack ทั้งหมดติดตั้งบน **ASUSTOR AS5403T** ไม่ใช่ QNAP
> เพื่อแยก Application workload ออกจาก Infrastructure/Monitoring workload

Stack สำหรับ Monitoring ประกอบด้วย:

| Service           | Port | Purpose                           | Host    |
| :---------------- | :--- | :-------------------------------- | :------ |
| **Prometheus**    | 9090 | เก็บ Metrics และ Time-series data  | ASUSTOR |
| **Grafana**       | 3000 | Dashboard สำหรับแสดงผล Metrics      | ASUSTOR |
| **Node Exporter** | 9100 | เก็บ Metrics ของ Host system       | Both    |
| **cAdvisor**      | 8080 | เก็บ Metrics ของ Docker containers | Both    |
| **Uptime Kuma**   | 3001 | Service Availability Monitoring   | ASUSTOR |
| **Loki**          | 3100 | Log aggregation                   | ASUSTOR |

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
│  ┌─────────────┐    ┌─────────────┐                                    │
│  │node-exporter│    │  cAdvisor   │                                    │
│  │   :9100     │    │   :8080     │                                    │
│  │  (Local)    │    │  (Local)    │                                    │
│  └─────────────┘    └─────────────┘                                    │
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
```

---

## Note: NPM Proxy Configuration (ถ้าใช้ NPM บน ASUSTOR)

| Domain Names           | Forward Hostname | IP Forward Port | Cache Assets | Block Common Exploits | Websockets | Force SSL | HTTP/2 |
| :--------------------- | :--------------- | :-------------- | :----------- | :-------------------- | :--------- | :-------- | :----- |
| grafana.np-dms.work    | grafana          | 3000            | [ ]          | [x]                   | [x]        | [x]       | [x]    |
| prometheus.np-dms.work | prometheus       | 9090            | [ ]          | [x]                   | [ ]        | [x]       | [x]    |
| uptime.np-dms.work     | uptime-kuma      | 3001            | [ ]          | [x]                   | [x]        | [x]       | [x]    |

> **หมายเหตุ**: ถ้าใช้ NPM บน QNAP เพียงตัวเดียว ให้ forward ไปยัง IP ของ ASUSTOR (192.168.10.9)

---

## Docker Compose File (ASUSTOR)

```yaml
# File: /volume1/np-dms/monitoring/docker-compose.yml
# DMS Container v1.8.0: Application name: lcbp3-monitoring
# Deploy on: ASUSTOR AS5403T
# Services: prometheus, grafana, node-exporter, cadvisor, uptime-kuma, loki

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
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-Center#2025}
      GF_SERVER_ROOT_URL: "https://grafana.np-dms.work"
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-piechart-panel
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
    networks:
      - lcbp3
    volumes:
      - "/volume1/np-dms/monitoring/uptime-kuma/data:/app/data"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001"]
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
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    environment:
      TZ: "Asia/Bangkok"
    networks:
      - lcbp3
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
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
    networks:
      - lcbp3
    volumes:
      - "/volume1/np-dms/monitoring/loki/data:/loki"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3100/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
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
    networks:
      - lcbp3
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
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
      - targets: ['192.168.10.8:8080']
        labels:
          host: 'qnap'

  # Backend NestJS application (QNAP)
  - job_name: 'backend'
    static_configs:
      - targets: ['192.168.10.8:3000']
        labels:
          host: 'qnap'
    metrics_path: '/metrics'

  # MariaDB Exporter (optional - QNAP)
  # - job_name: 'mariadb'
  #   static_configs:
  #     - targets: ['192.168.10.8:9104']
  #       labels:
  #         host: 'qnap'
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

| Dashboard ID | Name                         | Purpose             |
| :----------- | :--------------------------- | :------------------ |
| 1860         | Node Exporter Full           | Host system metrics |
| 14282        | cAdvisor exporter            | Container metrics   |
| 11074        | Node Exporter for Prometheus | Node overview       |
| 7362         | Docker and Host Monitoring   | Combined view       |

### Import Dashboard via Grafana UI

1. Go to **Dashboards → Import**
2. Enter Dashboard ID (e.g., `1860`)
3. Select Prometheus data source
4. Click **Import**

---

> 📝 **หมายเหตุ**: เอกสารนี้อ้างอิงจาก Architecture Document **v1.8.0** - Monitoring Stack deploy บน ASUSTOR AS5403T
