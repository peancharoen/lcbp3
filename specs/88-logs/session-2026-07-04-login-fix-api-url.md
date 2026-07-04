# Session — 2026-07-04 (Login Fix + API URL Migration + Deploy.sh grep bug)

## Summary

ตรวจสอบและแก้ปัญหา login จาก frontend ไม่ได้ เนื่องจาก `NEXT_PUBLIC_API_URL` ยังชี้ไป `https://backend.np-dms.work/api` ซึ่งไม่เป็น public แล้ว พบและแก้ bug ใน `deploy.sh` ที่ทำให้ grep อ่านค่าผิดจาก comment lines.

## ปัญหาที่พบ (Root Cause)

### 1. NEXT_PUBLIC_API_URL ชี้ไป domain ที่ไม่ public แล้ว
- `backend.np-dms.work` ไม่ได้เป็น public domain แล้ว ต้องใช้ IP ภายใน `192.168.10.11:3000`
- `NEXT_PUBLIC_*` เป็น build-time variable ที่ bake ลง client bundle ต้อง rebuild image

### 2. deploy.sh grep bug (Critical)
- `grep NEXT_PUBLIC_API_URL "$ENV_FILE"` จะ match ทั้งบรรทัด comment ที่มีคำนี้อยู่
- ใน `.env` มี comment: `# - Change NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api to NEXT_PUBLIC_API_URL=http://192.168.10.11:3000/api`
- `cut -d '=' -f2` บน comment ได้ค่าผิด: `https://backend.np-dms.work/api to NEXT_PUBLIC_API_URLhttp://192.168.10.11:3000/api`
- ส่งผลให้ frontend build ด้วย URL ที่ผิดเพี้ยน → `ERR_NAME_NOT_RESOLVED`

### 3. CORS_ORIGIN ไม่ได้ตั้ง
- Backend `main.ts` มี `origin: configService.get<string>('CORS_ORIGIN') || true` แตไม่มี `CORS_ORIGIN` ใน .env

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `.env.template:79` | `NEXT_PUBLIC_API_URL` → `http://192.168.10.11:3000/api` |
| `.env.template:72` | เพิ่ม `CORS_ORIGIN=http://192.168.10.11:3001` |
| `03-application/docker-compose.yml:188` | `NEXT_PUBLIC_API_URL` → `http://192.168.10.11:3000/api` |
| `03-application/docker-compose.yml:118` | เพิ่ม `CORS_ORIGIN` ใน backend environment |
| `frontend/Dockerfile:66` | `ARG NEXT_PUBLIC_API_URL` → `http://192.168.10.11:3000/api` |
| `frontend/.env.example:2` | อัปเดต default URL |
| `frontend/proxy.ts:85` | CSP `connect-src` default → `http://192.168.10.11:3000` |
| `scripts/deploy.sh:30-33` | `grep` → `grep -E '^VAR_NAME='` เพื่อ match เฉพาะ variable assignments ไม่ใช่ comments |

## กฎที่ Lock แล้ว

- **D35:** `deploy.sh` grep ต้องใช้ `grep -E '^VAR_NAME='` เพื่อ match เฉพาะบรรทัดที่ขึ้นต้นด้วยชื่อ variable จริงๆ ไม่ใช่ comment lines ที่มีชื่อ variable อยู่ในนั้น
- **D36:** `NEXT_PUBLIC_API_URL` เปลี่ยนจาก `https://backend.np-dms.work/api` เป็น `http://192.168.10.11:3000/api` เนื่องจาก domain ไม่เป็น public แล้ว ต้อง rebuild frontend image เพื่อให้ค่าใหม่ bake ลง client bundle

## Verification

- [x] Commit สำเร็จ (`b8127f23` → main ทั้ง Gitea และ GitHub)
- [ ] CI deploy สำเร็จ (รอ Gitea CI pipeline)
- [ ] Frontend สามารถ login ได้หลัง rebuild
- [ ] `curl http://192.168.10.11:3000/health` ตอบ 200
- [ ] `curl http://192.168.10.11:3001/` ตอบ 200
