# Server Consolidation Migration Plan

> **ADR-041:** Server Consolidation — ย้าย services จาก QNAP + Desk-5439 → New Server (192.168.10.11)
> **Date:** 2026-06-23
> **Status:** Draft — รอ review

---

## 1. การตัดสินใจ (Decisions Summary)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | MariaDB migration method | mariadb-dump | DB เล็ก (10MB), ตรวจสอบได้ทุกขั้นตอน |
| D2 | Compose structure | 4 layers (แยกไฟล์) | Dependency-ordered lifecycle |
| D3 | Folder name | `np-dms-lcbp3` | ตรงตัว ไม่มีอักษรแปลก |
| D4 | Tika | ตัดออก | Legacy — rejected ใน ADR-028 (Thai NLP อ่อนแอ, ขัด ADR-023A) |
| D5 | NPM | ไว้ QNAP | SPOF mitigation — edge proxy แยกจาก compute |
| D6 | Port exposure | IP binding 192.168.10.11:PORT | VLAN 10 คุมด้วย Omada OC200 อยู่แล้ว |
| D7 | Firewall (UFW) | ไม่ตั้ง | VLAN 10 เป็น isolated VLAN อยู่แล้ว |
| D8 | MariaDB RAM | 8G (ลดจาก 16G) | DB ยังเล็ก (~10MB), อัปเกรดได้ภายหลัง |
| D9 | ES heap | 2G (ลดจาก 4G) | RAM budget 32GB tight |
| D10 | ASUSTOR | Primary NAS (CIFS direct) | ADR-041 D2 — uploads อยู่ ASUSTOR อยู่แล้ว |
| D11 | Ollama | native systemd service (ไม่ใช่ Docker) | GPU passthrough ซับซ้อนใน Docker; systemd ใช้ GPU ตรง, จัดการง่าย, auto-restart ในตัว |

---

## 2. สถาปัตยกรรมหลังย้าย (Target Architecture)

```
                    ┌─────────────────────────────────────┐
                    │         Omada OC200 (VLAN 10)        │
                    │       Isolated Server VLAN           │
                    └──────────┬──────────┬───────────────┘
                               │          │
                    ┌──────────┴──┐  ┌────┴──────────┐
                    │  QNAP       │  │  New Server    │
                    │  192.168.10.8│  │  192.168.10.11 │
                    │  32GB RAM    │  │  32GB RAM      │
                    │             │  │  RTX 5060 Ti   │
                    │  ┌────────┐ │  │  ┌───────────┐ │
                    │  │  NPM   │ │  │  │ 04-ai     │ │
                    │  │ (edge  │◄├──┤  │ ocr-sidecar│ │
                    │  │ proxy) │ │  │  │ metrics   │ │
                    │  └────────┘ │  │  ├───────────┤ │
                    │             │  │  │ ollama    │ │
                    │             │  │  │ (systemd) │ │
                    │             │  │  ├───────────┤ │
                    │             │  │  │ 01-infra  │ │
                    │             │  │  │ mariadb   │ │
                    │             │  │  │ redis     │ │
                    │             │  │  │ es        │ │
                    │             │  │  │ qdrant    │ │
                    │             │  │  ├───────────┤ │
                    │             │  │  │ 02-plat   │ │
                    │             │  │  │ gitea     │ │
                    │             │  │  │ n8n       │ │
                    │             │  │  ├───────────┤ │
                    │             │  │  │ 03-app    │ │
                    │             │  │  │ backend   │ │
                    │             │  │  │ frontend  │ │
                    │             │  │  │ clamav    │ │
                    │             │  │  └───────────┘ │
                    └─────────────┘  └────────┬───────┘
                                              │ CIFS
                                     ┌────────┴───────┐
                                     │  ASUSTOR       │
                                     │  192.168.10.9  │
                                     │  Primary NAS   │
                                     │  uploads/      │
                                     │  Legacy/       │
                                     └────────────────┘
```

---

## 3. Port Mapping

| Service | New Server Port | NPM Proxy (QNAP) | Domain |
|---|---|---|---|
| backend | 192.168.10.11:3000 | → 192.168.10.11:3000 | backend.np-dms.work |
| frontend | 192.168.10.11:3001 | → 192.168.10.11:3001 | lcbp3.np-dms.work |
| gitea HTTP | 192.168.10.11:3003 | → 192.168.10.11:3003 | git.np-dms.work |
| gitea SSH | 192.168.10.11:2222 | (direct) | git.np-dms.work:2222 |
| n8n | 192.168.10.11:5678 | → 192.168.10.11:5678 | n8n.np-dms.work |
| pma | 192.168.10.11:8080 | → 192.168.10.11:8080 | pma.np-dms.work |
| MariaDB | 192.168.10.11:3306 | (NPM on QNAP → direct) | — |
| ollama-metrics | 192.168.10.11:9924 | (Prometheus direct from ASUSTOR) | — |

---

## 4. RAM Budget (32GB Total)

| Service | Memory Limit | Notes |
|---|---|---|
| MariaDB | 8G | innodb_buffer_pool_size=8G |
| Elasticsearch | 3G | heap 2G |
| Redis | 2G | in-memory cache + BullMQ |
| Qdrant | 2G | vector DB |
| Backend (NestJS) | 1.5G | |
| Frontend (Next.js) | 2G | |
| ClamAV | 2G | virus definitions |
| Gitea | 2G | |
| n8n | 2G | workflow orchestrator |
| n8n-db (PostgreSQL) | ~1G | estimated |
| docker-socket-proxy | ~256M | |
| Ollama (systemd) | 4G | system RAM (VRAM แยก) — native service ไม่ใช่ Docker |
| OCR Sidecar | 1G | |
| ollama-metrics | ~256M | |
| PMA | 256M | |
| OS + Docker daemon | ~2G | |
| **Total** | **~33.5G** | tight — monitor หลัง cutover |

> ⚠️ ถ้า OOM → ลด ES heap เป็น 1G หรืออัปเกรด RAM เป็น 64GB

---

## 5. Volume Path Mapping

| QNAP Path | New Server Path | Storage Type |
|---|---|---|
| `/share/np-dms/mariadb/data` | `/opt/np-dms/mariadb/data` | SSD 2 (1TB) |
| `/share/np-dms/services/cache/data` | `/opt/np-dms/redis/data` | SSD 2 (1TB) |
| `/share/np-dms/services/search/data` | `/opt/np-dms/elasticsearch/data` | SSD 2 (1TB) |
| `/share/np-dms/services/qdrant/storage` | `/opt/np-dms/qdrant/storage` | SSD 2 (1TB) |
| `/share/np-dms/gitea/*` | `/opt/np-dms/gitea/*` | SSD 2 (1TB) |
| `/share/Container/npm/*` | (stays on QNAP) | QNAP local |
| `/share/np-dms/n8n/*` | `/opt/np-dms/n8n/*` | SSD 2 (1TB) |
| `/share/np-dms/data/logs/*` | `/opt/np-dms/logs/*` | SSD 2 (1TB) |
| `/share/np-dms-as/data/uploads/*` | `/mnt/asustor-uploads/*` | CIFS from ASUSTOR |
| `/share/np-dms-as/Legacy` | `/mnt/asustor-legacy` | CIFS from ASUSTOR (ro) |
| Desk-5439 Ollama models | `/opt/np-dms/ollama/models` | SSD 2 (1TB) — systemd OLLAMA_MODELS |

---

## 6. Migration Phases

### Phase 0: Pre-Migration (ทำล่วงหน้า ก่อนวันย้าย)

> ขั้นตอนนี้ทำได้ทั้งหมดโดยไม่กระทบระบบ production ที่กำลังทำงานอยู่บน QNAP + Desk-5439

#### 0A. OS Installation & Base Config

- [X] **0.1** ติดตั้ง Ubuntu Server 26.04 LTS บน New Server
  - ดาวน์โหลด ISO: `ubuntu-26.04-live-server-amd64.iso`
  - ติดตั้งบน SSD 1 (OS disk) — แยกจาก SSD 2 (data disk 1TB)
  - ตั้งค่า static IP: `192.168.10.11/24`, gateway: `192.168.10.1`, DNS: `192.168.10.1`
  - ตั้งค่า timezone: `Asia/Bangkok`
  - สร้าง user: `np-dms` (ไม่ใช้ root โดยตรง — เพิ่มใน sudo group)
  - เปิด SSH server (เฉพาะ key-based auth — ห้าม password auth)
  - ตั้งค่า `hostname`: `np-dms-lcbp3`

- [X] **0.2** อัปเดต OS + ติดตั้ง base packages
  ```bash
  sudo apt update && sudo apt upgrade -y
  sudo apt install -y curl wget git vim htop tmux rsync \
    ca-certificates gnupg lsb-release \
    cifs-utils nfs-common \
    jq unzip
  ```

- [X] **0.3** ตั้งค่า SSD 2 (data disk 1TB) สำหรับ `/opt/np-dms/`
  ```bash
  # ตรวจสอบ disk — SSD 2 ควรเป็น /dev/sdb (SSD 1 = OS = /dev/sda)
  lsblk
  # format SSD 2
  sudo mkfs.ext4 /dev/sdb
  # mount
  sudo mkdir -p /opt/np-dms
  sudo mount /dev/sdb /opt/np-dms
  # เพิ่มใน /etc/fstab
  echo '/dev/sdb /opt/np-dms ext4 defaults,noatime 0 2' | sudo tee -a /etc/fstab
  ```
  - SSD 2 (1TB) เก็บ: MariaDB, Redis, ES, Qdrant, Gitea, n8n, Ollama models, Docker volumes
  - พื้นที่เพียงพอ — DB ~10MB, Ollama models ~15GB, ที่เหลือสำหรับ Docker images + logs

- [X] **0.4** ตั้งค่า swap space (RAM 32GB tight — 33.5G budget)
  ```bash
  sudo fallocate -l 8G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  # ตั้ง swappiness ต่ำ (ใช้ swap เป็นทางเลือกสุดท้าย)
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p
  ```

#### 0B. NVIDIA Driver & Container Toolkit

- [X] **0.5** ติดตั้ง NVIDIA driver (RTX 5060 Ti)
  ```bash
  # เพิ่ม NVIDIA repo
  sudo apt install -y nvidia-driver-550
  # reboot หลังติดตั้ง
  sudo reboot
  # ตรวจสอบหลัง reboot
  nvidia-smi
  # ควรเห็น GPU: RTX 5060 Ti, VRAM: 16384 MB
  ```

- [X] **0.6** ติดตั้ง nvidia-container-toolkit
  ```bash
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
  sudo apt update
  sudo apt install -y nvidia-container-toolkit
  # configure Docker daemon
  sudo nvidia-ctk runtime configure --runtime=docker
  sudo systemctl restart docker
  ```

- [X] **0.7** ทดสอบ GPU access ใน Docker
  ```bash
  sudo docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
  # ควรเห็น GPU info ภายใน container
  ```

#### 0C. Docker Engine & Compose

- [X] **0.8** ติดตั้ง Docker Engine + Compose V2
  ```bash
  # เพิ่ม Docker official repo
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list
  sudo apt update
  sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  # เพิ่ม user ใน docker group
  sudo usermod -aG docker np-dms
  # logout + login ใหม่
  ```
หีกน
- [X] **0.9** ตั้งค่า Docker daemon (logging + storage)
  ```bash
  sudo mkdir -p /etc/docker
  sudo tee /etc/docker/daemon.json <<'EOF'
  {
    "log-driver": "json-file",
    "log-opts": { "max-size": "10m", "max-file": "5" },
    "default-address-pools": [
      { "base": "172.20.0.0/16", "size": 24 }
    ]
  }
  EOF
  sudo systemctl restart docker
  ```

- [X] **0.10** สร้าง Docker networks
  ```bash
  docker network create lcbp3
  docker network create gitnet
  # ตรวจสอบ
  docker network ls | grep -E 'lcbp3|gitnet'
  ```

#### 0D. Directory Structure

- [X] **0.11** สร้าง directory structure สำหรับทุก layer
  ```bash
  sudo mkdir -p /opt/np-dms/{mariadb/{data,backup,init},redis/data,elasticsearch/data,qdrant/storage,gitea/{etc,lib,gitea_repos,gitea_registry,backup},n8n/{postgres-data,cache,scripts,data,migration_logs},clamav/data,ollama/models,logs/{backend,clamav,pma},pma/{tmp}}
  # ตั้งค่า ownership (UID/GID 1000 สำหรับ application containers)
  sudo chown -R 1000:1000 /opt/np-dms/{gitea,n8n}
  # Ollama models — เป็น native systemd service ใช้ ollama user (UID 1000 บน Ubuntu)
  sudo chown -R 1000:1000 /opt/np-dms/ollama
  sudo chown -R 999:999 /opt/np-dms/mariadb/data
  sudo chown -R 1000:1000 /opt/np-dms/redis/data
  sudo chown -R 1000:1000 /opt/np-dms/elasticsearch/data
  sudo chown -R 1000:1000 /opt/np-dms/qdrant/storage
  sudo chown -R 100:100 /opt/np-dms/clamav/data
  sudo chmod -R 755 /opt/np-dms/
  ```

#### 0E. ASUSTOR CIFS Mounts

- [X] **0.12** สร้าง credentials file สำหรับ CIFS
  ```bash
  sudo mkdir -p /etc/cifs
  sudo tee /etc/cifs/asustor.cred <<'EOF'
  username=CHANGE_ME_ASUSTOR_USER
  password=CHANGE_ME_ASUSTOR_PASS
  domain=WORKGROUP
  EOF
  sudo chmod 600 /etc/cifs/asustor.cred
  sudo chown root:root /etc/cifs/asustor.cred
  ```

- [X] **0.13** สร้าง mount points
  ```bash
  sudo mkdir -p /mnt/asustor-uploads/{temp,permanent}
  sudo mkdir -p /mnt/asustor-legacy
  ```

- [X] **0.14** เพิ่ม CIFS mounts ใน `/etc/fstab`
  ```bash
  # uploads (read-write — backend เขียนได้)
  echo '//192.168.10.9/np-dms-as/data/uploads/temp /mnt/asustor-uploads/temp cifs credentials=/etc/cifs/asustor.cred,uid=0,gid=0,vers=3.0,iocharset=utf8,_netdev,nofail 0 0' | sudo tee -a /etc/fstab
  echo '//192.168.10.9/np-dms-as/data/uploads/permanent /mnt/asustor-uploads/permanent cifs credentials=/etc/cifs/asustor.cred,uid=0,gid=0,vers=3.0,iocharset=utf8,_netdev,nofail 0 0' | sudo tee -a /etc/fstab
  # legacy (read-only — migration files)
  echo '//192.168.10.9/np-dms-as/Legacy /mnt/asustor-legacy cifs credentials=/etc/cifs/asustor.cred,uid=0,gid=0,vers=3.0,iocharset=utf8,ro,_netdev,nofail 0 0' | sudo tee -a /etc/fstab
  ```

- [X] **0.15** Mount และทดสอบ
  ```bash
  sudo mount -a
  # ตรวจสอบ
  df -h | grep asustor
  ls -la /mnt/asustor-uploads/temp/
  ls -la /mnt/asustor-uploads/permanent/
  ls -la /mnt/asustor-legacy/
  # ทดสอบ write
  touch /mnt/asustor-uploads/temp/.test && rm /mnt/asustor-uploads/temp/.test
  ```

#### 0F. Configuration Files

- [X] **0.16** สร้าง `my.cnf` สำหรับ MariaDB
  ```bash
  sudo tee /opt/np-dms/mariadb/my.cnf <<'EOF'
  [mysqld]
  # RAM — 8G budget (ADR-041 D5)
  innodb_buffer_pool_size=8G
  innodb_log_file_size=512M
  innodb_flush_log_at_trx_commit=2

  # Charset (match QNAP: utf8mb4 / utf8mb4_general_ci)
  character-set-server=utf8mb4
  collation-server=utf8mb4_general_ci

  # Connections
  max_connections=200
  thread_cache_size=32

  # Logging
  slow_query_log=1
  slow_query_log_file=/var/lib/mysql/slow.log
  long_query_time=2

  # Performance
  query_cache_type=0
  query_cache_size=0
  tmp_table_size=256M
  max_heap_table_size=256M

  # Safety
  sql_mode=STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
  EOF
  sudo chown 999:999 /opt/np-dms/mariadb/my.cnf
  sudo chmod 644 /opt/np-dms/mariadb/my.cnf
  ```

- [X] **0.17** สร้าง phpMyAdmin custom config
  ```bash
  sudo tee /opt/np-dms/pma/config.user.inc.php <<'EOF'
  <?php
  $cfg['Servers'][1]['host'] = 'mariadb';
  $cfg['Servers'][1]['port'] = 3306;
  $cfg['Servers'][1]['compress'] = false;
  $cfg['Servers'][1]['AllowNoPassword'] = false;
  $cfg['UploadDir'] = '';
  $cfg['SaveDir'] = '';
  $cfg['TempDir'] = '/var/lib/phpmyadmin/tmp';
  $cfg['MaxRows'] = 100;
  $cfg['DefaultLang'] = 'en';
  $cfg['ServerDefault'] = 1;
  EOF
  sudo tee /opt/np-dms/pma/zzz-custom.ini <<'EOF'
  upload_max_filesize = 1G
  post_max_size = 1G
  memory_limit = 512M
  max_execution_time = 300
  EOF
  sudo mkdir -p /opt/np-dms/pma/tmp
  sudo chown -R 33:33 /opt/np-dms/pma/
  ```

- [X] **0.18** สร้าง `.env` จาก `.env.template` สำหรับทุก layer

  > Docker Compose อ่าน `.env` จากโฟลเดอร์เดียวกับ `docker-compose.yml` — แต่ละ layer ต้องมี `.env` ของตัวเอง

  **Step 1: Clone repo จาก Gitea (QNAP)**
  ```bash
  # clone ไปที่ /opt/np-dms-lcbp3
  cd /opt
  git clone ssh://git@192.168.10.8:2222/np-dms/lcbp3.git np-dms-lcbp3
  cd np-dms-lcbp3

  # กรณีใช้ SSH key — ตรวจสอบว่า key ถูกเพิ่มใน Gitea แล้ว
  # ทดสอบ: ssh -T git@192.168.10.8 -p 2222

  # ถ้ายังไม่มี SSH key บน New Server:
  # ssh-keygen -t ed25519 -C "np-dms@new-server"
  # cat ~/.ssh/id_ed25519.pub  →  เพิ่มใน Gitea → Settings → SSH/GPG Keys

  # ตรวจสอบไฟล์ compose อยู่ครบ
  ls -la specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/
  # ควรเห็น: .env.template, README.md, MIGRATION-PLAN.md, 01-infrastructure/ ... 04-ai/
  ```

  **Step 2: กำหนด base path**
  ```bash
  COMPOSE_BASE="/opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3"
  cd "$COMPOSE_BASE"
  ```

  **Step 3: สร้าง secrets ทั้งหมด (generate ครั้งเดียว — ใช้ทุก layer)**
  ```bash
  # สร้างไฟล์เก็บ secrets ชั่วคราว (ห้าม commit — ลบทิ้งหลังเสร็จ)
  mkdir -p /tmp/np-dms-secrets
  cd /tmp/np-dms-secrets

  # Database passwords (strong password ≥ 16 chars)
  openssl rand -base64 24 | tr -d '/+=' | head -c 32 > db_password.txt
  openssl rand -base64 24 | tr -d '/+=' | head -c 32 > db_root_password.txt

  # Redis
  openssl rand -hex 24 > redis_password.txt

  # Elasticsearch
  openssl rand -hex 24 > es_password.txt

  # JWT (backend)
  openssl rand -hex 32 > jwt_secret.txt
  openssl rand -hex 32 > jwt_refresh_secret.txt

  # NextAuth (frontend — ห้ามซ้ำกับ JWT_SECRET)
  openssl rand -hex 32 > auth_secret.txt

  # OCR Sidecar API Key
  openssl rand -hex 32 > ocr_sidecar_api_key.txt

  # n8n encryption key
  openssl rand -hex 32 > n8n_encryption_key.txt

  # n8n DB (PostgreSQL) password
  openssl rand -hex 24 > n8n_db_password.txt

  # Gitea DB password
  openssl rand -hex 24 > gitea_db_password.txt

  # NPM DB password
  openssl rand -hex 24 > npm_db_password.txt

  cd "$COMPOSE_BASE"
  ```

  **Step 3: สร้าง master `.env` ที่ root (เติมค่าจริงลงไป)**
  ```bash
  cp .env.template .env

  # แทนค่า CHANGE_ME_* ทั้งหมดด้วย secrets ที่สร้างไว้
  # ใช้ sed หรือแก้ด้วย vim/nano ก็ได้
  S=/tmp/np-dms-secrets

  sed -i "s|CHANGE_ME_DB_PASSWORD|$(cat $S/db_password.txt)|" .env
  sed -i "s|CHANGE_ME_DB_ROOT_PASSWORD|$(cat $S/db_root_password.txt)|" .env
  sed -i "s|CHANGE_ME_REDIS_PASSWORD|$(cat $S/redis_password.txt)|" .env
  sed -i "s|CHANGE_ME_ES_PASSWORD|$(cat $S/es_password.txt)|" .env
  sed -i "s|CHANGE_ME_JWT_SECRET|$(cat $S/jwt_secret.txt)|" .env
  sed -i "s|CHANGE_ME_JWT_REFRESH_SECRET|$(cat $S/jwt_refresh_secret.txt)|" .env
  sed -i "s|CHANGE_ME_AUTH_SECRET|$(cat $S/auth_secret.txt)|" .env
  sed -i "s|CHANGE_ME_OCR_SIDECAR_API_KEY|$(cat $S/ocr_sidecar_api_key.txt)|" .env
  sed -i "s|CHANGE_ME_N8N_ENCRYPTION_KEY|$(cat $S/n8n_encryption_key.txt)|" .env
  sed -i "s|CHANGE_ME_N8N_DB_PASSWORD|$(cat $S/n8n_db_password.txt)|" .env
  sed -i "s|CHANGE_ME_GITEA_DB_PASSWORD|$(cat $S/gitea_db_password.txt)|" .env
  sed -i "s|CHANGE_ME_NPM_DB_PASSWORD|$(cat $S/npm_db_password.txt)|" .env

  # ASUSTOR credentials — ใส่ค่าจริง (เดียวกับที่ใช้ใน /etc/cifs/asustor.cred)
  sed -i "s|CHANGE_ME_ASUSTOR_USER|YOUR_ASUSTOR_USERNAME|" .env
  sed -i "s|CHANGE_ME_ASUSTOR_PASS|YOUR_ASUSTOR_PASSWORD|" .env
  ```

  **Step 4: ตรวจสอบไม่มี `CHANGE_ME` เหลือ**
  ```bash
  grep 'CHANGE_ME' .env
  # ถ้าไม่มี output = ผ่าน
  ```

  **Step 5: Copy `.env` ไปทุก layer**
  ```bash
  for layer in 01-infrastructure 02-platform 03-application 04-ai; do
    cp .env "${layer}/.env"
  done
  ```

  > ทุก layer ใช้ `.env` เดียวกัน — Docker Compose จะอ่านเฉพาะตัวแปรที่ใช้ ส่วนที่เกินจะถูก ignore

  **Step 6: ลบไฟล์ secrets ชั่วคราว**
  ```bash
  shred -u /tmp/np-dms-secrets/*.txt
  rmdir /tmp/np-dms-secrets
  ```

  **Step 7: ตั้งค่า permission**
  ```bash
  chmod 600 .env */.env
  chown $(id -u):$(id -g) .env */.env
  ```

  **ตัวแปรที่แต่ละ layer ใช้จริง:**

  | Layer | ใช้ตัวแปรหลัก |
  |-------|-------------|
  | **01-infrastructure** | `DB_ROOT_PASSWORD`, `DB_PASSWORD`, `REDIS_PASSWORD`, `ELASTICSEARCH_PASSWORD`, `ASUSTOR_USER/PASS` (CIFS volume) |
  | **02-platform** | `GITEA_DB_PASSWORD`, `N8N_DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `DB_HOST` |
  | **03-application** | `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AUTH_SECRET`, `CLAMAV_HOST`, `OCR_*`, `OLLAMA_API_URL`, `QDRANT_*` |
  | **04-ai** | `OCR_SIDECAR_API_KEY`, `OCR_MODEL`, `GPU_*`, `VRAM_*`, `OCR_RESIDENCY_*` |

- [ ] **0.19** Copy compose files ไปยัง New Server
  ```bash
  # จากเครื่อง dev (หรือ git clone)
  scp -r np-dms-lcbp3/ np-dms@192.168.10.11:/opt/np-dms-lcbp3/
  # หรือ git clone จาก Gitea
  git clone ssh://git@192.168.10.8:2222/np-dms/lcbp3.git /opt/np-dms-lcbp3
  cd /opt/np-dms-lcbp3
  # ไปที่ folder ที่มี compose files
  cd specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/
  ```

#### 0G. OCR Sidecar Build Context

- [X] **0.20** Copy OCR sidecar files จาก Desk-5439
  ```bash
  # จาก Desk-5439 (192.168.10.100)
  scp -r user@192.168.10.100:/path/to/ocr-sidecar/ \
    np-dms@192.168.10.11:/opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/
  # ไฟล์ที่ต้องมี:
  #   - Dockerfile
  #   - app.py
  #   - requirements.txt
  #   - services/ (residency_policy.py, etc.)
  ```

- [X] **0.21** ทดสอบ OCR sidecar build
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai
  docker build -t lcbp3-ocr-sidecar:test ./ocr-sidecar/
  # ตรวจสอบ image สร้างสำเร็จ
  docker images | grep ocr-sidecar
  ```

#### 0H. Pull Docker Images (ลด downtime วันย้าย)

- [X] **0.22** Pull ทุก image ล่วงหน้า
  ```bash
  docker pull mariadb:11.8
  docker pull redis:7-alpine
  docker pull elasticsearch:8.11.1
  docker pull qdrant/qdrant:v1.16.1
  docker pull gitea/gitea:1.26.0-rootless
  docker pull n8nio/n8n:2.16.1
  docker pull postgres:16.4-alpine
  docker pull tecnativa/docker-socket-proxy:0.2
  docker pull clamav/clamav:1.4.4
  # หมายเหตุ: Ollama ไม่ใช้ Docker — ติดตั้งเป็น native systemd service (ดู 0K)
  docker pull phpmyadmin:5-apache
  docker pull ghcr.io/norskhelsenett/ollama-metrics:latest
  # ตรวจสอบ
  docker images | grep -E 'mariadb|redis|elasticsearch|qdrant|gitea|n8n|postgres|clamav|phpmyadmin|docker-socket'
  ```

#### 0I. Deploy Layer 1 (Infrastructure — ทดสอบ)

- [X] **0.23** Deploy Layer 1 (infrastructure)
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure
  docker compose --env-file .env up -d
  # รอ healthcheck ผ่าน
  docker compose ps
  ```

- [X] **0.24** ทดสอบ MariaDB
  ```bash
  # รอ container healthy
  docker exec mariadb healthcheck.sh --connect --innodb_initialized
  # login (ใช้ root password จาก .env)
  docker exec -it mariadb mariadb -u root -p
  # หรือ
  docker exec -it mariadb bash -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD"'
  # ตรวจสอบ
  SHOW DATABASES;
  SELECT @@version;
  SELECT @@innodb_buffer_pool_size;
  -- ควรเห็น: 11.8.x, 8589934592 (8G)
  SHOW VARIABLES LIKE 'character_set_server';
  -- ควรเห็น: utf8mb4
  ```

- [X] **0.25** ทดสอบ Redis
  ```bash
  docker exec cache redis-cli -a '<REDIS_PASSWORD>' ping
  # ควรตอบ: PONG
  docker exec cache redis-cli -a '<REDIS_PASSWORD>' info memory
  # ตรวจสอบ used_memory < 2G
  ```

- [X] **0.26** ทดสอบ Elasticsearch
  ```bash
  curl -s http://192.168.10.11:9200/_cluster/health | jq .
  # ควรเห็น: status: "green" หรือ "yellow"
  curl -s http://192.168.10.11:9200 | jq .version.number
  # ควรเห็น: 8.11.1
  ```

  > ⚠️ ES ใช้ `expose` ไม่ใช่ `ports` — ตรวจสอบจากภายใน Docker network:
  ```bash
  docker exec search curl -s http://localhost:9200/_cluster/health | jq .
  docker exec search curl -s http://localhost:9200 | jq .version.number
  ```

- [X] **0.27** ทดสอบ Qdrant
  ```bash
  docker exec qdrant curl -s http://localhost:6333/healthz
  # ควรตอบ: healthz check passed
  docker exec qdrant curl -s http://localhost:6333/collections | jq .
  # ควรเห็น: { "result": { "collections": [] } }

  # หรือ
  docker run --rm --network $(docker inspect qdrant -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}') curlimages/curl curl -s http://qdrant:6333/healthz

  docker run --rm --network $(docker inspect qdrant -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}') curlimages/curl curl -s http://qdrant:6333/collections | jq .

  ```

- [X] **0.28** ทดสอบ phpMyAdmin
  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://192.168.10.11:8080/
  # ควรได้: 200 หรือ 302
  ```

#### 0J. Connectivity Tests

> ตรวจสอบ New Server สามารถเข้าถึงทุก node ที่เกี่ยวข้องกับ migration ได้
> - **QNAP** (192.168.10.8) = แหล่งข้อมูลที่จะ migrate (MariaDB, Gitea, n8n, Redis, ES, Qdrant)
> - **ASUSTOR** (192.168.10.9) = Primary NAS (uploads + legacy files — backend จะอ่าน/เขียนที่นี่)
> - **Desk-5439** (192.168.10.100) = แหล่ง OCR sidecar build context

##### 0J.1 — QNAP (Migration Source)

- [X] **0.29** ทดสอบ SSH จาก New Server → QNAP
  ```bash
  ssh np-dms@192.168.10.8 "echo 'SSH OK'"
  ```

- [X] **0.30** ทดสอบ MariaDB จาก New Server → QNAP (สำหรับ mariadb-dump)
  ```bash
  # ใช้ migration_bot หรือ root (ชั่วคราว)
  mysql -h 192.168.10.8 -u root -p -e "SELECT 1"
  # ควรตอบ: 1
  ```

- [X] **0.31** ทดสอบ rsync จาก New Server → QNAP (dry-run)
  ```bash
  rsync --dry-run -avz admin@192.168.10.8:/share/np-dms/gitea/ /opt/np-dms/gitea/
  # ตรวจสอบ file list แสดงถูกต้อง
  ```

- [X] **0.32** ทดสอบ NPM บน QNAP สามารถเข้าถึง New Server ได้
  ```bash
  # จาก QNAP (SSH เข้าไป)
  curl -s http://192.168.10.11:3000/health || echo "Backend not deployed yet (expected)"
  curl -s http://192.168.10.11:8080/ | head -5
  # ควรเห็น phpMyAdmin page
  ```

##### 0J.2 — ASUSTOR (Primary NAS — ปลายทาง file storage)

> CIFS mount ถูกตั้งใน 0E แล้ว — ส่วนนี้ตรวจเชิงลึกเพิ่ม

- [X] **0.33** ตรวจสอบ CIFS mount ยังอยู่ (persistent หลัง reboot)
  ```bash
  df -h | grep asustor
  # ควรเห็น 3 mounts:
  #   //192.168.10.9/np-dms-as/data/uploads/temp
  #   //192.168.10.9/np-dms-as/data/uploads/permanent
  #   //192.168.10.9/np-dms-as/Legacy
  ```

- [X] **0.34** ทดสอบ write ไปยัง uploads/temp (backend จะเขียนไฟล์ที่นี่)
  ```bash
  echo "test $(date)" > /mnt/asustor-uploads/temp/.connectivity-test
  cat /mnt/asustor-uploads/temp/.connectivity-test
  rm /mnt/asustor-uploads/temp/.connectivity-test
  ```

- [X] **0.35** ทดสอบ write ไปยัง uploads/permanent (backend จะย้ายไฟล์จาก temp มาที่นี่)
  ```bash
  echo "test $(date)" > /mnt/asustor-uploads/permanent/.connectivity-test
  cat /mnt/asustor-uploads/permanent/.connectivity-test
  rm /mnt/asustor-uploads/permanent/.connectivity-test
  ```

- [X] **0.36** ตรวจสอบ legacy files สำหรับ migration (read-only)
  ```bash
  ls -la /mnt/asustor-legacy/
  # ควรเห็นโครงสร้าง legacy migration files
  # ตรวจสอบว่าอ่านได้แต่เขียนไม่ได้:
  touch /mnt/asustor-legacy/.test 2>&1 | grep -i "read-only"
  # ควรได้: Read-only file system
  ```

- [X] **0.37** ทดสอบ CIFS performance (เช็ค throughput ขั้นต่ำ)
  ```bash
  # write test — 10MB file
  dd if=/dev/zero of=/mnt/asustor-uploads/temp/.perf-test bs=1M count=10 2>&1 | tail -1
  # ควรได้ throughput ≥ 10 MB/s (CIFS บน LAN 1Gbps)
  rm /mnt/asustor-uploads/temp/.perf-test

  # read test
  dd if=/dev/zero of=/mnt/asustor-uploads/temp/.perf-test bs=1M count=10 2>/dev/null
  dd if=/mnt/asustor-uploads/temp/.perf-test of=/dev/null bs=1M 2>&1 | tail -1
  rm /mnt/asustor-uploads/temp/.perf-test
  ```

- [X] **0.38** ทดสอบ ping จาก New Server → ASUSTOR (network latency)
  ```bash
  ping -c 5 192.168.10.9
  # ควรได้ avg latency < 1ms (LAN เดียวกัน)
  ```

##### 0J.3 — Desk-5439 (OCR Sidecar Source) : skip manual move by git pull

- [ ] **0.39** ทดสอบ SSH จาก New Server → Desk-5439
  ```bash
  ssh user@192.168.10.100 "echo 'SSH OK'"
  ```

- [ ] **0.40** ทดสอบ scp จาก Desk-5439 (สำหรับ copy OCR sidecar files)
  ```bash
  scp --dry-run -r user@192.168.10.100:/path/to/ocr-sidecar/ /tmp/ocr-test/
  # ตรวจสอบ file list แสดงถูกต้อง
  ```

#### 0K. Ollama — Native systemd Service (Pull Models ล่วงหน้า)

> **D11:** Ollama รันเป็น native systemd service บน New Server — ไม่ใช่ Docker container
> เหตุผล: GPU passthrough ใน Docker ซับซ้อน, systemd ใช้ GPU ตรง, จัดการง่าย, auto-restart ในตัว

- [X] **0.41** ติดตั้ง Ollama เป็น native systemd service
  ```bash
  # ติดตั้งผ่าน official script (สร้าง ollama user + systemd service อัตโนมัติ)
  curl -fsSL https://ollama.com/install.sh | sh

  # ตรวจสอบ service
  systemctl status ollama
  # ควรเห็น: active (running)

  # ตรวจสอบ GPU access
  ollama ps  # ควรไม่ error
  nvidia-smi  # ควรเห็น GPU
  ```

- [ ] **0.41a** ตั้งค่า OLLAMA_MODELS path (ใช้ SSD 2 — ไม่ใช่ default ~/.ollama)
  ```bash
  # สร้าง systemd override
  sudo mkdir -p /etc/systemd/system/ollama.service.d
  sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
  [Service]
  Environment="OLLAMA_MODELS=/opt/np-dms/ollama/models"
  Environment="OLLAMA_HOST=0.0.0.0:11434"
  EOF

  # ตั้งค่า ownership (ollama user = UID 1000 บน Ubuntu)
  sudo chown -R ollama:ollama /opt/np-dms/ollama/models

  # reload + restart
  sudo systemctl daemon-reload
  sudo systemctl restart ollama
  systemctl status ollama
  ```

- [ ] **0.42** Pull Ollama models (ใช้เวลานาน — ทำล่วงหน้า)
  ```bash
  # pull ผ่าน CLI โดยตรง (ไม่ต้อง docker exec)
  sudo -u ollama ollama pull np-dms-ai:latest
  sudo -u ollama ollama pull np-dms-ocr:latest
  sudo -u ollama ollama pull nomic-embed-text
  # ตรวจสอบ
  sudo -u ollama ollama list
  # ควรเห็น 3 models
  # ตรวจสอบ VRAM usage
  sudo -u ollama ollama ps
  ```

- [ ] **0.43** หยุด Ollama (ปล่อย VRAM — จะ start ใหม่วันย้าย)
  ```bash
  sudo systemctl stop ollama
  # ตรวจสอบ VRAM ปล่อยแล้ว
  nvidia-smi
  ```

#### 0L. Final Pre-Migration Checklist

- [X] **0.44** ยืนยันทุก image ถูก pull แล้ว (`docker images`)
- [X] **0.45** ยืนยัน CIFS mounts ทำงานหลัง reboot (`sudo reboot` → `df -h | grep asustor`)
- [X] **0.46** ยืนยัน GPU ทำงานหลัง reboot (`nvidia-smi`)
- [X] **0.47** ยืนยัน Docker daemon ทำงานหลัง reboot (`systemctl status docker`)
- [X] **0.48** ยืนยัน Docker networks ยังอยู่ (`docker network ls | grep -E 'lcbp3|gitnet'`)
- [X] **0.49** ยืนยัน `.env` ทุก layer ไม่มี `CHANGE_ME_*` เหลืออยู่
  ```bash
  grep -r 'CHANGE_ME' /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/*/.env
  # ควรไม่มี output
  ```
- [X] **0.50** ยืนยัน `my.cnf` อยู่ที่ `/opt/np-dms/mariadb/my.cnf`
- [X] **0.51** ยืนยัน OCR sidecar build สำเร็จ (`docker images | grep ocr-sidecar`)
- [ ] **0.52** ยืนยัน Ollama models ถูก pull แล้ว (`sudo -u ollama ollama list` — native systemd)
- [X] **0.53** ยืนยัน SSH key จาก New Server → QNAP ทำงาน (passwordless)
- [X] **0.54** ยืนยัน SSH key จาก New Server → Desk-5439 ทำงาน (passwordless)
- [X] **0.55** ยืนยัน ASUSTOR CIFS write ทำงาน (`touch /mnt/asustor-uploads/temp/.test && rm /mnt/asustor-uploads/temp/.test`)
- [ ] **0.56** สำรอง `.env` ทุก layer ไปที่เดียวกัน (เช่น `/opt/np-dms-lcbp3/.env.backup/`)

### Phase 1: Backup (วันย้าย — หยุดระบบ)

> **เวลาที่คาดการณ์:** 1-2 ชั่วโมง
> **ผู้ดำเนินการ:** Admin + DBA
> **เงื่อนไขขาเข้า:** Phase 0 เสร็จทุกข้อ (0.44-0.56)

#### 1A. หยุดบริการ (Stop Services)

- [X] **1.1** แจ้งผู้ใช้งานล่วงหน้าอย่างน้อย 24 ชม.:
  - ส่ง email/announcement: "ระบบ DMS จะหยุดให้บริการวันที่ ___ เวลา ___ น. ระยะเวลาประมาณ ___ ชม."
  - แจ้งผ่าน RocketChat และปิดป้ายบนหน้าเว็บ (ถ้ามี maintenance banner)

- [ ] **1.2** หยุด Backend + Frontend บน QNAP:
  ```bash
  ssh admin@192.168.10.8
  cd /share/np-dms/app
  docker compose --env-file .env -f docker-compose-app.yml down
  # ตรวจสอบ
  docker ps | grep -E 'backend|frontend'
  # ควรไม่มี output
  ```

- [ ] **1.3** หยุด n8n บน QNAP:
  ```bash
  cd /share/np-dms/n8n
  docker compose --env-file .env down
  # ตรวจสอบ
  docker ps | grep n8n
  # ควรไม่มี output
  ```

- [ ] **1.4** หยุด Gitea บน QNAP:
  ```bash
  cd /share/np-dms/gitea
  docker compose --env-file .env down
  # ตรวจสอบ
  docker ps | grep gitea
  # ควรไม่มี output
  ```

- [ ] **1.5** หยุด NPM บน QNAP (หยุดชั่วคราว — กัน write ไป MariaDB):
  ```bash
  cd /share/np-dms/npm
  docker compose down
  # หมายเหตุ: NPM จะ start ใหม่ใน Phase 5
  ```

- [ ] **1.6** ยืนยันเหลือแค่ MariaDB + Redis + ES + Qdrant รันอยู่บน QNAP:
  ```bash
  docker ps --format 'table {{.Names}}\t{{.Status}}'
  # ควรเห็นเฉพาะ: mariadb, cache (redis), search (es), qdrant
  # ถ้ามี container อื่นที่ไม่ใช่ data store → หยุดด้วย

  ```

#### 1B. Backup Databases (mariadb-dump)

- [ ] **1.7** Backup database `lcbp3` (DMS — สำคัญที่สุด):
  ```bash
  # รันบน QNAP — backup ไปที่ /share/np-dms/mariadb/backup/
  docker exec mariadb mariadb-dump \
    -u root -p"$DB_ROOT_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --databases lcbp3 \
    > /share/np-dms/mariadb/backup/lcbp3_$(date +%Y%m%d_%H%M%S).sql
  ```
  - `--single-transaction`: consistent snapshot โดยไม่ lock table
  - `--routines --triggers --events`: รวม stored procedures, triggers, events

- [ ] **1.8** Backup database `gitea`:
  ```bash
  docker exec mariadb mariadb-dump \
    -u root -p"$DB_ROOT_PASSWORD" \
    --single-transaction \
    --databases gitea \
    > /share/np-dms/mariadb/backup/gitea_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **1.9** Backup database `npm` (Nginx Proxy Manager):
  ```bash
  docker exec mariadb mariadb-dump \
    -u root -p"$DB_ROOT_PASSWORD" \
    --single-transaction \
    --databases npm \
    > /share/np-dms/mariadb/backup/npm_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **1.10** ตรวจสอบ backup files:
  ```bash
  BACKUP_DIR=/share/np-dms/mariadb/backup
  for f in $BACKUP_DIR/*.sql; do
    SIZE=$(stat -c%s "$f")
    LINES=$(wc -l < "$f")
    echo "$f: ${SIZE} bytes, ${LINES} lines"
    # ตรวจสอบไฟล์ไม่ว่าง
    if [ "$SIZE" -lt 1000 ]; then
      echo "⚠️ WARNING: $f อาจว่าง (size < 1KB)"
    fi
    # ตรวจสอบ header/footer
    head -5 "$f"
    tail -5 "$f"
  done
  # ควรเห็น: -- MySQL dump ... และ -- Dump completed
  ```

#### 1C. Backup File Data (rsync)

- [ ] **1.11** Backup Gitea file data (repos, config, registry):
  ```bash
  # สร้าง backup dir บน ASUSTOR
  ssh admin@192.168.10.9 "mkdir -p /share/np-dms/backup/migration/gitea"
  # rsync Gitea data ไป ASUSTOR
  rsync -avz --progress \
    /share/np-dms/gitea/ \
    admin@192.168.10.9:/share/np-dms/backup/migration/gitea/

  # ตรวจสอบจำนวน repo
  find /share/np-dms/gitea/gitea_repos -name "*.git" -type d | wc -l
  # บันทึกตัวเลขเพื่อเปรียบเทียบหลัง restore
  1087
  ```

- [ ] **1.12** Backup NPM file data (data, letsencrypt, custom):
  ```bash
  ssh admin@192.168.10.9 "mkdir -p /share/np-dms/backup/migration/npm"
  rsync -avz --progress \
    /share/np-dms/npm/ \
    admin@192.168.10.9:/share/np-dms/backup/migration/npm/
  # สำคัญ: letsencrypt certs — ห้ามหาย
  ls -la /share/np-dms/npm/letsencrypt/live/
  # ควรเห็น cert files สำหรับแต่ละ domain
  ```

- [ ] **1.13** Backup n8n file data (app data, postgres-data, scripts):
  ```bash
  ssh admin@192.168.10.9 "mkdir -p /share/np-dms/backup/migration/n8n"
  rsync -avz --progress \
    /share/np-dms/n8n/ \
    admin@192.168.10.9:/share/np-dms/backup/migration/n8n/
  # ตรวจสอบ workflow count
  ls /share/np-dms/n8n/workflows/ 2>/dev/null | wc -l
  # หรือตรวจสอบผ่าน n8n-db:
  docker exec n8n-db psql -U n8n -d n8n -c "SELECT count(*) FROM workflow_entity;"
  ```

- [X] **1.14** ~~Backup Redis data~~ — **Skip: ยังไม่มีข้อมูล** (Redis cache ว่าง — ไม่มี BullMQ jobs ค้าง)
  - Redis บน QNAP รันเป็น cache เปล่า — ไม่มี persistent data ที่ต้อง backup
  - หลัง deploy บน New Server Redis จะเริ่มใหม่ — cache สร้างใหม่อัตโนมัติ

- [X] **1.15** ~~Backup Elasticsearch data~~ — **Skip: ยังไม่มีข้อมูล** (ES ไม่มี indices)
  - ES บน QNAP รันโดยไม่มี document index — ไม่มี data ที่ต้อง backup
  - หลัง deploy บน New Server ES จะ reindex ใหม่จาก MariaDB

- [X] **1.16** ~~Backup Qdrant data~~ — **Skip: ยังไม่มีข้อมูล** (Qdrant ไม่มี collections)
  - Qdrant บน QNAP รันโดยไม่มี document embeddings — ไม่มี data ที่ต้อง backup
  - หลัง deploy บน New Server Qdrant จะ re-embed ใหม่จาก MariaDB

- [ ] **1.17** หยุด data store containers บน QNAP (หลัง backup เสร็จ):
  ```bash
  docker stop mariadb cache
  # ไม่ start กลับ — QNAP เป็นแค่ NPM host หลัง migration
  ```

- [ ] **1.18** สร้าง checksum manifest ของ backup files:
  ```bash
  cd /share/np-dms/mariadb/backup
  md5sum *.sql > /share/np-dms/mariadb/backup/checksums.md5
  cat checksums.md5
  # จะใช้ตรวจสอบหลัง transfer
  3601ba5309a03bcbb4b2b2e803b31335  gitea_20260624_164336.sql
  62a668731165feba879fc5964d323d40  lcbp3_20260624_164300.sql
  ab37bffe1bd5eaacd0d6ff102efb26e1  npm_20260624_164405.sql
  ```

### Phase 2: Transfer (QNAP → New Server)

> **เวลาที่คาดการณ์:** 30 นาที - 2 ชั่วโมง (ขึ้นกับขนาด data)
> **ผู้ดำเนินการ:** Admin
> **เงื่อนไขขาเข้า:** Phase 1 เสร็จทุกข้อ

#### 2A. Transfer Database Dumps

- [ ] **2.1** Transfer MariaDB dump files (QNAP → New Server):
  ```bash
  # รันจาก QNAP — scp ไป New Server
  scp /share/np-dms/mariadb/backup/lcbp3_*.sql \
      nattanin@192.168.10.11:/opt/np-dms/mariadb/backup/
  scp /share/np-dms/mariadb/backup/gitea_*.sql \
      nattanin@192.168.10.11:/opt/np-dms/mariadb/backup/
  scp /share/np-dms/mariadb/backup/npm_*.sql \
      nattanin@192.168.10.11:/opt/np-dms/mariadb/backup/
  scp /share/np-dms/mariadb/backup/checksums.md5 \
      nattanin@192.168.10.11:/opt/np-dms/mariadb/backup/
  ```

- [X] **2.2** ตรวจสอบ MD5 ของ dump files หลัง transfer:
  ```bash
  # รันบน New Server
  cd /opt/np-dms/mariadb/backup
  md5sum -c checksums.md5
  # ควรเห็น: OK สำหรับทุกไฟล์
  # ถ้า FAIL → re-transfer ไฟล์นั้น
  ```

#### 2B. Transfer File Data (rsync ผ่าน SSH)

- [X] **2.3** Transfer Gitea file data:
  ```bash
  # รันจาก New Server — pull จาก QNAP
  rsync -avz --progress \
    admin@192.168.10.8:/share/np-dms/gitea/ \
    /opt/np-dms/gitea/
  # ตรวจสอบ repo count ตรงกับที่บันทึกใน 1.11
  find /opt/np-dms/gitea/gitea_repos -name "*.git" -type d | wc -l
  ```

- [X] **2.4** Transfer n8n file data:
  ```bash
  rsync -avz --progress \
    admin@192.168.10.8:/share/np-dms/n8n/ \
    /opt/np-dms/n8n/
  # ตรวจสอบ
  ls /opt/np-dms/n8n/
  # ควรเห็น: postgres-data, workflows, scripts, data, etc.
  ```

- [X] **2.5** ~~Transfer Redis data~~ — **Skip: ไม่มีข้อมูล** (见 1.14)

- [X] **2.6** ~~Transfer Elasticsearch data~~ — **Skip: ไม่มีข้อมูล** (见 1.15)

- [X] **2.7** ~~Transfer Qdrant data~~ — **Skip: ไม่มีข้อมูล** (见 1.16)

#### 2C. Transfer Ollama Models (Desk-5439 → New Server)

> **D11:** Ollama บน New Server รันเป็น native systemd service — models เก็บที่ `/opt/np-dms/ollama/models/`

- [ ] **2.8** Copy Ollama models จาก Desk-5439:
  ```bash
  # Ollama บน Desk-5439 เก็บ models ที่ C:\Users\<user>\.ollama\models\ (Windows)
  # หรือ /usr/share/ollama/.ollama/models/ (Linux)
  # วิธีที่ 1: rsync ไฟล์ model โดยตรง (เร็ว — ไม่ต้อง re-download)
  rsync -avz --progress \
    user@192.168.10.100:/path/to/.ollama/models/ \
    /opt/np-dms/ollama/models/

  # วิธีที่ 2 (ถ้า rsync ไม่ได้): pull ใหม่บน New Server (ช้ากว่า — ต้อง download)
  # ทำใน Phase 4 หลัง start Ollama systemd service
  ```

- [ ] **2.9** ตรวจสอบ Ollama model files:
  ```bash
  ls -la /opt/np-dms/ollama/models/
  # ควรเห็น blob files และ manifests/
  du -sh /opt/np-dms/ollama/models/
  # ขนาดรวมควร > 10GB (3 models)
  ```

#### 2D. Transfer NPM Data (QNAP → ASUSTOR backup)

- [X] **2.10** ยืนยัน NPM backup อยู่บน ASUSTOR (จาก 1.12):
  ```bash
  ssh admin@192.168.10.9 "ls -la /share/np-dms/backup/migration/npm/letsencrypt/live/"
  # ควรเห็น cert files สำหรับทุก domain
  # NPM ไม่ย้าย — อยู่ QNAP ตลอด — แค่ backup ไว้กันเสีย
  ```

### Phase 3: Restore (บน New Server)

> **เวลาที่คาดการณ์:** 1-2 ชั่วโมง
> **ผู้ดำเนินการ:** Admin + DBA
> **เงื่อนไขขาเข้า:** Phase 2 เสร็จทุกข้อ (dump files + data อยู่บน New Server)

#### 3A. Start MariaDB (ชั่วคราว — เพื่อ restore)

- [ ] **3.1** Start MariaDB container บน New Server (Layer 1 เฉพาะ mariadb):
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure
  docker compose --env-file ../.env up -d mariadb
  # รอ healthy
  docker compose ps mariadb
  # ควรเห็น: healthy
  ```

- [ ] **3.2** ตรวจสอบ MariaDB version ตรงกัน:
  ```bash
  docker exec mariadb mysql -u root -p"$DB_ROOT_PASSWORD" -e "SELECT VERSION();"
  # ควรเห็น: 11.8.x (ตรงกับ QNAP)
  ```

#### 3B. Restore Databases

- [ ] **3.3** Restore database `lcbp3`:
  ```bash
  # ไฟล์ dump อยู่ที่ /opt/np-dms/mariadb/backup/
  # ใช้ไฟล์ล่าสุด
  LCBP3_DUMP=$(ls -t /opt/np-dms/mariadb/backup/lcbp3_*.sql | head -1)
  echo "Restoring from: $LCBP3_DUMP"

  docker exec -i mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" < "$LCBP3_DUMP"
  # รอจนเสร็จ (DB เล็ก ~10MB — ไม่น่าเกิน 1 นาที)
  ```

- [ ] **3.4** Restore database `gitea`:
  ```bash
  GITEA_DUMP=$(ls -t /opt/np-dms/mariadb/backup/gitea_*.sql | head -1)
  docker exec -i mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" < "$GITEA_DUMP"
  ```

- [ ] **3.5** Restore database `npm`:
  ```bash
  NPM_DUMP=$(ls -t /opt/np-dms/mariadb/backup/npm_*.sql | head -1)
  docker exec -i mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" < "$NPM_DUMP"
  ```

- [X] **3.6** ตรวจสอบ restore — database list + table counts:
  ```bash
  docker exec mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" -e "
    SELECT table_schema, COUNT(*) AS table_count
    FROM information_schema.tables
    WHERE table_schema IN ('lcbp3', 'gitea', 'npm')
    GROUP BY table_schema;
"
  # ควรเห็น 3 databases พร้อม table counts
  # lcbp3: ตรวจสอบว่าตรงกับที่คาดการณ์ (ดูจาก QNAP ก่อน backup)
  ```

- [ ] **3.7** ตรวจสอบ user accounts + grants:
  ```bash
  docker exec mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" -e "
    SELECT user, host FROM mysql.user WHERE user IN ('center', 'gitea', 'npm');
"
  # ควรเห็น users: center, gitea, npm

  # ถ้า user ขาด — สร้างใหม่:
  # CREATE USER 'gitea'@'%' IDENTIFIED BY '<password>';
  # GRANT ALL PRIVILEGES ON gitea.* TO 'gitea'@'%';
  # CREATE USER 'npm'@'%' IDENTIFIED BY '<password>';
  # GRANT ALL PRIVILEGES ON npm.* TO 'npm'@'%';

  docker exec mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" -e "
    CREATE USER IF NOT EXISTS 'gitea'@'%' IDENTIFIED BY 'your_gitea_password';
    GRANT ALL PRIVILEGES ON gitea.* TO 'gitea'@'%';
    CREATE USER IF NOT EXISTS 'npm'@'%' IDENTIFIED BY 'your_npm_password';
    GRANT ALL PRIVILEGES ON npm.* TO 'npm'@'%';
    FLUSH PRIVILEGES;
"
  ```

- [ ] **3.8** ตรวจสอบ lcbp3 views + stored procedures:
  ```bash
  docker exec mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" lcbp3 -e "
    SELECT COUNT(*) AS view_count FROM information_schema.views WHERE table_schema='lcbp3';
    SELECT COUNT(*) AS routine_count FROM information_schema.routines WHERE routine_schema='lcbp3';
"
  # บันทึกตัวเลข — จะเปรียบเทียบใน Phase 4
  view_count
  10
  routine_count
  0
  ```

#### 3C. Prepare File Data (permissions + paths)

- [X] **3.9** ตั้ง permissions สำหรับ Gitea file data:
  ```bash
  chown -R 1000:1000 /opt/np-dms/gitea/
  chmod -R 755 /opt/np-dms/gitea/
  # ตรวจสอบ
  ls -la /opt/np-dms/gitea/gitea_repos/
  # ควรเห็น owner: 1000 1000
  ```

- [X] **3.10** ตั้ง permissions สำหรับ n8n file data:
  ```bash
  chown -R 1000:1000 /opt/np-dms/n8n/
  # n8n-db (PostgreSQL) ต้องการ owner 999 (postgres)
  chown -R 999:999 /opt/np-dms/n8n/postgres-data/
  ```

- [X] **3.11** ~~ตั้ง permissions Redis data~~ — **Skip: ไม่มี data ย้าย** (Redis เริ่มใหม่บน New Server)

- [X] **3.12** ~~ตั้ง permissions Elasticsearch data~~ — **Skip: ไม่มี data ย้าย** (ES จะ reindex ใหม่)

- [X] **3.13** ~~ตั้ง permissions Qdrant data~~ — **Skip: ไม่มี data ย้าย** (Qdrant จะ re-embed ใหม่)

- [ ] **3.14** ตั้ง permissions สำหรับ Ollama models (native systemd service):
  ```bash
  # ollama user สร้างโดย install script (ปกติ UID 1000 บน Ubuntu)
  chown -R ollama:ollama /opt/np-dms/ollama/models/
  # ตรวจสอบ systemd override ตั้ง OLLAMA_MODELS ถูกต้อง
  cat /etc/systemd/system/ollama.service.d/override.conf
  # ควรเห็น: Environment="OLLAMA_MODELS=/opt/np-dms/ollama/models"
  ```

- [ ] **3.15** สร้าง directories ที่ขาด:
  ```bash
  mkdir -p /opt/np-dms/logs/backend
  mkdir -p /opt/np-dms/logs/clamav
  mkdir -p /opt/np-dms/logs/pma
  mkdir -p /opt/np-dms/clamav/data
  mkdir -p /opt/np-dms/pma/tmp
  mkdir -p /opt/np-dms/n8n/cache
  mkdir -p /opt/np-dms/n8n/migration_logs
  ```

### Phase 4: Deploy Services (บน New Server)

> **เวลาที่คาดการณ์:** 1-2 ชั่วโมง
> **ผู้ดำเนินการ:** Admin
> **เงื่อนไขขาเข้า:** Phase 3 เสร็จทุกข้อ (DB restored + file data ready)

#### 4A. Layer 1 — Infrastructure (Data Stores)

- [X] **4.1** Deploy Layer 1 (infrastructure) — restart เพื่ออ่าน restored data:
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure
  docker compose --env-file ../.env up -d
  # รอทุก container healthy
  docker compose ps
  # ควรเห็น: mariadb (healthy), pma (healthy), cache (healthy), search (healthy), qdrant (healthy)
  ```

- [X] **4.2** ตรวจสอบ MariaDB: table count, row counts, views:
  ```bash
  # Table count
  docker exec mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" lcbp3 -e "
    SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema='lcbp3';
"
  # เปรียบเทียบกับตัวเลขจาก 3.8

  # Row count ของตารางสำคัญ
  docker exec mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" lcbp3 -e "
    SELECT 'users' AS tbl, COUNT(*) AS cnt FROM users
    UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
    UNION ALL SELECT 'projects', COUNT(*) FROM projects
    UNION ALL SELECT 'correspondences', COUNT(*) FROM correspondences
    UNION ALL SELECT 'contracts', COUNT(*) FROM contracts;
"
  # บันทึกตัวเลข — จะใช้ตรวจสอบใน Phase 6
  101
  ```

- [X] **4.3** ตรวจสอบ Redis: ping (เริ่มใหม่ — ไม่มี data เดิม):
  ```bash
  docker exec cache redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping
  # ควรเห็น: PONG

  docker exec cache redis-cli -a "$REDIS_PASSWORD" --no-auth-warning DBSIZE
  # ควรเห็น: 0 (เริ่มใหม่ — ยังไม่มี cache หรือ BullMQ jobs)
  ```

- [X] **4.4** ตรวจสอบ Elasticsearch: cluster health (เริ่มใหม่ — ยังไม่มี indices):
  ```bash
  docker exec search curl -s http://localhost:9200/_cluster/health | python3 -m json.tool
  # ควรเห็น: "status": "green" หรือ "yellow" (single-node)

  docker exec search curl -s http://localhost:9200/_cat/indices?v
  # ควรเห็น: ไม่มี indices (ยังไม่ได้ reindex — จะสร้างใหม่เมื่อ backend เริ่ม index)
  ```

- [X] **4.5** ตรวจสอบ Qdrant: collections (เริ่มใหม่ — ยังไม่มี embeddings):
  ```bash
  docker exec qdrant curl -s http://localhost:6333/collections | python3 -m json.tool
  # ควรเห็น: ไม่มี collections (ยังไม่ได้ embed — จะสร้างใหม่เมื่อ AI pipeline รัน)
  ```

#### 4B. Layer 2 — Platform (DevOps Services)

- [X] **4.6** Deploy Layer 2 (platform) — gitea, n8n, n8n-db, docker-socket-proxy:
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/02-platform
  docker compose --env-file ../.env up -d
  # รอ healthy
  docker compose ps
  # ควรเห็น: gitea (healthy), n8n (healthy), n8n-db (healthy), docker-socket-proxy (healthy)
  ```

- [X] **4.7** ตรวจสอบ Gitea: healthz, repo count, SSH:
  ```bash
  # Health check
  curl -s http://192.168.10.11:3003/api/healthz
  # ควรเห็น: OK หรือ 200

  # Repo count (ผ่าน API)
  curl -s http://192.168.10.11:3003/api/v1/repos/search?limit=1 | python3 -m json.tool | grep total_count

  curl -s http://192.168.10.11:3003/api/v1/repos/search?limit=1 | python3 -m json.tool
  # เปรียบเทียบกับที่บันทึกใน 1.11

  # SSH test
  ssh -p 2222 git@192.168.10.11
  # ควรเห็น: Hi there, You've successfully authenticated (ถ้า SSH key ตั้งแล้ว)
  ```
  ***แก้ชัั่วคราว**
  ```bash
  find /opt/np-dms/gitea -name "app.ini"

  # แก้ไขค่า
  SSH_DOMAIN    = 192.168.10.11
  ROOT_URL      = http://192.168.10.11:3003/

  ```
- [ ] **4.8** ตรวจสอบ n8n: healthz, workflow count:
  ```bash
  # Health check
  curl -s http://192.168.10.11:5678/healthz
  # ควรเห็น: OK

  # Workflow count (ผ่าน DB)
  docker exec n8n-db psql -U n8n -d n8n -c "SELECT count(*) FROM workflow_entity;"
  # เปรียบเทียบกับที่บันทึกใน 1.13
  ```

#### 4C. Layer 3 — Application (Backend + Frontend + ClamAV)

- [ ] **4.9** Deploy Layer 3 (application) — backend, frontend, clamav:
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/03-application
  docker compose --env-file ../.env up -d
  # รอ healthy (ClamAV ใช้เวลา start นาน ~5 นาที — โหลด virus definitions)
  docker compose ps
  # ควรเห็น: clamav (healthy), backend (healthy), frontend (healthy)
  ```

- [ ] **4.10** ตรวจสอบ backend: /health endpoint:
  ```bash
  curl -s http://192.168.10.11:3000/health
  # ควรเห็น: {"status":"ok",...}

  # ตรวจสอบ DB connection ผ่าน backend
  curl -s http://192.168.10.11:3000/api/health
  # ควรเห็น: ข้อมูล DB status, Redis status, ES status

  # ตรวจสอบ logs ไม่มี error
  docker logs backend --tail 50 2>&1 | grep -i error
  # ควรไม่เห็น error ร้ายแรง
  ```

- [ ] **4.11** ตรวจสอบ frontend: homepage:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://192.168.10.11:3001/
  # ควรเห็น: 200

  # ตรวจสอบหน้า login
  curl -s -o /dev/null -w "%{http_code}" http://192.168.10.11:3001/login
  # ควรเห็น: 200
  ```

- [ ] **4.12** ตรวจสอบ ClamAV: daemon ready:
  ```bash
  docker exec clamav clamdcheck.sh
  # ควรเห็น: clamd is running

  # Test scan
  docker exec clamav clamdscan --version
  # ควรเห็น: ClamAV version + signature date
  ```

#### 4D. Layer 4 — AI (Ollama systemd + OCR Sidecar + Metrics)

> **D11:** Ollama รันเป็น native systemd service — ไม่ได้ deploy ผ่าน Docker Compose
> Docker Compose ใน Layer 4 มีเฉพาะ: ocr-sidecar + ollama-metrics

- [ ] **4.13a** เริ่ม Ollama systemd service:
  ```bash
  sudo systemctl start ollama
  # รอ healthy
  systemctl status ollama
  # ควรเห็น: active (running)

  # ตรวจสอบ API
  curl -s http://192.168.10.11:11434/api/tags | python3 -m json.tool
  # ควรเห็น models list
  ```

- [ ] **4.13b** Deploy Layer 4 (AI) — ocr-sidecar + ollama-metrics (Docker):
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar
  docker compose --env-file ../../.env up -d
  # รอ healthy
  docker compose ps
  # ควรเห็น: ocr-sidecar (healthy), ollama-metrics (healthy)
  ```

- [ ] **4.14** ตรวจสอบ Ollama: API + models:
  ```bash
  # API check (native systemd — ไม่ใช่ docker exec)
  curl -s http://192.168.10.11:11434/api/tags | python3 -m json.tool
  # ควรเห็น models list

  # ถ้า models ว่าง (จาก 2.8 ไม่ได้ copy ไฟล์) → pull ใหม่:
  sudo -u ollama ollama pull np-dms-ai:latest
  sudo -u ollama ollama pull np-dms-ocr:latest
  sudo -u ollama ollama pull nomic-embed-text
  # ใช้เวลานาน (10-30 นาที ต่อ model — ขึ้นกับ network)

  # ยืนยัน models ครบ
  sudo -u ollama ollama list
  # ควรเห็น 3 models:
  #   np-dms-ai:latest
  #   np-dms-ocr:latest
  #   nomic-embed-text
  ```

- [ ] **4.15** ตรวจสอบ Ollama GPU access:
  ```bash
  nvidia-smi
  # ควรเห็น GPU (RTX 5060 Ti) + VRAM usage

  # Test inference (quick test)
  sudo -u ollama ollama run np-dms-ai:latest "Hello, test response"
  # ควรได้ response ภายใน 10-30 วินาที
  ```

- [ ] **4.16** ตรวจสอบ OCR sidecar: /health:
  ```bash
  curl -s http://192.168.10.11:8765/health
  # ควรเห็น: {"status":"healthy",...}

  # ตรวจสอบ Ollama connection จาก OCR sidecar (ผ่าน host.docker.internal)
  docker exec ocr-sidecar curl -s http://host.docker.internal:11434/api/tags
  # ควรเห็น models list (host.docker.internal → host gateway → systemd Ollama)
  ```

- [ ] **4.17** ตรวจสอบ Ollama metrics:
  ```bash
  curl -s http://192.168.10.11:9924/metrics | head -20
  # ควรเห็น Prometheus format metrics
  # ollama_loaded_models, ollama_model_ram_mb, etc.
  ```

#### 4E. Full Stack Verification

- [ ] **4.18** ตรวจสอบ Docker network connectivity:
  ```bash
  # ทุก container ควรอยู่ใน lcbp3 network
  docker network inspect lcbp3 --format '{{range .Containers}}{{.Name}} {{end}}'
  # ควรเห็น: mariadb pma cache search qdrant gitea n8n n8n-db docker-socket-proxy clamav backend frontend ocr-sidecar ollama-metrics
  # หมายเหตุ: ollama ไม่อยู่ใน Docker network — เป็น native systemd service

  # Test internal DNS resolution
  docker exec backend curl -s http://mariadb:3306 2>&1 | head -1
  docker exec backend curl -s http://cache:6379 2>&1 | head -1
  docker exec backend curl -s http://search:9200/_cluster/health
  docker exec backend curl -s http://qdrant:6333/collections
  # Ollama: ใช้ host IP (ไม่ใช่ Docker DNS) — เพราะเป็น native systemd service
  docker exec backend curl -s http://192.168.10.11:11434/api/tags
  docker exec backend curl -s http://ocr-sidecar:8765/health
  ```

- [ ] **4.19** ตรวจสอบ RAM usage รวม:
  ```bash
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'
  # ผลรวมควร < 32GB
  # ถ้าเกิน 28GB → พิจารณาลด ES heap เป็น 1G
  ```

- [ ] **4.20** ตรวจสอบ VRAM usage:
  ```bash
  nvidia-smi --query-gpu=memory.used,memory.total --format=csv
  # ควรเห็น: memory.used < 16GB (RTX 5060 Ti)
  # ถ้า models ยังไม่โหลด → จะใช้ VRAM น้อย
  sudo -u ollama ollama ps
  # แสดง models ที่โหลดอยู่ใน VRAM (native systemd — ไม่ใช่ docker exec)
  ```

### Phase 5: NPM Cutover (QNAP)

> **เวลาที่คาดการณ์:** 30 นาที
> **ผู้ดำเนินการ:** Admin
> **เงื่อนไขขาเข้า:** Phase 4 เสร็จทุกข้อ (ทุก service healthy บน New Server)

#### 5A. Start NPM + Update Proxy Configs

- [ ] **5.1** เริ่ม NPM บน QNAP:
  ```bash
  ssh admin@192.168.10.8
  cd /share/np-dms/npm
  docker compose up -d
  # รอ healthy
  docker compose ps
  # ควรเห็น: npm (healthy), npm-db (healthy) ถ้ามี
  ```

- [ ] **5.2** อัปเดต NPM proxy host configs (ผ่าน NPM UI):
  - เข้า NPM Admin UI: `http://192.168.10.8:81` (หรือ `https://npm.np-dms.work:81`)
  - ไปที่ **Hosts → Proxy Hosts**
  - แก้ไขแต่ละ domain — เปลี่ยน Forward Hostname/IP + Port:

  | Domain | Forward IP | Forward Port | เดิม |
  |---|---|---|---|
  | backend.np-dms.work | 192.168.10.11 | 3000 | QNAP Docker DNS `backend` |
  | lcbp3.np-dms.work | 192.168.10.11 | 3001 | QNAP Docker DNS `frontend` |
  | git.np-dms.work | 192.168.10.11 | 3003 | QNAP Docker DNS `gitea` |
  | n8n.np-dms.work | 192.168.10.11 | 5678 | QNAP Docker DNS `n8n` |
  | pma.np-dms.work | 192.168.10.11 | 8080 | QNAP Docker DNS `pma` |

  - **สำคัญ:** ตรวจสอบ SSL tab — cert ยังอยู่ (Force SSL ✓, HTTP/2 ✓)
  - บันทึกทุก host หลังแก้ไข

- [ ] **5.3** ตรวจสอบ NPM proxy hosts ผ่าน API (ถ้าใช้ API):
  ```bash
  # ดึง token
  TOKEN=$(curl -s -X POST http://192.168.10.8:81/api/tokens \
    -H 'Content-Type: application/json' \
    -d '{"identity":"admin@example.com","secret":"PASSWORD"}' | jq -r '.token')

  # ดู proxy hosts
  curl -s http://192.168.10.8:81/api/nginx/proxy-hosts \
    -H "Authorization: Bearer $TOKEN" | jq '.[] | {domain_names, forward_host, forward_port}'
  # ควรเห็นทุก domain ชี้ไป 192.168.10.11
  ```

#### 5B. Test All Domains

- [ ] **5.4** ทดสอบทุก domain ผ่าน browser (จากเครื่องใน VLAN 10):
  - `https://lcbp3.np-dms.work` — frontend (ควรเห็นหน้า login)
  - `https://backend.np-dms.work/api/health` — backend health (ควรเห็น `{"status":"ok"}`)
  - `https://git.np-dms.work` — Gitea (ควรเห็นหน้า Gitea)
  - `https://n8n.np-dms.work` — n8n (ควรเห็นหน้า n8n login)
  - `https://pma.np-dms.work` — phpMyAdmin (ควรเห็นหน้า login)

- [ ] **5.5** ทดสอบ SSL certs ไม่หมดอายุ:
  ```bash
  for domain in lcbp3 backend git n8n pma; do
    echo "=== $domain.np-dms.work ==="
    echo | openssl s_client -connect $domain.np-dms.work:443 -servername $domain.np-dms.work 2>/dev/null \
      | openssl x509 -noout -dates
  done
  # ควรเห็น notAfter ในอนาคต (อย่างน้อย 30 วัน)
  ```

- [X] **5.6** ทดสอบ Gitea SSH (ผ่าน NPM domain):
  ```bash
  ssh -p 2222 git@git.np-dms.work
  # หมายเหตุ: SSH port 2222 ไม่ผ่าน NPM proxy — ใช้ direct IP
  ssh -p 2222 git@192.168.10.11
  # ควรเห็น: Hi there, You've successfully authenticated
  ```

### Phase 6: Verification & Cleanup

> **เวลาที่คาดการณ์:** 2-4 ชั่วโมง (รวม soak test)
> **ผู้ดำเนินการ:** Admin + QA
> **เงื่อนไขขาเข้า:** Phase 5 เสร็จทุกข้อ (ทุก domain ทำงานผ่าน NPM)

#### 6A. Functional Verification

- [ ] **6.1** ทดสอบ login บน DMS (user authentication):
  - เปิด `https://lcbp3.np-dms.work` ใน browser
  - Login ด้วย admin account
  - ตรวจสอบ: session token ออก, redirect ไป dashboard
  - ตรวจสอบ: profile menu แสดงชื่อ user + organization
  - ตรวจสอบ: logout ทำงาน
  - ทดสอบ login ด้วย user ทั่วไป (ไม่ใช่ admin) — ตรวจสอบ RBAC

- [ ] **6.2** ทดสอบ file upload (Two-Phase: temp → permanent):
  - สร้าง Correspondence ใหม่ → แนบไฟล์ PDF
  - ตรวจสอบ: ไฟล์ไปอยู่ใน `/mnt/asustor-uploads/temp/` (temp phase)
  - Commit correspondence → ตรวจสอบ: ไฟล์ย้ายไป `/mnt/asustor-uploads/permanent/`
  - ตรวจสอบ: ClamAV scan log ไม่มี virus detected
  - ทดสอบ: upload ไฟล์ใหญ่ (>10MB) — ตรวจสอบไม่ timeout

- [ ] **6.3** ทดสอบ AI chat (RAG query):
  - เปิด Document Chat บนเอกสารที่มี embedded data
  - ส่ง query เช่น "เอกสารนี้เกี่ยวกับอะไร"
  - ตรวจสอบ: ได้ response จาก AI (ผ่าน Ollama)
  - ตรวจสอบ: response มาภายใน 30 วินาที (realtime queue)
  - ตรวจสอบ logs: `docker logs backend --tail 100 | grep -i "ai.*chat"`
  - ตรวจสอบ: Qdrant search ทำงาน (ดู logs สำหรับ vector search)

- [ ] **6.4** ทดสอบ OCR (upload PDF → extract text):
  - Upload PDF ที่มีข้อความ (Thai + English)
  - ทริกเกอร์ OCR (ผ่าน document detail → Extract Text)
  - ตรวจสอบ: OCR sidecar รับ request
  ```bash
  docker logs ocr-sidecar --tail 50
  # ควรเห็น: OCR request received → processing → completed
  ```
  - ตรวจสอบ: extracted text แสดงใน document metadata
  - ตรวจสอบ: text มีความถูกต้อง (Thai + English อ่านได้)

- [ ] **6.5** ทดสอบ Git clone/push (gitea SSH):
  ```bash
  # Clone ผ่าน SSH
  git clone ssh://git@192.168.10.11:2222/np-dms/lcbp3.git /tmp/test-clone
  cd /tmp/test-clone
  git log --oneline -5
  # ควรเห็น commits ล่าสุด

  # Test push (สร้าง branch ทดสอบ)
  git checkout -b test-migration
  echo "migration test" > test-migration.txt
  git add test-migration.txt
  git commit -m "test: migration verification"
  git push origin test-migration
  # ควรสำเร็จ

  # ลบ branch ทดสอบ
  git checkout main
  git branch -D test-migration
  git push origin --delete test-migration
  ```

- [ ] **6.6** ทดสอบ n8n workflow execution:
  - เปิด `https://n8n.np-dms.work`
  - Login และตรวจสอบ workflows ที่มีอยู่
  - รัน workflow ทดสอบ (เช่น migration workflow แบบ dry-run)
  - ตรวจสอบ: execution history แสดงสถานะ "success"
  - ตรวจสอบ: n8n เชื่อมต่อ DMS API ได้ (ผ่าน `http://backend:3000/api`)

- [ ] **6.7** ทดสอบ Document Numbering (Redis Redlock):
  - สร้าง Correspondence ใหม่ → ตรวจสอบเลขที่เอกสารถูก生成
  - สร้าง 2 documents พร้อมกัน (concurrent) → ตรวจสอบไม่ซ้ำเลข
  - ตรวจสอบ Redis lock logs:
  ```bash
  docker logs backend --tail 100 | grep -i "lock\|numbering"
  ```

- [ ] **6.8** ทดสอบ Search (Elasticsearch):
  - ค้นหาเอกสารผ่าน global search bar
  - ตรวจสอบ: ผลลัพธ์แสดง (full-text search)
  - ตรวจสอบ: highlight keywords ในผลลัพธ์
  - ทดสอบ: search ภาษาไทย

#### 6B. Monitoring & Soak Test

- [ ] **6.9** Monitor RAM/VRAM usage 24-48 ชม.:
  ```bash
  # RAM usage (ทุก ชม.)
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'

  # VRAM usage
  nvidia-smi --query-gpu=memory.used,memory.total --format=csv

  # ตรวจสอบ Ollama models ใน VRAM (native systemd — ไม่ใช่ docker exec)
  sudo -u ollama ollama ps

  # ตรวจสอบไม่มี OOM kills
  dmesg | grep -i "oom\|out of memory"
  docker inspect $(docker ps -q) --format '{{.Name}} OOMKilled={{.State.OOMKilled}}'
  # ทุก container ควร OOMKilled=false
  ```

- [ ] **6.10** ตรวจสอบ logs ไม่มี error ร้ายแรง (หลัง 24 ชม.):
  ```bash
  # Backend errors
  docker logs backend --since 24h 2>&1 | grep -iE "error|fatal|crash" | grep -v "ECONNRESET\|timeout"
  # ตรวจสอบ error ที่เกิดซ้ำ (pattern)

  # Ollama errors
  docker logs ollama --since 24h 2>&1 | grep -iE "error|fatal"

  # OCR sidecar errors
  docker logs ocr-sidecar --since 24h 2>&1 | grep -iE "error|fatal"
  ```

- [ ] **6.11** ตรวจสอบ Prometheus metrics (ถ้ามี):
  ```bash
  curl -s http://192.168.10.11:9924/metrics | grep ollama_loaded_models
  curl -s http://192.168.10.11:9924/metrics | grep ollama_model_ram_mb
  # ควรเห็น metrics แสดง model loaded + VRAM usage
  ```

#### 6C. Cleanup & Decommission

- [ ] **6.12** สำรอง backup files ไป ASUSTOR (offsite copy):
  ```bash
  # Copy dump files ไป ASUSTOR (ถ้ายังไม่ได้ทำใน Phase 1)
  rsync -avz /opt/np-dms/mariadb/backup/ \
    admin@192.168.10.9:/share/np-dms/backup/migration/mariadb/
  # ตรวจสอบ
  ssh admin@192.168.10.9 "ls -la /share/np-dms/backup/migration/mariadb/"
  ```

- [ ] **6.13** หยุด services บน QNAP (ยกเว้น NPM):
  ```bash
  ssh admin@192.168.10.8
  # หยุด data stores (ถ้ายังรันอยู่)
  docker stop mariadb cache search qdrant 2>/dev/null
  docker rm mariadb cache search qdrant 2>/dev/null
  # หยุด app containers (ถ้ายังรันอยู่)
  docker stop backend frontend n8n gitea 2>/dev/null
  docker rm backend frontend n8n gitea 2>/dev/null
  # ยืนยันเหลือแค่ NPM
  docker ps --format 'table {{.Names}}\t{{.Status}}'
  # ควรเห็นเฉพาะ: npm (+ npm-db ถ้ามี)
  ```

- [ ] **6.14** หยุด services บน Desk-5439:
  ```bash
  ssh user@192.168.10.100
  # หยุด Ollama (ถ้ารันเป็น service)
  # Windows: Stop Ollama from system tray หรือ Task Manager
  # Linux: sudo systemctl stop ollama

  # หยุด OCR sidecar + metrics (ถ้ายังรันใน Docker)
  cd /path/to/ocr-sidecar
  docker compose down
  # ยืนยัน
  docker ps
  # ควรไม่มี container รันอยู่
  ```

- [ ] **6.15** ทำความสะอาด Docker images เก่าบน QNAP (optional — ประหยัด disk):
  ```bash
  ssh admin@192.168.10.8
  docker image prune -a
  # ระวัง: จะลบ images ที่ไม่มี container รันอยู่
  # ตรวจสอบก่อน prune:
  docker images
  ```

#### 6D. Documentation Update

- [ ] **6.16** อัปเดต ADR-041: mark D2-D6 as implemented:
  - เปิด `specs/06-Decision-Records/ADR-041-server-consolidation.md`
  - เปลี่ยน status: `Proposed` → `Implemented`
  - เพิ่ม section: `## Implementation Notes` พร้อมวันที่ deploy จริง
  - บันทึก: RAM usage จริง, VRAM usage จริง, ปัญหาที่เจอ + วิธีแก้

- [ ] **6.17** อัปเดต CONTEXT.md: เพิ่ม terms ใหม่:
  - `np-dms-lcbp3` — New Server hostname
  - `Layer 1-4` — compose layer structure
  - `192.168.10.11` — New Server IP
  - อัปเดต network topology section

- [ ] **6.18** อัปเดต `04-02-backup-recovery.md`:
  - ASUSTOR = Primary NAS (uploads + backup)
  - QNAP = NPM only (edge proxy)
  - New Server = compute (all services)
  - Desk-5439 = decommissioned (or standby)

- [ ] **6.19** อัปเดต `04-network-infrastructure-guide.md`:
  - เพิ่ม New Server node (192.168.10.11)
  - อัปเดต topology diagram
  - อัปเดต port mapping table

- [ ] **6.20** สร้าง post-migration report:
  - วันที่/เวลา migration เริ่ม-จบ
  - ปัญหาที่เจอ + วิธีแก้
  - RAM/VRAM usage จริง vs ที่วางแผน
  - ข้อเสนอแนะสำหรับการปรับปรุง
  - ส่งให้ทีม + เก็บใน `specs/88-logs/`

---

## 7. Rollback Plan

ถ้า migration ล้มเหลว:

1. หยุด services บน New Server
2. เริ่ม services บน QNAP (backend, frontend, n8n, gitea, MariaDB, Redis, ES, Qdrant)
3. เริ่ม services บน Desk-5439 (Ollama, OCR sidecar)
4. อัปเดต NPM proxy hosts กลับเป็น Docker DNS names (backend, frontend, gitea, n8n, pma)
5. ตรวจสอบระบบทำงานปกติ
6. วิเคราะห์สาเหตุความล้มเหลวก่อน retry

---

## 8. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| RAM OOM (33.5G > 32G) | กลาง | สูง | ลด ES heap เป็น 1G, monitor, อัปเกรด RAM |
| GPU VRAM OOM | ต่ำ | สูง | Adaptive residency (ADR-040 D3/D4), CPU fallback |
| CIFS mount ล้มเหลว | ต่ำ | กลาง | fstab ตั้ง _netdev, ทดสอบก่อน cutover |
| NPM SSL cert หาย | ต่ำ | กลาง | NPM ไม่ย้าย — certs อยู่ QNAP ตลอด |
| MariaDB version mismatch | ต่ำ | สูง | ใช้ image เดียวกัน (mariadb:11.8) |
| Gitea repos ใหญ่เกินไป | ต่ำ | กลาง | rsync สามารถ resume ได้ |
| DNS cache ชี้ไป QNAP | ต่ำ | ต่ำ | NPM อยู่ QNAP — DNS ไม่เปลี่ยน |

---

## 9. Files Created

| File | Description |
|---|---|
| `np-dms-lcbp3/.env.template` | Master env template (placeholders) |
| `np-dms-lcbp3/README.md` | Stack documentation + RAM budget + port mapping |
| `np-dms-lcbp3/01-infrastructure/docker-compose.yml` | MariaDB, PMA, Redis, ES, Qdrant |
| `np-dms-lcbp3/02-platform/docker-compose.yml` | Gitea, n8n, n8n-db, docker-socket-proxy |
| `np-dms-lcbp3/03-application/docker-compose.yml` | Backend, Frontend, ClamAV |
| `np-dms-lcbp3/04-ai/docker-compose.yml` | Ollama, OCR Sidecar, Ollama Metrics |

---

## 10. Remaining Work

- [ ] สร้าง `my.cnf` สำหรับ MariaDB (innodb_buffer_pool_size=8G)
- [ ] Copy OCR sidecar build context จาก Desk-5439 → `04-ai/ocr-sidecar/`
- [ ] อัปเดต ADR-041: D2 (NPM stays on QNAP — revised from original)
- [ ] อัปเดต CONTEXT.md: เพิ่ม infrastructure terms
- [ ] อัปเดต `04-02-backup-recovery.md`: ASUSTOR = Primary, QNAP = backup + NPM
- [ ] อัปเดต `04-network-infrastructure-guide.md`: New Server node
- [ ] ปรับ MariaDB migration checklist ให้ตรงกับ compose ใหม่
