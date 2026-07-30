# Session — 2026-07-17/18 (Monitoring Stack Setup & Prometheus Exporters)

## Summary

ตั้งค่า monitoring stack บน ASUSTOR + deploy Prometheus exporters บน main server (192.168.10.11):
1. ตรวจสอบและแก้ไข `prometheus.yml` (ASUSTOR) — 5 ปัญหา
2. แยก `ollama-metrics` + `nvidia-gpu-exporter` ออกจาก `ocr-sidecar/docker-compose.yml` ไป `04-ai/docker-compose.yml`
3. Deploy `node-exporter` (9100), `cadvisor` (8088), `mariadb-exporter` (9104) ใน `01-infrastructure/docker-compose.yml`
4. สร้าง MariaDB user `exporter`@`%` (password: Center2026)
5. อัปเดต `copy-env.sh` + `dockerup.sh` รองรับไฟล์ใหม่

## ปัญหาที่พบ (Root Cause)

1. **prometheus.yml header ล้าหลัง** — อ้าง IP เก่า `192.168.10.100` (Desk-5439) แทน `192.168.10.11` (ADR-041)
2. **Uptime Kuma ขาด docker.sock mount** — Tier 3 Docker Container monitor ใช้ไม่ได้
3. **Uptime Kuma image version mismatch** — compose `:1` vs monitoring plan `:2`
4. **Backend /metrics endpoint ยังไม่ยืนยัน** — ตรวจพบว่ามี `@willsoto/nestjs-prometheus` อยู่แล้ว (ไม่ต้องแก้)
5. **Exporters บน .11 ยังไม่ deploy** — prometheus.yml มี TODO คลุมเครือ
6. **ollama-metrics + nvidia-gpu-exporter อยู่ผิดที่** — ฝังใน `ocr-sidecar/docker-compose.yml` ทั้งที่ไม่ใช่ OCR workload
7. **Orphan containers** — หลังย้าย services ระหว่าง compose projects, container เก่าจาก `lcbp3-ocr` ยังค้าง ทำให้ conflict ชื่อ

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `ASUSTOR/monitoring/docker-compose.yml` | อัปเดต header comment (IP เก่า → ใหม่), เพิ่ม `docker.sock` mount สำหรับ Uptime Kuma, เปลี่ยน image `:1` → `:2`, แก้ YAML typo `logging:-` → `logging:` |
| `ASUSTOR/monitoring/prometheus/config/prometheus.yml` | อัปเดต comment: ลบ PREREQUISITE warning, ระบุ source ของ exporters (01-infrastructure), เพิ่ม Change Log rev2 |
| `np-dms-lcbp3/04-ai/docker-compose.yml` | **สร้างใหม่** — `ollama-metrics` + `nvidia-gpu-exporter` (compose name: `lcbp3-ai-telemetry`) |
| `np-dms-lcbp3/04-ai/ocr-sidecar/docker-compose.yml` | ลบ 2 services ออก, อัปเดต change log + test commands |
| `np-dms-lcbp3/01-infrastructure/docker-compose.yml` | เพิ่ม `node-exporter` (9100), `cadvisor` (8088), `mariadb-exporter` (9104) |
| `np-dms-lcbp3/01-infrastructure/exporter-my.cnf` | **สร้างใหม่** — config สำหรับ mariadb-exporter (password: Center2026) |
| `/opt/np-dms/copy-env.sh` | เพิ่ม copy `exporter-my.cnf`, แยก copy 04-ai telemetry จาก ocr-sidecar |
| `/opt/np-dms/dockerup.sh` | เพิ่ม `04-ai` telemetry startup ก่อน ocr-sidecar |

## กฎที่ Lock แล้ว

- **D42**: Docker Compose layer 00-basic = Docker management (Portainer); 01-infrastructure = data stores + monitoring exporters (node-exporter, cAdvisor, mariadb-exporter อยู่ที่ 01 เพราะ `depends_on: mariadb` ต้องอยู่ใน compose project เดียวกัน)
- **AI telemetry แยกจาก OCR workload**: `ollama-metrics` + `nvidia-gpu-exporter` อยู่ใน `04-ai/docker-compose.yml` (ไม่ใช่ `ocr-sidecar/`)
- **Exporters ใน 01-infrastructure ไม่ใช่ 04-ai**: node-exporter/cadvisor/mariadb-exporter = infrastructure telemetry ไม่ใช่ AI-specific
- **mariadb-exporter user**: `exporter`@`%` password `Center2026`, GRANT PROCESS + REPLICATION CLIENT + SELECT

## Verification

- [x] `curl http://192.168.10.11:9100/metrics` — node-exporter ตอบกลับ (go_gc_duration_seconds)
- [x] `curl http://192.168.10.11:8088/metrics` — cadvisor ตอบกลับ (cadvisor_version_info v0.47.2)
- [x] `curl http://192.168.10.11:9104/metrics` — mariadb-exporter ตอบกลับ (go_gc_duration_seconds)
- [x] MariaDB user `exporter`@`%` สร้างสำเร็จ (verified via `SELECT user, host FROM mysql.user`)
- [x] Backend `/metrics` endpoint มีอยู่แล้ว (`@willsoto/nestjs-prometheus` ใน `MonitoringModule`)
- [ ] Prometheus (ASUSTOR) reload config + ตรวจสอบ targets ทั้งหมด up
- [ ] Grafana dashboard สำหรับ main-server metrics
- [ ] Uptime Kuma v2 deploy บน ASUSTOR (ต้อง backup data ก่อน)
