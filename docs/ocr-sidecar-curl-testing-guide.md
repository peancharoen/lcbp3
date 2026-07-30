# File: docs/ocr-sidecar-curl-testing-guide.md
# Change Log:
# - 2026-07-23: Initial creation — curl testing guide for OCR sidecar endpoints
# - 2026-07-30: ADR-040 Phase 2 (T016) — ลบ X-API-Key auth (network isolation แทน)

# OCR Sidecar — Curl Testing Guide

คู่มือทดสอบ OCR Sidecar ด้วย command line (curl) สำหรับทดสอบ prompt, DMS tags, runtime parameters และดูผลแบบรวดเร็ว

## ข้อมูลการเชื่อมต่อ

| รายการ | ค่า |
|--------|-----|
| **URL** | `http://192.168.10.11:8765` |
| **Auth** | ไม่ต้อง (Docker-internal network isolation, ADR-040 Phase 2) |
| **Timeout** | 360 วินาที/request (cold-start ~70s + inference) |

## Endpoints

| Endpoint | Method | Auth | หน้าที่ |
|----------|--------|------|---------|
| `/health` | GET | ไม่ต้อง | เช็คสถานะ sidecar |
| `/ocr-upload` | POST | ไม่ต้อง | OCR จาก multipart file upload (แนะนำสำหรับทดสอบ) |
| `/ocr` | POST | ไม่ต้อง | OCR จาก path (ต้องมี shared volume mount) |
| `/embed` | POST | ไม่ต้อง | BGE-M3 embedding (Dense + Sparse) |
| `/rerank` | POST | ไม่ต้อง | BGE-Reranker-Large chunk re-ranker |

---

## 1. เช็คสถานะ Sidecar

ไม่ต้องมี API Key

```bash
curl http://192.168.10.11:8765/health
```

**ผลที่คาดหวัง:**

```json
{
  "status": "ok",
  "engine": "np-dms-ocr",
  "ocrModel": "np-dms-ocr:latest",
  "ollamaUrl": "http://host.docker.internal:11434"
}
```

---

## 2. ทดสอบ OCR พร้อม Custom System Prompt

ใช้ `engine=np-dms-ocr` เพื่อบังคับผ่าน OCR model (ข้าม fast-path)

```bash
curl -X POST http://192.168.10.11:8765/ocr-upload \
  -F "file=@/path/to/test.pdf" \
  -F "engine=np-dms-ocr" \
  -F "maxPages=1" \
  -F "systemPrompt=Extract all text in Thai and English. Output as structured Markdown with headers." \
  | python3 -m json.tool
```

### ตัวอย่าง System Prompt สำหรับ DMS

```
You are a DMS document analyzer. Extract key information from this document and format as structured Markdown.
Identify: document number, document date, sender organization, subject, and document type.
```

---

## 3. ทดสอบ OCR พร้อม Custom DMS Tags

กำหนด XML tags ที่ต้องการให้ model ครอบข้อมูล — ส่งเป็น JSON string

```bash
curl -X POST http://192.168.10.11:8765/ocr-upload \
  -F "file=@/path/to/test.pdf" \
  -F "engine=np-dms-ocr" \
  -F "maxPages=1" \
  -F 'dmsTags={"document_number":"","document_date":"","sender_name":"","subject":""}' \
  | python3 -m json.tool
```

**หลักการ:** Model จะครอบข้อมูลที่พบด้วย tag ที่กำหนด เช่น `<document_number>RFA-001</document_number>` ถ้าไม่พบจะ omit tag นั้น

---

## 4. ทดสอบ OCR พร้อมปรับ Runtime Parameters

```bash
curl -X POST http://192.168.10.11:8765/ocr-upload \
  -F "file=@/path/to/test.pdf" \
  -F "engine=np-dms-ocr" \
  -F "maxPages=1" \
  -F "temperature=0.1" \
  -F "topP=0.1" \
  -F "repeatPenalty=1.1" \
  -F "maxTokens=4096" \
  -F "systemPrompt=Extract document metadata and wrap in XML tags." \
  | python3 -m json.tool
```

---

## 5. ทดสอบ OCR แบบรวมทุกอย่าง (Prompt + Tags + Params)

```bash
curl -X POST http://192.168.10.11:8765/ocr-upload \
  -F "file=@/path/to/test.pdf" \
  -F "engine=np-dms-ocr" \
  -F "maxPages=3" \
  -F "temperature=0.1" \
  -F "topP=0.1" \
  -F "repeatPenalty=1.1" \
  -F "maxTokens=4096" \
  -F "systemPrompt=You are a DMS document analyzer. Extract key information and format as structured Markdown." \
  -F 'dmsTags={"document_number":"","document_date":"","received_date":"","sender_org":"","subject":""}' \
  -F 'runtimeParams={"temperature":0.1,"top_p":0.1}' \
  | python3 -m json.tool
```

---

## 6. ทดสอบ Embedding (BGE-M3)

```bash
curl -X POST http://192.168.10.11:8765/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "เอกสารขออนุมัติการก่อสร้าง"}' \
  | python3 -m json.tool
```

---

## 7. ทดสอบ Reranking (BGE-Reranker-Large)

```bash
curl -X POST http://192.168.10.11:8765/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "construction approval request",
    "chunks": [
      "RFA document for building construction",
      "Transmittal for shop drawings",
      "Invoice for materials"
    ]
  }' \
  | python3 -m json.tool
```

---

## พารามิเตอร์ทั้งหมดใน `/ocr-upload`

| พารามิเตอร์ | Type | ค่าเริ่มต้น | หน้าที่ |
|------------|------|-----------|---------|
| `file` | File (required) | — | ไฟล์ PDF ที่จะ OCR |
| `engine` | String | `auto` | `auto` (fast-path ถ้ามี text layer > 100 chars), `np-dms-ocr` (บังคับ OCR) |
| `maxPages` | Int | `0` (ทุกหน้า) | จำนวนหน้าสูงสุด |
| `systemPrompt` | String | — | Custom prompt สำหรับทดสอบ (max 10,000 ตัวอักษร) |
| `dmsTags` | JSON String | default tags | กำหนด XML tags ที่ต้องการให้ model ครอบข้อมูล |
| `temperature` | Float | Modelfile default | ความสุ่ม (0.1 = น้อย, 1.0 = มาก) |
| `topP` | Float | Modelfile default | Nucleus sampling |
| `repeatPenalty` | Float | Modelfile default | ลดการพูดซ้ำ |
| `maxTokens` | Int | Modelfile default | จำนวน token สูงสุดในผลลัพธ์ |
| `runtimeParams` | JSON String | — | ส่ง runtime parameters เป็น JSON object |

> **หมายเหตุ:** `keep_alive` ถูกจัดการโดย OCR residency policy อัตโนมัติ — ห้ามส่งเข้ามาเอง

---

## โครงสร้างผลลัพธ์ (OcrResponse)

```json
{
  "text": "# Document Title\n\nเลขที่เอกสาร: RFA-001\nวันที่: 2024-01-15\n\n<document_number>RFA-001</document_number>\n<document_date>2024-01-15</document_date>",
  "ocrUsed": true,
  "pageCount": 1,
  "charCount": 156,
  "engineUsed": "np-dms-ocr"
}
```

| Field | Type | ความหมาย |
|-------|------|---------|
| `text` | String | ข้อความที่สกัดได้ (Markdown) |
| `ocrUsed` | Boolean | `true` = ผ่าน OCR model, `false` = fast-path (text layer) |
| `pageCount` | Int | จำนวนหน้าที่ประมวลผล |
| `charCount` | Int | จำนวนตัวอักษรในผลลัพธ์ |
| `engineUsed` | String | engine ที่ใช้ (`np-dms-ocr`, `fast-path`) |

---

## เคล็ดลับการทดสอบ

### บังคับใช้ OCR Model (ข้าม fast-path)

หากใช้ `engine=auto` และ PDF มี text layer > 100 chars จะใช้ fast-path (ไม่ผ่าน OCR model) ซึ่งไม่ได้ใช้ prompt ที่ส่งไป

```bash
# ใช้ engine=np-dms-ocr เพื่อบังคับผ่าน model เสมอ
-F "engine=np-dms-ocr"
```

### ดูผลแบบสวยงาม

```bash
| python3 -m json.tool
```

### บันทึกผลลัพธ์เป็น .md (Bash)

```bash
# สกัดเฉพาะ field "text" จาก JSON แล้วบันทึกเป็น .md
curl -s -X POST http://192.168.10.11:8765/ocr-upload \
  -F "file=@/path/to/test.pdf" \
  -F "engine=np-dms-ocr" \
  -F "maxPages=1" \
  -F "systemPrompt=Extract all text as Markdown." \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['text'])" \
  > result.md
```

### บันทึกผลลัพธ์เป็น .md (PowerShell)

```powershell
# สกัดเฉพาะ field "text" จาก JSON แล้วบันทึกเป็น .md
$response = curl.exe -s -X POST "http://192.168.10.11:8765/ocr-upload" `
  -F "file=@E:/path/to/test.pdf" `
  -F "engine=np-dms-ocr" `
  -F "maxPages=1" `
  -F "systemPrompt=Extract all text as Markdown."

($response | ConvertFrom-Json).text | Out-File -Encoding utf8 "result.md"
```

### บันทึกทั้ง JSON และ .md (Bash)

```bash
# บันทึก JSON ฉบับเต็ม + สกัด text เป็น .md
curl -s -X POST http://192.168.10.11:8765/ocr-upload \
  -F "file=@/path/to/test.pdf" \
  -F "engine=np-dms-ocr" \
  -F "maxPages=1" \
  -F "systemPrompt=Extract all text as Markdown." \
  -o result.json \
  && python3 -c "import json; print(json.load(open('result.json'))['text'])" > result.md
```

### บันทึก JSON + สกัด .md + วัดเวลา (PowerShell)

```powershell
# วัดเวลา + บันทึก JSON ฉบับเต็ม + สกัด text เป็น .md
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$response = curl.exe -s -X POST "http://192.168.10.11:8765/ocr-upload" `
  -F "file=@E:/path/to/test.pdf" `
  -F "engine=np-dms-ocr" `
  -F "maxPages=1" `
  -F "systemPrompt=Extract all text as Markdown."

$sw.Stop()

# แปลง JSON
$json = $response | ConvertFrom-Json

# บันทึก JSON ฉบับเต็ม
$json | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 "result.json"

# สกัด text เป็น .md
$json.text | Out-File -Encoding utf8 "result.md"

# แสดงสรุป
Write-Host "Elapsed: $($sw.Elapsed.TotalSeconds)s"
Write-Host "Engine:  $($json.engineUsed)"
Write-Host "Pages:   $($json.pageCount)"
Write-Host "Chars:   $($json.charCount)"
Write-Host "Files:   result.json, result.md"
```

### วัดเวลาที่ใช้

```bash
time curl -X POST http://192.168.10.11:8765/ocr-upload \
  -F "file=@/path/to/test.pdf" \
  -F "engine=np-dms-ocr" \
  -F "maxPages=1" \
  | python3 -m json.tool
```

### ทดสอบหลายหน้า

```bash
-F "maxPages=3"   # ประมวลผล 3 หน้าแรก
-F "maxPages=0"   # ประมวลผลทุกหน้า (ค่าเริ่มต้น)
```

---

## การใช้งานบน Windows PowerShell

> **สำคัญ:** ใน PowerShell `curl` เป็น alias ของ `Invoke-WebRequest` ไม่ใช่ curl จริง ให้ใช้ `curl.exe` แทน และใช้ backtick `` ` `` สำหรับ line continuation (ไม่ใช่ `\`)

### ตัวอย่าง: OCR พร้อม prompt บน PowerShell

```powershell
curl.exe -X POST "http://192.168.10.11:8765/ocr-upload" `
  -F "file=@E:/path/to/test.pdf" `
  -F "engine=np-dms-ocr" `
  -F "maxPages=1" `
  -F "systemPrompt=Extract all text in Thai and English. Output as structured Markdown with headers."
```

### แบบบรรทัดเดียว

```powershell
curl.exe -X POST "http://192.168.10.11:8765/ocr-upload" -F "file=@E:/path/to/test.pdf" -F "engine=np-dms-ocr" -F "maxPages=1" -F "systemPrompt=Extract all text as Markdown."
```

### แบบ PowerShell native (Invoke-WebRequest)

```powershell
$form = @{
    file = Get-Item "E:\path\to\test.pdf"
    engine = "np-dms-ocr"
    maxPages = "1"
    systemPrompt = "Extract all text in Thai and English. Output as structured Markdown with headers."
}

$response = Invoke-WebRequest -Uri "http://192.168.10.11:8765/ocr-upload" -Method POST -Headers $headers -Form $form
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### ความแตกต่าง Bash vs PowerShell

| รายการ | Bash (Linux/Mac) | PowerShell (Windows) |
|--------|-------------------|----------------------|
| คำสั่ง | `curl` | `curl.exe` (ไม่ใช่ `curl`) |
| Line continuation | `\` | `` ` `` (backtick) |
| Path ไฟล์ | `@/path/to/file.pdf` | `@E:/path/to/file.pdf` หรือ `@E:\path\to\file.pdf` |
| JSON pretty print | `\| python3 -m json.tool` | `\| ConvertFrom-Json \| ConvertTo-Json -Depth 10` |

---

$sw = [System.Diagnostics.Stopwatch]::StartNew()

$response = curl.exe -s -X POST "http://192.168.10.11:8765/ocr-upload" `
  -F "file=@E:/OneDrive/Documents/00-test.pdf" `
  -F "engine=np-dms-ocr" `
  -F "maxPages=3" `
  -F "systemPrompt=You are an expert in structuring Thai documents.
Task: Extract the information from the image in the most correct and organized format.

Output Rules:
- Return ONLY clean Markdown output
- Include ALL information visible on the page
- Preserve document structure and hierarchy
- Do NOT add explanations or interpretations
- Do NOT include these instructions in your response

Formatting:
- Header: Use <header> Thai description </header> tags
- Footer:  Use <footer> Thai description </footer> tags
- Logo:  Use <logo> Description </logo> tags
- Math: $inline$ and $$block$$ LaTeX
- Figures: <figure>Thai description</figure>
- Pages: <page number>N</page number>
- Boxes: ☐ / ☑
- Unclear: [unclear: context]
- Signatures: Describe location and context  Use <sign> Thai description </sign> tags
- Stamps: Describe location and context Use <stamp> Thai description </stamp>tags

Extract all text from these images."

$sw.Stop()

$json = $response | ConvertFrom-Json
$json | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 "result.json"
$json.text | Out-File -Encoding utf8 "result.md"

Write-Host "Elapsed: $($sw.Elapsed.TotalSeconds)s"
Write-Host "Engine:  $($json.engineUsed)"
Write-Host "Pages:   $($json.pageCount)"
Write-Host "Chars:   $($json.charCount)"
Write-Host "Files:   result.json, result.md"

## การแก้ปัญหา

| ปัญหา | สาเหตุ | วิธีแก้ |
|-------|--------|--------|
| `403 Forbidden` | Path อยู่นอก upload base | ตรวจ `OCR_SIDECAR_UPLOAD_BASE` ใน `.env` |
| `403 Forbidden` | Path อยู่นอก whitelist | ใช้ `/ocr-upload` แทน `/ocr` (ไม่ต้องมี shared volume) |
| `422 Unprocessable Entity` | ไฟล์ PDF เสีย | ตรวจไฟล์ด้วย `file` command |
| `504 Gateway Timeout` | OCR ใช้เวลานานเกิน 360s | ลด `maxPages` หรือเพิ่ม `OCR_TIMEOUT` |
| ผลลัพธ์ว่าง | Model ไม่ generate | ตรวจ Ollama log และ VRAM |
| ผลลัพธ์เป็น fast-path | PDF มี text layer > 100 chars | ใช้ `engine=np-dms-ocr` เพื่อบังคับ OCR |

---

## อ้างอิง

- **Source code:** `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/app.py`
- **README:** `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/ocr-sidecar/README.md`
- **ADR-023A:** Unified AI Architecture (2-model stack)
- **ADR-040:** OCR Sidecar hardening phases
