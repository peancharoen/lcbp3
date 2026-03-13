# 03-07: RAG (Retrieval-Augmented Generation) — Future Architecture Spec

**Document ID:** DMS-RAG-001
**Status:** Draft / Exploratory
**Version:** 1.8.1
**Date:** 2026-03-13
**Related Documents:**
- [ADR-017: Ollama Data Migration](../06-Decision-Records/ADR-017-ollama-data-migration.md)
- [ADR-018: AI Boundary Hardening](../06-Decision-Records/Patch%201.8.1.md)
- [n8n Migration Setup Guide](./03-05-n8n-migration-setup-guide.md)
- [Legacy Data Migration](./03-04-legacy-data-migration.md)
- [OpenRAG (openr.ag)](https://www.openr.ag/) — IBM open-source RAG: Docling + OpenSearch + Langflow

> ⚠️ **หมายเหตุ:** เอกสารนี้ออกแบบ RAG Pipeline **2 ส่วน**:
> 1. **OpenRAG (Extraction Phase)** — ทำหน้าที่ "พนักงานคัดกรองข้อมูล" อ่าน PDF ทั้ง Folder แล้วเขียน JSON ลง `rag-output/` บน Shared NAS
> 2. **n8n + Ollama + Elasticsearch (Integration & Search Phase)** — Poll ไฟล์ JSON จาก `rag-output/` ทีละไฟล์ แล้วนำเข้า DMS
>
> ทั้งหมดทำงาน **On-Premise** เท่านั้น — ไม่ส่งข้อมูลออกนอกเครือข่าย (ADR-018 AI Isolation)
>
> **Integration Model: File-based Queue (Pull)**
> - Admin Desktop mount `R:\` (Drive Letter) → QNAP NAS Shared Folder (`staging_ai`)
> - OpenRAG เขียน JSON ลง `R:\staging_ai\rag-output\` → n8n อ่านจาก `staging_ai/rag-output/`
> - **ไม่มี HTTP ระหว่าง OpenRAG กับ n8n** — NAS Folder เป็น Shared Queue

---

## 🎯 วัตถุประสงค์ (Objective)

เพิ่มความสามารถ **Semantic Search และ Document Q&A** ให้กับระบบ DMS โดยใช้ Infrastructure ที่มีอยู่แล้ว:
- ไม่ส่งข้อมูลออกนอกเครือข่ายองค์กร (Data Privacy)
- ไม่มีค่าใช้จ่ายต่อ Query (Zero Cost)
- ต่อยอดจากสถาปัตยกรรม Migration ที่ผ่าน Validate แล้ว (ADR-017/018)

---

## 🏗️ สถาปัตยกรรม Infrastructure (Binding)

ตาม Patch 1.8.1 (ADR-018) Infrastructure Layout ที่กำหนดไว้:

| Component              | Host          | บทบาทใน RAG Pipeline                              |
| ---------------------- | ------------- | ------------------------------------------------- |
| **OpenRAG** (Docling + OpenSearch + Langflow) | Admin Desktop | **Phase 0: Extraction** — สกัด Metadata + Text จาก PDF เป็น JSON |
| **Tika** (Fallback OCR) | QNAP         | สกัดข้อความจาก PDF กรณีไม่ใช้ OpenRAG หรือ Fallback |
| **Elasticsearch 8.11** | QNAP          | Vector Store + Full-text Index                    |
| **n8n**                | QNAP          | Orchestrator — Poll JSON จาก `rag-output/` (ทีละไฟล์) แล้วนำเข้า DMS |
| **DMS Backend (NestJS)**| QNAP         | API Gateway — รับ Query / ส่งผล / บันทึก Metadata   |
| **Ollama**             | Admin Desktop | AI Inference (Embedding + Generate) บน RTX 2060 SUPER |
| **MariaDB 11.8**       | QNAP          | Document Metadata (Authoritative DB)              |
| **Redis 7.2**          | QNAP          | Cache (Query Result Cache)                        |

> ⛔ **ข้อห้าม (ADR-018):** OpenRAG และ Ollama **ห้ามอยู่บน QNAP** และห้ามเข้า DB โดยตรง
> ✅ OpenRAG เขียนผล JSON ลง `rag-output/` บน Shared NAS (R:\ บน Admin Desktop = `staging_ai` บน QNAP)

---

## 🔄 RAG Data Flow (4 Phase)

---

### Phase 0: OpenRAG — Batch Extraction Phase ("พนักงานคัดกรองข้อมูล")

OpenRAG ทำงานบน **Admin Desktop** อ่าน PDF ทั้ง Folder แล้วเขียน JSON ทีละไฟล์ลง Shared NAS:

```
 R:\staging_ai\*.pdf  (Admin Desktop — Network Drive จาก QNAP)
         │
         ▼
 ┌───────────────────────────────────────────────────────────┐
 │  OpenRAG Langflow Batch Runner (Admin Desktop)            │
 │                                                           │
 │  [Loop Folder Component]                                  │
 │    สำหรับแต่ละ .pdf ใน R:\staging_ai\                      │
 │         │                                                 │
 │         ▼                                                 │
 │  [Docling Component]      ← Parse PDF Structure           │
 │         │                                                 │
 │         ▼                                                 │
 │  [Ollama LLM Component]   ← Extract Metadata → JSON      │
 │         │                                                 │
 │         ▼                                                 │
 │  [File Write Component]                                   │
 │    เขียน JSON → R:\staging_ai\rag-output\<filename>.json  │
 │    (Skip ถ้า .json ไฟล์นั้นมีอยู่แล้ว — Idempotent)       │
 └───────────────────────────────────────────────────────────┘

 ────────────── Shared NAS Folder (staging_ai) ──────────────

 staging_ai/
   ├── rag-output/
   │     ├── TCC-COR-2024-001.json   ← OpenRAG เขียน
   │     ├── TCC-COR-2024-002.json
   │     └── ...                     ← n8n อ่านทีละไฟล์
   ├── TCC-COR-2024-001.pdf
   └── ...

 ────────────── n8n บน QNAP (Schedule Trigger) ──────────────

 [n8n: Schedule Trigger ทุก 5 นาที]
   → อ่าน staging_ai/rag-output/*.json ทีละ 1 ไฟล์
   → Process → เปลี่ยนชื่อเป็น .done (หรือ ลบ)
   → Loop ต่อจนหมด Queue
```

**JSON Output Contract (เขียนลง `rag-output/<filename>.json`):**

```json
{
  "source_file": "TCC-COR-2024-001.pdf",
  "processed_at": "2026-03-13T10:00:00+07:00",
  "is_valid": true,
  "confidence": 0.91,
  "extracted_text": "เนื้อหาเต็มของเอกสาร...",
  "metadata": {
    "correspondence_number": "TCC-COR-2024-001",
    "title": "ส่งแบบ Shop Drawing งวดที่ 3",
    "document_date": "2024-03-15",
    "sender_org": "TCC",
    "receiver_org": "LCB",
    "project_code": "LCBP3",
    "suggested_category": "Correspondence",
    "detected_issues": []
  },
  "chunks": [
    { "chunk_index": 0, "page": 1, "text": "..." },
    { "chunk_index": 1, "page": 2, "text": "..." }
  ]
}
```

> ✅ **File Naming Convention:** `<original_pdf_basename>.json`  
> ตัวอย่าง: `TCC-COR-2024-001.pdf` → `TCC-COR-2024-001.json`
>
> ✅ **Idempotency:** ถ้า `.json` ไฟล์นั้นมีอยู่แล้ว → Skip (ไม่ Process ซ้ำ)  
> เพิ่ม field `processed_at` เพื่อ debug ว่า Extract เมื่อไหร่
>
> ⚠️ **Constraint (ADR-018):** OpenRAG ไม่มีสิทธิ์เข้า MariaDB  
> เขียนได้เฉพาะใน `rag-output/` เท่านั้น — ไม่แตะ PDF ต้นฉบับ

---

### Phase 1: n8n Integration — Poll JSON จาก rag-output/ แล้ว Import เข้า DMS

n8n ทำงานแบบ **Pull (Schedule-based)** — ดึง JSON ทีละไฟล์จาก Shared NAS:

```
[n8n: Schedule Trigger ทุก 5 นาที]
      │
      ├─── List Files: staging_ai/rag-output/*.json
      │         (กรอง: ไม่รวม *.done, *.error)
      │
      ├─── [ถ้าไม่มีไฟล์] → หยุด (รอรอบถัดไป)
      │
      └─── Loop ทีละ 1 ไฟล์:
             │
             ├─── อ่านไฟล์ JSON
             ├─── Validate JSON Schema (is_valid, confidence, required fields)
             │
             ├─── Confidence Router (ตาม ADR-017)
             │         ≥ 0.85 → Auto Ingest via POST /api/migration/import
             │         0.60–0.84 → INSERT migration_review_queue (รอ Human Approve)
             │         < 0.60  → Rename → .error (Log เหตุผล)
             │
             ├─── [Auto Ingest Path]
             │         POST /api/migration/import
             │         Header: Idempotency-Key: {correspondence_number}:{batch_id}
             │         Body: metadata + source_file_path
             │         → Backend StorageService ย้ายไฟล์จาก staging_ai → uploads/YYYY/MM/
             │
             ├─── [สำเร็จ] Rename: <filename>.json → <filename>.done
             ├─── [ล้มเหลว] Rename: <filename>.json → <filename>.error
             │
             └─── [Checkpoint] บันทึก migration_progress ทุก 10 records
```

> 📁 **File State Machine ใน `rag-output/`:**
>
> | สถานะ | Filename | ความหมาย |
> |-------|----------|----------|
> | Pending | `TCC-COR-001.json` | รอ n8n ดึงไป Process |
> | Done | `TCC-COR-001.done` | นำเข้า DMS สำเร็จ |
> | Error | `TCC-COR-001.error` | ล้มเหลว — รอ Manual Review |

### Phase 2: Indexing Pipeline — สร้าง Vector Index ใน Elasticsearch

```
PDF ที่ Import แล้ว (อยู่ใน uploads/)
      │
      ▼
[n8n Workflow: RAG Indexer]
      │
      ├─── ใช้ Chunks จาก OpenRAG JSON โดยตรง (ไม่ต้อง OCR ซ้ำ)
      │    หรือ Fallback: [Tika OCR] กรณีไม่มี chunks
      │
      ├─── [Ollama: Embedding]
      │         POST http://<OLLAMA_HOST>:11434/api/embeddings
      │         Model: nomic-embed-text
      │
      └─── [Elasticsearch: Index Chunk]
               index: dms_rag_chunks
               fields: doc_id, chunk_text, embedding, page_num, metadata
```

### Phase 2: Query Pipeline (Real-time)

```
User Query (จาก DMS Frontend)
      │
      ▼
[DMS Backend: RAG Controller]
      │ GET /api/rag/search?q=...&project_id=...
      │
      ├─── Check Redis Cache (TTL 5 นาที)
      │
      └─── [n8n Webhook: RAG Query]
                │
                ├─── [Ollama: Query Embedding] → Vector ของ Query
                │
                ├─── [Elasticsearch: kNN Search]
                │         └─ Top-5 Chunks ที่เกี่ยวข้อง + RBAC Filter (project_id, user_id)
                │
                ├─── [Ollama: Generate Answer]
                │         └─ Prompt: System + Context Chunks + User Query
                │            Output: JSON { answer, sources, confidence }
                │
                └─── [DMS Backend] → ส่งผลกลับ + Cache ใน Redis
```

### Phase 3: Response Contract

```json
{
  "answer": "เอกสาร RFA-2026-001 ถูก Approve โดย...",
  "sources": [
    {
      "doc_id": "uuid-xxxx",
      "doc_number": "RFA-2026-001",
      "page": 3,
      "excerpt": "...ข้อความที่ตัดมา...",
      "confidence": 0.91
    }
  ],
  "confidence": 0.87,
  "cached": false
}
```

---

## 📐 Elasticsearch Index Schema

```json
PUT /dms_rag_chunks
{
  "mappings": {
    "properties": {
      "doc_id":          { "type": "keyword" },
      "doc_number":      { "type": "keyword" },
      "project_id":      { "type": "keyword" },
      "chunk_text":      { "type": "text", "analyzer": "thai" },
      "embedding":       { "type": "dense_vector", "dims": 768 },
      "page_num":        { "type": "integer" },
      "chunk_index":     { "type": "integer" },
      "created_at":      { "type": "date" }
    }
  }
}
```

> ⚠️ **ขนาด Embedding Vector:** ขึ้นอยู่กับ Model ที่ใช้
> - `nomic-embed-text`: 768 dims
> - `llama3.2:3b` (ใช้ layer สุดท้าย): 3072 dims
> ต้องทดสอบ Performance บน RTX 2060 SUPER 8GB ก่อนเลือก

---

## 🛡️ Security & RBAC (สำคัญ)

- Query **ต้องผ่าน DMS API** — Ollama ไม่รับ Request โดยตรงจาก Frontend
- Elasticsearch Search **ต้องมี Filter** ด้วย `project_id` และ `permission_scope` เสมอ
- ผล RAG **ต้องไม่เปิดเผยเอกสาร** ที่ User ไม่มีสิทธิ์เห็น (CASL Enforcement ที่ Backend Layer)
- Cache Key ใน Redis ต้องรวม `user_id` หรือ `role` เพื่อป้องกัน Cross-user Cache Poisoning

---

## ⚙️ n8n Workflow: OpenRAG Ingestor (Node Overview)

Poll ไฟล์ JSON จาก Shared NAS ทีละไฟล์ แล้วนำข้อมูลเข้า DMS:

| Node | ชื่อ | หน้าที่ |
|------|------|----------|
| 0 | Schedule Trigger | ทำงานทุก 5 นาที (หรือ Manual Trigger) |
| 1 | List JSON Files | อ่านรายการ `staging_ai/rag-output/*.json` (กรอง .done/.error) |
| 2 | Loop Items | วนลูปทีละ 1 ไฟล์ |
| 3 | Read JSON File | อ่านเนื้อหา JSON จาก NAS |
| 4 | JSON Schema Validator | ตรวจสอบ field ครบ + ค่า is_valid |
| 5 | Confidence Router | แยก Auto / Review / Reject ตาม Threshold |
| 6A | Auto Ingest | POST `/api/migration/import` พร้อม Idempotency-Key |
| 6B | Review Queue | INSERT `migration_review_queue` เท่านั้น |
| 6C | Rename to .error | Rename ไฟล์ → `.error` + บันทึกเหตุผล |
| 7 | Rename to .done | Rename ไฟล์ → `.done` (กรณีสำเร็จ) |
| 8 | Save Checkpoint | UPDATE `migration_progress` ทุก 10 records |

---

## ⚙️ n8n Workflow: RAG Indexer (Node Overview)

Index Chunks (จาก OpenRAG JSON หรือ Tika Fallback) เข้า Elasticsearch:

| Node | ชื่อ | หน้าที่ |
|------|------|----------|
| 0 | Webhook / Schedule Trigger | รับ `doc_id` ที่นำเข้าแล้ว หรือ Batch รายคืน |
| 1 | Fetch Chunks | ดึง chunks จาก OpenRAG JSON หรือเรียก Tika Fallback |
| 2 | Tika OCR (Fallback) | POST `http://tika:9998/tika` กรณีไม่มี chunks จาก OpenRAG |
| 3 | Ollama Embeddings | POST `http://<OLLAMA_HOST>:11434/api/embeddings` |
| 4 | Elasticsearch Ingest | Bulk Index Chunks เข้า `dms_rag_chunks` |
| 5 | Update DMS Index Status | PATCH `/api/documents/{id}` ตั้ง `is_indexed: true` |

---

## ⚙️ n8n Workflow: RAG Query (Node Overview)

| Node | ชื่อ | หน้าที่ |
|------|------|----------|
| 0 | Webhook | รับ `{ query, project_id, user_id, top_k }` จาก Backend |
| 1 | Ollama: Embed Query | แปลง Query เป็น Vector |
| 2 | Elasticsearch: kNN Search | ค้นหา Top-k Chunks พร้อม RBAC Filter |
| 3 | Build RAG Prompt | รวม Context Chunks + System Prompt + User Query |
| 4 | Ollama: Generate | สร้างคำตอบ, Output JSON เท่านั้น |
| 5 | Return to Backend | Respond Webhook พร้อม `{ answer, sources, confidence }` |

---

## 📏 Confidence & Hallucination Guard

| ระดับ Confidence | การดำเนินการ |
|-----------------|--------------|
| `>= 0.80`       | แสดงผลทันที พร้อม Sources |
| `0.60 – 0.79`   | แสดงผลพร้อม Warning "โปรดตรวจสอบเอกสารต้นฉบับ" |
| `< 0.60`        | ไม่แสดงคำตอบ — แสดงเฉพาะ Document Links ที่เกี่ยวข้อง |

> AI ไม่มีสิทธิ์ Write ข้อมูลใดๆ — Output เป็น JSON Read-only เสมอ (ADR-018)

---

## 🚧 ข้อจำกัดและความเสี่ยง

| ความเสี่ยง | ผลกระทบ | Mitigation |
|-----------|----------|------------|
| NAS Drive R: disconnect ขณะ OpenRAG รัน | เขียน JSON ไม่ได้ | Langflow ตรวจ Drive ก่อนเริ่ม Loop — แจ้งเตือนถ้า mount หาย |
| ไฟล์ JSON เขียนไม่สมบูรณ์ (crash กลางคัน) | n8n อ่าน JSON เสีย | n8n ตรวจ JSON valid ก่อน Process — Rename → .error |
| OpenRAG Process PDF ซ้ำ (Retry) | JSON เขียนทับ | Skip ถ้า `.json` มีอยู่แล้ว (Idempotent by filename) |
| n8n อ่านไฟล์ขณะ OpenRAG ยังเขียนไม่เสร็จ | JSON ไม่สมบูรณ์ | OpenRAG เขียนเป็น `.tmp` ก่อน → Rename เป็น `.json` เมื่อเสร็จ |
| rag-output/ เต็ม (เก่าสะสม) | Disk บน NAS เต็ม | ตั้ง Schedule ลบ `.done` ที่เกิน 30 วัน |
| OpenRAG Metadata ผิด | นำข้อมูลผิดเข้า DMS | Confidence < 0.85 → Human Review Queue (ADR-017 Policy) |
| Embedding Dim Mismatch | Index ใช้งานไม่ได้ | กำหนด Model + Dims ก่อน Index แรก ห้ามเปลี่ยน |
| RTX 2060 SUPER VRAM (8GB) | Timeout ถ้า Model ใหญ่เกินไป | ใช้ `nomic-embed-text` สำหรับ Embedding |
| AI Hallucination | คำตอบผิด | Confidence Threshold + Source Citation บังคับ |
| Cross-project Data Leak | Security Issue | RBAC Filter ทุก Query ที่ Elasticsearch Layer |
| Elasticsearch Storage | Disk Usage สูง | เปิด ILM Policy หรือจำกัดเฉพาะ Project สำคัญ |
| Ollama ไม่พร้อม | Query ล้มเหลว | Graceful Fallback: ใช้ Elasticsearch Full-text เท่านั้น |

---

## 📋 Implementation Gate (ก่อนพัฒนา)

> **หมายเหตุ:** Feature นี้เป็น Post-UAT / Post-Migration
> ต้องผ่าน Go-Live Gate ของ Migration (ADR-017) ก่อนเริ่มพัฒนา

**OpenRAG Setup (Admin Desktop):**
- [ ] ติดตั้ง OpenRAG บน Admin Desktop ตาม `## 🛠️ OpenRAG Setup Guide` ด้านล่าง
- [ ] กำหนด Langflow Workflow: PDF Input → Docling Parse → Ollama Extract → JSON Output
- [ ] ตั้งค่า System Prompt ใน Langflow ให้ Output ตรง JSON Contract ด้านบน
- [ ] ทดสอบ Extraction Accuracy กับตัวอย่างเอกสาร 20 ฉบับ (ไทย + อังกฤษ)
- [ ] ยืนยัน OpenRAG ไม่มี DB Credentials และ Mount `staging_ai` เป็น Read-only

**n8n Webhook Integration:**
- [ ] สร้าง n8n Webhook Endpoint: รับ JSON จาก OpenRAG (validate schema + route ตาม Confidence)
- [ ] ทดสอบ Idempotency-Key กรณี OpenRAG ส่ง Duplicate
- [ ] สร้าง n8n Workflow: RAG Indexer (Dry Run กับ 10 เอกสาร)

**Search & Query:**
- [ ] Migration v1.8.x เสร็จสมบูรณ์และ Stable (Prerequisite)
- [ ] ทดสอบ `nomic-embed-text` บน Admin Desktop — วัด VRAM + Speed
- [ ] กำหนด Elasticsearch Index Schema + Dims (lock ก่อน Index แรก)
- [ ] ออกแบบ RBAC Filter สำหรับ kNN Search
- [ ] สร้าง n8n Workflow: RAG Query (ทดสอบ Hallucination)
- [ ] เพิ่ม `/api/rag/search` Endpoint ใน DMS Backend
- [ ] เพิ่ม UI Component: RAG Search Panel ใน Frontend
- [ ] Load Test: Query Latency < 5 วินาที สำหรับ Top-5 Results

---

## 🛠️ OpenRAG Setup Guide (Admin Desktop — Step by Step)

> **สภาพแวดล้อม:** Windows 10/11, i9-9900K, 32GB RAM, RTX 2060 SUPER 8GB
> **ข้อกำหนด:** Ollama ต้องรันอยู่แล้วบน Admin Desktop (Port 11434)
> **เวลาติดตั้งประมาณ:** 20–40 นาที (ขึ้นอยู่กับความเร็ว Internet สำหรับ Pull Images)

---

### ขั้นตอนที่ 1: ติดตั้ง WSL 2 + Docker Desktop

OpenRAG บน Windows **ต้องรันผ่าน WSL 2** (ข้อกำหนดจาก OpenRAG Official Docs)

```powershell
# รันใน PowerShell (Admin) บน Admin Desktop
wsl --install -d Ubuntu
# รีสตาร์ท Windows หลังติดตั้งเสร็จ
```

จากนั้นติดตั้ง **Docker Desktop for Windows** พร้อม WSL 2 Integration:

1. ดาวน์โหลด Docker Desktop จาก [docs.docker.com](https://docs.docker.com/desktop/install/windows-install/)
2. ระหว่างติดตั้ง → เปิด **"Use WSL 2 based engine"**
3. หลังติดตั้ง → ไปที่ **Settings → Resources → WSL Integration**
4. เปิด Toggle สำหรับ Ubuntu distribution → **Apply & Restart**

> ✅ ตรวจสอบ: เปิด WSL Ubuntu แล้วรัน `docker ps` — ต้องไม่มี Error

---

### ขั้นตอนที่ 2: ติดตั้ง uv ใน WSL

> ℹ️ **Ubuntu 24.04 (Noble) ไม่มี `python3.13` ใน Default Repository**
> ไม่ต้องติดตั้ง Python ด้วย `apt` — **`uv` จัดการ Python 3.13 เองได้โดยอัตโนมัติ**

```bash
# ติดตั้ง uv (ไม่ต้องการ Python ก่อน)
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc   # โหลด PATH ใหม่

# ตรวจสอบ
uv --version       # ต้องแสดง version เช่น uv 0.5.x
```

เมื่อรัน `uvx --python 3.13 openrag` ในขั้นตอนถัดไป `uv` จะ **ดาวน์โหลด Python 3.13 เองโดยอัตโนมัติ** ไม่ต้องติดตั้งแยก

> **ทางเลือก:** ถ้าต้องการ Python 3.13 ระดับ System จริงๆ (ไม่บังคับ):
> ```bash
> sudo add-apt-repository ppa:deadsnakes/ppa -y
> sudo apt update && sudo apt install -y python3.13 python3.13-venv
> ```

---

### ขั้นตอนที่ 3: ติดตั้ง OpenRAG

```bash
# ใน WSL Ubuntu:
mkdir ~/openrag-workspace
cd ~/openrag-workspace

# ⚠️ ติดตั้งแพ็กเกจระบบที่จำเป็นสำหรับ EasyOCR และ Docling
sudo apt update
sudo apt install -y libgl1 libglib2.0-0

# ติดตั้งและรัน OpenRAG (ครั้งแรกใช้เวลา 5–15 นาที)
# จะติดตั้ง easyocr ไปด้วยเพื่อรองรับ PDF ภาษาไทยผ่าน Docling
uvx --with easyocr --python 3.13 openrag
```

**ระหว่าง Interactive Setup ตอบดังนี้:**

| Prompt | คำตอบ (สำหรับระบบ LCBP3) |
|--------|--------------------------|
| OpenSearch Admin password | ตั้งรหัสผ่านแข็งแรง บันทึกไว้ |
| Langflow Admin password | ตั้งรหัสผ่านแข็งแรง บันทึกไว้ |
| OpenAI API key | **กด N / Skip** — เราใช้ Ollama แทน |
| Use custom LLM provider? | **Y** → เลือก **Ollama** |
| Ollama base URL | `http://192.168.20.100:11434` (Internal VLAN — Ollama รันบน Admin Desktop โดยตรง) |
| Configure Langfuse tracing? | **N** |
| Configure cloud connectors? | **N** |
| Start services now? | **Y** |

> ℹ️ **Ollama รันบน Windows โดยตรง** (ไม่ใช่ใน Docker) ที่ IP `192.168.20.100` — ตรงกับ Config ใน `03-05-n8n-migration-setup-guide.md`
>
> ถ้าตั้งค่าผิดพลาด แก้ไขได้ที่:
> ```bash
> nano ~/.openrag/tui/.env
> # แก้บรรทัด OLLAMA_ENDPOINT=http://192.168.20.100:11434
> ```

---

### ขั้นตอนที่ 4: ตรวจสอบ Services ที่รัน

```bash
# ดู Containers ที่ OpenRAG สร้าง
docker ps

# ควรเห็น containers เหล่านี้:
# openrag-langflow      (Langflow UI + API)
# openrag-opensearch    (OpenSearch: Vector Store)
# openrag-opensearch-dashboards (Optional)
```

**URL ที่ใช้งานได้:**

| Service | URL | หมายเหตุ |
|---------|-----|----------|
| OpenRAG UI | `http://localhost:3000` | หน้าหลัก (เหมือน Chat UI) |
| Langflow | `http://localhost:7860` | สร้าง/แก้ไข Workflow |
| OpenSearch | `http://localhost:9200` | Vector Store API |

---

### ขั้นตอนที่ 5: ตรวจสอบ Ollama Connection

```bash
# ทดสอบว่า OpenRAG เชื่อม Ollama ได้ (รันใน WSL)
curl http://192.168.20.100:11434/api/tags

# ต้องแสดง JSON รายการ Models ที่มีใน Ollama
# ตรวจสอบว่ามี:
# - llama3.2:3b
# - mistral:7b-instruct-q4_K_M
# - nomic-embed-text (ถ้ายังไม่มี ให้ติดตั้ง)
```

```bash
# ติดตั้ง nomic-embed-text (สำหรับ Embedding)
# รันบน Windows Terminal (ไม่ใช่ WSL):
ollama pull nomic-embed-text
```

---

### ขั้นตอนที่ 6: กำหนด Langflow Workflow (Batch Extraction Pipeline)

เปิด Langflow ที่ `http://localhost:7860` → **New Flow** → เพิ่ม Component ตามลำดับดังนี้:

#### ภาพรวม Node Connection

```
[Read File] ──▶ [Loop] ──▶ [Parser: Stringify] ──▶ [Prompt Template] ──▶ [Ollama]
                  │                                                           │
                  │ (filename จาก Item)                                       │
                  └──────────────────────────────────────────────────────────▶│
                                                                         [Custom Code]
                                                                               │
                                                              เขียน .tmp → rename .json
```

---

#### Node 1: Read File

> **Component:** `Read File` (หมวด Data / Helpers)

| Setting | ค่า |
|---------|-----|
| Files | อัปโหลด หรือ ชี้ไปที่ `/data/staging_ai/` |
| Advanced Parser | `OFF` (ปิด — อ่านเป็น raw text ธรรมดา) |

**การเชื่อมต่อ:**
- Output `Files` → Input `Inputs` ของ Loop

> ℹ️ Read File จะโหลดไฟล์ทั้งหมดมาเป็น list แล้วส่งให้ Loop วนลูปทีละไฟล์  
> ถ้าต้องการเลือก folder แบบ dynamic ให้ใช้ **Directory** component แทน

---

#### Node 2: Loop

> **Component:** `Loop` (หมวด Logic)

| Setting | ค่า |
|---------|-----|
| Inputs | รับจาก `Read File → Files` |

**Output ที่ใช้:**
- `Item` → ส่งต่อให้ Parser และ Custom Code (filename)
- `Done` → ไม่ต้องเชื่อมไปไหน (สัญญาณสิ้นสุด Loop)

> ℹ️ Loop จะปล่อย `Item` ทีละ 1 ไฟล์ ผ่านทุก Node ก่อนวนรอบถัดไป

---

#### Node 3: Parser (Mode: Stringify)

> **Component:** `Parser` (หมวด Processing)

| Setting | ค่า |
|---------|-----|
| Mode | **`Stringify`** (ไม่ใช่ Parser) |
| Data or DataFrame | รับจาก `Loop → Item` |

**การเชื่อมต่อ:**
- Input `Data or DataFrame` ← `Loop → Item`
- Output `Parsed Text` → Input `extracted_text` ของ Prompt Template

> ⚠️ **ใช้ Mode: Stringify เท่านั้น**  
> Mode: Parser ใช้ template เป็น pattern สำหรับดึงค่า — ไม่เหมาะกับงานนี้  
> Mode: Stringify แปลง file object เป็น text content ที่ Ollama อ่านได้

---

#### Node 4: Prompt Template

> **Component:** `Prompt Template` (หมวด Prompts)

| Setting | ค่า |
|---------|-----|
| Template | ใส่ System Prompt จากขั้นตอนที่ 7 ด้านล่าง |
| Variable `{extracted_text}` | เชื่อมกับ `Parser → Parsed Text` |

**การเชื่อมต่อ:**
- Variable `extracted_text` ← `Parser → Parsed Text`
- Output `Prompt` → Input `Input` ของ Ollama

> ℹ️ Prompt Template รองรับ `{variable_name}` สำหรับแทรกค่าแบบ dynamic  
> ต้องตั้งชื่อ variable ให้ตรงกับที่ใช้ใน template (`{extracted_text}`)

---

#### Node 5: Ollama

> **Component:** `Ollama` (หมวด Models)

| Setting | ค่า |
|---------|-----|
| Ollama API URL | `http://localhost:11434` (ถ้ารันบน WSL ไม่ต้องใส่ IP) |
| Model Name | `scb10x/typhoon2.1-gemma3-4b` |
| Format | ไม่ต้องตั้ง — ใช้ Enable Structured Output แทน |
| Temperature | `0.1` |
| Enable Structured Output | `ON` |
| Tool Model Enabled | `ON` (เห็นใน screenshot) |

**การเชื่อมต่อ:**
- Input `Input` ← `Prompt Template → Prompt`
- Input `System Message` ← ปล่อยว่าง (System Prompt อยู่ใน Prompt Template แล้ว)
- Output `Text` → Input ของ Custom Code (Node 6)

> ⚠️ **Ollama API URL:**  
> ถ้า Langflow รันใน Docker (WSL) → ใช้ `http://host.docker.internal:11434`  
> ถ้า Ollama bind บน VLAN IP → ใช้ `http://192.168.20.100:11434`  
> ทดสอบด้วย: `curl http://host.docker.internal:11434/api/tags` ใน WSL

---

#### Node 6: Write JSON (Idempotent)

> **Component:** `Custom Component` (สร้างใหม่) — ทำหน้าที่รับ output JSON จาก Ollama และดึงชื่อไฟล์จาก Loop เพื่อเขียนเป็นไฟล์ `.json`

**Python Code:**

```python
from langflow.custom import Component
from langflow.io import StrInput, DataInput, Output
from langflow.schema import Data
import json
import os
from pathlib import Path

class WriteJsonIdempotent(Component):
    display_name = "Write JSON (Idempotent)"
    description = "Writes JSON to staging_ai dynamically based on loop item filename"
    
    inputs = [
        StrInput(name="json_content", display_name="JSON Content"),
        DataInput(name="loop_item", display_name="Loop Item (PDF)"),
    ]
    
    outputs = [
        Output(display_name="Result Path", name="result_path", method="write_file")
    ]
    
    def write_file(self) -> Data:
        # Extract filename from loop_item
        pdf_path = self.loop_item.data.get("file_path", "")
        if not pdf_path:
            return Data(data={"error": "No file_path in loop item"})
            
        base_name = Path(pdf_path).stem
        out_dir = Path("/data/staging_ai/rag-output")
        out_dir.mkdir(parents=True, exist_ok=True)
        
        json_path = out_dir / f"{base_name}.json"
        
        # Idempotency check
        if json_path.exists():
            return Data(data={"status": "skipped", "path": str(json_path), "reason": "already exists"})
            
        # Parse and write content to ensure it's valid JSON before saving
        try:
            parsed = json.loads(self.json_content)
            # Inject source file name if missing
            if not parsed.get("source_file"):
                parsed["source_file"] = f"{base_name}.pdf"
                
            tmp_path = out_dir / f"{base_name}.tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(parsed, f, ensure_ascii=False, indent=2)
                
            # Atomic rename
            os.replace(tmp_path, json_path)
            
            return Data(data={"status": "written", "path": str(json_path)})
        except Exception as e:
            err_path = out_dir / f"{base_name}.error"
            with open(err_path, "w", encoding="utf-8") as f:
                f.write(f"Error parsing JSON from API: {str(e)}\\n\\nContent:\\n{self.json_content}")
            return Data(data={"status": "error", "path": str(err_path), "error": str(e)})
```

**การเชื่อมต่อ:**
- Input `json_content` ← `Ollama → Text`
- Input `loop_item` ← `Loop → Item`
- Output `result_path` → `Loop → item` (Feedback loop กลับไปบอกว่ารอบนี้จบแล้ว)

> ✅ **Idempotency:** โค้ดมีการสั่ง `if json_path.exists(): return` เพื่อข้ามไฟล์ที่เขียนไปแล้ว
> ✅ **Atomic Write:** เขียนเป็น `.tmp` ก่อนแล้วใช้ `os.replace` เพื่อป้องกัน n8n มาอ่านตอนที่ยังเขียนไม่เสร็จ
> ✅ **Dynamic Filename:** อ่าน path ต้นฉบับจาก loop item ทำให้ได้ชื่อไฟล์ .json ตรงกับ pdf เสมอ

---

#### สรุปการ Wire ทั้ง Workflow

| From | Port | To | Port |
|------|------|----|------|
| Read File | Files | Loop | Inputs |
| Loop | Item | Parser | Data or DataFrame |
| Parser | Parsed Text | Prompt Template | extracted_text |
| Prompt Template | Prompt | Ollama | input_value (Input) |
| Ollama | Text | Write JSON (Idempotent) | json_content |
| Loop | Item | Write JSON (Idempotent) | loop_item |
| Write JSON | result_path | Loop | element |


**ตั้งค่า Ollama LLM Component:**

| ฟิลด์ | ค่า |
|-------|-----|
| Model Name | `scb10x/typhoon2.1-gemma3-4b` |
| Base URL | `http://192.168.20.100:11434` |
| Format | `json` (บังคับ JSON Output) |
| Temperature | `0.1` (ลด Hallucination) |
| Max Tokens | `2048` |
| Enable Structured Output | `ON` |

> ℹ️ **เหตุผลที่เลือก Typhoon 2.1:**  
> `scb10x/typhoon2.1-gemma3-4b` โดย SCB10X เป็น Model ที่ออกแบบมาสำหรับภาษาไทยโดยเฉพาะ  
> เหมาะกับเอกสารก่อสร้างที่มีทั้งไทยและอังกฤษปนกัน ดีกว่า `llama3.2:3b` มาก  
> ต้องติดตั้งก่อน: `ollama pull scb10x/typhoon2.1-gemma3-4b` บน Admin Desktop

---

### ขั้นตอนที่ 7: System Prompt สำหรับ Metadata Extraction

คัดลอก Prompt นี้ใส่ใน **Prompt Template Component** ของ Langflow:

> ⚠️ **Langflow Escaping Rule:** ปีกกา `{` `}` ที่เป็น JSON literal ต้องเขียนเป็น `{{` `}}` (double)  
> มิฉะนั้น Langflow จะตีความว่าเป็น variable → เกิด error "Invalid variables"  
> **ข้อยกเว้น:** `{extracted_text}` ใช้ single เพราะเป็น variable จริงที่รับจาก Parser

```
คุณเป็นผู้ช่วย AI สำหรับระบบจัดการเอกสารก่อสร้าง Laem Chabang Port Phase 3 (LCBP3)
หน้าที่ของคุณคือดึงข้อมูล Metadata จากเอกสาร แล้วตอบกลับเป็น JSON ที่ valid เท่านั้น
ห้ามเพิ่มข้อความอื่นนอกจาก JSON
เอกสารอาจเป็นภาษาไทย อังกฤษ หรือผสมกัน

You are a document metadata extraction assistant for a construction document management system (LCBP3).
Extract the following fields and return ONLY a valid JSON object.
No explanation, no markdown, no text outside the JSON.
Documents may be in Thai, English, or mixed language.

Return ONLY this JSON structure:
{{
  "source_file": "<ชื่อไฟล์ PDF ที่รับมา>",
  "is_valid": true,
  "confidence": 0.0,
  "extracted_text": "<full extracted text, max 2000 chars>",
  "metadata": {{
    "correspondence_number": "<document number, e.g. TCC-COR-2024-001 or null>",
    "title": "<document title or subject — ภาษาเดิมของเอกสาร>",
    "document_date": "<date in YYYY-MM-DD format or null>",
    "sender_org": "<sender organization abbreviation or null>",
    "receiver_org": "<receiver organization abbreviation or null>",
    "project_code": "<project code, e.g. LCBP3 or null>",
    "suggested_category": "<one of: Correspondence, RFA, ContractDrawing, ShopDrawing>",
    "detected_issues": []
  }},
  "chunks": [
    {{"chunk_index": 0, "page": 1, "text": "<chunk text max 500 chars>"}}
  ]
}}

Document text to analyze:
{extracted_text}
```

> ℹ️ **`{{` `}}` → แสดงเป็น `{` `}` จริงใน prompt ที่ส่งให้ LLM**  
> ⚠️ **ห้าม Hardcode** รายการ Category — ดูจาก `GET /api/master/correspondence-types` ตาม ADR-017

---

### ขั้นตอนที่ 8: ตั้งค่า Volume Mount (AI Isolation — ADR-018)

แก้ไขไฟล์ `~/.openrag/tui/docker-compose.yml` ที่ OpenRAG สร้างขึ้น:

```yaml
services:
  langflow:
    volumes:
      # staging_ai mount จาก NAS
      # Windows R:\ drive จะปรากฏใน WSL เป็น /mnt/r/
      - /mnt/r/staging_ai:/data/staging_ai   # ← Read PDF + Write rag-output/
      # หมายเหตุ: ต้องเขียนได้ที่ rag-output/ จึงไม่ใส่ :ro

  opensearch:
    # ไม่ต้อง mount staging_ai — OpenSearch ใช้ Vector Store เท่านั้น
```

> ⚠️ **ตรวจสอบ R:\ ใน WSL:**
> ```bash
> # ใน WSL Terminal ตรวจว่า mount อยู่ที่ไหน
> ls /mnt/r/staging_ai/
> # ต้องเห็นไฟล์ PDF ที่มีอยู่
> ```
>
> ✅ **สร้าง rag-output/ ก่อนรัน:**
> ```bash
> mkdir -p /mnt/r/staging_ai/rag-output
> ```

```bash
# หลังแก้ไข docker-compose.yml — รีสตาร์ท OpenRAG
cd ~/openrag-workspace
docker compose -f ~/.openrag/tui/docker-compose.yml restart langflow
```

---

### ขั้นตอนที่ 9: ตรวจสอบ File-based Queue

ทดสอบว่า OpenRAG เขียนไฟล์ลง NAS ได้ และ n8n อ่านไฟล์จาก NAS ได้:

**ทดสอบ OpenRAG เขียน (ใน WSL):**

```bash
# ตรวจสอบว่า mount ใช้งานได้
ls /mnt/r/staging_ai/*.pdf | head -5

# ทดสอบเขียนไฟล์
echo '{"test": true}' > /mnt/r/staging_ai/rag-output/test.json
ls /mnt/r/staging_ai/rag-output/
# ต้องเห็น test.json
```

**ทดสอบ n8n อ่าน (ใน n8n Workflow):**

สร้าง Test Workflow ใน n8n:

| Node | Type | Config |
|------|------|--------|
| Trigger | Manual | - |
| List Files | Read/Write Files from Disk | Path: `staging_ai/rag-output/*.json` |
| Read File | Read/Write Files from Disk | Dynamic path จาก List node |
| Parse JSON | Code | `JSON.parse(items[0].binary.data.toString())` |

```bash
# ตรวจสอบ path ใน n8n container
docker exec n8n ls /home/node/.n8n/staging_ai/rag-output/
# ต้องเห็น test.json ที่สร้างไว้
```

> 💡 **Path Mapping:**
> - Admin Desktop (WSL): `/mnt/r/staging_ai/rag-output/`
> - n8n บน QNAP: `staging_ai/rag-output/` (ตาม Volume Mount ใน docker-compose)

---

### ขั้นตอนที่ 10: Pre-Production Verification

| ลำดับ | รายการ | วิธีตรวจสอบ |
|-------|--------|-------------|
| 1 | Ollama เชื่อมต่อได้ | `curl http://192.168.20.100:11434/api/tags` จาก WSL |
| 2 | `nomic-embed-text` พร้อม | `ollama list` บน Windows Terminal |
| 3 | Langflow รันได้ | เปิด `http://localhost:7860` |
| 4 | R:\ mount เห็น PDF | `ls /mnt/r/staging_ai/*.pdf` ใน WSL |
| 5 | Langflow เขียน rag-output/ ได้ | ดู `/mnt/r/staging_ai/rag-output/` หลังรัน Test |
| 6 | ไม่มี DB Credentials ใน env | ตรวจ `~/.openrag/tui/docker-compose.yml` |
| 7 | Extraction ถูกต้อง ≥ 85% | รัน Batch กับเอกสาร 20 ฉบับ นับ field ที่ถูก |
| 8 | JSON ถูกต้อง (valid JSON) | `python3 -m json.tool rag-output/test.json` |
| 9 | n8n อ่าน JSON จาก NAS ได้ | รัน Test Workflow ใน n8n ดู Execution Log |
| 10 | GPU VRAM < 7.5GB ระหว่างรัน | `nvidia-smi --query-gpu=memory.used --format=csv` |

```bash
# ตรวจสอบ VRAM บน Admin Desktop (Windows Terminal)
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

---

## 📋 Implementation Gate (ก่อนพัฒนา)

> **หมายเหตุ:** Feature นี้เป็น Post-UAT / Post-Migration
> ต้องผ่าน Go-Live Gate ของ Migration (ADR-017) ก่อนเริ่มพัฒนา

**OpenRAG Setup (Admin Desktop):**
- [ ] WSL 2 + Docker Desktop ติดตั้งเสร็จ (ขั้นตอนที่ 1)
- [ ] OpenRAG ติดตั้งผ่าน `uvx --python 3.13 openrag` (ขั้นตอนที่ 2–3)
- [ ] Ollama เชื่อมต่อจาก Docker Container ได้ (ขั้นตอนที่ 5)
- [ ] `nomic-embed-text` พร้อมใช้งานใน Ollama
- [ ] Langflow Batch Workflow สร้างเสร็จพร้อม System Prompt (ขั้นตอนที่ 6–7)
- [ ] Volume Mount `R:\staging_ai` → `/data/staging_ai` (Read+Write) (ขั้นตอนที่ 8)
- [ ] สร้าง folder `staging_ai/rag-output/` บน NAS ก่อนรัน
- [ ] ตรวจสอบ Idempotent: Skip ถ้า `.json` ไฟล์มีอยู่แล้ว
- [ ] ทดสอบ Extraction Accuracy ≥ 85% กับ 20 เอกสารตัวอย่าง (ขั้นตอนที่ 10)
- [ ] ยืนยัน OpenRAG ไม่มี DB Credentials ใน docker-compose.yml

**n8n File-based Queue Integration:**
- [ ] ตรวจสอบ n8n Volume Mount เห็น `staging_ai/rag-output/` (ขั้นตอนที่ 9)
- [ ] สร้าง n8n Schedule Workflow: List JSON Files → Loop → Read → Validate → Route
- [ ] ทดสอบ Rename ไฟล์ `.json` → `.done` / `.error` ใน n8n
- [ ] n8n Workflow: OpenRAG Ingestor รัน Validation + Confidence Router ได้
- [ ] ทดสอบ Idempotency-Key กรณีรัน n8n ซ้ำ (ไฟล์ `.done` ไม่ถูก Process ซ้ำ)

**Search & Query (Post-Migration):**
- [ ] Migration v1.8.x เสร็จสมบูรณ์และ Stable (Prerequisite)
- [ ] กำหนด Elasticsearch Index Schema + Dims (lock ก่อน Index แรก)
- [ ] ออกแบบ RBAC Filter สำหรับ kNN Search
- [ ] สร้าง n8n Workflow: RAG Indexer + RAG Query
- [ ] เพิ่ม `/api/rag/search` Endpoint ใน DMS Backend
- [ ] เพิ่ม UI Component: RAG Search Panel ใน Frontend
- [ ] Load Test: Query Latency < 5 วินาที สำหรับ Top-5 Results

---

*เอกสารนี้เป็น Living Document — อัปเดตเมื่อมีการตัดสินใจ Architecture ใหม่*
**Version:** 1.8.1 | **Author:** Development Team | **Last Updated:** 2026-03-13
