# Quickstart: Attachment Manual Re-OCR

## Prereqs
- `np-dms-lcbp3` stack up (backend, redis, mariadb, ocr-sidecar, ollama); user with `rag.admin.write`; a PDF attachment with poor `ocr_text`.

## Manual flow
1. Open `/admin/ai/rag-console`, find the attachment row → **Re-OCR**.
2. Pick engine (default vision `np-dms-ocr`) → Start. Verify queue position + estimate shown; `SELECT ocr_text` unchanged.
3. Wait (poll ~3s) → comparison opens; check PDF pane, search box, char counts, warning/identical states.
4. Confirm → AlertDialog → confirm. Verify `ocr_text` replaced, `ai_processing_status='DONE'`, `rag_status` PENDING→INDEXED in badge/timeline; old generation RETIRED.
5. Re-open action on another session → 404 path (start form); confirm again with old token → 404/410.

## Failure drills
- Stop sidecar → after 3 attempts status `failed` + retry buttons (no silent fallback).
- Non-PDF → 422; delete file on disk → 410; trigger twice → 409.
- Enqueue an ingestion job on a DONE attachment → skipped with warn log.

## Verification commands
```bash
pnpm --filter backend test -- np-dms-ocr attachment-re-ocr file-storage.controller ai-batch.processor
pnpm --filter backend lint:ci
pnpm --filter backend build
pnpm --filter lcbp3-frontend test run
pnpm --filter lcbp3-frontend lint
```
