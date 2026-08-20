# Session 2026-08-20 — UUID Column Comments v1/v7 Clarification

## Summary

อัปเดต COLUMN_COMMENT ของ `uuid`/`public_id` ทุกตาราง (37 คอลัมน์) ใน database `lcbp3` และไฟล์ spec ที่เกี่ยวข้อง เพื่อระบุ UUIDv1/v7 ชัดเจนตาม ADR-019 แก้ปัญหาสับสนจากคำอธิบายเดิม "UUID Public Identifier (ADR-019)" ที่ไม่ระบุเวอร์ชัน

## ปัญหาที่พบ (Root Cause)

Data Dictionary (`03-01-data-dictionary.md`) และ Schema SQL (`lcbp3-v1.9.0-schema-02-tables.sql`) ใช้คำอธิบาย "UUID Public Identifier (ADR-019)" เดียวกันทุกคอลัมน์ โดยไม่ระบุว่าเป็น UUIDv1 หรือ UUIDv7 — ทำให้สับสนเพราะ:

1. `DEFAULT UUID()` ของ MariaDB สร้าง UUIDv1 (ไม่ใช่ v7)
2. NestJS `@BeforeInsert() → uuidv7()` สร้าง UUIDv7 และ override default
3. ดังนั้น seed data = v1, runtime data = v7 ปนกันในคอลัมน์เดียวกัน
4. ผู้อ่านต้องเปิด ADR-019 เองเพื่อเข้าใจ — ไม่ self-documenting

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/03-Data-and-Storage/03-01-data-dictionary.md` | เพิ่มหมายเหตุรวมระดับ section (blockquote) + ระบุ UUIDv1/v7 ใน description ของคอลัมน์ uuid/public_id ทุกจุด (40 จุด) + ระบุ UUIDv4 สำหรับ workflow tables และ Qdrant chunk table |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | เพิ่ม header comment block อธิบาย UUID strategy + อัปเดต COMMENT ของคอลัมน์ uuid/public_id ทุกจุด (41 จุด) + ระบุ UUIDv4 สำหรับ workflow tables และ Qdrant chunk table |
| `specs/03-Data-and-Storage/deltas/2026-08-20-uuid-column-comments-v1-v7.sql` | สร้างใหม่ — SQL delta 35 ALTER TABLE statements (COMMENT-only, metadata change) |
| `2git.sh` | ตัด push ไป GitHub ออก (Gitea mirror แล้ว) — เปลี่ยนแปลงส่วนตัวของผู้ใช้ |

### รายละเอียด Comment ใหม่ (3 รูปแบบ)

| รูปแบบ | เงื่อนไข | Comment ใหม่ |
| --- | --- | --- |
| มี `DEFAULT UUID()` | 29 คอลัมน์ | `UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)` |
| ไม่มี DEFAULT | 1 คอลัมน์ (ai_prompts) | `UUIDv7 (NestJS @BeforeInsert, ADR-019) — app layer สร้างเสมอ (ไม่มี DB DEFAULT)` |
| TypeORM `@PrimaryGeneratedColumn('uuid')` | 4 คอลัมน์ (workflow + Qdrant) | `UUIDv4 (TypeORM @PrimaryGeneratedColumn(''uuid'') — ไม่ใช่ ADR-019 publicId)` |
| FK columns | 3 คอลัมน์ | ระบุ `UUIDv7 หรือ UUIDv1 ตามที่มาของ record` |

### Database Changes Applied

- Apply ผ่าน `docker exec -i mariadb mariadb -u center -p'***' lcbp3 < delta.sql`
- 35 ALTER TABLE ... MODIFY COLUMN (COMMENT-only)
- ไม่กระทบข้อมูล, index, PK, FK

## กฎที่ Lock แล้ว

- **D117**: UUID Column Comment Convention — คอลัมน์ `uuid`/`public_id` ที่มี `DEFAULT UUID()` ต้องระบุ "UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)"; คอลัมน์ที่ไม่มี DEFAULT ต้องระบุ "UUIDv7 (NestJS @BeforeInsert, ADR-019) — app layer สร้างเสมอ"; คอลัมน์ TypeORM `@PrimaryGeneratedColumn('uuid')` ต้องระบุ "UUIDv4 (ไม่ใช่ ADR-019 publicId)"; ห้ามใช้คำอธิบายกลาง "UUID Public Identifier (ADR-019)" อีก

## Verification

- [x] ไม่มี stale "UUID Public Identifier (ADR-019)" เหลือใน data dictionary (0 rows)
- [x] ไม่มี stale "UUID Public Identifier (ADR-019)" เหลือใน schema SQL (0 rows)
- [x] Database: 0 rows คงเหลือ (อัปเดตครบ 37 คอลัมน์)
- [x] Database: 30 indexes บน uuid/public_id (29 unique + 1 non-unique) — ตรงกับก่อนแก้
- [x] Database: PRIMARY KEY 4/4 ครบ (workflow_definitions, workflow_instances, workflow_histories, document_chunks)
- [x] SQL quote balance ตรวจแล้ว — บรรทัดที่แก้ทั้งหมดมี quotes สมดุล (ใช้ `''` escape สำหรับ nested quotes)
- [x] Commit `458ff0ad` + push สำเร็จ (`3a5c6cb3..458ff0ad main -> main`)
