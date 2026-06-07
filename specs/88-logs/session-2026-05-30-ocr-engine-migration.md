# Session 8 — 2026-05-30 (OCR Engine Migration — PaddleOCR → Tesseract)

## ปัญหาที่พบ (Root Cause)

**Bug 1: PaddleOCR SIGILL (Illegal Instruction)**

- PaddleOCR 2.6.2 ต้องการ AVX instruction set ซึ่ง CPU บน Desk-5439 ไม่รองรับ
- ลองลดรุ่นเป็น 2.5.2 → ยังมี dependency conflict กับ paddleocr 2.7.3
- ลองใช้ paddlepaddle-cpu → ยังคงมีปัญหา dependency

**Bug 2: OCR ภาษาไทยผิด**

- PaddleOCR ตั้งค่า `lang="en"` ทำให้ข้อความภาษาไทยถูกแปลงเป็นอักษรละตินผิดๆ
- เช่น: "10 กุมภาพันธ์ 2568" → "10 qunnwus 2568"

## การแก้ไข (Fix)

เปลี่ยนจาก PaddleOCR เป็น Tesseract OCR เพื่อ:

1. แก้ปัญหา SIGILL บน CPU เก่าที่ไม่รองรับ AVX
2. รองรับภาษาไทยด้วย `tha+eng` language code

| ไฟล์                                                                                        | การเปลี่ยนแปลย                                                               |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/requirements.txt`   | ลบ paddlepaddle/paddleocr, เพิ่ม pytesseract, Pillow                         |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py`             | เปลี่ยนใช้ pytesseract, OCR_LANG เป็น `tha+eng`, ลบ PaddleOCR initialization |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile`         | ติดตั้ง tesseract-ocr, tesseract-ocr-tha, tesseract-ocr-eng                  |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/docker-compose.yml` | OCR_LANG เป็น `tha+eng`, ลบ paddleocr_models volume                          |
| `backend/src/modules/ai/services/ocr.service.ts`                                            | เปลี่ยน comment/error message จาก PaddleOCR เป็น Tesseract                   |
| `frontend/components/admin/ai/OcrSandboxPromptManager.tsx`                                  | เปลี่ยน Badge text จาก PaddleOCR เป็น Tesseract                              |

## กฎที่ Lock แล้ว

- Tesseract OCR ไม่ต้องการ AVX instruction set → ทำงานได้บน CPU ทุกรุ่น
- Tesseract รองรับภาษาไทยด้วย `tha+eng` language code
- API contract ยังเหมือนเดิม (`POST /ocr` คืน `{ text, ocrUsed }`) → backend/frontend ไม่ต้องเปลี่ยน logic

## Verification ที่ต้องทำ

- Rebuild container บน Desk-5439: `docker compose down && docker compose up -d --build`
- ทดสอบ OCR ภาษาไทย: "10 กุมภาพันธ์ 2568" ควรออกมาถูกต้อง
