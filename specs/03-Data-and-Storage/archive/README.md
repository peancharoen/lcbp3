# Archived Specs — Data & Storage

โฟลเดอร์นี้เก็บ specification documents ที่ **ล้าสมัย** (superseded / replaced) แล้ว คงไว้เพื่อ **ประวัติศาสตร์การตัดสินใจ** ตามกระบวนการ ADR-REVIEW-PROCESS (immutable history)

> ⚠️ **ห้ามอ้างอิงเป็นที่ปัจจุบัน** — สถาปัตยกรรม AI/RAG ปัจจุบันรวมอยู่ใน [ADR-043: AI Architecture Current State](../../06-Decision-Records/ADR-043-ai-architecture-current-state.md) (Single Source of Truth)

---

## รายการเอกสารที่ Archived

| Document | Title | Status | Date Archived | Superseded By |
| :--- | :--- | :--- | :--- | :--- |
| [03-07-OpenRAG.md](./03-07-OpenRAG.md) | RAG (Retrieval-Augmented Generation) — Future Architecture Spec | ❌ Deprecated | 2026-08-03 | ADR-023 → ADR-035 → ADR-040 → ADR-043 |

---

## เหตุผลในการ Archive

### 03-07-OpenRAG.md

เอกสารนี้เป็น "Future Architecture Spec" ฉบับร่าง v1.8.1 (2026-03-13) ที่ออกแบบ RAG Pipeline ด้วย:

- **OpenRAG** (Docling + OpenSearch + Langflow) บน Admin Desktop
- **Tika** สำหรับ Fallback OCR บน QNAP
- **Elasticsearch 8.11** เป็น Vector Store
- **n8n + file-based queue** (`rag-output/*.json` folder polling ทุก 5 นาที)

**สถาปัตยกรรมทั้งหมดนี้ถูกแทนที่** โดยลู่ ADR ดังนี้:

| ส่วนประกอบ (03-07) | สถาปัตยกรรมปัจจุบัน | ADR ที่เปลี่ยน |
|---|---|---|
| Elasticsearch (Vector Store) | **Qdrant** (Hybrid: Dense + Sparse) | ADR-035 |
| nomic-embed-text (768-dim) | **BGE-M3** (1024-dim Dense + Sparse) | ADR-035 |
| Score-based Re-ranking | **BGE-Reranker-Large** (top 3-5 chunks) | ADR-035 |
| OpenRAG (Docling + Langflow) | **OCR Sidecar** (FastAPI pure compute worker) | ADR-040 |
| Tika fallback | **Removed** — single engine `np-dms-ocr` (no Tesseract, no Tika) | ADR-040 D1 |
| n8n file-based queue | **BullMQ** (`ai-realtime` + `ai-batch`, concurrency=1) | ADR-023A §2.2 |
| gemma4:9b (LLM) | **`np-dms-ai`** (Typhoon2.5-Qwen3-4b, Thai-optimized) | ADR-034 |
| Desk-5439 + QNAP (2 hosts) | **`np-dms-lcbp3`** (single-host Docker, 4 layers) | ADR-041 |

**หมายเหตุ:** Elasticsearch ยังคงอยู่ในโค้ด (`backend/src/modules/search/search.service.ts`) แต่ใช้สำหรับ **full-text search ทั่วไป** (MariaDB fallback / ค้นหาเอกสารที่ยังไม่ embed) — **ไม่ใช่ RAG vector store** ตามที่ 03-07 อธิบาย

---

## การอ้างอิง

- [ADR-043: AI Architecture Current State](../../06-Decision-Records/ADR-043-ai-architecture-current-state.md) — Single Source of Truth ปัจจุบัน (โดยเฉพาะ §4: AI Pipeline Flows)
- [ADR-035: AI Pipeline Flow Architecture](../../06-Decision-Records/ADR-035-ai-pipeline-flow-architecture.md) — แหล่งที่มาของ Hybrid Search + Qdrant + BGE-M3 (amended by ADR-040)
- [ADR-040: OCR Sidecar Refactor](../../06-Decision-Records/ADR-040-ocr-sidecar-refactor.md) — แหล่งที่มาของ sidecar contract ปัจจุบัน (amends ADR-035)
- [02-05-ai-document-ingestion-flow.md](../../02-architecture/02-05-ai-document-ingestion-flow.md) — end-to-end flow walkthrough ปัจจุบัน

---

**Last Updated:** 2026-08-03
