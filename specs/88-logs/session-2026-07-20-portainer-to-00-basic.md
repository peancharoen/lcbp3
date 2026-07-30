# Session — 2026-07-20 (Portainer ย้ายไป 00-basic + copy-env/dockerup update)

## Summary

ย้าย Portainer จาก `01-infrastructure/docker-compose.yml` ไปที่ `00-basic/docker-compose.yml` เพื่อแยก Docker management UI ออกจาก infrastructure services และอัปเดต `copy-env.sh` + `dockerup.sh` ให้รองรับ layer ใหม่

## การเปลี่ยนแปลง (Changes)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/00-basic/docker-compose.yml` | แก้ไข file header ให้ถูกต้อง (Layer 0: Basic), เปลี่ยน compose project name เป็น `lcbp3-basic`, เพิ่ม Portainer service พร้อม `portainer_data` volume |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure/docker-compose.yml` | ลบ Portainer service, ลบ `portainer_data` volume, ลบ security comment บรรทัด Portainer |
| `/opt/np-dms/copy-env.sh` | เพิ่ม copy `00-basic/docker-compose.yml` ไป `/opt/np-dms/00-basic/` |
| `/opt/np-dms/dockerup.sh` | เพิ่ม `cd /opt/np-dms/00-basic` เป็น step แรก (start ก่อน infrastructure) + change log |

## กฎที่ Lock แล้ว

- **00-basic layer** = Docker management (Portainer) — start ก่อน infrastructure
- **01-infrastructure layer** = data stores + monitoring exporters (MariaDB, PMA, Redis, ES, Qdrant, node-exporter, cAdvisor, mariadb-exporter)
- node-exporter, cAdvisor, mariadb-exporter **ยังอยู่ใน 01-infrastructure** (ไม่ย้ายตาม) เพราะ `mariadb-exporter` ต้องมี `depends_on: mariadb` ซึ่งทำงานได้เฉพาะใน compose project เดียวกัน

## Verification

- [ ] `copy-env.sh` รันสำเร็จ — ไฟล์ `00-basic/docker-compose.yml` ถูก copy ไป `/opt/np-dms/00-basic/`
- [ ] `dockerup.sh` รันสำเร็จ — Portainer start ก่อน infrastructure
- [ ] `docker ps` แสดง container `portainer` รันปกติ
- [ ] Portainer UI เข้าได้ที่ `https://portainer.np-dms.work` หรือ `https://192.168.10.11:9443`
