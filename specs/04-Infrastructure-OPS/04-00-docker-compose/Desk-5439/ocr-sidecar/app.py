# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
# Tesseract OCR HTTP Sidecar API — รับ POST /ocr แล้วคืนข้อความที่สกัดจาก PDF/Image
# ตาม ADR-023A: OCR auto-detect (PyMuPDF chars > 100 → Fast path, else Tesseract)
# Change Log:
# - 2026-05-25: Initial FastAPI server สำหรับ PaddleOCR sidecar
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
# - 2026-06-04: เปลี่ยน keep_alive จาก 0 เป็น 300s เพื่อไม่ให้ unload model ระหว่าง sandbox session (ลด cold-start)
# - 2026-06-04: เพิ่ม TYPHOON_OCR_DPI=150 (แยกจาก Tesseract DPI=300) — ลด image token count 4x เพื่อเร่ง CPU inference (model >8GB ไม่พอ VRAM)
# - 2026-06-04: ส่ง color image (ไม่ผ่าน preprocess_image) ไปยัง Typhoon OCR — vision model ต้องการ color ไม่ใช่ binarized grayscale
# - 2026-06-04: เพิ่ม num_gpu:99 ใน Ollama options เพื่อบังคับ GPU layers (แก้ device=CPU ทั้งที่ VRAM พอ)
# - 2026-06-02: เพิ่มการตรวจสอบ API Key (X-API-Key Header) สำหรับ endpoints หลัก เพื่อความมั่นคงปลอดภัยตามข้อเสนอแนะ Code Review
# - 2026-06-05: เพิ่ม Option 2 (aggressive preprocessing: deskew + Otsu threshold + morphology) และ Option 3 (smart post-processing: regex-based hallucination removal) เพื่อลด Tesseract noise/hallucination (T025)

import os
import logging
import re
import base64
import fitz  # PyMuPDF
import httpx
from pathlib import Path
from typing import Optional
from PIL import Image
import pytesseract
import io
import cv2
import numpy as np

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Security, status
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from pythainlp.tokenize import word_tokenize
from pythainlp.util import normalize as thai_normalize

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-sidecar")

app = FastAPI(title="Tesseract OCR Sidecar", version="1.0.0")

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
OCR_LANG = os.getenv("OCR_LANG", "tha+eng")  # Tesseract language code (tha+eng = Thai + English)
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://host.docker.internal:11434")
TYPHOON_OCR_MODEL = os.getenv("TYPHOON_OCR_MODEL", "typhoon-np-dms-ocr:latest")
TYPHOON_OCR_TIMEOUT = int(os.getenv("TYPHOON_OCR_TIMEOUT", "360"))  # รองรับ cold-start ~65s + inference ~30s/page
# DPI สำหรับ Typhoon OCR — ต่ำกว่า Tesseract เพราะ vision model ใช้ image patches (150 DPI ลด token ~4x)
TYPHOON_OCR_DPI = int(os.getenv("TYPHOON_OCR_DPI", "150"))
# PSM mode: 3 (default, fully automatic) หรือ 6 (assume single column, ลด noise)
TESSERACT_PSM = os.getenv("TESSERACT_PSM", "3")
# PSM 3 = Fully automatic page segmentation (เหมาะกับเอกสารที่มี layout หลายส่วน เช่น วันที่/เลขที่)
# PSM 6 = Assume single column of text (ลด hallucination จาก noise)
# OEM 1 = LSTM only (ดีกว่า legacy engine)
TESSERACT_CONFIG = f"--psm {TESSERACT_PSM} --oem 1"
# Crop margin: ตัด header/footer (บน 5%, ล่าง 2%)
CROP_TOP_RATIO = 0.05
CROP_BOTTOM_RATIO = 0.02
# Enable aggressive preprocessing (Option 2) สำหรับ Tesseract
USE_AGGRESSIVE_PREPROCESSING = os.getenv("TESSERACT_AGGRESSIVE_PREPROCESS", "true").lower() == "true"
# Enable smart post-processing (Option 3) สำหรับลบ hallucination
USE_SMART_CLEANING = os.getenv("TESSERACT_SMART_CLEAN", "true").lower() == "true"

logger.info(f"Tesseract OCR Sidecar initialized (lang={OCR_LANG}, config={TESSERACT_CONFIG}, aggressive={USE_AGGRESSIVE_PREPROCESSING}, smart_clean={USE_SMART_CLEANING})")


def filter_ocr_noise(text: str) -> str:
    """Filter ขยะ OCR เช่น บรรทัดสั้น/สัญลักษณ์ที่ไม่มีความหมาย"""
    lines = text.split("\n")
    filtered_lines = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # ลบบรรทัดที่สั้นเกินไป (น้อยกว่า 3 ตัวอักษร)
        if len(line) < 3:
            continue

        # ลบบรรทัดที่มีแต่สัญลักษณ์/ตัวเลขโดดๆ (ไม่มีตัวอักษรภาษาไทย/อังกฤษ)
        thai_chars = sum(1 for c in line if '\u0E00' <= c <= '\u0E7F')
        english_chars = sum(1 for c in line if c.isalpha() and c.isascii())
        total_chars = len(line)

        # ถ้ามีตัวอักษรภาษาไทยหรืออังกฤษน้อยกว่า 20% ของบรรทัด ให้ถือว่าเป็นขยะ
        if total_chars > 0 and (thai_chars + english_chars) / total_chars < 0.2:
            continue

        filtered_lines.append(line)

    return "\n".join(filtered_lines)


def crop_header_footer(pil_image: Image.Image, top_ratio: float = 0.10, bottom_ratio: float = 0.10) -> Image.Image:
    """Crop header/footer ออกจาก image เพื่อลบข้อความที่ไม่จำเป็น"""
    width, height = pil_image.size
    top_crop = int(height * top_ratio)
    bottom_crop = int(height * bottom_ratio)

    # Crop: (left, top, right, bottom)
    cropped = pil_image.crop((0, top_crop, width, height - bottom_crop))
    return cropped


def preprocess_image(pil_image: Image.Image) -> Image.Image:
    """Preprocess image ด้วย OpenCV เพื่อเพิ่มความแม่นยำ OCR (แบบธรรมชาติ)"""
    # แปลง PIL Image เป็น numpy array (OpenCV format)
    img_array = np.array(pil_image)

    # แปลงเป็น grayscale
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # Denoise ด้วย median blur (เบางๆ เพื่อลบ noise แต่ไม่ทำลายตัวอักษร)
    denoised = cv2.medianBlur(gray, 3)

    # ใช้ grayscale เท่านั้น (ไม่ใช้ adaptive threshold เพราะทำให้ตัวอักษรเสียรูป)
    # แปลงกลับเป็น PIL Image
    return Image.fromarray(denoised)


def preprocess_image_aggressive(pil_image: Image.Image) -> Image.Image:
    """
    Aggressive preprocessing (Option 2) — ลด hallucination โดย:
    1. Deskew ถ้าหน้าเอียง
    2. Denoise ด้วย bilateral filter
    3. Otsu adaptive threshold
    4. Morphological operations
    """
    img_array = np.array(pil_image)
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # 1. Deskew ถ้าหน้าเอียง (detect angle จาก Canny edges + Hough lines)
    try:
        edges = cv2.Canny(gray, 100, 200)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
        if lines is not None and len(lines) > 0:
            angles = [np.arctan2(y2-y1, x2-x1) for x1,y1,x2,y2 in lines[:min(10, len(lines))]]
            angle = np.median(angles) * 180 / np.pi
            if abs(angle) > 0.5:  # มุมเอียงน้อย ≥ 0.5 องศา
                h, w = gray.shape
                M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
                gray = cv2.warpAffine(gray, M, (w, h), borderMode=cv2.BORDER_REFLECT)
                logger.info(f"[PREPROCESS] Deskewed {angle:.1f}°")
    except Exception as e:
        logger.warning(f"[PREPROCESS] Deskew failed: {e}")

    # 2. Denoise — median blur + bilateral filter
    denoised = cv2.medianBlur(gray, 3)
    denoised = cv2.bilateralFilter(denoised, 9, 75, 75)

    # 3. Otsu threshold (adaptive, ไม่ fixed value)
    _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 4. Morphological operations — ลบ line noise ขนาดเล็ก (ต้าน speckle artifacts)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    morph = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)  # ลบ small white noise
    morph = cv2.morphologyEx(morph, cv2.MORPH_CLOSE, kernel)  # ลบ small black hole

    logger.info(f"[PREPROCESS] Aggressive: Otsu threshold + morphology applied")
    return Image.fromarray(morph)


def clean_ocr_output(text: str) -> str:
    """
    Smart post-processing (Option 3) — ลบ Tesseract hallucination โดย:
    1. ลบ line ที่เป็นแค่สัญลักษณ์ repeated
    2. ลบ line ที่เป็นแค่สัญลักษณ์แปลก
    3. ลบ line ที่ซ้ำตัวอักษรเดียว (artifact noise)
    """
    lines = text.split("\n")
    cleaned = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # ✗ ลบ line ที่เป็นแค่สัญลักษณ์/punctuation เดี่ยวๆ ไม่มีตัวอักษร
        alphanumeric_part = re.sub(r'[^\w\u0E00-\u0E7F]', '', line)
        if len(alphanumeric_part) < 2:
            logger.debug(f"[CLEAN] Reject (no alphanum): {line[:50]}")
            continue

        # ✗ ลบ line ที่เป็น repeated pattern — ถ้า unique char ≤ 20% (e.g., "-----", ">>>>>>>")
        unique_chars = len(set(line))
        if unique_chars < max(2, len(line) // 5):
            logger.debug(f"[CLEAN] Reject (repeated pattern): {line[:50]}")
            continue

        # ✗ ลบ line ที่เป็นสัญลักษณ์แปลก (< 20% Thai/English alphanumeric)
        thai_chars = sum(1 for c in line if '\u0E00' <= c <= '\u0E7F')
        eng_chars = sum(1 for c in line if c.isascii() and c.isalnum())
        if len(line) > 0 and (thai_chars + eng_chars) / len(line) < 0.2:
            logger.debug(f"[CLEAN] Reject (low language content): {line[:50]}")
            continue

        # ✓ ปล่อยผ่าน
        cleaned.append(line)

    result = "\n".join(cleaned)
    logger.info(f"[CLEAN] Input {len(lines)} lines → {len(cleaned)} lines")
    return result


class OcrRequest(BaseModel):
    pdfPath: str
    maxPages: Optional[int] = None
    engine: Optional[str] = None


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
        "engines": ["tesseract", "typhoon-np-dms-ocr"],
        "typhoonModel": TYPHOON_OCR_MODEL,
        "tesseractConfig": TESSERACT_CONFIG,
        "aggressivePreprocess": USE_AGGRESSIVE_PREPROCESSING,
        "smartCleaning": USE_SMART_CLEANING,
    }


# alias map สำหรับ engine name เก่า → canonical name
_ENGINE_ALIASES: dict[str, str] = {
    "typhoon-ocr1.5-3b": "typhoon-np-dms-ocr",
    "typhoon-ocr-3b": "typhoon-np-dms-ocr",
    "typhoon_ocr": "typhoon-np-dms-ocr",
}


def _process_pdf_doc(doc: fitz.Document, selected_engine: str, max_pages: int, typhoon_options: dict = {}) -> OcrResponse:
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

    if selected_engine == "typhoon-np-dms-ocr":
        typhoon_text_parts = []
        for i in pages_to_process:
            page = doc[i]
            pix = page.get_pixmap(dpi=TYPHOON_OCR_DPI)
            img_bytes = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_bytes))
            # ส่ง color image ตรงๆ — Typhoon OCR (vision model) ต้องการ color ไม่ใช่ grayscale binarized
            cropped_img = crop_header_footer(img, CROP_TOP_RATIO, CROP_BOTTOM_RATIO)
            typhoon_text_parts.append(process_with_typhoon_ocr(cropped_img, typhoon_options))
        typhoon_text = filter_ocr_noise("\n".join(typhoon_text_parts).strip())
        return OcrResponse(
            text=typhoon_text,
            ocrUsed=True,
            pageCount=page_count,
            charCount=len(typhoon_text),
            engineUsed=selected_engine,
        )

    logger.info(f"Slow path (Tesseract): {total_chars} chars too few")
    ocr_text_parts = []
    for i in pages_to_process:
        page = doc[i]
        pix = page.get_pixmap(dpi=300)
        img_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes))
        cropped_img = crop_header_footer(img, CROP_TOP_RATIO, CROP_BOTTOM_RATIO)

        # Option 2: Choose preprocessing strategy
        if USE_AGGRESSIVE_PREPROCESSING:
            processed_img = preprocess_image_aggressive(cropped_img)
        else:
            processed_img = preprocess_image(cropped_img)

        text = pytesseract.image_to_string(processed_img, lang=OCR_LANG, config=TESSERACT_CONFIG)
        ocr_text_parts.append(text.strip())

    ocr_text = "\n".join(ocr_text_parts).strip()

    # Option 3: Apply smart post-processing
    if USE_SMART_CLEANING:
        ocr_text = clean_ocr_output(ocr_text)
    else:
        ocr_text = filter_ocr_noise(ocr_text)

    logger.info(f"Tesseract extracted {len(ocr_text)} chars")
    return OcrResponse(
        text=ocr_text,
        ocrUsed=True,
        pageCount=page_count,
        charCount=len(ocr_text),
        engineUsed="tesseract",
    )


def process_with_typhoon_ocr(pil_image: Image.Image, options_override: dict = {}) -> str:
    """เรียก Typhoon OCR ผ่าน Ollama — ใช้ SYSTEM ใน Modelfile เป็น instruction หลัก; options_override ยัง override ค่า Modelfile ได้"""
    model_name = TYPHOON_OCR_MODEL
    img_buffer = io.BytesIO()
    pil_image.save(img_buffer, format="PNG")
    image_base64 = base64.b64encode(img_buffer.getvalue()).decode("utf-8")
    # ค่า default ตาม Modelfile; frontend override ได้บางส่วนหรือทั้งหมด
    options = {
        "temperature": 0.1,
        "top_p": 0.1,
        "repeat_penalty": 1.1,
        "num_gpu": 99,  # บังคับ GPU layers สูงสุด — ป้องกัน Ollama fallback ไป CPU โดยไม่จำเป็น
        "num_ctx": 4096,  # image tokens ~2772 → ต้องการ context > 2048; 4096 รองรับ image + output โดยไม่ truncate
        **options_override,
    }
    payload = {
        "model": model_name,
        "prompt": "Extract all text from this image.",
        "images": [image_base64],
        "stream": False,
        "options": options,
        "keep_alive": 300,  # คง model ไว้ใน VRAM/RAM 5 นาที เพื่อลด cold-start ระหว่าง sandbox session
    }
    with httpx.Client(timeout=TYPHOON_OCR_TIMEOUT) as client:
        response = client.post(f"{OLLAMA_API_URL}/api/generate", json=payload)
        response.raise_for_status()
        data = response.json()
        result_text = str(data.get("response", "")).strip()
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
    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"เปิดไฟล์ PDF ล้มเหลว: {e}")
    return _process_pdf_doc(doc, selected_engine, max_pages)


@app.post("/ocr-upload", response_model=OcrResponse, dependencies=[Depends(get_api_key)])
def ocr_upload(
    file: UploadFile = File(...),
    engine: str = Form(default="auto"),
    maxPages: int = Form(default=0),
    temperature: Optional[float] = Form(default=None),
    topP: Optional[float] = Form(default=None),
    repeatPenalty: Optional[float] = Form(default=None),
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
    pdf_bytes = file.file.read()
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"เปิดไฟล์ PDF ล้มเหลว: {e}")
    logger.info(f"OCR upload: {file.filename} engine={selected_engine} options={typhoon_options or 'modelfile-defaults'}")
    return _process_pdf_doc(doc, selected_engine, max_pages, typhoon_options)


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("OCR_PORT", "8765"))
    uvicorn.run(app, host="0.0.0.0", port=port)
