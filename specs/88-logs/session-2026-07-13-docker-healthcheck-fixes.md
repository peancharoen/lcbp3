# Session 2026-07-13 — Docker Healthcheck Fixes

## Summary

แก้ healthcheck ที่ไม่ผ่านสำหรับ 2 containers: `search` (Elasticsearch) และ `ollama-metrics` (Ollama Prometheus sidecar) — ทั้งคู่รันได้ปกติจริง แต่ healthcheck config ผิดพลาด

## ปัญหาที่พบ (Root Cause)

### 1. Elasticsearch (`search`) — unhealthy (152 failing streak)

- `xpack.security.enabled: 'true'` บังคับให้ต้อง auth ทุก request
- healthcheck ใช้ `curl -s http://localhost:9200/_cluster/health` โดยไม่ส่ง credentials
- Elasticsearch ตอบ HTTP 401 → grep ไม่ match → healthcheck fail
- สถานะจริง: `yellow` (ปกติสำหรับ single-node ที่มี unassigned replica shards)

### 2. ollama-metrics — unhealthy (160 failing streak)

- Image `ghcr.io/norskhalenett/ollama-metrics:latest` เป็น distroless (มีเฉพาะ binary `/main`)
- ไม่มี shell, wget, curl หรือแม้แต่ `/bin/sh`
- healthcheck ใช้ `["CMD", "wget", "--spider", "-q", ...]` → `exec: "wget": executable file not found in $PATH`
- สถานะจริง: HTTP 200 ที่ `:9924/metrics` (Prometheus metrics ไหลปกติ)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `/opt/np-dms/01-infrastructure/docker-compose.yml:194` | เพิ่ม `-u elastic:"$$ELASTIC_PASSWORD"` ใน healthcheck curl command |
| `/opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure/docker-compose.yml:194` | เพิ่ม `-u elastic:"$$ELASTIC_PASSWORD"` ใน healthcheck curl command (spec copy) |
| `/opt/np-dms-lcbp3/specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/service/docker-compose.yml:122` | เพิ่ม `-u elastic:"$$ELASTIC_PASSWORD"` ใน healthcheck curl command (QNAP spec) |
| `/opt/np-dms/04-ai/ocr-sidecar/docker-compose.yml:123-126` | เปลี่ยน healthcheck เป็น `disable: true` เพราะ distroless image ไม่มี shell/wget/curl; ใช้ Prometheus scraping เป็น external monitoring แทน |

## กฎที่ Lock แล้ว

- **D37:** Elasticsearch healthcheck ต้องส่ง `-u elastic:"$$ELASTIC_PASSWORD"` เมื่อ `xpack.security.enabled: 'true'` — ไม่งั้นได้ 401 และ healthcheck fail
- **D38:** Distroless images (เช่น ollama-metrics) ไม่สามารถใช้ CMD/CMD-SHELL healthcheck ได้ — ให้ `disable: true` และใช้ external monitoring (Prometheus scraping) แทน

## Verification

- [x] `docker ps --filter "name=search"` → `Up (healthy)`
- [x] `docker ps --filter "name=ollama-metrics"` → `Up` (no unhealthy label)
- [x] `curl http://192.168.10.11:9924/metrics` → HTTP 200 + Prometheus metrics ไหลปกติ
- [x] `docker exec search curl -s -u elastic:"$ELASTIC_PASSWORD" http://localhost:9200/_cluster/health` → `"status":"yellow"`
