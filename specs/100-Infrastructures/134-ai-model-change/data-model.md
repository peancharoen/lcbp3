// File: specs/100-Infrastructures/134-ai-model-change/data-model.md
// Change Log:
// - 2026-06-03: Data model for Thai-Optimized AI Model Stack

# Data Model: Thai-Optimized AI Model Stack

---

## Database Schema Changes

**ไม่มี new tables หรือ column changes** — ADR-009 compliant; ไม่มี TypeORM migration

### Optional: ai_available_models Seed Update

ตาราง `ai_available_models` (จาก ADR-027 Session 6) ควร update เพื่อความสอดคล้อง:

**Update existing main model record:**

```sql
UPDATE ai_available_models
SET model_name = 'typhoon2.5-np-dms:latest',
    display_name = 'Typhoon 2.5 NP-DMS (Thai)',
    updated_at = NOW()
WHERE model_type = 'main' AND is_active = 1;
```

**Insert OCR model record (if column model_type supports 'ocr'):**

```sql
INSERT INTO ai_available_models (model_name, display_name, model_type, is_active, created_at, updated_at)
VALUES ('typhoon-np-dms-ocr:latest', 'Typhoon OCR 3B (Thai)', 'ocr', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), updated_at = NOW();
```

> **Note**: ตรวจสอบ schema จริงใน `lcbp3-v1.9.0-schema-02-tables.sql` ก่อน run delta — column names และ model_type ENUM อาจแตกต่าง

---

## Code Configuration Model

### AiSettingsService Constants

| Constant | เดิม | ใหม่ |
|----------|------|------|
| `DEFAULT_MODEL` | `'gemma4:e2b'` | `'typhoon2.5-np-dms:latest'` |
| `OCR_MODEL` (เพิ่มใหม่) | — | `'typhoon-np-dms-ocr:latest'` |

**File**: `backend/src/modules/ai/services/ai-settings.service.ts`

---

## Custom Ollama Model Configurations

### typhoon2.5-np-dms (Main Model)

| Property | Value |
|----------|-------|
| Custom Name | `typhoon2.5-np-dms:latest` |
| Base Model | `scb10x/typhoon2.5-qwen3-4b:latest` |
| Size | ~2.5GB VRAM |
| keep_alive | Indefinite (`-1`) — standby ตลอด |
| num_ctx | 8192 |
| num_predict | 2048 |
| temperature | 0.1 |
| top_p | 0.85 |
| repeat_penalty | 1.15 |
| Role | Extraction, RAG Q&A, AI Suggestion, OCR Post-processing |
| Modelfile Path | `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/typhoon2.5-np-dms.model.md` |

### typhoon-np-dms-ocr (OCR Model)

| Property | Value |
|----------|-------|
| Custom Name | `typhoon-np-dms-ocr:latest` |
| Base Model | `scb10x/typhoon-ocr1.5-3b:latest` |
| Size | ~3.2GB VRAM |
| keep_alive | `0` — auto-unload immediately after job |
| num_ctx | 8192 |
| num_predict | 4096 |
| temperature | 0.1 |
| top_p | 0.1 |
| repeat_penalty | 1.1 |
| Role | Thai OCR extraction from PDF images |
| Modelfile Path | `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/typhoon-np-dms-ocr.model.md` |

---

## VRAM Budget Analysis

| State | Models in VRAM | Estimated VRAM Usage |
|-------|---------------|---------------------|
| Idle | typhoon2.5-np-dms (standby) | ~2.5GB |
| Main AI job | typhoon2.5-np-dms (active) | ~3.5–4GB peak |
| OCR transition | unloading main → loading OCR | ~3.2GB (OCR only) |
| OCR processing | typhoon-np-dms-ocr (active) | ~4–5GB peak |
| Post-OCR reload | loading main back | ~2.5GB |
| **Max peak** | OCR model active | **~5GB** (safe under 8GB limit) |

---

## OllamaService New Methods Signatures

```typescript
/**
 * unloadModel: Force unload model จาก VRAM
 * @param modelName - ชื่อ Ollama model ที่ต้องการ unload
 */
async unloadModel(modelName: string): Promise<void>

/**
 * loadModel: Load / warm model เข้า VRAM
 * @param modelName - ชื่อ Ollama model ที่ต้องการ load
 * @param keepAlive - -1 = indefinite (default สำหรับ main model); 0 = auto-unload
 */
async loadModel(modelName: string, keepAlive?: number | string): Promise<void>
```
