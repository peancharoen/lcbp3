// File: specs/200-fullstacks/242-migration-ai-pipeline/contracts/migration-compare-prompt.md
// Change Log:
// - 2026-08-06: Initial I/O contract for the migration_compare prompt

# Prompt Contract: `migration_compare`

**Branch**: `242-migration-ai-pipeline` | **Date**: 2026-08-06
**Governed by**: ADR-029 (prompt templates live in `ai_prompts`, never hardcoded)
**Replaces**: `ocr_extraction` in the `migrate-document` job path only — `ocr_extraction` remains in use for the sandbox and production ingestion flows.

---

## 1. Purpose

Compare the Excel register row against the text read from the document file and report,
per field, whether they agree. The register is the source of truth — this prompt
**must not** propose replacement metadata (FR-009).

---

## 2. Storage

One row in `ai_prompts`:

| Column | Value |
| --- | --- |
| `prompt_type` | `migration_compare` |
| `version_number` | `1` |
| `is_active` | `1` |
| `template` | Section 4 |
| `field_schema` | Section 6 |
| `context_config` | `null` — no master-data context needed (see §3.1) |

Resolved via the existing `AiPromptsService.getActive('migration_compare')`, which is
Redis-cached at `ai:prompt:active:migration_compare` (TTL 60 s).

---

## 3. Input placeholders

| Placeholder | Type | Source |
| --- | --- | --- |
| `{{excel_metadata}}` | JSON object | `job.data.payload.excelMetadata`, pretty-printed |
| `{{ocr_text}}` | string | `ocrResult.text`, sanitised then truncated to `MAX_OCR_TEXT_CHARS` |
| `{{ocr_truncated}}` | `'true'` / `'false'` | Whether truncation occurred |

### 3.1 Why no `{{master_data_context}}`

`ocr_extraction` injects filtered master data so the model can *choose* an organisation
UUID or discipline code. This prompt makes no such choice — reference-data resolution
moved to the post-migration batch (FR-016). Omitting master data also shrinks the prompt,
offsetting the register JSON that replaces it.

### 3.2 `{{excel_metadata}}` shape

```json
{
  "documentNumber": "LCBP3-CSC-RFA-00123",
  "subject": "ขออนุมัติแบบก่อสร้างงานโครงสร้าง",
  "documentDate": "2019-03-14",
  "fromOrganization": "CSC",
  "toOrganization": "PAT",
  "correspondenceType": "RFA",
  "discipline": "STRUCT",
  "project": "LCBP3",
  "revision": "A"
}
```

Absent register columns are omitted. An omitted field must still appear in
`fieldResults` with `excelValue: null`.

---

## 4. Template

```text
คุณคือผู้ตรวจสอบความถูกต้องของทะเบียนเอกสาร หน้าที่ของคุณคือเปรียบเทียบข้อมูลในทะเบียนเอกสาร
กับข้อความที่อ่านได้จากไฟล์เอกสารจริง แล้วรายงานว่าแต่ละช่องตรงกันหรือไม่

ข้อกำหนดสำคัญ:
1. ทะเบียนเอกสารเป็นข้อมูลอ้างอิงหลัก — ห้ามเสนอค่าใหม่มาแทน
2. รายงานเฉพาะผลการเปรียบเทียบ ห้ามสกัดข้อมูลขึ้นมาใหม่จากเอกสาร
3. หากหาค่าของช่องใดในเอกสารไม่พบ ให้ตั้ง foundInDocument = false และ ocrValue = null
   โดยตั้ง match = false — ห้ามเดาค่า
4. ถ้า ocr_truncated = true หมายความว่าข้อความจากเอกสารไม่ครบทั้งฉบับ
   ช่องที่หาไม่พบอาจอยู่ในส่วนที่ถูกตัดออก ให้ตั้ง foundInDocument = false
   แทนการรายงานว่าไม่ตรงกัน
5. การเปรียบเทียบต้องยืดหยุ่นตามรูปแบบ:
   - วันที่: 14/03/2019, 14 มี.ค. 2562, และ 2019-03-14 ถือว่าตรงกัน (พ.ศ. = ค.ศ. + 543)
   - หน่วยงาน: ตัวย่อกับชื่อเต็มที่หมายถึงหน่วยงานเดียวกันถือว่าตรงกัน
   - เลขที่เอกสาร: ต่างกันแค่ตัวคั่นหรือช่องว่างถือว่าตรงกัน
   - หัวเรื่อง: ต่างกันแค่เครื่องหมายวรรคตอนหรือช่องว่างถือว่าตรงกัน
     แต่ถ้าเนื้อความต่างกันถือว่าไม่ตรงกัน
6. ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON

ข้อความที่ถูกตัดทอน: {{ocr_truncated}}

ข้อมูลจากทะเบียนเอกสาร:
{{excel_metadata}}

ข้อความที่อ่านได้จากไฟล์เอกสาร:
{{ocr_text}}

ตอบตามโครงสร้าง JSON นี้:
{
  "fieldResults": [
    {
      "field": "<ชื่อช่อง>",
      "excelValue": "<ค่าจากทะเบียน หรือ null>",
      "ocrValue": "<ค่าที่พบในเอกสาร หรือ null>",
      "match": <true|false>,
      "foundInDocument": <true|false>
    }
  ],
  "mismatches": ["<ชื่อช่องที่ไม่ตรงกัน>"],
  "confidence": <0.0-1.0>
}
```

### 4.1 Rule rationale

- **Rule 4** is the primary defence for SC-003 (false mismatches ≤ 10%). Without it, any
  field on a page beyond the truncation boundary is reported as a mismatch, and long
  scanned documents would flood the manual-review group.
- **Rule 5** exists because this corpus is Thai construction correspondence: Buddhist-era
  dates and organisation abbreviations are pervasive. Strict string equality would make
  nearly every record a mismatch.
- **Rule 3** forbids guessing so that `foundInDocument` stays trustworthy — the review UI
  uses it to decide whether to offer "use document value" at all (FR-011c).

---

## 5. Output contract

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fieldResults` | array | yes | One entry per field present in `{{excel_metadata}}` |
| `fieldResults[].field` | string | yes | Must be one of the nine compared fields |
| `fieldResults[].excelValue` | string \| null | yes | |
| `fieldResults[].ocrValue` | string \| null | yes | `null` when `foundInDocument = false` |
| `fieldResults[].match` | boolean | yes | `false` whenever `foundInDocument = false` |
| `fieldResults[].foundInDocument` | boolean | yes | Gates the UI option (FR-011c) |
| `mismatches` | string[] | yes | Must equal the field names where `match = false` |
| `confidence` | number | yes | `0.0`–`1.0` (FR-008) |

Compared fields: `documentNumber`, `subject`, `documentDate`, `fromOrganization`,
`toOrganization`, `correspondenceType`, `discipline`, `project`, `revision`.

---

## 6. `field_schema`

```json
{
  "type": "object",
  "required": ["fieldResults", "mismatches", "confidence"],
  "properties": {
    "fieldResults": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["field", "excelValue", "ocrValue", "match", "foundInDocument"],
        "properties": {
          "field": {
            "type": "string",
            "enum": [
              "documentNumber", "subject", "documentDate",
              "fromOrganization", "toOrganization", "correspondenceType",
              "discipline", "project", "revision"
            ]
          },
          "excelValue": { "type": ["string", "null"] },
          "ocrValue": { "type": ["string", "null"] },
          "match": { "type": "boolean" },
          "foundInDocument": { "type": "boolean" }
        }
      }
    },
    "mismatches": { "type": "array", "items": { "type": "string" } },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
  }
}
```

---

## 7. Parsing and validation

Parsed by a typed guard in
`backend/src/modules/ai/types/migration-compare-result.type.ts`, mirroring the existing
`parseMigrateDocumentMetadata` pattern.

Post-parse normalisation, applied in order:

1. **Fence stripping** — remove ` ```json ` / ` ``` ` wrappers (same as the current
   `cleanedResponse` handling).
2. **Field whitelist** — drop entries whose `field` is not in the enum.
3. **Invariant repair** — force `match = false` wherever `foundInDocument = false`.
4. **`mismatches` recomputation** — derive from `fieldResults` rather than trusting the
   model's list, so the two can never disagree.
5. **Confidence clamp** — clamp to `[0,1]`; default `0.5` when absent or non-numeric
   (matches existing behaviour at `ai-batch.processor.ts` line ~1247).

### 7.1 Failure handling

Any of the following makes the comparison unusable:

- OCR extraction threw
- Sanitised OCR text shorter than the minimum comparable length
- Ollama returned nothing or timed out
- Output is not valid JSON, or contains zero valid `fieldResults` after step 2

In every case the processor **must** enqueue the record with
`compareStatus = 'UNAVAILABLE'` plus a Thai `compareUnavailableReason`, using the register
values as-is (FR-012a, FR-012b). It **must not** write the record only to
`migration_errors` — that would silently drop the document from the migration.

The raw response is still written to `ai_audit_logs` for later inspection.

---

## 8. Worked example

**Input** — `{{ocr_truncated}} = false`, register as §3.2, document text shows the subject
with a revision suffix, a different month, and no revision label.

**Expected output**

```json
{
  "fieldResults": [
    { "field": "documentNumber", "excelValue": "LCBP3-CSC-RFA-00123", "ocrValue": "LCBP3-CSC-RFA-00123", "match": true, "foundInDocument": true },
    { "field": "subject", "excelValue": "ขออนุมัติแบบก่อสร้างงานโครงสร้าง", "ocrValue": "ขออนุมัติแบบก่อสร้างงานโครงสร้าง (แก้ไขครั้งที่ 2)", "match": false, "foundInDocument": true },
    { "field": "documentDate", "excelValue": "2019-03-14", "ocrValue": "14 เมษายน 2562", "match": false, "foundInDocument": true },
    { "field": "fromOrganization", "excelValue": "CSC", "ocrValue": "บริษัท ซีเอสซี จำกัด", "match": true, "foundInDocument": true },
    { "field": "toOrganization", "excelValue": "PAT", "ocrValue": "การท่าเรือแห่งประเทศไทย", "match": true, "foundInDocument": true },
    { "field": "correspondenceType", "excelValue": "RFA", "ocrValue": "RFA", "match": true, "foundInDocument": true },
    { "field": "discipline", "excelValue": "STRUCT", "ocrValue": "งานโครงสร้าง", "match": true, "foundInDocument": true },
    { "field": "project", "excelValue": "LCBP3", "ocrValue": "โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3", "match": true, "foundInDocument": true },
    { "field": "revision", "excelValue": "A", "ocrValue": null, "match": false, "foundInDocument": false }
  ],
  "mismatches": ["subject", "documentDate", "revision"],
  "confidence": 0.82
}
```

Note how Rule 5 keeps `fromOrganization`, `toOrganization`, `discipline`, and `project`
as matches despite abbreviation-vs-full-name differences, while `documentDate` is a
genuine mismatch (March vs. April, not merely a calendar-era difference). `revision` is
reported with `foundInDocument: false`, so the review UI offers only "use register value"
or "type a new value" for that field.

---

## 9. Calibration

Per the migration plan, thresholds and prompt wording are recalibrated after 100–500
documents using `ai_audit_logs`:

| Signal | Target | Action if missed |
| --- | --- | --- |
| Mismatch detection rate | ≥ 90% (SC-002) | Tighten Rule 5 tolerances |
| False mismatch rate | ≤ 10% (SC-003) | Loosen Rule 5; verify Rule 4 is firing |
| `UNAVAILABLE` rate | Monitor | Investigate OCR quality, not the prompt |

Recalibration creates `version_number = 2` and activates it — thresholds themselves move
independently via `system_settings` (FR-010a).
