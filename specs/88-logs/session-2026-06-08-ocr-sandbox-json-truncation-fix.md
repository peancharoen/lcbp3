# Session 16 — 2026-06-08 (Fix LLM JSON Response Truncation in OCR Sandbox & Migration)

## Summary

แก้ไขปัญหา LLM JSON Response Truncation (ข้อความตอบกลับถูกตัดคำ) ใน OCR Sandbox Step 2 และ Migration Pipeline โดยการเพิ่มขนาด `num_ctx` ในการเรียกใช้งาน Ollama เป็น `16384` (ดำเนินการแก้ไขโดย AGY Gemini 3.5 Flash (Medium))


## ปัญหาที่พบ (Root Cause)

1. **Context Window Overflow:** เมื่อส่ง Prompt ขนาดใหญ่ที่มี OCR text (สูงสุด 15,000 ตัวอักษร) ผสมกับ Master Data Context (ประมาณ 6,000 ตัวอักษร) รวมกันทั้งหมด ~15.7K ตัวอักษร (คิดเป็นประมาณ 6,000-8,000 โทเค็นในโมเดลภาษาไทย) ทำให้ขนาดของ Context ใกล้เต็มหน้าต่าง `num_ctx 8192` ของโมเดล `typhoon2.5-np-dms:latest`
2. **JSON Truncation:** เมื่อตัวแบบพยายามสร้างคำตอบ JSON (เช่น summary) ตัวโทเค็นรวม (Input + Output) จะชนเพดาน 8,192 โทเค็น ส่งผลให้ Ollama ตัดการสร้างข้อความกลางคัน และส่ง JSON ที่ไม่สมบูรณ์กลับมา ทำให้ JSON parse ล้มเหลวและแสดงข้อผิดพลาด `Failed to parse LLM response as JSON`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | 1. เพิ่ม `num_ctx: 16384` ใน `ollamaOptions` ของฟังก์ชัน `processSandboxExtract` และ `processSandboxAiExtract`<br>2. ปรับปรุง `processMigrateDocument` ให้บังคับส่ง `format: 'json'` และ `options: { num_ctx: 16384, num_predict: 4096 }` ให้ตรงกับระบบ Sandbox |
| `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | ปรับปรุง Unit Test ของ `migrate-document` ให้ตรวจสอบว่าส่ง `format: 'json'` และ `num_ctx: 16384` ไปยัง OllamaService อย่างถูกต้อง |

## กฎที่ Lock แล้ว

- **Context Window Headroom:** ในการใช้งาน Prompt ที่มี Master Data ขนาดใหญ่ ร่วมกับ OCR text ให้ขยายขนาด `num_ctx` เป็น `16384` เสมอ เพื่อให้มี headroom เพียงพอสำหรับ generated JSON โดยไม่กระทบ VRAM เนื่องจากตัวโมเดลหลักมีขนาดเล็ก (~2.5GB) บนการ์ดจอ RTX 2060 Super 8GB

## Verification

- [x] Unit Test `pnpm --filter backend test src/modules/ai/processors/ai-batch.processor.spec.ts` ผ่าน 100% (701 tests pass)
- [x] Build Backend `pnpm --filter backend run build` สำเร็จลุล่วง
- [x] ผลการทดสอบจาก Ollama log บนเอกสาร 3 หน้า (13,173 ตัวอักษร / 6,401 โทเค็น) ประมวลผลและสร้าง JSON ตอบกลับสำเร็จเรียบร้อยโดยไม่มีการโดนบีบอัด/ตัดข้อความ (truncated = 0)
