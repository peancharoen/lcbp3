// File: specs/200-fullstacks/241-ocr-persist-sandbox/quickstart.md
// Change Log:
// - 2026-07-27: Phase 1 quickstart for OCR Text Persistence & Sandbox Project

# Quickstart: OCR Text Persistence & Sandbox Project

## 1. Apply Schema Delta

```bash
mysql -u <user> -p lcbp3 < specs/03-Data-and-Storage/deltas/2026-07-27-add-ocr-text-and-sandbox-project.sql
```

ตรวจสอบ:

```sql
DESCRIBE attachments;   -- ต้องเห็น ocr_text LONGTEXT
DESCRIBE projects;      -- ต้องเห็น is_sandbox TINYINT(1)
SELECT * FROM projects WHERE is_sandbox = 1;  -- ต้องเห็น 1 แถว (SANDBOX)
```

## 2. Verify OCR Text Persistence (User Story 1)

1. Submit Correspondence ที่มีไฟล์แนบ PDF ที่ต้องใช้ OCR (text layer < 100 chars/page)
2. รอ `rag-prepare` job ทำงาน (ดูใน BullMQ dashboard หรือ log `processRagPrepare: starting`)
3. ตรวจสอบ DB ทันทีหลัง log `OCR extraction succeeded`:
   ```sql
   SELECT ocr_text IS NOT NULL FROM attachments WHERE public_id = '<attachmentPublicId>';
   ```
   ต้องเป็น `1` แม้ `embed-document` job ยังไม่เริ่ม/ยังไม่เสร็จ

## 3. Verify Full Pipeline Sandbox (User Story 2)

1. Login เป็น Superadmin → Admin Console → AI Sandbox → Tab "Full Pipeline"
2. อัปโหลดไฟล์ PDF ทดสอบ → ระบบเรียก `/files/upload` → `/correspondences` (ด้วย sandbox `projectPublicId`) → `/correspondences/:uuid/submit`
3. Poll สถานะ — ตรวจสอบ `attachments.ocr_text` และ Qdrant มี vector points ใหม่
4. กด "Clear Sandbox Data" → ตรวจสอบทุกตารางที่ `project_id = sandboxProjectId` ว่างเปล่า:
   ```sql
   SELECT COUNT(*) FROM correspondences WHERE project_id = (SELECT id FROM projects WHERE is_sandbox = 1);
   -- ต้องเป็น 0
   ```

## 4. Verify RBAC Filtering (User Story 3)

```bash
curl -H "Authorization: Bearer <regular-user-token>" http://localhost:3000/projects
```

Response ต้องไม่มีโครงการที่ `project_code = 'SANDBOX'`

## 5. Regression Check — Production Pipeline Sandbox เดิม

ยืนยันว่า 3 endpoint เดิมยังทำงานเหมือนเดิม (ไม่ commit DB):

```bash
curl -X POST /ai/admin/sandbox/ocr ...
curl -X POST /ai/admin/sandbox/ai-extract ...
curl -X POST /ai/admin/sandbox/rag-prep ...
```

ตรวจสอบว่าไม่มี row ใหม่ใน `correspondences` table เกิดขึ้นจากการเรียก 3 endpoint นี้
