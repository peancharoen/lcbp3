# Drawing Revision Schema Update

**วันที่:** 25 ธันวาคม 2568 (2025-12-25)
**Session:** Drawing Revision Schema Consistency Update

---

## 🎯 วัตถุประสงค์

ปรับปรุง schema ของตาราง Drawing (Shop Drawing และ As Built Drawing) ให้สอดคล้องกับ pattern ของตาราง revision อื่นๆ ในระบบ (เช่น `correspondence_revisions`, `rfa_revisions`)

---

## 📝 การเปลี่ยนแปลง

### 1. Schema Updates (`lcbp3-v1.7.0-schema.sql`)

#### 1.1 เพิ่ม Columns ใน `shop_drawing_revisions`

```sql
is_current BOOLEAN DEFAULT NULL COMMENT '(TRUE = Revision ปัจจุบัน, NULL = ไม่ใช่ปัจจุบัน)'
created_by INT COMMENT 'ผู้สร้าง'
updated_by INT COMMENT 'ผู้แก้ไขล่าสุด'
```

- เพิ่ม Foreign Keys สำหรับ `created_by` และ `updated_by` ไปยัง `users` table
- เพิ่ม `UNIQUE KEY uq_sd_current (shop_drawing_id, is_current)` เพื่อ enforce ว่ามี `is_current = TRUE` ได้แค่ 1 row ต่อ drawing

#### 1.2 เพิ่ม Columns ใน `asbuilt_drawing_revisions`

- เหมือนกับ `shop_drawing_revisions`

#### 1.3 เปลี่ยน Unique Constraint ของ `drawing_number`

- **เดิม:** `UNIQUE (drawing_number)` - Global uniqueness
- **ใหม่:** `UNIQUE (project_id, drawing_number)` - Project-scoped uniqueness

### 2. Views เพิ่มใหม่

```sql
-- View สำหรับ Shop Drawing พร้อม Current Revision
CREATE OR REPLACE VIEW vw_shop_drawing_current AS ...

-- View สำหรับ As Built Drawing พร้อม Current Revision
CREATE OR REPLACE VIEW vw_asbuilt_drawing_current AS ...
```

**ประโยชน์:**

- Query ง่ายขึ้นโดยไม่ต้อง JOIN ทุกครั้ง
- ตัวอย่าง: `SELECT * FROM vw_shop_drawing_current WHERE project_id = 3`

### 3. Seed Data Updates (`lcbp3-v1.7.0-seed-shopdrawing.sql`)

เพิ่ม UPDATE statement ท้ายไฟล์เพื่อ set `is_current = TRUE` สำหรับ revision ล่าสุดของแต่ละ drawing:

```sql
UPDATE shop_drawing_revisions sdr
JOIN (
  SELECT shop_drawing_id, MAX(revision_number) AS max_rev
  FROM shop_drawing_revisions
  GROUP BY shop_drawing_id
) latest ON sdr.shop_drawing_id = latest.shop_drawing_id
        AND sdr.revision_number = latest.max_rev
SET sdr.is_current = TRUE;
```

---

## 🔧 เหตุผลทางเทคนิค

### ทำไมใช้ `DEFAULT NULL` แทน `DEFAULT FALSE`?

MariaDB/MySQL ไม่อนุญาตให้มี duplicate values ใน UNIQUE constraint รวมถึง `FALSE` หลายตัว:

| `is_current` | ความหมาย          | อนุญาตหลายแถว?                  |
| ------------ | ----------------- | ------------------------------- |
| `TRUE`       | Revision ปัจจุบัน | ❌ ไม่ได้ (UNIQUE)              |
| `NULL`       | Revision เก่า     | ✅ ได้ (NULL ignored in UNIQUE) |
| `FALSE`      | Revision เก่า     | ❌ ไม่ได้ (จะซ้ำกัน)            |

---

## 📁 ไฟล์ที่แก้ไข

| ไฟล์                                                  | การเปลี่ยนแปลง                           |
| ----------------------------------------------------- | ---------------------------------------- |
| `specs/07-database/lcbp3-v1.7.0-schema.sql`           | เพิ่ม columns, views, และ constraints    |
| `specs/07-database/lcbp3-v1.7.0-seed-shopdrawing.sql` | เพิ่ม UPDATE statement สำหรับ is_current |

---

## ✅ สถานะ

- [x] Schema updated
- [x] Seed data updated
- [x] Views created
- [x] Backend entities/DTOs update
- [x] Frontend types update
