# Quickstart: Typhoon OCR Integration

**Feature**: 232-typhoon-ocr-integration
**Date**: 2026-05-30
**Phase**: Implementation

## Current Scope

This feature is being implemented against the live LCBP3 repo structure, not the older generated paths in `plan.md` / `tasks.md`.

Current verified baseline:
- AI Model Management already exists via `ai_available_models` and `system_settings`
- OCR Sandbox already exists as a 2-step flow in `frontend/components/admin/ai/OcrSandboxPromptManager.tsx`
- OCR sidecar currently runs **Tesseract** as the production baseline
- Typhoon LLM option can be seeded into `ai_available_models` by SQL delta
- Typhoon OCR runtime path is still pending full backend/sidecar integration

## Prerequisites

- Admin Desktop (Desk-5439) with Ollama service reachable from DMS backend
- Redis service running
- MariaDB database with `ai_available_models`, `ai_prompts`, and `ai_audit_logs`
- BullMQ queues configured (`ai-realtime`, `ai-batch`)
- `system.manage_all` permission for AI admin features

## Installation Steps

### 1. Pull Typhoon models on Admin Desktop

```powershell
ollama pull scb10x/typhoon2.1-gemma3-4b
ollama pull scb10x/typhoon-ocr-3b
ollama list
```

Expected list should include:
- `scb10x/typhoon2.1-gemma3-4b`
- `scb10x/typhoon-ocr-3b`

### 2. Apply the Typhoon model seed delta

Apply:

- `specs/03-Data-and-Storage/deltas/2026-05-30-seed-typhoon-ai-models.sql`

This delta adds `typhoon2.1-gemma3-4b` into `ai_available_models` if it does not already exist.

### 3. Verify AI admin model data

Verified code path:
- Backend: `backend/src/modules/ai/ai-settings.service.ts`
- API: `GET /api/ai/admin/models`
- Frontend: `frontend/app/(admin)/admin/ai/page.tsx`

Expected behavior:
- `gemma4:e4b` remains the default fallback active model when `AI_ACTIVE_MODEL` is unset
- `typhoon2.1-gemma3-4b` appears as an additional selectable model after the delta is applied

## Usage

### AI Model Management

1. Open the AI admin page.
2. Confirm `typhoon2.1-gemma3-4b` appears in the model list.
3. Activate it from the existing AI Model Management card.

### OCR Sandbox

Current verified baseline:
- OCR Sandbox uses the existing 2-step flow:
  - Step 1: OCR only
  - Step 2: AI extraction from cached OCR text
- OCR sidecar health card now reflects the current engine baseline as `OCR Sidecar (Tesseract)`

Typhoon OCR engine selection is still pending implementation and should not be treated as complete until backend, queue, and sidecar integration are added.

## Verification

### Verify the model seed

1. Apply the SQL delta.
2. Open `/admin/ai`.
3. Confirm `typhoon2.1-gemma3-4b` appears in the model list.

### Verify the fallback active model

1. Ensure `AI_ACTIVE_MODEL` is missing from `system_settings` in a test environment.
2. Call `GET /api/ai/admin/models/active`.
3. Confirm the fallback response resolves to `gemma4:e4b`.

### Verify OCR baseline label

1. Open `/admin/ai`.
2. Go to `Overview & Health`.
3. Confirm the OCR card label reads `OCR Sidecar (Tesseract)`.

## Troubleshooting

### Ollama unavailable

Symptoms:
- AI health endpoint reports Ollama as down
- model activation cannot proceed

Checks:

```powershell
ollama list
```

### Typhoon model missing from UI

Checks:
- verify `2026-05-30-seed-typhoon-ai-models.sql` was applied
- verify `GET /api/ai/admin/models` returns the seeded row

### OCR Sandbox still uses Tesseract only

This is expected until Typhoon OCR runtime integration is implemented in:
- `backend/src/modules/ai/services/ocr.service.ts`
- `backend/src/modules/ai/processors/ai-batch.processor.ts`
- `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py`

## Security Notes

- All AI admin endpoints require `system.manage_all`
- AI models remain on-premises only per ADR-023 / ADR-023A
- OCR results must stay behind the DMS backend boundary
- Do not treat Typhoon OCR as production-ready until fallback, queueing, and audit coverage are implemented end-to-end
