# Validation Report: Attachment Manual Re-OCR (ADR-055)

**Date**: 2026-09-19T17:10+07:00
**Status**: **PASS** (functional coverage 100%) — ค้างเฉพาะ real-app verification (T038) ที่ต้องใช้ deploy authorization และ ledger finalization (T040)

## Coverage Summary

| Metric | Count | Percentage |
|---|---|---|
| Requirements Covered (FR-001..031) | 31/31 | 100% |
| Acceptance Criteria Met | 14/14 scenarios | 100% (unit/integration level) |
| Edge Cases Handled | 11/11 | 100% |
| Tests Present | 31/31 FRs | 100% |
| Tasks Complete | 38/40 | 95% (T038, T040 pending) |
| TDD Evidence Recorded | backend yes / frontend GREEN-only | partial |

## Contract Compliance

| Item | Status | Notes |
|---|---|---|
| Ledger exists | Yes | `specs/200-fullstacks/257-attachment-manual-re-ocr/ledger.md` |
| Ledger STATUS | checkpoint-ready | ไม่ใช่ open/blocked — เหลือ T038/T040 ก่อน complete |
| Checkpoints complete | CP0–CP7 done | ครบทุก phase |
| TDD evidence links | Yes | RED/GREEN บันทึกใน ledger CP1–CP5; frontend GREEN-only (flagged CP6) |
| Protected boundaries crossed | No | ไม่มี push/deploy; AI boundary ผ่าน BullMQ เท่านั้น |

## Requirements Verification (FR-001..FR-031)

| FR | Impl | Test | Evidence |
|---|---|---|---|
| FR-001 manual-only + rag.admin.write | ✅ | ✅ | `attachment-re-ocr.controller.ts:78,135` `@RequirePermission('rag.admin.write')`; controller spec |
| FR-002 idempotency + throttle + AI-enabled + audit | ✅ | ✅ | `assertIdempotencyKey` (L53), `@Throttle`, `AiEnabledGuard`, `@Audit` ทั้ง trigger+confirm; T015 spec |
| FR-003 status = rag.manage | ✅ | ✅ | controller L100, L114 (preview ด้วย) |
| FR-004 single attachment | ✅ | ✅ | single `:publicId` param — no batch path exists |
| FR-005 start guards (422/410/409/stale-ok) | ✅ | ✅ | service L131-157 + `assertNoLiveJob` L351 + trigger mutex L162; T011/T033 specs |
| FR-006 AI-unavailable → 503 | ✅ | ✅ | `enqueueAttachmentReOcr` → `checkAiUnavailableLocks` (`ai-queue.service.ts:256`); T016 spec |
| FR-007 engine choice + validation | ✅ | ✅ | DTO `@IsIn(RE_OCR_ENGINE_TYPES)`; dialog default `np-dms-ocr` + desc; T015 invalid→400 |
| FR-008 no silent fallback | ✅ | ✅ | retry = new trigger with chosen engine (dialog L153-158); engine อยู่ใน job.data — processor ไม่เปลี่ยน; T014 spec |
| FR-009 dedicated sequential queue, no priority | ✅ | ✅ | `QUEUE_NP_DMS_OCR` concurrency 1; enqueue ไม่ส่ง priority (ตรงข้าม sandbox L355); T016 spec |
| FR-010 token+jobId+position+estimate | ✅ | ✅ | `ReOcrTriggerResult` L49-55; T011 spec |
| FR-011 VRAM gate เฉพาะ np-dms-ocr | ✅ | ✅ | processor L139 `engineType === 'np-dms-ocr'`; T014 spec |
| FR-012 bypass cache read + refresh cache | ✅ | ✅ | `forceRefresh ? null : cache.get` L109; `cache.set` L172 ยังทำ; T014 spec |
| FR-013 3 attempts + backoff + final-only failed | ✅ | ✅ | queue L130-131 `attempts:3 exp 5000`; `reportFailure` L336 กรอง final attempt; pointer `processing`+attempt; T004/T014 |
| FR-014 ocr_text ไม่เปลี่ยนก่อน confirm | ✅ | ✅ | trigger เขียนเฉพาะ Redis; T011 asserts ocr_text untouched |
| FR-015 pointer+payload แยก, TTL 72h | ✅ | ✅ | `reOcrPointerKey`/`reOcrPayloadKey` + `RE_OCR_TTL_SECONDS`; T011/T014 assert TTL |
| FR-016 status union + newText เฉพาะ completed | ✅ | ✅ | `ReOcrStatusResult` discriminated union L58-77; `getStatus` L230; T012 spec |
| FR-017 empty→failed / shrink warning / identical | ✅ | ✅ | `failReOcrEmpty` L302; shrink L268-270; identical frontend disable + backend `RE_OCR_IDENTICAL` 409 L308; T012/T014 |
| FR-018 starter name+time | ✅ | ✅ | pointer fields + status `base` L235-239; dialog `started_by` L72 |
| FR-019 confirm: valid token → tx replace + statuses | ✅ | ✅ | payload lookup→404; tx L317-331 (`ocr_text`, `PENDING`, `NULL`, `DONE`); deleted→404; T013 spec |
| FR-020 re-index หลัง commit เท่านั้น, ไม่ลบ vector เอง | ✅ | ✅ | `reingest` หลัง tx commit L337; T013 asserts `QUEUE_AI_VECTOR_DELETION` never called |
| FR-021 ลบ temp records หลัง confirm | ✅ | ✅ | `cleanupKeys` L391 (pointer เฉพาะ token เดียวกัน); repeat→404; T013 |
| FR-022 no rollback | ✅ | n/a | ไม่มี rollback path — re-OCR ใหม่คือวิธีเดียว (by design) |
| FR-023 enqueue fail → no dangling generation | ✅ | ✅ | catch L338-345 `reindexQueued:false` + log; health check ซ่อม; T013 spec |
| FR-024 failure paths → failed status | ✅ | ✅ | `reportFailure` ทั้ง VRAM-gate throw (L154) และ catch throw; T004 spec |
| FR-025 DONE = terminal, skip + warn | ✅ | ✅ | `claimForProcessing` conditional update `Not('DONE')` ai-batch L620; T003 spec |
| FR-026 row action + full-screen 3-phase dialog | ✅ | ✅ | `ReOcrButton` (permission+PDF gate) mounted `page.tsx:198`; `h-screen` Dialog; ReOcrDialog.test |
| FR-027 resume-by-click → phase ตาม status | ✅ | ✅ | `useReOcrStatus` fires on open; phase จาก `status.status`; ReOcrDialog.test 4 cases |
| FR-028 diff view: side-by-side + counts + PDF + search + placeholder | ✅ | ✅ | `ReOcrDiffView` — sync scroll L166, charCount, PdfReferencePane, per-pane Input+highlight, `no_current` placeholder; ReOcrDiffView.test |
| FR-029 AlertDialog permanent + old→new counts | ✅ | ✅ | dialog L188-206; test asserts gate |
| FR-030 close+toast+list refresh; no new progress UI, no cancel | ✅ | ✅ | `handleConfirm` L60-70; `useReOcrConfirm` invalidates rag-admin lists; ไม่มี cancel UI |
| FR-031 i18n ทุก string | ✅ | ✅ | `useRagAdminT`/`t()` ทุกจุด; `rag-admin-i18n.ts` th+en |

## Edge Cases (spec §Edge Cases) — 11/11 handled

| Edge | Handling |
|---|---|
| non-PDF | 422 `RE_OCR_UNSUPPORTED_FILE_TYPE` ก่อน queue |
| source file missing | 410 `RE_OCR_SOURCE_FILE_MISSING` |
| ingestion PROCESSING | 409 `RE_OCR_INGESTION_IN_PROGRESS` |
| confirm ซ้ำ/หมดอายุ/token ผิด | 404 (payload ไม่มี) / 409 `RE_OCR_SUPERSEDED` |
| attachment ถูกลบก่อน confirm | 404, tx affected=0 |
| multi-admin trigger | Redis mutex SET NX + in-flight guard + supersede check ใน processor |
| OCR cache 24h | `forceRefresh` ข้าม read, ยังเขียน cache ใหม่ |
| batch/model transition | 503 `AI_FEATURES_UNAVAILABLE` (checkAiUnavailableLocks) |
| AI disabled | `AiEnabledGuard` ที่ controller |
| reindex fail หลัง commit | `reindexQueued:false` + health check (ADR-056) ซ่อม |
| checksum missing / auto ไม่ gate VRAM | reingest path เดิมคำนวณ / gate เฉพาะ `np-dms-ocr` |

## Uncovered / Pending Items

| Item | Status | Notes |
|---|---|---|
| T038 real-app verification (quickstart drill) | **Pending** | ต้อง deploy authorization; รวม SC-002 (<5min active effort) + SC-003 (failed ≤1min) measurement |
| T040 ledger terminal status | **Pending** | finalize หลัง T038 + security audit |
| SC-002/003/004 live measurement | Pending | unit-tested แล้ว แต่ยังไม่วัดบนระบบจริง |
| Frontend TDD RED-first | Flagged | tests เขียนหลัง impl (CP6 บันทึกไว้แล้ว — ไม่ใช่ blocker ตาม evidence bar) |
| Independent `/112-speckit-security-audit` | Recommended | inline security check ผ่านแล้ว; แนะนำ audit อิสระก่อน merge |

## Success Criteria Assessment

| SC | Status | Evidence |
|---|---|---|
| SC-001 ocr_text byte-identical จน confirm | ✅ | T011 assert + service เขียนเฉพาะ Redis |
| SC-002 <5min active effort | ⏳ | ต้องวัดใน real-app (T038) |
| SC-003 failed ≤1min, no infinite waiting | ✅ design / ⏳ live | `reportFailure` เขียน failed ทันทีหลัง final attempt |
| SC-004 re-index จาก text ใหม่ | ✅ path / ⏳ live | reingest(force) → generation lifecycle เดิม |
| SC-005 late ingestion ไม่ทับ | ✅ | DONE-guard conditional update + T003 regression |
| SC-006 resume 1-click, 0 duplicate jobs | ✅ | mutex + in-flight guard + supersede; T033 |
| SC-007 audit attribution 100% | ✅ | `@Audit` + `triggeredByDisplayName` ใน pointer |
| SC-008 existing flows unchanged | ✅ | 3,201 backend tests pass, 0 failures |

## Recommendations

1. **T038**: ขอ deploy authorization → รัน `check-real-app` quickstart drill (วัด SC-002/003) → บันทึกผลใน ledger
2. **T040**: finalize ledger (`FINAL_STATUS: complete`) หลัง T038 + `/112-speckit-security-audit`
3. **ก่อน merge**: รัน `/112-speckit-security-audit` (inline check ผ่านแล้ว แต่ ADR-023 boundary + rate-limit ควรได้ audit อิสระ)
4. ไม่มี functional gap — implementation ครอบ FR-001..031 + edge cases ครบ
