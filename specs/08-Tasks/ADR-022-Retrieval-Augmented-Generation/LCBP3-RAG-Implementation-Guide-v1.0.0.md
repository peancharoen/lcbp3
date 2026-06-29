
**LCBP3 DMS**

**RAG Implementation Guide by Claude**

Retrieval-Augmented Generation for Document Management System

| Version | 1.0.0 |
| :---- | :---- |
| **Project** | Laem Chabang Basin Phase 3 |
| **Stack** | NestJS \+ Next.js \+ MariaDB \+ Qdrant |
| **LLM** | Typhoon API \+ Ollama (nomic-embed-text) |

# **1\. ภาพรวม Architecture**

ระบบ RAG ของ LCBP3 DMS ออกแบบให้ทำงานแบบ Hybrid โดยแยกหน้าที่ชัดเจนระหว่าง embedding (local) และ generation (cloud Thai LLM) เพื่อให้ได้ทั้งความเป็นส่วนตัวของข้อมูลในส่วน embedding และคุณภาพภาษาไทยที่ดีในส่วนการตอบคำถาม

## **1.1 Hybrid Architecture**

| Flow: PDF/DOCX Upload  →  OCR (EasyOCR/Tesseract)  →  Text Chunking  →  Embedding (Ollama: nomic-embed-text)  →  Qdrant Vector Store RAG Query  →  Embed Question  →  Qdrant Similarity Search  →  Build Prompt  →  Typhoon API  →  Thai Answer |
| :---- |

| Component | เครื่องมือ | ที่อยู่ | หมายเหตุ |
| :---- | :---- | :---- | :---- |
| Document Metadata | MariaDB | เดิม | ไม่เปลี่ยน |
| Vector Store | Qdrant | Docker container | เพิ่มใหม่ |
| Embedding Model | nomic-embed-text | Ollama local | 768 dimensions |
| LLM / Generation | Typhoon API | api.opentyphoon.ai | Thai-first, OpenAI-compatible |
| OCR | EasyOCR / Tesseract | Docker microservice | รองรับภาษาไทย |
| Async Queue | BullMQ \+ Redis | Docker container | async ingestion |

# **2\. Chunking Strategy ตาม Document Type**

แต่ละประเภทเอกสารใน LCBP3 มีโครงสร้างต่างกัน จึงไม่ควรใช้ fixed-size chunking เดียวกันทั้งหมด

| Document Type | Strategy | Chunk Size | Overlap |
| :---- | :---- | :---- | :---- |
| CORR, MOM | Paragraph-based | \~500 tokens | 50 tokens |
| RFI, NCR | Section-based (Q\&A) | \~300 tokens | 30 tokens |
| DRAW, SUB | Metadata-heavy | \~200 tokens | 0 tokens |
| CONTRACT, INVOICE | Table-aware | \~400 tokens | 40 tokens |
| RPT | Sliding window | \~600 tokens | 100 tokens |
| TRANS | Header \+ body split | \~350 tokens | 35 tokens |

| หมายเหตุ nomic-embed-text รองรับ input สูงสุด 8192 tokens แต่ chunk ที่เล็กกว่าให้ precision ดีกว่าในงาน retrieval สำหรับเอกสารที่มีตาราง (CONTRACT, INVOICE) ให้ extract ตารางแยกก่อน แล้ว serialize เป็น text |
| :---- |

# **3\. ขั้นตอนการ Implement โดยละเอียด**

| 1 | ติดตั้ง Qdrant และ Redis ผ่าน Docker Compose เพิ่ม services ใน docker-compose.yml ที่มีอยู่แล้ว |
| :---: | :---- |

**เพิ่มใน docker-compose.yml:**

  qdrant:

    image: qdrant/qdrant:latest

    container\_name: lcbp3-qdrant

    ports:

      \- "6333:6333"

    volumes:

      \- qdrant\_data:/qdrant/storage

    restart: unless-stopped

  redis:

    image: redis:7-alpine

    container\_name: lcbp3-redis

    ports:

      \- "6379:6379"

    volumes:

      \- redis\_data:/data

    restart: unless-stopped

ทดสอบว่า Qdrant ทำงาน: เปิด browser ไปที่ http://localhost:6333/dashboard

| 2 | เพิ่ม Table document\_chunks ใน MariaDB เก็บ reference ระหว่าง MariaDB กับ Qdrant point ID |
| :---: | :---- |

CREATE TABLE document\_chunks (

  id          CHAR(36) PRIMARY KEY,   \-- UUID \= Qdrant point ID

  document\_id CHAR(36) NOT NULL,

  chunk\_index INT NOT NULL,

  content     TEXT NOT NULL,

  created\_at  DATETIME DEFAULT CURRENT\_TIMESTAMP,

  FOREIGN KEY (document\_id)

    REFERENCES documents(id) ON DELETE CASCADE

);

| 3 | ติดตั้ง Dependencies ใน NestJS ติดตั้ง packages ที่จำเป็นทั้งหมด |
| :---: | :---- |

\# ใน packages/api (NestJS)

pnpm add @qdrant/js-client-rest

pnpm add openai

pnpm add bullmq

pnpm add @nestjs/bull bull

pnpm add uuid

pnpm add \-D @types/uuid

| 4 | สร้าง RAG Module Structure จัดโครงสร้างไฟล์ใน NestJS |
| :---: | :---- |

**โครงสร้างไฟล์ที่แนะนำ:**

src/rag/

  rag.module.ts          \<- register all providers

  rag.controller.ts      \<- POST /api/rag/query

  rag.service.ts         \<- orchestrate pipeline

  embedding.service.ts   \<- call Ollama nomic-embed-text

  qdrant.service.ts      \<- Qdrant CRUD operations

  chunker.service.ts     \<- smart chunking per doc type

  llm.service.ts         \<- call Typhoon API

  ingestion.processor.ts \<- BullMQ worker

| 5 | สร้าง EmbeddingService เรียก Ollama nomic-embed-text สำหรับแปลงข้อความเป็น vector |
| :---: | :---- |

// embedding.service.ts

@Injectable()

export class EmbeddingService {

  private readonly OLLAMA\_URL \= process.env.OLLAMA\_URL

                             ?? "http://localhost:11434";

  async embed(text: string): Promise\<number\[\]\> {

    const res \= await fetch(\`${this.OLLAMA\_URL}/api/embeddings\`, {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({

        model: "nomic-embed-text",

        prompt: text,

      }),

    });

    if (\!res.ok) throw new Error(\`Embedding failed: ${res.status}\`);

    const { embedding } \= await res.json();

    return embedding;

  }

}

| 6 | สร้าง QdrantService จัดการ vector store สำหรับ upsert, search, delete |
| :---: | :---- |

// qdrant.service.ts

@Injectable()

export class QdrantService implements OnModuleInit {

  private client: QdrantClient;

  private readonly COLLECTION \= "lcbp3\_docs";

  async onModuleInit() {

    this.client \= new QdrantClient({

      url: process.env.QDRANT\_URL ?? "http://localhost:6333",

    });

    await this.ensureCollection();

  }

  private async ensureCollection() {

    const { collections } \= await this.client.getCollections();

    const exists \= collections.some(c \=\> c.name \=== this.COLLECTION);

    if (\!exists) {

      await this.client.createCollection(this.COLLECTION, {

        vectors: { size: 768, distance: "Cosine" },

      });

    }

  }

  async upsert(id: string, vector: number\[\], payload: Record\<string, any\>) {

    await this.client.upsert(this.COLLECTION, {

      points: \[{ id, vector, payload }\],

    });

  }

  async search(vector: number\[\], topK \= 5, filter?: Record\<string, any\>) {

    return this.client.search(this.COLLECTION, {

      vector,

      limit: topK,

      filter: filter ? {

        must: Object.entries(filter).map((\[key, value\]) \=\> ({

          key, match: { value },

        })),

      } : undefined,

      with\_payload: true,

    });

  }

  async deleteByDocumentId(documentId: string) {

    await this.client.delete(this.COLLECTION, {

      filter: { must: \[{ key: "document\_id", match: { value: documentId } }\] },

    });

  }

}

| 7 | สร้าง LlmService (Typhoon API) เรียก Typhoon สำหรับ generate คำตอบ |
| :---: | :---- |

// llm.service.ts

import OpenAI from "openai";

@Injectable()

export class LlmService {

  private client: OpenAI;

  constructor() {

    this.client \= new OpenAI({

      apiKey: process.env.TYPHOON\_API\_KEY,

      baseURL: "https://api.opentyphoon.ai/v1",

    });

  }

  async generate(prompt: string, system?: string): Promise\<string\> {

    const response \= await this.client.chat.completions.create({

      model: "typhoon-v2.1-12b-instruct",

      messages: \[

        { role: "system", content: system ?? LCBP3\_SYSTEM\_PROMPT },

        { role: "user", content: prompt },

      \],

      max\_tokens: 1024,

      temperature: 0.3,

      top\_p: 0.95,

      repetition\_penalty: 1.05,

    });

    return response.choices\[0\].message.content ?? "";

  }

}

**System Prompt สำหรับ LCBP3:**

const LCBP3\_SYSTEM\_PROMPT \= \`

You are a document assistant for LCBP3 (Laem Chabang Basin Phase 3),

a large-scale construction project DMS.

\- Answer in Thai if the question is in Thai

\- Answer in English if the question is in English

\- Always reference document numbers (e.g., CORR-LCBP3-2024-001)

\- Be concise and factual. Do not speculate beyond the provided context.

\- If context is insufficient, say so clearly.

\`;

| 8 | สร้าง ChunkerService แบ่ง text ตาม strategy ของแต่ละ document type |
| :---: | :---- |

// chunker.service.ts

@Injectable()

export class ChunkerService {

  chunk(text: string, docType: string): { text: string }\[\] {

    const strategy \= this.getStrategy(docType);

    return strategy(text);

  }

  private getStrategy(docType: string) {

    const map: Record\<string, (t: string) \=\> { text: string }\[\]\> \= {

      CORR: (t) \=\> this.paragraphChunk(t, 500, 50),

      MOM:  (t) \=\> this.paragraphChunk(t, 500, 50),

      RFI:  (t) \=\> this.sectionChunk(t, 300, 30),

      NCR:  (t) \=\> this.sectionChunk(t, 300, 30),

      RPT:  (t) \=\> this.slidingWindow(t, 600, 100),

      CONTRACT: (t) \=\> this.tableAware(t, 400, 40),

      INVOICE:  (t) \=\> this.tableAware(t, 400, 40),

    };

    return map\[docType\] ?? ((t) \=\> this.slidingWindow(t, 400, 50));

  }

  // ... implement paragraphChunk, sectionChunk, slidingWindow, tableAware

}

| 9 | สร้าง Ingestion Pipeline เชื่อม upload event กับ vector indexing ผ่าน BullMQ queue |
| :---: | :---- |

// rag.service.ts — triggerIngestion

async ingestDocument(documentId: string) {

  const doc \= await this.documentsService.findOne(documentId);

  const rawText \= await this.extractText(doc.filePath, doc.docType);

  const chunks \= this.chunker.chunk(rawText, doc.docType);

  // ลบ chunks เก่าก่อน (กรณี re-ingest)

  await this.qdrant.deleteByDocumentId(documentId);

  await this.chunkRepo.delete({ documentId });

  for (const \[i, chunk\] of chunks.entries()) {

    const chunkId \= uuidv4();

    const embedding \= await this.embedding.embed(chunk.text);

    await this.qdrant.upsert(chunkId, embedding, {

      document\_id: documentId,

      doc\_type: doc.docType,

      doc\_number: doc.docNumber,

      revision: doc.revision,

      project\_code: "LCBP3",

      chunk\_index: i,

    });

    await this.chunkRepo.save({

      id: chunkId, documentId,

      chunkIndex: i, content: chunk.text,

    });

  }

}

**เรียก triggerIngestion() หลัง upload สำเร็จ:**

// documents.service.ts — หลัง save document

await this.ragQueue.add("ingest", { documentId: doc.id });

| 10 | สร้าง RAG Query API Endpoint สำหรับ frontend เรียกใช้ |
| :---: | :---- |

// rag.service.ts — query

async query(question: string, filter?: { doc\_type?: string }) {

  // 1\. Embed คำถาม

  const qVector \= await this.embedding.embed(question);

  // 2\. Retrieve top-5 chunks จาก Qdrant

  const hits \= await this.qdrant.search(qVector, 5, filter);

  // 3\. Build context

  const context \= hits.map(h \=\>

    \`\[${h.payload.doc\_type} \- ${h.payload.doc\_number}\]\\n${h.payload.content}\`

  ).join("\\n\\n---\\n\\n");

  // 4\. Generate คำตอบผ่าน Typhoon

  const prompt \= \`Context:\\n${context}\\n\\nQuestion: ${question}\`;

  return this.llm.generate(prompt);

}

// rag.controller.ts

@Post("query")

async query(@Body() dto: { question: string; doc\_type?: string }) {

  return this.ragService.query(dto.question, { doc\_type: dto.doc\_type });

}

# **4\. Environment Variables**

เพิ่มใน .env ของ NestJS:

\# Typhoon API

TYPHOON\_API\_KEY=your\_typhoon\_api\_key\_here

\# Ollama (local)

OLLAMA\_URL=http://localhost:11434

\# Qdrant

QDRANT\_URL=http://localhost:6333

\# Redis (BullMQ)

REDIS\_HOST=localhost

REDIS\_PORT=6379

# **5\. ลำดับการ Rollout**

แนะนำให้ implement เป็น phase เพื่อลดความเสี่ยง:

| Phase | สิ่งที่ทำ | ผลลัพธ์ |
| :---- | :---- | :---- |
| Phase 1(1-2 วัน) | ติดตั้ง Qdrant \+ Redis, สร้าง DB table, ติดตั้ง packages | Infrastructure พร้อม |
| Phase 2(2-3 วัน) | สร้าง EmbeddingService \+ QdrantService \+ LlmService, ทดสอบแต่ละ service แยกกัน | Core services ทำงาน |
| Phase 3(2-3 วัน) | สร้าง ChunkerService \+ Ingestion Pipeline เริ่มจาก CORR และ RFI ก่อน | Indexing ทำงานอัตโนมัติ |
| Phase 4(1-2 วัน) | สร้าง RAG Query API \+ เชื่อมกับ NestJS route | Query API พร้อม |
| Phase 5(2-3 วัน) | สร้าง UI ใน Next.js: Search bar \+ Answer panel พร้อม source citation | ใช้งานได้จริง |

# **6\. ข้อควรพิจารณาสำคัญ**

| ⚠️  ความปลอดภัยของข้อมูล (สำคัญมาก) เนื้อหาของเอกสารจะถูกส่งไปยัง Typhoon API (cloud) เพื่อ generate คำตอบ แนะนำให้ตรวจสอบกับทีม PM / Security ว่าเอกสารชั้น Confidential สามารถส่งออกนอกได้หรือไม่ ทางเลือก: ใช้ Ollama local LLM แทน Typhoon สำหรับเอกสาร Confidential |
| :---- |

| ℹ️  Rate Limit ของ Typhoon Free Tier อยู่ที่ 5 req/s และ 200 req/m — เพียงพอสำหรับ internal DMS หากมีผู้ใช้หลายคน query พร้อมกัน อาจต้องพิจารณา upgrade เป็น Together.ai plan |
| :---- |

| ℹ️  Embedding ยังต้องใช้ Ollama Typhoon API ยังไม่มี embedding endpoint nomic-embed-text รันบน Ollama local ทำให้ข้อมูลที่ embed ไม่ออกนอกเครือข่าย |
| :---- |

