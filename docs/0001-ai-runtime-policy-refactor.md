# AI Runtime Policy Refactor for RTX 5060 Ti 16GB

ระบบ AI runtime ของ LCBP3-DMS จะเปลี่ยนไปใช้ canonical identities `np-dms-ai` และ `np-dms-ocr`, ใช้ `executionProfile` เป็น policy-level contract แทน model key/parameter overrides, และรวม GPU scheduling ของ main model, OCR, embedding, และ reranking ไว้ใต้ policy เดียวกัน. การตัดสินใจนี้รองรับการอัปเกรดเป็น RTX 5060 Ti 16GB โดยยังรักษา AI governance เดิมของระบบ: backend policy เป็นผู้ตัดสิน model/parameters จริง, `rag-query` เป็น generation-centric job, retrieval ใช้ GPU ได้ภายใต้ LLM-first ownership เท่านั้นและต้อง fallback CPU ได้, ส่วน rollout ใช้ big bang cutover พร้อม executable-first verification และ manual validation path สำหรับทุกแกนสำคัญ.

## Considered Options

- เก็บชื่อ canonical เดิม (`typhoon2.5-np-dms:latest` / `typhoon-np-dms-ocr:latest`) แล้วใช้ alias เฉพาะ deploy
- เปิดให้ caller ส่ง `model.key` และ runtime parameters มาใน job request
- ใช้ shared GPU pool แบบสิทธิ์เท่ากันระหว่าง LLM, OCR, embed, rerank
- phase-gated rollout แยก naming, residency, retrieval acceleration, queue policy เป็นหลายรอบ

เราไม่เลือกแนวทางเหล่านี้เพราะทำให้ governance ซ้ำซ้อน, เปิดช่อง bypass policy กลาง, หรือแยก resource policy ที่จริงผูกกันอยู่ให้กลายเป็นคนละเรื่อง. สำหรับ refactor รอบนี้ ระบบจะใช้ single-name canonical model policy, profile-only parameter governance, adaptive OCR residency, LLM-first GPU ownership, CPU fallback retrieval, selective realtime concurrency เฉพาะ lightweight realtime jobs และ big bang cutover gate ที่ต้องผ่านครบทั้ง contract, model switching, OCR residency, และ RAG fallback.
