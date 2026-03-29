---
always_on: true
---

# TypeScript Rules

## Strict Requirements

- **Strict Mode** — all strict checks enforced
- **ZERO `any` types** — use proper types or `unknown` + narrowing
- **ZERO `console.log`** — NestJS `Logger` (backend); remove before commit (frontend)

## Comment Language Policy

- **Comments:** Thai (เข้าใจง่ายสำหรับทีมไทย)
- **Code Identifiers:** English (variables, functions, classes)

## Error Handling Pattern

```typescript
// Backend (NestJS)
import { Logger } from '@nestjs/common';
const logger = new Logger('ServiceName');

// Use logger instead of console.log
logger.error('Error message', error.stack);
throw new HttpException('Message', HttpStatus.BAD_REQUEST);

// Frontend (Next.js)
// Remove all console.log before commit
// Use proper error boundaries and toast notifications
```
