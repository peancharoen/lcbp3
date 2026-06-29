# 📋 OCR Sidecar — แผนการ Refactor by QWEN

**Project:** NAP-DMS (OCR Sidecar Modernization)
**Target Hardware:** NVIDIA RTX 5060 Ti 16GB
**Date:** 2026-06-20
**Owner:** Document Intelligence Engine / Senior Full Stack Developer
**Status:** 🟡 Planning Phase
**ไฟล์:** `ocr-sidecar-refactor-plan-qwen.md`

---

## 🎯 1. Executive Summary

แผนการ Refactor ครั้งนี้มีเป้าหมายเพื่อเปลี่ยน **OCR Sidecar** จาก "Fat Worker ที่แบกรับ Business Logic และ Hardware Decision" ให้กลายเป็น **"Pure Dumb Worker"** ที่โฟกัสเฉพาะการทำ AI Inference เท่านั้น โดยย้าย Orchestration, Security Gatekeeping, และ VRAM Management กลับไปให้ **NestJS Backend** เป็นผู้ควบคุมผ่านกลไก **Global Mutex + Task Queue**

### 🎯 Key Objectives
1. ✅ **Security:** ปิดช่องโหว่ Path Traversal ใน `/ocr` endpoint
2. ✅ **Architecture:** แยก Business Logic (DMS Tags, Noise Filtering, Pagination) ออกจาก Inference Layer
3. ✅ **Performance:** ลด Latency 2-5 วินาที/Request โดยยกเลิกการย้าย Model ข้าม RAM↔VRAM
4. ✅ **Stability:** ป้องกัน OOM Crash บน RTX 5060 Ti 16GB ด้วย Backend-Controlled Mutex
5. ✅ **Scalability:** Sidecar รับ Request แบบ "1 หน้า = 1 Request" เพื่อรองรับ Horizontal Scaling

---

## 🏗️ 2. Architecture Comparison

### 🔴 Current Architecture (Anti-Pattern)
```
┌─────────────────┐         ┌─────────────────────────────────────┐
│   NestJS API    │ ──────► │      Python Sidecar (Fat Worker)    │
│                 │         │  ┌───────────────────────────────┐  │
│  (Minimal Logic)│         │  │ ❌ Path Validation            │  │
│                 │         │  │ ❌ DMS Tag Injection          │  │
│                 │         │  │ ❌ Noise Filtering            │  │
│                 │         │  │ ❌ Page Loop Orchestration    │  │
│                 │         │  │ ❌ VRAM Decision (per req)    │  │
│                 │         │  │ ❌ Model .to('cuda'/'cpu')    │  │
│                 │         │  └───────────────────────────────┘  │
└─────────────────┘         └─────────────────────────────────────┘
```

### 🟢 Target Architecture (Best Practice)
```
┌──────────────────────────────────────────────────────────────────┐
│                    NestJS Backend (Orchestrator)                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Path Guard  │  │ Prompt Builder│  │ VRAM Mutex (Global)    │ │
│  │ (Canonical) │  │ (DMS Tags)    │  │ ──► Sequential GPU Ops │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ PDF Splitter│  │ Noise Filter │  │ BullMQ Task Queue      │ │
│  │ (Per Page)  │  │ (Regex)       │  │ ──► Concurrency Ctrl   │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (1 page = 1 request)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              Python Sidecar (Pure Dumb Worker)                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ✅ PDF → Image (PyMuPDF)                                   │  │
│  │ ✅ Ollama /v1/chat/completions call                        │  │
│  │ ✅ BGE-M3 Embedding (Fixed on GPU at startup)              │  │
│  │ ✅ BGE-Reranker (Fixed on GPU at startup)                  │  │
│  │ ✅ Thai NLP Normalize (PyThaiNLP)                          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 3. VRAM Budget Analysis (RTX 5060 Ti 16GB)

| Component | Model | VRAM Usage | Status |
|-----------|-------|------------|--------|
| **BGE-M3 + Reranker** | `BAAI/bge-m3` + `bge-reranker-large` | **~4.5 GB** | 🔒 **Resident** (Load once at startup, stay on GPU) |
| **np-dms-ocr** (VLM 3B) | Q4_K_M quantized | **~5.0 GB** | 🔄 **Ephemeral** (Loaded on-demand, `keep_alive=0`) |
| **np-dms-ai** (LLM 7B-8B) | Q4_K_M quantized | **~6.0 GB** | 🔄 **Ephemeral** (Loaded on-demand, `keep_alive=10m`) |
| **CUDA Context + OS** | System overhead | **~1.5 GB** | 🔒 **Fixed** |
| **Total Peak** | — | **~10.5 GB** | ✅ **Safe** (Headroom ~5.5 GB) |

### ⚠️ Critical Rule
**ห้าม** โหลด `np-dms-ocr` และ `np-dms-ai` พร้อมกันเด็ดขาด (5 + 6 = 11 GB + BGE 4.5 GB = 15.5 GB → OOM Risk)
**ทางแก้:** NestJS Backend ต้องใช้ **Mutex** บังคับให้ทำงานแบบ Sequential เท่านั้น

---

## 📝 4. Task Breakdown

### 🔴 Phase 1: Security & Critical Fixes (Priority: CRITICAL)
**Scope:** `app.py` only — ต้องทำก่อน Deploy

| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | แก้ **Path Traversal** ใน `/ocr` ด้วย Path Canonicalization | `app.py` | ⬜ |
| 1.2 | แก้ **Mutable Default Argument** (`options_override: dict = {}`) | `app.py` | ⬜ |
| 1.3 | ลบ `import tempfile` ที่ซ้ำซ้อนใน `ocr_upload` | `app.py` | ⬜ |
| 1.4 | เปลี่ยน `@app.on_event("startup")` → `lifespan` context manager | `app.py` | ⬜ |

**Acceptance Criteria:**
- [ ] ส่ง `pdfPath: "../../../../etc/passwd"` ต้องได้ HTTP 403
- [ ] Pytest ผ่าน 100% สำหรับ Security Test Suite

---

### 🟠 Phase 2: Move Business Logic to Backend (Priority: HIGH)
**Scope:** NestJS Backend + `app.py` simplification

| # | Task | File | Status |
|---|------|------|--------|
| 2.1 | สร้าง `PromptBuilderService` ใน NestJS (Inject DMS Tags) | `backend/src/ocr/prompt-builder.service.ts` | ⬜ |
| 2.2 | สร้าง `PdfSplitterService` (แยก PDF เป็น N หน้า) | `backend/src/ocr/pdf-splitter.service.ts` | ⬜ |
| 2.3 | สร้าง `OcrNoiseFilterService` (Regex-based cleanup) | `backend/src/ocr/noise-filter.service.ts` | ⬜ |
| 2.4 | สร้าง `OcrOrchestratorService` (Loop + Concurrent Calls) | `backend/src/ocr/orchestrator.service.ts` | ⬜ |
| 2.5 | **ลบ** DMS Tag injection ออกจาก `process_ocr()` | `app.py` | ⬜ |
| 2.6 | **ลบ** `filter_ocr_noise()` ออกจาก Sidecar | `app.py` | ⬜ |
| 2.7 | **ลบ** Page loop ออกจาก `_process_pdf_doc()` (รับ page_num เดียว) | `app.py` | ⬜ |

**Acceptance Criteria:**
- [ ] Sidecar รับ Request แบบ "1 หน้า = 1 Request" เท่านั้น
- [ ] Backend สามารถประกอบ Prompt แบบ Dynamic ได้ (รองรับ Metadata Fields ใหม่ๆ)
- [ ] Concurrent OCR 5 หน้าพร้อมกัน ทำได้ผ่าน BullMQ

---

### 🟡 Phase 3: VRAM & GPU Management (Priority: HIGH)
**Scope:** `app.py` + NestJS Mutex

| # | Task | File | Status |
|---|------|------|--------|
| 3.1 | **ลบ** `bge_model.model.to("cuda"/"cpu")` ออกจาก `/embed`, `/rerank` | `app.py` | ⬜ |
| 3.2 | **แก้** `load_bge_models()` ให้ `.to("cuda")` ครั้งเดียวตอน Startup | `app.py` | ⬜ |
| 3.3 | **ลบ** `get_vram_headroom()` decision logic (เหลือแค่ Log) | `app.py` | ⬜ |
| 3.4 | สร้าง `VramMutexService` ใน NestJS (Global Async Lock) | `backend/src/gpu/vram-mutex.service.ts` | ⬜ |
| 3.5 | สร้าง `GpuTaskQueue` (BullMQ) สำหรับ OCR/Chat/Rerank | `backend/src/gpu/gpu-queue.service.ts` | ⬜ |
| 3.6 | ตั้ง `keep_alive=0` สำหรับ `np-dms-ocr` ใน Ollama config | `docker-compose.yml` | ⬜ |
| 3.7 | ตั้ง `keep_alive=10m` สำหรับ `np-dms-ai` ใน Ollama config | `docker-compose.yml` | ⬜ |

**Acceptance Criteria:**
- [ ] BGE-M3 โหลดเข้า GPU ครั้งเดียวตอน Container Start
- [ ] ไม่เกิด OOM Crash แม้รัน OCR + Chat สลับกัน 100 รอบ
- [ ] Latency ของ `/embed` ลดลงจาก ~3s → ~0.3s ต่อ Request

---

### 🟢 Phase 4: Sidecar Simplification (Priority: MEDIUM)
**Scope:** `app.py` cleanup

| # | Task | File | Status |
|---|------|------|--------|
| 4.1 | เปลี่ยน `httpx.Client` → Global `httpx.AsyncClient` (Connection Pool) | `app.py` | ⬜ |
| 4.2 | เปลี่ยน endpoint ทั้งหมดเป็น `async def` | `app.py` | ⬜ |
| 4.3 | เปลี่ยน `process_ocr()` → `async def process_ocr()` | `app.py` | ⬜ |
| 4.4 | เพิ่ม OpenTelemetry tracing (span per request) | `app.py` | ⬜ |
| 4.5 | เพิ่ม Prometheus metrics (`ocr_requests_total`, `inference_duration_seconds`) | `app.py` | ⬜ |

**Acceptance Criteria:**
- [ ] Sidecar รองรับ 50 concurrent requests ได้โดยไม่ Timeout
- [ ] มี Grafana Dashboard แสดง Latency p95/p99

---

## 📦 5. File Changes Summary

### 🗑️ Files to DELETE / Simplify
| File | Action | Reason |
|------|--------|--------|
| `app.py::filter_ocr_noise()` | **Delete** | ย้ายไป NestJS |
| `app.py::DMS tag injection` | **Delete** | ย้ายไป NestJS PromptBuilder |
| `app.py::Page loop` | **Delete** | ย้ายไป NestJS Orchestrator |
| `app.py::VRAM decision` | **Delete** | ย้ายไป NestJS Mutex |
| `services/vram_monitor.py` | **Delete** | ไม่จำเป็นแล้ว |

### 🆕 Files to CREATE (NestJS)
| File | Purpose |
|------|---------|
| `backend/src/ocr/prompt-builder.service.ts` | ประกอบ Prompt + Inject DMS Tags |
| `backend/src/ocr/pdf-splitter.service.ts` | แยก PDF เป็น Buffer ต่อหน้า |
| `backend/src/ocr/noise-filter.service.ts` | Regex-based text cleanup |
| `backend/src/ocr/orchestrator.service.ts` | จัดการ Page Loop + Concurrency |
| `backend/src/gpu/vram-mutex.service.ts` | Global Async Lock สำหรับ GPU Ops |
| `backend/src/gpu/gpu-queue.service.ts` | BullMQ Queue สำหรับ GPU Tasks |

### ✏️ Files to MODIFY
| File | Changes |
|------|---------|
| `app.py` | Simplify to Pure Worker (~50% reduction) |
| `docker-compose.yml` | เพิ่ม Ollama `keep_alive` config |
| `Modelfile` | Sync options กับ Sidecar payload |

---

## ✅ 6. Definition of Done (DoD)

### 🔒 Security
- [ ] Path Traversal test ผ่าน 100%
- [ ] API Key validation ครอบคลุมทุก endpoint
- [ ] `systemPrompt` length validation ทำงานถูกต้อง

### ⚡ Performance
- [ ] `/embed` latency < 500ms (p95)
- [ ] `/rerank` latency < 800ms (p95)
- [ ] OCR per page < 30s (รวม cold start)
- [ ] Concurrent 5 pages OCR ทำได้ภายใน 60s

### 🛡️ Stability
- [ ] ไม่เกิด OOM Crash ใน 24-hour stress test
- [ ] Sidecar auto-recover จาก Ollama timeout ได้
- [ ] VRAM usage คงที่ (ไม่เกิด memory leak)

### 📊 Observability
- [ ] Structured logging (JSON) ในทุก endpoint
- [ ] Prometheus metrics exposed ที่ `/metrics`
- [ ] Grafana dashboard พร้อมใช้งาน

---

## ⚠️ 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **OOM Crash** เมื่อโหลด 2 LLM พร้อมกัน | 🔴 Critical | NestJS Mutex บังคับ Sequential + Ollama `keep_alive=0` |
| **Path Traversal** ใน `/ocr` | 🔴 Critical | Canonicalization + Base Path Whitelist |
| **BGE-M3 Load ช้า** ตอน Startup | 🟡 Medium | Pre-download model ใน Dockerfile (no runtime download) |
| **Ollama Cold Start** (~65s) | 🟡 Medium | ใช้ Warm-up endpoint ตอน Container Start |
| **VRAM Fragmentation** จาก `.to()` calls | 🟡 Medium | **ลบ** `.to()` calls ออกทั้งหมด (Phase 3) |

---

## 🚀 8. Rollout Plan

```
Week 1: Phase 1 (Security) ────────────────► Deploy to Staging
Week 2: Phase 3 (VRAM) ────────────────────► Load Test 24h
Week 3: Phase 2 (Move Logic to Backend) ───► Integration Test
Week 4: Phase 4 (Simplification) ──────────► Production Release
```

### 🔄 Rollback Strategy
- ทุก Phase ต้องมี **Feature Flag** เปิด/ปิดได้
- Sidecar เก่ายังคง Deploy คู่ขนานได้ 2 สัปดาห์หลัง Release
- NestJS Backend สามารถ Fallback ไปใช้ Sidecar เก่าได้ผ่าน Env Var `OCR_SIDECAR_VERSION=v1|v2`

---

## 📚 9. References

- [ADR-023A] OCR Engine Selection (revised 2026-06-11)
- [ADR-033] Engine Switching Strategy
- [ADR-034] np-dms-ocr as Canonical Engine
- [ADR-036] Model Naming Convention
- [T015], [T025], [T026-T028] — Technical Specs จาก Change Log
- [NAP-DMS Spec 04-00] Infrastructure & OPS

---

**Prepared by:** Document Intelligence Engine
**Reviewed by:** _Pending_
**Approved by:** _Pending_
