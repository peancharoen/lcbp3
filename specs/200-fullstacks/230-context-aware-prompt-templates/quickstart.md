# Quickstart Guide

**Feature**: Context-Aware Prompt Templates & Database Typo Cleanup
**Created**: 2026-05-27

---

## 1. Setup & Migration

รันสคริปต์ SQL Delta บนระบบ MariaDB เพื่ออัปเดตฐานข้อมูลและเตรียมข้อมูล Seed:

```powershell
# รันไฟล์ SQL Delta
# (ตรวจสอบให้แน่ใจว่าใช้ Credentials และ Port ที่ถูกต้องสำหรับ Environment ของคุณ)
mysql -u root -p -P 3307 lcbp3 < specs/03-Data-and-Storage/deltas/2026-05-27-add-context-aware-prompts-and-cleanup.sql
```

---

## 2. Running Verification Tests

ทำการรันชุดทดสอบเพื่อทดสอบการทำงานของ Backend Resolution และการสกัดค่าอย่างปลอดภัย:

```powershell
# รัน Type check
pnpm --filter backend build

# รัน AI Prompt unit tests
pnpm --filter backend test -- --testPathPattern=ai-prompts.service
```

---

## 3. Dynamic Prompt Sandbox Testing

1. ล็อกอินเข้าสู่ระบบผ่านหน้า **AI Admin Console** (https://lcbp3.np-dms.work/admin/ai หรือ URL ของ Localhost)
2. สลับไปที่ตัวเลือก **Active Prompt Version 2** (OCR Extraction ภาษาไทย)
3. ทดลองนำเข้าไฟล์เอกสารและดูผลลัพธ์การสกัดค่าในระดับ JSON Output
4. สังเกตช่องข้อมูลผู้รับ (Recipients) และระบบแนะนำ Tags ในหน้าจอการบันทึก
