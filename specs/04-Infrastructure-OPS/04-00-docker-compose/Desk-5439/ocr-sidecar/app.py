# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
# Typhoon OCR HTTP Sidecar API — รับ POST /ocr แล้วคืนข้อความที่สกัดจาก PDF/Image
# ตาม ADR-023A (revised 2026-06-11): ใช้ typhoon_ocr library + np-dms-ocr (Ollama) แทน Tesseract
# Change Log:
# - 2026-05-25: Initial FastAPI server สำหรับ Tesseract OCR sidecar
# - 2026-05-30: เปลี่ยน lang='en' เป็น lang='ch' (CTJK) เพื่อรองรับภาษาไทย
# - 2026-05-30: เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อความเข้ากันได้กับ CPU เก่า
# - 2026-05-30: เพิ่ม OpenCV preprocessing (threshold, denoise) และ DPI 300 เพื่อเพิ่มความแม่นยำ
# - 2026-06-01: เพิ่ม POST /ocr-upload รับ multipart file โดยตรง ไม่ต้องพึ่ง shared volume mount
# - 2026-06-01: เปลี่ยน TYPHOON_OCR_MODEL default เป็น scb10x/typhoon-ocr1.5-3b
# - 2026-06-02: เพิ่มตัวเลือกสลับโมเดลใน process_with_typhoon_ocr ตามพารามิเตอร์ engine และตั้ง engineUsed ให้ตรงตามจริง (T015, ADR-033)
# - 2026-06-04: ADR-034 — เพิ่ม typhoon-np-dms-ocr เป็น canonical engine key; default TYPHOON_OCR_MODEL เปวน typhoon-np-dms-ocr:latest; alias โมเดลเก่ายังคงไว้
# - 2026-06-04: ให้ SYSTEM ใน Modelfile ทำงานแทน — ลบ prompt ซ้าซ้อน; sync options ให้ตรงกับ Modelfile (temperature 0.1, top_p 0.1, repeat_penalty 1.1)
# - 2026-06-04: รับค่า temperature/top_p/repeat_penalty จาก frontend sandbox ได้ (optional override)
# - 2026-06-04: แก้ bug prompt="" ทำให้ Ollama ไม่ generate — เปลี่ยนเป็น minimal trigger prompt
# - 2026-06-04: เพิ่ม alias normalization สำหรับ engine name เก่า (typhoon-ocr1.5-3b → typhoon-np-dms-ocr)
# - 2026-06-04: เพิ่ม TYPHOON_OCR_DPI=150 (แยกจาก Tesseract DPI=300) — ลด image token count 4x เพื่อเร่ง CPU inference (model >8GB ไม่พอ VRAM)
# - 2026-06-04: ส่ง color image (ไม่ผ่าน preprocess_image) ไปยัง Typhoon OCR — vision model ต้องการ color ไม่ใช่ binarized grayscale
# - 2026-06-04: เพิ่ม num_gpu:99 ใน Ollama options เพื่อบังคับ GPU layers (แก้ device=CPU ทั้งที่ VRAM พอ)
# - 2026-06-02: เพิ่มการตรวจสอบ API Key (X-API-Key Header) สำหรับ endpoints หลัก เพื่อความมั่นคงปลอดภัยตามข้อเสนอแนะ Code Review
# - 2026-06-05: เพิ่ม Option 2 (aggressive preprocessing: deskew + Otsu threshold + morphology) และ Option 3 (smart post-processing: regex-based hallucination removal) เพื่อลด Tesseract noise/hallucination (T025)
# - 2026-06-06: เปลี่ยน keep_alive จาก 300s เป็น 0 เพื่อ unload model ทันทีหลังเสร็จงาน (แก้ปัญหา VRAM ไม่พอเมื่อ typhoon2.5-np-dms load พร้อมกัน)
# - 2026-06-11: เปลี่ยน process_with_typhoon_ocr ให้ใช้ prepare_ocr_messages จาก typhoon_ocr library + inject DMS tags; เปลี่ยน endpoint เป็น /v1/chat/completions
# - 2026-06-11: US2 & US3 - เพิ่ม keep_alive parameter และ CPU fallback สำหรับ /embed และ /rerank
# - 2026-06-13: ADR-036 — เปลี่ยน canonical engine/model เป็น np-dms-ocr และคง legacy aliases

import os
import logging
import re
import base64
import json
import tempfile
import fitz  # PyMuPDF (ใช้สำหรับ page count + fast-path text extraction)
import httpx
import asyncio
from pathlib import Path
from typing import Optional
from PIL import Image
import io
from typhoon_ocr import prepare_ocr_messages
from services.vram_monitor import get_vram_headroom

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Security, status
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from pythainlp.tokenize import word_tokenize
from pythainlp.util import normalize as thai_normalize
from FlagEmbedding import BGEM3FlagModel, FlagReranker


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-sidecar")

app = FastAPI(title="Typhoon OCR Sidecar", version="2.0.0")

# Initialize BGE-M3 and Reranker singletons
bge_model = None
reranker = None

@app.on_event("startup")
def load_bge_models():
    global bge_model, reranker
    logger.info("Loading BGE-M3 and Reranker models on CPU RAM...")
    try:
        # BGE-M3: BAAI/bge-m3, use_fp16=False for CPU
        bge_model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=False)
        # Reranker: BAAI/bge-reranker-large, use_fp16=False for CPU
        reranker = FlagReranker('BAAI/bge-reranker-large', use_fp16=False)
        logger.info("BGE-M3 and Reranker models loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load BGE models: {e}")


# กำหนดค่าโทเค็นความปลอดภัยของ Sidecar ตามข้อเสนอแนะในการรักษาความมั่นคงปลอดภัย
OCR_SIDECAR_API_KEY = os.getenv("OCR_SIDECAR_API_KEY", "lcbp3-dms-ocr-sidecar-secure-token-2026")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
async def get_api_key(api_key: str = Security(api_key_header)):
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API Key in request headers (X-API-Key)")
    if api_key != OCR_SIDECAR_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API Key")
    return api_key

# อ่านค่า config จาก environment
OCR_CHAR_THRESHOLD = int(os.getenv("OCR_CHAR_THRESHOLD", "100"))
MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "0"))  # 0 = ทุกหน้า
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://host.docker.internal:11434")
TYPHOON_OCR_MODEL = os.getenv("TYPHOON_OCR_MODEL", "np-dms-ocr:latest")
TYPHOON_OCR_TIMEOUT = int(os.getenv("TYPHOON_OCR_TIMEOUT", "360"))  # รองรับ cold-start ~65s + inference ~30s/page

logger.info(f"Typhoon OCR Sidecar initialized (model={TYPHOON_OCR_MODEL}, ollama={OLLAMA_API_URL})")

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

class OcrRequest(BaseModel):
    pdfPath: str
    maxPages: Optional[int] = None
    engine: Optional[str] = None
    keep_alive: Optional[int] = None

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
        "typhoonModel": TYPHOON_OCR_MODEL,
        "ollamaUrl": OLLAMA_API_URL,
    }

# alias map สำหรับ engine name เก่า → canonical name
_ENGINE_ALIASES: dict[str, str] = {
    "typhoon-ocr1.5-3b": "np-dms-ocr",
    "typhoon-ocr-3b": "np-dms-ocr",
    "typhoon_ocr": "np-dms-ocr",
    "typhoon-np-dms-ocr": "np-dms-ocr",
}

def _process_pdf_doc(doc: fitz.Document, selected_engine: str, max_pages: int, typhoon_options: dict = {}, pdf_path: str | None = None) -> OcrResponse:
    """ประมวลผล fitz.Document ด้วย engine ที่เลือก — shared logic สำหรับ /ocr และ /ocr-upload"""
    selected_engine = _ENGINE_ALIASES.get(selected_engine, selected_engine)
    pages_to_process = list(range(min(len(doc), max_pages) if max_pages > 0 else len(doc)))
    page_count = len(pages_to_process)

    fast_text_parts = []
    total_chars = 0
    if selected_engine == "auto":
        for i in pages_to_process:
            page = doc[i]
            fast_text_parts.append(page.get_text())
        fast_text = "\n".join(fast_text_parts).strip()
        total_chars = len(fast_text)
        if total_chars > OCR_CHAR_THRESHOLD:
            logger.info(f"Fast path: {total_chars} chars extracted")
            return OcrResponse(
                text=fast_text,
                ocrUsed=False,
                pageCount=page_count,
                charCount=total_chars,
                engineUsed="fast-path",
            )

    if selected_engine == "np-dms-ocr":
        # ใช้ prepare_ocr_messages รับ PDF path โดยตรง — ไม่ต้องแปลง PIL Image อีกต่อไป
        resolved_path = pdf_path or (str(doc.name) if hasattr(doc, 'name') and doc.name else None)
        if not resolved_path:
            raise ValueError("ไม่สามารถหา PDF path — ต้องส่ง pdf_path เข้ามาด้วย")
        typhoon_text_parts = []
        for i in pages_to_process:
            typhoon_text_parts.append(process_with_typhoon_ocr(resolved_path, page_num=i + 1, options_override=typhoon_options))
        typhoon_text = filter_ocr_noise("\n".join(typhoon_text_parts).strip())
        return OcrResponse(
            text=typhoon_text,
            ocrUsed=True,
            pageCount=page_count,
            charCount=len(typhoon_text),
            engineUsed=selected_engine,
        )

    # ถ้าไม่ใช่ engine ที่รู้จัก ให้ใช้ np-dms-ocr เป็น fallback
    logger.warning(f"Unknown engine '{selected_engine}' — fallback to np-dms-ocr")
    resolved_path = pdf_path or (str(doc.name) if hasattr(doc, 'name') and doc.name else None)
    if not resolved_path:
        raise ValueError("ไม่สามารถหา PDF path — ต้องส่ง pdf_path เข้ามาด้วย")
    fallback_parts = []
    for i in pages_to_process:
        fallback_parts.append(process_with_typhoon_ocr(resolved_path, page_num=i + 1, options_override=typhoon_options))
    fallback_text = filter_ocr_noise("\n".join(fallback_parts).strip())
    return OcrResponse(
        text=fallback_text,
        ocrUsed=True,
        pageCount=page_count,
        charCount=len(fallback_text),
        engineUsed="np-dms-ocr",
    )

def process_with_typhoon_ocr(pdf_path: str, page_num: int = 1, options_override: dict = {}) -> str:
    """เรียก Typhoon OCR ผ่าน Ollama /v1/chat/completions — รับ PDF path โดยตรง ไม่ต้องแปลง PIL Image"""
    model_name = TYPHOON_OCR_MODEL
    # prepare_ocr_messages จัดการ PDF → image ผ่าน poppler/pdftoppm ภายใน
    messages = prepare_ocr_messages(pdf_path, task_type="structure", page_num=page_num)
    # inject DMS-specific extraction tags ต่อท้าย content
    messages[0]["content"].append({
        "type": "text",
        "text": (
            "Additionally:\n"
            "- Wrap document number with <document_number>...</document_number>\n"
            "- Wrap document date with <document_date>...</document_date>\n"
            "- Wrap received date with <received_date>...</received_date>\n"
            "If a field is not found, omit the tag."
        ),
    })
    # ค่า default ตาม official; options_override ยัง override ได้บางส่วน
    payload = {
        "model": model_name,
        "messages": messages,
        "max_tokens": 16000,
        "stream": False,
        "repetition_penalty": options_override.get("repeat_penalty", 1.2),
        "temperature": options_override.get("temperature", 0.1),
        "top_p": options_override.get("top_p", 0.6),
        "keep_alive": options_override.get("keep_alive", 0),  # Unload model ทันทีหลังเสร็จงานเพื่อคืน VRAM ให้ np-dms-ai ใช้งานได้
    }
    # ใช้ Ollama OpenAI-compatible endpoint (/v1/chat/completions)
    with httpx.Client(timeout=TYPHOON_OCR_TIMEOUT) as client:
        response = client.post(
            f"{OLLAMA_API_URL}/v1/chat/completions",
            json=payload,
            headers={"Authorization": "Bearer ollama"},
        )
        response.raise_for_status()
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
        return result_text

@app.post("/ocr", response_model=OcrResponse, dependencies=[Depends(get_api_key)])
def ocr_extract(req: OcrRequest):
    """OCR จาก path (legacy — ใช้เมื่อ sidecar และ backend เข้าถึง storage เดียวกัน)"""
    pdf_path = Path(req.pdfPath)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"ไม่พบไฟล์: {req.pdfPath}")
    selected_engine = (req.engine or "auto").strip().lower()
    max_pages = req.maxPages or MAX_PAGES
    typhoon_options = {}
    if req.keep_alive is not None:
        typhoon_options["keep_alive"] = req.keep_alive
    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"เปิดไฟล์ PDF ล้มเหลว: {e}")
    return _process_pdf_doc(doc, selected_engine, max_pages, typhoon_options)

@app.post("/ocr-upload", response_model=OcrResponse, dependencies=[Depends(get_api_key)])
def ocr_upload(
    file: UploadFile = File(...),
    engine: str = Form(default="auto"),
    maxPages: int = Form(default=0),
    temperature: Optional[float] = Form(default=None),
    topP: Optional[float] = Form(default=None),
    repeatPenalty: Optional[float] = Form(default=None),
    keep_alive: Optional[int] = Form(default=None),
):
    """OCR จาก multipart file upload — ไม่ต้องการ shared volume mount"""
    selected_engine = engine.strip().lower()
    max_pages = maxPages or MAX_PAGES
    # รวม options override สำหรับ Typhoon OCR (ถ้า frontend ส่งมา)
    typhoon_options: dict = {}
    if temperature is not None:
        typhoon_options["temperature"] = temperature
    if topP is not None:
        typhoon_options["top_p"] = topP
    if repeatPenalty is not None:
        typhoon_options["repeat_penalty"] = repeatPenalty
    if keep_alive is not None:
        typhoon_options["keep_alive"] = keep_alive
    pdf_bytes = file.file.read()
    import tempfile
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
        logger.info(f"OCR upload: {file.filename} engine={selected_engine} options={typhoon_options or 'modelfile-defaults'}")
        return _process_pdf_doc(doc, selected_engine, max_pages, typhoon_options, pdf_path=tmp_pdf_path)
    finally:
        if tmp_pdf_path:
            Path(tmp_pdf_path).unlink(missing_ok=True)

class NormalizeRequest(BaseModel):
    text: str

class NormalizeResponse(BaseModel):
    normalized: str

@app.post("/normalize", response_model=NormalizeResponse, dependencies=[Depends(get_api_key)])
def normalize_text(req: NormalizeRequest):
    """Normalize Thai text ด้วย PyThaiNLP สำหรับ rag-thai-preprocess queue"""
    try:
        # normalize unicode + ตัดคำแล้วต่อกลับด้วย space เพื่อ embedding
        normalized = thai_normalize(req.text)
        tokens = word_tokenize(normalized, engine="newmm", keep_whitespace=False)
        result = " ".join(tokens)
        return NormalizeResponse(normalized=result)
    except Exception as e:
        logger.warning(f"Thai normalize failed, returning raw text: {e}")
        return NormalizeResponse(normalized=req.text)
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

@app.post("/embed", response_model=EmbedResponse, dependencies=[Depends(get_api_key)])
async def embed_text(req: EmbedRequest):
    """BGE-M3 embedding generator (Dense + Sparse) พร้อม CPU fallback และ timeout guard"""
    if bge_model is None:
        raise HTTPException(status_code=503, detail="BGE-M3 model not loaded")
    threshold_mb = float(os.getenv("VRAM_HEADROOM_THRESHOLD_MB", "3000.0"))
    timeout_sec = float(os.getenv("RETRIEVAL_TIMEOUT_SECONDS", "30.0"))
    headroom = get_vram_headroom()
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

@app.post("/rerank", response_model=RerankResponse, dependencies=[Depends(get_api_key)])
async def rerank_chunks(req: RerankRequest):
    """BGE-Reranker-Large chunk re-ranker พร้อม CPU fallback และ timeout guard"""
    if reranker is None:
        raise HTTPException(status_code=503, detail="Reranker model not loaded")
    if not req.chunks:
        return RerankResponse(scores=[], ranked_indices=[], device="cpu")
    threshold_mb = float(os.getenv("VRAM_HEADROOM_THRESHOLD_MB", "3000.0"))
    timeout_sec = float(os.getenv("RETRIEVAL_TIMEOUT_SECONDS", "30.0"))
    headroom = get_vram_headroom()
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
