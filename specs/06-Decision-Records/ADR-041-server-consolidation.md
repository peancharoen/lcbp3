<!-- File: specs/06-Decision-Records/ADR-041-server-consolidation.md -->
<!-- Change Log
- 2026-06-20: Created initial ADR-041 documenting server consolidation decision.
  - Co-locate all services on single Docker host (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB).
  - QNAP remains NAS for uploads/permanent storage via CIFS.
  - Enables ADR-040 network-only auth for sidecar via Docker-internal isolation.
-->

# ADR-041: Single-Host Server Consolidation

**Status:** Proposed
**Date:** 2026-06-20
**Related Documents:**
- [ADR-040: OCR Sidecar Refactor](./ADR-040-ocr-sidecar-refactor.md)
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)
- [ADR-023A: Unified AI Architecture](./ADR-023A-unified-ai-architecture.md)
- [ADR-034: AI Model Change](./ADR-034-AI-model-change.md)
- [CONTEXT.md](../../00-overview/CONTEXT.md)

---

## 🎯 Context and Problem Statement

### Current Architecture

ปัจจุบัน LCBP3-DMS กระจาย services ไว้บนหลายเครื่อง:

| Service | Host | Hardware | Network |
|---------|------|----------|---------|
| Ollama (np-dms-ai, np-dms-ocr, nomic-embed) | Desk-5439 | RTX 4060 Ti 16GB | VLAN 10 (192.168.10.100) |
| OCR Sidecar (FastAPI) | Desk-5439 | Same as above | VLAN 10 (192.168.10.100) |
| Backend (NestJS) | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| Frontend (Next.js) | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| Redis | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| MariaDB | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| Elasticsearch | QNAP NAS | - | VLAN 10 (192.168.10.8) |
| File Storage | QNAP NAS | - | CIFS share `np-dms-as` |

### Problems Identified

1. **Cross-Host Trust Boundary:** Backend ↔ sidecar/Ollama ผ่าน LAN (VLAN 10) — ต้องพึ่ง VLAN/firewall ACL สำหรับ isolation (ADR-040 §4)
2. **Management Complexity:** Services กระจายบน 2 hosts → deployment, monitoring, troubleshooting ซับซ้อน
3. **GPU Resource Fragmentation:** Desk-5439 มี GPU แต่ CPU/RAM น้อย → ไม่สามารถรัน backend ได้
4. **Network Latency:** Backend ↔ Ollama ผ่าน LAN เพิ่ม latency สำหรับ AI inference
5. **Hardware Underutilization:** QNAP NAS มี CPU/RAM แต่ไม่มี GPU → ไม่สามารถรัน AI models ได้

### New Hardware

มีเซิร์ฟเวอร์ใหม่พร้อมใช้งาน:
- **CPU:** Ryzen 5 5600 (6 cores / 12 threads)
- **RAM:** 32GB DDR4
- **GPU:** RTX 5060 Ti 16GB
- **Storage:** SSD (OS) + HDD (data)

---

## ⚙️ Decision Drivers

* **Simplify Architecture:** ลดจำนวน hosts จาก 2 → 1
* **Enable Docker-Internal Isolation:** Sidecar + backend อยู่บน Docker bridge เดียวกัน → network auth จริง (ADR-040 D5)
* **Better Resource Utilization:** Single host มีทั้ง CPU, RAM, GPU ในเครื่องเดียว
* **Reduce Network Latency:** Backend ↔ Ollama ผ่าน localhost แทน LAN
* **Maintain Data Separation:** QNAP ยังคงเป็น NAS สำหรับ file storage

---

## 🏛️ Decisions

### D1: Co-locate All Services on Single Docker Host
ย้าย services ทั้งหมดไปรันบนเซิร์ฟเวอร์ใหม่:
- Ollama (np-dms-ai, np-dms-ocr, nomic-embed)
- OCR Sidecar (FastAPI)
- Backend (NestJS)
- Frontend (Next.js)
- Redis
- MariaDB
- Elasticsearch

**Retire Desk-5439** หลัง cutover สำเร็จ

### D2: ASUSTOR as Primary NAS, QNAP as Backup
QNAP (192.168.10.8) ลดบทบาทเป็น backup server เท่านั้น

ASUSTOR (192.168.10.9) เป็น Primary NAS สำหรับ:
- Upload temp storage (`/data/uploads/temp`)
- Permanent file storage (`/data/uploads/permanent`)
- CIFS share `np-dms-as` ถูก mount บน new host ผ่าน:
  - `/mnt/uploads/temp` → `//192.168.10.9/np-dms-as/data/uploads/temp`
  - `/mnt/uploads/permanent` → `//192.168.10.9/np-dms-as/data/uploads/permanent`

### D3: Docker-Internal Network Only for Sidecar/Ollama
- Sidecar และ Ollama **ไม่ publish ports ไป LAN** (ใช้ `expose` แทน `ports`)
- Services อยู่บน internal Docker bridge network (`dms-internal`)
- Backend ติดต่อ sidecar/Ollama ผ่าน `http://sidecar:8765` และ `http://ollama:11434` (service names)
- Frontend ติดต่อ backend ผ่าน `http://backend:3000`
- เฉพาะ Frontend และ Backend เท่านั้นที่ publish ports ไป LAN (80, 443, 3000)

**Enables ADR-040 D5:** Network isolation ผ่าน Docker-internal bridge → ลบ `X-API-Key` ได้จริง

### D4: GPU VRAM Management Reinforced
RTX 5060 Ti 16GB ต้องรองรับ:
- `np-dms-ai` (Typhoon-2.5 ~7–8B) ~6–8GB
- `np-dms-ocr` (Typhoon OCR) ~5GB
- `nomic-embed-text` ~0.5GB
- BGE-M3 + Reranker (ถ้า GPU-resident) ~4.5GB
- CUDA overhead ~1.5GB

**Total ≈ 15.5GB → OOM risk หาก load พร้อมกันทั้งหมด**

**Mandatory:**
- ADR-040 D3 (Adaptive OCR Residency via `calculate_ocr_residency()`)
- ADR-040 D4 (CPU Fallback Retrieval for embed/rerank)
- LLM-First GPU Ownership (CONTEXT.md)
- ไม่บังคับ BGE+Reranker GPU-resident ถาวร

### D5: RAM Budget Considerations
32GB RAM ต้องรองรับ:
- Node.js (Frontend) ~500MB
- NestJS (Backend) ~1–2GB
- MariaDB ~4–8GB (ขึ้นกับ dataset size)
- Redis ~500MB
- Elasticsearch ~2–4GB (ขึ้นกับ index size)
- Python (Sidecar) ~500MB
- Ollama ~1–2GB
- BGE/Reranker CPU-fallback tensors ~2–4GB

**Action Items:**
- Size DB/ES/Redis memory limits ก่อน cutover
- Monitor RAM usage หลัง cutover
- พิจารณา swap space ถ้าจำเป็น

### D6: Single Point of Failure (SPOF) Mitigation
Single host = SPOF risk

**Mitigation:**
- Regular backup ของ database และ file storage (QNAP)
- Disaster recovery plan สำหรับ hardware failure
- พิจารณา cold standby หรือ failover strategy ในอนาคต

---

## 📋 Implementation Tasks

| Task ID | Phase | Summary | Status |
| :--- | :--- | :--- | :--- |
| T001 | Provision | Install Docker + Docker Compose on new host | Pending |
| T002 | Provision | Mount CIFS share from ASUSTOR to `/mnt/uploads` | Pending |
| T003 | Deploy | Create `docker-compose.yml` for new host topology | Pending |
| T004 | Deploy | Configure internal bridge network (`dms-internal`) | Pending |
| T005 | Deploy | Deploy services (Ollama, sidecar, backend, frontend, Redis, DB, ES) | Pending |
| T006 | Migrate | Migrate MariaDB data from QNAP to new host | Pending |
| T007 | Migrate | Migrate Elasticsearch indices from QNAP to new host | Pending |
| T008 | Cutover | Update DNS/load balancer to point to new host | Pending |
| T009 | Cutover | Run smoke tests on new host | Pending |
| T010 | ADR-040 | Remove `X-API-Key` from sidecar + backend (ADR-040 D5) | Pending |
| T011 | Cleanup | Stop services on QNAP (QNAP becomes backup server) | Pending |
| T012 | Cleanup | Retire Desk-5439 | Pending |

---

## 📋 Target docker-compose Layout (Draft)

```yaml
version: '3.8'

networks:
  dms-internal:
    driver: bridge
  dms-frontend:
    driver: bridge

services:
  # GPU Services (internal-only, no LAN publish)
  ollama:
    image: ollama/ollama:latest
    container_name: lcbp3-ollama
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    volumes:
      - ollama_models:/root/.ollama
    networks:
      - dms-internal
    expose:
      - "11434"
    environment:
      - OLLAMA_KEEP_ALIVE=-1

  ocr-sidecar:
    build:
      context: ./specs/04-Infrastructure-OPS/04-00-docker-compose/New-Host/ocr-sidecar
    container_name: lcbp3-ocr-sidecar
    restart: unless-stopped
    volumes:
      - asustor_uploads:/mnt/uploads:ro  # Read-only CIFS mount from ASUSTOR
    networks:
      - dms-internal
    expose:
      - "8765"
    depends_on:
      - ollama
    environment:
      - OLLAMA_API_URL=http://ollama:11434
      - OCR_SIDECAR_UPLOAD_BASE=/mnt/uploads

  # Backend Services (internal-only)
  backend:
    build:
      context: ./backend
    container_name: lcbp3-backend
    restart: unless-stopped
    volumes:
      - asustor_uploads:/app/uploads:ro
    networks:
      - dms-internal
      - dms-frontend
    expose:
      - "3000"
    depends_on:
      - ollama
      - ocr-sidecar
      - redis
      - mariadb
      - elasticsearch
    environment:
      - OCR_API_URL=http://ocr-sidecar:8765
      - OLLAMA_API_URL=http://ollama:11434

  # Frontend (LAN publish)
  frontend:
    build:
      context: ./frontend
    container_name: lcbp3-frontend
    restart: unless-stopped
    networks:
      - dms-frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  # Data Services
  redis:
    image: redis:7-alpine
    container_name: lcbp3-redis
    restart: unless-stopped
    networks:
      - dms-internal
    volumes:
      - redis_data:/data

  mariadb:
    image: mariadb:10.11
    container_name: lcbp3-mariadb
    restart: unless-stopped
    networks:
      - dms-internal
    volumes:
      - mariadb_data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
      - MYSQL_DATABASE=lcbp3

  elasticsearch:
    image: elasticsearch:8.11.0
    container_name: lcbp3-elasticsearch
    restart: unless-stopped
    networks:
      - dms-internal
    volumes:
      - es_data:/usr/share/elasticsearch/data
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false

volumes:
  ollama_models:
  asustor_uploads:
    driver: local
    driver_opts:
      type: cifs
      o: "username=${ASUSTOR_USER},password=${ASUSTOR_PASS},vers=3.0,uid=0,gid=0"
      device: "//192.168.10.9/np-dms-as/data/uploads"
  redis_data:
  mariadb_data:
  es_data:
```

---

## 📋 Consequences

### Positive

* **Simplified Architecture:** Single host → easier deployment, monitoring, troubleshooting
* **True Network Isolation:** Docker-internal bridge enables ADR-040 D5 (network-only auth)
* **Reduced Latency:** Backend ↔ Ollama ผ่าน localhost
* **Better Resource Utilization:** Single host มีทั้ง CPU, RAM, GPU
* **Data Separation Maintained:** ASUSTOR เป็น Primary NAS → data แยกจาก compute; QNAP เป็น backup server

### Negative

* **SPOF Risk:** Single host = single point of failure
* **RAM Pressure:** 32GB ต้องรองรับ services ทั้งหมด + CPU-fallback tensors
* **Migration Complexity:** ต้อง migrate DB + ES + file paths
* **GPU VRAM Pressure:** 16GB ต้องอาศัย adaptive residency + CPU fallback

---

## 🔄 Rollback Plan

1. Stop services บน new host
2. Restore services บน QNAP (backend, frontend, Redis, DB, ES)
3. Restore services บน Desk-5439 (Ollama, sidecar)
4. Revert DNS/load balancer ไป QNAP
5. Update CIFS mount กลับไป ASUSTOR (192.168.10.9) บน QNAP
6. Restore `X-API-Key` ใน sidecar + backend (ADR-040 rollback)

---

## 📝 Verification Plan

1. Smoke tests บน new host:
   - Backend health check
   - Frontend accessible via LAN
   - OCR endpoint functional
   - AI inference functional
   - File upload/download via CIFS
2. Monitor RAM/VRAM usage 24–48 hours หลัง cutover
3. Verify ADR-040 D5 (network-only auth) ทำงานได้จริง
4. Verify ADR-040 D3/D4 (adaptive residency + CPU fallback) ทำงานได้จริง
