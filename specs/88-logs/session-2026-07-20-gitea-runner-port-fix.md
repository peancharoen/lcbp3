# Session — 2026-07-20 (Gitea Runner Port Fix)

## Summary

แก้ Gitea Actions runner บน ASUSTOR ที่ connect ไป `192.168.10.11:443` (HTTPS) ซึ่งไม่มีอะไรรับ — หลังจาก Gitea ย้ายไป New Server ที่ `192.168.10.11:3003` (HTTP only)

## ปัญหาที่พบ (Root Cause)

Gitea ย้ายจาก QNAP (NPM proxy HTTPS:443) ไป New Server `192.168.10.11:3003` (HTTP) ตาม ADR-041 แต่ Gitea Actions runner บน ASUSTOR ยังใช้ค่าเดิม:

- `GITEA_INSTANCE_URL=https://git.np-dms.work` (port 443)
- `extra_hosts: git.np-dms.work→192.168.10.8` (QNAP NPM)

เมื่อ `extra_hosts` ถูกเปลี่ยนเป็น `192.168.10.11` แต่ URL ยังเป็น HTTPS — runner จึง connect ไป `192.168.10.11:443` ซึ่งไม่มีอะไรรับ (connection refused)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/gitea-runner/docker-compose.yml` | `extra_hosts` เปลี่ยนจาก `192.168.10.8` (QNAP NPM) เป็น `192.168.10.11` (Gitea direct) + เพิ่ม comment อธิบาย |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/gitea-runner/.env.example` | `GITEA_INSTANCE_URL` เปลี่ยนจาก `https://git.np-dms.work` เป็น `http://git.np-dms.work:3003` |

## กฎที่ Lock แล้ว

- Gitea runner เชื่อมตรงไป Gitea ที่ `192.168.10.11:3003` (HTTP) ไม่ผ่าน NPM
- ถ้า restart แล้วยังขึ้น port 443 ต้องลบ `.runner` cache file ใน `/volume1/np-dms/gitea-runner/data/.runner` แล้ว start ใหม่

## Verification

- [ ] SSH เข้า ASUSTOR แก้ `.env` จริง: `GITEA_INSTANCE_URL=http://git.np-dms.work:3003`
- [ ] ลบ `.runner` cache: `rm /volume1/np-dms/gitea-runner/data/.runner`
- [ ] Restart: `docker compose down && docker compose up -d`
- [ ] ตรวจ logs: `docker logs gitea-runner --tail 30` — ไม่มี error `connection refused`
