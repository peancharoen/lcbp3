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
