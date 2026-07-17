# Session — 2026-07-15 (Redis + Elasticsearch Expose for Uptime Kuma)

## Summary

Expose Redis และ Elasticsearch port ให้ Uptime Kuma ที่ ASUSTOR (192.168.10.9) monitor ได้ผ่าน VLAN 10 โดยเปลี่ยน binding จาก loopback/internal เป็น `192.168.10.11`

## การเปลี่ยนแปลง (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure/docker-compose.yml` | Redis: `127.0.0.1:6379` → `192.168.10.11:6379`; ES: `expose: 9200` → `ports: 192.168.10.11:9200:9200`; อัปเดต security comments |
| `/opt/np-dms/01-infrastructure/docker-compose.yml` | User copy การเปลี่ยนแปลงเดียวกันไปยัง production runtime file |

## รายละเอียด

### Redis (`cache` service)
- เดิม: `ports: '127.0.0.1:6379:6379'` (loopback only)
- ใหม่: `ports: '192.168.10.11:6379:6379'` (bind ตาม IP — Uptime Kuma @ ASUSTOR เข้าถึงได้)

### Elasticsearch (`search` service)
- เดิม: `expose: '9200'` (Docker internal only — ไม่มี host port)
- ใหม่: `ports: '192.168.10.11:9200:9200'` (bind ตาม IP — Uptime Kuma @ ASUSTOR เข้าถึงได้)

### Uptime Kuma Monitor Config
- Redis: TCP ping ที่ `192.168.10.11:6379` (ใช้ Redis password สำหรับ auth check)
- Elasticsearch: HTTP `GET /_cluster/health` ที่ `192.168.10.11:9200` (user: `elastic`)

## กฎที่ Lock แล้ว

- Redis และ ES bind ตาม IP `192.168.10.11` (ไม่ใช่ `0.0.0.0`) เพื่อจำกัดการเข้าถึงเฉพาะ VLAN 10
- Qdrant ยังคง internal only (ไม่ expose)

## Verification

- [ ] Recreate containers: `docker compose -p lcbp3-infra up -d cache search`
- [ ] ทดสอบจาก ASUSTOR: `redis-cli -h 192.168.10.11 -p 6379 -a <password> ping` → PONG
- [ ] ทดสอบจาก ASUSTOR: `curl -u elastic:<password> http://192.168.10.11:9200/_cluster/health` → JSON response
- [ ] Uptime Kuma เพิ่ม monitor ทั้งสอง services และยืนยัน status UP
