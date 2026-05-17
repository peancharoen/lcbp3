---
name: security-review
description: Comprehensive security review for LCBP3-DMS with OWASP Top 10 checklist, ADR compliance, and automated security testing patterns.
version: 1.9.0
scope: security
depends-on: []
handoffs-to: [speckit-reviewer, speckit-security-audit]
user-invocable: true
---

# Security Review Skill

Comprehensive security review for LCBP3-DMS ensuring all code follows security best practices and identifies potential vulnerabilities.

## LCBP3 Context

See [`_LCBP3-CONTEXT.md`](../_LCBP3-CONTEXT.md) for project-specific security requirements:
- **ADR-016**: Security & Authentication (JWT, CASL, RBAC, file upload)
- **ADR-018**: AI Boundary (Ollama on Admin Desktop only, no direct DB/storage access)
- **ADR-019**: UUID Strategy (no parseInt/Number/+ on UUID)
- **ADR-023**: Unified AI Architecture (AI via DMS API only)
- **ADR-007**: Error Handling (layered error classification)

## When to Activate

Invoke this skill:
- Implementing authentication or authorization
- Handling user input or file uploads
- Creating new API endpoints
- Working with secrets or credentials
- Integrating AI features (Ollama/Qdrant)
- Storing or transmitting sensitive data
- Integrating third-party APIs

## Security Checklist

### 1. Secrets Management

#### FAIL: NEVER Do This
```typescript
const apiKey = "sk-proj-xxxxx"  // Hardcoded secret
const dbPassword = "password123" // In source code
```

#### PASS: ALWAYS Do This
```typescript
const apiKey = process.env.OPENAI_API_KEY
const dbUrl = process.env.DATABASE_URL

// Verify secrets exist
if (!apiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}
```

#### Verification Steps
- [ ] No hardcoded API keys, tokens, or passwords
- [ ] All secrets in environment variables
- [ ] `.env.local` in .gitignore
- [ ] No secrets in git history
- [ ] Production secrets in QNAP docker-compose environment section (not .env files)

### 2. Input Validation

#### Always Validate User Input
```typescript
import { z } from 'zod'

// Define validation schema
const CreateCorrespondenceSchema = z.object({
  subject: z.string().min(1).max(500),
  recipientId: z.string().uuid(),
  typeCode: z.string().min(1).max(50)
})

// Validate before processing
export async function createCorrespondence(input: unknown) {
  try {
    const validated = CreateCorrespondenceSchema.parse(input)
    return await correspondenceService.create(validated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new BadRequestException(error.errors)
    }
    throw error
  }
}
```

#### File Upload Validation (ADR-016)
```typescript
function validateFileUpload(file: Express.Multer.File) {
  // Size check (50MB max per ADR-016)
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    throw new BadRequestException('File too large (max 50MB)')
  }

  // Type check (whitelist: PDF, DWG, DOCX, XLSX, ZIP)
  const allowedTypes = [
    'application/pdf',
    'application/vnd.dwg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
  if (!allowedTypes.includes(file.mimetype)) {
    throw new BadRequestException('Invalid file type')
  }

  // Extension check
  const allowedExtensions = ['.pdf', '.dwg', '.docx', '.xlsx', '.zip']
  const extension = path.extname(file.originalname).toLowerCase()
  if (!allowedExtensions.includes(extension)) {
    throw new BadRequestException('Invalid file extension')
  }

  return true
}
```

#### Verification Steps
- [ ] All user inputs validated with Zod (frontend) + class-validator (backend)
- [ ] File uploads restricted (50MB max, whitelist types)
- [ ] No direct use of user input in queries
- [ ] Whitelist validation (not blacklist)
- [ ] Error messages don't leak sensitive info

### 3. SQL Injection Prevention

#### FAIL: NEVER Concatenate SQL
```typescript
// DANGEROUS - SQL Injection vulnerability
const query = `SELECT * FROM correspondences WHERE uuid = '${correspondenceUuid}'`
await this.connection.query(query)
```

#### PASS: ALWAYS Use TypeORM Parameterized Queries
```typescript
// Safe - TypeORM parameterized query
const correspondence = await this.correspondenceRepository.findOne({
  where: { publicId: correspondenceUuid }
})

// Or with QueryBuilder
const result = await this.correspondenceRepository
  .createQueryBuilder('c')
  .where('c.publicId = :uuid', { uuid: correspondenceUuid })
  .getOne()
```

#### Verification Steps
- [ ] All database queries use TypeORM parameterized queries
- [ ] No string concatenation in SQL
- [ ] TypeORM query builder used correctly
- [ ] Schema verified before writing queries (ADR-009)

### 4. Authentication & Authorization (ADR-016)

#### JWT Token Handling
```typescript
// FAIL: WRONG: localStorage (vulnerable to XSS)
localStorage.setItem('token', token)

// PASS: CORRECT: httpOnly cookies
response.setHeader('Set-Cookie',
  `token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
)
```

#### Authorization Checks (CASL)
```typescript
// Controller with CASL guard
@Post()
@UseGuards(JwtAuthGuard, RolesGuard, AbilitiesGuard)
@CheckAbilities({ action: 'create', subject: 'Correspondence' })
async create(@Body() dto: CreateCorrespondenceDto, @Request() req) {
  // Service logic
}
```

#### RBAC Matrix (ADR-016)
- [ ] 4-Level RBAC matrix implemented (Admin, Manager, User, Viewer)
- [ ] CASL AbilityFactory configured with correct permissions
- [ ] JwtAuthGuard on all protected routes
- [ ] RolesGuard for role-based access
- [ ] AuditLogInterceptor on all mutation endpoints

#### Verification Steps
- [ ] Tokens stored in httpOnly cookies (not localStorage)
- [ ] Authorization checks before sensitive operations
- [ ] CASL abilities configured correctly
- [ ] Role-based access control implemented
- [ ] Session management secure

### 5. XSS Prevention

#### Sanitize HTML
```typescript
import DOMPurify from 'isomorphic-dompurify'

// ALWAYS sanitize user-provided HTML
function renderUserContent(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p'],
    ALLOWED_ATTR: []
  })
  return <div dangerouslySetInnerHTML={{ __html: clean }} />
}
```

#### Content Security Policy (Next.js)
```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self';
      connect-src 'self' http://localhost:3001 https://192.168.10.8;
    `.replace(/\s{2,}/g, ' ').trim()
  }
]
```

#### Verification Steps
- [ ] User-provided HTML sanitized
- [ ] CSP headers configured
- [ ] No unvalidated dynamic content rendering
- [ ] React's built-in XSS protection used

### 6. CSRF Protection

#### CSRF Tokens
```typescript
import { csrf } from '@/lib/csrf'

export async function POST(request: Request) {
  const token = request.headers.get('X-CSRF-Token')

  if (!csrf.verify(token)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  // Process request
}
```

#### SameSite Cookies
```typescript
response.setHeader('Set-Cookie',
  `session=${sessionId}; HttpOnly; Secure; SameSite=Strict`
)
```

#### Verification Steps
- [ ] CSRF tokens on state-changing operations
- [ ] SameSite=Strict on all cookies
- [ ] Double-submit cookie pattern implemented

### 7. Rate Limiting (ADR-016)

#### API Rate Limiting
```typescript
import { ThrottlerGuard } from '@nestjs/throttler'

// Apply to auth endpoints
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
async login(@Body() dto: LoginDto) {
  // Login logic
}
```

#### Expensive Operations
```typescript
// Aggressive rate limiting for AI endpoints
@Throttle({ default: { limit: 5, ttl: 60000 } })
async extractMetadata(@Body() dto: ExtractMetadataDto) {
  // AI extraction logic
}
```

#### Verification Steps
- [ ] Rate limiting on all auth endpoints (ADR-016)
- [ ] Rate limiting on AI endpoints (ADR-018/023)
- [ ] IP-based rate limiting
- [ ] User-based rate limiting (authenticated)

### 8. Sensitive Data Exposure

#### Logging
```typescript
// FAIL: WRONG: Logging sensitive data
this.logger.log('User login:', { email, password })
this.logger.log('Payment:', { cardNumber, cvv })

// PASS: CORRECT: Redact sensitive data
this.logger.log('User login:', { email, userId })
this.logger.log('Payment:', { last4: card.last4, userId })
```

#### Error Messages (ADR-007)
```typescript
// FAIL: WRONG: Exposing internal details
catch (error) {
  return { error: error.message, stack: error.stack }
}

// PASS: CORRECT: Generic error messages
catch (error) {
  this.logger.error('Internal error:', error)
  throw new BadRequestException('An error occurred. Please try again.')
}
```

#### Verification Steps
- [ ] No passwords, tokens, or secrets in logs
- [ ] Error messages generic for users
- [ ] Detailed errors only in server logs
- [ ] No stack traces exposed to users

### 9. AI Boundary Enforcement (ADR-018/023)

#### FAIL: NEVER Do This
```typescript
// Direct AI access - FORBIDDEN
import ollama from 'ollama'
const response = await ollama.chat({ model: 'gemma4', messages })

// Direct Qdrant access - FORBIDDEN
import { QdrantClient } from '@qdrant/js-client-rest'
const client = new QdrantClient({ url: 'http://localhost:6333' })
```

#### PASS: ALWAYS Do This
```typescript
// AI via DMS API only
const response = await fetch('http://localhost:3001/api/ai/extract-metadata', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ documentId })
})

// Qdrant via DMS API only
const response = await fetch('http://localhost:3001/api/ai/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, projectPublicId })
})
```

#### Verification Steps
- [ ] AI processing on Admin Desktop only (Desk-5439)
- [ ] No direct Ollama calls from backend/frontend
- [ ] No direct Qdrant calls from backend/frontend
- [ ] All AI interactions via DMS API endpoints
- [ ] AI audit logging implemented (ADR-020)
- [ ] Human-in-the-loop validation for AI outputs

### 10. UUID Handling (ADR-019)

#### FAIL: NEVER Do This
```typescript
// parseInt on UUID - FORBIDDEN
const projectId = parseInt(projectUuid) // "0195..." → 19 (WRONG!)

// Number on UUID - FORBIDDEN
const projectId = Number(projectUuid)

// + operator on UUID - FORBIDDEN
const projectId = +projectUuid

// id ?? '' fallback - FORBIDDEN
const value = c.publicId ?? c.id ?? ''
```

#### PASS: ALWAYS Do This
```typescript
// Use UUID string directly
const projectId = projectUuid // "019505a1-7c3e-7000-8000-abc123def456"

// Backend: findOneByUuid returns entity with publicId
const project = await this.projectService.findOneByUuid(projectUuid)
const projectId = project.id // Internal INT for DB operations

// Frontend: use publicId only
interface ProjectOption {
  publicId?: string; // No uuid fallback
  projectName?: string;
}
const value = c.publicId // "019505a1-7c3e-7000-8000-abc123def456"
```

#### Verification Steps
- [ ] No `parseInt()` on UUID values
- [ ] No `Number()` on UUID values
- [ ] No `+` operator on UUID values
- [ ] No `id ?? ''` fallback patterns
- [ ] Use `publicId` (string UUID) in API responses
- [ ] Internal INT `id` marked with `@Exclude()` in entities

### 11. Dependency Security

#### Regular Updates
```bash
# Check for vulnerabilities
pnpm audit

# Fix automatically fixable issues
pnpm audit fix

# Update dependencies
pnpm update

# Check for outdated packages
pnpm outdated
```

#### Lock Files
```bash
# ALWAYS commit lock files
git add pnpm-lock.yaml

# Use in CI/CD for reproducible builds
pnpm install --frozen-lockfile
```

#### Verification Steps
- [ ] Dependencies up to date
- [ ] No known vulnerabilities (pnpm audit clean)
- [ ] Lock files committed
- [ ] Regular security updates

## Security Testing

### Automated Security Tests

```typescript
// Test authentication
test('requires authentication', async () => {
  const response = await fetch('/api/correspondences')
  expect(response.status).toBe(401)
})

// Test authorization
test('requires admin role', async () => {
  const response = await fetch('/api/admin/users', {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  expect(response.status).toBe(403)
})

// Test input validation
test('rejects invalid input', async () => {
  const response = await fetch('/api/correspondences', {
    method: 'POST',
    body: JSON.stringify({ subject: '', recipientId: 'invalid' })
  })
  expect(response.status).toBe(400)
})

// Test rate limiting
test('enforces rate limits', async () => {
  const requests = Array(11).fill(null).map(() =>
    fetch('/api/auth/login', { method: 'POST' })
  )

  const responses = await Promise.all(requests)
  const tooManyRequests = responses.filter(r => r.status === 429)

  expect(tooManyRequests.length).toBeGreaterThan(0)
})
```

## Pre-Deployment Security Checklist

Before ANY production deployment:

- [ ] **Secrets**: No hardcoded secrets, all in env vars
- [ ] **Input Validation**: All user inputs validated (Zod + class-validator)
- [ ] **SQL Injection**: All queries parameterized (TypeORM)
- [ ] **XSS**: User content sanitized
- [ ] **CSRF**: Protection enabled
- [ ] **Authentication**: Proper token handling (httpOnly cookies)
- [ ] **Authorization**: RBAC + CASL checks in place
- [ ] **Rate Limiting**: Enabled on auth and AI endpoints
- [ ] **HTTPS**: Enforced in production
- [ ] **Security Headers**: CSP, X-Frame-Options configured
- [ ] **Error Handling**: No sensitive data in errors (ADR-007)
- [ ] **Logging**: No sensitive data logged
- [ ] **Dependencies**: Up to date, no vulnerabilities
- [ ] **UUID Handling**: No parseInt/Number/+ on UUID (ADR-019)
- [ ] **AI Boundary**: AI via DMS API only (ADR-018/023)
- [ ] **File Uploads**: Validated (50MB max, whitelist types)
- [ ] **AI Audit**: All AI interactions logged (ADR-020)

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security](https://docs.nestjs.com/security)
- [Next.js Security](https://nextjs.org/docs/security)
- [ADR-016 Security Authentication](../../specs/06-Decision-Records/ADR-016-security-authentication.md)
- [ADR-018 AI Boundary](../../specs/06-Decision-Records/ADR-018-ai-boundary.md)
- [ADR-019 UUID Strategy](../../specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md)
- [ADR-023 AI Architecture](../../specs/06-Decision-Records/ADR-023-unified-ai-architecture.md)

---

**Remember**: Security is not optional. One vulnerability can compromise the entire platform. When in doubt, err on the side of caution.
