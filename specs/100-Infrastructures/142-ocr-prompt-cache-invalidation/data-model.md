// File: specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/data-model.md
// Change Log:
// - 2026-07-23: Initial data model for OCR Prompt Cache Invalidation

# Data Model: OCR Prompt Cache Invalidation

## Entities

### PromptCacheEntry (Redis)

ไม่ใช่ DB entity — เก็บใน Redis เท่านั้น

| Field | Type | Redis Key | TTL | Description |
|-------|------|-----------|-----|-------------|
| promptHash | string (16 hex chars) | `ocr:prompt:hash:np-dms-ocr` | ไม่มี (persistent) | SHA-256 16 chars ของ systemPrompt ล่าสุดที่ส่งไป Ollama |

### Redis Key Schema

```text
ocr:prompt:hash:np-dms-ocr    → "a1b2c3d4e5f67890" (string)
```

- Key prefix: `ocr:prompt:hash:` (แยกจาก `ai:prompt:active:` ของ Backend)
- Key suffix: model name (`np-dms-ocr`) เพื่อรองรับหลาย model ในอนาคต
- ไม่มี TTL — เก็บถาวรจนกว่า sidecar จะเปลี่ยน prompt
- หาก key หาย (sidecar รีสตาร์ท + Redis flush) → ถือว่าเป็น request แรก → ไม่ unload

## State Transitions

### Prompt Cache State Machine

```text
                    ┌──────────────┐
                    │  NO_HASH     │ (initial / Redis key missing)
                    │  (first req) │
                    └──────┬───────┘
                           │ request ส่ง prompt A
                           ▼
                    ┌──────────────┐
                    │  HASH=A      │
                    │  (cached)    │◄──────────────────┐
                    └──────┬───────┘                   │
                           │ request ใหม่ prompt A     │
                           │ (hash match)              │
                           │ → skip unload             │
                           └───────────────────────────┘
                           │ request ใหม่ prompt B
                           │ (hash mismatch)
                           │ → unload model
                           │ → update hash to B
                           ▼
                    ┌──────────────┐
                    │  HASH=B      │
                    │  (cached)    │
                    └──────────────┘
```

## API Contracts

ไม่มี endpoint ใหม่ — แก้ไข behavior ภายใน existing endpoint:

### Modified: POST /ocr-upload

**เพิ่ม internal behavior** (ไม่เปลี่ยน API contract ด้านนอก):

```text
Request flow (internal):
1. Acquire asyncio.Lock
2. Read Redis: ocr:prompt:hash:np-dms-ocr
3. Compute SHA-256(prompt) → current_hash
4. If stored_hash == current_hash → skip unload
5. If stored_hash != current_hash →
   a. POST /v1/chat/completions {model, messages:[], keep_alive:0}
   b. Wait for unload response
   c. Update Redis: ocr:prompt:hash:np-dms-ocr = current_hash
6. Proceed with normal OCR processing
7. Release asyncio.Lock
```

### Unload Request (internal → Ollama)

```json
POST {OLLAMA_API_URL}/v1/chat/completions
{
  "model": "np-dms-ocr:latest",
  "messages": [],
  "keep_alive": 0,
  "stream": false
}
```

Expected response:
```json
{
  "model": "np-dms-ocr:latest",
  "created_at": "...",
  "choices": [{"message": {"role": "assistant", "content": ""}}],
  "done": true,
  "done_reason": "unload"
}
```

## Configuration

### New Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL สำหรับ prompt hash storage |

### Modified Files

| File | Change |
|------|--------|
| `app.py` | เพิ่ม asyncio.Lock, prompt hash check logic ใน `process_ocr()` |
| `services/prompt_cache.py` | ใหม่ — Redis get/set hash + unload function |
| `requirements.txt` | เพิ่ม `redis>=5.0.0` |
| `docker-compose.yml` | เพิ่ม `REDIS_URL` env var ใน ocr-sidecar service |
