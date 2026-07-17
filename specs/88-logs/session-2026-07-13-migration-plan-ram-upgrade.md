# Session — 2026-07-13 (MIGRATION-PLAN RAM 64GB Upgrade)

## Summary

อัปเดต MIGRATION-PLAN.md ให้สอดคล้องกับ New Server ที่อัปเกรด RAM จาก 32GB → 64GB พร้อมดำเนินการจริงบน server (swap, my.cnf, PMA config, LVM expand, docker group)

## การเปลี่ยนแปลง (Changes)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/MIGRATION-PLAN.md` | D8: MariaDB 8G→16G, D9: ES heap 2G→4G, architecture diagram 32GB→64GB, RAM budget table ทั้งหมด (~33.5G→~55.8G), swap 8G→16G, my.cnf (log_file 1G, connections 300, thread_cache 64, tmp/heap 512M), MariaDB test expected value, Redis test threshold, RAM usage check threshold, risk table (OOM ต่ำ), Step 5 copy .env → --env-file ../.env, ลบ typo "หีกน", เพิ่ม nattanin ใน docker group, ubuntu-lv 100G→150G |

## การดำเนินการจริง (Server Actions)

| Action | Result |
| --- | --- |
| Swap resize 8G→16G | ✅ `swapoff → rm → fallocate 16G → mkswap → swapon` — Swap 15Gi active |
| `my.cnf` สร้างใหม่ | ✅ `/opt/np-dms/mariadb/my.cnf` — innodb_buffer_pool_size=16G, owner 999:999, mode 644 |
| PMA config | ✅ `/opt/np-dms/pma/config.user.inc.php` + `zzz-custom.ini` + `tmp/` — owner 33:33 |
| LVM expand | ✅ `ubuntu-lv` 100G→150G — root ใช้ 62% (เหลือ 54G) |
| Docker group | ✅ `nattanin` + `np-dms` เพิ่มใน docker group |

## กฎที่ Lock แล้ว

- Docker Compose deploy ใช้ `--env-file ../.env` (single source of truth) — ไม่ copy `.env` ไปทุก layer
- RAM budget 64GB: MariaDB 16G, ES 6G (heap 4G), Redis 4G, Qdrant 4G, Ollama 8G, Backend 2G, Frontend 3G — total ~55.8G, headroom ~8G
- Swap 16G = 25% ของ RAM 64GB (safety net, swappiness=10)
- `ubuntu-lv` 150G (ขยายจาก 100G เพราะเต็ม 94%)

## Verification

- [x] `free -h` — Swap 15Gi, RAM 60Gi
- [x] `df -h /` — 148G, 62% used
- [x] `cat /opt/np-dms/mariadb/my.cnf` — ครบถ้วน
- [x] `ls -la /opt/np-dms/pma/` — config + tmp ครบ
- [ ] MariaDB restart เพื่อให้ my.cnf ใหม่มีผล (หลัง deploy)
