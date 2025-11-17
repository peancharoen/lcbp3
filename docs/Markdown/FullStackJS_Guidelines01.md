# FullStackJS Development Guidelines

## 🧠 General Philosophy

Unified best practices for **NestJS Backend**, **NextJS Frontend**, and **Bootstrap-based UI/UX** development in TypeScript environments.  
Focus on **clarity**, **maintainability**, **consistency**, and **accessibility** across the entire stack.

---

## ⚙️ TypeScript General Guidelines

### Basic Principles
- Use **English** for all code and documentation.
- Explicitly type all variables, parameters, and return values.
- Avoid `any`; create custom types or interfaces.
- Use **JSDoc** for public classes and methods.
- Export only **one main symbol** per file.
- Avoid blank lines within functions.

### Naming Conventions
| Entity | Convention | Example |
|:--|:--|:--|
| Classes | PascalCase | `UserService` |
| Variables & Functions | camelCase | `getUserInfo` |
| Files & Folders | kebab-case | `user-service.ts` |
| Environment Variables | UPPERCASE | `DATABASE_URL` |
| Booleans | Verb + Noun | `isActive`, `canDelete`, `hasPermission` |

Use full words — no abbreviations — except for standard ones (`API`, `URL`, `req`, `res`, `err`, `ctx`).

---

## 🧩 Functions

- Write short, single-purpose functions (<20 lines).
- Use **early returns** to reduce nesting.
- Use **map**, **filter**, **reduce** instead of loops when suitable.
- Prefer **arrow functions** for short logic, **named functions** otherwise.
- Use **default parameters** over null checks.
- Group multiple parameters into a single object (RO-RO pattern).
- Return typed objects, not primitives.
- Maintain a single abstraction level per function.

---

## 🧱 Data Handling

- Encapsulate data in composite types.
- Use **immutability** with `readonly` and `as const`.
- Perform validations in classes or DTOs, not within business functions.
- Always validate data using typed DTOs.

---

## 🧰 Classes

- Follow **SOLID** principles.
- Prefer **composition over inheritance**.
- Define **interfaces** for contracts.
- Keep classes focused and small (<200 lines, <10 methods, <10 properties).

---

## 🚨 Error Handling

- Use exceptions for unexpected errors.
- Catch only to fix or add context; otherwise, use global error handlers.
- Always provide meaningful error messages.

---

## 🧪 Testing (General)

- Use the **Arrange–Act–Assert** pattern.
- Use descriptive test variable names (`inputData`, `expectedOutput`).
- Write **unit tests** for all public methods.
- Mock external dependencies.
- Add **acceptance tests** per module using Given–When–Then.

---

# 🏗️ Backend (NestJS)

### Principles
- **Modular architecture**:
  - One module per domain.
  - Controller → Service → Model structure.
- DTOs validated with **class-validator**.
- Use **MikroORM** or equivalent for persistence.
- Encapsulate reusable code in a **common module** (`@app/common`):
  - Configs, decorators, DTOs, guards, interceptors, notifications, shared services, types, validators.

### Core Functionalities
- Global **filters** for exception handling.
- **Middlewares** for request handling.
- **Guards** for permissions and RBAC.
- **Interceptors** for response transformation and logging.

### Testing
- Use **Jest** for testing.
- Test each controller and service.
- Add `admin/test` endpoint as a smoke test.

---

# 🖥️ Frontend (NextJS / React)

### Developer Profile
Senior-level TypeScript + React/NextJS engineer.  
Expert in **TailwindCSS**, **Shadcn/UI**, and **Radix** for UI development.

### Code Implementation Guidelines
- Use **early returns** for clarity.
- Always style with **TailwindCSS** classes.
- Prefer `class:` conditional syntax over ternary operators.
- Use **const arrow functions** for components and handlers.
- Event handlers start with `handle...` (e.g., `handleClick`, `handleSubmit`).
- Include accessibility attributes:  
  `tabIndex="0"`, `aria-label`, `onKeyDown`, etc.
- Ensure all code is **complete**, **tested**, and **DRY**.
- Always import required modules explicitly.

### UI/UX with React
- Use **semantic HTML**.
- Apply **responsive Tailwind** classes.
- Maintain visual hierarchy with typography and spacing.
- Use **Shadcn** components for consistent UI.
- Keep components small and focused.

---

# 🎨 UI/UX (Bootstrap Integration)

### Key Principles
- Use **Bootstrap 5+** for responsive design and consistent UI.
- Focus on **maintainability**, **readability**, and **accessibility**.
- Use clear and descriptive class names.

### Bootstrap Usage
- Structure layout with **container**, **row**, **col**.
- Use built-in **components** (buttons, modals, alerts, etc.) instead of custom CSS.
- Apply **utility classes** for quick styling (spacing, colors, text, etc.).
- Ensure **ARIA compliance** and semantic markup.

### Form Validation & Errors
- Use Bootstrap’s built-in validation states.
- Show errors with **alert components**.
- Include labels, placeholders, and feedback messages.

### Dependencies
- Bootstrap (latest CSS + JS)
- Optionally jQuery (for legacy interactive components)

### Bootstrap-Specific Guidelines
- Customize Bootstrap via **Sass variables** and **mixins**.
- Use responsive visibility utilities.
- Avoid overriding Bootstrap; extend it.
- Follow official documentation for examples.

### Performance Optimization
- Include only necessary Bootstrap modules.
- Use CDN for assets and caching.
- Optimize images and assets for mobile.

### Key Conventions
1. Follow Bootstrap’s naming and structure.
2. Prioritize **responsiveness** and **accessibility**.
3. Keep the file structure organized and modular.

---

# 🔗 Full Stack Integration Guidelines

| Aspect | Backend (NestJS) | Frontend (NextJS) | UI Layer (Bootstrap/Tailwind) |
|:--|:--|:--|:--|
| API | REST / GraphQL Controllers | API hooks via fetch/axios | Components consuming data |
| Validation | `class-validator` DTOs | `zod` / form-level validation | Bootstrap validation feedback |
| Auth | Guards, JWT | NextAuth / cookies | Auth UI states |
| Errors | Global filters | Toasts / modals | Alerts / feedback |
| Testing | Jest (unit/e2e) | Vitest / Playwright | Visual regression |
| Styles | Scoped modules | Tailwind / Shadcn | Bootstrap utilities |
| Accessibility | Guards + filters | ARIA attributes | Semantic HTML |

---

# ✅ Final Notes

- Use a **shared types package** (`@types/shared`) for consistent interfaces.
- Document your modules and APIs.
- Run lint, type-check, and tests before commit.
- Use **Prettier + ESLint** for consistent formatting.
- Prefer **clarity over cleverness** — readable code wins.


---

# 🗂️ DMS-Specific Conventions (Document Management System)

This section extends the general FullStackJS guidelines for projects similar to **np‑dms.work**, focusing on document approval workflows (RFA, Drawing, Contract, Revision, Transmittal, Report).

## 🧱 Backend Domain Modules

Use modular domain structure per document type:

```
src/
 ├─ modules/
 │   ├─ rfas/
 │   ├─ drawings/
 │   ├─ contracts/
 │   ├─ transmittals/
 │   ├─ audit-log/
 │   ├─ users/
 │   └─ common/
```

### Naming Convention
| Entity | Example |
|:--|:--|
| Table | `rfa_revisions`, `drawing_contracts` |
| DTO | `CreateRfaDto`, `UpdateContractDto` |
| Controller | `rfas.controller.ts` |
| Service | `rfas.service.ts` |

---

## 🧩 RBAC & Permission Control

Use decorators to enforce access rights:

```ts
@RequirePermission('rfa.update')
@Put(':id')
updateRFA(@Param('id') id: string) {
  return this.rfaService.update(id);
}
```

### Roles
- **Admin**: Full access to all modules.
- **Editor**: Modify data within assigned modules.
- **Viewer**: Read‑only access.

### Permissions
- `rfa.create`, `rfa.update`, `rfa.delete`, `rfa.view`
- `drawing.upload`, `drawing.map`, `drawing.view`
- `contract.assign`, `contract.view`

Seed mapping between roles and permissions via seeder scripts.

---

## 🧾 AuditLog Standard

Log all CRUD and mapping operations:

| Field | Description |
|:--|:--|
| `actor_id` | user performing the action |
| `module_name` | e.g. `rfa`, `drawing` |
| `action` | `create`, `update`, `delete`, `map` |
| `target_id` | primary id of the record |
| `timestamp` | UTC timestamp |
| `description` | contextual note |

Example implementation:

```ts
await this.auditLogService.log({
  actorId: user.id,
  moduleName: 'rfa',
  action: 'update',
  targetId: rfa.id,
  description: `Updated revision ${rev}`,
});
```

---

## 📂 File Handling

### File Upload Standard
- Upload path: `/storage/{year}/{month}/`
- File naming: `{drawing_code}_{revision}_{timestamp}.pdf`
- Allowed types: `pdf, dwg, docx, xlsx, zip`
- Max size: **50 MB**
- Store outside webroot.
- Serve via secure endpoint `/files/:id/download`.

### Access Control
Each file download must verify user permission (`hasPermission('drawing.view')`).

---

## 📊 Reporting & Exports

| Report | Description |
|:--|:--|
| **Report A** | RFA → Drawings → All Drawing Revisions |
| **Report B** | RFA Revision Timeline vs Drawing Revision |
| **Dashboard KPI** | RFAs, Drawings, Revisions, Transmittals summary |

### Export Rules
- Export formats: CSV, Excel, PDF.
- Provide print view.
- Include source entity link (e.g., `/rfas/:id`).

---

## 🧮 Frontend: DataTable & Form Patterns

### DataTable (Server‑Side)
- Endpoint: `/api/{module}?page=1&pageSize=20`
- Must support: pagination, sorting, search, filters.
- Always display latest revision inline (for RFA/Drawing).

### Form Standards
- Dependent dropdowns:
  - Contract → Subcategory
  - RFA → Related Drawing
- File upload: preview + validation.
- Submit via API with toast feedback.

---

## 🧭 Dashboard & Activity Feed

### Dashboard Cards
- Show latest RFA, Drawing, Transmittal, KPI summary.
- Include quick links to modules.

### Activity Feed
- Display recent AuditLog actions (10 latest).

```ts
// Example response
[
  { user: 'admin', action: 'Updated RFA 023-Rev02', time: '2025‑11‑04T09:30Z' }
]
```

---

## ✅ Integration Summary

| Aspect | Backend | Frontend | Description |
|:--|:--|:--|
| **File Handling** | Secure storage, token check | Upload/Preview UI | Consistent standard path |
| **RBAC** | `RequirePermission` guard | Hide/disable UI actions | Unified permission logic |
| **AuditLog** | Persist actions | Show in dashboard | Traceable user activity |
| **Reports** | Aggregation queries | Export + Print | Consistent data pipeline |
| **DataTables** | Server‑side paging | Filter/Search UI | Scalable dataset management |

---

## 🧩 Recommended Enhancements

- ✅ Add `deleted_at` for soft delete + restore.
- ✅ Fulltext search + date filters.
- ✅ Background job for RFA deadline reminders.
- ✅ Optimize DB with indexes on `rfa_id`, `drawing_id`, `contract_id`.
- ✅ Periodic cleanup for unused file uploads.

---
