# Session 2026-08-01 — Monitoring Dashboard Overhaul + cadvisor Fixes

## Summary

Overhaul Grafana "Data Center Overview (Loki + Prometheus)" dashboard จาก 7 panels → 45 panels พร้อมแก้ปัญหา cadvisor บนทั้งสองเซิร์ฟเวอร์ (main server + ASUSTOR) และ node-exporter filesystem visibility

## ปัญหาที่พบ (Root Cause)

### 1. node-exporter: ไม่เห็น host filesystem mounts
- **สาเหตุ:** ขาด `--path.rootfs=/rootfs` flag — node-exporter มองเห็นแค่ `/` เท่านั้น (1 mount) ไม่เห็น LVM volumes และ CIFS mounts
- **ผลกระทบ:** Dashboard ไม่สามารถแสดง disk usage ของ LVM volumes (mariadb, elasticsearch, qdrant, postgres, ollama) และ CIFS mounts ได้

### 2. Main server cadvisor: fsHandler.go errors
- **สาเหตุ:** Docker 29 ใช้ containerd-snapshotter สร้าง overlayfs rootfs path แบบ lazy — cadvisor stat ล้มเหลวตอน container (re)start เพราะ path ยังไม่ถูกสร้าง
- **ผลกระทบ:** 108 errors ใน log (ไม่กระทบ metrics แต่ noise ใน logs)

### 3. ASUSTOR cadvisor: Docker factory failed → ไม่มี container names/labels
- **สาเหตุ:** ASUSTOR Docker CE 28.1.1 เก็บ containerd socket ที่ `/var/run/docker/containerd/containerd.sock` ไม่ใช่ path มาตรฐาน `/run/containerd/containerd.sock` — cadvisor v0.55.1 มองหา path มาตรฐานจึงไม่เจอ ทำให้ Docker factory fail ทั้งหมด
- **ผลกระทบ:** Container names, labels, images หายหมด (ตกไปใช้ systemd/raw factory)
- **บทเรียน:** ตรวจสอบให้รอบคอบก่อนสรุปสาเหตุ — ใช้ `find / -name "containerd.sock"` ตั้งแต่แรกก็เจอ

### 4. Dashboard: host variable filter ซ่อน ASUSTOR
- **สาเหตุ:** Host variable query ใช้ `image!=""` filter แต่ ASUSTOR cadvisor (ตอน Docker factory fail) ไม่มี image label ทำให้ ASUSTOR หายจาก dropdown

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `np-dms-lcbp3/01-infrastructure/docker-compose.yml` | node-exporter: เพิ่ม `--path.rootfs=/rootfs` (เห็น 12 mounts แทน 1) |
| `np-dms-lcbp3/01-infrastructure/docker-compose.yml` | cadvisor: เพิ่ม `--disable_metrics=disk` (หยุด fsHandler errors) |
| `ASUSTOR/monitoring/docker-compose.yml` | cadvisor: v0.47.2 → v0.55.1 + `--containerd=/var/run/docker/containerd/containerd.sock` |
| `ASUSTOR/monitoring/docker-compose.yml` | cadvisor: เพิ่ม `/dev:/dev:ro` mount (แก้ btrfs stat warning) |
| `grafana/dashboards/lcbp3-docker-monitoring.json` | Full overhaul: 7 → 45 panels, เพิ่ม GPU/MariaDB/BullMQ/NestJS panels, migrate graph→timeseries, collapse logs |

## กฎที่ Lock แล้ว

- **D70:** cadvisor v0.55.1 บน ASUSTOR ต้องใช้ `--containerd=/var/run/docker/containerd/containerd.sock` เพราะ Docker CE เก็บ socket ที่ path ไม่มาตรฐาน
- **D71:** Dashboard variables ห้ามใช้ `image!=""` filter เพราะซ่อน hosts ที่ Docker factory fail — ใช้ `label_values(container_cpu_usage_seconds_total, host)` แทน
- **D72:** ตรวจสอบ root cause ให้รอบคอบก่อนสรุป — ใช้ `find` หาไฟล์/socket จริง อย่าตัดสินจาก error message อย่างเดียว

## Verification

- [x] node-exporter: 12 mounts visible (LVM + CIFS + /boot)
- [x] Main server cadvisor: 0 fsHandler errors after `--disable_metrics=disk`
- [x] ASUSTOR cadvisor: Docker factory registered, 14 container names visible
- [x] Dashboard: 45 panels, 3 variables (host/container/loglevel), version 8
- [x] Prometheus queries: all panel queries tested and return data
- [x] Committed: `4c7ae868` (skip ci)
