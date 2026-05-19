---
auto_execution_mode: 0
description: Manual real-app verification — ตรวจแอปจริงหลัง build pass เพื่อยืนยันว่าทำงานถูกต้องใน environment จริง (ไม่ใช่แค่ unit test)
---

# Workflow: check-real-app

ใช้เมื่อ build/lint/test ผ่านแล้ว แต่ต้องการยืนยันว่าแอปจริงทำงานถูกต้อง
เน้นการตรวจที่ unit test ตรวจไม่ได้: UI flow, API response จริง, console errors, network requests

## ขั้นตอน

### 1. เริ่ม Dev Server (ถ้ายังไม่รัน)

ตรวจก่อนว่ามี dev server รันอยู่แล้วหรือไม่ เพื่อป้องกันรันซ้ำ:

```bash
# Backend
pnpm --filter backend run start:dev

# Frontend
pnpm --filter frontend run dev
```

### 2. ตรวจ Endpoint / หน้าที่เปลี่ยน

- เปิด URL ที่เกี่ยวข้องกับงานที่เพิ่ง implement
- ตรวจ API endpoint ด้วย curl หรือ browser dev tools
- ดู network tab ว่า request/response ถูกต้อง

```bash
# ตัวอย่างตรวจ API จริง
curl -X GET http://localhost:3001/api/[endpoint] \
  -H "Authorization: Bearer <token>" | jq .
```

### 3. ตรวจ Console / Log

- **Frontend**: เปิด browser DevTools → Console tab — ต้องไม่มี error หรือ warning ที่ไม่คาดเดา
- **Backend**: ดู terminal log — ตรวจว่าไม่มี unhandled exception หรือ SQL error

### 4. ตรวจ Happy Path + Edge Case หลัก

ตรวจ flow ที่เกี่ยวข้องอย่างน้อย:
- [ ] Happy path ทำงานถูกต้อง
- [ ] Input ผิดรูปแบบ → แสดง error message ที่เหมาะสม
- [ ] Unauthorized access → redirect/403 ถูกต้อง
- [ ] หน้าที่ไม่ได้แก้ยังทำงานปกติ (regression check)

### 5. ตรวจ NAP-DMS Specific

- [ ] UUID ใน URL และ response เป็น string format ถูกต้อง (ไม่ใช่ integer)
- [ ] ไม่มี `NaN` หรือ `undefined` ใน form values หรือ API payload
- [ ] Thai/English text แสดงผลถูกต้อง (i18n)
- [ ] RBAC: role ที่ไม่มีสิทธิ์ไม่เห็น/เข้าถึงไม่ได้

## 🚫 No Fake Evidence Rule

> **ห้ามรายงานว่าตรวจแอปจริงแล้ว ถ้าไม่ได้เปิดแอปและตรวจจริง**
> ถ้าตรวจไม่ได้ (เช่น ไม่มี DB, ไม่มี token) ให้ระบุเหตุผลชัดเจน

## ✅ Mandatory Output

รายงานท้ายงานต้องมีครบ:

### Commands run
```
✅ curl GET /api/correspondences   → 200 OK, returned 3 records
✅ curl POST /api/correspondences  → 201 Created, uuid: "019..."
❌ ไม่ได้ตรวจ: file upload flow   → เหตุผล: ต้องการ ClamAV service ที่ไม่มีใน local
```

### Evidence
- URL ที่ตรวจ + HTTP status code
- Screenshot หรือ response body (ถ้า sensitive ให้ mask)
- Console log ที่พบ (ถ้ามี error ต้องระบุ)

### Limitations / Risks
- flow หรือ endpoint ที่ยังไม่ได้ตรวจ + เหตุผล
- ความเสี่ยงที่ควรตรวจใน staging ก่อน deploy

### Next steps
- งานที่ต้องทำต่อ หรือ flag สำหรับ QA
