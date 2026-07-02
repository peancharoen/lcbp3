# Docker Compose — np-dms-lcbp3 (New Server 192.168.10.11)

Server consolidation stack สำหรับ New Server (ADR-041) — จัดแบ่งเป็น 4 layers ตาม dependency order.

## Layout

```
np-dms-lcbp3/
├── .env.template                    # Master template (placeholders)
├── 01-infrastructure/               # Layer 1: Data Stores (รันก่อน)
│   └── docker-compose.yml
│       ├── mariadb   (8G, port 192.168.10.11:3306)
│       ├── pma       (port 192.168.10.11:8080)
│       ├── cache     (Redis, loopback only)
│       ├── search    (Elasticsearch, internal only)
│       └── qdrant    (internal only)
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
│       ├── clamav    (internal only)
│       ├── backend   (port 192.168.10.11:3000)
│       └── frontend  (port 192.168.10.11:3001)
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
| MariaDB 8G RAM | ADR-041 D5 | DB ยังเล็ก (~10MB) — อัปเกรดได้ภายหลัง |
| Docker-internal isolation | ADR-041 D1, ADR-040 D5 | Ollama/OCR ไม่ expose ออก LAN |
| No UFW firewall | Omada OC200 | VLAN 10 เป็น isolated VLAN ควบคุมด้วย OC200 อยู่แล้ว |

## Port Mapping (NPM on QNAP → New Server)

| Service | New Server Port | NPM Proxy Host | Domain |
|---|---|---|---|
| backend | 192.168.10.11:3000 | `192.168.10.11:3000` | backend.np-dms.work |
| frontend | 192.168.10.11:3001 | `192.168.10.11:3001` | lcbp3.np-dms.work |
| gitea HTTP | 192.168.10.11:3003 | `192.168.10.11:3003` | git.np-dms.work |
| gitea SSH | 192.168.10.11:2222 | (direct) | git.np-dms.work:2222 |
| n8n | 192.168.10.11:5678 | `192.168.10.11:5678` | n8n.np-dms.work |
| pma | 192.168.10.11:8080 | `192.168.10.11:8080` | pma.np-dms.work |
| ollama-metrics | 192.168.10.11:9924 | (Prometheus direct) | — |

## RAM Budget (32GB Total)

| Service | Memory Limit |
|---|---|
| MariaDB | 8G |
| Elasticsearch | 3G |
| Redis | 2G |
| Qdrant | 2G |
| Backend | 1.5G |
| Frontend | 2G |
| ClamAV | 2G |
| Gitea | 2G |
| n8n | 2G |
| n8n-db (PostgreSQL) | ~1G |
| docker-socket-proxy | ~256M |
| Ollama | 4G |
| OCR Sidecar | 1G |
| ollama-metrics | ~256M |
| PMA | 256M |
| OS + Docker | ~2G |
| **Total** | **~33.5G** (tight — monitor หลัง cutover) |

## Disk Layout (LVM — 2x NVMe 931.5G)

```
nvme0n1 (OS disk) — VG: ubuntu-vg
├─ ubuntu-lv     100G → /
├─ docker-lv     100G → /var/lib/docker
├─ np-dms-lv     300G → /opt/np-dms       (Redis, Gitea, n8n, ClamAV, logs, PMA, MariaDB config)
└─ ollama-lv     100G → /opt/ollama        (Ollama models — native systemd)

nvme1n1 (Data disk) — VG: data-vg
├─ mariadb-lv        200G → /data/mariadb
├─ elasticsearch-lv  300G → /data/elasticsearch
├─ qdrant-lv         100G → /data/qdrant
└─ postgres-lv       100G → /data/postgres
```

## ASUSTOR CIFS Mounts

New Server ต้อง mount ASUSTOR shares ก่อน `docker compose up`:

```bash
# /etc/fstab บน New Server (3 separate CIFS shares)
# uploads/temp (read-write — backend เขียนได้)
//192.168.10.9/np-dms-as/data/uploads/temp       /mnt/asustor-uploads/temp       cifs  credentials=/etc/cifs/asustor.cred,uid=0,gid=0,vers=3.0,iocharset=utf8,_netdev,nofail  0  0
# uploads/permanent (read-write — backend ย้ายไฟล์จาก temp มาที่นี่)
//192.168.10.9/np-dms-as/data/uploads/permanent  /mnt/asustor-uploads/permanent  cifs  credentials=/etc/cifs/asustor.cred,uid=0,gid=0,vers=3.0,iocharset=utf8,_netdev,nofail  0  0
# legacy (read-only — migration files)
//192.168.10.9/np-dms-as/Legacy                  /mnt/asustor-legacy             cifs  credentials=/etc/cifs/asustor.cred,uid=0,gid=0,vers=3.0,iocharset=utf8,ro,_netdev,nofail  0  0
```

## Usage (per layer)

```bash
# 0. สร้าง Docker network (ครั้งเดียว)
docker network create lcbp3
docker network create gitnet

# Runtime dirs: /opt/np-dms/{01-infrastructure,02-platform,03-application,04-ai/ocr-sidecar}
# Source repo:  /opt/np-dms/np-dms-lcbp3/ (git clone — copy compose files to runtime dirs)

# 1. Layer 1: Infrastructure
cd /opt/np-dms/01-infrastructure
cp ../.env.template .env  # edit secrets
docker compose --env-file .env up -d
# รอ healthcheck ผ่านทุก container

# 2. Layer 2: Platform
cd /opt/np-dms/02-platform
cp ../.env.template .env  # edit secrets
docker compose --env-file .env up -d

# 3. Layer 3: Application
cd /opt/np-dms/03-application
cp ../.env.template .env  # edit secrets
docker compose --env-file .env up -d

# 4. Layer 4: AI (OCR Sidecar + Metrics — Ollama is native systemd)
cd /opt/np-dms/04-ai/ocr-sidecar
cp ../../.env.template .env  # edit secrets
docker compose --env-file .env up -d
```

## Migrated from

| Layer | QNAP source | Desk-5439 source |
|---|---|---|
| 01-infrastructure | mariadb/, service/ | — |
| 02-platform | gitea/, n8n/ (without tika) | — |
| 03-application | app/ | — |
| 04-ai | — | ocr-sidecar/, Ollama (host) |

## Not Included (stays on QNAP)

- **NPM** (Nginx Proxy Manager) — edge proxy, stays on QNAP for SPOF mitigation
