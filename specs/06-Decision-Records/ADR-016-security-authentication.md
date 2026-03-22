# ADR-016: Security & Authentication Strategy

**Status:** ✅ Accepted
**Date:** 2026-02-24
**Decision Makers:** Security Team, System Architect
**Related Documents:** [ADR-004: RBAC Implementation](./ADR-004-rbac-implementation.md), [ADR-007: API Design](./ADR-007-api-design-error-handling.md)

---

## Context and Problem Statement

LCBP3-DMS จัดการเอกสารสำคัญของโปรเจกต์ ต้องการ Security strategy ที่ครอบคลุม Authentication, Authorization, Data protection, และ Security best practices

### ปัญหาที่ต้องแก้:

1. **Authentication:** ใช้วิธีไหนในการยืนยันตัวตน
2. **Session Management:** จัดการ Session อย่างไร
3. **Password Security:** เก็บ Password อย่างไรให้ปลอดภัย
4. **Data Encryption:** Encrypt ข้อมูลอย่างไร
5. **Security Headers:** HTTP Headers ที่ต้องมี
6. **Input Validation:** ป้องกัน Injection attacks
7. **Rate Limiting:** ป้องกัน Brute force attacks

---

## Decision Drivers

- 🔒 **Security First:** ความปลอดภัยเป็นสำคัญที่สุด
- ✅ **Industry Standards:** ใช้ Standard practices (OWASP)
- 🎯 **User Experience:** ไม่ซับซ้อนเกินไป
- 📝 **Audit Trail:** บันทึก Security events ทั้งหมด
- 🔄 **Token Refresh:** Session management ที่สะดวก

---

## Decision Outcome

### 1. Authentication Strategy

**Chosen:** **JWT (JSON Web Tokens) with Bearer Token Strategy (Stored in LocalStorage via Zustand)**

_Note: Initial plan was HTTP-only cookies, but shifted to Bearer tokens to ease cross-domain Next.js to NestJS communication._

```typescript
// File: src/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ) {}

  async login(credentials: LoginDto): Promise<{ tokens }> {
    const user = await this.validateUser(credentials);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.user_id,
      username: user.username,
      roles: user.roles,
    };

    // Generate tokens
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m', // Short-lived
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d', // Long-lived
    });

    // Store refresh token (hashed) in database
    await this.storeRefreshToken(user.user_id, refreshToken);

    return { accessToken, refreshToken };
  }

  private async validateUser(credentials: LoginDto) {
    const user = await this.usersService.findByUsername(credentials.username);

    if (!user) return null;

    // Use bcrypt for password comparison
    const isValid = await bcrypt.compare(credentials.password, user.password_hash);

    return isValid ? user : null;
  }
}
```

### 2. Password Security

**Strategy:** **bcrypt with salt rounds = 10 (Current implementation defaults to 10 via `genSalt()`)**

_Note: Code currently uses `bcrypt.genSalt()` without arguments, defaulting to 10 rounds. If 12 is strictly required, codebase needs updating._

```typescript
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Password Policy:**

- Minimum 8 characters
- Mix of uppercase, lowercase, numbers
- No common passwords (check against dictionary)
- Password history (last 5 passwords)
- Force change every 90 days (optional)

### 3. JWT Guard (Authorization)

```typescript
// File: src/common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw new UnauthorizedException(info?.message || 'Unauthorized');
    }
    return user;
  }
}
```

### 4. Data Encryption

**At Rest:**

- Database: Use MariaDB encryption at column level (for sensitive fields)
- Files: Encrypt before storing (AES-256)

```typescript
import * as crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

function decrypt(encrypted: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));

  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**In Transit:**

- HTTPS only (TLS 1.3)
- HSTS enabled
- Certificate from trusted CA

### 5. Security Headers

```typescript
// File: src/main.ts
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
  })
);

// CORS
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### 6. Input Validation

**Strategy:** **Class-validator + Zod + Custom Sanitization**

```typescript
// DTO Validation
import { IsString, IsEmail, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;
}

// SQL Injection Prevention (TypeORM handles this)
// Use parameterized queries ALWAYS

// XSS Prevention
import * as sanitizeHtml from 'sanitize-html';

function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [], // No HTML tags
    allowedAttributes: {},
  });
}
```

### 7. Rate Limiting

```typescript
// File: src/common/guards/rate-limit.guard.ts
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): string {
    // Track by IP + User ID (if authenticated)
    return req.ip + (req.user?.user_id || '');
  }
}

// Apply to login endpoint
@Controller('auth')
@UseGuards(CustomThrottlerGuard)
export class AuthController {
  @Post('login')
  @Throttle(5, 60) // 5 attempts per minute
  async login(@Body() credentials: LoginDto) {
    return this.authService.login(credentials);
  }
}
```

### 8. Session Management

**Strategy:** **Stateless JWT + Refresh Token in Database**

```typescript
// Refresh token table
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn()
  token_id: number;

  @Column()
  user_id: number;

  @Column()
  token_hash: string; // SHA-256 hash of token

  @Column()
  expires_at: Date;

  @Column({ default: false })
  is_revoked: boolean;

  @CreateDateColumn()
  created_at: Date;
}

// Token refresh endpoint
@Post('refresh')
async refresh(@Body('refreshToken') token: string) {
  const payload = this.jwtService.verify(token, {
    secret: process.env.JWT_REFRESH_SECRET,
  });

  // Check if token is revoked
  const storedToken = await this.findRefreshToken(token);
  if (!storedToken || storedToken.is_revoked) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  // Generate new access token
  const newAccessToken = this.jwtService.sign({
    sub: payload.sub,
    username: payload.username,
    roles: payload.roles,
  });

  return { accessToken: newAccessToken };
}
```

### 9. Audit Logging (Security Events)

```typescript
// Log all security-related events
await this.auditLogService.create({
  user_id: user.user_id,
  action: 'LOGIN_SUCCESS',
  entity_type: 'auth',
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

// Track failed login attempts
await this.auditLogService.create({
  action: 'LOGIN_FAILED',
  entity_type: 'auth',
  ip_address: req.ip,
  details: { username: credentials.username },
});
```

---

## Security Checklist

### Application Security

- [x] JWT authentication with short-lived tokens (Bearer Token)
- [x] Password hashing with bcrypt (12 rounds)
- [x] HTTPS only (TLS 1.3)
- [x] Security headers (Helmet.js)
- [x] CORS properly configured
- [x] Input validation (class-validator)
- [x] SQL injection prevention (TypeORM)
- [x] XSS prevention (sanitize-html)
- [x] CSRF protection (Mitigated by Bearer token usage instead of cookies)
- [x] Rate limiting (Throttler)

### Data Security

- [x] Sensitive data encrypted at rest (AES-256)
- [x] Passwords hashed (bcrypt)
- [x] Secrets in environment variables (not in code)
- [x] Database credentials rotated regularly
- [x] Backup encryption enabled

### Access Control

- [x] 4-level RBAC implemented
- [x] Principle of least privilege
- [x] Role-based permissions
- [x] Session timeout (15 minutes)
- [x] Audit logging for all actions

### Infrastructure

- [x] Firewall configured
- [x] Intrusion detection (optional)
- [x] Regular security updates
- [x] Vulnerability scanning (`pnpm audit` — run before each deploy)
- [x] Penetration testing (before go-live)
- [x] Dependency vulnerabilities patched — CASL 6.7.5 (CVE-2026-1774, 2026-02-24)

---

## Consequences

### Positive Consequences

1. ✅ **Secure by Design:** ใช้ Industry best practices
2. ✅ **OWASP Compliant:** ครอบคลุม OWASP Top 10
3. ✅ **Audit Trail:** บันทึก Security events ทั้งหมด
4. ✅ **Token-based:** Stateless และ Scalable
5. ✅ **Defense in Depth:** หลายชั้นการป้องกัน

### Negative Consequences

1. ❌ **Complexity:** Security measures เพิ่ม Complexity
2. ❌ **Performance:** Encryption/Hashing ใช้ CPU
3. ❌ **User Friction:** Password policy อาจรำคาญผู้ใช้

### Mitigation Strategies

- **Documentation:** เขียน Security guidelines ให้ทีม
- **Training:** อบรม Security awareness
- **Automation:** Automated security scans
- **Monitoring:** Real-time security monitoring
- **Frontend Sync:** ตรวจสอบว่า `localStorage` ไม่ถูกดักจับผ่าน XSS ได้ง่าย ๆ เนื่องจากเปลี่ยนจาก `HTTP-only Cookies` มาเป็น `LocalStorage`

---

## Related ADRs

- [ADR-004: RBAC Implementation](./ADR-004-rbac-implementation.md)
- [ADR-007: API Design & Error Handling](./ADR-007-api-design-error-handling.md)
- [ADR-015: Deployment & Infrastructure](./ADR-015-deployment-infrastructure.md)

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://curity.io/resources/learn/jwt-best-practices/)
- [NestJS Security](https://docs.nestjs.com/security/authentication)

---

**Last Updated:** 2026-02-24
**Next Review:** 2026-06-01 (Quarterly review)
