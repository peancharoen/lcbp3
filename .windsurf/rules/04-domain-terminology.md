---
trigger: always_on
---

# Domain Terminology

## DMS Glossary

| ✅ Use             | ❌ Don't Use                          |
| ------------------ | ------------------------------------- |
| Correspondence     | Letter, Communication, Document       |
| RFA                | Approval Request, Submit for Approval |
| Transmittal        | Delivery Note, Cover Letter           |
| Circulation        | Distribution, Routing                 |
| Shop Drawing       | Construction Drawing                  |
| Contract Drawing   | Design Drawing, Blueprint             |
| Workflow Engine    | Approval Flow, Process Engine         |
| Document Numbering | Document ID, Auto Number              |
| RBAC               | Permission System (generic)           |

## Full Glossary

`specs/00-overview/00-02-glossary.md`

## Key Spec Files Priority

Spec priority: **`06-Decision-Records`** > **`05-Engineering-Guidelines`** > others

| Document                | Path                                                              | Use When                        |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------- |
| **Glossary**            | `specs/00-overview/00-02-glossary.md`                             | Verify domain terminology       |
| **Schema Tables**       | `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`     | Before writing any query        |
| **Data Dictionary**     | `specs/03-Data-and-Storage/03-01-data-dictionary.md`              | Field meanings + business rules |
| **Edge Cases**          | `specs/01-Requirements/01-06-edge-cases-and-rules.md`             | Prevent bugs in flows           |
| **ADR-019 UUID**        | `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md` | UUID-related work               |
| **ADR-023 AI**          | `specs/06-Decision-Records/ADR-023-unified-ai-architecture.md`    | AI integration work             |
| **Backend Guidelines**  | `specs/05-Engineering-Guidelines/05-02-backend-guidelines.md`     | NestJS patterns                 |
| **Frontend Guidelines** | `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md`    | Next.js patterns                |
| **Testing Strategy**    | `specs/05-Engineering-Guidelines/05-04-testing-strategy.md`       | Coverage goals                  |
