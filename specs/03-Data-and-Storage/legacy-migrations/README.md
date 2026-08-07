# Legacy TypeORM Migration Files (Archived)

> 📌 Archived per [ADR-044](../../06-Decision-Records/ADR-044-database-schema-strategy-amendment.md) — No TypeORM Migrations

## ที่มา

ไฟล์เหล่านี้เป็น TypeORM migration files เดิมจาก `backend/src/database/migrations/` ที่สร้างก่อน v1.8.x เมื่อยังใช้ TypeORM migration feature ตาม ADR-009 (ฉบับเดิม)

## ทำไมจึงย้ายมาที่นี่

ADR-044 (2026-08-03) ได้ formalize ว่า "no TypeORM migrations, edit schema SQL directly via delta files" เป็น decision ปัจจุบัน จึงย้าย migration files เก่าออกจาก `backend/src/database/migrations/` เพื่อ:

1. **ป้องกันการโหลดโดย TypeORM** — `database.config.ts` ตั้ง `migrations: []` แล้ว แต่การเก็บไฟล์ใน path เดิมอาจทำให้สับสน
2. **รักษาเป็น audit trail** — เก็บไว้เพื่ออ้างอิงทางประวัติศาสตร์ (ไม่ลบทิ้ง)
3. **สอดคล้องกับ ADR-044** — ที่ระบุว่า "ห้ามสร้างไฟล์ใน `backend/src/database/migrations/`"

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | คำอธิบาย |
|---|---|
| `initial-schema.ts` | Initial schema migration (เดิมจาก backend/src/database/migrations/) |
| `1701676800000-v1-5-1-schema-update.ts` | v1.5.1 schema update — Disciplines + Correspondence Sub Types |

## หมายเหตุ

- ไฟล์เหล่านี้ **ไม่ได้ใช้งานแล้ว** — schema ปัจจุบันจัดการผ่าน SQL delta files ใน `../deltas/`
- ห้ามนำกลับไปใช้ หรือสร้าง migration files ใหม่ตาม ADR-044
- ดู schema ปัจจุบันได้ที่ `../lcbp3-v1.9.0-schema-02-tables.sql`
