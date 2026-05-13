# TypeScript Rules (v1.9.0)

## Core Standards

- **Strict Mode** — all strict checks enforced.
- **ZERO `any` types** — use proper types or `unknown` + narrowing.
- **ZERO `console.log`** — use NestJS `Logger` (backend) or remove before commit (frontend).
- **English for Code** — use English for all code identifiers, variables, and logic.
- **Thai for Comments** — use Thai for comments, documentation, and JSDoc.
- **Explicit Typing** — explicitly define types for all variables, parameters, and return values.
- **JSDoc** — use JSDoc for all public classes and methods (in **Thai**).

## File & Function Structure

- **File Headers** — every file MUST start with `// File: path/filename` on the first line.
- **Change Log** — include `// Change Log` at the top of the file.
- **Single Export** — export **only one main symbol** per file.
- **Function Style** — avoid unnecessary blank lines inside functions.

## Patterns

```typescript
// ✅ CORRECT
// File: src/example.service.ts
// Change Log:
// - 2026-05-13: Initial creation

/**
 * บริการตัวอย่างสำหรับ LCBP3
 */
export class ExampleService {
  public doSomething(data: string): boolean {
    return data.length > 0;
  }
}
```
