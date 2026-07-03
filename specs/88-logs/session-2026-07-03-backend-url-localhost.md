# Session — 2026-07-03 (Backend URL Migration + localhost Support)

## Summary

ตรวจสอบผลกระทบจากการเปลี่ยน `backend.np.dms.work` เป็น `192.168.10.11` และเพิ่ม `localhost` support สำหรับเข้าถึง backend/frontend บน server เครื่องเดียวกันได้

## ปัญหาที่พบ (Root Cause)

1. **Residual domain references:** `deploy.sh` และ `rollback.sh` ยังมี default fallback URL เป็น `https://backend.np-dms.work/api` (ถ้า .env ไม่มีค่าจะใช้ค่าเดิมที่ผิด)
2. **Port binding จำกัด:** Docker compose binding ไว้ที่ `192.168.10.11:3000:3000` และ `192.168.10.11:3001:3000` ทำให้ `localhost`/`127.0.0.1` เข้าไม่ถึง
3. **CORS ไม่รองรับ localhost:** `CORS_ORIGIN` มีแค่ `http://192.168.10.11:3001` ไม่มี localhost
4. **CSP ไม่รองรับ localhost:** `proxy.ts` fallback มีแค่ `http://192.168.10.11:3000`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `scripts/deploy.sh:20` | default `API_URL` → `http://192.168.10.11:3000/api` |
| `scripts/rollback.sh:15` | default `API_URL` → `http://192.168.10.11:3000/api` |
| `specs/.../03-application/docker-compose.yml:148,198` | port binding → `0.0.0.0:3000:3000` และ `0.0.0.0:3001:3000` |
| `specs/.../np-dms-lcbp3/.env:74` | `CORS_ORIGIN` + `http://localhost:3001,http://127.0.0.1:3001` |
| `specs/.../np-dms-lcbp3/.env.template:72` | เช่นเดียวกัน |
| `specs/.../03-application/.env:74` | เช่นเดียวกัน |
| `frontend/proxy.ts:85` | CSP fallback + `http://localhost:3000` |

## สิ่งที่ไม่ต้องเปลี่ยน

- **`AUTH_URL`** — `AUTH_TRUST_HOST=true` ทำให้ NextAuth ใช้ host จาก request แบบ dynamic
- **`INTERNAL_API_URL`** — ใช้ Docker internal DNS (`http://backend:3000/api`)
- **`OLLAMA_API_URL`** — `http://192.168.10.11:11434` เป็น host IP สำหรับ systemd service
- **Email addresses** (`no-reply@np-dms.work`, `support@np-dms.work`) — เป็น email domain ไม่ใช่ server URL
- **`login.dto.ts` example** — Swagger example only

## กฎที่ Lock แล้ว

- Docker port binding ใช้ `0.0.0.0` เพื่อให้เข้าได้ทั้ง LAN IP และ localhost
- `CORS_ORIGIN` ต้องมีทั้ง `http://192.168.10.11:3001` และ `http://localhost:3001,http://127.0.0.1:3001`
- CSP `connect-src` fallback ต้องมีทั้ง IP และ localhost

## Verification

- [ ] Restart application stack: `docker compose --env-file /opt/np-dms/.env -f /opt/np-dms/03-application/docker-compose.yml up -d --force-recreate`
- [ ] ทดสอบเข้าผ่าน `http://192.168.10.11:3001` (LAN)
- [ ] ทดสอบเข้าผ่าน `http://localhost:3001` (local)
- [ ] ทดสอบ API ผ่าน `http://localhost:3000/api` (ไม่มี CORS error)
