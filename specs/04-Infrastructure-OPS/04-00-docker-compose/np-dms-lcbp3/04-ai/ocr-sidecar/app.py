# File: specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/app.py
# OCR HTTP Sidecar API — รับ POST /ocr แล้วคืนข้อความที่สกัดจาก PDF/Image
# ตาม ADR-023A (revised 2026-06-11): ใช้ np-dms-ocr (Ollama) แทน Tesseract
# Change Log:
# - 2026-05-25: Initial FastAPI server สำหรับ Tesseract OCR sidecar
# - 2026-05-30: เปลี่ยน lang='en' เป็น lang='ch' (CTJK) เพื่อรองรับภาษาไทย
# - 2026-05-30: เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อความเข้ากันได้กับ CPU เก่า
# - 2026-05-30: เพิ่ม OpenCV preprocessing (threshold, denoise) และ DPI 300 เพื่อเพิ่มความแม่นยำ
# - 2026-06-01: เพิ่ม POST /ocr-upload รับ multipart file โดยตรง ไม่ต้องพึ่ง shared volume mount
# - 2026-06-01: เปลี่ยน OCR_MODEL default เป็น scb10x/typhoon-ocr1.5-3b
# - 2026-06-02: เพิ่มตัวเลือกสลับโมเดลใน process_ocr ตามพารามิเตอร์ engine และตั้ง engineUsed ให้ตรงตามจริง (T015, ADR-033)
# - 2026-06-04: ADR-034 — เพิ่ม np-dms-ocr เป็น canonical engine key; default OCR_MODEL เป็น np-dms-ocr:latest; alias โมเดลเก่ายังคงไว้
# - 2026-06-04: ให้ SYSTEM ใน Modelfile ทำงานแทน — ลบ prompt ซ้าซ้อน; sync options ให้ตรงกับ Modelfile (temperature 0.1, top_p 0.1, repeat_penalty 1.1)
# - 2026-06-04: รับค่า temperature/top_p/repeat_penalty จาก frontend sandbox ได้ (optional override)
# - 2026-06-04: แก้ bug prompt="" ทำให้ Ollama ไม่ generate — เปลี่ยนเป็น minimal trigger prompt
# - 2026-06-04: เพิ่ม alias normalization สำหรับ engine name เก่า (typhoon-ocr1.5-3b → np-dms-ocr)
# - 2026-06-04: เพิ่ม OCR_DPI=150 (แยกจาก Tesseract DPI=300) — ลด image token count 4x เพื่อเร่ง CPU inference (model >8GB ไม่พอ VRAM)
# - 2026-06-04: ส่ง color image (ไม่ผ่าน preprocess_image) ไปยัง np-dms-ocr — vision model ต้องการ color ไม่ใช่ binarized grayscale
# - 2026-06-04: เพิ่ม num_gpu:99 ใน Ollama options เพื่อบังคับ GPU layers (แก้ device=CPU ทั้งที่ VRAM พอ)
# - 2026-06-02: เพิ่มการตรวจสอบ API Key (X-API-Key Header) สำหรับ endpoints หลัก เพื่อความมั่นคงปลอดภัยตามข้อเสนอแนะ Code Review
# - 2026-06-05: เพิ่ม Option 2 (aggressive preprocessing: deskew + Otsu threshold + morphology) และ Option 3 (smart post-processing: regex-based hallucination removal) เพื่อลด Tesseract noise/hallucination (T025)
# - 2026-06-06: เปลี่ยน keep_alive จาก 300s เป็น 0 เพื่อ unload model ทันทีหลังเสร็จงาน (แก้ปัญหา VRAM ไม่พอเมื่อ np-dms-ai load พร้อมกัน)
# - 2026-06-11: เปลี่ยน process_ocr ให้ใช้ prepare_ocr_messages จาก typhoon_ocr library + inject DMS tags; เปลี่ยน endpoint เป็น /v1/chat/completions
# - 2026-06-11: US2 & US3 - เพิ่ม keep_alive parameter และ CPU fallback สำหรับ /embed และ /rerank
# - 2026-06-13: ADR-036 — เปลี่ยน canonical engine/model เป็น np-dms-ocr และคง legacy aliases
# - 2026-06-17: เปลี่ยนชื่อ environment variable จาก TYPHOON_OCR_MODEL → OCR_MODEL และ TYPHOON_OCR_TIMEOUT → OCR_TIMEOUT เพื่อ consistency กับ ADR-036
# - 2026-06-17: ลบชื่อ Typhoon ออกจากทุกส่วน: process_with_typhoon_ocr → process_ocr, FastAPI title, comments, ตัวแปรต่างๆ
# - 2026-06-17: เพิ่ม systemPrompt parameter ใน /ocr-upload, _process_pdf_doc, process_ocr เพื่อรองรับ dynamic OCR system prompt injection (T026-T028)
# - 2026-06-18: เพิ่ม MAX_SYSTEM_PROMPT_LENGTH environment variable สำหรับ configurable validation (fix-3)
# - 2026-06-20: ADR-040 Phase 1-4 — ลบ default API key, เพิ่ม path whitelist, และ wire adaptive OCR residency
# - 2026-06-20: ADR-040 Phase 6 — async I/O refactor: async process_ocr, AsyncClient via lifespan, asyncio.to_thread model loading
# - 2026-09-01: ADR-040 D2 — แยก system/user prompt เป็น OpenAI-compatible roles รองรับ userPrompt; effective prompt hash สำหรับ hot-load
# - 2026-07-23: Feature-142 — Prompt cache invalidation: asyncio.Lock + Redis prompt hash + auto unload on prompt change
# - 2026-07-30: ADR-040 D1 — refactor _process_pdf_doc: 'auto' engine เป็น known engine (ลด Unknown warning)
#   - 'auto' ลอง PyMuPDF text layer ก่อน → ถ้าไม่พอ fallback ไป np-dms-ocr โดยตรง (ไม่ใช่ "Unknown engine")
#   - ลบ code duplication ระหว่าง np-dms-ocr block และ Unknown engine fallback block
#   - ทุก engine path นำไปสู่ np-dms-ocr (engine เดียวตาม ADR-040 D1)
# - 2026-07-30: ADR-040 Phase 2 (T016) — ลบ X-API-Key validation ออกจาก sidecar endpoints
#   - เปลี่ยนจาก X-API-Key auth เป็น network isolation (Docker-internal bridge, ADR-041 consolidation complete)
#   - ลบ OCR_SIDECAR_API_KEY env var check, api_key_header, get_api_key function
#   - ลบ Depends(get_api_key) จากทุก endpoint (/ocr, /ocr-upload, /embed, /rerank)
#   - ลบ imports: APIKeyHeader, Security, Depends (คง status ไว้สำหรับ HTTP_403/400)

import os
import logging
import re
import json
import tempfile
import fitz  # PyMuPDF (ใช้สำหรับ page count + fast-path text extraction)
import httpx
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
from typhoon_ocr import prepare_ocr_messages  # External library from SCB10X (PyPI) — provides OCR message preparation for np-dms-ocr
from services.vram_monitor import get_vram_headroom
from services.residency_policy import calculate_ocr_residency
from services.prompt_cache import (
    check_and_unload_if_changed,
    clear_prompt_hash,
    init_redis_client,
)

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from FlagEmbedding import BGEM3FlagModel, FlagReranker


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-sidecar")

# Initialize BGE-M3 and Reranker singletons
bge_model = None
reranker = None
# Shared AsyncClient สำหรับ Ollama API (T043: สร้างใน lifespan context manager)
ollama_client: httpx.AsyncClient | None = None
# Redis client สำหรับ prompt hash storage (Feature-142)
redis_client = None
# asyncio.Lock สำหรับบังคับ sequential OCR processing (FR-008)
ocr_lock = asyncio.Lock()


def _load_bge_models() -> tuple:
    """โหลด BGE-M3 และ Reranker models บน CPU RAM (T046: เรียกผ่าน asyncio.to_thread)"""
    logger.info("Loading BGE-M3 and Reranker models on CPU RAM...")
    try:
        bge = BGEM3FlagModel('BAAI/bge-m3', use_fp16=False)
        rerank = FlagReranker('BAAI/bge-reranker-large', use_fp16=False)
        logger.info("BGE-M3 and Reranker models loaded successfully.")
        return bge, rerank
    except Exception as e:
        logger.error(f"Failed to load BGE models: {e}")
        return None, None


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """T043/T045: Lifespan context manager แทน @app.on_event('startup') — จัดการ AsyncClient และ model loading"""
    global bge_model, reranker, ollama_client, redis_client
    # T043: สร้าง shared AsyncClient สำหรับ Ollama API
    ollama_client = httpx.AsyncClient(timeout=OCR_TIMEOUT)
    logger.info(f"Shared AsyncClient created (timeout={OCR_TIMEOUT}s)")
    # Feature-142: สร้าง Redis client สำหรับ prompt hash storage
    try:
        redis_client = init_redis_client()
        await redis_client.ping()
        logger.info("Redis client connected for prompt cache invalidation")
    except Exception as e:
        logger.warning(f"Redis connection failed — prompt cache invalidation disabled: {e}")
        redis_client = None
    # T046: โหลด models ผ่าน asyncio.to_thread เพื่อไม่ block startup
    bge_model, reranker = await asyncio.to_thread(_load_bge_models)
    yield
    # Cleanup: ปิด AsyncClient และ Redis client
    if ollama_client:
        await ollama_client.aclose()
        logger.info("Shared AsyncClient closed.")
    if redis_client:
        await redis_client.aclose()
        logger.info("Redis client closed.")


app = FastAPI(title="OCR Sidecar", version="2.0.0", lifespan=lifespan)


# กำหนดค่าความยาวสูงสุดของ systemPrompt (fix-3: configurable validation)
MAX_SYSTEM_PROMPT_LENGTH = int(os.getenv("MAX_SYSTEM_PROMPT_LENGTH", "10000"))

# อ่านค่า config จาก environment
OCR_CHAR_THRESHOLD = int(os.getenv("OCR_CHAR_THRESHOLD", "100"))
MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "0"))  # 0 = ทุกหน้า
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://host.docker.internal:11434")
OCR_MODEL = os.getenv("OCR_MODEL", "np-dms-ocr:latest")
OCR_TIMEOUT = int(os.getenv("OCR_TIMEOUT", "360"))  # รองรับ cold-start ~65s + inference ~30s/page
OCR_SIDECAR_UPLOAD_BASE = os.getenv("OCR_SIDECAR_UPLOAD_BASE", "/mnt/uploads")
OCR_ACTIVE_PROFILE = os.getenv("OCR_ACTIVE_PROFILE")

logger.info(f"OCR Sidecar initialized (model={OCR_MODEL}, ollama={OLLAMA_API_URL})")

def filter_ocr_noise(text: str) -> str:
    """กรองสัญลักษณ์ที่ไม่มีความหมายออกจาก Markdown output"""
    lines = text.split("\n")
    filtered = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        alphanumeric_part = re.sub(r'[^\w\u0E00-\u0E7F]', '', line)
        if len(alphanumeric_part) < 2:
            continue
        filtered.append(line)
    return "\n".join(filtered)

def validate_pdf_path(pdf_path: str) -> Path:
    """Canonicalize path และยืนยันว่าอยู่ใต้ OCR_SIDECAR_UPLOAD_BASE"""
    canonical_path = os.path.abspath(os.path.realpath(pdf_path))
    canonical_base = os.path.abspath(os.path.realpath(OCR_SIDECAR_UPLOAD_BASE))
    try:
        common_path = os.path.commonpath([canonical_path, canonical_base])
    except ValueError:
        common_path = ""
    if common_path != canonical_base:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Path outside whitelisted base directory",
        )
    return Path(canonical_path)

class OcrRequest(BaseModel):
    pdfPath: str
    maxPages: Optional[int] = None
    engine: Optional[str] = None
    keep_alive: Optional[int] = None
    runtime_params: Optional[dict] = None
    system_prompt: Optional[str] = None
    user_prompt: Optional[str] = None
    dms_tags: Optional[dict] = None

class OcrResponse(BaseModel):
    text: str
    ocrUsed: bool
    pageCount: int
    charCount: int
    engineUsed: str

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "np-dms-ocr",
        "ocrModel": OCR_MODEL,
        "ollamaUrl": OLLAMA_API_URL,
    }

async def _process_pdf_doc(
    doc: fitz.Document,
    selected_engine: str,
    max_pages: int,
    ocr_options: Optional[dict] = None,
    pdf_path: str | None = None,
    system_prompt: Optional[str] = None,
    user_prompt: Optional[str] = None,
    runtime_params: Optional[dict] = None,
    dms_tags: Optional[dict] = None,
) -> OcrResponse:
    """ประมวลผล fitz.Document ด้วย engine ที่เลือก — shared logic สำหรับ /ocr และ /ocr-upload"""
    ocr_options = ocr_options or {}
    pages_to_process = list(range(min(len(doc), max_pages) if max_pages > 0 else len(doc)))
    page_count = len(pages_to_process)

    # 'auto' engine: ลอง PyMuPDF text layer ก่อน (Fast Path) → ถ้าไม่พอ วิ่ง np-dms-ocr (ADR-040 D1)
    if selected_engine == "auto":
        fast_text_parts = []
        for i in pages_to_process:
            page = doc[i]
            fast_text_parts.append(page.get_text())
        fast_text = "\n".join(fast_text_parts).strip()
        total_chars = len(fast_text)
        if total_chars > OCR_CHAR_THRESHOLD:
            logger.info(f"Auto Fast Path: {total_chars} chars extracted from text layer")
            return OcrResponse(
                text=fast_text,
                ocrUsed=False,
                pageCount=page_count,
                charCount=total_chars,
                engineUsed="fast-path",
            )
        logger.info(f"Auto fallback: text layer only {total_chars} chars (threshold={OCR_CHAR_THRESHOLD}) — using np-dms-ocr")
        # ตกไป np-dms-ocr branch ด้านล่าง (ไม่ใช่ "Unknown engine")

    # np-dms-ocr engine (รวมถึง auto fallback, unknown engine, และ fast-path ที่ไม่มี text layer)
    # ADR-040 D1: engine เดียว np-dms-ocr — ทุก path นำไปสู่ np-dms-ocr
    if selected_engine not in ("np-dms-ocr", "auto"):
        logger.warning(f"Engine '{selected_engine}' — fallback to np-dms-ocr")
    # ใช้ prepare_ocr_messages รับ PDF path โดยตรง — ไม่ต้องแปลง PIL Image อีกต่อไป
    resolved_path = pdf_path or (str(doc.name) if hasattr(doc, 'name') and doc.name else None)
    if not resolved_path:
        raise ValueError("ไม่สามารถหา PDF path — ต้องส่ง pdf_path เข้ามาด้วย")
    ocr_text_parts = []
    for i in pages_to_process:
        ocr_text_parts.append(
            await process_ocr(
                resolved_path,
                page_num=i + 1,
                options_override=ocr_options,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                runtime_params=runtime_params,
                dms_tags=dms_tags,
            )
        )
    ocr_text = filter_ocr_noise("\n".join(ocr_text_parts).strip())
    return OcrResponse(
        text=ocr_text,
        ocrUsed=True,
        pageCount=page_count,
        charCount=len(ocr_text),
        engineUsed="np-dms-ocr",
    )

async def process_ocr(
    pdf_path: str,
    page_num: int = 1,
    options_override: Optional[dict] = None,
    system_prompt: Optional[str] = None,
    user_prompt: Optional[str] = None,
    runtime_params: Optional[dict] = None,
    dms_tags: Optional[dict] = None,
) -> str:
    """เรียก np-dms-ocr ผ่าน Ollama /v1/chat/completions — รับ PDF path โดยตรง ไม่ต้องแปลง PIL Image"""
    # FR-008: asyncio.Lock บังคับ sequential OCR processing — ป้องกัน race condition
    # ระหว่าง unload กับ request ถัดไป (request ถัดไปต้องรอจนกว่า unload + reload + ประมวลผลเสร็จ)
    async with ocr_lock:
        return await _process_ocr_impl(
            pdf_path, page_num, options_override, system_prompt, user_prompt, runtime_params, dms_tags
        )


async def _process_ocr_impl(
    pdf_path: str,
    page_num: int = 1,
    options_override: Optional[dict] = None,
    system_prompt: Optional[str] = None,
    user_prompt: Optional[str] = None,
    runtime_params: Optional[dict] = None,
    dms_tags: Optional[dict] = None,
) -> str:
    """Implementation ของ process_ocr — ทำงานภายใต้ ocr_lock (FR-008)

    ADR-040 D2: แยก system prompt / user prompt เป็น OpenAI-compatible roles
    - system message: backend ocr_system template + DMS tags
    - user message: typhoon_ocr structure prompt (หรือ backend user_prompt ถ้ามี) + image
    ป้องกัน model อ่าน prompt เป็นส่วนหนึ่งของเอกสารแล้ว echo กลับ
    """
    options_override = options_override or {}
    if "keep_alive" in options_override:
        raise ValueError("keep_alive must be calculated by OCR residency policy")
    residency = await asyncio.to_thread(calculate_ocr_residency, OCR_ACTIVE_PROFILE)
    model_name = OCR_MODEL

    # สร้าง DMS tags text ก่อนเพื่อรวมใน effective prompt
    if dms_tags:
        dms_text = "Additionally:\n"
        for key in dms_tags.keys():
            readable_name = re.sub(r'(?<!^)(?=[A-Z])|_', ' ', key).lower()
            dms_text += f"- Wrap {readable_name} with <{key}>...</{key}>\n"
        dms_text += "If a field is not found, omit the tag."
    else:
        # Fallback to default DMS extraction tags
        dms_text = (
            "Additionally:\n"
            "- Wrap document number with <document_number>...</document_number>\n"
            "- Wrap document date with <document_date>...</document_date>\n"
            "- Wrap received date with <received_date>...</received_date>\n"
            "If a field is not found, omit the tag."
        )

    # สร้าง user prompt จาก typhoon_ocr หรือ backend override
    # prepare_ocr_messages จัดการ PDF → image ผ่าน poppler/pdftoppm ภายใน
    base_messages = prepare_ocr_messages(pdf_path, task_type="structure", page_num=page_num)
    base_image_content = None
    base_user_prompt = ""
    for item in base_messages[0].get("content", []):
        if item.get("type") == "image_url":
            base_image_content = item
        elif item.get("type") == "text":
            base_user_prompt = item.get("text", "")

    chosen_user_prompt = user_prompt.strip() if user_prompt else base_user_prompt

    # effective prompt สำหรับ hash = ทั้ง system + user + dms tags
    effective_system = (system_prompt or "").strip()
    if dms_text:
        effective_system = f"{effective_system}\n\n{dms_text}".strip() if effective_system else dms_text
    effective_prompt = f"[SYSTEM]\n{effective_system}\n\n[USER]\n{chosen_user_prompt}"

    # Feature-142: Prompt cache invalidation — ตรวจจับ prompt เปลี่ยน และ unload ก่อน inference
    # ทำหลัง residency calculation เพื่อให้ log แสดง keep_alive context (T015)
    if redis_client is not None:
        await check_and_unload_if_changed(
            system_prompt=system_prompt,
            model_name=model_name,
            ollama_url=OLLAMA_API_URL,
            redis_client=redis_client,
            ollama_client=ollama_client,
            effective_prompt=effective_prompt,
        )
        # T015: log residency decision ควบคู่กับ prompt hash comparison สำหรับ debug บน New Server
        from services.prompt_cache import compute_prompt_hash
        current_hash = compute_prompt_hash(effective_prompt)
        logger.info(
            f"OCR residency + prompt cache: keep_alive={residency.keep_alive_seconds}s "
            f"reason={residency.reason} headroom={residency.vram_headroom_mb}MB "
            f"prompt_hash={current_hash}"
        )
    else:
        logger.info(
            f"OCR residency decision: keep_alive={residency.keep_alive_seconds}s "
            f"reason={residency.reason} headroom={residency.vram_headroom_mb}MB "
            f"(prompt cache disabled — no Redis)"
        )

    # สร้าง OpenAI-compatible messages แบบ system/user แยกกัน
    messages = []
    if effective_system:
        messages.append({"role": "system", "content": effective_system})
    user_content = [{"type": "text", "text": chosen_user_prompt}]
    if base_image_content:
        user_content.append(base_image_content)
    messages.append({"role": "user", "content": user_content})

    # Resolve runtime parameters: remove hardcoded fallback values from sidecar
    # Use empty dict if runtime_params not provided to allow Ollama Modelfile default
    params = {}
    if runtime_params:
        if hasattr(runtime_params, "dict"):
            params = runtime_params.dict()
        elif isinstance(runtime_params, dict):
            params = runtime_params

    # Options override (e.g., from Sandbox form parameter overrides) takes precedence
    merged_params = {}
    if params:
        merged_params.update(params)
    if options_override:
        merged_params.update(options_override)

    # ค่า default ตาม official; options_override ยัง override ได้บางส่วน
    payload = {
        "model": model_name,
        "messages": messages,
        "stream": False,
        "keep_alive": residency.keep_alive_seconds,
    }

    # Only send keys to Ollama if they are defined in merged_params (to support Modelfile fallback)
    if "temperature" in merged_params and merged_params["temperature"] is not None:
        payload["temperature"] = float(merged_params["temperature"])
    if "top_p" in merged_params and merged_params["top_p"] is not None:
        payload["top_p"] = float(merged_params["top_p"])
    if "repeat_penalty" in merged_params and merged_params["repeat_penalty"] is not None:
        payload["repetition_penalty"] = float(merged_params["repeat_penalty"])
    elif "repetition_penalty" in merged_params and merged_params["repetition_penalty"] is not None:
        payload["repetition_penalty"] = float(merged_params["repetition_penalty"])
    if "max_tokens" in merged_params and merged_params["max_tokens"] is not None:
        payload["max_tokens"] = int(merged_params["max_tokens"])

    # T044: ใช้ shared AsyncClient (ollama_client) แทน httpx.Client แบบ sync
    # ถ้า ollama_client ยังไม่ถูกสร้าง (เช่น unit test ที่เรียกตรง) ให้สร้างชั่วคราว
    client = ollama_client
    if client is None:
        client = httpx.AsyncClient(timeout=OCR_TIMEOUT)
    try:
        response = await client.post(
            f"{OLLAMA_API_URL}/v1/chat/completions",
            json=payload,
            headers={"Authorization": "Bearer ollama"},
        )
        response.raise_for_status()
    except Exception as e:
        # T018: Edge case — Ollama ล่มหรือรีสตาร์ทระหว่างประมวลผล
        # ล้าง Redis hash เพื่อบังคับ first-request behavior ใน retry ถัดไป
        if redis_client is not None:
            await clear_prompt_hash(redis_client, model_name)
        logger.warning(
            f"Ollama inference failed — cleared prompt hash for retry. "
            f"model={model_name} error={e}"
        )
        raise
    data = response.json()
    raw_text = str(data.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
    # parse JSON output จาก model (format: {"natural_text": "..."})
    try:
        result_text = json.loads(raw_text).get("natural_text", raw_text)
    except (json.JSONDecodeError, AttributeError):
        result_text = raw_text
    logger.info(
        f"[DIAG] Ollama response — model={model_name} "
        f"textLen={len(result_text)} "
        f"done={data.get('done')} "
        f"done_reason={data.get('done_reason')} "
        f"eval_count={data.get('eval_count', 0)}"
    )
    if not result_text:
        logger.warning(
            f"[DIAG] Ollama returned empty response — full response keys: {list(data.keys())}"
        )
    # ปิด temporary client ถ้าสร้างชั่วคราว
    if ollama_client is None:
        await client.aclose()
    return result_text

@app.post("/ocr", response_model=OcrResponse)
async def ocr_extract(req: OcrRequest):
    """OCR จาก path (legacy — ใช้เมื่อ sidecar และ backend เข้าถึง storage เดียวกัน)"""
    if req.keep_alive is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="keep_alive is managed by OCR residency policy")
    pdf_path = validate_pdf_path(req.pdfPath)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"ไม่พบไฟล์: {req.pdfPath}")
    selected_engine = (req.engine or "auto").strip().lower()
    max_pages = req.maxPages or MAX_PAGES
    ocr_options = {}
    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"เปิดไฟล์ PDF ล้มเหลว: {e}")
    return await _process_pdf_doc(
        doc,
        selected_engine,
        max_pages,
        ocr_options,
        pdf_path=str(pdf_path),
        system_prompt=req.system_prompt,
        user_prompt=req.user_prompt,
        runtime_params=req.runtime_params,
        dms_tags=req.dms_tags,
    )

@app.post("/ocr-upload", response_model=OcrResponse)
async def ocr_upload(
    file: UploadFile = File(...),
    engine: str = Form(default="auto"),
    maxPages: int = Form(default=0),
    temperature: Optional[float] = Form(default=None),
    topP: Optional[float] = Form(default=None),
    repeatPenalty: Optional[float] = Form(default=None),
    maxTokens: Optional[int] = Form(default=None),
    keep_alive: Optional[int] = Form(default=None),
    systemPrompt: Optional[str] = Form(default=None),
    userPrompt: Optional[str] = Form(default=None),
    dmsTags: Optional[str] = Form(default=None),
    runtimeParams: Optional[str] = Form(default=None),
):
    """OCR จาก multipart file upload — ไม่ต้องการ shared volume mount"""
    # Validate systemPrompt / userPrompt ถ้ามีส่งมา (gap-1: sidecar validation)
    if systemPrompt is not None:
        systemPrompt = systemPrompt.strip()
        if not systemPrompt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="systemPrompt cannot be empty if provided"
            )
        if len(systemPrompt) > MAX_SYSTEM_PROMPT_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"systemPrompt exceeds maximum length of {MAX_SYSTEM_PROMPT_LENGTH} characters"
            )
    if userPrompt is not None:
        userPrompt = userPrompt.strip()
        if userPrompt and len(userPrompt) > MAX_SYSTEM_PROMPT_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"userPrompt exceeds maximum length of {MAX_SYSTEM_PROMPT_LENGTH} characters"
            )
    selected_engine = engine.strip().lower()
    max_pages = maxPages or MAX_PAGES

    # Parse runtimeParams and dmsTags from form-data JSON strings if provided
    runtime_params_dict = {}
    if runtimeParams:
        try:
            runtime_params_dict = json.loads(runtimeParams)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid runtimeParams JSON: {e}"
            )

    dms_tags_dict = None
    if dmsTags:
        try:
            dms_tags_dict = json.loads(dmsTags)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid dmsTags JSON: {e}"
            )

    # รวม options override สำหรับ np-dms-ocr (ถ้า frontend ส่งมา)
    ocr_options: dict = {}
    if temperature is not None:
        ocr_options["temperature"] = temperature
    if topP is not None:
        ocr_options["top_p"] = topP
    if repeatPenalty is not None:
        ocr_options["repeat_penalty"] = repeatPenalty
    if maxTokens is not None:
        ocr_options["max_tokens"] = maxTokens
    if keep_alive is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="keep_alive is managed by OCR residency policy")
    # SEC-3: ตรวจสอบขนาดไฟล์ (max 50MB — ตรงกับ backend whitelist)
    MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
    file_size = getattr(file, 'size', None)
    if file_size is None:
        # อ่าน content แล้ววัดขนาด (fallback สำหรับ SpooledTemporaryFile)
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large: {file_size} bytes (max {MAX_FILE_SIZE_BYTES} bytes)"
        )
    # SEC-4: ตรวจสอบ file type ด้วย magic bytes (PDF = %PDF)
    pdf_bytes = file.file.read()
    if not pdf_bytes.startswith(b'%PDF'):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Invalid file type: only PDF files are accepted"
        )
    tmp_pdf_path: str | None = None
    try:
        # บันทึก PDF เป็น temp file เพื่อให้ prepare_ocr_messages อ่านได้ผ่าน path
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_pdf_path = tmp.name
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"เปิดไฟล์ PDF ล้มเหลว: {e}")
        logger.info(f"OCR upload: {file.filename} engine={selected_engine} options={ocr_options or 'modelfile-defaults'}")
        return await _process_pdf_doc(
            doc,
            selected_engine,
            max_pages,
            ocr_options,
            pdf_path=tmp_pdf_path,
            system_prompt=systemPrompt,
            user_prompt=userPrompt,
            runtime_params=runtime_params_dict,
            dms_tags=dms_tags_dict,
        )
    finally:
        if tmp_pdf_path:
            Path(tmp_pdf_path).unlink(missing_ok=True)

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    dense: list[float]
    sparse: dict
    device: Optional[str] = None

class RerankRequest(BaseModel):
    query: str
    chunks: list[str]

class RerankResponse(BaseModel):
    scores: list[float]
    ranked_indices: list[int]
    device: Optional[str] = None

@app.post("/embed", response_model=EmbedResponse)
async def embed_text(req: EmbedRequest):
    """BGE-M3 embedding generator (Dense + Sparse) พร้อม CPU fallback และ timeout guard"""
    if bge_model is None:
        raise HTTPException(status_code=503, detail="BGE-M3 model not loaded")
    threshold_mb = float(os.getenv("VRAM_HEADROOM_THRESHOLD_MB", "3000.0"))
    timeout_sec = float(os.getenv("RETRIEVAL_TIMEOUT_SECONDS", "30.0"))
    headroom = await asyncio.to_thread(get_vram_headroom)
    device = "cuda"
    reason = "headroom-sufficient"
    if not headroom.query_success:
        device = "cpu"
        reason = "gpu-query-failed"
    elif headroom.available_mb < threshold_mb:
        device = "cpu"
        reason = "gpu-headroom-below-threshold"
    try:
        if device == "cuda":
            import torch
            if torch.cuda.is_available():
                bge_model.model.to("cuda")
            else:
                device = "cpu"
                reason = "cuda-not-available"
                bge_model.model.to("cpu")
        else:
            bge_model.model.to("cpu")
    except Exception as e:
        logger.warning(f"Failed to move BGE-M3 model to {device}: {e}")
        device = "cpu"
        reason = f"device-move-failed: {str(e)}"
        try:
            bge_model.model.to("cpu")
        except Exception:
            pass
    logger.info(f"Embedding on device: {device} (reason: {reason})")
    def run_inference():
        output = bge_model.encode([req.text], return_dense=True, return_sparse=True)
        dense_vector = [float(x) for x in output['dense_vecs'][0]]
        lexical_dict = output['lexical_weights'][0]
        indices = []
        values = []
        for token_id, weight in lexical_dict.items():
            indices.append(int(token_id))
            values.append(float(weight))
        return dense_vector, indices, values
    try:
        dense_vector, indices, values = await asyncio.wait_for(
            asyncio.to_thread(run_inference),
            timeout=timeout_sec
        )
        return EmbedResponse(
            dense=dense_vector,
            sparse={"indices": indices, "values": values},
            device=device
        )
    except asyncio.TimeoutError:
        logger.error(f"Embedding generation timed out after {timeout_sec}s on device {device}")
        raise HTTPException(status_code=504, detail="Embedding generation timed out")
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

@app.post("/rerank", response_model=RerankResponse)
async def rerank_chunks(req: RerankRequest):
    """BGE-Reranker-Large chunk re-ranker พร้อม CPU fallback และ timeout guard"""
    if reranker is None:
        raise HTTPException(status_code=503, detail="Reranker model not loaded")
    if not req.chunks:
        return RerankResponse(scores=[], ranked_indices=[], device="cpu")
    threshold_mb = float(os.getenv("VRAM_HEADROOM_THRESHOLD_MB", "3000.0"))
    timeout_sec = float(os.getenv("RETRIEVAL_TIMEOUT_SECONDS", "30.0"))
    headroom = await asyncio.to_thread(get_vram_headroom)
    device = "cuda"
    reason = "headroom-sufficient"
    if not headroom.query_success:
        device = "cpu"
        reason = "gpu-query-failed"
    elif headroom.available_mb < threshold_mb:
        device = "cpu"
        reason = "gpu-headroom-below-threshold"
    try:
        if device == "cuda":
            import torch
            if torch.cuda.is_available():
                reranker.model.to("cuda")
            else:
                device = "cpu"
                reason = "cuda-not-available"
                reranker.model.to("cpu")
        else:
            reranker.model.to("cpu")
    except Exception as e:
        logger.warning(f"Failed to move Reranker model to {device}: {e}")
        device = "cpu"
        reason = f"device-move-failed: {str(e)}"
        try:
            reranker.model.to("cpu")
        except Exception:
            pass
    logger.info(f"Reranking on device: {device} (reason: {reason})")
    def run_rerank():
        pairs = [[req.query, chunk] for chunk in req.chunks]
        scores = reranker.compute_score(pairs)
        if isinstance(scores, float):
            scores = [scores]
        else:
            scores = [float(s) for s in scores]
        indexed_scores = list(enumerate(scores))
        indexed_scores.sort(key=lambda x: x[1], reverse=True)
        ranked_indices = [idx for idx, _ in indexed_scores]
        return scores, ranked_indices
    try:
        scores, ranked_indices = await asyncio.wait_for(
            asyncio.to_thread(run_rerank),
            timeout=timeout_sec
        )
        return RerankResponse(
            scores=scores,
            ranked_indices=ranked_indices,
            device=device
        )
    except asyncio.TimeoutError:
        logger.error(f"Reranking timed out after {timeout_sec}s on device {device}")
        raise HTTPException(status_code=504, detail="Reranking timed out")
    except Exception as e:
        logger.error(f"Reranking failed: {e}")
        raise HTTPException(status_code=500, detail=f"Reranking failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("OCR_PORT", "8765"))
    uvicorn.run(app, host="0.0.0.0", port=port)
