# Session 3 — 2026-05-24 (Migration Queue Attachment UUID Bug Fix)

## ปัญหาที่พบ (Root Cause)

ไฟล์ `n8n.workflow.v2.json` (โหนด `Insert Review Queue`) ส่งค่า `tempAttachmentId` โดยใช้ `{{parseInt($json.attachmentId)}}` ซึ่งพยายามแปลง UUID string เป็นตัวเลข ผลลัพธ์คือค่า `NaN` หรือตัวเลขที่ผิดพลาด (เช่น `"0195..."` → `19`) ทำให้คอลัมน์ `temp_attachment_id` ใน `migration_review_queue` เป็น `NULL` เสมอ — ละเมิด ADR-019 Tier 1 Blocker

## การแก้ไข (Fix)

| ไฟล์                                                        | การเปลี่ยนแปลง                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `backend/src/modules/ai/dto/migration-checkpoint.dto.ts`    | ปรับ `tempAttachmentId` เป็น `@IsOptional()` รองรับทั้ง UUID string และ Integer PK |
| `backend/src/modules/ai/ai-migration-checkpoint.service.ts` | เพิ่ม UUID→INT resolution: `SELECT id FROM attachments WHERE uuid = ? LIMIT 1`     |
| `specs/03-Data-and-Storage/n8n.workflow.v2.json`            | เปลี่ยนส่ง `temp_attachment_public_id` (UUID string) แทน `parseInt(...)` ที่ผิด    |

## Pattern ที่ตกลง (Locked)

```
n8n ส่ง: { tempAttachmentId: "019505a1-7c3e-7000-..." }  ← UUID string
Backend รับ: ตรวจสอบประเภท → ถ้าเป็น string → query DB → ได้ INT id จริง
DB บันทึก: migration_review_queue.temp_attachment_id = <INT>  ← ถูกต้อง
```

## Verification

- `npx tsc --noEmit` — ✅ ผ่าน ไม่มี type error
- ตรวจสอบ logic ใน Service แล้ว ไม่มีการเขียนทับ `tempAttachmentId` ด้วย `undefined` (guard check แล้ว)
