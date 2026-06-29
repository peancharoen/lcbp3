// File: specs/100-Infrastructures/134-ai-model-change/quickstart.md
// Change Log:
// - 2026-06-03: Verification guide for Thai-Optimized AI Model Stack

# Quickstart: Thai-Optimized AI Model Stack Verification

---

## Prerequisites

- Desk-5439 รัน Ollama service (port 11434)
- Internet access บน Desk-5439 (สำหรับ pull base models จาก registry)
- QNAP backend container running (port 3001)
- Model files อยู่ที่ `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/`

---

## Step 1: สร้าง Custom Models บน Desk-5439

```powershell
# บน Desk-5439 Windows — เปิด PowerShell ใน directory ที่มี Modelfiles
# Path: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/

ollama create typhoon2.5-np-dms -f .\typhoon2.5-np-dms.model.md
# คาดว่าใช้เวลา: 5-15 นาที (download base model ~2.5GB)

ollama create typhoon-np-dms-ocr -f .\typhoon-np-dms-ocr.model.md
# คาดว่าใช้เวลา: 5-15 นาที (download base model ~3.2GB)

# ตรวจสอบ
ollama list
# ต้องเห็น:
# typhoon2.5-np-dms:latest
# typhoon-np-dms-ocr:latest
# nomic-embed-text:latest   (ยังคงอยู่ — embedding model ไม่เปลี่ยน)
```

---

## Step 2: Apply SQL Delta (ถ้า ai_available_models table มีอยู่)

```powershell
# รัน delta ผ่าน DB admin tool หรือ mysql client
# File: specs/03-Data-and-Storage/deltas/2026-06-03-update-ai-available-models-typhoon.sql
```

---

## Step 3: Deploy Backend

ปฏิบัติตาม `/deploy` workflow ปกติ (QNAP Container Station)

---

## Step 4: ตรวจสอบ Health Endpoint

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/ai/health" -Method GET |
  ConvertTo-Json -Depth 5
# ตรวจสอบ:
# ollama.mainModel = "typhoon2.5-np-dms:latest"
# ollama.status = "HEALTHY"
```

---

## Step 5: ทดสอบ OCR Job

```powershell
# ส่ง OCR job ผ่าน AI Admin Console → OCR Sandbox
# หรือ POST /api/ai/admin/sandbox/ocr ด้วย PDF ภาษาไทย
# ตรวจสอบ result:
# - ocrText มีภาษาไทยที่อ่านออกได้
# - ไม่มี VRAM OOM error ใน logs
```

---

## Step 6: ตรวจสอบ BullMQ Model Switching Logs

```powershell
# ดู backend logs ขณะ OCR job กำลังทำงาน
docker compose logs -f backend | Select-String "ModelSwitch"
# ต้องเห็น:
# [ModelSwitch] Unloading typhoon2.5-np-dms:latest
# [ModelSwitch] Loading typhoon-np-dms-ocr:latest (keep_alive: 0)
# [ModelSwitch] Reloading typhoon2.5-np-dms:latest (keep_alive: -1)
```

---

## Step 7: ตรวจสอบ VRAM ไม่เกิน 8GB

```powershell
# บน Desk-5439 ขณะ OCR job กำลังทำงาน
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
# ต้องไม่เกิน 8192 MiB
```

---

## Rollback

หากพบปัญหาหลัง deploy:

1. สร้าง custom model ใหม่จาก `gemma4:e2b`:
   ```powershell
   ollama create typhoon2.5-np-dms -f .\gemma4-fallback.model.md
   ```
2. หรือ revert `AiSettingsService.DEFAULT_MODEL` กลับเป็น `'gemma4:e2b'` แล้ว redeploy
3. ดูรายละเอียดใน ADR-034 Section 5 Rollback Strategy
