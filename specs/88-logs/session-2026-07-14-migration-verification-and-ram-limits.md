# Session — 2026-07-14 (Migration Verification & RAM Limits Update)

## Summary

ตรวจสอบ migration steps 4.16–4.19 บน new server (192.168.10.11) และอัปเดต container RAM limits ใน docker-compose ทั้ง 4 ไฟล์ให้ตรงตาม MIGRATION-PLAN.md RAM budget 64GB

## ปัญหาที่พบ (Root Cause)

- Container RAM limits ใน docker-compose ยังเป็นค่าเดิมสมัย 32GB RAM — ไม่ได้อัปเดตตาม plan 64GB ใหม่
- OCR sidecar ไม่ได้รันตอนแรก (ไม่มีใน `docker ps`) แต่ภายหลังรันแล้วและ healthy
- LVM layout ใน MIGRATION-PLAN.md สลับ nvme0n1/nvme1n1 ไม่ตรงความจริง
- CIFS share path ใน plan ใช้ `np-dms-as` แต่จริงๆ คือ `np-dms`
- CIFS uid/gid ใน plan ไม่ตรง `/etc/fstab` จริง (ควรเป็น 1000:1000)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `MIGRATION-PLAN.md` | สลับ nvme0n1/nvme1n1 LVM layout ให้ตรงจริง; CIFS share path → `np-dms`; uid/gid → 1000:1000 |
| `README.md` | อัปเดต LVM layout + CIFS mount details ให้ตรง MIGRATION-PLAN |
| `01-infrastructure/docker-compose.yml` | MariaDB 8G→16G, Redis 2G→4G, ES 3G→6G (heap 2g→4g), Qdrant 2G→4G |
| `02-platform/docker-compose.yml` | เพิ่ม n8n-db limit 1G, docker-socket-proxy limit 256M |
| `03-application/docker-compose.yml` | Backend 1536M→2G, Frontend 2G→3G |
| `04-ai/ocr-sidecar/docker-compose.yml` | เพิ่ม ocr-sidecar limit 2G, ollama-metrics limit 256M |

## Verification Results

- **4.16 OCR sidecar /health:** `{"status":"ok","engine":"np-dms-ocr","ocrModel":"np-dms-ocr:latest"}` ✅
- **4.17 Ollama metrics:** Prometheus format metrics ที่ `:9924/metrics` ✅
- **4.18 Docker network connectivity:** ทุก internal DNS ทำงาน (mariadb, cache, search, qdrant, ollama, ocr-sidecar) ✅
- **4.19 RAM usage:** ~6.5 GiB total (Docker containers) — ห่างจาก 56GB อย่างมาก ✅
- **4.20 VRAM usage:** ตรวจสอบแล้ว (user เช็ค `[X]`) ✅

## กฎที่ Lock แล้ว

- Container RAM limits ต้องตรง MIGRATION-PLAN.md RAM budget table (64GB)
- ES heap ต้องตรง `ES_JAVA_OPTS` กับ container memory limit (heap 4G, container 6G)
- `env_file: ../.env` ต้องอยู่ใต้ `deploy` block ไม่ใช่ข้างบน (backend compose)

## ข้อสังเกต

- Container limits ยังไม่มีผลจนกว่าจะ redeploy แต่ละ layer
- Lint errors (schemastore.org) เป็น network issue ไม่ใช่ code problem
