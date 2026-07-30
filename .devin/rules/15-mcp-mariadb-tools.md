# MCP MariaDB Tools

MCP MariaDB server ให้เครื่องมือสำหรับตรวจสอบและจัดการ database โดยตรง ใช้สำหรับ:

- ตรวจสอบ schema กับ spec file `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
- Debug ปัญหา database โดยไม่ต้องเข้า MySQL client
- ตรวจสอบ data ใน production/staging
- Validate การเปลี่ยนแปลง schema ก่อน deploy

## Available Tools

| Tool                         | หน้าที่                        | ตัวอย่างการใช้งาน                                  |
| ---------------------------- | ------------------------------ | -------------------------------------------------- |
| `mcp1_mysql_test_connection` | ทดสอบ connection กับ database  | ตรวจสอบว่า MCP server เชื่อมต่อได้                 |
| `mcp1_mysql_show_databases`  | แสดง databases ทั้งหมด         | ดูว่ามี database อะไรบ้าง                          |
| `mcp1_mysql_show_tables`     | แสดง tables ทั้งหมดใน database | ดูรายชื่อ tables ใน `lcbp3`                        |
| `mcp1_mysql_describe_table`  | ดู structure/columns ของ table | ตรวจสอบ columns, types, keys ของ `correspondences` |
| `mcp1_mysql_query`           | รัน SELECT query               | ดู data ใน table หรือ join query                   |
| `mcp1_mysql_insert`          | INSERT data                    | เพิ่ม seed data หรือ test data                     |
| `mcp1_mysql_update`          | UPDATE data                    | แก้ไข data ใน table                                |
| `mcp1_mysql_delete`          | DELETE data                    | ลบ data ใน table                                   |

## การใช้งานร่วมกับ Development Flow

**เมื่อเขียน query ใหม่:**

1. ใช้ `mcp1_mysql_describe_table` เพื่อตรวจสอบ columns และ types
2. เปรียบเทียบกับ `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
3. ใช้ `mcp1_mysql_query` เพื่อทดสอบ query ก่อน implement

**เมื่อเปลี่ยน schema (ADR-009):**

1. ใช้ `mcp1_mysql_describe_table` เพื่อดู structure ปัจจุบัน
2. สร้าง SQL delta ใน `specs/03-Data-and-Storage/deltas/`
3. ใช้ `mcp1_mysql_query` เพื่อตรวจสอบผลลัพธ์หลัง apply delta

**เมื่อ debug ปัญหา database:**

1. ใช้ `mcp1_mysql_query` เพื่อดู data จริง
2. เปรียบเทียบกับ spec และ data dictionary
3. ตรวจสอบ foreign keys และ constraints

## ข้อควรระวัง

- **❌ ห้ามใช้ MCP MariaDB สำหรับ DDL operations** (CREATE/ALTER/DROP) โดยตรง — ต้องใช้ SQL delta ตาม ADR-009
- **✅ ใช้สำหรับ DQL/DML operations** (SELECT/INSERT/UPDATE/DELETE) เพื่อ debug และ test เท่านั้น
- **⚠️ ระวัง DELETE operations** — อาจทำให้เสีย data ใน production
- **✅ ตรวจสอบ schema กับ spec file เสมอ** ก่อนเขียน query
