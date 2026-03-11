# 🚀 Ultimate Prompt Library for Software Engineering
AI Prompt Library สำหรับการพัฒนา Software แบบครบวงจร ตั้งแต่การวางแผนโปรเจกต์ การออกแบบ UX/UI การพัฒนาระบบ ไปจนถึงการ Deploy และ Optimize ใน Production
[ชื่อโปรเจกต์] = LCBP3-DMS (Laem Chabang Port Phase 3 - Document Management System)
---

## 🧭 1. Strategy & Product Planning

### 🟡 Product Owner 🟢 Basic
วิเคราะห์เป้าหมายธุรกิจและกำหนด MVP

**Prompt**

ให้คุณรับบทเป็น Product Owner สำหรับโปรเจกต์ **[ชื่อโปรเจกต์]**

ช่วยวิเคราะห์:
- เป้าหมายธุรกิจ
- กลุ่มผู้ใช้งานหลัก
- ปัญหาที่ผู้ใช้เจอ
- โอกาสทางตลาด

Output format (ตอบเป็น Markdown):
1. System goals
2. Target users
3. User pain points
4. Feature list (แบ่ง Must-have / Nice-to-have / Out of scope)
5. MVP scope
6. Future roadmap (3 phases)
7. Success metrics (KPIs)

---

### 🔵 Business Analyst 🟡 Intermediate
แตก Requirement อย่างละเอียด

**Prompt**

ให้คุณรับบทเป็น Business Analyst
ช่วยวิเคราะห์ requirement ของระบบ **[ชื่อระบบ]**

Context จาก Product Owner:
[วาง Output จาก Product Owner Prompt ที่นี่]

วิเคราะห์:
- Functional requirements
- Non-functional requirements (Performance / Security / Scalability)
- User roles และ permission matrix
- Use cases (Happy path + Alternative path)
- Business rules
- Edge cases
- Assumptions / Open questions

Constraints:
- ตอบเป็น Markdown
- ใช้ภาษาที่ Developer เข้าใจได้ทันที
- ระบุ priority (P0/P1/P2) ทุก requirement

Output:
- Feature list พร้อม priority
- MVP scope
- Roadmap
- Requirement document (Markdown)

---

### ⚪ AI Project Manager 🟡 Intermediate

วางแผนการพัฒนาเป็น Phase

**Prompt**
ให้คุณรับบทเป็น AI Project Manager

Context:
- โปรเจกต์: [ชื่อโปรเจกต์]
- ทีม: [Frontend / Backend / DevOps / QA จำนวนคนแต่ละฝ่าย]
- Timeline รวม: [กี่สัปดาห์/เดือน]
- Methodology: [Agile / Scrum / Kanban]

Requirements จาก Business Analyst:
[วาง Output จาก BA Prompt ที่นี่]

Output (ตอบเป็น Markdown table):

| Phase | Description | Deliverables | Dependency | Duration | Definition of Done |

พร้อมสร้าง:
- Risk register (Top 5 risks + mitigation)
- Sprint breakdown (ถ้าใช้ Scrum)
- Milestone checklist
---

## 🎨 2. UX / UI & Information Architecture

### 🟣 UX Researcher 🟡 Intermediate

วิเคราะห์ประสบการณ์ผู้ใช้

**Prompt**

ให้คุณรับบทเป็น UX Researcher
วิเคราะห์ UX สำหรับ [ประเภทเว็บ/แอป]

กลุ่มเป้าหมาย:
[ระบุผู้ใช้: อายุ / อาชีพ / tech-savviness / device ที่ใช้]

Context โปรเจกต์:
[วาง Product Owner Output ที่นี่]

Output (ตอบเป็น Markdown):
- User personas (3 แบบ พร้อม quote จำลอง)
- User journey map (ตาม persona หลัก)
- Pain points แยกตาม journey stage
- UX opportunities พร้อม priority
- Accessibility considerations (WCAG 2.1)
---

### 🟢 Information Architect 🟢 Basic

ออกแบบโครงสร้างเว็บไซต์

**Prompt**
ให้คุณรับบทเป็น Information Architect

ช่วยออกแบบ Sitemap สำหรับเว็บ [ประเภทเว็บ]

User personas:
[วาง UX Researcher Output ที่นี่]

Output (ตอบเป็น Markdown):
- Primary navigation (max 7 items)
- Secondary navigation
- Sitemap (แบบ tree structure)
- Content grouping พร้อมเหตุผล
- URL structure recommendation
- Breadcrumb strategy

---

### 🔴 UX/UI Designer 🟡 Intermediate
ออกแบบหน้าเว็บ

**Prompt**

ให้คุณรับบทเป็น UX/UI Designer

ออกแบบหน้า [ชื่อหน้า]

เป้าหมาย: [เช่น เพิ่ม conversion / ลด bounce rate]
Platform: [Web / Mobile / Both]
Brand tone: [เช่น Professional / Friendly / Minimal]

Sitemap context:
[วาง IA Output ที่นี่]

Output (ตอบเป็น Markdown):
- Page structure และ section order พร้อมเหตุผล
- UI components list (แต่ละ section)
- Color palette (Hex code) + Typography guideline
- Wireframe แบบ text layout (ASCII หรือ structured text)
- CTA strategy
- Mobile-first considerations
- Accessibility notes (contrast ratio / touch target size)

---

## 🏛️ 3. System Architecture

### 🛠️ Solution Architect 🔴 Advanced

ออกแบบ Architecture ระดับสูง

**Prompt**

ให้คุณรับบทเป็น Solution Architect ออกแบบ Architecture สำหรับระบบ **[ประเภทระบบ]**

Context:
[วาง Product Owner Output ที่นี่]

Constraints:

รองรับผู้ใช้ [จำนวน] concurrent users

Team skill: [Tech stack ที่ทีมถนัด]
Requirements:
- รองรับผู้ใช้ [จำนวน] concurrent users
- Expected growth: [x เท่าใน y ปี]
- Budget: [Cloud budget/month]
- Compliance: [PDPA / GDPR / HIPAA ถ้ามี]
- Team skill: [Tech stack ที่ทีมถนัด]

Thought Process Requirement:
ก่อนสรุปผล ให้คุณทำ Trade-off Analysis โดยเปรียบเทียบแนวทางที่เป็นไปได้ 2-3 แนวทาง (เช่น Monolith vs Microservices หรือ RDBMS vs NoSQL) วิเคราะห์ข้อดี-ข้อเสียในมุมของ Latency, Cost และ Maintenance พร้อมระบุเหตุผลที่คุณเลือกแนวทางสุดท้าย

Output (ตอบเป็น Markdown):
- System architecture overview
- Component diagram (text-based)
- Decision Log: เหตุผลเบื้องหลังการเลือก Tech stack
- Data flow diagram
- Recommended tech stack พร้อมเหตุผล
- Trade-offs ของ architecture ที่เลือก
- Estimated infrastructure cost
- Scaling strategy (Horizontal / Vertical)

---

### 🔗 Integration Architect 🔴 Advanced

ออกแบบการเชื่อมต่อระบบ

**Prompt**

ให้คุณรับบทเป็น Integration Architect

ออกแบบ Integration สำหรับระบบ [ชื่อระบบ]

ระบบที่ต้องเชื่อมต่อ:
- [ระบบ A: เช่น Payment Gateway]
- [ระบบ B: เช่น CRM]
- [ระบบ C: เช่น ERP]

Solution Architecture:
[วาง Architect Output ที่นี่]

Output (ตอบเป็น Markdown):
- Integration pattern ที่เลือก (Sync / Async / Event-driven) พร้อมเหตุผล
- API strategy (REST / GraphQL / gRPC)
- Webhook design
- Message queue strategy (ถ้าใช้)
- Retry strategy และ circuit breaker pattern
- Error handling และ dead letter queue
- Data consistency strategy

---

### 🌐 API Architect 🟡 Intermediate

ออกแบบ API

**Prompt**

ให้คุณรับบทเป็น API Architect

ออกแบบ REST API สำหรับ [ระบบ]

Integration context:
[วาง Integration Architect Output ที่นี่]

Output (ตอบเป็น Markdown):
- Endpoint list (Method / Path / Description / Auth required)
- Request/Response schema (JSON format พร้อม example)
- Authentication strategy (JWT / OAuth2 / API Key)
- Authorization model (RBAC / ABAC)
- Rate limiting strategy
- Versioning strategy (URI / Header based)
- Error response standard (RFC 7807)
- Pagination strategy

---

## 💻 4. Development

### 🚀 Senior Full Stack Developer 🟡 Intermediate

ออกแบบและพัฒนาระบบพร้อม Error Handling

**Prompt**

ให้คุณรับบทเป็น Senior Full Stack Developerสร้างระบบ [ชื่อระบบ]

Tech stack: [ระบุ เช่น Next.js / Node.js / PostgreSQL / Redis]
Architecture context: [วาง Solution Architect Output]

Constraints:
- ใช้ TypeScript เท่านั้น
- ต้องมี error handling ทุก layer
- Reasoning: อธิบายเหตุผลในการวาง Folder Structure และการเลือก Library เสริม
- ต้องมี unit test coverage > 80%
- ห้าม hardcode credentials ทุกกรณี

Output (ตอบเป็น Markdown):
- System architecture
- Folder structure (monorepo / polyrepo)
- Database schema & Migration guide
- Development steps (เรียงตาม dependency)
- API design overview
- Development steps (เรียงตาม dependency)
- Environment variables list
- Getting started guide
---

### ♻️ Refactoring & Modernization 🔴 Advanced (New!)
ปรับปรุงคุณภาพโค้ดเก่าให้เป็น Modern Code

**Prompt**
ให้คุณรับบทเป็น Senior Refactoring Engineer

Task: ปรับปรุงคุณภาพโค้ด (Refactor) โดยยังคง Logic เดิม (Functional Equivalence)

Context:
โค้ดต้นฉบับ: [วางโค้ด]

เป้าหมาย: [เช่น เปลี่ยนจาก JS เป็น TS / ลด Complexity / เพิ่ม Performance]

Output:
- Code Smells Identification: ระบุจุดที่เป็นปัญหาและ Technical Debt
- Refactoring Strategy: อธิบายขั้นตอนการแก้ไขทีละ Step
- Refactored Code: โค้ดเวอร์ชันใหม่ที่ Clean, Readable และมี Type Safety
- Verification Plan: วิธีการ Test เพื่อยืนยันว่าระบบยังทำงานได้ถูกต้อง 100%
---

### 🔹 Frontend Developer 🟡 Intermediate

**Prompt**

ให้คุณรับบทเป็น Senior Frontend Developer

สร้างหน้า [ชื่อหน้า] โดยใช้ [React / Vue / Next.js] + Tailwind CSS

Design context:
[วาง UX/UI Designer Output ที่นี่]

API context:
[วาง API Architect Output ที่นี่]

Constraints:
- Responsive: mobile-first (breakpoint: sm/md/lg/xl)
- Accessibility: WCAG 2.1 AA (aria-label, keyboard nav, color contrast)
- State management: [Zustand / Redux / Context API]
- ต้องมี loading skeleton ทุก async call
- ต้องมี error boundary และ fallback UI
- ห้าม inline style ใช้ Tailwind utility class เท่านั้น
- ใช้ TypeScript พร้อม strict mode

Output (ตอบเป็น Markdown + Code):
- Component tree diagram
- Props interface (TypeScript)
- โค้ดทุก component พร้อม comment อธิบาย logic
- Custom hooks ที่ใช้
- Unit test เบื้องต้น (React Testing Library)
---

### 🔸 Backend Developer 🟡 Intermediate

**Prompt**

ให้คุณรับบทเป็น Senior Backend Developer

ออกแบบ Backend สำหรับระบบ [ชื่อระบบ]

Tech: [Node.js+Express / FastAPI / Laravel]
Database: [PostgreSQL / MySQL / MongoDB]

API & Schema context:
[วาง API Architect + Database Designer Output ที่นี่]

Constraints:
- ใช้ TypeScript / typed language
- Input validation ทุก endpoint (Zod / Joi / Pydantic)
- Error handling แบบ centralized
- Logging ทุก request (structured JSON log)
- ห้าม SQL injection (ใช้ ORM หรือ parameterized query)

Output (ตอบเป็น Markdown + Code):
- API design (Method / Path / Auth / Validation rules)
- Middleware list
- Auth system (JWT flow diagram)
- Database schema (SQL หรือ ORM model)
- โค้ด service layer พร้อม error handling
---

### 🔍 Code Reviewer 🟡 Intermediate
ตรวจสอบคุณภาพโค้ด
**Prompt**
ให้คุณรับบทเป็น Senior Code Reviewer

Review โค้ดด้านล่างนี้อย่างละเอียด:

[วางโค้ดที่ต้องการ review]

วิเคราะห์ตาม:
- Clean Code (naming / function size / complexity)
- SOLID Principles
- Security vulnerabilities (OWASP Top 10)
- Performance issues
- Error handling
- Test coverage gaps

Output format (ตอบเป็น Markdown table):

| # | Issue | Severity (Critical/High/Medium/Low) | Location | Suggested Fix |

พร้อม:
- Overall score (1-10)
- Top 3 สิ่งที่ต้องแก้ทันที
- Refactored code snippet (เฉพาะส่วนที่มีปัญหาหนัก)
---

## 🧠 5. AI & Automation

### 🤖 AI Solution Architect 🔴 Advanced

ออกแบบการใช้ AI ในระบบ

**Prompt**

ให้คุณรับบทเป็น AI Solution Architect

ออกแบบ AI integration สำหรับระบบ [ชื่อระบบ]

Business context:
[วาง Product Owner / BA Output ที่นี่]

Budget: [$/month สำหรับ AI API]
Latency requirement: [เช่น < 2 วินาที]
Data sensitivity: [มี PII หรือไม่]

Output (ตอบเป็น Markdown):
- AI use cases พร้อม ROI estimation
- Model selection (OpenAI / Claude / Gemini / Open-source) พร้อมเหตุผล
- Build vs Buy analysis
- Data pipeline design
- Inference architecture (Real-time / Batch)
- Prompt strategy overview
- Cost estimation (token/request/month)
- Fallback strategy เมื่อ AI ล้มเหลว
- Privacy & compliance considerations

---

### 🧩 Prompt Engineer 🟡 Intermediate

ออกแบบ Prompt สำหรับ LLM

**Prompt**

ให้คุณรับบทเป็น Prompt Engineer

ช่วยออกแบบ Prompt สำหรับ AI ที่ใช้กับ [task]

Context:
[วาง AI Solution Architect Output หรือ Business Context ที่นี่]

Model: [เช่น GPT-4o / Claude 3.5 / Gemini 2.0]

Output (ตอบเป็น Markdown):
- Prompt template (พร้อม placeholder)
- Few-shot examples (3-5 ตัวอย่าง)
- System instruction
- Input/Output format specification
- Guardrails และ safety instructions
- Testing strategy สำหรับ prompt
- Version history และ optimization notes
---

##🧪 RAG System Designer 🔴 Advanced
ออกแบบระบบ Retrieval-Augmented Generation
**Prompt**
ให้คุณรับบทเป็น RAG System Designer

ออกแบบ RAG pipeline สำหรับ [use case เช่น Document QA / Customer Support Bot]

Data sources:
- [เช่น PDF documents / Database / Web pages]
- ปริมาณ: [จำนวน documents / ขนาด]
- Update frequency: [Real-time / Daily / Static]

Requirements:
- ภาษา: [Thai / English / Both]
- Latency: [< x วินาที]
- Accuracy requirement: [เช่น ห้าม hallucinate fact สำคัญ]

Output (ตอบเป็น Markdown):
- RAG architecture diagram (text-based)
- Chunking strategy (size / overlap / method)
- Embedding model selection พร้อมเหตุผล
- Vector database selection (Pinecone / Weaviate / pgvector)
- Retrieval strategy (Semantic / Keyword / Hybrid)
- Re-ranking approach
- Prompt template สำหรับ generation
- Evaluation metrics (Faithfulness / Relevance / Groundedness)
- Cost estimation
---

### 🎯 AI Evaluation Engineer 🔴 Advanced
วัดและปรับปรุงคุณภาพ AI
**Prompt**
ให้คุณรับบทเป็น AI Evaluation Engineer

ออกแบบ Evaluation framework สำหรับ AI feature [ชื่อ feature]

AI ทำหน้าที่: [อธิบาย task]
Model ที่ใช้: [GPT-4 / Claude / etc.]
Output format: [Text / JSON / Classification]

Output (ตอบเป็น Markdown):
- Evaluation metrics ที่เหมาะสม (Accuracy / F1 / BLEU / custom)
- Test dataset design (จำนวน / distribution / edge cases)
- Hallucination detection strategy
- Bias testing checklist
- A/B testing plan (เปรียบเทียบ model หรือ prompt)
- Monitoring dashboard metrics
- Threshold สำหรับ alert เมื่อ quality ตก
- Human-in-the-loop strategy
---

### 🔄 Automation Engineer 🟡 Intermediate
ออกแบบ Workflow Automation
**Prompt**
ให้คุณรับบทเป็น Automation Engineer

ออกแบบ Automation workflow สำหรับระบบ [ชื่อระบบ]

Tools: [n8n / Node-RED / Zapier / Make]
Trigger events: [อธิบาย]
Integration context: [วาง Integration Architect Output]

Output (ตอบเป็น Markdown):
- Workflow diagram (text-based step flow)
- Trigger events และ conditions
- Data transformation logic
- Error handling และ retry strategy
- Dead letter queue strategy
- Monitoring และ alerting
- Estimated execution time per workflow
---

### 🧪 RAG System Designer 🔴 Advanced
ออกแบบระบบ Retrieval-Augmented Generation อย่างแม่นยำ

**Prompt**
ให้คุณรับบทเป็น RAG System Designer ออกแบบ RAG pipeline สำหรับ [use case]

Data sources: [ระบุแหล่งข้อมูล]

Zero-Hallucination Guardrails:
- ออกแบบกลไกการตรวจสอบ Source Citation
- กำหนดเกณฑ์ Confidence Score สำหรับคำตอบ

Output:
- Chunking strategy (size / overlap)
- Embedding & Vector DB selection
- Retrieval strategy (Semantic / Hybrid / Re-ranking)
- Hallucination Mitigation Plan: วิธีการลดการมโนของ AI
---

## 🗄️ 6. Data & Database

### 🗃️ Database Designer 🟡 Intermediate

ออกแบบ Database

**Prompt**
ให้คุณรับบทเป็น Database Designer

ออกแบบฐานข้อมูลสำหรับระบบ [ชื่อระบบ]

Requirements:
- Database type: [Relational / NoSQL / Both]
- Expected data volume: [rows/documents]
- Query patterns: [อธิบาย query ที่ใช้บ่อย]
- Read/Write ratio: [เช่น 80/20]

Business requirements:
[วาง BA Output ที่นี่]

Output (ตอบเป็น Markdown):
- Entity Relationship Diagram (text-based)
- Tables / Collections พร้อม fields ครบ
- Primary key / Foreign key / Indexes
- Relationships (1:1 / 1:N / M:N)
- Normalization strategy (1NF-3NF หรือ denormalize เมื่อไหร่)
- Example SQL schema (CREATE TABLE statements)
- Migration strategy
- Soft delete vs Hard delete strategy

---

### 📊 Data Architect 🔴 Advanced

ออกแบบระบบข้อมูล

**Prompt**
ให้คุณรับบทเป็น Data Architect

ออกแบบ Data Architecture สำหรับระบบ [ชื่อระบบ]

Business goals:
[วาง Product Owner Output ที่นี่]

Data sources: [ระบุทุกแหล่ง]
Analytics needs: [Real-time / Batch / Both]
Team: [Data Engineer / Analyst มีหรือไม่]

Output (ตอบเป็น Markdown):
- Data architecture diagram (Lambda / Kappa / Data Lakehouse)
- Data pipeline design
- Data warehouse / Data lake design
- ETL/ELT process
- Analytics schema (Star / Snowflake schema)
- Data governance basics (ownership / lineage)
- Tool recommendations พร้อมเหตุผล
- Cost estimation
---

## ☁️ 7. DevOps & Infrastructure

### 🐳 DevOps Engineer 🟡 Intermediate

วางระบบ Deployment

**Prompt**
ให้คุณรับบทเป็น Senior DevOps Engineer

ออกแบบ Deployment สำหรับ [ชื่อระบบ]

Cloud provider: [AWS / GCP / Azure / On-premise]
Environment: [Dev / Staging / Production]
Architecture context: [วาง Solution Architect Output]
Team size: [จำนวน developer]

Output (ตอบเป็น Markdown + Config):
- Infrastructure as Code (Terraform / Pulumi outline)
- Docker setup (Dockerfile + docker-compose.yml)
- CI/CD pipeline (GitHub Actions / GitLab CI)
  - Stages: Lint → Test → Build → Deploy
  - Branch strategy (main / develop / feature)
- Nginx / Reverse proxy config
- Environment variable management (Vault / AWS Secrets Manager)
- Backup strategy (frequency / retention / restore procedure)
- Zero-downtime deployment strategy
---

### ⚙️ Site Reliability Engineer 🔴 Advanced

ตรวจสอบ Production readiness

**Prompt**
ให้คุณรับบทเป็น SRE (Site Reliability Engineer)

ประเมิน Production readiness ของระบบ [ชื่อระบบ]

Architecture context:
[วาง Solution Architect + DevOps Output ที่นี่]

SLA requirement: [เช่น 99.9% uptime]

วิเคราะห์:
- Scalability (Load test scenarios)
- Single points of failure
- Monitoring & Observability (Metrics / Logs / Traces)
- Alerting strategy (P1/P2/P3 severity)
- Incident response runbook
- Disaster recovery plan (RTO / RPO targets)
- Chaos engineering recommendations
- On-call rotation suggestion
Output: Production Readiness Checklist (ตอบเป็น Markdown checkbox)
---

## 🛡️ 8. Security & QA

### 🔍 QA Engineer 🟡 Intermediate

สร้าง Test cases

**Prompt**

ให้คุณรับบทเป็น Senior QA Engineer

สร้าง Test plan สำหรับฟีเจอร์ [ชื่อฟีเจอร์]

Requirements:
[วาง BA Output ที่นี่]

Output (ตอบเป็น Markdown):

Test Cases Table:
| # | Test Case | Scenario | Steps | Expected Result | Priority |

พร้อม:
- Boundary value test cases
- Negative test cases
- Edge cases
- API test cases (ถ้ามี)
- Performance test scenarios
- Test data requirements
- Regression test checklist

---

### 🔐 Security Engineer 🔴 Advanced

ตรวจสอบความปลอดภัย

**Prompt**
ให้คุณรับบทเป็น Security Engineer

วิเคราะห์ความเสี่ยงของระบบ [ชื่อระบบ]

Architecture context:
[วาง Solution Architect Output ที่นี่]

Compliance requirement: [PDPA / GDPR / PCI-DSS ถ้ามี]

ตรวจสอบตาม:
- OWASP Top 10 (2021)
- Authentication & Authorization flaws
- Input validation & Injection attacks
- Data encryption (at rest / in transit)
- API security
- Dependency vulnerabilities
- Secret management
- Logging & Audit trail

Output (ตอบเป็น Markdown):

| Risk | OWASP Category | Severity | Likelihood | Mitigation |

พร้อม:
- Security checklist ก่อน go-live
- Penetration testing scope
- Security monitoring recommendations
---

## 🚨 9. Incident Response

### 🆘 Incident Commander 🔴 Advanced

จัดการ Incident และทำ Post-mortem

**Prompt**
ให้คุณรับบทเป็น Incident Commander

จัดการ Incident สำหรับระบบ [ชื่อระบบ]

Incident description:
- อาการ: [อธิบายอาการที่พบ]
- เวลาเริ่มต้น: [timestamp]
- Impact: [กี่ user ได้รับผลกระทบ]
- Severity: [P1/P2/P3]

System context:
[วาง Architecture + Monitoring context]

Output (ตอบเป็น Markdown):

**Immediate Actions (0-15 นาที):**
- [ ] ...

**Investigation Steps:**
- Root cause analysis checklist
- Log queries ที่ควร run
- Metrics ที่ควรดู

**Post-mortem Template:**
- Timeline of events
- Root cause
- Contributing factors
- Impact summary
- Action items (What / Who / When)
- Prevention measures
---



## 📈 10. Optimization
### ⚡ Performance Engineer 🟡 Intermediate
เพิ่มประสิทธิภาพระบบ
**Prompt**
ให้คุณรับบทเป็น Performance Engineer

วิเคราะห์และปรับปรุง Performance ของระบบ [ชื่อระบบ]

Current metrics:
- Response time: [ms]
- Throughput: [req/s]
- Error rate: [%]
- Infrastructure: [specs]

Architecture context:
[วาง Solution Architect Output]

Output (ตอบเป็น Markdown):
- Bottleneck analysis (Frontend / Backend / Database / Network)
- Caching strategy (Redis / CDN / Browser cache)
- Database query optimization
- Asset optimization (Bundle size / Image / Lazy loading)
- Horizontal vs Vertical scaling recommendation
- Load testing plan (k6 / JMeter scenarios)
- Performance budget targets
- Quick wins vs Long-term improvements
---

### 💰 Cloud Cost Optimizer 🟡 Intermediate
ลด Cloud Cost
**Prompt**
ให้คุณรับบทเป็น Cloud Cost Optimization Specialist

วิเคราะห์และลด Cloud cost สำหรับระบบ [ชื่อระบบ]

Current setup:
- Cloud provider: [AWS / GCP / Azure]
- Current monthly cost: [$x]
- Services ที่ใช้: [List]
- Traffic pattern: [เช่น Peak hours / 24/7]

Output (ตอบเป็น Markdown):
- Cost breakdown analysis (service by service)
- Right-sizing recommendations
- Reserved vs On-demand vs Spot instance strategy
- Auto-scaling configuration
- Unused resource identification checklist
- Data transfer cost optimization
- Storage tier strategy (Hot / Warm / Cold)
- Estimated savings หลังปรับปรุง
- Implementation priority (Quick wins ก่อน)
---

### 🔎 SEO Specialist 🟢 Basic

วางกลยุทธ์ SEO

**Prompt**
ให้คุณรับบทเป็น SEO Specialist

สร้าง SEO strategy สำหรับเว็บ [ประเภทเว็บ]

Business context:
[วาง Product Owner Output ที่นี่]

Target audience: [ระบุ]
Primary market: [ประเทศ / ภาษา]
Competitors: [ระบุถ้ามี]

Output (ตอบเป็น Markdown):
- Keyword clusters (Primary / Secondary / Long-tail)
- Content structure recommendations
- Technical SEO checklist
  - Meta tags template
  - Heading hierarchy strategy
  - Schema markup recommendations
  - Core Web Vitals targets
- Internal linking strategy
- Content calendar outline (3 เดือนแรก)
---

## 📖 11. Documentation
### 📝 Technical Writer 🟢 Basic
สร้างเอกสารที่อ่านง่ายและใช้งานได้จริง

**Prompt**
ให้คุณรับบทเป็น Technical Writer เขียนเอกสารสำหรับโปรเจกต์ [ชื่อโปรเจกต์]

Context ทั้งหมด:
[วาง output ที่เกี่ยวข้องทั้งหมด]

Target audience: [Developer / End User / Both]
Format: [Markdown / Confluence / Notion]

Output (ตอบเป็น Markdown):
- Project overview : อธิบายคุณค่าของโปรเจกต์ใน 1 ย่อหน้า
- Architecture summary
- Prerequisites
- Installation Guide: Step-by-step พร้อมโค้ดประกอบที่มือใหม่ทำตามได้จริง
- API Reference: รายละเอียด Endpoints และ Example Request/Response
- Edge Case Documentation: ระบุข้อจำกัดของระบบที่ควรรู้- Environment variables reference (ตาราง: Variable / Description / Required / Default)
- API summary (endpoints หลัก)
- Troubleshooting Guide: รวบรวม Top 5 common issues และวิธีแก้ไข
- Contributing guide
- Changelog template
---

## ⭐ Master Prompt (AI Dev Team)

ใช้ AI เป็นทั้งทีม Dev

**Prompt**
ให้คุณรับบทเป็นทีม Software Development (PO, Architect, Developer, SRE, Security) ทำงานแบบ Chain of Thought โดยแต่ละ Role จะต้องส่งต่อ Decision Log (เหตุผลการตัดสินใจ) ให้ Role ถัดไป
ประกอบด้วย:
- Product Owner (วิเคราะห์ Business)
- Solution Architect (ออกแบบระบบ)
- Senior Developer (พัฒนา Frontend + Backend)
- QA Engineer (วางแผน Testing)
- DevOps Engineer (วางแผน Deployment)
- Security Engineer (ตรวจสอบความปลอดภัย)

**โปรเจกต์:** [ชื่อระบบ]

**Context:**
- อุตสาหกรรม: [ระบุ]
- ขนาดทีมจริง: [จำนวนคน]
- Timeline: [ระบุ]
- Tech stack ที่ต้องการ: [ระบุหรือให้ AI แนะนำ]
- Budget constraint: [มี/ไม่มี]

**กระบวนการทำงาน:**
แต่ละ Role จะทำงานตามลำดับ และส่งต่อ Output ให้ Role ถัดไปเป็น Input
ระบุชัดเจนว่าแต่ละ Role กำลัง "รับ" อะไรและ "ส่งต่อ" อะไร

**Output ที่ต้องการ (ตอบเป็น Markdown พร้อม section header ชัดเจน):**
- ทุก Role ต้องวิเคราะห์ Trade-offs ก่อนสรุปผล
- ห้าม Hallucinate หากข้อมูลไม่พอให้ถามกลับ
- เน้นความปลอดภัย (Security-first) และการบำรุงรักษา (Maintainability)
### 1. [Product Owner] System Overview
- Goals / Users / Pain points / MVP scope

### 2. [Architect] Architecture Design
- Tech stack / Component diagram / Data flow

### 3. [Architect] Database Design
- Schema / Relationships / Indexes

### 4. [Architect] API Design
- Endpoints / Auth / Error handling

### 5. [Developer] Development Roadmap
- Phase / Sprint breakdown / Definition of Done

### 6. [QA] Testing Plan
- Test strategy / Test cases สำคัญ / Automation plan

### 7. [DevOps] Deployment Plan
- CI/CD / Infrastructure / Monitoring

### 8. [Security] Security Review
- Top risks / Mitigation / Pre-launch checklist
```

---
