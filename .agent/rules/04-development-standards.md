---
trigger: always_on
---

# 📐 TypeScript Rules

- **Strict Mode** — all strict checks enforced
- **ZERO `any` types** — use proper types or `unknown` + narrowing
- **ZERO `console.log`** — NestJS `Logger` (backend); remove before commit (frontend)

## 🏷️ Domain Terminology (Thai Comments, English Code)

| ✅ Use             | ❌ Don't Use                          |
| ------------------ | ------------------------------------- |
| Correspondence     | Letter, Communication, Document       |
| RFA                | Approval Request, Submit for Approval |
| Workflow Engine    | Approval Flow, Process Engine         |
| Document Numbering | Document ID, Auto Number              |

## 🔄 Development Flow (Tiered)

- **🔴 Critical (DB/API/Security):** MUST follow all Context Protocol steps.
- **🟡 Normal (UI/Feature):** Follow existing patterns, check spec for relevant module.
- **🟢 Quick Fix:** Fix directly, check forbidden patterns before commit.
