นี่คือร่างเนื้อหาฉบับปรับปรุงของ **LCBP3 RAG Implementation Guide (v1.1.0)** ในรูปแบบ Markdown โดยเน้นการยกระดับความปลอดภัย (Security), การรองรับหลายโครงการ (Multi-tenancy), และความถูกต้องของคำตอบ (Truthfulness) ตามมาตรฐานระบบ LCBP3 DMS

---

# 📄 LCBP3 DMS: RAG Implementation Guide
**Retrieval-Augmented Generation for Document Management System**

| Version | Date | Status | Updated By |
| :--- | :--- | :--- | :--- |
| 1.1.0 | 2026-04-19 | Proposed | Gemini (Senior Developer) |

---

## 1. ภาพรวม Architecture (Multi-tenant Hybrid)
ระบบ RAG ออกแบบมาเพื่อทำงานร่วมกับโครงสร้างข้อมูลเดิมของ LCBP3 โดยมีการแยกส่วนการประมวลผลตามระดับความปลอดภัยของข้อมูล

### 1.1 Ingestion Pipeline
1.  **Trigger:** ไฟล์ถูก Commit เข้าสู่ Permanent Storage (ตาม ADR-016)
2.  **OCR Service:** ใช้ EasyOCR/Tesseract ประมวลผล PDF/DWG (ในกรณีที่ไฟล์ไม่มี text layer)
3.  **Data Enrichment:** ดึง Metadata จาก MariaDB (Project ID, Doc Type, Security Level) แนบไปกับข้อมูลดิบ
4.  **Chunking:** แบ่งส่วนข้อความตามกลยุทธ์ที่กำหนด (ดูหัวข้อที่ 2)
5.  **Local Embedding:** ส่ง Chunk ไปยัง **Ollama (nomic-embed-text)** ภายใน Intranet
6.  **Vector Store:** บันทึก Vector + Metadata ลงใน **Qdrant** โดยแยก `collection` หรือใช้ `payload filter` ตาม Project ID

### 1.2 Query & Generation
1.  **Secure Filter:** ระบบ DMS API รับคำถามและตรวจสอบสิทธิ์ (RBAC) ของผู้ใช้
2.  **Similarity Search:** ค้นหาใน Qdrant โดยบังคับใส่ `project_public_id` ใน Filter เสมอ
3.  **Context Selection:** เลือกเฉพาะ Top-K chunks ที่มีคะแนนความมั่นใจ (Confidence) > 0.6
4.  **Hybrid Generation:**
    * *ข้อมูลปกติ:* ส่ง Context + Prompt ไปยัง **Typhoon API (Cloud)** เพื่อคุณภาพภาษาไทยสูงสุด
    * *ข้อมูลลับ (Confidential):* ส่งประมวลผลผ่าน **Ollama (Local LLM)** ภายในเครื่อง Admin เท่านั้น (ตาม ADR-018)

---

## 2. Chunking Strategy (Domain-Specific)
ห้ามใช้ Fixed-size chunking เพียงอย่างเดียว ให้ใช้กลยุทธ์ตามประเภทเอกสาร (Document Type):

| ประเภทเอกสาร | กลยุทธ์การ Chunk | ข้อมูลที่ต้องแนบใน Metadata |
| :--- | :--- | :--- |
| **Correspondence (CORR)** | Recursive Character Splitter (1000 chars, 10% overlap) | Sender, Receiver, Ref No., Subject |
| **RFA / Transmittal** | Table-aware Chunking (เน้นดึงตารางรายการไฟล์แนบ) | RFA ID, Status, Due Date |
| **Drawing (Shop/As-built)** | Title Block Extraction + Metadata Enrichment | Drawing No., Revision, Discipline |

---

## 3. มาตรฐานการพัฒนา (Technical Specification)

### 3.1 Vector Payload Interface (NestJS)
```typescript
interface VectorMetadata {
  public_id: string;        // UUIDv7 ของเอกสาร
  project_public_id: string; // ✅ บังคับ เพื่อความปลอดภัย
  doc_type: string;          // CORR, RFA, DRAWING
  security_level: number;    // 1: Public, 2: Internal, 3: Confidential
  content_preview: string;   // ข้อความสั้นๆ สำหรับแสดงผล
}
```

### 3.2 Ingestion Status (MariaDB Update)
เพิ่มฟิลด์ในตาราง `attachments` เพื่อติดตามสถานะ:
```sql
ALTER TABLE attachments
ADD COLUMN rag_status ENUM('PENDING', 'PROCESSING', 'INDEXED', 'FAILED') DEFAULT 'PENDING',
ADD COLUMN rag_last_error TEXT NULL;
```

---

## 4. ความปลอดภัยและการควบคุม (Security Audit Protocol)

### 4.1 Data Isolation (Non-negotiable)
* **Tenant Separation:** ทุกการค้นหาต้องมีการทำ Payload filtering บน Qdrant ด้วย `project_public_id` เพื่อป้องกันพนักงานโครงการ A เห็นข้อมูลโครงการ B
* **RBAC Check:** DMS API ต้องเรียก `CaslGuard` ก่อนทำการค้นหา Vector เสมอ

### 4.2 AI Truthfulness & Anti-Hallucination
* **Citation:** Prompt ต้องบังคับให้ AI อ้างอิงหมายเลขเอกสาร (`doc_number`) ทุกครั้งที่ตอบ
* **Fallback:** หาก Similarity Search ได้ผลลัพธ์ที่คะแนนต่ำกว่าเกณฑ์ ให้ตอบว่า *"ไม่พบข้อมูลที่ระบุในฐานข้อมูลเอกสารปัจจุบัน"* ห้ามให้ AI คาดเดาเอง

---

## 5. ลำดับการ Rollout (Updated Phase)

* **Phase 1: Infra (2 วัน):** Docker Qdrant + Redis + Ollama Setup
* **Phase 2: Core Services (3 วัน):** สร้าง `EmbeddingService` และ `QdrantService` (Strict Type)
* **Phase 3: Auto-Ingestion (3 วัน):** เชื่อม BullMQ เข้ากับไฟล์อัปโหลดเดิมของ DMS
* **Phase 4: RAG API (2 วัน):** สร้าง API ค้นหาพร้อมระบบ Citation
* **Phase 5: UI/UX (3 วัน):** หน้าจอ Search ผลลัพธ์แบบ AI พร้อมปุ่มเปิดไฟล์ต้นฉบับ

---

## 6. รายการตรวจสอบ (Security Checklist ก่อน Go-live)
- [ ] ข้อมูล Confidential ไม่ถูกส่งไปยัง Typhoon API (Cloud)
- [ ] มีการบันทึก `audit_logs` ทุกการ Query ของ AI (ใครถาม, ถามอะไร, ระบบตอบอะไร)
- [ ] ฟังก์ชันการลบเอกสารใน DMS มีการสั่งลบ Vector ใน Qdrant ออกด้วย (Consistency)
- [ ] ทดสอบ Cross-project search แล้วต้องไม่พบข้อมูลข้ามโครงการ

---
