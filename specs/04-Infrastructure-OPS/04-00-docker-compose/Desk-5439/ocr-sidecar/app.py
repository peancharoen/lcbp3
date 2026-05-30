# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
# Tesseract OCR HTTP Sidecar API — รับ POST /ocr แล้วคืนข้อความที่สกัดจาก PDF/Image
# ตาม ADR-023A: OCR auto-detect (PyMuPDF chars > 100 → Fast path, else Tesseract)
# Change Log:
# - 2026-05-25: Initial FastAPI server สำหรับ PaddleOCR sidecar
# - 2026-05-30: เปลี่ยน lang='en' เป็น lang='ch' (CTJK) เพื่อรองรับภาษาไทย
# - 2026-05-30: เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อความเข้ากันได้กับ CPU เก่า

import os
import logging
import re
import fitz  # PyMuPDF
from pathlib import Path
from typing import Optional
from PIL import Image
import pytesseract
import io

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pythainlp.tokenize import word_tokenize
from pythainlp.util import normalize as thai_normalize

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-sidecar")

app = FastAPI(title="Tesseract OCR Sidecar", version="1.0.0")

# อ่านค่า config จาก environment
OCR_CHAR_THRESHOLD = int(os.getenv("OCR_CHAR_THRESHOLD", "100"))
MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "0"))  # 0 = ทุกหน้า
OCR_LANG = os.getenv("OCR_LANG", "tha+eng")  # Tesseract language code (tha+eng = Thai + English)

logger.info(f"Tesseract OCR Sidecar initialized (lang={OCR_LANG})")


class OcrRequest(BaseModel):
    pdfPath: str
    maxPages: Optional[int] = None


class OcrResponse(BaseModel):
    text: str
    ocrUsed: bool
    pageCount: int
    charCount: int


@app.get("/health")
def health():
    return {"status": "ok", "engine": "tesseract"}


@app.post("/ocr", response_model=OcrResponse)
def ocr_extract(req: OcrRequest):
    pdf_path = Path(req.pdfPath)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"ไม่พบไฟล์: {req.pdfPath}")

    max_pages = req.maxPages or MAX_PAGES

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"เปิดไฟล์ PDF ล้มเหลว: {e}")

    pages_to_process = list(range(min(len(doc), max_pages) if max_pages > 0 else len(doc)))
    page_count = len(pages_to_process)

    # Fast path: ลอง extract text layer ก่อน
    fast_text_parts = []
    for i in pages_to_process:
        page = doc[i]
        fast_text_parts.append(page.get_text())
    fast_text = "\n".join(fast_text_parts).strip()
    total_chars = len(fast_text)

    if total_chars > OCR_CHAR_THRESHOLD:
        logger.info(f"Fast path: {total_chars} chars extracted from {pdf_path.name}")
        return OcrResponse(
            text=fast_text,
            ocrUsed=False,
            pageCount=page_count,
            charCount=total_chars,
        )

    # Slow path: ใช้ Tesseract OCR กับทุกหน้า
    logger.info(f"Slow path (Tesseract): {total_chars} chars too few for {pdf_path.name}")
    ocr_text_parts = []
    for i in pages_to_process:
        page = doc[i]
        pix = page.get_pixmap(dpi=200)
        img_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes))
        text = pytesseract.image_to_string(img, lang=OCR_LANG)
        ocr_text_parts.append(text.strip())

    ocr_text = "\n".join(ocr_text_parts).strip()
    logger.info(f"Tesseract extracted {len(ocr_text)} chars from {pdf_path.name}")

    return OcrResponse(
        text=ocr_text,
        ocrUsed=True,
        pageCount=page_count,
        charCount=len(ocr_text),
    )


class NormalizeRequest(BaseModel):
    text: str


class NormalizeResponse(BaseModel):
    normalized: str


@app.post("/normalize", response_model=NormalizeResponse)
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
