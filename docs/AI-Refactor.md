# AI Runtime Refactor

เอกสารนี้สรุปผล grilling session สำหรับการ refactor AI runtime หลังอัปเกรด GPU จาก RTX 2060 SUPER 8GB เป็น ASUS DUAL RTX 5060 Ti 16GB

เอกสารอ้างอิง:
- [ADR-033](../specs/06-Decision-Records/ADR-033-active-model-and-ocr-management.md)
- [ADR-034](../specs/06-Decision-Records/ADR-034-AI-model-change.md)
- [ADR ใหม่: AI Runtime Policy Refactor](./adr/0001-ai-runtime-policy-refactor.md)
- [CONTEXT.md](../CONTEXT.md)

## เป้าหมาย

- เปลี่ยนชื่อโมเดลหลักและ OCR ไปเป็น canonical identities ใหม่
- ย้ายสัญญา API จาก caller-driven model selection ไปเป็น policy-driven `executionProfile`
- รวมการจัดการ VRAM ของ main model, OCR, embedding, และ reranking ไว้ใน policy เดียว
- ใช้ big bang rollout แบบมีกติกา cutover และ verification ที่รันซ้ำได้

## Decision Summary

### 1. Canonical naming

- ใช้ `np-dms-ai` เป็น canonical model identity เดียวทุกชั้นที่ผู้ใช้และนักพัฒนาเห็น
- ใช้ `np-dms-ocr` เป็น canonical OCR identity เดียวทุกชั้น
- ชื่อ runtime/base model จริงเป็น implementation detail ใน Modelfile, deploy script, หรือ ops internals เท่านั้น

### 2. API contract

- caller ส่งได้เพียง `executionProfile`
- caller ห้ามส่ง `model.key`
- caller ห้าม override `temperature`, `top_p`, `maxTokens`, หรือ runtime parameters อื่นโดยตรง
- backend policy เป็นผู้ map `executionProfile` ไปยัง canonical model, runtime parameters, และ keep_alive policy

### 3. Canonical profile set

โปรไฟล์ระดับ contract มีแค่:

- `fast`
- `balanced`
- `thai-accurate`
- `large-context`

กฎเพิ่ม:

- `large-context` จำกัดเฉพาะ admin/special workflows
- งานที่มีผลต่อข้อมูล เช่น `migrate-document`, `auto-fill-document`, OCR extraction ใช้ backend override profile เอง

### 4. Runtime resource policy

- `np-dms-ai` เป็น workload หลักของ generation path
- `np-dms-ocr` ใช้ adaptive residency แทน fixed `keep_alive`
- retrieval acceleration (`BGE-M3`, `BGE-Reranker-Large`) อยู่ใน policy เดียวกับ main/OCR
- GPU ownership ใช้หลัก LLM-first
- ถ้า VRAM headroom ไม่พอ retrieval ต้อง fallback CPU ทันที

### 5. Queue policy

- คงโครง `ai-realtime` / `ai-batch` และ pause/resume coordination เดิมเป็นแกน
- อนุญาต `ai-realtime = 2` ได้เฉพาะ lightweight realtime jobs
- `rag-query` ไม่ใช่ lightweight realtime job
- `rag-query` เป็น generation-centric job: retrieval เป็นขั้นเตรียม context และ fallback CPU ได้

### 6. Rollout policy

- rollout ใช้ `Big Bang`
- cutover จะถือว่าสำเร็จต่อเมื่อผ่านครบทั้ง:
  - policy contract
  - model switching
  - adaptive OCR residency
  - RAG fallback

## Canonical Models

| Canonical Name | บทบาท | Residency policy | หมายเหตุ |
|---|---|---|---|
| `np-dms-ai` | main generation model | resident by default | backend policy คุม runtime parameters |
| `np-dms-ocr` | OCR model | adaptive | ใช้ policy ตาม VRAM headroom และ active workload |

หมายเหตุ:
- เอกสารนี้ไม่บังคับว่าฐานจริงต้องเป็น model family ใดเสมอไป
- การเปลี่ยน base runtime model ในอนาคตไม่ควรเปลี่ยน canonical API/UI name ถ้า semantics เดิมยังอยู่

## Execution Profile Contract

### Request DTO

```typescript
interface CreateAiJobRequest {
  type: 'auto-fill-document' | 'migrate-document' | 'rag-query';
  documentId?: string;
  attachmentId?: string;
  executionProfile?: 'fast' | 'balanced' | 'thai-accurate' | 'large-context';
}
```

### Policy rules

- `migrate-document`: backend override เป็น profile ที่ deterministic สูงเสมอ
- `auto-fill-document`: backend override ได้ตาม data-affecting policy
- `rag-query`: ปกติใช้ `balanced` หรือ policy ที่ backend กำหนด
- `large-context`: ใช้ได้เฉพาะ admin/special workflows ที่ backend whitelist

### Forbidden contract

สิ่งต่อไปนี้ต้องไม่มีใน public contract:

```typescript
model: {
  key: string;
  parameters: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  };
}
```

เหตุผล:
- caller bypass governance ได้
- verification matrix โตเกินจำเป็น
- profile abstraction หมดความหมายทันที

## Adaptive OCR Residency

หลักการ:

- `np-dms-ocr` ไม่ใช้ fixed `keep_alive: 0` หรือ fixed `keep_alive: 300` ตายตัว
- backend policy คำนวณ residency จาก VRAM headroom และ active model/workload ปัจจุบัน
- ถ้า active workload กิน VRAM สูง หรือ profile ปัจจุบันเสี่ยงชน headroom ให้ fallback เป็น `keep_alive: 0`
- ถ้า headroom เหลือและไม่มี contention สำคัญ อนุญาต residency window ชั่วคราวได้

ตัวอย่าง policy:

```text
if active_profile == 'large-context' => OCR keep_alive = 0
if active_main_model_pressure == high => OCR keep_alive = 0
if headroom >= policy threshold => OCR keep_alive = short residency window
```

## LLM-First GPU Ownership

ลำดับสิทธิ์ VRAM:

1. `np-dms-ai`
2. `np-dms-ocr`
3. `BGE-M3`
4. `BGE-Reranker-Large`

ผลเชิงพฤติกรรม:

- retrieval path ใช้ GPU ได้เฉพาะเมื่อ policy ระบุว่ามี headroom จริง
- retrieval path ไม่มีสิทธิ์บังคับรอ GPU เพื่อแย่ง resource จาก main/OCR path
- หาก headroom ไม่พอ `embed` และ `rerank` ต้อง fallback CPU ทันที

## Retrieval Acceleration

### Scope

เอกสารนี้ถือว่า retrieval acceleration เป็นส่วนหนึ่งของ runtime resource policy เดียวกัน ไม่ใช่ tuning แยก

### Sidecar policy

ปัจจุบัน:

```text
POST /embed   -> CPU
POST /rerank  -> CPU
```

เป้าหมาย:

```text
POST /embed   -> GPU เมื่อ headroom ผ่าน policy, ไม่เช่นนั้นใช้ CPU
POST /rerank  -> GPU เมื่อ headroom ผ่าน policy, ไม่เช่นนั้นใช้ CPU
POST /ocr-upload -> OCR path ตาม adaptive OCR residency
POST /normalize  -> CPU
```

### Retrieval fallback rule

- ห้าม queue รอ GPU เพื่อให้ retrieval ได้ acceleration
- ห้าม fail hard เพียงเพราะ GPU ไม่พอ
- ให้ degrade ไป CPU แล้วตอบงานต่อ

## Queue and Scheduling

### Baseline

- `ai-batch` ยังสามารถถูก pause/resume โดย realtime path ตาม coordination model เดิม
- `ai-realtime = 1` ยังคงเป็น baseline สำหรับงาน generation-heavy

### Selective realtime uplift

อนุญาต `ai-realtime = 2` เฉพาะกลุ่มงานที่เป็น lightweight realtime jobs เช่น:

- intent classification ที่ไม่เรียก OCR
- tool-only suggestion path ที่ไม่บังคับ model switching
- metadata-free chat steps ที่ไม่ใช้ GPU-heavy generation

ไม่รวม:

- `rag-query`
- OCR-triggering jobs
- งานที่บังคับ model switching
- generation-heavy jobs

## Big Bang Rollout

### Decision

refactor รอบนี้ใช้ big bang rollout เพราะระบบยังไม่เปิด production

### Consequence

ห้ามใช้เกณฑ์ partial success แบบ "บางแกนผ่านก็ถือว่าปล่อยได้"

### Cutover gate

ต้องผ่านครบทุกแกน:

1. policy contract ใหม่ทำงานจริง
2. canonical naming ใหม่ทำงานจริง
3. model switching และ OCR residency ตรง policy ใหม่
4. retrieval GPU/CPU fallback ทำงานจริง

## Verification

ใช้แนวทาง executable-first แต่ทุกแกนต้องมี manual validation path ประกบ

### 1. Policy contract

Executable:

- unit/integration tests สำหรับ DTO และ policy mapping
- tests ว่า caller ส่ง `model.key` หรือ parameter overrides ไม่ได้
- tests ว่า data-affecting jobs ถูก backend override profile จริง

Manual:

- ยิง request จาก admin/sandbox แล้วตรวจว่า UI/API ไม่ expose free-form model selection

### 2. Canonical naming

Executable:

- search-based checks ว่า public-facing contract ใช้ `np-dms-ai` / `np-dms-ocr`
- tests สำหรับ settings/service/controller ที่คืนชื่อ canonical

Manual:

- เปิด AI Admin Console และ OCR sandbox ตรวจ label/option/log surface ที่ผู้ใช้เห็น

### 3. Adaptive OCR residency

Executable:

- tests ว่า residency policy ให้ `keep_alive` ต่างกันตาม headroom scenario
- logs/trace ว่า OCR requests ใช้ residency decision ตาม policy

Manual:

- รัน OCR ซ้ำหลายงานในเงื่อนไข headroom ต่างกันและตรวจ behavior จริง

### 4. Retrieval fallback

Executable:

- tests ว่า `/embed` และ `/rerank` fallback CPU เมื่อ GPU threshold ไม่ผ่าน
- trace/log ว่า `rag-query` ยังตอบได้เมื่อ GPU retrieval path ถูกปิด

Manual:

- ทดลอง RAG query ภายใต้ภาระ GPU สูงและยืนยันว่าคำตอบยังออกได้แม้ช้าลง

## Implementation Workstreams

### Workstream A: Contract and naming

- เปลี่ยน public contract ให้ใช้ `executionProfile`
- ลบ `model.key` และ parameter override จาก API docs/DTO ที่เกี่ยวข้อง
- เปลี่ยน public-facing names เป็น `np-dms-ai` และ `np-dms-ocr`

### Workstream B: Runtime policy

- สร้าง policy mapping profile -> runtime configuration
- เพิ่ม adaptive OCR residency logic
- แยก policy ของ data-affecting jobs ออกจาก caller input

### Workstream C: Retrieval acceleration

- เพิ่ม GPU eligibility check สำหรับ `embed` และ `rerank`
- เพิ่ม CPU fallback path ที่ explicit
- บันทึก telemetry/log สำหรับ fallback decisions

### Workstream D: Queue policy

- คง pause/resume coordination เดิม
- แยก lightweight realtime jobs ออกจาก generation-heavy jobs
- ใช้ selective concurrency uplift เฉพาะ job ที่ allowed

### Workstream E: Verification

- เพิ่ม automated tests ตาม cutover gate
- เพิ่ม manual validation checklist สำหรับ admin console, OCR sandbox, และ RAG path

## Non-Goals

- ไม่เปิดให้ caller เลือก runtime parameters เอง
- ไม่เปลี่ยน `rag-query` ให้เป็น retrieval-first job
- ไม่ยกเลิก pause/resume coordination เดิมทั้งหมด
- ไม่แยก retrieval acceleration ออกเป็น policy คนละชุดกับ main/OCR
- ไม่ใช้ phased rollout ในเอกสารฉบับนี้

## Migration Note for Current Repo

repo ปัจจุบันยังมีจุดที่อิงชื่อและ policy เดิม เช่น `typhoon2.5-np-dms:latest`, `typhoon-np-dms-ocr:latest`, และ `keep_alive: 0` ในหลาย service/spec. เอกสารนี้จึงเป็น target architecture/policy ใหม่ และต้องมีการอัปเดตโค้ด, tests, cross-spec docs, และ admin UI ให้สอดคล้องก่อนจะถือว่า cutover สำเร็จ.
