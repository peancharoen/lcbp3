# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
# Tesseract OCR HTTP Sidecar API — รับ POST /ocr แล้วคืนข้อความที่สกัดจาก PDF/Image
# ตาม ADR-023A: OCR auto-detect (PyMuPDF chars > 100 → Fast path, else Tesseract)
# Change Log:
# - 2026-05-25: Initial FastAPI server สำหรับ PaddleOCR sidecar
# - 2026-05-30: เปลี่ยน lang='en' เป็น lang='ch' (CTJK) เพื่อรองรับภาษาไทย
# - 2026-05-30: เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อความเข้ากันได้กับ CPU เก่า
# - 2026-05-30: เพิ่ม OpenCV preprocessing (threshold, denoise) และ DPI 300 เพื่อเพิ่มความแม่นยำ

import os
import logging
import re
import fitz  # PyMuPDF
from pathlib import Path
from typing import Optional
from PIL import Image
import pytesseract
import io
import cv2
import numpy as np

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
# PSM 3 = Fully automatic page segmentation (เหมาะกับเอกสารที่มี layout หลายส่วน เช่น วันที่/เลขที่)
# OEM 1 = LSTM only (ดีกว่า legacy engine)
TESSERACT_CONFIG = f"--psm 3 --oem 1"
# Crop margin: ตัด header/footer (บน 5%, ล่าง 2%)
CROP_TOP_RATIO = 0.05
CROP_BOTTOM_RATIO = 0.02

logger.info(f"Tesseract OCR Sidecar initialized (lang={OCR_LANG}, config={TESSERACT_CONFIG})")


def crop_header_footer(pil_image: Image.Image, top_ratio: float = 0.10, bottom_ratio: float = 0.10) -> Image.Image:
    """Crop header/footer ออกจาก image เพื่อลบข้อความที่ไม่จำเป็น"""
    width, height = pil_image.size
    top_crop = int(height * top_ratio)
    bottom_crop = int(height * bottom_ratio)

    # Crop: (left, top, right, bottom)
    cropped = pil_image.crop((0, top_crop, width, height - bottom_crop))
    return cropped


def preprocess_image(pil_image: Image.Image) -> Image.Image:
    """Preprocess image ด้วย OpenCV เพื่อเพิ่มความแม่นยำ OCR"""
    # แปลง PIL Image เป็น numpy array (OpenCV format)
    img_array = np.array(pil_image)

    # แปลงเป็น grayscale
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # Denoise ด้วย median blur (เบางๆ เพื่อลบ noise แต่ไม่ทำลายตัวอักษร)
    denoised = cv2.medianBlur(gray, 3)

    # ใช้ grayscale เท่านั้น (ไม่ใช้ adaptive threshold เพราะทำให้ตัวอักษรเสียรูป)
    # แปลงกลับเป็น PIL Image
    return Image.fromarray(denoised)


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
        pix = page.get_pixmap(dpi=300)  # เพิ่ม DPI เป็น 300 เพื่อความชัด
        img_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes))

        # Crop header/footer ก่อนเพื่อลบข้อความที่ไม่จำเป็น
        cropped_img = crop_header_footer(img, CROP_TOP_RATIO, CROP_BOTTOM_RATIO)

        # Preprocess ด้วย OpenCV เพื่อเพิ่มความแม่นยำ
        processed_img = preprocess_image(cropped_img)

        # OCR ด้วย Tesseract โดยใช้ PSM 6 และ OEM 1
        text = pytesseract.image_to_string(processed_img, lang=OCR_LANG, config=TESSERACT_CONFIG)
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
