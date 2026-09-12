// File: specs/88-logs/session-2026-09-12-browser-verify-next-session-focus.md
// Change Log:
// - 2026-09-12: Initial creation — Browser verification of Next Session Focus B-items

# Session 2026-09-12 — Browser Verify Next Session Focus (B-items)

## Summary

Browser verification ของรายการ "B. Manual / Browser Verify บน production" จาก Next Session Focus ใน `memory/project-memory-override.md` ผ่าน Playwright MCP บน production `https://lcbp3.np-dms.work/`

## สถานะ Codebase ก่อนเริ่ม

- Branch: `main` (clean working tree, synced with origin 0/0)
- 🚩 พบ D271 recurrence: commit `6c7ebfa5` (runner migration, 10 files/299 insertions) เป็น dangling commit — แต่เนื้อหายังอยู่ใน main (via `b44db893` memory save commit ที่ push แล้ว)
- Feature 253 unified-doc-crud: 115/115 tasks ✅

## Verification Results

### ผ่าน (Full browser verification)

| ID | งาน | ผล |
|----|-----|-----|
| B3 | /admin/ai model catalog | ✅ PASS — 4 models (np-dms-ai, np-dms-ai-30b, np-dms-ocr, bge-m3-reranker) + Load buttons + AI Enabled + 0 console errors |
| B8 | Cold-start hint (ADR-051 D2) | ✅ PASS — trigger RAG query ตอนไม่มี model → hint "ระบบกำลังเตรียมโมเดล AI กรุณารอสักครู่ (อาจใช้เวลา 5-15 วินาที)" + progress 60% + UUIDv7 request ID; หลัง query np-dms-ai โหลดขึ้น VRAM 4086 MB (25%) |

### ผ่านบางส่วน (Partial browser verification)

| ID | งาน | ผล | ส่วนที่ขาด |
|----|-----|-----|------------|
| B4 | Migration UI | ✅ Legacy-only UI + Excel form (ADR-047) + Resume mode | WAITING badge/hard-delete/Execute Import/QueueJobDrawer BLOCKED (queue ว่าง 0 รายการ) |
| B6 | phpMyAdmin BooDark theme | ✅ Login page accessible, 0 real errors (Cloudflare CSP block = security ทำงาน) | BooDark theme ต้อง login (ไม่มี pma credentials) |
| B10 | T048 + T064 quickstart | ✅ T048 Step 1 (active ocr_extraction v3 + placeholders ครบ) + Step 8 (GET review-thresholds → minConfidence 0.6) + T064 (functional rename ทำแล้ว) | T048 Steps 2-7,9 BLOCKED (queue ว่าง/mutation); T064 เหลือ stale comments 29 รายการ |

### Blocked (ไม่สามารถ verify ได้)

| ID | งาน | เหตุผล |
|----|-----|--------|
| B1 | RAG vector E2E (hardDelete → Qdrant ล้าง) | blocked: `correspondences` = 0 rows |
| B2 | Re-Extract E2E + QC-0001/QC-0002 | blocked: ต้องสร้าง test data ก่อน |
| B5 | Re-extract endpoint จาก Legacy Review Queue UI | BLOCKED: queue ว่าง 0 รายการ |
| B7 | /admin/migration ด้วย Org Admin account | BLOCKED: ไม่มี Org Admin credentials (session นี้ login เป็น Superadmin "SA") |

## Evidence

- Screenshots: `.playwright-mcp/page-2026-09-12T05-*.png` (6 screenshots)
- Console: 0 errors บน LCBP3-DMS app (ทุกหน้า); 1 CSP block บน phpMyAdmin (legitimate)
- Network: API `/api/migration/review-thresholds` → 200, `minConfidence: 0.6`
- Request ID จาก RAG query: `01a0941c-2cb1-7588-aef8-1cc6a31cce50` (UUIDv7 ✅)

## Findings

1. **T064 stale "category" references** — grep พบ 29 รายการ "category" ใน `backend/src/modules/migration/`:
   - Functional rename `category`→`correspondenceType` ทำใน DTOs/types/tests แล้ว (commit-migration-review.dto.ts, ai-extraction-details.type.ts, import-correspondence.dto.ts)
   - ที่เหลือ = stale comments ใน `migration.service.ts` (อ้าง `metadata.confidence.category` ที่ควรเป็น `correspondenceType`) + legitimate Excel column mapping (`categoryCol`, `'category'` column จาก legacy Excel) + audit log (`category: 'migration'` — context ต่างกัน)
   - T064 คาด 0 matches แต่จริงๆ มี legitimate uses อยู่ → task expectation อาจต้อง revise

2. **D271 recurrence** — commit `6c7ebfa5` (runner migration) เป็น dangling commit (หายจาก branch history) แต่เนื้อหายังอยู่ใน main ผ่าน `b44db893` (memory save commit ที่ push แล้ว) — งานไม่หาย แต่ปะปนใน `[skip CI]` commit

3. **Quickstart.md ล้าหลัง** — Step 1 อ้าง `{{allowed_categories}}` แต่จริงๆ template v3 ใช้ `{{allowed_correspondence_types}}` (Feature 251 rename) — quickstart.md ควรอัปเดต

## Next Steps

- B1/B2/B5: สร้าง test correspondences ในระบบก่อน (blocked ที่เดียวกัน)
- B7: ขอ Org Admin credentials จาก user
- B6: ขอ phpMyAdmin credentials เพื่อ verify BooDark theme
- T064: แก้ stale comments ใน `migration.service.ts` (อัปเดต `metadata.confidence.category`→`metadata.confidence.correspondenceType`)
- Quickstart.md: อัปเดต `{{allowed_categories}}`→`{{allowed_correspondence_types}}`
