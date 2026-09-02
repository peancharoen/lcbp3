# Session Log: OCR OOM — VRAM Tuning for CHEC-LCP-C2-O-24-0004

**Date:** 2026-09-02
**Owner:** Operations + AI
**Status:** Resolved (config change applied + verified)

---

## 1. Incident

`CHEC-LCP-C2-O-24-0004` (queue id 2724, batch `BATCH-1788260786337`) failed OCR 3 times consecutively:

- 16:11:35 → 16:12:04 — `OCR_FAILED`
- 16:17:37 → 16:18:05 — `OCR_FAILED`
- 16:19:29 → 16:19:57 — `OCR_FAILED`

Backend log:

```
OCR extraction failed for legacy doc [CHEC-LCP-C2-O-24-0004]: Error: Auto fallback OCR Sidecar failed: write EPIPE
processLegacyAiEnrichment: failed (OCR_FAILED) queue item [2724]
```

Sidecar log:

```
POST http://host.docker.internal:11434/api/chat "HTTP/1.1 500 Internal Server Error"
Ollama inference failed — cleared prompt hash for retry. model=np-dms-ocr:latest
```

Ollama journal:

```
ggml_backend_cuda_buffer_type_alloc_buffer: allocating 10966.43 MiB on device 0: cudaMalloc failed: out of memory
ggml_gallocr_reserve_n_impl: failed to allocate CUDA0 buffer of size 11499136000
GGML_ASSERT(...) failed
llama-server terminated: signal: aborted (core dumped)
runtime OOM detected; expiring loaded models to clear memory before next request
```

## 2. Root Cause

- **PDF:** `I672-0005-ผรม.2-คคง.-CHEC-LCP-C2-O-24-0004.pdf` — 456 pages, 14.5MB (largest in batch; QC-0001=8.9MB, CHEC-LCP-C2-O-24-0002=1.8MB)
- **Source path:** stored in `migration_review_queue.ai_metadata_json` (`details` JSON column) as `/mnt/legacy-staging/Incoming/08C.2/2567/I672-0005-...pdf` — file exists and is readable from the backend container (mounted from `/mnt/asustor-legacy` CIFS share, read-only)
- **Failure stage:** OCR (before `ocr_extraction` could run) — `ocr_text` length = 0
- **Direct cause:** Ollama `cudaMalloc failed: out of memory` during `clip_image_batch_encode` for the second concurrent image. Ollama default `OLLAMA_NUM_PARALLEL=2` created 2 slots × `num_ctx=16384` KV cache on VRAM; when slot 1 tried to CLIP-encode the next page's image while slot 0 still held the previous page's prompt cache, VRAM was exhausted (needed ~10.9GB, only ~16GB total minus model weights + KV cache).
- **Surface error:** `write EPIPE` in backend (sidecar closed socket after Ollama 500) — misleading; the real failure was Ollama OOM, not a transport issue.

## 3. Fix

### 3.1 systemd override

`/etc/systemd/system/ollama.service.d/override.conf`:

```ini
[Service]
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_FLASH_ATTENTION=0"
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/opt/ollama/models"
```

### 3.2 Modelfile rebuild

```bash
ollama create np-dms-ocr:latest -f - <<'EOF'
FROM np-dms-ocr:latest
PARAMETER num_ctx 8192
PARAMETER num_predict 4096
PARAMETER repeat_penalty 1.1
PARAMETER temperature 0.1
PARAMETER top_p 0.6
EOF
```

### 3.3 Apply

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

## 4. Verification

- OCR 1 page via sidecar `/ocr-upload`: success, 3068 chars, 23s
- OCR 3 pages via sidecar `/ocr-upload`: success, 5659 chars, 56s — **no OOM**
- `nvidia-smi` after fix: 12MiB / 16311MiB (model unloaded after idle)
- `OLLAMA_NUM_PARALLEL=1` confirmed in `systemctl show ollama -p Environment`

## 5. Documentation Updates

- `specs/04-Infrastructure-OPS/04-04-deployment-guide.md` — added "VRAM Tuning (RTX 5060 Ti 16GB)" section
- `specs/06-Decision-Records/ADR-040-ocr-sidecar-refactor.md` — added D11 amendment
- `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/app.py` — updated comment `num_ctx=16384` → `num_ctx=8192`
- Live sidecar `/opt/np-dms/04-ai/ocr-sidecar/app.py` — same comment update

## 6. Pending

- Re-extract queue item 2724 via UI "Re Extract" button (OCR verified working; needs user to trigger from review UI or provide API credentials)
- Commit + push documentation changes
