# Quickstart: AI Engine Control Center (248-ai-engine-control-center)

**Feature**: `248-ai-engine-control-center`  
**Date**: 2026-08-24  
**Target Host**: `np-dms-lcbp3` (192.168.10.11)

---

## 1. Prerequisites & Container Setup

1. Verify `node-exporter` is declared in `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/docker-compose.yml`:
   ```yaml
   node-exporter:
     image: prom/node-exporter:v1.8.2
     container_name: np-dms-ai-node-exporter
     restart: unless-stopped
     ports:
       - "192.168.10.11:9100:9100"
     command:
       - '--path.procfs=/host/proc'
       - '--path.sysfs=/host/sys'
       - '--collector.filesystem.mount-points-exclude=^/(dev|proc|sys|var/lib/docker/.+|var/lib/containers/.+)($$|/)'
     volumes:
       - /proc:/host/proc:ro
       - /sys:/host/sys:ro
     deploy:
       resources:
         limits:
           cpus: '0.25'
           memory: 256M
     networks:
       - dms-ai-net
   ```

2. Test metrics endpoint on host:
   ```bash
   curl -s http://192.168.10.11:9100/metrics | head -n 20
   ```

---

## 2. Backend Verification

1. Check host metrics endpoint:
   ```bash
   curl -H "Authorization: Bearer <SUPERADMIN_TOKEN>" http://localhost:4000/api/ai/admin/host/metrics
   ```

2. Test Queue Jobs listing:
   ```bash
   curl -H "Authorization: Bearer <SUPERADMIN_TOKEN>" "http://localhost:4000/api/ai/admin/queues/ai-batch/jobs?status=failed&page=1&limit=10"
   ```

3. Test Model VRAM Load/Unload:
   ```bash
   # Load model
   curl -X POST -H "Authorization: Bearer <SUPERADMIN_TOKEN>" http://localhost:4000/api/ai/admin/models/np-dms-ai/vram/load

   # Unload model
   curl -X POST -H "Authorization: Bearer <SUPERADMIN_TOKEN>" http://localhost:4000/api/ai/admin/models/np-dms-ai/vram/unload
   ```

---

## 3. Frontend Verification

1. Navigate to `http://localhost:3000/admin/ai/system`
2. Verify Host Metrics Card renders CPU %, RAM %, and CPU Temperature with Sparkline trend graphs.
3. Verify Ollama Engine card renders combined table with Load/Unload actions.
4. Click on any Queue Card (e.g. `ai-batch`) to verify the slide-over Sheet opens, showing job list and Clear Failed button.
