# Session 5 — 2026-05-25 (N8N Submit AI Job Debug + Upload Dedup)

## ปัญหาที่พบ (Root Cause)

**Bug 1: `Submit AI Job` → 400 Bad Request**

- n8n HTTP Request node `typeVersion: 4.1` เมื่อ `specifyBody: "json"` และ `jsonBody` เป็น expression ที่ return **object** → n8n ส่ง body เป็น `"[object Object]"` แทน JSON string
- แก้ด้วย `JSON.stringify($json.submit_payload)`

**Bug 2: `Submit AI Job` → 403 Forbidden**

- `migration_bot` (user_id=5, role_id=1/Superadmin) ไม่มี `ai.suggest` ใน `role_permissions`
- Root cause: Seed script `INSERT INTO role_permissions SELECT 1, permission_id FROM permissions WHERE is_active = 1` รันก่อน `ai.*` permissions (id 181-186) ถูก insert เข้า `permissions` table
- แก้ด้วย delta SQL grant ai.\* ให้ role_id=1

**Bug 3: Upload ซ้ำเมื่อ n8n retry**

- `FileStorageService.upload()` เดิมไม่มี dedup → ทุก retry สร้าง orphan temp attachment ใหม่
- แก้ด้วย checksum-based dedup: query หา temp record ที่มี checksum+userId เดิมและยังไม่หมดอายุ → คืน record เดิมแทน

## การแก้ไข (Fix)

| ไฟล์                                                                                          | การเปลี่ยนแปลย                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `specs/03-Data-and-Storage/n8n.workflow.v2.json`                                              | `jsonBody` เปลี่ยนเป็น `JSON.stringify($json.submit_payload)` |
| `specs/03-Data-and-Storage/deltas/2026-05-25-grant-ai-permissions-to-superadmin.sql`          | INSERT IGNORE ai.\* permissions สำหรับ role_id=1 (Superadmin) |
| `specs/03-Data-and-Storage/deltas/2026-05-25-grant-ai-permissions-to-superadmin.rollback.sql` | Rollback DELETE สำหรับ delta ข้างบน                           |
| `backend/src/common/file-storage/file-storage.service.ts`                                     | เพิ่ม checksum dedup ใน `upload()` ก่อน write file            |

## กฎที่ Lock แล้ว

- `jsonBody` ใน n8n HTTP Request `typeVersion >= 4.1` ต้องใช้ `JSON.stringify(...)` เมื่อ `specifyBody: "json"` และค่าเป็น object
- ทุกครั้งที่เพิ่ม permission ใหม่ใน `permissions` table ต้อง grant ให้ Superadmin (role_id=1) ด้วยทันที — ห้ามปล่อยให้ขาดหาย
- `FileStorageService.upload()` เป็น idempotent ผ่าน SHA-256 checksum + userId + expiresAt

## Verification ที่ยังต้องทำ

- รัน delta SQL ใน MariaDB (ถ้ายังไม่รัน): `2026-05-25-grant-ai-permissions-to-superadmin.sql`
- Import `n8n.workflow.v2.json` ใหม่เข้า n8n UI
- `pnpm --filter backend test -- file-storage` — ยืนยัน checksum dedup
