# 🔍 เปรียบเทียบ: AI DMS Architecture Proposal vs. Repo จริง (lcbp3)

> จากแผน "อยากได้" → เทียบกับ "ที่มีอยู่จริง" แบบละเฮียกทีละข้อ 🎯

---

## 🏗️ 1. Architecture ภาพรวม

| ส่วนที่เสนอ | สถานะใน Repo | Gap / ข้อสังเกต |
|------------|-------------|---------------|
| **User → Web UI / Chat UI** | ✅ มี Next.js 16 + App Router | ✅ ตรงตามแผน แต่ยังไม่มี "Chat UI" แบบ Dedicated (มีแต่ Table + Form) |
| **AI Agent Layer** | 🟡 มี `.agents/` + `AGENTS.md` + n8n | ⚠️ เป็น "Agent Toolkit" สำหรับ Dev AI ช่วยเขียนโค้ด **ไม่ใช่** AI Agent ที่รันใน Production สำหรับ User |
| **RAG Engine** | ✅ มี ADR-022 (Superseded) → ADR-023 | ✅ มีสถาปัตยกรรม RAG แล้ว แต่ยังเป็น "แผน" ในเอกสาร ต้องดูการ Implement จริง |
| **Workflow Engine** | ✅ มี `workflow-engine/` module + ADR-001/021 | ✅ ตรงตามแผน 100% — DSL-based workflow + Integrated Context |
| **Tool Layer** | 🟡 มี Services ใน NestJS modules | ⚠️ Tools ยังเป็น "Internal API" ไม่ใช่ "Function Calling Interface" สำหรับ AI โดยตรง |
| **Database + Storage** | ✅ MariaDB 11.8 + Two-Phase File Storage | ✅ ตรงตามแผน + มี ClamAV + Redis Locking |

👉 **สรุป**: โครงสร้างพื้นฐาน (Infrastructure) พร้อมมาก แต่ "AI Agent Layer" ที่ User คุยด้วยยังต้องพัฒนาเพิ่ม

---

## 🔥 2. Core Components (ต้องมี)

### 2.1 AI Agent (สมอง)

| ที่เสนอ | ที่มีอยู่ | Gap |
|--------|----------|-----|
| LangChain / CrewAI | 🟡 ใช้ n8n + Ollama (ADR-023) | ⚠️ n8n เป็น Workflow Orchestrator **ไม่ใช่** Agent Framework แบบ LangChain |
| เข้าใจคำถาม → ตัดสินใจ → Call Tool | 🟡 มี "AI Boundary" (ADR-023) | ⚠️ ยังไม่มี "Intent Recognition Layer" ที่แยก Query → Tool Routing ชัดเจน |

💡 **แนะนำ**: ถ้าอยากได้ Agent แบบ "ตัดสินใจเอง" อาจต้องเพิ่ม `ai-agent/` module ที่ใช้ LangGraph หรือ Custom Agent Loop

---

### 2.2 RAG System (ค้นหาเอกสาร)

| ที่เสนอ | ที่มีอยู่ | Gap |
|--------|----------|-----|
| Vector DB: Qdrant / Chroma | 🟡 มี ADR-023A ระบุใช้ `Qdrant` | ✅ มีในสถาปัตยกรรม แต่ต้องตรวจสอบว่า Deploy แล้วหรือยัง |
| Search PDF / Drawing / Spec | 🟡 มี Elasticsearch 9.3.4 | ⚠️ Elasticsearch เป็น **Keyword Search** ไม่ใช่ **Vector Search** — ต้องแยกกัน |
| Use case: "Drawing A-101 revision ล่าสุด" | 🟡 มี `drawing/` module + revision tracking | ✅ Data Model พร้อม แต่ต้องเพิ่ม "Natural Language → Query Translation" |

💡 **จุดสำคัญ**: ต้องแยกให้ชัดระหว่าง:
- `Elasticsearch` → Full-text search (keyword)
- `Qdrant` → Vector search (semantic/RAG)

---

### 2.3 Tool Layer (สำคัญมาก) ⭐

| Tool ที่เสนอ | ที่มีอยู่ (NestJS Service) | Gap |
|-------------|--------------------------|-----|
| `get_rfa(id)` | ✅ `RfaService.findOne()` | ✅ พร้อม แต่ต้องสร้าง "AI Tool Wrapper" |
| `get_drawings_by_rfa(rfa_id)` | 🟡 มี Relation ใน Schema | ⚠️ ต้องเขียน Service Method แยกสำหรับ AI Call |
| `get_latest_revision(drawing_code)` | ✅ มี `DrawingService.getLatestRevision()` | ✅ พร้อม |
| `search_documents(query)` | ✅ มี `SearchModule` (Elasticsearch) | ⚠️ ต้องเพิ่ม "Vector Search" endpoint สำหรับ RAG |
| `get_transmittal_history()` | ✅ มี `TransmittalService` | ✅ พร้อม |

💡 **สิ่งที่ต้องทำเพิ่ม**: สร้าง `AiToolsService` ที่:
```typescript
// ตัวอย่าง: AI Tool Wrapper
@Injectable()
export class AiToolsService {
  @Tool({ name: 'get_rfa', description: 'Get RFA by ID' })
  async getRfa(id: string) {
    return this.rfaService.findOne({ publicId: id });
  }
  // ...อื่นๆ
}
```

---

### 2.4 Workflow Engine (logic ธุรกิจ)

| ที่เสนอ | ที่มีอยู่ | Gap |
|--------|----------|-----|
| RFA status flow | ✅ มี `workflow-engine/` + DSL | ✅ ตรงตามแผน 100% |
| Approval logic | ✅ มี CASL Guards + State Machine | ✅ พร้อม |
| Revision control | ✅ มี `revisions` table + locking | ✅ พร้อม |
| "AI = ช่วยคิด, Workflow = ของจริง" | ✅ มี ADR-023 "AI Boundary" | ✅ ตรงตามหลักการ |

👉 **จุดแข็ง**: ส่วนนี้ทำไว้ดีมากแล้ว — AI ไม่สามารถ "มั่ว" Workflow ได้ เพราะต้องผ่าน DSL Engine

---

### 2.5 File Storage

| ที่เสนอ | ที่มีอยู่ | Gap |
|--------|----------|-----|
| เก็บไฟล์จริง (PDF, DWG) | ✅ Two-Phase Storage + ClamAV | ✅ ตรงตามแผน |
| Version control | ✅ มี `revisions` table + naming convention | ✅ พร้อม |
| Naming convention | ✅ มี `document-numbering/` module (ADR-002) | ✅ พร้อม |

---

## ⚙️ 3. Database Design

| Table ที่เสนอ | ที่มีอยู่ | Gap |
|--------------|----------|-----|
| `ai_embeddings` | 🟡 มีใน ADR-023A (Qdrant) | ⚠️ ต้องสร้าง Collection ใน Qdrant + Sync Job |
| `ai_logs` | 🟡 มี `monitoring/` module | ⚠️ ต้องเพิ่ม `ai_audit_logs` table สำหรับ tracking AI decisions |
| `ai_tasks` | 🟡 มี BullMQ (ADR-008) | ✅ สามารถใช้ `ai-batch` queue สำหรับ background jobs |

💡 **แนะนำ**: สร้าง migration script สำหรับ:
```sql
-- ตัวอย่าง: ai_audit_logs table
CREATE TABLE ai_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_public_id BINARY(16),
  query_text TEXT,
  agent_decision JSON,
  tools_used JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🤖 4. AI Use Cases (ของจริงที่ควรทำ)

| Use Case | สถานะใน Repo | ความยาก |
|----------|-------------|---------|
| 🔎 Smart Search | 🟡 มี Elasticsearch + ADR-023 RAG | ⭐⭐ ต้องเพิ่ม NL→Query translator |
| 📄 Document QA | 🟡 มี OCR + Text extraction ในแผน | ⭐⭐⭐ ต้องเพิ่ม PDF parsing + chunking pipeline |
| 🔗 Relationship Mapping | ✅ มี Relations ใน Schema + Services | ⭐⭐ ต้องเพิ่ม "Graph Query" layer สำหรับ AI |
| 📊 Timeline Analysis | 🟡 มี `revisions.created_at` | ⭐⭐⭐ ต้องเพิ่ม "Temporal Query" logic |
| 🧠 Auto Classification | 🟡 มี ADR-017B (Superseded) | ⭐⭐⭐⭐ ต้องฝึก Model หรือใช้ Prompt Engineering |
| ⚠️ Alert / Assistant | 🟡 มี `notification/` module | ⭐⭐ ต้องเพิ่ม "Rule Engine" สำหรับ trigger alerts |

---

## 🧩 5. UI Design

| ส่วนที่เสนอ | ที่มีอยู่ | Gap |
|------------|----------|-----|
| Hybrid UI: Table + Chat | 🟡 มี DataTables + Forms | ⚠️ ยังไม่มี "Chat Panel" แบบ Side-by-side |
| Drawing Page: revision + RFAs + AI summary | ✅ มี `drawing/` module + relations | ⚠️ ต้องเพิ่ม "AI Summary" component ที่เรียก RAG |

💡 **Quick Win**: เพิ่ม Chat Panel แบบง่ายๆ ใน `app/(dashboard)/drawings/[id]/page.tsx`:
```tsx
// ตัวอย่าง: Chat Panel ใน Drawing Page
<aside className="w-80 border-l">
  <AiChatPanel
    context={{ type: 'drawing', id: drawing.publicId }}
    tools={['get_related_rfas', 'get_revision_history']}
  />
</aside>
```

---

## ⚡ 6. Tech Stack

| ส่วนที่เสนอ | ที่มีอยู่ | ตรงกัน? |
|------------|----------|---------|
| Backend: PHP → Python | ❌ ใช้ NestJS (TypeScript) ทั้งระบบ | ⚠️ ไม่ตรง — แต่ TypeScript + NestJS ดีกว่า PHP สำหรับ AI Integration |
| AI Layer: LangChain / Ollama | 🟡 ใช้ Ollama + n8n (ADR-023) | ✅ ตรงบางส่วน — ขาด LangChain/LlamaIndex |
| Vector DB: Qdrant | ✅ มีใน ADR-023A | ✅ ตรง |
| Frontend: DataTables + Chat UI | 🟡 มี DataTables (shadcn/ui) | ⚠️ ขาด Chat UI component |

💡 **ข้อดีของ Stack ปัจจุบัน**:
- Full TypeScript → Type-safe AI Tool definitions
- NestJS Modules → Easy to add `ai-agent/` module
- BullMQ → Ready for async AI jobs

---

## 🔥 7. Flow การทำงานจริง

### 📥 Upload Drawing

| ขั้นตอนที่เสนอ | ที่มีอยู่ | Gap |
|--------------|----------|-----|
| 1. User upload PDF | ✅ มี Two-Phase Upload | ✅ พร้อม |
| 2. Extract text (OCR) | 🟡 มีแผนใน ADR-023A | ⚠️ ต้องเพิ่ม OCR service (Tesseract / PaddleOCR) |
| 3. Chunk + Embed → Vector DB | 🟡 มี Qdrant ในแผน | ⚠️ ต้องเขียน `DocumentIndexingService` |
| 4. AI tag metadata | 🟡 มี ADR-017B (Superseded) | ⚠️ ต้อง implement classification pipeline |

### 🔎 Query

| ขั้นตอนที่เสนอ | ที่มีอยู่ | Gap |
|--------------|----------|-----|
| 1. เข้าใจ intent | 🟡 ไม่มี NLU layer | ⭐⭐⭐ ต้องเพิ่ม Intent Classifier |
| 2. Call tool: `get_drawings()` | ✅ มี `DrawingService` | ✅ พร้อม (แต่ต้อง wrap เป็น AI Tool) |
| 3. Filter revision ล่าสุด | ✅ มี `getLatestRevision()` | ✅ พร้อม |
| 4. ตอบ | 🟡 มี API Response | ⚠️ ต้องเพิ่ม "Natural Language Generation" layer |

---

## 🧠 8. Insight สำคัญ (อย่าพลาด)

| ข้อควรระวัง | สถานะใน Repo | ผ่าน? |
|------------|-------------|-------|
| ❌ อย่าให้ AI query DB ตรงๆ | ✅ มี ADR-023 "AI Boundary" | ✅ ผ่าน |
| ❌ อย่าให้ AI ตัดสินใจ workflow | ✅ มี Workflow Engine แยก | ✅ ผ่าน |
| ✅ AI → call function (tool) | 🟡 มี Services แต่ไม่มี Tool Interface | ⚠️ ต้องเพิ่ม `@Tool()` decorator pattern |
| ✅ System → validate logic | ✅ มี CASL Guards + Validation | ✅ ผ่าน |

👉 **คุณทำถูกแล้ว**: การแยก "AI Intelligence" ออกจาก "Business Logic" เป็นหัวใจของระบบที่ปลอดภัย

---

## 🚀 9. Roadmap (ทำจริง)

### Phase 1 (2–4 สัปดาห์) — AI Chat + Query DB

| Task | สถานะ | ความยาก |
|------|--------|---------|
| สร้าง `AiAgentModule` ใน NestJS | ❌ ยังไม่มี | ⭐⭐ |
| สร้าง `AiToolsService` wrapper | ❌ ยังไม่มี | ⭐⭐ |
| เพิ่ม Chat UI component ใน Frontend | ❌ ยังไม่มี | ⭐⭐ |
| ทดสอบ: "RFA ล่าสุดคืออะไร" | ❌ ยังไม่มี | ⭐⭐ |

### Phase 2 — RAG + Embedding

| Task | สถานะ | ความยาก |
|------|--------|---------|
| Deploy Qdrant ใน Docker | 🟡 มีในแผน | ⭐⭐ |
| สร้าง `DocumentIndexingService` (OCR + Chunk + Embed) | ❌ ยังไม่มี | ⭐⭐⭐ |
| สร้าง `QdrantService` สำหรับ vector search | ❌ ยังไม่มี | ⭐⭐ |
| ทดสอบ: "สรุป spec นี้" | ❌ ยังไม่มี | ⭐⭐⭐ |

### Phase 3 — Automation + Alert

| Task | สถานะ | ความยาก |
|------|--------|---------|
| สร้าง `AiAlertService` สำหรับ rule-based alerts | ❌ ยังไม่มี | ⭐⭐⭐ |
| สร้าง `ClassificationPipeline` สำหรับ auto-tagging | ❌ ยังไม่มี | ⭐⭐⭐⭐ |
| Integrateกับ Notification Module | ✅ มี `notification/` module | ⭐⭐ |

---

## 🎯 10. ถ้าจะทำให้ "โหดจริง"

### Ultimate Version: AI = Document Controller

| ฟีเจอร์ | สิ่งที่ต้องเพิ่ม | ความยาก |
|--------|----------------|---------|
| 🔍 Auto check: revision mismatch | สร้าง `RevisionConsistencyChecker` | ⭐⭐⭐ |
| 🔍 Auto check: missing approval | สร้าง `ApprovalGapDetector` | ⭐⭐⭐ |
| 🔍 Auto check: outdated drawing | สร้าง `DrawingFreshnessMonitor` | ⭐⭐⭐ |
| 🤖 Proactive alert: "Drawing นี้ outdated" | Integrateกับ `notification/` module | ⭐⭐ |

---

## 💡 สรุปสั้นๆ (แบบเฮียก)

### ✅ สิ่งที่ "มีแล้ว" และ "ทำดีแล้ว"
1. **สถาปัตยกรรมพื้นฐาน** — NestJS + Next.js + MariaDB + Redis + Elasticsearch → Solid
2. **Workflow Engine** — DSL-based + ADR-001/021 → ตรงตามแผน 100%
3. **Security & RBAC** — CASL + 4-Level + JWT → พร้อมสำหรับ Enterprise
4. **File Storage** — Two-Phase + ClamAV + Versioning → ดีมาก
5. **AI Boundary** — ADR-023 กำหนดขอบเขตชัดเจน → ป้องกัน AI มั่ว

### ⚠️ สิ่งที่ "ต้องเพิ่ม" เพื่อให้เป็น AI DMS จริง
1. **AI Agent Runtime** — สร้าง `ai-agent/` module ที่รันใน Production (ไม่ใช่แค่ `.agents/` สำหรับ Dev)
2. **Tool Calling Interface** — Wrap Services เป็น `@Tool()` decorators สำหรับ AI Call
3. **Vector Search Pipeline** — Deploy Qdrant + สร้าง `DocumentIndexingService`
4. **Chat UI Component** — เพิ่ม Side Panel Chat ใน Drawing/RFA Pages
5. **Intent Recognition** — เพิ่ม NL→Query translator สำหรับ Smart Search

### 🎯 Quick Win (ทำใน 1 สัปดาห์)
```bash
# 1. สร้าง AI Agent Module
nest g module ai-agent
nest g service ai-agent/ai-tools
nest g controller ai-agent/chat

# 2. เพิ่ม Tool Wrapper
# src/ai-agent/ai-tools.service.ts
@Injectable()
export class AiToolsService {
  @Tool({ name: 'get_rfa', description: 'Get RFA by publicId' })
  async getRfa(@Arg('publicId') publicId: string) {
    return this.rfaService.findOne({ where: { publicId } });
  }
}

# 3. เพิ่ม Chat Endpoint
# src/ai-agent/chat.controller.ts
@Post('chat')
async chat(@Body() dto: ChatDto) {
  // 1. Parse intent
  // 2. Route to tools
  // 3. Generate response
}
```

---

> 🎯 **Bottom Line**: Repo คุณ "พร้อม 80%" สำหรับ AI DMS — ขาดแค่ "AI Runtime Layer" ที่เชื่อม Agent → Tools → UI
> ถ้าเพิ่ม `ai-agent/` module + Tool Interface + Chat UI → จะได้ระบบที่ "โหดจริง" ตามที่วางแผนไว้ 🔥

