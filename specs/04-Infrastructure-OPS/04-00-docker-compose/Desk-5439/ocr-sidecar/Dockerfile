# File: specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile
# PaddleOCR Sidecar — HTTP API server สำหรับสกัดข้อความจาก PDF/Image
# รันบน Desk-5439 (GPU RTX 2060 Super 8GB) ตาม ADR-023A
# Change Log:
# - 2026-05-25: Initial Dockerfile สำหรับ PaddleOCR sidecar (port 8765)

FROM python:3.10-slim

# ติดตั้ง system dependencies สำหรับ PDF processing และ image library
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ติดตั้ง Python dependencies
# ใช้ paddlepaddle-gpu สำหรับ GPU acceleration (RTX 2060 Super — CUDA 11.x)
# เปลี่ยนเป็น paddlepaddle (CPU only) ถ้าต้องการ fallback
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app.py .

# Download PaddleOCR models ล่วงหน้าระหว่าง build (ลด cold-start time)
# โมเดลภาษาไทย (th) + อังกฤษ (en) ตาม ADR-023A
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)"

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8765/health || exit 1

CMD ["python", "app.py"]
