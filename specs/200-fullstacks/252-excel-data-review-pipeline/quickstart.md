# Quickstart: 4-Layer Excel Data Review Pipeline

**Feature Branch**: `feature/252-excel-data-review-pipeline`  
**Date**: 2026-09-05  

---

## 🚀 Quick Usage Guide

### 1. Upload & Check Excel File (cURL example)

```bash
curl -X POST "http://localhost:3000/api/v1/correspondence/import-review/check?projectPublicId=019505a1-7c3e-7000-8000-abc123def456&targetMode=DIRECT_IMPORT&aiProvider=LOCAL_OLLAMA" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@/path/to/register.xlsx"
```

**Response**:
```json
{
  "reviewSessionPublicId": "0195567a-1234-7000-8000-987654321def",
  "targetMode": "DIRECT_IMPORT",
  "totalRows": 25,
  "passCount": 23,
  "warnCount": 2,
  "blockCount": 0,
  "aiSuggestCount": 2,
  "canConfirm": true,
  "downloadAnnotatedUrl": "/api/v1/correspondence/import-review/0195567a-1234-7000-8000-987654321def/download-annotated"
}
```

### 2. Download Annotated Excel

```bash
curl -O -J "http://localhost:3000/api/v1/correspondence/import-review/0195567a-1234-7000-8000-987654321def/download-annotated" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```
เปิดไฟล์ที่ดาวน์โหลดใน Microsoft Excel:
- ดูสรุปใน Sheet `Review_Summary`
- ดูสีไฮไลต์และ Cell Note ใน Sheet `Data`

### 3. Confirm Import

```bash
curl -X POST "http://localhost:3000/api/v1/correspondence/import-review/confirm" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reviewSessionPublicId": "0195567a-1234-7000-8000-987654321def"}'
```
