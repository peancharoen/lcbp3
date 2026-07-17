# Docker Compose — np-dms-lcbp3 (New Server 192.168.10.11)

Server consolidation stack สำหรับ New Server (ADR-041) — จัดแบ่งเป็น 4 layers ตาม dependency order.

## Layout

```
np-dms-lcbp3/
├── .env.template                    # Master template (placeholders)
├── 01-infrastructure/               # Layer 1: Data Stores (รันก่อน)
│   └── docker-compose.yml
│       ├── mariadb   (16G, bind 192.168.10.11:3306)
│       ├── pma       (bind 192.168.10.11:8080)
│       ├── cache     (Redis 4G, bind 192.168.10.11:6379)
│       ├── search    (Elasticsearch 6G, bind 192.168.10.11:9200)
│       ├── qdrant    (4G, bind 192.168.10.11:6333)
│       └── portainer (bind 192.168.10.11:9443)
│
├── 02-platform/                     # Layer 2: DevOps Platform
│   └── docker-compose.yml
│       ├── gitea     (port 192.168.10.11:3003, SSH 2222)
│       ├── n8n-db    (PostgreSQL, internal only)
│       ├── docker-socket-proxy (internal only)
│       └── n8n       (port 192.168.10.11:5678)
│
├── 03-application/                  # Layer 3: DMS Application
│   └── docker-compose.yml
│       ├── clamav    (internal only — backend เรียกผ่าน DNS clamav:3310)
│       ├── backend   (2G, port 0.0.0.0:3000 → NPM proxy)
│       └── frontend  (3G, port 0.0.0.0:3001 → NPM proxy)
│
└── 04-ai/                           # Layer 4: AI Services (GPU)
    └── ocr-sidecar/     # Build context + compose (copy from Desk-5439)
        ├── docker-compose.yml
        │   ├── ocr-sidecar      (port 192.168.10.11:8765)
        │   └── ollama-metrics   (port 192.168.10.11:9924)
        ├── Dockerfile
        ├── app.py
        └── ...
    # Ollama = native systemd service (not Docker) — models at /opt/ollama
```

## Architecture Decisions

| Decision | Reference | Rationale |
|---|---|---|
| 4-layer split | ADR-041 D1 | Dependency-ordered lifecycle management |
| NPM stays on QNAP | ADR-041 (revised) | SPOF mitigation — edge proxy separated from compute |
| ASUSTOR = Primary NAS | ADR-041 D2 | Uploads via CIFS mount from ASUSTOR |
| Tika removed | ADR-028 research | Legacy — rejected (Thai NLP support อ่อนแอ, ขัด ADR-023A) |
| MariaDB 16G RAM | ADR-041 D8 | RAM 64GB มี headroom พอ — ใช้ buffer pool เต็มที่ |
| ES heap 4G | ADR-041 D9 | RAM 64GB มีพอ — คืนค่า heap เป็น 4G ตามขนาดเดิม |
| Portainer | ADR-041 | Docker management UI — bind 192.168.10.11:9443 → NPM proxy |
| Docker-internal isolation | ADR-041 D1, ADR-040 D5 | Ollama/OCR ไม่ expose ออก LAN |
| No UFW firewall | Omada OC200 | VLAN 10 เป็น isolated VLAN ควบคุมด้วย OC200 อยู่แล้ว |

## Port Mapping (NPM on QNAP → New Server)

| Service | New Server Port | NPM Proxy Host | Domain |
|---|---|---|---|
| backend | 0.0.0.0:3000 | `192.168.10.11:3000` | api.np-dms.work |
| frontend | 0.0.0.0:3001 | `192.168.10.11:3001` | lcbp3.np-dms.work |
| gitea HTTP | 192.168.10.11:3003 | `192.168.10.11:3003` | git.np-dms.work |
| gitea SSH | 192.168.10.11:2222 | (direct) | git.np-dms.work:2222 |
| n8n | 192.168.10.11:5678 | `192.168.10.11:5678` | n8n.np-dms.work |
| pma | 192.168.10.11:8080 | `192.168.10.11:8080` | pma.np-dms.work |
| portainer | 192.168.10.11:9443 | `192.168.10.11:9443` | portainer.np-dms.work |
| MariaDB | 192.168.10.11:3306 | (direct — NPM on QNAP) | — |
| Redis | 192.168.10.11:6379 | (direct — Uptime Kuma @ ASUSTOR) | — |
| Elasticsearch | 192.168.10.11:9200 | (direct — Uptime Kuma @ ASUSTOR) | — |
| Qdrant | 192.168.10.11:6333 | (direct — Uptime Kuma @ ASUSTOR) | — |
| Ollama API | 192.168.10.11:11434 | (direct — native systemd) | — |
| ollama-metrics | 192.168.10.11:9924 | (Prometheus direct from ASUSTOR) | — |
| OCR Sidecar | 192.168.10.11:8765 | (direct — backend internal) | — |

## RAM Budget (64GB Total)

| Service | Memory Limit | Notes |
|---|---|---|
| MariaDB | 16G | innodb_buffer_pool_size=16G |
| Elasticsearch | 6G | heap 4G |
| Redis | 4G | in-memory cache + BullMQ |
| Qdrant | 4G | vector DB |
| Backend (NestJS) | 2G | |
| Frontend (Next.js) | 3G | |
| ClamAV | 2G | virus definitions |
| Gitea | 2G | |
| n8n | 2G | workflow orchestrator |
| n8n-db (PostgreSQL) | ~1G | estimated |
| docker-socket-proxy | ~256M | |
| Ollama (systemd) | 8G | system RAM (VRAM แยก) — native service ไม่ใช่ Docker |
| OCR Sidecar | 2G | |
| ollama-metrics | ~256M | |
| PMA | 256M | |
| Portainer | 256M | |
| OS + Docker daemon | ~3G | |
| **Total** | **~55.8G** | headroom ~8G — monitor หลัง cutover |

> ✅ RAM 64GB มี headroom เพียงพอ — ไม่ต้องลด memory limit ใดๆ
> ⚠️ ถ้า OOM (ไม่น่าเกิด) → ลด Ollama system RAM เป็น 6G หรือ ES heap เป็น 2G

## Disk Layout (LVM — 2x NVMe 931.5G)

```
nvme0n1 (Data disk) — VG: data-vg
├─ mariadb-lv        200G → /data/mariadb
├─ elasticsearch-lv  300G → /data/elasticsearch
├─ qdrant-lv         100G → /data/qdrant
└─ postgres-lv       100G → /data/postgres

nvme1n1 (OS disk) — VG: ubuntu-vg
├─ ubuntu-lv     150G → /
├─ docker-lv     100G → /var/lib/docker
├─ np-dms-lv     300G → /opt/np-dms       (Redis, Gitea, n8n, ClamAV, logs, PMA, MariaDB config)
└─ ollama-lv     100G → /opt/ollama        (Ollama models — native systemd)
```

## ASUSTOR CIFS Mounts

New Server ต้อง mount ASUSTOR shares ก่อน `docker compose up`:

```bash
# /etc/fstab บน New Server (3 separate CIFS shares)
# uploads/temp (read-write — backend เขียนได้)
//192.168.10.9/np-dms/data/uploads/temp       /mnt/asustor-uploads/temp       cifs  credentials=/etc/cifs/asustor.cred,uid=1000,gid=1000,vers=3.0,iocharset=utf8,_netdev,nofail  0  0
# uploads/permanent (read-write — backend ย้ายไฟล์จาก temp มาที่นี่)
//192.168.10.9/np-dms/data/uploads/permanent  /mnt/asustor-uploads/permanent  cifs  credentials=/etc/cifs/asustor.cred,uid=1000,gid=1000,vers=3.0,iocharset=utf8,_netdev,nofail  0  0
# legacy (read-only — migration files)
//192.168.10.9/np-dms/Legacy                  /mnt/asustor-legacy             cifs  credentials=/etc/cifs/asustor.cred,uid=1000,gid=1000,vers=3.0,iocharset=utf8,ro,_netdev,nofail  0  0
```

## Usage (per layer)

```bash
# 0. สร้าง Docker network (ครั้งเดียว)
docker network create lcbp3
docker network create gitnet

# Runtime dirs: /opt/np-dms/{01-infrastructure,02-platform,03-application,04-ai/ocr-sidecar}
# Source repo:  /opt/np-dms/np-dms-lcbp3/ (git clone — copy compose files to runtime dirs)
# Master .env: /opt/np-dms/.env (สร้างจาก .env.template — edit secrets ที่นี่ที่เดียว)

# 1. Layer 1: Infrastructure
cd /opt/np-dms/01-infrastructure
docker compose --env-file ../.env up -d
# รอ healthcheck ผ่านทุก container

# 2. Layer 2: Platform
cd /opt/np-dms/02-platform
docker compose --env-file ../.env up -d

# 3. Layer 3: Application
cd /opt/np-dms/03-application
docker compose --env-file ../.env up -d

# 4. Layer 4: AI (OCR Sidecar + Metrics — Ollama is native systemd)
cd /opt/np-dms/04-ai/ocr-sidecar
docker compose --env-file ../../.env up -d --build
```

> Single source of truth — แก้ `.env` ที่ root ที่เดียว ทุก layer ใช้ค่าเดียวกันทันที ไม่ต้อง copy ใหม่

## Migrated from

| Layer | QNAP source | Desk-5439 source |
|---|---|---|
| 01-infrastructure | mariadb/, service/ | — |
| 02-platform | gitea/, n8n/ (without tika) | — |
| 03-application | app/ | — |
| 04-ai | — | ocr-sidecar/, Ollama (host) |

## Monitoring

Uptime Kuma รันบน ASUSTOR NAS (192.168.10.9) — แยกเครื่องจาก services หลัก
ดูแผนการ monitor ทั้งหมดได้ที่: [`docs/MONITORING-PLAN-REV01.md`](../../../docs/MONITORING-PLAN-REV01.md)

- **Tier 1:** Public-facing (Frontend, Backend, Gitea, n8n) — HTTP(s) + Json Query
- **Tier 2:** Internal infra (MariaDB, Redis, ES, Qdrant, Ollama, etc.) — TCP/HTTP/Ping
- **Tier 3:** Docker Container (Gitea CI runner บน ASUSTOR เท่านั้น)
- **Tier 4:** Push monitor (ClamAV, Disk, GPU, CIFS, Docker daemon, BullMQ queues)

## Not Included (stays on QNAP / ASUSTOR)

- **NPM** (Nginx Proxy Manager) — edge proxy, stays on QNAP for SPOF mitigation
- **Uptime Kuma** — monitoring service, stays on ASUSTOR (192.168.10.9:3001)
