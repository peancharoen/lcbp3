# Feature Specification: OCR Sandbox Two-Step Flow (OCR-First → AI-Second)

**Feature Branch**: `main`
**Created**: 2026-05-30
**Status**: Draft
**Input**: User requirement: แยก OCR Sandbox เป็น 2 step — Step 1 OCR เท่านั้นเพื่อตรวจคุณภาพ OCR ก่อน → Step 2 AI Extraction เพื่อทดสอบ prompt

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OCR Quality Check Before AI Testing (Priority: P1)

ในฐานะ **ผู้ดูแลระบบ (Superadmin)**
ข้าพเจ้าต้องการรัน OCR บน PDF เพื่อตรวจสอบคุณภาพข้อความที่สกัดได้ก่อน
เพื่อยืนยันว่า OCR ทำงานถูกต้องและข้อความสมบูรณ์
ก่อนที่จะใช้ข้อความนั้นทดสอบ AI prompt template

**Why this priority**:
การแยก step ช่วยให้ admin แยกปัญหาได้ชัดเจน — ถ้า OCR แย่/ไม่สมบูรณ์ ไม่ต้องเสียเวลาทดสอบ prompt ให้เสียทรัพยากร AI

**Independent Test**:
upload PDF → กด "Step 1: Run OCR" → เห็น OCR Raw Text → ตรวจคุณภาพ → ถ้าพอใจ → กด "Step 2: Run AI Extraction" → เห็น LLM Result

**Acceptance Scenarios**:

1. **Given** admin upload PDF ใน OCR Sandbox, **When** กด "Step 1: Run OCR", **Then** ระบบรัน OCR (PaddleOCR/Fast Path) และแสดง OCR Raw Text เท่านั้น ยังไม่เรียก LLM
2. **Given** OCR Raw Text ปรากฏแล้ว, **When** admin ตรวจและพอใจกับคุณภาพ, **Then** admin สามารถกด "Step 2: Run AI Extraction" เพื่อส่ง OCR text ไป LLM ต่อ
3. **Given** OCR Raw Text แย่/ไม่สมบูรณ์, **When** admin ไม่พอใจ, **Then** admin สามารถ upload PDF ใหม่และรัน OCR ใหม่โดยไม่เสียทรัพยากร AI
4. **Given** admin อยู่ใน Step 2, **When** admin เปลี่ยนใจต้องการแก้ prompt version, **Then** admin สามารถเลือก prompt version อื่นจาก dropdown และรัน AI Extraction ใหม่ด้วย OCR text เดิม

---

### User Story 2 - Prompt Version Testing with Same OCR Text (Priority: P2)

ในฐานะ **ผู้ดูแลระบบ (Superadmin)**
ข้าพเจ้าต้องการทดสอบ prompt version หลาย version ด้วย OCR text เดียวกัน
เพื่อเปรียบเทียบคุณภาพของ prompt versions ที่ต่างกัน

**Why this priority**:
ช่วยให้ admin evaluate prompt versions ได้รวดเร็วโดยไม่ต้องรัน OCR ซ้ำหลายครั้ง

**Independent Test**:
run OCR ครั้งเดียว → เลือก prompt v1 → run AI → เลือก prompt v2 → run AI → เปรียบเทียบผลลัพธ์

**Acceptance Scenarios**:

1. **Given** OCR Raw Text ถูกสกัดแล้ว, **When** admin เลือก prompt version v1 และกด "Run AI Extraction", **Then** ระบบใช้ prompt v1 กับ OCR text เดิม
2. **Given** ผลลัพธ์จาก v1 ปรากฏ, **When** admin เลือก prompt version v2 และกด "Run AI Extraction" อีกครั้ง, **Then** ระบบใช้ prompt v2 กับ OCR text เดิม (ไม่รัน OCR ซ้ำ)
3. **Given** admin อยากเปลี่ยน OCR text, **When** admin upload PDF ใหม่และกด "Step 1: Run OCR", **Then** OCR text ใหม่แทนที่เดิมและ step 2 ถูก reset

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบ MUST มี job type ใหม่ `sandbox-ocr-only` ที่ทำ OCR เท่านั้น ไม่เรียก LLM
- **FR-002**: ระบบ MUST มี job type ใหม่ `sandbox-ai-extract` ที่รับ OCR text + prompt version แล้ว run LLM
- **FR-003**: ระบบ MUST เก็บ OCR text ใน Redis (TTL 3600s) หลังจาก Step 1 เสร็จ เพื่อใช้ใน Step 2
- **FR-004**: Frontend MUST แสดง UI แบบ 2 step แยกกัน — Step 1: OCR, Step 2: AI Extraction
- **FR-005**: Step 2 MUST มี dropdown เลือก prompt version (default = active version)
- **FR-006**: ระบบ MUST อนุญาตให้รัน Step 2 ซ้ำด้วย prompt version ต่างกันโดยใช้ OCR text เดิม
- **FR-007**: ระบบ MUST invalidate OCR text cache เมื่อ admin upload PDF ใหม่และรัน Step 1 ใหม่

### Key Entities

- **OCR Cache**: Redis key `ai:sandbox:ocr:{requestPublicId}` TTL 3600s — เก็บ OCR text และ metadata (ocrUsed, timestamp)
- **Sandbox OCR Job**: BullMQ job type `sandbox-ocr-only` — รัน OCR เท่านั้น
- **Sandbox AI Job**: BullMQ job type `sandbox-ai-extract` — รัน LLM ด้วย OCR text + prompt version

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Step 1 (OCR) ใช้เวลา < 10 วินาทีสำหรับ PDF ทั่วไป
- **SC-002**: Step 2 (AI) ใช้เวลา < 120 วินาที (เหมือน sandbox-extract เดิม)
- **SC-003**: Admin สามารถทดสอบ prompt version 3 version ด้วย OCR text เดิมภายใน 5 นาที
- **SC-004**: OCR text cache ถูก invalidate อัตโนมัติเมื่อ upload PDF ใหม่

---

## API Design

### POST /ai/admin/sandbox/ocr (Step 1)

**Request:**
- `file`: PDF (multipart/form-data)

**Response:**
```json
{
  "requestPublicId": "uuid",
  "jobId": "uuid",
  "status": "queued"
}
```

**Behavior:**
- Upload PDF → storage temp
- Enqueue job `sandbox-ocr-only`
- Return requestPublicId สำหรับ polling

### POST /ai/admin/sandbox/ai-extract (Step 2)

**Request:**
```json
{
  "requestPublicId": "uuid",
  "promptVersion": 2  // optional, default = active
}
```

**Response:**
```json
{
  "requestPublicId": "uuid",
  "jobId": "uuid",
  "status": "queued"
}
```

**Behavior:**
- ดึง OCR text จาก Redis cache (`ai:sandbox:ocr:{requestPublicId}`)
- ถ้าไม่มี → throw 404 "OCR text not found or expired, please run Step 1 first"
- ดึง prompt version (default = active)
- Enqueue job `sandbox-ai-extract`
- Return requestPublicId สำหรับ polling

---

## Backend Implementation

### New Job Types

```typescript
export type AiBatchJobType =
  | 'ocr'
  | 'extract-metadata'
  | 'embed-document'
  | 'sandbox-rag'
  | 'sandbox-extract'      // legacy (OCR + AI in one job)
  | 'sandbox-ocr-only'     // NEW: Step 1 - OCR only
  | 'sandbox-ai-extract'   // NEW: Step 2 - AI extraction with cached OCR
  | 'migrate-document';
```

### processSandboxOcrOnly()

```typescript
private async processSandboxOcrOnly(data: AiBatchJobData): Promise<void> {
  const { idempotencyKey, payload } = data;
  const pdfPath = payload.pdfPath as string;

  const ocrResult = await this.ocrService.detectAndExtract({ pdfPath });

  // Cache OCR text for Step 2
  await this.redis.setex(
    `ai:sandbox:ocr:${idempotencyKey}`,
    3600,
    JSON.stringify({
      ocrText: ocrResult.text,
      ocrUsed: ocrResult.ocrUsed,
      timestamp: new Date().toISOString(),
    })
  );

  await this.redis.setex(
    `ai:rag:result:${idempotencyKey}`,
    3600,
    JSON.stringify({
      requestPublicId: idempotencyKey,
      status: 'completed',
      ocrText: ocrResult.text,
      ocrUsed: ocrResult.ocrUsed,
      completedAt: new Date().toISOString(),
    })
  );
}
```

### processSandboxAiExtract()

```typescript
private async processSandboxAiExtract(data: AiBatchJobData): Promise<void> {
  const { idempotencyKey, payload, projectPublicId } = data;
  const promptVersion = (payload.promptVersion as number) || undefined;

  // ดึง OCR text จาก cache
  const cachedOcr = await this.redis.get(`ai:sandbox:ocr:${idempotencyKey}`);
  if (!cachedOcr) {
    throw new Error('OCR text not found or expired, please run Step 1 first');
  }
  const { ocrText } = JSON.parse(cachedOcr);

  // ดึง prompt version
  const activePrompt = await this.aiPromptsService.getActive('ocr_extraction');
  if (!activePrompt) {
    throw new Error('No active ocr_extraction prompt version found');
  }

  // ถ้าระบุ promptVersion ให้ใช้ version นั้น (แต่ต้อง validate ว่ามีอยู่)
  const targetPrompt = promptVersion
    ? await this.aiPromptsService.findByVersion('ocr_extraction', promptVersion)
    : activePrompt;

  if (!targetPrompt) {
    throw new Error(`Prompt version ${promptVersion} not found`);
  }

  // Resolve context และ run LLM (เหมือน processSandboxExtract เดิม)
  const masterDataContext = await this.aiPromptsService.resolveContext(
    targetPrompt,
    projectPublicId
  );

  const resolvedPrompt = targetPrompt.template
    .replace('{{ocr_text}}', ocrText)
    .replace('{{master_data_context}}', JSON.stringify(masterDataContext, null, 2));

  const response = await this.ollamaService.generate(resolvedPrompt, {
    timeoutMs: 120000,
  });

  const cleanedResponse = response
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  let extractedMetadata: Record<string, unknown>;
  try {
    extractedMetadata = JSON.parse(cleanedResponse) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${cleanedResponse}`);
  }

  await this.redis.setex(
    `ai:rag:result:${idempotencyKey}`,
    3600,
    JSON.stringify({
      requestPublicId: idempotencyKey,
      status: 'completed',
      answer: JSON.stringify(extractedMetadata, null, 2),
      ocrText,
      ocrUsed: JSON.parse(cachedOcr).ocrUsed,
      promptVersionUsed: targetPrompt.versionNumber,
      completedAt: new Date().toISOString(),
    })
  );
}
```

---

## Frontend Implementation

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│ OCR Sandbox Playground                              │
├──────────────────────┬──────────────────────────────┤
│  Prompt Editor       │  Version History             │
│  ┌────────────────┐  │  ┌────────────────────────┐  │
│  │ textarea       │  │  │ v3 (active) ✅          │  │
│  │ {{ocr_text}}   │  │  │ v2 - 2026-05-24        │  │
│  │ ...            │  │  │ v1 - 2026-05-22        │  │
│  └────────────────┘  │  └────────────────────────┘  │
│  [บันทึก Version ใหม่]│  [Load] [Activate] [Delete] │
├──────────────────────┴──────────────────────────────┤
│  Step 1: OCR Quality Check                         │
│  ┌──────────────────────────────────────────────┐  │
│  │ File Upload: [เลือก PDF]                     │  │
│  │ [Step 1: Run OCR]                              │  │
│  └──────────────────────────────────────────────┘  │
│  [OCR Raw Text Display]                            │
├─────────────────────────────────────────────────────┤
│  Step 2: AI Extraction (disabled until Step 1)     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Prompt Version: [v3 (active) ▼]              │  │
│  │ [Step 2: Run AI Extraction]                   │  │
│  └──────────────────────────────────────────────┘  │
│  [LLM Result Display]                              │
└─────────────────────────────────────────────────────┘
```

### State Management

```typescript
const [ocrRequestPublicId, setOcrRequestPublicId] = useState<string | null>(null);
const [ocrText, setOcrText] = useState<string>('');
const [ocrUsed, setOcrUsed] = useState<boolean>(false);
const [aiRequestPublicId, setAiRequestPublicId] = useState<string | null>(null);
const [selectedPromptVersion, setSelectedPromptVersion] = useState<number | undefined>(undefined);
const [step, setStep] = useState<'upload' | 'ocr-done' | 'ai-done'>('upload');
```

### Step 1: Run OCR

```typescript
const handleRunOcr = async () => {
  const response = await adminAiService.submitSandboxOcr(file);
  setOcrRequestPublicId(response.requestPublicId);
  // Poll for result...
};
```

### Step 2: Run AI Extraction

```typescript
const handleRunAi = async () => {
  const response = await adminAiService.submitSandboxAiExtract({
    requestPublicId: ocrRequestPublicId,
    promptVersion: selectedPromptVersion,
  });
  setAiRequestPublicId(response.requestPublicId);
  // Poll for result...
};
```

---

## ADR Impact

- **ADR-029**: เพิ่ม job types ใหม่ แต่ไม่เปลี่ยน architecture หลักของ `ai_prompts` table
- **ADR-030**: ไม่กระทบ context resolution logic ยังใช้ `resolveContext()` เหมือนเดิม
- **ADR-023A**: ไม่กระทบ AI boundary ยังใช้ Ollama ผ่าน BullMQ เหมือนเดิม

---

## Migration Plan

### Phase 1: Backend
1. เพิ่ม job types ใหม่ใน `AiBatchJobType`
2. Implement `processSandboxOcrOnly()` ใน `AiBatchProcessor`
3. Implement `processSandboxAiExtract()` ใน `AiBatchProcessor`
4. เพิ่ม endpoint `POST /ai/admin/sandbox/ocr` ใน `AiController`
5. เพิ่ม endpoint `POST /ai/admin/sandbox/ai-extract` ใน `AiController`
6. เพิ่ม method `findByVersion()` ใน `AiPromptsService` (ถ้ายังไม่มี)

### Phase 2: Frontend
1. เพิ่ม methods ใหม่ใน `adminAiService`:
   - `submitSandboxOcr(file)`
   - `submitSandboxAiExtract({ requestPublicId, promptVersion })`
2. Refactor `OcrSandboxPromptManager.tsx`:
   - เพิ่ม state สำหรับ step management
   - เพิ่ม UI Step 1 + Step 2 แยกกัน
   - เพิ่ม dropdown prompt version ใน Step 2
3. Update polling logic ให้รองรับ 2 requestPublicId แยกกัน

### Phase 3: Testing
1. Unit tests สำหรับ `processSandboxOcrOnly()` และ `processSandboxAiExtract()`
2. Integration tests สำหรับ OCR cache invalidation
3. E2E tests สำหรับ 2-step flow

---

## Rollback Plan

ถ้า feature นี้มีปัญหา:
- สามารถ rollback โดยใช้ legacy endpoint `POST /ai/admin/sandbox/extract` (sandbox-extract) ที่ยังคงอยู่
- หรือ comment out new endpoints และ UI changes
