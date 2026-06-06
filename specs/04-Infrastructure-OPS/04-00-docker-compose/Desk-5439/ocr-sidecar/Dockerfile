# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile
# Tesseract OCR Sidecar — HTTP API server สำหรับสกัดข้อความจาก PDF/Image
# รันบน Desk-5439 ตาม ADR-023A
# Change Log:
# - 2026-05-25: Initial Dockerfile สำหรับ OCR sidecar (port 8765)
# - 2026-05-30: เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อความเข้ากันได้กับ CPU เก่า
# - 2026-05-30: เพิ่ม system dependencies สำหรับ OpenCV (libsm6, libxext6, libxrender1, libfontconfig1, libx11-6)
# - 2026-05-30: Typhoon OCR ใช้ httpx เรียก Ollama ผ่าน OLLAMA_API_URL (T009a, ADR-032)
#              Container รันบน CPU เท่านั้น ไม่ต้องการ CUDA/GPU ใน container

FROM python:3.10-slim

# ติดตั้ง system dependencies สำหรับ PDF processing, Tesseract OCR, ภาษาไทย และ OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-tha \
    tesseract-ocr-eng \
    libsm6 \
    libxext6 \
    libxrender1 \
    libfontconfig1 \
    libx11-6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ติดตั้ง Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app.py .

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8765/health || exit 1

CMD ["python", "app.py"]
