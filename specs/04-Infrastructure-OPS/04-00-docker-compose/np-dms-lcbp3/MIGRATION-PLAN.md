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
| D8 | MariaDB RAM | 16G | RAM 64GB มี headroom พอ — ใช้ buffer pool เต็มที่ |
| D9 | ES heap | 4G | RAM 64GB มีพอ — คืนค่า heap เป็น 4G ตามขนาดเดิม |
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
                    │  32GB RAM    │  │  64GB RAM      │
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

## 4. RAM Budget (64GB Total)

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
| OS + Docker daemon | ~3G | |
| **Total** | **~55.8G** | headroom ~8G — monitor หลัง cutover |

> ✅ RAM 64GB มี headroom เพียงพอ — ไม่ต้องลด memory limit ใดๆ
> ⚠️ ถ้า OOM (ไม่น่าเกิด) → ลด Ollama system RAM เป็น 6G หรือ ES heap เป็น 2G

---

## 5. Volume Path Mapping

| QNAP Path | New Server Path | Storage Type |
|---|---|---|
| `/share/np-dms/mariadb/data` | `/data/mariadb` | nvme0n1 LV 200G (data-vg) |
| `/share/np-dms/mariadb/backup,init,my.cnf` | `/opt/np-dms/mariadb/{backup,init,my.cnf}` | nvme1n1 LV 300G (ubuntu-vg) |
| `/share/np-dms/services/cache/data` | `/opt/np-dms/redis/data` | nvme1n1 LV 300G (ubuntu-vg) |
| `/share/np-dms/services/search/data` | `/data/elasticsearch` | nvme0n1 LV 300G (data-vg) |
| `/share/np-dms/services/qdrant/storage` | `/data/qdrant` | nvme0n1 LV 100G (data-vg) |
| `/share/np-dms/gitea/*` | `/opt/np-dms/gitea/*` | nvme1n1 LV 300G (ubuntu-vg) |
| `/share/Container/npm/*` | (stays on QNAP) | QNAP local |
| `/share/np-dms/n8n/*` | `/opt/np-dms/n8n/*` | nvme1n1 LV 300G (ubuntu-vg) |
| n8n-db (PostgreSQL) | `/data/postgres` | nvme0n1 LV 100G (data-vg) |
| `/share/np-dms/data/logs/*` | `/opt/np-dms/logs/*` | nvme1n1 LV 300G (ubuntu-vg) |
| `/share/np-dms/data/uploads/*` | `/mnt/asustor-uploads/*` | CIFS from ASUSTOR |
| `/share/np-dms/Legacy` | `/mnt/asustor-legacy` | CIFS from ASUSTOR (ro) |
| Desk-5439 Ollama models | `/opt/ollama` | nvme1n1 LV 100G (ubuntu-vg) — systemd OLLAMA_MODELS |
| Docker images + layers | `/var/lib/docker` | nvme1n1 LV 100G (ubuntu-vg) |

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
    ```bash
    # สร้าง user พร้อม home directory
    sudo adduser np-dms
    # เพิ่มใน sudo group
    sudo usermod -aG sudo np-dms
    # ย้าย ownership ของ /opt/np-dms จาก user เดิม (ถ้ามี)
    sudo chown -R np-dms:np-dms /opt/np-dms
    # ย้าย ownership ของ /opt/ollama (ถ้ามี — Ollama รันเป็น systemd แยก)
    # sudo chown -R np-dms:np-dms /opt/ollama
    ```
  - เปิด SSH server (เฉพาะ key-based auth — ห้าม password auth)
    ```bash
    # สร้าง SSH key สำหรับ admin (บนเครื่อง admin/เครื่องที่ใช้ ssh เข้ามา)
    # ถ้ายังไม่มี key:
    ssh-keygen -t ed25519 -C "admin@np-dms-lcbp3"

    # ถ้ามี key อยู่แล้ว (~/.ssh/id_ed25519) ข้ามขั้นนี้ได้

    # copy public key ไปยัง New Server สำหรับ user np-dms
    ssh-copy-id np-dms@192.168.10.11
    # บน powrshell
    type ~/.ssh/id_ed25519.pub | ssh np-dms@192.168.10.11 "cat >> ~/.ssh/authorized_keys"

    # หรือ copy ด้วยตนเอง (กรณี ssh-copy-id ไม่ได้)
    # บนเครื่อง admin: cat ~/.ssh/id_ed25519.pub
    # บน New Server (login ด้วย nattanin ก่อน แล้ว sudo):
    sudo mkdir -p /home/np-dms/.ssh
    sudo tee /home/np-dms/.ssh/authorized_keys <<'EOF'
    <วาง public key ที่นี่>
    EOF
    sudo chown -R np-dms:np-dms /home/np-dms/.ssh
    sudo chmod 700 /home/np-dms/.ssh
    sudo chmod 600 /home/np-dms/.ssh/authorized_keys

    # ตั้งค่า SSH config บนเครื่อง admin (~/.ssh/config)
    # เพิ่ม entry สำหรับ np-dms (ถ้ามี nattanin อยู่แล้ว ให้เพิ่มแยก)
    cat >> ~/.ssh/config <<'EOF'

    Host np-dms-lcbp3-np
        HostName 192.168.10.11
        User np-dms
        IdentityFile ~/.ssh/id_ed25519
    EOF

    # ตั้งค่า sshd: key-based auth เท่านั้น
    sudo tee -a /etc/ssh/sshd_config <<'EOF'
    PasswordAuthentication no
    PubkeyAuthentication yes
    PermitRootLogin no
    EOF
    sudo systemctl restart sshd
    ```
  - ทดสอบ SSH เข้า New Server ในฐานะ `np-dms`
    ```bash
    # จากเครื่อง admin (ใช้ SSH config alias)
    ssh np-dms-lcbp3-np "echo 'SSH OK as np-dms'"
    # ควรตอบ: SSH OK as np-dms (ไม่ต้องใส่ password — ใช้ key)

    # หรือระบุ user ตรงๆ
    ssh np-dms@192.168.10.11 "echo 'SSH OK as np-dms'"

    # ทดสอบ sudo
    ssh np-dms@192.168.10.11 "sudo whoami"
    # ควรตอบ: root

    # ทดสอบจาก QNAP (สำหรับ rsync migration)
    ssh np-dms@192.168.10.11 "hostname"
    # ควรตอบ: np-dms-lcbp3
    ```
  - ตั้งค่า `hostname`: `np-dms-lcbp3`
    ```bash
    sudo hostnamectl set-hostname np-dms-lcbp3
    # ตรวจสอบ
    hostnamectl
    ```

- [X] **0.2** อัปเดต OS + ติดตั้ง base packages
  ```bash
  sudo apt update && sudo apt upgrade -y
  sudo apt install -y curl wget git vim htop tmux rsync \
    ca-certificates gnupg lsb-release \
    cifs-utils nfs-common \
    jq unzip
  ```

- [ป] **0.3** ตั้งค่า NVMe disks + LVM (2x NVMe 931.5G ตาม lsblk จริง)
  ```
  nvme0n1 (Data disk, 931.5G) — VG: data-vg
  ├─ mariadb-lv        200G → /data/mariadb
  ├─ elasticsearch-lv  300G → /data/elasticsearch
  ├─ qdrant-lv         100G → /data/qdrant
  └─ postgres-lv       100G → /data/postgres

  nvme1n1 (OS disk, 931.5G) — VG: ubuntu-vg
  ├─ ubuntu-lv     150G → /
  ├─ docker-lv     100G → /var/lib/docker
  ├─ np-dms-lv     300G → /opt/np-dms
  └─ ollama-lv     100G → /opt/ollama
  ```
  - ตั้งค่าระหว่าง Ubuntu installation (LVM auto-partition)
  - แยก data LVs ให้แต่ละ service มี isolation + independent resizing
  - `/opt/np-dms/` (300G) เก็บ: Redis, Gitea, n8n, ClamAV, logs, PMA, MariaDB config/backup
  - `/data/...` (700G total) เก็บ: MariaDB data, ES data, Qdrant data, PostgreSQL data
  - `/opt/ollama/` (100G) เก็บ: Ollama models (native systemd)
  - `/var/lib/docker/` (100G) เก็บ: Docker images + container layers

- [X] **0.4** ตั้งค่า swap space (RAM 64GB — swap 16G = 25% ของ RAM, safety net)
  ```bash
  sudo fallocate -l 16G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  # ตั้ง swappiness ต่ำ (ใช้ swap เป็นทางเลือกสุดท้าย — RAM 64GB มี headroom พอ)
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p
  # ตรวจสอบ
  free -h
  # ควรเห็น: Swap 16G, total RAM ~64G
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
  sudo usermod -aG docker nattanin
  # logout + login ใหม่ (หรือใช้ newgrp docker ชั่วคราว)
  # ตรวจสอบ user ใน docker group
  getent group docker
  ```
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
  # Data dirs บน dedicated LVs (nvme0n1 — data-vg)
  sudo mkdir -p /data/mariadb
  sudo mkdir -p /data/elasticsearch
  sudo mkdir -p /data/qdrant
  sudo mkdir -p /data/postgres

  # Config/backup/logs dirs บน /opt/np-dms (nvme1n1 — ubuntu-vg, 300G)
  sudo mkdir -p /opt/np-dms/{mariadb/{backup,init},redis/data,qdrant/storage,gitea/{etc,lib,gitea_repos,gitea_registry,backup},n8n/{cache,scripts,data,migration_logs},clamav/data,logs/{backend,clamav,pma},pma/{tmp}}

  # Ollama models บน /opt/ollama (nvme1n1 — ubuntu-vg, 100G)
  sudo mkdir -p /opt/ollama

  # ตั้งค่า ownership (UID/GID สำหรับ application containers)
  sudo chown -R 1000:1000 /opt/np-dms/{gitea,n8n}
  sudo chown -R ollama:ollama /opt/ollama
  sudo chown -R 999:999 /data/mariadb
  sudo chown -R 1000:1000 /opt/np-dms/redis/data
  sudo chown -R 1000:1000 /data/elasticsearch
  sudo chown -R 1000:1000 /data/qdrant
  sudo chown -R 999:999 /data/postgres
  sudo chown -R 100:100 /opt/np-dms/clamav/data
  sudo chmod -R 755 /opt/np-dms/
  ```

- [X] **0.11a** ทำความสะอาด stale data directories (จากการรัน compose เก่าก่อน LVM migration)
  ```bash
  # stale dirs ใน /opt/np-dms/ — data ย้ายไป dedicated LVs แล้ว
  # เกิดจาก compose เก่าที่ map volume ไป /opt/np-dms/{mariadb,elasticsearch,qdrant}/data
  sudo rm -rf /opt/np-dms/mariadb/data
  sudo rm -rf /opt/np-dms/elasticsearch
  sudo rm -rf /opt/np-dms/qdrant
  sudo rm -rf /opt/np-dms/n8n/postgres-data
  sudo rm -rf /opt/np-dms/ollama        # models ย้ายไป /opt/ollama แล้ว

  # stale dir ใน /data/ — จาก compose เก่าที่ map n8n-db ไป /data/n8n/postgres-data
  sudo rm -rf /data/n8n

  # ตรวจสอบหลังลบ
  tree -L 2 -d /opt/np-dms  # ไม่ควรเห็น mariadb/data, elasticsearch, qdrant, ollama
  tree -L 2 -d /data        # ไม่ควรเห็น n8n
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
  echo '//192.168.10.9/np-dms/data/uploads/temp /mnt/asustor-uploads/temp cifs credentials=/etc/cifs/asustor.cred,uid=1000,gid=1000,vers=3.0,iocharset=utf8,_netdev,nofail 0 0' | sudo tee -a /etc/fstab
  echo '//192.168.10.9/np-dms/data/uploads/permanent /mnt/asustor-uploads/permanent cifs credentials=/etc/cifs/asustor.cred,uid=1000,gid=1000,vers=3.0,iocharset=utf8,_netdev,nofail 0 0' | sudo tee -a /etc/fstab
  # legacy (read-only — migration files)
  echo '//192.168.10.9/np-dms/Legacy /mnt/asustor-legacy cifs credentials=/etc/cifs/asustor.cred,uid=1000,gid=1000,vers=3.0,iocharset=utf8,ro,_netdev,nofail 0 0' | sudo tee -a /etc/fstab
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
  # RAM — 16G budget (ADR-041 D5, RAM 64GB upgrade)
  innodb_buffer_pool_size=16G
  innodb_log_file_size=1G
  innodb_flush_log_at_trx_commit=2

  # Charset (match QNAP: utf8mb4 / utf8mb4_general_ci)
  character-set-server=utf8mb4
  collation-server=utf8mb4_general_ci

  # Connections
  max_connections=300
  thread_cache_size=64

  # Logging
  slow_query_log=1
  slow_query_log_file=/var/lib/mysql/slow.log
  long_query_time=2

  # Performance
  query_cache_type=0
  query_cache_size=0
  tmp_table_size=512M
  max_heap_table_size=512M

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
  # clone ไปที่ /opt/np-dms/np-dms-lcbp3 (source repo)
  cd /opt/np-dms
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

  **Step 2: Copy compose files ไปยัง runtime dirs**
  ```bash
  COMPOSE_SRC="/opt/np-dms/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3"
  COMPOSE_BASE="/opt/np-dms"

  # Copy แต่ละ layer ไป runtime dir
  cp -r "$COMPOSE_SRC/01-infrastructure" "$COMPOSE_BASE/"
  cp -r "$COMPOSE_SRC/02-platform" "$COMPOSE_BASE/"
  cp -r "$COMPOSE_SRC/03-application" "$COMPOSE_BASE/"
  cp -r "$COMPOSE_SRC/04-ai" "$COMPOSE_BASE/"
  cp "$COMPOSE_SRC/.env.template" "$COMPOSE_BASE/"

  # ตรวจสอบ
  ls -la "$COMPOSE_BASE"/{01-infrastructure,02-platform,03-application,04-ai/ocr-sidecar}/docker-compose.yml
  # ควรเห็น docker-compose.yml ในทุก layer
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

  **Step 5: ไม่ต้อง copy `.env` ไปทุก layer** — ใช้ `--env-file ../.env` ตอน deploy
  ```bash
  # ตอน deploy แต่ละ layer ใช้:
  #   cd /opt/np-dms/01-infrastructure && docker compose --env-file ../.env up -d
  #   cd /opt/np-dms/02-platform     && docker compose --env-file ../.env up -d
  #   cd /opt/np-dms/03-application  && docker compose --env-file ../.env up -d
  #   cd /opt/np-dms/04-ai/ocr-sidecar && docker compose --env-file ../../.env up -d
  ```

  > Single source of truth — แก้ `.env` ที่เดียว ทุก layer ใช้ค่าเดียวกันทันที ไม่ต้อง copy ใหม่ทุกครั้ง

  **Step 6: ลบไฟล์ secrets ชั่วคราว**
  ```bash
  shred -u /tmp/np-dms-secrets/*.txt
  rmdir /tmp/np-dms-secrets
  ```

  **Step 7: ตั้งค่า permission**
  ```bash
  chmod 600 .env
  chown $(id -u):$(id -g) .env
  ```

  **ตัวแปรที่แต่ละ layer ใช้จริง:**

  | Layer | ใช้ตัวแปรหลัก |
  |-------|-------------|
  | **01-infrastructure** | `DB_ROOT_PASSWORD`, `DB_PASSWORD`, `REDIS_PASSWORD`, `ELASTICSEARCH_PASSWORD`, `ASUSTOR_USER/PASS` (CIFS volume) |
  | **02-platform** | `GITEA_DB_PASSWORD`, `N8N_DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `DB_HOST` |
  | **03-application** | `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AUTH_SECRET`, `CLAMAV_HOST`, `OCR_*`, `OLLAMA_URL`, `QDRANT_*` |
  | **04-ai** | `OCR_SIDECAR_API_KEY`, `OCR_MODEL`, `GPU_*`, `VRAM_*`, `OCR_RESIDENCY_*` |

- [X] **0.19** Copy compose files ไปยัง runtime dirs (ทำใน Step 2 ของ 0.18 แล้ว)
  ```bash
  # โครงสร้าง runtime บน New Server:
  # /opt/np-dms/
  # ├── .env                    # master env (สร้างใน Step 3)
  # ├── 01-infrastructure/      # docker-compose.yml (runtime)
  # ├── 02-platform02-platform/            # docker-compose.yml (runtime)
  # ├── 03-application/         # docker-compose.yml (runtime)
  # ├── 04-ai/ocr-sidecar/ 04-ai/ocr-sidecar/      # docker-compose.yml + build context (runtime)
  # └── np-dms-lcbp3/           # source repo (git clone — สำหรับ update)
  #
  # หลัง git pull ใน source repo → copy compose files ใหม่อีกครั้ง
  ```

#### 0G. OCR Sidecar Build Context

- [X] **0.20** Copy OCR sidecar files จาก Desk-5439
  ```bash
  # จาก Desk-5439 (192.168.10.100)
  scp -r user@192.168.10.100:/path/to/ocr-sidecar/ \
    np-dms@192.168.10.11:/opt/np-dms/04-ai/ocr-sidecar/
  # ไฟล์ที่ต้องมี:
  #   - Dockerfile
  #   - app.py
  #   - requirements.txt
  #   - services/ (residency_policy.py, etc.)
  ```

- [X] **0.21** ทดสอบ OCR sidecar build
  ```bash
  cd /opt/np-dms/04-ai
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
  docker pull n8nio/n8n:2.21.7
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
  cd /opt/np-dms/01-infrastructure
  docker compose --env-file ../.env up -d
  # รอ healthcheck ผ่าน
  docker compose ps
  # ควรเห็น: mariadb, pma, cache, search, qdrant, portainer
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
  -- ควรเห็น: 11.8.x, 17179869184 (16G)
  SHOW VARIABLES LIKE 'character_set_server';
  -- ควรเห็น: utf8mb4
  ```

- [X] **0.25** ทดสอบ Redis
  ```bash
  docker exec cache redis-cli -a '<REDIS_PASSWORD>' ping
  # ควรตอบ: PONG
  docker exec cache redis-cli -a '<REDIS_PASSWORD>' info memory
  # ตรวจสอบ used_memory < 4G
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
  ssh admin@192.168.10.8 "echo 'SSH OK'"
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
  #   //192.168.10.9/np-dms/data/uploads/temp
  #   //192.168.10.9/np-dms/data/uploads/permanent
  #   //192.168.10.9/np-dms/Legacy
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

- [X] **0.39** ทดสอบ SSH จาก New Server → Desk-5439
  ```bash
  ssh peanc@192.168.10.100 "echo 'SSH OK'"
  ```

- [X] **0.40** ทดสอบ scp จาก Desk-5439 (สำหรับ copy OCR sidecar files)
  ```bash
  scp --dry-run -r peanc@192.168.10.100:/path/to/ocr-sidecar/ /tmp/ocr-test/
  # ตรวจสอบ file list แสดงถูกต้อง
  ```
**ใช้ mamnual copy ไฟล์ OCR sidecar จาก Desk-5439 ไปยัง New Server**
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

- [X] **0.41a** ตั้งค่า OLLAMA_MODELS path (ใช้ SSD 2 — ไม่ใช่ default ~/.ollama)
  ```bash
  # สร้าง systemd override
  sudo mkdir -p /etc/systemd/system/ollama.service.d
  sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
  [Service]
  Environment="OLLAMA_MODELS=/opt/ollama/models"
  Environment="OLLAMA_HOST=0.0.0.0:11434"
  Environment="OLLAMA_KEEP_ALIVE=10m"
  Environment="OLLAMA_NUM_PARALLEL=2"
  Environment="OLLAMA_FLASH_ATTENTION=0"
  EOF

  # ตั้งค่า ownership (ollama = system user UID 999, สร้างโดย install script)
  sudo chown -R ollama:ollama /opt/ollama

  # reload + restart
  sudo systemctl daemon-reload
  sudo systemctl restart ollama
  systemctl status ollama
  ```

- [X] **0.42** สร้าง custom Ollama models จาก Modelfiles (ADR-034)
  > **สำคัญ:** `np-dms-ai` และ `np-dms-ocr` เป็น custom models ที่สร้างจาก Modelfiles — ไม่ใช่ pull จาก registry
  > Modelfiles อยู่ใน repo: `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/`
  > Base models (`scb10x/typhoon2.5-qwen3-4b:latest`, `scb10x/typhoon-ocr1.5-3b:latest`) มีอยู่แล้วบนเครื่อง
  ```bash
  # ตรวจสอบ base models มีครบ
  ollama list
  # ควรเห็น: scb10x/typhoon2.5-qwen3-4b:latest, scb10x/typhoon-ocr1.5-3b:latest

  # สร้าง custom models จาก Modelfiles (ADR-034)
  # Modelfiles อยู่ที่: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/
  sudo -u ollama ollama create np-dms-ai -f \
    /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/typhoon2.5-np-dms.model.md
  sudo -u ollama ollama create np-dms-ocr -f \
    /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/typhoon-np-dms-ocr.model.md

  # ตรวจสอบ
  sudo -u ollama ollama list
  # ควรเห็น 2 custom models + base models:
  #   np-dms-ai:latest
  #   np-dms-ocr:latest
  #   scb10x/typhoon2.5-qwen3-4b:latest
  #   scb10x/typhoon-ocr1.5-3b:latest
  #   (gemma4:e4b, qwen3.6:27b — base models เดิม)

  # ตรวจสอบ VRAM usage
  sudo -u ollama ollama ps
  ```

- [X] **0.43** หยุด Ollama (ปล่อย VRAM — จะ start ใหม่วันย้าย)
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
  grep -r 'CHANGE_ME' /opt/np-dms/*/.env
  # ควรไม่มี output
  ```
- [X] **0.50** ยืนยัน `my.cnf` อยู่ที่ `/opt/np-dms/mariadb/my.cnf`
- [X] **0.51** ยืนยัน OCR sidecar build สำเร็จ (`docker images | grep ocr-sidecar`)
- [X] **0.52** ยืนยัน Ollama custom models สร้างแล้ว (`sudo -u ollama ollama list` — ต้องเห็น np-dms-ai:latest, np-dms-ocr:latest)
- [X] **0.53** ยืนยัน SSH key จาก New Server → QNAP ทำงาน (passwordless)
- [X] **0.54** ยืนยัน SSH key จาก New Server → Desk-5439 ทำงาน (passwordless)
- [X] **0.55** ยืนยัน ASUSTOR CIFS write ทำงาน (`touch /mnt/asustor-uploads/temp/.test && rm /mnt/asustor-uploads/temp/.test`)
- [X] **0.56** สำรอง `.env` ทุก layer ไปที่เดียวกัน (เช่น `/opt/np-dms/backup/.env.backup/`)

### Phase 1: Backup (วันย้าย — หยุดระบบ)

> **เวลาที่คาดการณ์:** 1-2 ชั่วโมง
> **ผู้ดำเนินการ:** Admin + DBA
> **เงื่อนไขขาเข้า:** Phase 0 เสร็จทุกข้อ (0.44-0.56)

#### 1A. หยุดบริการ (Stop Services)

- [X] **1.1** แจ้งผู้ใช้งานล่วงหน้าอย่างน้อย 24 ชม.:
  - ส่ง email/announcement: "ระบบ DMS จะหยุดให้บริการวันที่ ___ เวลา ___ น. ระยะเวลาประมาณ ___ ชม."
  - แจ้งผ่าน RocketChat และปิดป้ายบนหน้าเว็บ (ถ้ามี maintenance banner)

- [X] **1.2** หยุด Backend + Frontend บน QNAP:
  ```bash
  ssh admin@192.168.10.8
  cd /share/np-dms/app
  docker compose --env-file .env -f docker-compose-app.yml down
  # ตรวจสอบ
  docker ps | grep -E 'backend|frontend'
  # ควรไม่มี output
  ```

- [X] **1.3** หยุด n8n บน QNAP:
  ```bash
  cd /share/np-dms/n8n
  docker compose --env-file .env down
  # ตรวจสอบ
  docker ps | grep n8n
  # ควรไม่มี output
  ```

- [X] **1.4** หยุด Gitea บน QNAP:
  ```bash
  cd /share/np-dms/gitea
  docker compose --env-file .env down
  # ตรวจสอบ
  docker ps | grep gitea
  # ควรไม่มี output
  ```

- [X] **1.5** หยุด NPM บน QNAP (หยุดชั่วคราว — กัน write ไป MariaDB):
  ```bash
  cd /share/np-dms/npm
  docker compose down
  # หมายเหตุ: NPM จะ start ใหม่ใน Phase 5
  ```

- [X] **1.6** ยืนยันเหลือแค่ MariaDB + Redis + ES + Qdrant รันอยู่บน QNAP:
  ```bash
  docker ps --format 'table {{.Names}}\t{{.Status}}'
  # ควรเห็นเฉพาะ: mariadb, cache (redis), search (es), qdrant
  # ถ้ามี container อื่นที่ไม่ใช่ data store → หยุดด้วย

  ```

#### 1B. Backup Databases (mariadb-dump)

- [X] **1.7** Backup database `lcbp3` (DMS — สำคัญที่สุด):
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

- [X] **1.8** Backup database `gitea`:
  ```bash
  docker exec mariadb mariadb-dump \
    -u root -p"$DB_ROOT_PASSWORD" \
    --single-transaction \
    --databases gitea \
    > /share/np-dms/mariadb/backup/gitea_$(date +%Y%m%d_%H%M%S).sql
  ```

- [X] **1.9** Backup database `npm` (Nginx Proxy Manager):
  ```bash
  docker exec mariadb mariadb-dump \
    -u root -p"$DB_ROOT_PASSWORD" \
    --single-transaction \
    --databases npm \
    > /share/np-dms/mariadb/backup/npm_$(date +%Y%m%d_%H%M%S).sql
  ```

- [X] **1.10** ตรวจสอบ backup files:
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

- [X] **1.11** Backup Gitea file data (repos, config, registry):
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

- [X] **1.12** Backup NPM file data (data, letsencrypt, custom):
  ```bash
  ssh admin@192.168.10.9 "mkdir -p /share/np-dms/backup/migration/npm"
  rsync -avz --progress \
    /share/np-dms/npm/ \
    admin@192.168.10.9:/share/np-dms/backup/migration/npm/
  # สำคัญ: letsencrypt certs — ห้ามหาย
  ls -la /share/np-dms/npm/letsencrypt/live/
  # ควรเห็น cert files สำหรับแต่ละ domain
  ```

- [X] **1.13** Backup n8n file data (app data, postgres-data, scripts):
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

- [X] **1.17** หยุด data store containers บน QNAP (หลัง backup เสร็จ):
  ```bash
  docker stop mariadb cache
  # ไม่ start กลับ — QNAP เป็นแค่ NPM host หลัง migration
  ```

- [X] **1.18** สร้าง checksum manifest ของ backup files:
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

- [X] **2.1** Transfer MariaDB dump files (QNAP → New Server):
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

> **D11:** Ollama บน New Server รันเป็น native systemd service — models เก็บที่ `/opt/ollama/models/`
> **ADR-034:** `np-dms-ai` และ `np-dms-ocr` เป็น custom models สร้างจาก Modelfiles — ไม่ใช่ pull จาก registry
> ถ้า copy ไฟล์ model โดยตรง (วิธีที่ 1) จะได้ทั้ง base models และ custom models
> ถ้าไม่ copy ได้ ให้สร้างใหม่จาก Modelfiles ใน repo (วิธีที่ 2 — step 0.42/4.14)

- [X] **2.8** Copy Ollama models จาก Desk-5439:
  ```bash
  # Ollama บน Desk-5439 เก็บ models ที่ C:\Users\<user>\.ollama\models\ (Windows)
  # หรือ /usr/share/ollama/.ollama/models/ (Linux)
  # วิธีที่ 1: rsync ไฟล์ model โดยตรง (เร็ว — ไม่ต้อง re-download หรือ recreate)
  rsync -avz --progress \
    user@192.168.10.100:/path/to/.ollama/models/ \
    /opt/ollama/models/

  # วิธีที่ 2 (ถ้า rsync ไม่ได้): สร้างใหม่จาก Modelfiles ใน repo (ADR-034)
  # ทำใน Phase 0 (step 0.42) หรือ Phase 4 (step 4.14) หลัง start Ollama systemd service
  ```

- [X] **2.9** ตรวจสอบ Ollama model files:
  ```bash
  ls -la /opt/ollama/models/
  # ควรเห็น blob files และ manifests/
  du -sh /opt/ollama/models/
  # ขนาดรวมควร > 8GB (2 custom models + base models)
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

- [X] **3.1** Start MariaDB container บน New Server (Layer 1 เฉพาะ mariadb):
  ```bash
  cd /opt/np-dms/01-infrastructure
  docker compose --env-file ../.env up -d mariadb
  # รอ healthy
  docker compose ps mariadb
  # ควรเห็น: healthy
  ```

- [X] **3.2** ตรวจสอบ MariaDB version ตรงกัน:
  ```bash
  docker exec mariadb mysql -u root -p"$DB_ROOT_PASSWORD" -e "SELECT VERSION();"
  # ควรเห็น: 11.8.x (ตรงกับ QNAP)
  ```

#### 3B. Restore Databases

- [X] **3.3** Restore database `lcbp3`:
  ```bash
  # ไฟล์ dump อยู่ที่ /opt/np-dms/mariadb/backup/
  # ใช้ไฟล์ล่าสุด
  LCBP3_DUMP=$(ls -t /opt/np-dms/mariadb/backup/lcbp3_*.sql | head -1)
  echo "Restoring from: $LCBP3_DUMP"

  docker exec -i mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" < "$LCBP3_DUMP"
  # รอจนเสร็จ (DB เล็ก ~10MB — ไม่น่าเกิน 1 นาที)
  ```

- [X] **3.4** Restore database `gitea`:
  ```bash
  GITEA_DUMP=$(ls -t /opt/np-dms/mariadb/backup/gitea_*.sql | head -1)
  docker exec -i mariadb mariadb -u root -p"$DB_ROOT_PASSWORD" < "$GITEA_DUMP"
  ```

- [X] **3.5** Restore database `npm`:
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

- [X] **3.7** ตรวจสอบ user accounts + grants:
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

- [X] **3.8** ตรวจสอบ lcbp3 views + stored procedures:
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

- [X] **3.14** ตั้ง permissions สำหรับ Ollama models (native systemd service):
  ```bash
  # ollama user สร้างโดย install script (ปกติ UID 1000 บน Ubuntu)
  chown -R ollama:ollama /opt/ollama/
  # ตรวจสอบ systemd override ตั้ง OLLAMA_MODELS ถูกต้อง
  cat /etc/systemd/system/ollama.service.d/override.conf
  # ควรเห็น: Environment="OLLAMA_MODELS=/opt/ollama"
  ```

- [X] **3.15** สร้าง directories ที่ขาด:
  ```bash
  mkdir -p /opt/np-dms/logs/backend
  mkdir -p /opt/np-dms/logs/clamav
  mkdir -p /opt/np-dms/logs/pma
  mkdir -p /opt/np-dms/clamav/data
  mkdir -p /opt/np-dms/pma/tmp
  mkdir -p /opt/np-dms/n8n/cache
  mkdir -p /opt/np-dms/n8n/migration_logs
  # data LVs ถูกสร้างใน 0.11 แล้ว — ไม่ต้องสร้างซ้ำ
  ```

### Phase 4: Deploy Services (บน New Server)

> **เวลาที่คาดการณ์:** 1-2 ชั่วโมง
> **ผู้ดำเนินการ:** Admin
> **เงื่อนไขขาเข้า:** Phase 3 เสร็จทุกข้อ (DB restored + file data ready)

#### 4A. Layer 1 — Infrastructure (Data Stores)

- [X] **4.1** Deploy Layer 1 (infrastructure) — restart เพื่ออ่าน restored data:
  ```bash
  cd /opt/np-dms/01-infrastructure
  docker compose --env-file ../.env up -d
  # รอทุก container healthy
  docker compose ps
  # ควรเห็น: mariadb (healthy), pma (healthy), cache (healthy), search (healthy), qdrant (healthy), portainer (healthy)
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
  cd /opt/np-dms/02-platform
  docker compose --env-file ../.env up -d
  # รอ healthy
  docker compose ps
  # ควรเห็น: gitea (healthy), n8n (healthy), n8n-db (healthy), docker-socket-proxy (healthy)
  ```

- [x] **4.7** ตรวจสอบ Gitea: healthz, repo count, SSH:
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
- [X] **4.8** ตรวจสอบ n8n: healthz, workflow count:
  ```bash
  # Health check
  curl -s http://192.168.10.11:5678/healthz
  # ควรเห็น: OK

  # Workflow count (ผ่าน DB)
  docker exec n8n-db psql -U n8n -d n8n -c "SELECT count(*) FROM workflow_entity;"
  # เปรียบเทียบกับที่บันทึกใน 1.13
  ```

#### 4C. Layer 3 — Application (Backend + Frontend + ClamAV)

- [X] **4.9** Deploy Layer 3 (application) — backend, frontend, clamav:
  ```bash
  cd /opt/np-dms/03-application
  docker compose --env-file ../.env up -d
  # รอ healthy (ClamAV ใช้เวลา start นาน ~5 นาที — โหลด virus definitions)
  docker compose ps
  # ควรเห็น: clamav (healthy), backend (healthy), frontend (healthy)
  ```

- [X] **4.10** ตรวจสอบ backend: /health endpoint:
  ```bash
  curl -s http://192.168.10.11:3000/health
  # ควรเห็น: {"status":"ok",...}

  # ตรวจสอบ DB connection ผ่าน backend (health ถูก exclude จาก api prefix)
  curl -s http://192.168.10.11:3000/health
  # ควรเห็น: ข้อมูล DB status, Memory status, Disk status

  # ตรวจสอบ logs ไม่มี error
  docker logs backend --tail 50 2>&1 | grep -i error
  # ควรไม่เห็น error ร้ายแรง
  ```

- [X] **4.11** ตรวจสอบ frontend: homepage:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://192.168.10.11:3001/
  # ควรเห็น: 307 (redirect ไป /dashboard → /login เมื่อยังไม่ login)

  # ตรวจสอบหน้า login
  curl -s -o /dev/null -w "%{http_code}" http://192.168.10.11:3001/login
  # ควรเห็น: 200
  ```

- [X] **4.12** ตรวจสอบ ClamAV: daemon ready:
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

- [X] **4.13a** เริ่ม Ollama systemd service:
  ```bash
  sudo systemctl start ollama
  # รอ healthy
  systemctl status ollama
  # ควรเห็น: active (running)

  # ตรวจสอบ API
  curl -s http://192.168.10.11:11434/api/tags | python3 -m json.tool
  # ควรเห็น models list
  ```

- [X] **4.13b** Deploy Layer 4 (AI) — ocr-sidecar + ollama-metrics (Docker):
  ```bash
  cd /opt/np-dms/04-ai/ocr-sidecar
  docker compose --env-file ../../.env up -d
  # รอ healthy
  docker compose ps
  # ควรเห็น: ocr-sidecar (healthy), ollama-metrics (healthy)
  ```

- [X] **4.14** ตรวจสอบ Ollama: API + models:
  ```bash
  # API check (native systemd — ไม่ใช่ docker exec)
  curl -s http://192.168.10.11:11434/api/tags | python3 -m json.tool
  # ควรเห็น models list

  # ถ้า models ว่าง (จาก 2.8 ไม่ได้ copy ไฟล์) → สร้างใหม่จาก Modelfiles (ADR-034):
  # หมายเหตุ: nomic-embed-text ถูกแทนที่ด้วย BGE-M3 ใน OCR Sidecar (ADR-035) — ไม่ต้อง pull ใน Ollama อีกต่อไป
  sudo -u ollama ollama create np-dms-ai -f \
    /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/typhoon2.5-np-dms.model.md
  sudo -u ollama ollama create np-dms-ocr -f \
    /opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/typhoon-np-dms-ocr.model.md

  # ยืนยัน models ครบ
  sudo -u ollama ollama list
  # ควรเห็น 2 custom models:
  #   np-dms-ai:latest
  #   np-dms-ocr:latest
  ```

- [X] **4.15** ตรวจสอบ Ollama GPU access:
  ```bash
  nvidia-smi
  # ควรเห็น GPU (RTX 5060 Ti) + VRAM usage

  # Test inference (quick test)
  sudo -u ollama ollama run np-dms-ai:latest "Hello, test response"
  # ควรได้ response ภายใน 10-30 วินาที
  ```

- [X] **4.16** ตรวจสอบ OCR sidecar: /health:
  ```bash
  curl -s http://192.168.10.11:8765/health
  # ควรเห็น: {"status":"healthy",...}

  # ตรวจสอบ Ollama connection จาก OCR sidecar (ผ่าน host.docker.internal)
  docker exec ocr-sidecar curl -s http://host.docker.internal:11434/api/tags
  # ควรเห็น models list (host.docker.internal → host gateway → systemd Ollama)
  ```

- [X] **4.17** ตรวจสอบ Ollama metrics:
  ```bash
  curl -s http://192.168.10.11:9924/metrics | head -20
  # ควรเห็น Prometheus format metrics
  # ollama_loaded_models, ollama_model_ram_mb, etc.
  ```

#### 4E. Full Stack Verification

- [X] **4.18** ตรวจสอบ Docker network connectivity:
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

- [X] **4.19** ตรวจสอบ RAM usage รวม:
  ```bash
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'
  # ผลรวมควร < 56GB
  # ถ้าเกิน 58GB → พิจารณาลด Ollama system RAM เป็น 6G
  ```

- [X] **4.20** ตรวจสอบ VRAM usage:
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

- [X] **5.1** เริ่ม NPM บน QNAP:
  ```bash
  ssh admin@192.168.10.8
  cd /share/np-dms/npm
  docker compose up -d
  # รอ healthy
  docker compose ps
  # ควรเห็น: npm (healthy), npm-db (healthy) ถ้ามี
  ```

- [X] **5.2** อัปเดต NPM proxy host configs (ผ่าน NPM UI):
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
| RAM OOM (55.8G < 64G) | ต่ำ | สูง | headroom ~8G — monitor, ลด Ollama/ES ได้หากจำเป็น |
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
| `np-dms-lcbp3/04-ai/ocr-sidecar/docker-compose.yml` | OCR Sidecar + Ollama Metrics (Ollama = native systemd, not Docker) |

---

## 10. Remaining Work

- [ ] สร้าง `my.cnf` สำหรับ MariaDB (innodb_buffer_pool_size=16G)
- [ ] Copy OCR sidecar build context จาก Desk-5439 → `04-ai/ocr-sidecar/`
- [ ] อัปเดต ADR-041: D2 (NPM stays on QNAP — revised from original)
- [ ] อัปเดต CONTEXT.md: เพิ่ม infrastructure terms
- [ ] อัปเดต `04-02-backup-recovery.md`: ASUSTOR = Primary, QNAP = backup + NPM
- [ ] อัปเดต `04-network-infrastructure-guide.md`: New Server node
- [ ] ปรับ MariaDB migration checklist ให้ตรงกับ compose ใหม่

---

## 11. Addendum: Cloudflare Tunnel Integration (2026-07-05)

> **สถานะ:** Cloudflare Tunnel ถูกติดตั้งและใช้งานจริงบน `np-dms-lcbp3` **หลังจาก** Migration Plan ฉบับหลัก (2026-06-23) เขียนเสร็จ ทำให้ D5 เดิม ("NPM ไว้ QNAP — SPOF mitigation") **ไม่ตรงกับสถาปัตยกรรมจริงอีกต่อไป** Addendum นี้บันทึกสถานะปัจจุบันและแผนที่ปรับปรุงต่อ โดยไม่แก้ไข Decision Log เดิมใน Section 1 (เพื่อรักษาประวัติการตัดสินใจ)

### 11.1 D5 — Revised (Supersedes original D5)

| # | Decision | Original (2026-06-23) | Revised (2026-07-05) | Rationale |
|---|---|---|---|---|
| D5 | Internet-facing edge | NPM บน QNAP รับ traffic จาก WAN โดยตรง | **Cloudflare Tunnel บน `np-dms-lcbp3` เป็น edge เดียว** — NPM เปลี่ยนบทบาทเป็น internal router | ยืนยันจาก `dig lcbp3.np-dms.work +short` → คืนค่า `104.21.25.150`, `172.67.134.84` (Cloudflare Anycast range) แปลว่า traffic วิ่งผ่าน Cloudflare proxy จริง ไม่ใช่ IP ตรงของ QNAP/New Server |

**หมายเหตุ:** เหตุผลเดิมของ D5 (SPOF mitigation ด้วยการแยก edge proxy ออกจาก compute) **ยังไม่ถูกแก้ไขสมบูรณ์** ในสถานะปัจจุบัน เพราะ cloudflared รันเป็น instance เดียวบน `np-dms-lcbp3` — ถ้าเครื่องนี้ล่ม tunnel ล่มไปด้วย ดู 11.4 (Redundancy Plan) สำหรับแผนแก้ไข

### 11.2 สถาปัตยกรรมจริงหลังเพิ่ม Cloudflare (Current State)

```
Internet
   │
   ▼
┌─────────────────────────────────────────────┐
│         Cloudflare Edge (Anycast)            │
│   104.21.25.150 / 172.67.134.84 (proxied)    │
│   DNS: CNAME → <tunnel-id>.cfargotunnel.com  │
└──────────────────────┬────────────────────────┘
                        │ outbound-only connection
                        ▼
        ┌───────────────────────────────┐
        │  cloudflared (systemd)        │
        │  np-dms-lcbp3 — 192.168.10.11 │
        │  Tunnel ID: b2a2ff68-...       │
        └───────────┬───────────────────┘
                     │ ingress rules (config.yml)
        ┌────────────┼────────────────────┐
        ▼                                 ▼
┌───────────────────┐          ┌─────────────────────┐
│ Services บน        │          │ NPM (QNAP)           │
│ np-dms-lcbp3 ตรงๆ   │          │ 192.168.10.8         │
│ - backend           │          │ role: internal router│
│ - frontend          │          │ เฉพาะ service ที่ยัง  │
│ - gitea             │          │ ค้างอยู่ QNAP/ASUSTOR │
│ - n8n, pma          │          └─────────────────────┘
└───────────────────┘
```

### 11.3 DNS Record Changes

| Record type | เดิม (ตาม D6 เดิม) | ใหม่ |
|---|---|---|
| `lcbp3.np-dms.work` | A → IP ตรง (QNAP หรือ New Server) | **CNAME → `<tunnel-id>.cfargotunnel.com`** (proxied/orange-cloud) |
| Apex `np-dms.work` | A record | CNAME (Cloudflare CNAME flattening รองรับที่ apex ได้) |
| Record A เดิมที่ชี้ IP ตรง | ใช้งานอยู่ | **ต้องลบทิ้ง** เพื่อป้องกัน traffic สับสนว่าจะไปทางไหน |

**Action items:**
- [ ] ตรวจสอบทุก DNS record ใน Cloudflare Dashboard ว่าเหลือ A record ที่ชี้ IP ตรงอยู่หรือไม่ (ที่ไม่ผ่าน tunnel)
- [ ] ลบ A record เก่าที่ซ้ำซ้อนกับ CNAME ใหม่

### 11.4 QNAP Admin Panel (`qnap.np-dms.work`) — Access Hardening

**ปัญหาเดิม:** QNAP admin panel expose ตรงผ่าน QNAP DDNS (`lcbp3c2.myqnapcloud.com:8443`) — เป็น attack surface แยกจากสถาปัตยกรรมหลัก ไม่มี Cloudflare protection คลุม

**แผนแก้ไข (Decision: ใช้ Cloudflare Access แบบ Email-specific):**

1. ปิด public DDNS + port-forward 8443 เดิมทิ้ง
2. เพิ่ม ingress rule ใน `/etc/cloudflared/config.yml`:
   ```yaml
   - hostname: qnap.np-dms.work
     service: https://192.168.10.8:8443
     originRequest:
       noTLSVerify: true   # QNAP self-signed cert
   ```
   restart service: `sudo systemctl restart cloudflared`
3. **เพิ่ม Public Hostname ใน Zero Trust Dashboard** (จำเป็น — Dashboard config ทับ local config):
   - **Zero Trust → Networks → Connectors → `np-dms-lcbp3` → Published application routes**
   - **Add a public hostname**: Subdomain `qnap`, Domain `np-dms.work`, Type `HTTPS`, URL `192.168.10.8:8443`
   - **Edit → TLS → No TLS Verify: ON** (QNAP self-signed cert ไม่มี IP SANs)
   - **Save**
4. สร้าง Cloudflare Access Application คลุม `qnap.np-dms.work`
5. **Access Policy: Emails แบบเจาะจง** (ไม่ใช้ Email domain แบบเปิดกว้าง)
   - Include → Emails → ระบุ email ทีมที่อนุญาตทีละคน (เช่น เป้ + ทีมที่ระบุ)
   - Session duration: แนะนำ 24 ชม. (ปรับได้ตามความถี่การใช้งาน)
6. Authentication method: One-Time PIN (OTP) — ยืนยันสิทธิ์เข้าถึงกล่องอีเมล ไม่ใช่ identity verification แต่เพียงพอเมื่อคู่กับ email allowlist ที่เจาะจง
7. QNAP login (Layer 2) ยังคงอยู่หลัง Access — สองชั้นการยืนยัน (Cloudflare Access → QNAP username/password)

**Action items:**
- [ ] ปิด myqnapcloud DDNS record
- [ ] ปิด port-forward 8443 บน router/Omada
- [ ] เพิ่ม ingress rule `qnap.np-dms.work` ใน `config.yml`
- [ ] เพิ่ม Public Hostname ใน Zero Trust Dashboard (Connectors → np-dms-lcbp3 → Published application routes)
- [ ] เปิด No TLS Verify ใน Dashboard (TLS section) — QNAP self-signed cert
- [ ] สร้าง Cloudflare Access Application + Policy (email allowlist)
- [ ] ทดสอบเข้าถึงจาก external network หลังตั้งค่าเสร็จ

### 11.5 Cloudflared Redundancy Plan

**Decision:** ต้องการ instance ที่ 2 เพื่อลด SPOF ที่ยังค้างจาก D5 เดิม

**เลือก: QNAP (192.168.10.8)** เป็น instance สำรอง แทน ASUSTOR ด้วยเหตุผล:
- QNAP เป็น network/gateway layer อยู่แล้วตามปรัชญา infra เดิม (มี NPM รันอยู่)
- ASUSTOR สงวนไว้สำหรับ CI/CD (gitea-runner) และ registry — ไม่ควรแบ่ง resource ไปงาน edge/network

**สถาปัตยกรรมพร้อม redundancy:**
```
Cloudflare (Load Balance ระหว่าง 2 tunnel connections)
        │
        ├─── cloudflared #1 (np-dms-lcbp3, primary)
        │     └─ ingress → services บน np-dms-lcbp3
        │
        └─── cloudflared #2 (QNAP, standby/secondary)
              └─ ingress → เดียวกัน แต่ route ผ่าน LAN ไปหา np-dms-lcbp3
                 หรือ services ที่ยังอยู่ QNAP โดยตรง
```

**หมายเหตุสำคัญ:** Cloudflare Tunnel รองรับหลาย `cloudflared` connector ต่อ 1 tunnel ID ได้อยู่แล้ว (built-in HA) — ไม่ต้องสร้าง tunnel ใหม่ แค่รัน `cloudflared tunnel run` ด้วย credentials เดียวกันบน QNAP เพิ่มอีก instance เท่านั้น Cloudflare จะกระจาย connection ให้อัตโนมัติ และ failover เองถ้า instance ใดหลุด

**Action items:**
- [ ] Copy tunnel credentials file (`<tunnel-id>.json`) จาก `np-dms-lcbp3` ไป QNAP อย่างปลอดภัย
- [ ] ติดตั้ง `cloudflared` บน QNAP (ผ่าน Container Station หรือ binary โดยตรง)
- [ ] ตั้งค่า `config.yml` บน QNAP ให้ ingress rules ตรงกับ instance หลัก (หรือ subset ที่จำเป็น)
- [ ] รัน cloudflared เป็น service/container พร้อม auto-restart
- [ ] ทดสอบ failover: หยุด cloudflared บน `np-dms-lcbp3` ชั่วคราว แล้วเช็คว่า traffic ยังผ่านได้ผ่าน QNAP instance

### 11.6 Summary of Open Items

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | ลบ DNS A record เก่าที่ซ้ำซ้อน | เป้ | Pending |
| 2 | ปิด myqnapcloud DDNS + port-forward 8443 | เป้ | Pending |
| 3 | ตั้ง Cloudflare Access (QNAP admin) | เป้ | Pending |
| 4 | ติดตั้ง cloudflared instance ที่ 2 บน QNAP | เป้ | Pending |
| 5 | อัปเดต ADR-041 ให้สะท้อน D5 revised | เป้ | Pending (เอกสารนี้เป็น input) |
| 6 | Review ingress rules ทั้งหมดใน `config.yml` ว่าไม่มี rule ตกค้างชี้ผิดที่ | เป้ | Pending |

การตั้งค่า Cloudflare Tunnel ในปัจจุบัน (เวอร์ชันปี 2024-2026) ได้เปลี่ยนกระบวนทัศน์จาก **Local Management** (การใช้ไฟล์ `config.yml` และรันคำสั่ง `login` บนเครื่อง) มาเป็น **Remote Management** ผ่าน **Cloudflare Zero Trust Dashboard** อย่างเต็มรูปแบบครับ

ข้อดีคือ **เหมาะกับการทำ High Availability (HA) มากขึ้นอย่างมหาศาล** เพราะคุณเป้ไม่ต้องคัดลอกไฟล์ Credentials หรือจัดการไฟล์ config ให้ตรงกันระหว่าง New Server และ QNAP อีกต่อไป ทั้งสองเครื่องจะใช้แค่ "Token" ชุดเดียวกัน และการตั้งค่า Ingress Rules ทั้งหมดจะทำผ่านหน้าเว็บส่วนกลางครับ

นี่คือคู่มือฉบับอัปเดตและปรับปรุงตามสถาปัตยกรรมล่าสุดของ Cloudflare ครับ

---

### 🏗️ 11.7 กระบวนการย้ายสู่ Cloudflare Zero Trust (Remote Management)
> **สถานะ:** ปรับปรุงสถาปัตยกรรม Edge จากเดิม (D5: NPM บน QNAP) เป็น **Cloudflare Remote-Managed Tunnel (HA)**
> **เป้าหมาย:** ปิด Public Ports ทั้งหมดบน Router, ย้ายการจัดการ Ingress ไปที่ Cloudflare, ทำระบบยืนยันตัวตน (Access) ให้หน้า QNAP Admin และสร้างระบบสำรอง (High Availability) ระหว่าง New Server และ QNAP

---

#### ขั้นตอนที่ 1: การเคลียร์เครือข่ายฝั่งขาเข้าเดิม (Network Edge Cleanup)

ขั้นตอนนี้เป็นการปิดช่องทางสาธารณะ (Public Surface) เดิมบน Router เพื่อเตรียมสลับมาใช้ระบบปิดที่ปลอดภัยผ่าน Tunnel

* **1.1 ตรวจสอบและลบ DNS Record เดิม:**
* เข้าสู่ระบบที่ **dash.cloudflare.com** ➔ เลือกโดเมน `np-dms.work`
* ไปที่เมนูด้านซ้าย เลือก **DNS** ➔ **Records**
* ตรวจสอบและทำการ **Delete (ลบ)** A Record เก่าทั้งหมดของ `lcbp3`, `backend`, `git`, `n8n`, และ `pma` ที่เคยชี้ไปยัง Public Static IP ของออฟฟิศ เพื่อไม่ให้เกิดการชนกันของเส้นทางข้อมูล


* **1.2 ปิดกฎ Port Forwarding บน Omada Router:**
* เข้าสู่ระบบ Omada Controller (OC200) ไปที่เมนูตั้งค่าของ Router ER7206
* ไปที่ **Settings** ➔ **Transmission** ➔ **NAT** ➔ **Port Forwarding**
* ทำการ **Disable (ปิดใช้งาน)** หรือ **Delete (ลบ)** กฎที่เคย Forward พอร์ต `80`, `443` และ `8443` จากภายนอกเข้ามาทั้งหมด (เก็บพอร์ต `2222` ของ Gitea SSH ไว้ตัวเดียว โดยตั้งค่าให้โดเมนที่เป็น DNS Only วิ่งเข้ามา)


* **1.3 ปิดบริการ myQNAPcloud DDNS บน QNAP:**
* เข้าหน้า QNAP Admin Panel (192.168.10.8) ➔ เปิดแอป **myQNAPcloud**
* ไปที่แท็บ **My DDNS** ➔ คลิกสับสวิตช์เปิด-ปิดให้เป็น **Disabled** เพื่อหยุดการอัปเดต IP สู่สาธารณะ



---

#### ขั้นตอนที่ 2: การสร้าง Tunnel หลักและติดตั้งบน New Server (Primary Connector)

ขั้นตอนนี้เป็นการสร้างท่อเชื่อมต่อ outbound-only จาก New Server ไปยังเครือข่ายของ Cloudflare โดยใช้ระบบ Remote Management (คุมผ่านหน้าเว็บ)

* **2.1 เข้าสู่หน้าจอ Zero Trust Dashboard:**
* เข้าหน้าหลัก **dash.cloudflare.com** ➔ มองหาเมนูด้านซ้ายล่างสุด คลิกที่คำว่า **Zero Trust**
* (หากเข้าระบบครั้งแรก ระบบจะให้เลือกแพ็กเกจ ให้เลือกแพ็กเกจฟรี Free Plan เสมอ)


* **2.2 สร้าง Tunnel ใหม่:**
* ที่หน้าจอ Zero Trust มองเมนูด้านซ้าย เลือก **Networks** ➔ คลิกที่ **Tunnels**
* คลิกปุ่ม **Add a tunnel** สีฟ้าที่มุมขวาบน
* ระบบจะเลือกประเภท **Cloudflared** มาให้เป็นค่าเริ่มต้น ให้กด **Next**
* ในช่อง **Tunnel name** พิมพ์ตั้งชื่อว่า `np-dms-tunnel` จากนั้นกด **Save tunnel**


* **2.3 ติดตั้ง Cloudflared Service บน New Server (`192.168.10.11`):**
* ในหน้าจอ *Choose environment* ให้คลิกเลือกแท็บ **Debian** ➔ เลือกสถาปัตยกรรมเป็น **amd64** (ตามสเปคของ Ubuntu Server 26.04 บน New Server)
* ระบบจะแสดงชุดคำสั่งสำหรับดาวน์โหลดและติดตั้งพ่วง Token ประจำตัวมาให้ในกล่องข้อความ ให้กดไอคอน Copy คำสั่งนั้นมา (คำสั่งจะมีลักษณะดังนี้):

* If you don’t have cloudflared installed on your machine:
```bash
# Add cloudflare gpg key
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

# Add this repo to your apt repositories
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# install cloudflared
sudo apt-get update && sudo apt-get install cloudflared
```
* After you have installed cloudflared on your machine, you can install a service to automatically run your tunnel whenever your machine starts:
```bash
sudo cloudflared service install eyJhIjoiMTM5YjdmZTZiNDVmZmVjMzVhYjlmODY4ZDdhNzA2MGIiLCJ0IjoiMTkwYTNjZjAtMGNmOS00NDczLWIwNmMtNmI4OTA5OTBkZGUwIiwicyI6IlpqQXhOamxtTXpNdFpHVmxOQzAwT0dZNExXSXlNR1V0T1dVd056TmlZbVE1TnpFMiJ9
```
* OR run the tunnel manually in your current terminal session only:
```bash
cloudflared tunnel run --token eyJhIjoiMTM5YjdmZTZiNDVmZmVjMzVhYjlmODY4ZDdhNzA2MGIiLCJ0IjoiZTYyOWY2MDAtODM1YS00NWU3LWIxMGYtNTA3OWFlMDc5YjJmIiwicyI6Ik1XTmxZalE1WWpVdFpHUmlPQzAwTnpBeUxUZzJOR010TjJJMk1ETmhPR1F3T0RCbCJ9
```
* SSH เข้าไปยัง New Server (`192.168.10.11`) ในฐานะ user `np-dms` ➔ วางคำสั่งที่ Copy มาแล้วรันด้วย `sudo`

* docker on QNAP
```bash
docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoiMTM5YjdmZTZiNDVmZmVjMzVhYjlmODY4ZDdhNzA2MGIiLCJ0IjoiMTkwYTNjZjAtMGNmOS00NDczLWIwNmMtNmI4OTA5OTBkZGUwIiwicyI6IlpqQXhOamxtTXpNdFpHVmxOQzAwT0dZNExXSXlNR1V0T1dVd056TmlZbVE1TnpFMiJ9
```

* **2.4 ตรวจสอบสถานะการเชื่อมต่อบน Server:**
* รันคำสั่งตรวจสอบสถานะ Service บน Ubuntu:
```bash
sudo systemctl status cloudflared

```


* ตรวจสอบว่าขึ้นสถานะ `active (running)` และที่หน้าจอ Cloudflare Tunnels ในเบราว์เซอร์ สัญลักษณ์ของ Connector ด้านล่างจะเปลี่ยนสถานะเป็นสีเขียวคำว่า **Connected** ➔ จากนั้นให้กดปุ่ม **Next** ด้านล่างสุด



---

#### ขั้นตอนที่ 3: การตั้งค่าเส้นทางข้อมูล (Public Hostname Ingress Rules)

ขั้นตอนนี้เป็นการกำหนดให้ Cloudflare ทราบว่าหากมี Traffic วิ่งเข้ามาที่ Subdomain ต่างๆ จะต้องส่งต่อไปที่ IP และ Port ใดในวง LAN ภายในออฟฟิศ

* **3.1 เข้าสู่เมนูการตั้งค่าเส้นทาง:**
* ในหน้าจอการสร้าง Tunnel ถัดมา (หรือหากเข้าจากหน้าแรกให้ไปที่ **Networks** ➔ **Tunnels** ➔ คลิกที่ `np-dms-tunnel` ➔ กด **Edit** ➔ เลือกแท็บ **Public Hostname**)


* **3.2 กรอกข้อมูลจับคู่บริการทั้งหมดทีละรายการ:**
* คลิกปุ่ม **Add a public hostname** แล้วทำการกรอกข้อมูลตามตารางนี้ให้ครบถ้วน:



| Subdomain (ช่อง Hostname) | Domain (เลือกจาก Dropdown) | Type (โปรโตคอล) | URL (IP ภายในวง LAN และ Port) |
| --- | --- | --- | --- |
| `lcbp3` | `np-dms.work` | `HTTP` | `192.168.10.11:3001` (Frontend) |
| `backend` | `np-dms.work` | `HTTP` | `192.168.10.11:3000` (Backend) |
| `git` | `np-dms.work` | `HTTP` | `192.168.10.11:3003` (Gitea Web) |
| `n8n` | `np-dms.work` | `HTTP` | `192.168.10.11:5678` (n8n Engine) |
| `pma` | `np-dms.work` | `HTTP` | `192.168.10.11:8080` (phpMyAdmin) |

* **3.3 เพิ่มการเชื่อมต่อไปยัง QNAP Admin พร้อมข้ามการตรวจสอบใบรับรอง (SSL Bypass):**
* คลิก **Add a public hostname** อีกหนึ่งรายการ
* กรอกช่อง Subdomain: `qnap-admin` ➔ เลือก Domain: `np-dms.work`
* เลือก Type: **HTTPS** (เนื่องจากหน้าเว็บ QNAP Admin บังคับใช้ SSL ภายในตัว)
* ช่อง URL กรอก: `192.168.10.8:8443`
* **จุดสำคัญมาก:** ให้เลื่อนลงมาด้านล่าง คลิกที่เมนู **Additional application settings** ➔ คลิกแถบ **TLS** ➔ ทำการคลิกสับสวิตช์เปิดใช้งานหัวข้อ **No TLS Verify** ให้เป็นสีฟ้า (ขั้นตอนนี้จำเป็นมาก เพื่อให้ Tunnel ยอมรับ Self-signed Certificate ของ QNAP หากไม่เปิด หน้าเว็บจะขึ้น Error 502)
* เมื่อกรอกครบถ้วนทุกบริการแล้ว ให้กดปุ่ม **Save hostname** หรือ **Save tunnel** ระบบจะทำการสร้างสิทธิ์พ่วงเข้ากับระบบ DNS ของ Cloudflare ให้โดยอัตโนมัติ



---

#### ขั้นตอนที่ 4: การตั้งค่าระบบป้องกันหน้า QNAP Admin (Cloudflare Access Policy)

ขั้นตอนนี้เป็นการครอบระบบป้องกันแบบ Zero Trust ไว้ที่โดเมนหน้าจัดการ QNAP เพื่อบังคับให้เฉพาะผู้ที่มีอีเมลในรายการ Allowlist เท่านั้นจึงจะผ่านเข้าสู่หน้าระบบได้

* **4.1 สร้าง Application ใหม่:**
* ที่เมนูด้านซ้ายของ Zero Trust Dashboard ไปที่ **Access** ➔ คลิกเลือก **Applications**
* คลิกปุ่ม **Add an application** ที่มุมขวาบน ➔ คลิกเลือกประเภท **Self-hosted**


* **4.2 ตั้งค่าข้อมูลเบื้องต้นของแอปพลิเคชัน (Application Configuration):**
* **Application name:** พิมพ์ตั้งชื่อว่า `QNAP Admin Storage Protection`
* **Session Duration:** เลือกเป็น `24 Hours` (กำหนดระยะเวลาหมดอายุของการยืนยันตัวตน)
* **Application domain:** ในช่อง Subdomain พิมพ์กรอกคำว่า `qnap-admin` ➔ ช่อง Domain เลือก `np-dms.work` จากเมนู Dropdown


* **4.3 สร้างกฎการเข้าถึงเฉพาะบุคคล (Identity Access Policy):**
* เลื่อนลงมาด้านล่างสุด (หรือกด Next) ในส่วนของแท็บ **Policies** ➔ คลิกปุ่ม **Add policy**
* **Policy name:** พิมพ์กรอกว่า `Admin Team Allowlist Only`
* **Action:** ตรวจสอบให้มั่นใจว่าเป็นค่าเริ่มต้นคือ **Allow**


* **4.4 ระบุอีเมลทีมผู้รับสิทธิ์:**
* เลื่อนลงมาที่หัวข้อ **Configure rules** ➔ ในช่องย่อย **Include** ให้เปลี่ยนช่อง *Selector* จากเดิมให้เป็นคำว่า **Emails**
* ในช่อง *Value* ด้านขวา ให้พิมพ์ที่อยู่อีเมลของคุณเป้ และตามด้วยอีเมลของทีมงานรายบุคคลที่ได้รับอนุญาตให้จัดการระบบ (กด Enter ทุกครั้งหลังพิมพ์อีเมลเสร็จเพื่อแยกรายชื่อ)
* เมื่อใส่ครบถ้วนแล้ว เลื่อนลงมาด้านล่างสุด คลิกปุ่ม **Save application**
* *(ผลลัพธ์: เมื่อมีผู้พยายามเข้าใช้งาน `qnap-admin.np-dms.work` ระบบจะขึ้นหน้าจอ Cloudflare บังคับให้กรอกอีเมลเพื่อรับรหัส OTP 6 หลักไปยืนยันสิทธิ์ก่อนเสมอ)*



---

#### ขั้นตอนที่ 5: การตั้งค่าระบบสำรองเพื่อความเสถียรสูง (High Availability on QNAP)

เนื่องจากระบบปัจจุบันจัดการผ่านศูนย์กลาง (Remote Cloud) การทำ HA จึงทำได้โดยการนำรหัส Token เดิมจากขั้นตอนที่ 2 มาลงใน Instance ตัวที่สองบน QNAP เพื่อให้ทำหน้าที่เป็นสายเชื่อมต่อสำรองทันทีเมื่อ New Server เกิดข้อขัดข้อง

* **5.1 คัดลอก Token สำหรับใช้งานระบบสำรอง:**
* ในหน้า Zero Trust Dashboard ไปที่ **Networks** ➔ **Tunnels**
* คลิกเครื่องหมายจุดสามจุดท้ายชื่อ `np-dms-tunnel` ➔ เลือก **Configure** (หรือกดคลิกที่ชื่อแล้วกด Edit)
* มองหาหัวข้อ **Tunnel token** ในหน้าจอ (จะเป็นรหัสตัวอักษรผสมตัวเลขยาวๆ) ให้กดคัดลอกรหัสนั้นเก็บไว้


* **5.2 สร้าง Container สำรองบน QNAP Container Station:**
* เข้าสู่ระบบ QNAP Container Station ➔ ไปที่หัวข้อการจัดการแอปพลิเคชันหรือโฟลเดอร์สำหรับทำ Docker Compose
* จัดเตรียมไฟล์รันระบบ `docker-compose.yml` สำหรับ Instance สำรอง ดังนี้:
```yaml
version: '3.8'
services:
  cloudflared-ha-backup:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-ha-backup
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token <วางรหัส_TOKEN_ที่คัดลอกมาจากข้อ_5.1_ที่นี่>

```




* **5.3 สั่งเริ่มทำงานระบบสำรอง:**
* รันคำสั่งสั่งงานคอนเทนเนอร์บน QNAP:
```bash
docker compose up -d

```




* **5.4 ตรวจสอบสถานะความซ้ำซ้อน (Redundancy Verification):**
* กลับไปที่หน้าเบราว์เซอร์ใน Zero Trust Dashboard เมนู **Networks > Tunnels**
* คลิกดูรายละเอียดของ `np-dms-tunnel`
* ตรวจสอบดูที่แถบหัวข้อ Connectors ด้านล่าง จะต้องปรากฏรายการอุปกรณ์ **2 เครื่อง (2 Nodes)** ขึ้นสถานะออนไลน์เป็นสีเขียวพร้อมกัน โดยเครื่องแรกจะเป็นของ New Server และเครื่องที่สองจะเป็นของ QNAP ถือเป็นอันเสร็จสิ้นสถาปัตยกรรมแบบ HA ไร้รอยต่อ



---

#### 🛠️ รายการสิ่งตกค้างและจุดเฝ้าระวังที่ต้องดำเนินการต่อ (Remaining Work & Watchouts)

* **เรื่องพอร์ต Git SSH (พอร์ต 2222):** เนื่องจาก Cloudflare Tunnel คลุมเฉพาะ HTTP/HTTPS เลเยอร์ 7 หากทีมงานต้อง Push/Pull โค้ดผ่าน SSH นอกวง LAN ให้ทำการเข้าหน้า DNS Record ปกติของ Cloudflare สร้าง Subdomain ใหม่ชื่อ `ssh-git.np-dms.work` ชี้แบบ **DNS Only (ปิดเมฆส้มให้เป็นเมฆสีเทา)** ตรงมาที่ Public Static IP ของออฟฟิศ เพื่อปล่อยให้ Port 2222 วิ่งผ่านกฎ Port Forwarding บน Omada เข้าสู่ New Server ได้โดยตรงและไม่ปนเปื้อนกับระบบความปลอดภัยของ Tunnel

---

## 12. Addendum: NUT (Network UPS Tools) — CyberPower UT2200EG (2026-07-13)

> **สถานะ:** ติดตั้งและทดสอบใช้งานจริงบน `np-dms-lcbp3` — เมื่อไฟดับและแบตเหลือ threshold ที่กำหนด ระบบจะ graceful stop Docker stack ทั้งหมด (เรียงจาก AI layer → Application → Platform → Infrastructure) ก่อน shutdown อัตโนมัติ

### 12.1 ข้อมูลระบบ

| รายการ | ค่า |
|---|---|
| UPS | CyberPower UT2200EG (USB, Vendor:Product = `0764:0501`) |
| Server | np-dms-lcbp3 (bare-metal Ubuntu) |
| NUT version | 2.8.4 |
| Driver | `usbhid-ups` |
| UPS name ใน NUT | `lcbp3ups` |

### 12.2 ติดตั้ง NUT

```bash
sudo apt update
sudo apt install nut -y
```

ตั้งค่า mode เป็น standalone:

```bash
sudo tee /etc/nut/nut.conf <<'EOF'
MODE=standalone
EOF
```

### 12.3 ตั้งค่า driver (`/etc/nut/ups.conf`)

```ini
[lcbp3ups]
driver = usbhid-ups
port = auto
desc = "CyberPower UT2200EG"

override.battery.charge.low = 20
override.battery.runtime.low = 180
```

**Threshold ที่เลือกใช้:**
- `battery.charge.low = 20%` — trigger shutdown เมื่อแบตเหลือ 20%
- `battery.runtime.low = 180` วินาที (3 นาที) — คำนวณจากเวลาจริงที่วัดได้ตอน `docker compose down` ทั้ง 4 group (~15.5 วินาที) แล้วเผื่อ margin ~12 เท่า สำหรับกรณี load สูงตอนไฟดับจริง

### 12.4 ตั้งค่า upsd (`/etc/nut/upsd.conf`)

```ini
LISTEN 127.0.0.1 3493
MAXCONN 15
```

### 12.5 สร้าง user สำหรับ upsmon (`/etc/nut/upsd.users`)

```ini
[monuser]
password = <รหัสผ่าน>
upsmon master
```

```bash
sudo chmod 640 /etc/nut/upsd.users
sudo chown root:nut /etc/nut/upsd.users
```

### 12.6 ตั้งค่า upsmon (`/etc/nut/upsmon.conf`)

```ini
MONITOR lcbp3ups@localhost 1 monuser <รหัสผ่าน> master
MINSUPPLIES 1
SHUTDOWNCMD "/opt/np-dms/scripts/ups-shutdown.sh"
POLLFREQ 5
```

> ⚠️ **ข้อควรระวังที่เจอจริง:** ตอน setup ครั้งแรกลืมแทนที่ placeholder `ใส่รหัสผ่านของคุณ` ด้วยรหัสผ่านจริง ทำให้ `upsmon` connect ไม่ได้ (`ERR INVALID-ARGUMENT`) ต้องเช็คให้ตรงกับ `upsd.users` เสมอ

### 12.7 แก้ปัญหา USB permission (udev)

**อาการที่เจอ:**

```
libusb1: Could not open any HID devices: insufficient permissions on everything
```

**สาเหตุ:** `systemd-udevd` daemon **ค้าง rule เก่าไว้ในหน่วยความจำตั้งแต่ boot** — คำสั่ง `udevadm control --reload-rules` และ `udevadm trigger` เพียงอย่างเดียว **ไม่พอ** ต้อง restart service จริงถึงจะโหลด rule ใหม่

**วิธีแก้:**

```bash
sudo systemctl restart systemd-udevd
sudo udevadm trigger --action=add --subsystem-match=usb
sudo udevadm settle
```

**วิธี debug ที่ใช้ได้ผล:**

```bash
# หา sysfs path ของ device
udevadm info -q path -n /dev/bus/usb/<bus>/<device>

# ทดสอบว่า rule ไหนจะถูกใช้จริง (dry-run)
sudo udevadm test $(udevadm info -q path -n /dev/bus/usb/<bus>/<device>) 2>&1 | grep -i -E "nut|GROUP|rules"
```

Rule ของ CyberPower (`0764:0501`) มีอยู่แล้วใน `/usr/lib/udev/rules.d/62-nut-usbups.rules` บรรทัด 150 — ไม่จำเป็นต้องสร้าง custom rule เพิ่ม

### 12.8 เริ่ม driver ผ่าน systemd (ไม่ใช่ manual)

NUT 2.8.4 ใช้ `nut-driver-enumerator` generate service ต่อ UPS อัตโนมัติ แทนการรัน `upsdrvctl start` ตรงๆ:

```bash
sudo nut-driver-enumerator.sh
systemctl list-units 'nut-driver@*'   # ควรเห็น nut-driver@lcbp3ups.service

sudo systemctl enable --now nut-driver@lcbp3ups.service
sudo systemctl enable --now nut-server
sudo systemctl enable --now nut-monitor
```

**ตรวจสอบ:**

```bash
sudo upsc lcbp3ups@localhost
```

### 12.9 Shutdown script (`/opt/np-dms/scripts/ups-shutdown.sh`)

Script สั่ง `docker compose down` เรียงลำดับจาก layer บนสุด (AI) ลงไปถึง infrastructure ก่อน shutdown เครื่องจริง:

```bash
#!/bin/bash
# Graceful Docker stack shutdown triggered by NUT on UPS critical battery
set -uo pipefail

LOGFILE=/var/log/ups-shutdown.log
exec >> "$LOGFILE" 2>&1

echo ""
echo "=== UPS shutdown triggered at $(date) ==="

ENVFILE=/opt/np-dms/.env

# Shut down in reverse dependency order: app layer first, infrastructure last
DIRS=(
    "/opt/np-dms/04-ai/ocr-sidecar"
    "/opt/np-dms/03-application"
    "/opt/np-dms/02-platform"
    "/opt/np-dms/01-infrastructure"
)

for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "SKIP: $dir does not exist"
        continue
    fi

    echo "--- docker compose down: $dir ---"
    if (cd "$dir" && docker compose --env-file "$ENVFILE" down --timeout 30); then
        echo "OK: $dir"
    else
        echo "WARNING: failed to stop $dir"
    fi
done

echo "=== Docker stack stopped, shutting down system at $(date) ==="
/sbin/shutdown -h +0 "UPS battery critical - automatic shutdown"
```

```bash
sudo chmod 700 /opt/np-dms/scripts/ups-shutdown.sh
sudo chown root:root /opt/np-dms/scripts/ups-shutdown.sh
```

**สาเหตุที่เปลี่ยนจาก dynamic `find` มาเป็น hardcoded path:**

เวอร์ชันแรกใช้ `find` หา compose file อัตโนมัติในแต่ละ group โดยเก็บชื่อ group ไว้ใน bash array แล้ววน `for group in "${GROUPS[@]}"` — ทดสอบแล้วพบว่า loop รันแค่ 1 รอบแทนที่จะเป็น 4 รอบ (ตัวแปร `$group` ได้ค่าผิดเพี้ยนเป็น `"0"` แทนที่จะเป็น `"04-ai"`) สาเหตุที่แท้จริงไม่ชัดเจน (ไม่ใช่ CRLF, ไม่ใช่ non-ASCII จากการตรวจสอบ) จึงตัดสินใจเปลี่ยนมาระบุ path ของแต่ละ group ตรงๆ ใน array `DIRS` แทน ซึ่งง่ายกว่า, debug ง่ายกว่า และไม่มีปัญหานี้อีก

**สาเหตุที่ต้องเพิ่ม `--env-file`:**

`docker compose down` ทำ variable interpolation ทั้งไฟล์ compose ตั้งแต่ parse YAML ก่อนจะรู้ด้วยซ้ำว่าจะ down หรือ up — ถ้าไม่ระบุ `--env-file` ให้ตรงกับตอน `up` จะ error เช่น `REDIS_PASSWORD required`, `N8N_DB_PASSWORD required` ทั้งที่ down ไม่จำเป็นต้องรู้ค่าจริงของ secret เหล่านี้เลย

### 12.10 ผูก script เข้ากับ NUT

```bash
sudo sed -i 's|^SHUTDOWNCMD.*|SHUTDOWNCMD "/opt/np-dms/scripts/ups-shutdown.sh"|' /etc/nut/upsmon.conf
sudo systemctl restart nut-monitor
```

> ⚠️ ระวังการรัน `sed`/`tee -a` ซ้ำหลายครั้งกับไฟล์เดิม อาจทำให้เกิดบรรทัด `SHUTDOWNCMD` ซ้ำกันหลายชุด (เจอจริงระหว่างทำ 3 บรรทัดซ้ำ) ให้เช็คด้วย `grep -n "^SHUTDOWNCMD"` ก่อนเสมอ ถ้าซ้ำให้ลบด้วย:

```bash
sudo awk '!/^SHUTDOWNCMD/ || !seen++' /etc/nut/upsmon.conf > /tmp/fixed.conf
sudo cp /tmp/fixed.conf /etc/nut/upsmon.conf
```

### 12.11 วิธีทดสอบ shutdown flow แบบปลอดภัย (ไม่ต้องถอดปลั๊กจริง)

```bash
# 1. Backup และคอมเมนต์บรรทัด shutdown ชั่วคราว
sudo cp /opt/np-dms/scripts/ups-shutdown.sh /opt/np-dms/scripts/ups-shutdown.sh.bak
sudo sed -i 's|^/sbin/shutdown|# /sbin/shutdown|' /opt/np-dms/scripts/ups-shutdown.sh

# 2. Trigger forced shutdown จำลอง
sudo upsmon -c fsd

# 3. เช็คผล
sudo tail -60 /var/log/ups-shutdown.log
docker ps

# 4. Restore บรรทัด shutdown กลับ + up container คืน
sudo sed -i 's|^# /sbin/shutdown|/sbin/shutdown|' /opt/np-dms/scripts/ups-shutdown.sh

cd /opt/np-dms/01-infrastructure && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/02-platform && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/03-application && sudo docker compose --env-file ../.env up -d
cd /opt/np-dms/04-ai/ocr-sidecar && sudo docker compose --env-file ../../.env up -d
```

> ⚠️ **`upsmon -c fsd` เป็นคำสั่งจริง ไม่ใช่แค่ simulate** — ถ้าลืมคอมเมนต์บรรทัด `/sbin/shutdown` ก่อนรัน เครื่องจะปิดจริงทันที ต้อง comment ออกก่อนทุกครั้งที่ทดสอบ

### 12.12 สรุปผลลัพธ์สุดท้าย

| ส่วน | สถานะ |
|---|---|
| USB permission (udev rule) | ✅ แก้แล้ว |
| `nut-driver@lcbp3ups.service` | ✅ running |
| `nut-server.service` | ✅ running |
| `nut-monitor.service` | ✅ running |
| Auth (`upsd.users` ↔ `upsmon.conf`) | ✅ ตรงกัน |
| Shutdown threshold | ✅ `charge.low=20%`, `runtime.low=180s` |
| Shutdown script | ✅ ทดสอบผ่าน — down ครบ 4 group, `docker ps` ว่างเปล่า |

ระบบพร้อมใช้งานจริง — เมื่อไฟดับและแบตลงถึง threshold ที่ตั้งไว้ เครื่องจะ graceful stop Docker stack ทั้งหมด (เรียงจาก AI layer → Application → Platform → Infrastructure) ก่อน shutdown อัตโนมัติ
