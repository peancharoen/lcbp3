# Server Consolidation Migration Plan

> **ADR-041:** Server Consolidation — ย้าย services จาก QNAP + Desk-5439 → New Server (192.168.10.11)
> **Date:** 2026-06-23
> **Status:** Draft — รอ review

---

## 1. การตัดสินใจ (Decisions Summary)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | MariaDB migration method | mysqldump | DB เล็ก (10MB), ตรวจสอบได้ทุกขั้นตอน |
| D2 | Compose structure | 4 layers (แยกไฟล์) | Dependency-ordered lifecycle |
| D3 | Folder name | `np-dms-lcbp3` | ตรงตัว ไม่มีอักษรแปลก |
| D4 | Tika | ตัดออก | Legacy — rejected ใน ADR-028 (Thai NLP อ่อนแอ, ขัด ADR-023A) |
| D5 | NPM | ไว้ QNAP | SPOF mitigation — edge proxy แยกจาก compute |
| D6 | Port exposure | IP binding 192.168.10.11:PORT | VLAN 10 คุมด้วย Omada OC200 อยู่แล้ว |
| D7 | Firewall (UFW) | ไม่ตั้ง | VLAN 10 เป็น isolated VLAN อยู่แล้ว |
| D8 | MariaDB RAM | 8G (ลดจาก 16G) | DB ยังเล็ก (~10MB), อัปเกรดได้ภายหลัง |
| D9 | ES heap | 2G (ลดจาก 4G) | RAM budget 32GB tight |
| D10 | ASUSTOR | Primary NAS (CIFS direct) | ADR-041 D2 — uploads อยู่ ASUSTOR อยู่แล้ว |

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
                    │  │ (edge  │◄├──┤  │ ollama    │ │
                    │  │ proxy) │ │  │  │ ocr-sidecar│ │
                    │  └────────┘ │  │  │ metrics   │ │
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
| Ollama | 4G | system RAM (VRAM แยก) |
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
| `/share/np-dms/mariadb/data` | `/opt/np-dms/mariadb/data` | local SSD |
| `/share/np-dms/services/cache/data` | `/opt/np-dms/redis/data` | local SSD |
| `/share/np-dms/services/search/data` | `/opt/np-dms/elasticsearch/data` | local SSD |
| `/share/np-dms/services/qdrant/storage` | `/opt/np-dms/qdrant/storage` | local SSD |
| `/share/np-dms/gitea/*` | `/opt/np-dms/gitea/*` | local SSD |
| `/share/Container/npm/*` | (stays on QNAP) | QNAP local |
| `/share/np-dms/n8n/*` | `/opt/np-dms/n8n/*` | local SSD |
| `/share/np-dms/data/logs/*` | `/opt/np-dms/logs/*` | local SSD |
| `/share/np-dms-as/data/uploads/*` | `/mnt/asustor-uploads/*` | CIFS from ASUSTOR |
| `/share/np-dms-as/Legacy` | `/mnt/asustor-legacy` | CIFS from ASUSTOR (ro) |
| Desk-5439 Ollama models | `/opt/np-dms/ollama/models` | local SSD |

---

## 6. Migration Phases

### Phase 0: Pre-Migration (ทำล่วงหน้า ก่อนวันย้าย)

> ขั้นตอนนี้ทำได้ทั้งหมดโดยไม่กระทบระบบ production ที่กำลังทำงานอยู่บน QNAP + Desk-5439

#### 0A. OS Installation & Base Config

- [X] **0.1** ติดตั้ง Ubuntu Server 26.04 LTS บน New Server
  - ดาวน์โหลด ISO: `ubuntu-26.04-live-server-amd64.iso`
  - ติดตั้งบน SSD (OS disk) — แยกจาก HDD (data disk)
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

- [X] **0.3** ตั้งค่า HDD (data disk) สำหรับ `/opt/np-dms/`
  ```bash
  # ตรวจสอบ disk
  lsblk
  # format (สมมติ /dev/sdb เป็น HDD)
  sudo mkfs.ext4 /dev/sdb
  # mount
  sudo mkdir -p /opt/np-dms
  sudo mount /dev/sdb /opt/np-dms
  # เพิ่มใน /etc/fstab
  echo '/dev/sdb /opt/np-dms ext4 defaults,noatime 0 2' | sudo tee -a /etc/fstab
  ```

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
  sudo chown -R 1000:1000 /opt/np-dms/{gitea,n8n,ollama}
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

- [ ] **0.18** สร้าง `.env` จาก `.env.template` สำหรับทุก layer

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

- [ ] **0.20** Copy OCR sidecar files จาก Desk-5439
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

- [ ] **0.21** ทดสอบ OCR sidecar build
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai
  docker build -t lcbp3-ocr-sidecar:test ./ocr-sidecar/
  # ตรวจสอบ image สร้างสำเร็จ
  docker images | grep ocr-sidecar
  ```

#### 0H. Pull Docker Images (ลด downtime วันย้าย)

- [ ] **0.22** Pull ทุก image ล่วงหน้า
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
  docker pull ollama/ollama:latest
  docker pull phpmyadmin:5-apache
  docker pull ghcr.io/norskhelsenett/ollama-metrics:latest
  # ตรวจสอบ
  docker images | grep -E 'mariadb|redis|elasticsearch|qdrant|gitea|n8n|postgres|clamav|ollama|phpmyadmin|docker-socket'
  ```

#### 0I. Deploy Layer 1 (Infrastructure — ทดสอบ)

- [ ] **0.23** Deploy Layer 1 (infrastructure)
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

- [)] **0.27** ทดสอบ Qdrant
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

- [ ] **0.29** ทดสอบ SSH จาก New Server → QNAP
  ```bash
  ssh np-dms@192.168.10.8 "echo 'SSH OK'"
  ```

- [ ] **0.30** ทดสอบ MariaDB จาก New Server → QNAP (สำหรับ mysqldump)
  ```bash
  # ใช้ migration_bot หรือ root (ชั่วคราว)
  mysql -h 192.168.10.8 -u root -p -e "SELECT 1"
  # ควรตอบ: 1
  ```

- [ ] **0.31** ทดสอบ rsync จาก New Server → QNAP (dry-run)
  ```bash
  rsync --dry-run -avz np-dms@192.168.10.8:/share/np-dms/gitea/ /opt/np-dms/gitea/
  # ตรวจสอบ file list แสดงถูกต้อง
  ```

- [ ] **0.32** ทดสอบ NPM บน QNAP สามารถเข้าถึง New Server ได้
  ```bash
  # จาก QNAP (SSH เข้าไป)
  curl -s http://192.168.10.11:3000/health || echo "Backend not deployed yet (expected)"
  curl -s http://192.168.10.11:8080/ | head -5
  # ควรเห็น phpMyAdmin page
  ```

#### 0K. Ollama Models (Pull ล่วงหน้า)

- [ ] **0.33** Deploy Layer 4 (AI) — เฉพาะ Ollama เพื่อ pull models
  ```bash
  cd /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai
  docker compose --env-file .env up -d ollama
  # รอ healthy
  docker compose ps ollama
  ```

- [ ] **0.34** Pull Ollama models (ใช้เวลานาน — ทำล่วงหน้า)
  ```bash
  docker exec ollama ollama pull np-dms-ai:latest
  docker exec ollama ollama pull np-dms-ocr:latest
  docker exec ollama ollama pull nomic-embed-text
  # ตรวจสอบ
  docker exec ollama ollama list
  # ควรเห็น 3 models
  # ตรวจสอบ VRAM usage
  docker exec ollama ollama ps
  ```

- [ ] **0.35** หยุด Ollama (ปล่อย VRAM — จะ start ใหม่วันย้าย)
  ```bash
  docker compose down
  ```

#### 0L. Final Pre-Migration Checklist

- [ ] **0.36** ยืนยันทุก image ถูก pull แล้ว (`docker images`)
- [ ] **0.37** ยืนยัน CIFS mounts ทำงานหลัง reboot (`sudo reboot` → `df -h | grep asustor`)
- [ ] **0.38** ยืนยัน GPU ทำงานหลัง reboot (`nvidia-smi`)
- [ ] **0.39** ยืนยัน Docker daemon ทำงานหลัง reboot (`systemctl status docker`)
- [ ] **0.40** ยืนยัน Docker networks ยังอยู่ (`docker network ls | grep -E 'lcbp3|gitnet'`)
- [ ] **0.41** ยืนยัน `.env` ทุก layer ไม่มี `CHANGE_ME_*` เหลืออยู่
  ```bash
  grep -r 'CHANGE_ME' /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/*/.env
  # ควรไม่มี output
  ```
- [ ] **0.42** ยืนยัน `my.cnf` อยู่ที่ `/opt/np-dms/mariadb/my.cnf`
- [ ] **0.43** ยืนยัน OCR sidecar build สำเร็จ (`docker images | grep ocr-sidecar`)
- [ ] **0.44** ยืนยัน Ollama models ถูก pull แล้ว (`docker exec ollama ollama list` — ถ้ายัง up อยู่)
- [ ] **0.45** ยืนยัน SSH key จาก New Server → QNAP ทำงาน (passwordless)
- [ ] **0.46** สำรอง `.env` ทุก layer ไปที่เดียวกัน (เช่น `/opt/np-dms-lcbp3/.env.backup/`)

### Phase 1: Backup (วันย้าย — หยุดระบบ)

- [ ] **1.1** แจ้งผู้ใช้งาน: ระบบ DMS จะหยุดให้บริการ
- [ ] **1.2** หยุด Backend + Frontend บน QNAP
- [ ] **1.3** หยุด n8n บน QNAP
- [ ] **1.4** หยุด Gitea บน QNAP
- [ ] **1.5** หยุด NPM บน QNAP (หยุดชั่วคราว — กัน write ไป MariaDB)
- [ ] **1.6** ยืนยันเหลือแค่ MariaDB รันอยู่บน QNAP
- [ ] **1.7** Backup database `lcbp3` (mysqldump)
- [ ] **1.8** Backup database `gitea` (mysqldump)
- [ ] **1.9** Backup database `npm` (mysqldump)
- [ ] **1.10** ตรวจสอบ backup files (size > 0, head/tail)
- [ ] **1.11** Backup Gitea file data (rsync: repos, config, registry)
- [ ] **1.12** Backup NPM file data (rsync: data, letsencrypt, custom)
- [ ] **1.13** Backup n8n file data (rsync: app data, postgres-data, scripts)
- [ ] **1.14** Backup Redis data (rsync: cache/data)
- [ ] **1.15** Backup Elasticsearch data (rsync: search/data)
- [ ] **1.16** Backup Qdrant data (rsync: qdrant/storage)

### Phase 2: Transfer (QNAP → New Server)

- [ ] **2.1** Transfer MariaDB dump files (scp)
- [ ] **2.2** Transfer Gitea file data (rsync)
- [ ] **2.3** Transfer n8n file data (rsync)
- [ ] **2.4** Transfer Redis data (rsync)
- [ ] **2.5** Transfer Elasticsearch data (rsync)
- [ ] **2.6** Transfer Qdrant data (rsync)
- [ ] **2.7** ตรวจสอบ MD5 ของไฟล์สำคัญ (dump files)
- [ ] **2.8** Copy Ollama models จาก Desk-5439 (ถ้ามี model files บน disk)

### Phase 3: Restore (บน New Server)

- [ ] **3.1** สร้าง user accounts ใน MariaDB (center, gitea, npm)
- [ ] **3.2** Restore database `lcbp3`
- [ ] **3.3** Restore database `gitea`
- [ ] **3.4** Restore database `npm`
- [ ] **3.5** ตั้ง grants สำหรับ users
- [ ] **3.6** วาง Gitea file data ใน `/opt/np-dms/gitea/`
- [ ] **3.7** วาง n8n file data ใน `/opt/np-dms/n8n/`
- [ ] **3.8** วาง Redis data ใน `/opt/np-dms/redis/data`
- [ ] **3.9** วาง Elasticsearch data ใน `/opt/np-dms/elasticsearch/data`
- [ ] **3.10** วาง Qdrant data ใน `/opt/np-dms/qdrant/storage`

### Phase 4: Deploy Services (บน New Server)

- [ ] **4.1** Deploy Layer 1 (infrastructure) — restart เพื่ออ่าน restored data
- [ ] **4.2** ตรวจสอบ MariaDB: table count, row counts, views
- [ ] **4.3** ตรวจสอบ Redis: ping + keys
- [ ] **4.4** ตรวจสอบ Elasticsearch: cluster health
- [ ] **4.5** ตรวจสอบ Qdrant: collections
- [ ] **4.6** Deploy Layer 2 (platform) — gitea, n8n
- [ ] **4.7** ตรวจสอบ Gitea: healthz, repo count
- [ ] **4.8** ตรวจสอบ n8n: healthz, workflow count
- [ ] **4.9** Deploy Layer 3 (application) — backend, frontend, clamav
- [ ] **4.10** ตรวจสอบ backend: /health endpoint
- [ ] **4.11** ตรวจสอบ frontend: homepage
- [ ] **4.12** Deploy Layer 4 (AI) — ollama, ocr-sidecar
- [ ] **4.13** ตรวจสอบ ollama: /api/tags (models loaded)
- [ ] **4.14** ตรวจสอบ ocr-sidecar: /health
- [ ] **4.15** Pull Ollama models: np-dms-ai:latest, np-dms-ocr:latest, nomic-embed-text

### Phase 5: NPM Cutover (QNAP)

- [ ] **5.1** อัปเดต NPM proxy host configs บน QNAP:
  - backend.np-dms.work → 192.168.10.11:3000
  - lcbp3.np-dms.work → 192.168.10.11:3001
  - git.np-dms.work → 192.168.10.11:3003
  - n8n.np-dms.work → 192.168.10.11:5678
  - pma.np-dms.work → 192.168.10.11:8080
- [ ] **5.2** เริ่ม NPM บน QNAP
- [ ] **5.3** ทดสอบทุก domain ผ่าน browser:
  - https://lcbp3.np-dms.work (frontend)
  - https://backend.np-dms.work/api/health (backend)
  - https://git.np-dms.work (gitea)
  - https://n8n.np-dms.work (n8n)
  - https://pma.np-dms.work (pma)

### Phase 6: Verification & Cleanup

- [ ] **6.1** ทดสอบ login บน DMS (user authentication)
- [ ] **6.2** ทดสอบ file upload (Two-Phase: temp → permanent)
- [ ] **6.3** ทดสอบ AI chat (RAG query)
- [ ] **6.4** ทดสอบ OCR (upload PDF → extract text)
- [ ] **6.5** ทดสอบ Git clone/push (gitea SSH)
- [ ] **6.6** ทดสอบ n8n workflow execution
- [ ] **6.7** Monitor RAM/VRAM usage 24-48 ชม.
- [ ] **6.8** สำรอง backup files ไป ASUSTOR (offsite copy)
- [ ] **6.9** หยุด services บน QNAP (ยกเว้น NPM)
- [ ] **6.10** หยุด services บน Desk-5439
- [ ] **6.11** อัปเดต ADR-041: mark D2-D6 as implemented
- [ ] **6.12** อัปเดต CONTEXT.md: เพิ่ม terms ใหม่ (np-dms-lcbp3, Layer 1-4)

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
