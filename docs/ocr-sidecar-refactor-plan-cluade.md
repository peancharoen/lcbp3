# OCR Sidecar — แผนการ Refactor by CLAUDE
**ไฟล์:** `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py`
**วันที่วิเคราะห์:** 2026-06-20
**GPU ปัจจุบัน:** RTX 5060 Ti 16GB
**ไฟล์:** `ocr-sidecar-refactor-plan-cluade.md`
---

## สรุปปัญหาที่พบ

| # | ปัญหา | ความรุนแรง | หมวด |
|---|-------|-----------|------|
| P1 | Hardcoded default API key ใน source code | 🔴 Critical | Security |
| P2 | `process_ocr` เป็น sync function — block event loop | 🔴 Critical | Performance |
| P3 | God Service — รวม OCR + Embed + Rerank + Normalize ไว้ด้วยกัน | 🔴 Critical | Architecture |
| P4 | Business logic อยู่ใน sidecar แทน backend | 🟡 Medium | Architecture |
| P5 | VRAM contention logic ล้าสมัย (ออกแบบมาสำหรับ 8GB) | 🟡 Medium | Performance |
| P6 | `on_event("startup")` deprecated + blocking | 🟡 Medium | Code Quality |
| P7 | `import tempfile` ซ้ำ | 🟢 Low | Code Quality |
| P8 | JSON parse fallback ไม่มี warning log | 🟢 Low | Observability |

---

## VRAM Budget (RTX 5060 Ti 16GB)

```
np-dms-ocr  (typhoon-ocr 3B)    ~3–4 GB
np-dms-ai   (llama3.2 3B)       ~2–3 GB
BGE-M3      (BAAI/bge-m3)       ~2   GB
Reranker    (bge-reranker-large) ~1   GB
─────────────────────────────────────────
รวมประมาณ                        ~8–10 GB  ✅ พอดีใน 16GB
```

**ผลกระทบ:** โหลดทุก model พร้อมกันได้ — VRAM Arbiter และ `keep_alive: 0` ไม่จำเป็นอีกต่อไป

---

## สิ่งที่ควรย้ายไป Backend (NestJS)

| สิ่งที่ย้าย | เหตุผล |
|------------|--------|
| API Key Authentication | Sidecar อยู่ใน internal Docker network — ไม่ต้องการ auth layer ซ้อน |
| `systemPrompt` validation + length check | Business rule — backend ควรเป็นผู้กำหนดและ validate ก่อนส่งมา |
| `/normalize` endpoint ทั้งหมด | Pipeline step ที่ backend orchestrate เอง |
| Engine selection + alias normalization | Backend ควร resolve engine แล้วส่งชื่อที่ถูกต้องมาตรงๆ |
| Fast-path text extraction (auto engine) | การตัดสินใจว่า "ต้อง OCR ไหม" เป็น business rule ของ backend |
| Page range calculation | Backend รู้ document metadata อยู่แล้ว |

---

## แผนการ Refactor แบ่งเป็น 3 Phase

---

### Phase 1 — Security & Critical Bugs
**เป้าหมาย:** แก้ปัญหา critical ที่กระทบ production ทันที
**ขนาดงาน:** ~1 วัน

#### 1.1 ลบ Hardcoded Default API Key
```python
# ❌ ก่อน
OCR_SIDECAR_API_KEY = os.getenv("OCR_SIDECAR_API_KEY", "lcbp3-dms-ocr-sidecar-secure-token-2026")

# ✅ หลัง
OCR_SIDECAR_API_KEY = os.getenv("OCR_SIDECAR_API_KEY")
if not OCR_SIDECAR_API_KEY:
    raise RuntimeError("OCR_SIDECAR_API_KEY environment variable must be set")
```
> ต้อง rotate key ที่ expose ใน git history ด้วย

#### 1.2 เปลี่ยน `process_ocr` เป็น Async
```python
# ❌ ก่อน
def process_ocr(...) -> str:
    with httpx.Client(timeout=OCR_TIMEOUT) as client:
        response = client.post(...)

# ✅ หลัง
async def process_ocr(...) -> str:
    async with httpx.AsyncClient(timeout=OCR_TIMEOUT) as client:
        response = await client.post(...)
```

#### 1.3 เปลี่ยน `keep_alive` จาก 0 เป็นค่าที่เหมาะสม
```python
# ❌ ก่อน — unload ทันทีเพราะ VRAM ไม่พอ (8GB era)
"keep_alive": options_override.get("keep_alive", 0)

# ✅ หลัง — keep ไว้เพราะ 16GB พอ
"keep_alive": options_override.get("keep_alive", 300)
```

---

### Phase 2 — Performance & Code Quality
**เป้าหมาย:** ลบ legacy code ที่ออกแบบมาสำหรับ 8GB GPU และปรับปรุง startup
**ขนาดงาน:** ~1 วัน

#### 2.1 ลบ VRAM Contention Logic ทั้งหมด
```python
# ❌ ลบออกทั้งหมด
from services.vram_monitor import get_vram_headroom
headroom = get_vram_headroom()
if not headroom.query_success:
    device = "cpu"
elif headroom.available_mb < threshold_mb:
    device = "cpu"
```

```python
# ✅ แทนด้วย fixed device
bge_model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=True)  # fp16 ได้แล้วบน 16GB
# device = "cuda" เสมอ — ไม่ต้อง dynamic selection
```

#### 2.2 เปลี่ยน Startup ไปใช้ `lifespan`
```python
# ❌ ก่อน — deprecated
@app.on_event("startup")
def load_bge_models():
    bge_model = BGEM3FlagModel(...)

# ✅ หลัง
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.to_thread(load_models)  # ไม่ block event loop
    yield

app = FastAPI(title="OCR Sidecar", version="3.0.0", lifespan=lifespan)
```

#### 2.3 แก้ duplicate import และ JSON parse warning
```python
# ลบ import tempfile ที่ซ้ำใน /ocr-upload

# เพิ่ม log warning ใน JSON parse fallback
try:
    result_text = json.loads(raw_text).get("natural_text", raw_text)
except (json.JSONDecodeError, AttributeError):
    logger.warning(f"[DIAG] Failed to parse JSON response, using raw text. Preview: {raw_text[:100]}")
    result_text = raw_text
```

#### 2.4 Validate `pdf_path` ก่อนส่งเข้า `process_ocr`
```python
# เพิ่มใน _process_pdf_doc
resolved_path = pdf_path or (str(doc.name) if hasattr(doc, 'name') and doc.name else None)
if not resolved_path or resolved_path in ("", "<memory>"):
    raise ValueError("Invalid PDF path — ต้องส่ง pdf_path ที่ valid เข้ามาด้วย")
```

---

### Phase 3 — Architecture Separation
**เป้าหมาย:** แยก concerns ออกจากกัน ให้ sidecar เป็น pure compute worker
**ขนาดงาน:** ~2–3 วัน

#### 3.1 ย้าย `/normalize` ไป Backend

Backend เรียก PyThaiNLP โดยตรง หรือสร้าง microservice แยก:
```
n8n → POST /api/rag/normalize (NestJS) → PyThaiNLP → return normalized text
```
ลบ `/normalize` endpoint ออกจาก sidecar ทั้งหมด

#### 3.2 ย้าย Authentication ออกจาก Sidecar

```yaml
# docker-compose — จำกัด network แทน API key
services:
  ocr-sidecar:
    networks:
      - internal  # ไม่ expose ออก external network
    # ไม่มี ports mapping ออก host
```

Backend (NestJS) เรียก sidecar ผ่าน internal network โดยไม่ต้องส่ง API key

#### 3.3 Sidecar รับ Resolved Input เท่านั้น

Backend ทำ pre-processing ก่อนแล้วส่งมา:

```
Backend (NestJS)
  ├─ ตรวจสอบ PDF มี text layer หรือไม่ (fast-path decision)
  ├─ กำหนด engine ที่จะใช้ (ไม่มี "auto" ใน sidecar)
  ├─ validate systemPrompt
  ├─ คำนวณ page range
  └─► POST /ocr  { engine: "np-dms-ocr", pages: [1,2,3], systemPrompt: "..." }
```

Sidecar เหลือหน้าที่เดียว: **รับ input → เรียก model → คืน result**

---

## Target Architecture หลัง Refactor

```
┌─────────────────────────────────────────────┐
│              Backend (NestJS)               │
│                                             │
│  - Fast-path text extraction decision       │
│  - Engine selection & validation            │
│  - systemPrompt validation                  │
│  - Page range calculation                   │
│  - Thai text normalization (PyThaiNLP)      │
│  - Auth & rate limiting                     │
└────────────────────┬────────────────────────┘
                     │ internal Docker network
                     ▼
┌─────────────────────────────────────────────┐
│           OCR Sidecar (compute only)        │
│                                             │
│  POST /ocr          ← PDF path + page list  │
│  POST /ocr-upload   ← multipart file        │
│  POST /embed        ← normalized text       │
│  POST /rerank       ← query + chunks        │
│  GET  /health                               │
│                                             │
│  Models (always loaded, CUDA):              │
│  - np-dms-ocr via Ollama (keep_alive=300)   │
│  - BGE-M3 fp16                              │
│  - BGE-Reranker-Large fp16                  │
└─────────────────────────────────────────────┘
```

---

## Checklist สรุป

### Phase 1 (Critical — ทำก่อน)
- [ ] ลบ hardcoded default API key + rotate key ใน secrets
- [ ] เปลี่ยน `process_ocr` เป็น async + `httpx.AsyncClient`
- [ ] เปลี่ยน `keep_alive` default จาก 0 เป็น 300

### Phase 2 (Performance)
- [ ] ลบ VRAM contention logic ทั้งหมด (`get_vram_headroom`, dynamic device)
- [ ] เปลี่ยน `use_fp16=False` เป็น `use_fp16=True` สำหรับ BGE models
- [ ] เปลี่ยน `on_event("startup")` เป็น `lifespan` + `asyncio.to_thread`
- [ ] ลบ duplicate `import tempfile`
- [ ] เพิ่ม log warning ใน JSON parse fallback
- [ ] Validate `pdf_path` ก่อนส่งเข้า `process_ocr`

### Phase 3 (Architecture)
- [ ] ย้าย `/normalize` ไป Backend
- [ ] ย้าย engine selection + alias normalization ไป Backend
- [ ] ย้าย fast-path decision ไป Backend
- [ ] จำกัด sidecar network เป็น internal-only แทน API key auth
- [ ] ลบ `/normalize`, auth middleware ออกจาก sidecar

---

*เอกสารนี้จัดทำจากการ code review วันที่ 2026-06-20 — ควร update เมื่อ architecture เปลี่ยน*
