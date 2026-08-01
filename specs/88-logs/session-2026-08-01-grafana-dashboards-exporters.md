# Session 2026-08-01 — Grafana Dashboards + Exporters + BullMQ Metrics

## Summary

เพิ่ม monitoring coverage ครบทั้งระบบ: deploy Redis exporter + Elasticsearch exporter ใน infrastructure layer, เพิ่ม BullMQ metrics service ใน backend, อัปเดต Prometheus config, และสร้าง Grafana dashboards ใหม่ 4 ตัว — รวมเป็น 9 dashboards ครอบคลุม 1,970 metrics ทั้งหมด

## ปัญหาที่พบ (Root Cause)

1. **Grafana dashboards เดิมใช้ไม่ได้ 3 ตัว:**
   - Node overview — ใช้ `origin_prometheus` label ที่ไม่มีในระบบ
   - Docker overview — ใช้ metric names เก่า (`node_boot_time`, `node_memory_MemTotal` ไม่มี `_bytes` suffix)
   - Neurix Ollama & GPU — ใช้ `ollama_up`/`ollama_version_info` ที่ไม่มี (ระบบมีแค่ 3 ollama metrics)

2. **Ollama & GPU dashboard "No data":**
   - Template variable `$instance` query ใช้ `ollama_model_loaded` ซึ่งตอน standby ไม่มี model loaded → ไม่ return ค่า
   - Ollama (`192.168.10.11:9924`) และ NVIDIA (`192.168.10.11:9835`) คนละ instance — ใช้ `$instance` ร่วมกันไม่ได้
   - แก้โดยเปลี่ยน template var ไปใช้ `host` label (ทั้งสองมี `host=main-server` ร่วมกัน)

3. **ES exporter auth ล้มเหลว (401):**
   - `$(ELASTICSEARCH_PASSWORD)` ใน docker-compose command แบบ list ไม่ถูก interpolate
   - แก้โดยใช้ `${ELASTICSEARCH_PASSWORD}` syntax

4. **ES exporter flag เปลี่ยนใน v1.7.0:**
   - `--es.cluster_settings` → `--collector.clustersettings`
   - `--es.snapshots` → `--collector.snapshots`

5. **Redis exporter auth ล้มเหลว (WRONGPASS):**
   - `$(REDIS_PASSWORD)` ไม่ถูก interpolate เช่นกัน
   - แก้โดยใช้ `${REDIS_PASSWORD}` syntax

6. **BullMQ metrics Gauge.set() signature:**
   - prom-client v15+ ใช้ `set(labels, value)` ไม่ใช่ `set(value, labels)`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure/docker-compose.yml` | เพิ่ม `redis-exporter` (port 9121) + `elasticsearch-exporter` (port 9114); แก้ env var interpolation `${VAR}` แทน `$(VAR)`; แก้ ES exporter flags สำหรับ v1.7.0 |
| `backend/src/modules/monitoring/services/bullmq-metrics.service.ts` | ไฟล์ใหม่ — BullMQ queue metrics service (6 gauges × 6 queues = 36 series); อัปเดตทุก 30s; ใช้ `set({labels}, value)` signature |
| `backend/src/modules/monitoring/monitoring.module.ts` | เพิ่ม `BullmqMetricsService` + `bullmqMetricProviders` |
| `backend/src/modules/ai/ai.module.ts` | Export `BullModule` สำหรับ MonitoringModule inject queue metrics |
| Prometheus config (`/volume1/np-dms/monitoring/prometheus/config/prometheus.yml` บน ASUSTOR) | เพิ่ม 2 scrape jobs: `redis` → `192.168.10.11:9121`, `elasticsearch` → `192.168.10.11:9114` |
| Grafana (API) | ลบ 3 dashboards ที่ใช้ไม่ได้; สร้าง 4 dashboards ใหม่; แก้ MariaDB datasource url `192.168.10.8` → `192.168.10.11`; ลบ data sources ที่ไม่ใช้ 2 ตัว (Elasticsearch, MySQL) |

## กฎที่ Lock แล้ว

- **Grafana dashboard refresh:** ตั้ง `30s` เสมอ — match กับ scrape interval ที่ช้าที่สุด (Ollama 30s); อย่าตั้ง 10s เพราะจะดึงข้อมูลเดิมซ้ำ
- **Grafana dashboard refresh ≠ data collection:** dashboard refresh ทำงานเฉพาะตอน browser เปิดอยู่; Prometheus scrape ทุก 15s/30s อัตโนมัติเสมอ
- **Docker-compose env var interpolation:** ใน `command:` แบบ list ต้องใช้ `${VAR}` ไม่ใช่ `$(VAR)` — `$(VAR)` จะถูกส่งเป็น literal string
- **prom-client Gauge.set() signature:** `set(labels: LabelValues, value: number)` — labels ก่อน value
- **Template variable สำหรับ dashboards ที่มีหลาย exporters:** ใช้ `host` label ร่วมกัน แทน `instance` (คนละ port = คนละ instance)

## Grafana Dashboards สถานะสุดท้าย (9 ตัว)

| ID | Title | Panels | Metrics ที่ครอบคลุม |
| --- | --- | --- | --- |
| 18 | Data Center Overview (Loki + Prometheus) | 7 | Logs + CPU/Memory |
| 19 | Galera/MariaDB - Overview | 13 | `mysql_*` (837) |
| 9 | Host Monitoring (Node Exporter) | 15 | `node_*` (306) |
| 22 | LCBP3 — Ollama & NVIDIA GPU | 13 | `ollama_*` (3) + `nvidia_*` (101) |
| 23 | LCBP3 — Docker Containers & Host | 12 | `container_*` (53) + `node_*` |
| 24 | LCBP3 — Redis | 15 | `redis_*` (177) |
| 25 | LCBP3 — Elasticsearch | 15 | `elasticsearch_*` (223) |
| 26 | LCBP3 — BullMQ Queues | 12 | `bullmq_*` (รอ redeploy) + `workflow_*` (1) |
| 27 | LCBP3 — Backend API & Node.js Health | 20 | `http_*` (4) + `nodejs_*` (23) + `process_*` (12) |

## Prometheus Targets สถานะสุดท้าย (13 ตัว)

- **11 UP:** prometheus, asustor-node, asustor-cadvisor, main-server-node, main-server-cadvisor, backend, mariadb, ollama-metrics, nvidia-gpu, redis, elasticsearch
- **2 DOWN:** qnap-node, qnap-cadvisor (QNAP ไม่มี exporters แล้ว — expected post-ADR-041)

## Verification

- [x] `tsc --noEmit` (backend) — exit 0 หลังเพิ่ม BullmqMetricsService
- [x] Redis exporter — `redis_up=1`, 177 metrics ตอบกลับ
- [x] ES exporter — `elasticsearch_cluster_health_status` ตอบกลับ, 223 metrics
- [x] Prometheus targets — 11/13 UP
- [x] Grafana dashboards — 9 ตัว uploaded สำเร็จ (status=success)
- [x] Grafana data sources — 3 ตัว (Prometheus default, Loki, MariaDB url แก้แล้ว)
- [ ] **Pending:** Redeploy backend เพื่อ expose `bullmq_*` metrics ผ่าน `/metrics` endpoint (code พร้อม แต่ยังไม่ได้ build/deploy)
