<!-- File: specs/88-logs/session-2026-06-20-ocr-sidecar-refactor-adr.md -->
# Session — 2026-06-20 (OCR Sidecar Refactor & Server Consolidation ADRs)

## Summary

สร้าง ADR-040 (OCR Sidecar Refactor) และ ADR-041 (Server Consolidation) โดย reconcile 2 แผน refactor (Claude + Qwen) กับ canonical specs (AGENTS.md, CONTEXT.md, ADR-033/034/036) และอัปเดต CONTEXT.md flagged ambiguities

## ปัญหาที่พบ (Root Cause)

- แผน refactor ทั้งสอง (Claude + Qwen) มี conflicts กับ resolved policies:
  - ลบ `vram_monitor.py` / `residency_policy.py` → ละเมิด Adaptive OCR Residency + CPU Fallback Retrieval
  - Force BGE+Reranker GPU-resident → ละเมิด LLM-First GPU Ownership
  - Fixed `keep_alive` → ละเมิด ADR-036 Gap-2 (keep_alive เป็น lazy resource param)
- Cross-host trust gap: sidecar อยู่บน Desk-5439, backend อยู่บน QNAP → "Docker internal isolation" เป็นเท็จ

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ----- | ----------------- |
| `specs/06-Decision-Records/ADR-040-ocr-sidecar-refactor.md` | สร้าง ADR ใหม่สำหรับ OCR sidecar refactor — preserve GPU policies, async I/O, path hardening, network isolation (supersedes ADR-033 §7) |
| `specs/06-Decision-Records/ADR-041-server-consolidation.md` | สร้าง ADR ใหม่สำหรับ server consolidation — single Docker host, ASUSTOR as Primary NAS, QNAP as backup |
| `CONTEXT.md` | เพิ่ม 2 resolved ambiguities: OCR Sidecar X-API-Key (network isolation only), Cross-host trust gap (server consolidation) |

## กฎที่ Lock แล้ว

| ID | Decision | ADR |
| -- | -------- | --- |
| D21 | OCR Sidecar = Pure Compute Worker — orchestration/params อยู่ใน backend existing services | ADR-040 D1 |
| D22 | Wire `calculate_ocr_residency()` ใน `process_ocr` — keep_alive เป็น lazy resource param (ADR-036 Gap-2) | ADR-040 D3 |
| D23 | Retain vram_monitor + CPU-fallback for `/embed`,`/rerank` — ห้าม force GPU-resident | ADR-040 D4 |
| D24 | Remove X-API-Key — auth = network isolation (supersedes ADR-033 §7) | ADR-040 D5 |
| D25 | Server Consolidation — co-locate ทุก services บน single Docker host (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB) | ADR-041 D1 |
| D26 | ASUSTOR (192.168.10.9) = Primary NAS, QNAP = Backup server | ADR-041 D2 |
| D27 | Docker-internal network only for sidecar/Ollama — enables ADR-040 D5 network-only auth | ADR-041 D3 |

## Verification

- [ ] ADR-040 และ ADR-041 ถูก review และ approve
- [ ] Implementation tasks ใน ADR-040/041 ถูก execute
- [ ] Server consolidation cutover สำเร็จ
- [ ] X-API-Key removal สำเร็จหลัง consolidation cutover
