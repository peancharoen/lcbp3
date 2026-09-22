# Session — 2026-09-22 (Migration Contract Linkage + Backfill + UX Fixes + CI Fix)

## Summary

Session นี้แก้ bug class หลายกลุ่ม: (1) `/admin/migration` เลือก Contract Code แต่ correspondence ไม่มี contract linkage, (2) backfill discipline ข้อมูลเก่า 500 รายการ, (3) Referenced Documents search ใช้งานไม่ได้, (4) `/correspondences` UX 4 จุด + `/transmittals` load fail, (5) RAG Console filename filter + column width, (6) CI test failures 2 สาเหตุ (perf spec DI + exceljs stream race)

## ปัญหาที่พบ (Root Cause)

### 1. contractCode หลุด 4 ชั้น (migration → correspondence ไม่มี contract)

- `startIngestion()` รับ `contractCode` แต่ไม่ destructure/ใช้ — ทิ้งทันที
- `correspondences` **ไม่มี `contract_id` column** — contract มาจาก `discipline_id → disciplines.contract_id` เท่านั้น
- `ColumnMapping` ไม่มี `disciplineCol` (header detector รองรับ `'discipline'` อยู่แล้ว) — Excel discipline column ไม่ถูกอ่าน
- `CommitMigrationReviewDto` ไม่มี `disciplineId` + `commitRecord` ไม่เคย set `correspondence.disciplineId`
- Frontend review page มี dropdown แต่ `commitPayload` ไม่ส่ง `disciplineId`
- `disciplines` unique เฉพาะ `(contract_id, discipline_code)` — `GEN`/`AQV`/`BIM` ซ้ำข้าม C1/C2 → resolve โดยไม่ scope contract = ambiguous
- DB ยืนยัน: 510/512 correspondences `discipline_id = NULL`

### 2. Referenced Documents search ใช้งานไม่ได้ (2 bugs ซ้อน)

- Component อ่าน `item.correspondence.uuid` แต่ entity serialize เป็น `publicId` (ADR-019) → filter ทิ้งทุกผลลัพธ์
- `getReferences` ไม่ unwrap envelope `{statusCode,message,data}` → `referencesData.outgoing` = undefined เสมอ

### 3. `/transmittals` "Failed to load transmittals"

- Frontend ส่ง `projectId=<uuid>` แต่ `SearchTransmittalDto` มีแค่ `projectUuid` → `forbidNonWhitelisted: true` → **400 ทุก request**

### 4. Rev column กว้าง (root cause ที่แท้)

- `DataTable` (shared) ไม่เคย apply `columnDef.size` เป็น width — TanStack auto-layout ไม่ใช้ size เอง → fix รอบก่อนที่ลดแค่ header `min-w` ไม่ได้ผล

### 5. CI failures (2 สาเหตุต่างกัน)

- **Deterministic (regression):** `tests/performance/migration-streaming.perf-spec.ts` instantiate `LegacyIngestionService` เองแต่ขาด `ContractRepository` provider (หลุดตอนเพิ่ม dependency ใน contract fix)
- **Flaky (library race):** exceljs `iterate-stream.js` + unzipper `Parse` — unzipper emit `'end'` ตอน **writable side** จบ เร็วกว่า entries ที่ push เข้า readable buffer จะ emit `'data'` (consumer pause ระหว่าง process worksheet) → `xl/workbook.xml` (entry สุดท้ายของ zip) หลุด → `this.model` undefined → `this.model.sheets` TypeError ที่ `workbook-reader.js:303` ใน deferred worksheet replay path (line 147)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | ------------- |
| `backend/src/modules/migration/services/legacy-ingestion.service.ts` | resolve contractCode→Contract (scope projectId, 404 ถ้าไม่พบ), `disciplineCol` ใน ColumnMapping, resolve disciplineId ภายใน contract เท่านั้น, เก็บ contractId/contractCode/disciplineCode/disciplineId ลง details |
| `backend/src/modules/migration/migration.service.ts` | commitRecord: resolve ลำดับ dto.disciplineId → details.disciplineId → details.disciplineCode (ภายใน contract), reject ValidationException ถ้า cross-contract, set `correspondence.disciplineId` ทั้ง create/update; เพิ่ม keys ใน REEXTRACT_PRESERVED + ALLOWED_ENQUEUE whitelists |
| `backend/src/modules/migration/migration.module.ts` | ลงทะเบียน Contract entity |
| `backend/src/modules/migration/dto/...` | `CommitMigrationReviewDto` + `disciplineId` |
| `frontend/app/(admin)/admin/migration/review/...` | ส่ง `disciplineId` ใน commitPayload + filter dropdown ด้วย `details.contractId` |
| `frontend/components/correspondences/reference-selector.tsx` | `.uuid`→`.publicId` ทุกจุด, unwrap `referencesData.data`, `enabled` option ตัด dead query |
| `frontend/app/.../transmittals/page.tsx` + DTO types | `projectId` → `projectUuid` |
| `frontend/components/correspondences/{list,detail}.tsx`, `correspondences-content.tsx` | `router.back()` กลับหน้าเดิม, `limit` URL param + rows-per-page select 10/20/50/100, Rev `size:70`+compact header, Created→Issued Date (`documentDate` fallback `issuedDate`) |
| `backend correspondence.service.ts` + DTO | `documentDate` filter + sort |
| `backend/src/modules/ai/{dto/rag-admin.dto.ts,services/rag-admin.service.ts}` | `filename` query param + LIKE filter บน `a.originalFilename` |
| `frontend/app/(admin)/admin/ai/rag-console/page.tsx` + service + i18n | filename search input (debounce 300ms เพราะ polling 10s) |
| `frontend/components/common/data-table.tsx` | apply `columnDef.size` เป็น width บน TableHead/TableCell |
| `backend/tests/performance/migration-streaming.perf-spec.ts` | +ContractRepository mock/provider |
| `patches/exceljs@4.4.0.patch` (ใหม่) + `pnpm-workspace.yaml` | patch `iterate-stream.js` — loop ต่อจน `stream.readableLength===0` + รอ 1 tick หลัง `end` ให้ buffered 'data' flush |

## Backfill (production data)

- Scope: migration queue-linked rows เท่านั้น (join `imported_correspondence_public_id`) — 500 rows จาก BATCH-1789785595266 (256) + BATCH-C2-2567-005 (244)
- `discipline_id=64` (GEN ใต้ LCBP3-C2, contract_id=4, project_id=3 — ตรงกับ project ของ rows)
- Pre-update snapshot: `backfill-audit/discipline-backfill-2026-09-22-pre-snapshot.json`
- เหลือ NULL 10 รายการ = E2E test batch (5) + manual/test records (5) — ข้ามตาม scope ที่ user เลือก; rows ที่มี discipline เดิม (PPM, MTT) ไม่ถูกแตะ

## กฎที่ Lock แล้ว

- **D353** — Legacy discipline backfill scope/audit recipe
- **D354** — Correspondence↔Contract = via `discipline_id` เท่านั้น; resolve `discipline_code` ต้อง scope ด้วย contract เสมอ; commit reject cross-contract
- **D355** — Frontend อ่าน entity ด้วย `publicId` (ไม่ใช่ `uuid`); envelope `{statusCode,message,data}` ต้อง unwrap `.data`; query params ต้องตรง DTO whitelist (forbidNonWhitelisted → 400)
- **D356** — DataTable width: `columnDef.size` ต้อง apply เป็น width บน header+cell เอง
- **D357** — exceljs@4.4.0 pnpm patch (iterate-stream drain race) — unzipper 'end' เป็น custom event ตอน writable finish, เร็วกว่า readable drain

## Commits

| Commit | เนื้อหา | Push |
| ------ | ------- | ---- |
| `87c8974a` | migration contract fix + referenced-documents fix + backfill snapshot (D353) | ✅ origin/main |
| `b910fc91` | transmittal projectUuid + correspondences UX 4 จุด | ✅ origin/main |
| `32529617` | rag-console filename search + DataTable columnDef.size | ✅ origin/main |
| `587bd0f7` | perf spec ContractRepository mock + exceljs patch | ✅ origin/main |

## Verification

- Migration suite 715/715 (+9 tests: contract resolve/404/details/commit discipline/mismatch/notfound)
- Frontend migration 46/46; transmittal 15/15; correspondence 90/90; rag-console 19/19
- Full backend suite: **214 suites / 3256 tests — 0 fail**
- Pending: post-deploy browser verify (migration contract selection, referenced docs search, correspondences back-state/page-size/Rev width/Issued Date, transmittals list, rag-console filename search)

## Pending Items

- [ ] Post-deploy verify: ทุก fix ข้างบนบน UI จริง
- [ ] 10 NULL-discipline records (test/manual) — รอ user สั่ง mapping ถ้าต้องการ
- [ ] เฝ้าดู CI runs ถัดไป — exceljs patch ควรหาย flaky ถ้ายังเจอ 'sheets' error อีก = race ยังไม่หมด
