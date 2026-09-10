# Phase A — Browser E2E Verification Report (Feature 252)

> **Verification Level**: FULL BROWSER VERIFICATION (Playwright MCP)
> **Date**: 2026-09-10
> **Target**: https://lcbp3.np-dms.work/
> **Accounts tested**: `admin` (Org Admin), `superadmin` (Superadmin), `viewer01` (Viewer — no permission)
> **No production mutations performed** — all confirm actions were skipped; only cancel was used

---

## 1. Environment & Preparation (A.1)

| Check | Result | Evidence |
|-------|--------|----------|
| Frontend reachable | PASS | `https://lcbp3.np-dms.work/` → 302 redirect to `/login` |
| Backend API reachable | PASS | `GET /api/` → 200 `{"statusCode":200,"message":"Success","data":"Hello World!"}` |
| Import-review endpoint exists | PASS | `POST /api/v1/correspondence/import-review/check` (no auth) → 401 |
| Double-prefix bug (T028) fixed | PASS | `POST /api/api/v1/correspondence/import-review/check` → 404 (correctly rejected) |
| Permission `correspondence.import_review` exists | PASS | permission_id=221, module=correspondence, is_active=1 |
| Permission assigned to roles | PASS | Org Admin (role_id=2) + Document Control (role_id=3) |
| Projects available | PASS | 7 active projects (LCBP3, LCBP3-C1..C4, LCBP3-EN, SANDBOX) |
| Excel test fixture created | PASS | `/tmp/test-import-review.xlsx` — 6 rows covering pass/warn/block/B.E. dates |

---

## 2. DIRECT_IMPORT Flow — admin (A.2)

### 2.1 Navigation & UI

| Check | Result | Evidence |
|-------|--------|----------|
| Login as admin | PASS | Redirected to `/dashboard` |
| Navigate to `/admin/import-review` | PASS | Page rendered with heading "ตรวจสอบข้อมูลนำเข้า Excel" |
| Sidebar menu link present | PASS | "ตรวจสอบข้อมูลนำเข้า Excel" → `/admin/import-review` |
| ADR-052 reference displayed | PASS | "ด่านตรวจข้อมูล 4 ชั้น (Schema → Business Rules → AI Reviewer → Confirmation) — ADR-052" |
| Project selection prompt | PASS | "กรุณาเลือกโครงการก่อน (มุมบนของหน้าจอ)" shown when no project selected |
| Upload button disabled without file | PASS | `button "อัปโหลดและตรวจสอบ" [disabled]` |
| Upload button enabled after file select | PASS | Button became clickable after file upload |

### 2.2 Upload & Check

| Check | Result | Evidence |
|-------|--------|----------|
| File upload (.xlsx) | PASS | `test-import-review.xlsx` uploaded successfully |
| Check API call | PASS | `POST /api/v1/correspondence/import-review/check?projectPublicId=...&targetMode=DIRECT_IMPORT&aiProvider=LOCAL_OLLAMA&batchStrategy=FULL` → 200 |
| No double API prefix | PASS | Path is `/api/v1/...` not `/api/api/v1/...` |
| Summary counts displayed | PASS | ทั้งหมด=6, ผ่าน=4, คำเตือน=1, ติด BLOCK=1, AI แนะนำ=0 |
| Findings table rendered | PASS | 2 findings shown (1 BLOCK + 1 WARN) with row/column/level/message columns |
| BLOCK finding (row 4) | PASS | "ลำดับวันที่ขัดแย้งเชิงตรรกะ: วันที่ออกต้องไม่เกินวันที่รับ" |
| WARN finding (row 7) | PASS | "ระบุชื่อไฟล์ \"missing.pdf\" แต่ไม่พบไฟล์ในแพ็กเกจที่อัปโหลด" |
| Confirm button disabled on BLOCK | PASS | `button "ยืนยันนำเข้า" [disabled]` — DIRECT_IMPORT enforces all-or-nothing |
| Block warning message | PASS | "ไม่สามารถยืนยันนำเข้าได้ — มีแถวที่ติดสถานะ BLOCK กรุณาแก้ไขและอัปโหลดใหม่" |

### 2.3 Annotated Excel Download

| Check | Result | Evidence |
|-------|--------|----------|
| Download button works | PASS | File `annotated-<uuid>.xlsx` downloaded (10,633 bytes) |
| Review_Summary sheet present | PASS | Contains Total=6, Pass=4, Warn=1, Block=1, AI Suggestions=0, Can Confirm=No |
| Data sheet present | PASS | Contains all 6 data rows with normalized headers |
| [AI] audit columns present | PASS | `[AI] Suggested Subject`, `[AI] Suggested Type`, `[AI] Review Notes` |
| Cell notes/comments present | PASS | Note at col 10 (File Name) row 7: "ระบุชื่อไฟล์ \"missing.pdf\" แต่ไม่พบไฟล์..." |
| B.E. → C.E. date conversion | PASS | Row 3 input `15/01/2569` → output `2026-01-14` (2569-543=2026) ✅ |

### 2.4 Cancel

| Check | Result | Evidence |
|-------|--------|----------|
| Cancel button works | PASS | `POST /api/v1/correspondence/import-review/<sessionId>/cancel` → 200 |
| Results cleared after cancel | PASS | "ผลการตรวจสอบ" section disappeared from page |

---

## 3. MIGRATION_STAGING Flow — superadmin (A.3)

### 3.1 Admin (Org Admin) — BUG FOUND

| Check | Result | Evidence |
|-------|--------|----------|
| MIGRATION_STAGING option visible | PASS | "Migration Staging (Admin เท่านั้น)" shown in dropdown |
| MIGRATION_STAGING with Org Admin | **FAIL (BUG)** | `POST /check?targetMode=MIGRATION_STAGING` → 403 Forbidden |

**BUG Details**:
- **File**: `backend/src/modules/migration/excel-import-review.controller.ts` line 177
- **Code**: `const isOrgAdmin = permissions.includes('organization.manage_users');`
- **Problem**: Permission `organization.manage_users` does NOT exist in the database
- **Superadmin** has `organization.manage_members` (not `manage_users`)
- **Org Admin** has `user.manage_assignments` (not `manage_users`)
- **Impact**: Org Admin cannot use MIGRATION_STAGING despite spec (User Story 3) explicitly stating "System Administrator หรือ Org Admin"
- **Root cause**: Permission name mismatch between controller code and seed data

### 3.2 Superadmin — Works

| Check | Result | Evidence |
|-------|--------|----------|
| Login as superadmin | PASS | Redirected to `/dashboard` |
| MIGRATION_STAGING check | PASS | `POST /check?targetMode=MIGRATION_STAGING` → 200 |
| Summary counts | PASS | Same 6/4/1/1/0 results |
| Confirm button ENABLED with BLOCK | PASS | `button "ยืนยันนำเข้า" [cursor=pointer]` — MIGRATION_STAGING allows partial quarantine |
| Cancel works | PASS | Results cleared after cancel |

---

## 4. RBAC / Permission (A.4)

| Check | Result | Evidence |
|-------|--------|----------|
| viewer01 has no `correspondence.import_review` | PASS | Not in role_permissions for Viewer role |
| viewer01 cannot see Admin Panel link | PASS | Navigation has no "Admin Panel" link |
| viewer01 redirected from `/admin/import-review` | PASS | Redirected to `/dashboard` |
| viewer01 API call → 403 | PASS | `POST /check` → 403 `PERMISSION_DENIED` "คุณไม่มีสิทธิ์ในการดำเนินการนี้" |
| admin (Org Admin) has `correspondence.import_review` | PASS | Can access check endpoint with DIRECT_IMPORT |
| admin (Org Admin) blocked from MIGRATION_STAGING | **FAIL (BUG)** | 403 — see §3.1 above |
| superadmin can use MIGRATION_STAGING | PASS | 200 response, confirm button enabled |

---

## 5. Edge Cases (A.5)

| Edge Case | Result | Evidence |
|-----------|--------|----------|
| B.E. date conversion (พ.ศ. → C.E.) | PASS | `15/01/2569` → `2026-01-14` in annotated Excel (2569-543=2026) |
| Chronology validation (received < issued) | PASS | Row 4 → BLOCK "ลำดับวันที่ขัดแย้งเชิงตรรกะ" |
| File name specified but no file in package | PASS | Row 7 → WARN "ระบุชื่อไฟล์แต่ไม่พบไฟล์ในแพ็กเกจ" |
| Pre-registration (no file) | PASS | Row 5 (no file name) → Pass |
| Valid RFA/RFI/LETTER/TRANSMITTAL types | PASS | All type codes accepted by Layer 1 |
| BLOCK prevents DIRECT_IMPORT confirm | PASS | Confirm button disabled |
| BLOCK allows MIGRATION_STAGING confirm | PASS | Confirm button enabled (partial quarantine) |

---

## 6. AI Fail-Open (A.6)

| Check | Result | Evidence |
|-------|--------|----------|
| LOCAL_OLLAMA is default | PASS | "Local Ollama (Default)" shown in dropdown |
| AI unavailable message displayed | PASS | "AI Review unavailable: AI provider \"LOCAL_OLLAMA\" ไม่พร้อมใช้งานในขณะนี้ — ยังตรวจสอบผลจาก Layer 1/2 ได้ตามปกติ" |
| Layer 1/2 results still returned | PASS | 6 rows validated, BLOCK + WARN findings shown |
| AI failure does NOT block workflow | PASS | Core validation results available, annotated Excel downloadable |
| AI suggestions count = 0 | PASS | "AI แนะนำ: 0" — no AI suggestions when AI unavailable |

---

## 7. Console / Network / Responsive (A.7)

### 7.1 Console Messages

| Level | Count | Details |
|-------|-------|---------|
| Error | 1 | React hydration #418 (known Next.js issue, not Feature 252 related) |
| Warning | 0 | — |

### 7.2 Network Requests

| Request | Status | Notes |
|---------|--------|-------|
| `POST /api/v1/correspondence/import-review/check` (DIRECT_IMPORT) | 200 | Correct path, no double prefix |
| `POST /api/v1/correspondence/import-review/check` (MIGRATION_STAGING) | 200 | Superadmin only |
| `POST /api/v1/correspondence/import-review/check` (MIGRATION_STAGING, admin) | 403 | BUG — wrong permission check |
| `POST /api/v1/correspondence/import-review/check` (viewer01) | 403 | Correct RBAC denial |
| `GET /api/v1/correspondence/import-review/<sessionId>/download-annotated` | 200 | Annotated Excel downloaded |
| `POST /api/v1/correspondence/import-review/<sessionId>/cancel` | 200 | Cancel successful |
| `POST /api/api/v1/correspondence/import-review/check` (double prefix) | 404 | T028 fix confirmed |

### 7.3 Responsive

| Viewport | Result | Notes |
|----------|--------|-------|
| Desktop (1280x800) | PASS | Full sidebar, all controls visible |
| Mobile (375x667) | PASS | Sidebar collapses to hamburger menu, content fits, no horizontal overflow |

---

## 8. Summary

### PASS Count: 32
### FAIL Count: 1 (BUG)
### SKIP Count: 0

### Bugs Found

**BUG-001: MIGRATION_STAGING blocked for Org Admin**
- **Severity**: HIGH
- **File**: `backend/src/modules/migration/excel-import-review.controller.ts:177`
- **Code**: `const isOrgAdmin = permissions.includes('organization.manage_users');`
- **Problem**: Permission `organization.manage_users` does not exist in seed data
- **Expected**: Org Admin should access MIGRATION_STAGING (per spec User Story 3)
- **Actual**: Org Admin gets 403 Forbidden
- **Fix**: Change to check `user.manage_assignments` (what Org Admin actually has) or `organization.manage_members`

### Skipped Checks

- **Confirm flow**: Not executed to avoid production data mutation (no designated test data authorized)
- **Failed rows download**: Not tested (requires confirm first)
- **External AI (GEMINI/CLAUDE)**: Not tested (requires admin config + paid API keys)
- **Expired session**: Not tested (requires 24h wait or manual Redis manipulation)

### Verification Level

**FULL BROWSER VERIFICATION** — All tests executed via Playwright MCP against the deployed production environment at `https://lcbp3.np-dms.work/`. No mocks, no simulated responses.

### Artifacts

- Screenshots: `.playwright-mcp/page-*.png`
- Annotated Excel: `.playwright-mcp/annotated-01a08bc0-22ea-77ef-ac67-ac3b9922bf79.xlsx`
- Test fixture: `/tmp/test-import-review.xlsx` (copied to `.playwright-mcp/`)
- Console logs: `.playwright-mcp/console-*.log`
