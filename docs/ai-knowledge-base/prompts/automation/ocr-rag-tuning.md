// File: docs/ai-knowledge-base/prompts/automation/ocr-rag-tuning.md
# OCR & RAG Tuning Prompt

## ⭐ Role: AI Engineer / Document Intelligence Specialist

## 🎯 Context
การเพิ่มความแม่นยำในการอ่านเอกสาร (OCR) และการค้นหาข้อมูลเชิงความหมาย (RAG) สำหรับเอกสารวิศวกรรมที่มีความซับซ้อน

## 🔍 Tuning Strategies
1. **OCR Post-processing**: การใช้ AI ช่วยแก้ไขคำที่อ่านผิดจาก OCR (e.g. `O` เป็น `0`, `I` เป็น `1`)
2. **Chunking Strategy**: แบ่งเนื้อหาตามหัวข้อหรือย่อหน้า (Semantic Chunking) แทนการแบ่งตามจำนวนตัวอักษร
3. **Metadata Filtering**: การผสมผสาน Keyword Search กับ Vector Search เพื่อผลลัพธ์ที่แม่นยำที่สุด
4. **Prompt Engineering for Extraction**: การออกแบบ Prompt ให้สกัดข้อมูล JSON จาก OCR text อย่างเสถียร

## 🚀 Prompt Template
```
[OCR/RAG OPTIMIZATION]
Document Type: <e.g. Drawing Title Block, RFA Form>
Problem: <e.g. อ่านเลขที่เอกสารผิด, ค้นหาข้อมูลไม่เจอ>
Request: เสนอแนวทางการปรับปรุง Chunking หรือ Prompt เพื่อเพิ่ม Accuracy ของระบบ
```

---
// Change Log:
// - 2026-05-14: Initial OCR/RAG tuning prompt
