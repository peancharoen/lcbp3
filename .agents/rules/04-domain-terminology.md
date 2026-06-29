# Domain Terminology

## DMS Glossary

| ✅ Use             | ❌ Don't Use                          | คำอธิบายเพิ่มเติม                                |
| ------------------ | ------------------------------------- | ------------------------------------------------ |
| Correspondence     | Letter, Communication, Document       | ครอบคลุมทุกประเภท: Letter, RFA, Memo, ฯลฯ        |
| RFA                | Approval Request, Submit for Approval | เอกสารขออนุมัติ (ชนิดหนึ่งของ Correspondence)    |
| Transmittal        | Delivery Note, Cover Letter           | เอกสารนำส่ง (ชนิดหนึ่งของ Correspondence)        |
| Circulation        | Distribution, Routing                 | ใบเวียนเอกสารภายใน (ชนิดหนึ่งของ Correspondence) |
| Shop Drawing       | Construction Drawing                  | แบบก่อสร้าง                                      |
| Contract Drawing   | Design Drawing, Blueprint             | แบบคู่สัญญา                                      |
| Workflow Engine    | Approval Flow, Process Engine         | เครื่องมือจัดการลำดับงาน                         |
| Document Numbering | Document ID, Auto Number              | ระบบจัดการเลขที่เอกสาร                           |
| RBAC               | Permission System (generic)           | การควบคุมสิทธิ์ตามบทบาท                          |

## Full Glossary

`specs/00-overview/00-02-glossary.md`

## Key Spec Files Priority

Spec priority: **`06-Decision-Records`** > **`05-Engineering-Guidelines`** > others

| Document                       | Path                                                                        | Use When                          |
| ------------------------------ | --------------------------------------------------------------------------- | --------------------------------- |
| **Glossary**                   | `specs/00-overview/00-02-glossary.md`                                       | Verify domain terminology         |
| **Schema Tables**              | `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`               | Before writing any query          |
| **Data Dictionary**            | `specs/03-Data-and-Storage/03-01-data-dictionary.md`                        | Field meanings + business rules   |
| **Edge Cases**                 | `specs/01-Requirements/01-06-edge-cases-and-rules.md`                       | Prevent bugs in flows             |
| **ADR-019 UUID**               | `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md`           | UUID-related work                 |
| **ADR-023 AI**                 | `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md`              | AI integration work               |
| **ADR-023A AI Model**          | `specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md`             | 2-model stack, BullMQ 2-queue     |
| **ADR-024 Intent Class.**      | `specs/06-Decision-Records/ADR-024-intent-classification-strategy.md`       | Pattern→LLM Fallback; Redis cache |
| **ADR-025 AI Tool Layer**      | `specs/06-Decision-Records/ADR-025-ai-tool-layer-architecture.md`           | Tool Registry; CASL-guarded       |
| **ADR-026 Chat UI**            | `specs/06-Decision-Records/ADR-026-document-chat-ui-pattern.md`             | Side-panel; streaming SSE         |
| **ADR-027 AI Admin Console**   | `specs/06-Decision-Records/ADR-027-ai-admin-console-and-dynamic-control.md` | Dynamic control; admin-only       |
| **ADR-028 Migration Refactor** | `specs/06-Decision-Records/ADR-028-migration-architecture-refactor.md`      | Staging Queue; cleanup            |
| **Backend Guidelines**         | `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md`               | NestJS patterns                   |
| **Frontend Guidelines**        | `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md`              | Next.js patterns                  |
| **Testing Strategy**           | `specs/05-Engineering-Guidelines/05-04-testing-strategy.md`                 | Coverage goals                    |
