# AI Refactor
เนื่องจากการอัพเกรด จาก RTX2060 SUPER 8GB เป็น ASUS DUAL **RTX5060 Ti 16GB**

## เป้าหมาย
ปรับปรุงประสิทธิภาพการประมวลผล AI โดยใช้ทรัพยากรใหม่ให้เหมาะสม, รวมถึงปรับปรุงขั้นตอนการทำงานให้เหมาะสมกับทรัพยากรใหม่

```text
Typhoon OCR 1.5
Typhoon2.5-Qwen3-4B
BGE-M3
การตั้งค่าระบบคิว (BullMQ) ร่วมกับ AI
```
## Model

|Model Name|Size|Base FROM|PARAMETER|File|
|-|-|-|-|-|
|np-dms-ocr|2.9GB|scb10x/typhoon-ocr1.5-3b:latest|num_ctx 8192|np-dms-ocr-model.md|
|np-dms-typhoon2.5|3.6GB|scb10x/typhoon2.5-qwen3-4b:latest|num_ctx 8192|np-dms-typhoon2.5.model.md|
|np-dms-llama3.1-typhoon2-8b|5.5GB|scb10x/llama3.1-typhoon2-8b-instruct|num_ctx 8192|np-dms-llama3.1-typhoon2-8b.model.md|
|np-dms-gemma4-4eb|3.2GB|gemma4:e4b|num_ctx 8192|np-dms-gemma4-4eb.model.md|
|np-dms-openthaigpt-7b|8GB|promptnow/openthaigpt1.5-7b-instruct-q4_k_m|num_ctx 8192|np-dms-openthaigpt-7b.model.md|
|np-dms-openthaigpt-14b|9.7GB|promptnow/openthaigpt1.5-14b-instruct-q4_k_m|num_ctx 8192|np-dms-openthaigpt-14b.model.md|



ollama create np-dms-typhoon2.5 -f np-dms-typhoon2.5.model.md

ollama create np-dms-llama3.1-typhoon2-8b -f np-dms-llama3.1-typhoon2-8b.model.md

ollama create np-dms-gemma4-4eb -f np-dms-gemma4-4eb.model.md

ollama create np-dms-openthaigpt-7b -f np-dms-openthaigpt-7b.model.md

ollama create np-dms-openthaigpt-14b -f np-dms-openthaigpt-14b.model.md

---

## Architecture Decisions (RTX5060 Ti 16GB Optimized)

> สรุปการตัดสินใจจาก grilling session — อัปเกรดจาก RTX2060 SUPER 8GB

### VRAM Budget

| คอมโพเนนต์ | VRAM | หมายเหตุ |
|-----------|------|----------|
| `typhoon2.5-np-dms` | 3.6GB | โหลดค้างตลอด (resident) |
| `typhoon-np-dms-ocr` | 2.9GB | transient (load on-demand) |
| BGE-M3 | 2.3GB | ย้ายเข้า GPU (Sidecar device='cuda') |
| BGE-Reranker-Large | 1.5GB | ย้ายเข้า GPU (Sidecar device='cuda') |
| **รวมสูงสุด** | **~10.3GB** | เหลือ headroom ~5.7GB |

### BullMQ Concurrency

| Queue | Concurrency | เหตุผล |
|-------|-------------|--------|
| `ai-realtime` | **2** | VRAM เหลือเยอะ, response เร็วขึ้น |
| `ai-batch` | **1** | background job, ป้องกัน VRAM overflow |

### Model Loading Strategy

| โมเดล | กลยุทธ์ | keep_alive |
|-------|---------|------------|
| `typhoon2.5-np-dms` | โหลดค้างตลอด (ไม่ unload) | — |
| `typhoon-np-dms-ocr` | โหลดตาม demand, unload อัตโนมัติหลัง 5 นาที | 300 |

### Sidecar Changes (port 8765)

```diff
# ปัจจุบัน (CPU RAM)
POST /embed   → BGE-M3 (CPU)
POST /rerank  → BGE-Reranker (CPU)

# หลังอัปเกรด (GPU)
POST /embed   → BGE-M3 (GPU via device='cuda')
POST /rerank  → BGE-Reranker (GPU via device='cuda')
POST /ocr-upload  → Typhoon OCR (Ollama) ← ไม่เปลี่ยน
POST /normalize   → PyThaiNLP (CPU)      ← ไม่เปลี่ยน
```

### Implementation Tasks

- [ ] แก้ไข Sidecar Dockerfile — เพิ่ม CUDA runtime
- [ ] แก้ไข Sidecar app.py — เปลี่ยน `device='cuda'` สำหรับ BGE models
- [ ] แก้ไข docker-compose.yml — เพิ่ม NVIDIA Container Toolkit
- [ ] อัปเดต BullMQ concurrency config (ai-realtime=2)
- [ ] อัปเดต OCR keep_alive จาก 0 เป็น 300
- [ ] ตรวจสอบ OllamaService รองรับ resident model
- [ ] ทดสอบ VRAM usage จริงกับเอกสารขนาดใหญ่

### Rollout Strategy

**Big Bang** — ระบบยังไม่เปิดใช้งาน production ทำการเปลี่ยนแปลงทั้งหมดในครั้งเดียว

---

# Phase 1 : Foundation

## 1. Infrastructure

### AI Services

```text
Ollama
├── Typhoon OCR 1.5
├── Typhoon2.5-Qwen3-4B
└── BGE-M3
```

### Database

```text
Qdrant
```

### Storage AI

```text
File Serv
├── OCR Output
└── Processed Data
```

---

# Phase 2 : Ingestion Pipeline

## Step 1 Upload

```text
PDF Upload
↓
Store Original File
↓
Create Job
```

---

## Step 2 OCR

### Input

```text
PDF
```

### Process

```text
Typhoon OCR
```

### Output

```json
{
  "page": 1,
  "content": "..."
}
```

Store

```text
raw_ocr
```

Table

```sql
document_pages
```

```sql
document_id
page_no
raw_text
```

---

## Step 3 Structure

### Input

```text
Raw OCR Text
```

### Process

```text
Typhoon2.5
```

Prompt

```text
จัดโครงสร้างเอกสาร
แยก Heading
Section
Metadata
ห้ามสรุป
```

Output

```json
{
  "document_type": "ITP",
  "project": "...",
  "heading": "...",
  "content": "..."
}
```

Store

```text
structured_document
```

---

## Step 4 Chunking

### ไม่ใช้ LLM

ใช้

```text
Markdown Header Splitter
+
Recursive Splitter
```

Config

```yaml
chunk_size: 800
chunk_overlap: 120
```

Output

```json
{
  "chunk_id": "...",
  "heading": "...",
  "content": "...",
  "page": 12
}
```

---

## Step 5 Embedding

### Input

```text
Chunk
```

### Process

```text
BGE-M3
```

### Output

```text
Vector
```

---

## Step 6 Index

Store in

```text
Qdrant
```

Payload

```json
{
  "document_id": "...",
  "page": 12,
  "document_type": "ITP",
  "heading": "Inspection",
  "content": "..."
}
```

---

# Phase 3 : Retrieval

## Step 1 User Query

```text
Slump Test สำหรับงานพื้นชั้น 2 คืออะไร
```

---

## Step 2 Query Embedding

```text
BGE-M3
```

---

## Step 3 Search

```text
Qdrant
```

Top K

```text
10-20
```

---

## Step 4 Re-rank (แนะนำ)

ใช้

```text
Typhoon2.5
```

หรือภายหลังเพิ่ม

```text
bge-reranker-v2
```

Flow

```text
Top20
↓
Top5
```

---

## Step 5 Answer

ใช้

```text
Typhoon2.5
```

Prompt

```text
ตอบจาก Context เท่านั้น
อ้างอิงเอกสาร
อ้างอิงหน้า
ห้ามเดา
```

Output

```text
คำตอบ

อ้างอิง:
ITP-001 หน้า 12
MS-005 หน้า 8
```

---

# Phase 4 : Metadata Extraction

เพิ่มภายหลัง

Typhoon2.5 Extract

```text
Project
Contractor
Subcontractor
Discipline
Document Type
Revision
Date
```

เก็บใน PostgreSQL

ช่วยทำ Filter Search เช่น

```text
Project = ABC
Type = MIR
Revision = C
```

ก่อนเข้า Qdrant

---

# Ollama Models

## Typhoon OCR

```dockerfile
FROM scb10x/typhoon-ocr1.5-3b:latest
```

ไม่ต้อง custom

---

## Typhoon2.5

```dockerfile
FROM scb10x/typhoon2.5-qwen3-4b:latest

PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.05
PARAMETER num_ctx 8192
```

**ไม่มี SYSTEM**

---

## Runtime Config

### Structure

```json
{
  "num_ctx": 8192,
  "temperature": 0
}
```

### Answer

```json
{
  "num_ctx": 16384,
  "temperature": 0.1
}
```

---

# MVP Roadmap

## Sprint 1

✅ Upload PDF
✅ OCR
✅ Store OCR
✅ Chunking
✅ Embedding
✅ Qdrant Search

---

## Sprint 2

✅ Typhoon2.5 Structuring
✅ Metadata Extraction
✅ Better Chunking

---

## Sprint 3

✅ RAG QA
✅ Citation
✅ Source Reference

---

## Sprint 4

✅ Hybrid Search (Vector + Metadata)
✅ Re-ranking
✅ Multi-document QA

---

### Architecture สุดท้าย

```text
PDF
 ↓
Typhoon OCR
 ↓
Raw OCR
 ↓
Typhoon2.5
(Structure + Metadata)
 ↓
Markdown/Header Splitter
 ↓
Recursive Splitter
 ↓
BGE-M3
 ↓
Qdrant

--------------------------------

Question
 ↓
BGE-M3
 ↓
Qdrant
 ↓
Top-K Chunks
 ↓
Typhoon2.5
 ↓
Answer + Citation
```

สำหรับ MVP ผมจะ **ตัด Metadata Extraction ขั้นสูงและ Re-ranker ออกก่อน** แล้วทำให้ OCR → Search → Answer ใช้งานได้จริงภายใน 2–3 สัปดาห์แรก จากนั้นค่อยเพิ่มความแม่นยำทีละส่วน.
