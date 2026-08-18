# Quickstart: Tag Color Palette Picker

**Feature**: `243-tag-color-palette`
**Date**: 2026-08-18

---

## Pre-requisites

- [ ] Backend running: `pnpm --filter backend dev`
- [ ] Frontend running: `pnpm --filter frontend dev`
- [ ] MariaDB running with SQL delta applied
- [ ] Logged in as admin with `master_data.tag.manage` permission

---

## Step 1: Apply SQL Delta (Commit 1)

```sql
-- Run in MariaDB:
SOURCE specs/03-Data-and-Storage/deltas/2026-08-18-tag-color-palette-key.sql;

-- Verify: ไม่มี tag เหลือที่มีสีนอก palette
SELECT color_code, COUNT(*) AS cnt FROM tags GROUP BY color_code;
-- Expected: เห็นเฉพาะ 14 palette key (ส่วนใหญ่จะเป็น 'default')
```

---

## Step 2: Verify Backend Validation (Commit 2)

```bash
# ควรถูกปฏิเสธ — colorCode นอก palette
curl -X POST http://localhost:3001/api/master/tags \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"tagName": "test-invalid-color", "colorCode": "#ff0000"}'
# Expected: 400 Bad Request — "colorCode must be one of the following values: ..."

# ควรสำเร็จ — colorCode เป็น palette key ที่ถูกต้อง
curl -X POST http://localhost:3001/api/master/tags \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"tagName": "test-red-tag", "colorCode": "red"}'
# Expected: 201 Created, response.colorCode === "red"

# ไม่ระบุ colorCode — ควรได้ 'default'
curl -X POST http://localhost:3001/api/master/tags \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"tagName": "test-default-tag"}'
# Expected: 201 Created, response.colorCode === "default"
```

ทดสอบซ้ำกับ `/api/tags` (path ที่ n8n/tag-manager ใช้) — ต้องได้ผลเดียวกัน

---

## Step 3: Verify Frontend UI (Commit 3)

1. เปิด `http://localhost:3000/admin/doc-control/reference/tags`
2. คลิก "Add New Tag"
3. **ตรวจสอบ**: เห็นตาราง 14 swatch สีแสดงพร้อมกัน (ไม่ต้องคลิกเปิดเพิ่ม)
4. **ตรวจสอบ**: สี "Default" ถูกไฮไลต์เป็นค่าตั้งต้น พร้อมข้อความ "Selected: Default"
5. คลิกเลือกสี "Red" — **ตรวจสอบ**: swatch สีแดงถูกไฮไลต์ ข้อความเปลี่ยนเป็น "Selected: Red"
6. กรอกชื่อ tag เช่น "TEST-QUICKSTART" แล้วกด "Add Tag"
7. **ตรวจสอบ**: tag ใหม่ปรากฏในรายการพร้อม dot สีแดงหน้าชื่อ tag
8. เปิดเอกสาร Correspondence ใดๆ แล้วเพิ่ม tag "TEST-QUICKSTART" ผ่าน Tag Manager
9. **ตรวจสอบ**: badge ของ tag บนหน้ารายละเอียด Correspondence แสดงเฉดสีแดงเดียวกันกับในหน้า admin

---

## Step 4: Verify Legacy Data Handling

```sql
-- จำลอง tag เดิมที่มีสี hex ก่อน rollout (สำหรับทดสอบ regression เท่านั้น — ห้ามรันใน production)
INSERT INTO tags (public_id, tag_name, color_code) VALUES (UUID(), 'legacy-hex-tag', '#00ff00');

-- รัน delta ซ้ำ
SOURCE specs/03-Data-and-Storage/deltas/2026-08-18-tag-color-palette-key.sql;

-- ตรวจสอบว่าถูกแปลงเป็น default
SELECT tag_name, color_code FROM tags WHERE tag_name = 'legacy-hex-tag';
-- Expected: color_code = 'default'
```

เปิดหน้า admin ตรวจว่า `legacy-hex-tag` แสดงสี Default โดยไม่มี error, และแก้ไขเลือกสีใหม่ได้ตามปกติ

---

## Rollback

```sql
-- Delta นี้ไม่สามารถ rollback ค่าสีเดิมได้ (ข้อมูล hex เดิมถูกทับด้วย 'default' แล้ว)
-- หากต้อง rollback validation ฝั่ง backend: revert commit 2 (ลบ @IsIn ออกจาก DTO ทั้งสอง)
-- schema column ไม่เปลี่ยน type จึงไม่ต้อง rollback schema
```
