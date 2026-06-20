<!-- File: specs/06-Decision-Records/ADR-040-ocr-sidecar-refactor.md -->
<!-- Change Log
- 2026-06-20: Created initial ADR-040 documenting OCR sidecar refactor decisions.
  - Supersedes ADR-033 §7 (X-API-Key sidecar auth) in favor of network isolation.
  - Preserves resolved GPU policies (Adaptive Residency, CPU Fallback, LLM-First Ownership).
  - Aligns with ADR-036 Profile-Only Parameter Governance.
  - References ADR-041 for server consolidation enabling network-only auth.
-->

# ADR-040: OCR Sidecar Refactor — Pure Compute Worker, Preserved GPU Policy, Network-Trust Boundary

**Status:** Proposed
**Date:** 2026-06-20
**Supersedes:** ADR-033 §7 (X-API-Key sidecar auth)
**Amends:** ADR-036 §5 (sidecar contract), ADR-034 (model identity unchanged)
**Related Documents:**
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)
- [ADR-008: Email Notification Strategy](./ADR-008-email-notification-strategy.md)
- [ADR-029: Dynamic Prompt Management](./ADR-029-dynamic-prompt-management.md)
- [ADR-037: Active Prompt System](./ADR-037-active-prompt-system.md)
- [ADR-035: AI Pipeline & OCR Integration](./ADR-035-ai-pipeline-ocr-integration.md)
- [ADR-041: Server Consolidation](./ADR-041-server-consolidation.md)
- [CONTEXT.md](../../00-overview/CONTEXT.md)
- [OCR Sidecar Refactor Plan - Claude](../../../docs/ocr-sidecar-refactor-plan-cluade.md)
- [OCR Sidecar Refactor Plan - Qwen](../../../docs/ocr-sidecar-refactor-plan-qwen.md)

> **Note:** ADR numbers 038–039 are intentionally reserved/skipped.

---

## 🎯 Context and Problem Statement

### Current Architecture

OCR Sidecar บน Desk-5439 (RTX 5060 Ti 16GB) ทำหน้าที่เป็น FastAPI HTTP service สำหรับ:
- `/ocr` - สกัดข้อความจาก PDF ผ่าน Typhoon OCR (np-dms-ocr via Ollama)
- `/embed` - สร้าง vector embedding ผ่าน BGE-M3
- `/rerank` - จัดลำดับผลลัพธ์ retrieval ผ่าน FlagReranker
- `/normalize` - normalize ภาษาไทย (ใช้โดย ThaiPreprocessProcessor)

### Problems Identified

จากการทบทวนสองแผน refactor (Claude + Qwen) พบปัญหาดังนี้:

1. **Security Bug:** Hardcoded default API key (`lcbp3-dms-ocr-sidecar-secure-token-2026`) ใน `app.py` — หาก leak จะไม่สามารถ rotate ได้โดยไม่ rebuild container
2. **Synchronous Blocking I/O:** `process_ocr` ใช้ `httpx.Client` แบบ sync ทำให้ block event loop ของ FastAPI
3. **Deprecated Startup Pattern:** ใช้ `@app.on_event("startup")` แทน `lifespan` context manager
4. **Hardcoded keep_alive:** `process_ocr` บังคับ `keep_alive: 0` แต่ไม่ได้เรียก `calculate_ocr_residency()` จาก `residency_policy.py` — ทำให้ Adaptive OCR Residency policy ไม่ทำงาน
5. **Hardcoded Runtime Parameters:** `temperature`, `top_p`, `repeat_penalty`, `max_tokens` ถูก hardcode ใน sidecar แทนการดึงจาก `ai_execution_profiles` (ADR-036 Profile-Only Parameter Governance)
6. **Path Traversal Vulnerability:** `/ocr` endpoint เปิดไฟล์ตาม `req.pdfPath` โดยไม่มี canonicalization/whitelist — เสี่ยง arbitrary file read (ADR-016)
7. **Cross-Host Trust Gap:** ปัจจุบัน sidecar อยู่บน Desk-5439 (192.168.10.100) และ backend อยู่บน QNAP (192.168.10.8) — "Docker internal network" เป็นเท็จ ต้องพึ่ง VLAN/firewall ACL
8. **Mutable Default Argument:** `process_with_typhoon_ocr(pdf_path, ..., options_override={})` — Python anti-pattern

### Conflict with Canonical Specs

การทบทวนทั้งสองแผนพบว่า:
- **Claude** สมมติ `np-dms-ai = llama3.2 3B (~2–3GB)` แต่ ADR-034/CONTEXT ระบุ `np-dms-ai` runtime คือ Typhoon-2.5 (~7–8B) — VRAM budget ผิด
- **ทั้งสองแผน** เสนอลบ `vram_monitor.py` / `residency_policy.py` และบังคับ BGE+Reranker GPU-resident — ละเมิด LLM-First GPU Ownership + CPU Fallback Retrieval ที่ CONTEXT.md ได้ resolve ไว้แล้ว
- **ทั้งสองแผน** ถือ `keep_alive` เป็น fixed config value — ละเมิด ADR-036 Gap-2 (keep_alive = lazy resource param via residency policy)

---

## ⚙️ Decision Drivers

* **Preserve Resolved GPU Policy:** Adaptive OCR Residency + CPU Fallback Retrieval + LLM-First GPU Ownership (CONTEXT.md)
* **Profile-Only Parameter Governance:** พารามิเตอร์ AI model (temperature, top_p, keep_alive) ต้องมาจาก `ai_execution_profiles` row `ocr-extract` (ADR-036)
* **Security (ADR-016):** Path traversal hardening, no hardcoded secrets
* **Network Trust Boundary:** Server consolidation (ADR-041) ทำให้ Docker-internal isolation เป็นไปได้จริง
* **No Invented Orchestration:** ห้ามสร้าง `VramMutexService`, `GpuTaskQueue`, `PromptBuilderService` ใหม่ — ใช้ existing services/Active Prompt ตาม ADR-008, ADR-029/037
* **ADR-023A Boundary:** AI sidecar ห้ามเข้าถึง DB/storage โดยตรง

---

## 🏛️ Decisions

### D1: Sidecar as Pure Compute Worker
Sidecar ทำหน้าที่เป็น compute worker เท่านั้น — orchestration, parameter governance, และ business logic อยู่ใน backend (existing services)
- **Reject:** การสร้าง `PromptBuilderService`, `OcrNoiseFilterService`, `OcrOrchestratorService` ใหม่ (Qwen plan)
- **Fast-path decision** (PyMuPDF chars > 100 → fast path): คงไว้ใน sidecar
- **Page range calculation:** ย้ายไป backend
- **Engine selection:** ไม่ต้องมีแล้ว — ใช้ np-dms-ocr ตัวเดียว (Typhoon OCR)
- **systemPrompt validation** (ตรวจสอบ placeholders เช่น `{{ocr_text}}`): backend

### D2: Remove /normalize Endpoint
- **ตัด /normalize endpoint** ออกจาก sidecar
- **ใช้แค่ np-dms-ocr (OCR)** เท่านั้น — sidecar ไม่รองรับ Thai normalization
- ThaiPreprocessProcessor ไม่มีการใช้งาน — ไม่ต้องแก้ไข backend

### D3: Async I/O + Lifespan + Shared AsyncClient
- `process_ocr` → `async def`
- ใช้ `httpx.AsyncClient` shared ผ่าน lifespan context manager
- เปลี่ยนจาก `@app.on_event("startup")` เป็น `@asynccontextmanager` lifespan
- Load models ผ่าน `asyncio.to_thread` เพื่อไม่ block startup

### D4: keep_alive via calculate_ocr_residency() (Lazy, ADR-036 Gap-2)
- Wire `calculate_ocr_residency(active_profile)` เข้า `process_ocr`
- ไม่ใช้ fixed value (Claude 300, Qwen 0/10m)
- **ไม่รับ** explicit `options_override["keep_alive"]` จาก backend — keep_alive เป็น lazy resource param ที่คำนวณณ process time เท่านั้น (ADR-036 Gap-2)
- **Reject:** การลบ `vram_monitor.py` / `residency_policy.py`

### D5: Retain vram_monitor + CPU-Fallback for /embed, /rerank
- **Reject:** การบังคับ BGE-M3 + Reranker GPU-resident ถาวร
- **Keep:** Dynamic CPU/GPU selection ผ่าน `.to(device)` logic
- เป็นการ implement LLM-First GPU Ownership + CPU Fallback Retrieval

### D6: Remove Hardcoded Default Key; Auth = Network Isolation (2-Phase)
- **Phase 1** (ก่อน consolidation): ลบ hardcoded default `OCR_SIDECAR_API_KEY` — fail-fast ถ้า env missing
- **Phase 2** (หลัง consolidation): **Supersedes ADR-033 §7** — ลบ `X-API-Key` validation จาก sidecar endpoints และ backend send-side
- **Network Isolation:** ตรวจสอบผ่าน Docker-internal network (post-consolidation) หรือ VLAN/firewall ACL (interim cross-host)
- **Sequencing:** ลบ `X-API-Key` เฉพาะเมื่อ ADR-041 cutover เสร็จ (single Docker host)
- **Interim Period:** ระหว่าง Phase 1 และ Phase 2, sidecar และ backend ต้อง **ยังคง** validate และส่ง `X-API-Key`
- Rotate leaked key ก่อน cutover

### D7: Path Canonicalization + Base-Path Whitelist on /ocr
- Canonicalize `pdfPath` ผ่าน `os.path.abspath()` + `os.path.realpath()`
- Whitelist base path = `OCR_SIDECAR_UPLOAD_BASE` (CIFS mount base)
- Reject paths ที่ไม่ได้อยู่ภายใต้ base path → 403 Forbidden

### D8: Runtime Params from Job Snapshot (ocr-extract row)
- **Backend** resolve params จาก `ai_execution_profiles` (row `ocr-extract` สำหรับ OCR, profile สำหรับ LLM)
- **Backend** ส่ง params (`temperature`, `top_p`, `repeat_penalty`, `max_tokens`) ไปให้ sidecar
- **Sidecar** รับ params จาก backend แล้วส่งต่อไป Ollama (ในทุกครั้งที่ load/generate)
- ห้าม hardcode defaults ใน sidecar
- Modfile ทำหน้าที่เป็น last-resort fallback เท่านั้น
- Align กับ ADR-036 Profile-Only Parameter Governance

### D9: DMS Tags + SystemPrompt from Active Prompt
- **Backend** resolve systemPrompt จาก Active Prompt ใน `ai_prompts` (ADR-029/037)
- **Backend** resolve DMS extraction tags (`<document_number>`, `<document_date>`, `<received_date>`) จาก Active Prompt
- **Backend** ส่งทั้ง systemPrompt และ DMS tags ไปให้ sidecar
- **Sidecar** รับ systemPrompt และ DMS tags จาก backend แล้วส่งต่อไป Ollama (ในทุกครั้งที่ load/generate)
- **Reject:** การสร้าง `PromptBuilderService` ใหม่เป็น prompt authority

---

## 📋 Implementation Tasks

### Phase 1 — ก่อน ADR-041 Consolidation (ยังคง X-API-Key)

| Task ID | Component | Summary | Status |
| :--- | :--- | :--- | :--- |
| T001 | Sidecar | Remove hardcoded default API key (fail-fast if env missing) | Pending |
| T002 | Sidecar | Fix mutable default arg `options_override={}` | Pending |
| T003 | Sidecar | Remove duplicate `import tempfile` | Pending |
| T004 | Sidecar | Refactor to async I/O + shared AsyncClient | Pending |
| T005 | Sidecar | Replace `@app.on_event("startup")` with lifespan | Pending |
| T006 | Sidecar | Wire `calculate_ocr_residency()` into `process_ocr` | Pending |
| T007 | Sidecar | Path canonicalization + base-path whitelist on `/ocr` | Pending |
| T008 | Sidecar | Remove hardcoded runtime params (use from job snapshot) | Pending |
| T009 | Sidecar | Receive systemPrompt + DMS tags from backend, pass to Ollama | Pending |
| T010 | Sidecar | Remove `/normalize` endpoint (D2) | Pending |
| T011 | Backend | Send runtime params from `ai_execution_profiles` snapshot to sidecar | Pending |
| T012 | Backend | Wire Active Prompt injection for DMS tags + systemPrompt | Pending |
| T013 | Tests | Pytest for path-traversal (403) | Pending |
| T014 | Tests | Unit check for residency wiring | Pending |

### Phase 2 — หลัง ADR-041 Consolidation (ลบ X-API-Key)

| Task ID | Component | Summary | Status |
| :--- | :--- | :--- | :--- |
| T016 | Sidecar | Remove `X-API-Key` validation from endpoints | Pending (ADR-041 cutover) |
| T017 | Backend | Remove `X-API-Key` send-side in `OcrService` | Pending (ADR-041 cutover) |
| T018 | Backend | Remove `X-API-Key` send-side in `SandboxOcrEngineService` | Pending (ADR-041 cutover) |

---

## 📋 Consequences

### Positive

* **OOM Safety Retained:** รักษา Adaptive OCR Residency + CPU Fallback Retrieval — ป้องกัน VRAM exhaustion
* **Spec-Consistent:** สอดคล้องกับ ADR-036, ADR-029/037, CONTEXT.md
* **Smaller Sidecar Surface:** Pure compute worker — ไม่มี business logic หรือ parameter governance
* **Security Hardened:** Path traversal fix, no hardcoded secrets
* **Performance:** Async I/O ลด blocking, shared AsyncClient ลด connection overhead

### Negative

* **Lose Defense-in-Depth Auth:** ลบ `X-API-Key` ทำให้ขึ้นอยู่กับ network isolation เท่านั้น — mitigated โดย ACL/bridge network
* **Cross-Host Firewall Rule Mandatory:** ใน topology ปัจจุบัน (ก่อน consolidation) ต้องมี VLAN/firewall ACL เป็น interim constraint
* **Migration Complexity:** Sequencing ของ auth removal ต้อง sync กับ ADR-041 cutover

---

## 🚫 Out of Scope (Future ADR)

* 1-page-1-request horizontal scaling rework (Qwen 2.7) — ต้องการ separate spec + load evidence
* OpenTelemetry/Prometheus/Grafana observability (Qwen 4.4–4.5) — separate ticket
* **/normalize endpoint** — ตัดออกจาก sidecar แล้ว (D2); ThaiPreprocessProcessor ไม่มีการใช้งาน

---

## 🔄 Rollback Plan

* Revert `app.py` ไปเวอร์ชันก่อน refactor
* Restore `X-API-Key` send-side ใน `OcrService` และ `SandboxOcrEngineService`
* Re-pin `keep_alive` default เป็น `0` ใน `process_ocr`
* Restore hardcoded runtime params (ถ้าต้องการ emergency fallback)

---

## 📝 Verification Plan

1. Confirm backend send-side `X-API-Key` locations:
   - `backend/src/modules/ai/services/ocr.service.ts`
   - `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts`
2. Confirm `calculate_ocr_residency` ไม่ถูกเรียกใช้ใน `app.py` (grep) ก่อน claim gap
3. ✅ ยืนยันแล้ว: ไม่มี consumer ใดใช้ `/normalize` endpoint (grep ไม่พบใน backend)
4. Pytest สำหรับ path-traversal (expect 403)
5. Unit test สำหรับ residency wiring
