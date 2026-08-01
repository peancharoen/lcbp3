# Code Review Report — OCR Sidecar Refactor (140-ocr-sidecar-refactor)

**Date:** 2026-08-01
**Reviewer:** speckit-reviewer (re-review — original report lost)
**Scope:** `app.py` (sidecar), `sandbox-ocr-engine.service.ts`, `ocr.service.ts`, contract/spec docs
**Overall:** APPROVE WITH MINOR CHANGES

## Summary

| Severity       | Count |
| -------------- | ----- |
| 🔴 Critical    | 0     |
| 🟠 High        | 2     |
| 🟡 Medium      | 4     |
| 🟢 Low         | 2     |
| 💡 Suggestion  | 1     |
| **Total**      | **9** |

> **Note:** Original review (2026-06-20) reported 7 High + 6 Medium + 3 Low + 2 Suggestions.
> ส่วนใหญ่ถูกแก้ไขแล้วใน sessions ถัดมา (X-API-Key removal, typhoon→np-dms rename,
> Tesseract cleanup, keep_alive removal). Re-review ครั้งนี้พบ findings ที่เหลือจริง 9 ข้อ.

## Findings

### 🟠 HIGH #1 — Inconsistent Null Handling Pattern

**File:** `sandbox-ocr-engine.service.ts:111-114`, `ocr.service.ts:429-432`

```typescript
const runtimeParams = {
  temperature: profile ? Number(profile.temperature) : 0.1,   // ternary
  top_p: profile ? Number(profile.topP) : 0.5,                 // ternary
  repeat_penalty: profile ? Number(profile.repeatPenalty) : 1.0, // ternary
  max_tokens: profile?.maxTokens ?? 16000,                     // nullish coalescing
};
```

**Issue:** ผสม ternary กับ nullish coalescing ใน object เดียวกัน — อ่าน/ดูแลยาก
**Fix:** ใช้ pattern เดียวกันทั้ง object

### 🟠 HIGH #2 — Missing NaN Guard for Number() Conversions

**File:** `sandbox-ocr-engine.service.ts:111-113`, `ocr.service.ts:429-431`

```typescript
temperature: profile ? Number(profile.temperature) : 0.1,
```

**Issue:** ถ้า `profile.temperature` เป็น string ที่ไม่ใช่ตัวเลข `Number()` จะคืน `NaN` → ส่งไป sidecar → Ollama API call ล้มเหลว
**Fix:** เพิ่ม NaN guard: `Number(profile.temperature) || 0.1`

### 🟡 MEDIUM #3 — Health Endpoint Response Format Mismatch

**File:** `app.py:185-192` vs `quickstart.md:104-110`

**Issue:** Implementation คืน `{"status": "ok", ...}` แต่ docs คาดหวัง `{"status": "healthy", "timestamp": ..., "version": ...}`
**Fix:** อัปเดต docs ให้ตรง implementation (แก้ docs ไม่ใช่ code — code ใช้จริงใน production แล้ว)

### 🟡 MEDIUM #4 — data-model.md Field Name Mismatches

**File:** `data-model.md:236-242`

**Issue:** `OcrResponse` ใน docs แสดง `model_used`, `processing_time_ms`, `error` แต่ implementation ใช้ `pageCount`, `charCount`, `engineUsed`
**Fix:** อัปเดต data-model.md ให้ตรง implementation

### 🟡 MEDIUM #5 — data-model.md pageRange vs maxPages

**File:** `data-model.md:29-33`

**Issue:** docs แสดง `pageRange: {start, end}` แต่ API จริงใช้ `maxPages: number`
**Fix:** อัปเดต data-model.md

### 🟡 MEDIUM #6 — quickstart.md Env Var Name Inconsistencies

**File:** `quickstart.md:147`

**Issue:** ยังใช้ `TYPHOON_OCR_MODEL` แทน `OCR_MODEL` (เก่า — rename แล้ว)
**Fix:** อัปเดต quickstart.md

### 🟢 LOW #7 — Test Stub Remnant: pythainlp

**File:** `test_path_traversal.py:36-43`

**Issue:** stubs สำหรับ `pythainlp` ยังอยู่ ทั้งที่ `pythainlp` ถูกลบจาก requirements.txt ใน Phase 8
**Fix:** ลบ stubs ออก

### 🟢 LOW #8 — README.md Python Version Mismatch

**File:** `README.md:107`

**Issue:** docs บอก `python:3.10-slim` แต่ Dockerfile ใช้ `python:3.11-slim`
**Fix:** อัปเดต README.md

### 💡 SUGGESTION #9 — quickstart.md API Field Naming

**File:** `quickstart.md:227, 245`

**Issue:** examples ใช้ `pdf_path` (snake_case) แต่ API จริงใช้ `pdfPath` (camelCase)
**Fix:** อัปเดต examples

## What's Good

- ✅ Path traversal protection (`abspath` + `realpath` + whitelist)
- ✅ Async I/O via `httpx.AsyncClient` + lifespan context manager
- ✅ Error handling per ADR-007 (HTTPException + user-friendly messages)
- ✅ No `any` types, no `console.log` in backend
- ✅ No `parseInt` on UUID
- ✅ Parameter governance from `ai_execution_profiles` (ADR-036)
- ✅ Active Prompt integration (ADR-029)
- ✅ X-API-Key removal complete (ADR-040 Phase 2)
- ✅ 41 tests covering all user stories

## Recommended Actions

**P1 — Fix before next deploy:**
1. HIGH #2: NaN guard for Number() conversions
2. HIGH #1: Standardize null handling pattern

**P2 — Fix in next sprint:**
3. MEDIUM #3-#6: Documentation updates (data-model.md, quickstart.md)

**P3 — Fix when convenient:**
4. LOW #7-#8, SUGGESTION #9: Test stub cleanup, README/quickstart polish
