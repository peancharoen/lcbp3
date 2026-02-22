# Task: Common Module - Auth & Security

**Status:** Not Started
**Priority:** P0 (Critical - Foundation)
**Estimated Effort:** 5-7 days
**Dependencies:** TASK-BE-001 (Database)
**Owner:** Backend Team

---

## 📋 Overview

สร้าง Common Module ที่รวม Authentication, Authorization, Guards, Interceptors, และ Utility Services

---

## 🎯 Objectives

- ✅ JWT Authentication System
- ✅ 4-Level RBAC with CASL
- ✅ Custom Guards และ Decorators
- ✅ Idempotency Interceptor
- ✅ Rate Limiting
- ✅ Input Validation Framework

---

## 📝 Acceptance Criteria

1. **Authentication:**

   - ✅ Login with username/password returns JWT
   - ✅ Token refresh mechanism works
   - ✅ Token revocation supported
   - ✅ Password hashing with bcrypt

2. **Authorization:**

   - ✅ RBAC Guards ตรวจสอบ 4 levels (Global/Org/Project/Contract)
   - ✅ Permission cache ใน Redis (TTL: 30min)
   - ✅ CASL Ability Factory working

3. **Security:**
   - ✅ Rate limiting per user/IP
   - ✅ Idempotency-Key validation
   - ✅ Input sanitization
   - ✅ CORS configuration

---

## 🛠️ Implementation Steps

### 1. Auth Module

```typescript
// File: backend/src/common/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

```typescript
// File: backend/src/common/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private redis: Redis
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.username, loginDto.password);

    const payload = {
      sub: user.user_id,
      username: user.username,
      organization_id: user.organization_id,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Store refresh token in Redis
    await this.redis.set(
      `refresh_token:${user.user_id}`,
      refreshToken,
      'EX',
      7 * 24 * 3600
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.userService.findByUsername(username);

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    // Verify and refresh token
  }

  async logout(userId: number): Promise<void> {
    // Revoke tokens
    await this.redis.del(`refresh_token:${userId}`);
    await this.redis.del(`user:${userId}:permissions`);
  }
}
```

### 2. RBAC Guards

```typescript
// File: backend/src/common/guards/permission.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory } from '../ability/ability.factory';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFactory: AbilityFactory,
    private redis: Redis
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string>(
      'permission',
      context.getHandler()
    );

    if (!permission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check cache first
    let ability = await this.getCachedAbility(user.sub);

    if (!ability) {
      ability = await this.abilityFactory.createForUser(user);
      await this.cacheAbility(user.sub, ability);
    }

    const [action, subject] = permission.split('.');
    const resource = this.getResource(request);

    return ability.can(action, subject, resource);
  }

  private async getCachedAbility(userId: number): Promise<any> {
    const cached = await this.redis.get(`user:${userId}:permissions`);
    return cached ? JSON.parse(cached) : null;
  }

  private async cacheAbility(userId: number, ability: any): Promise<void> {
    await this.redis.set(
      `user:${userId}:permissions`,
      JSON.stringify(ability.rules),
      'EX',
      1800 // 30 minutes
    );
  }
}
```

### 3. Custom Decorators

```typescript
// File: backend/src/common/decorators/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RequirePermission = (permission: string) =>
  SetMetadata('permission', permission);

// Usage:
// @RequirePermission('correspondence.create')
```

```typescript
// File: backend/src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);

// Usage:
// async create(@CurrentUser() user: User) {}
```

### 4. Idempotency Interceptor

```typescript
// File: backend/src/common/interceptors/idempotency.interceptor.ts
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    // Only apply to POST/PUT/DELETE
    if (!['POST', 'PUT', 'DELETE'].includes(request.method)) {
      return next.handle();
    }

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header required');
    }

    // Check for cached result
    const cacheKey = `idempotency:${idempotencyKey}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return of(JSON.parse(cached)); // Return previous result
    }

    // Execute and cache result
    return next.handle().pipe(
      tap(async (response) => {
        await this.redis.set(
          cacheKey,
          JSON.stringify(response),
          'EX',
          86400 // 24 hours
        );
      })
    );
  }
}
```

### 5. Rate Limiting

```typescript
// File: backend/src/common/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: any): Promise<string> {
    // Use user ID if authenticated, otherwise IP
    return req.user?.sub || req.ip;
  }

  protected async getLimit(context: ExecutionContext): Promise<number> {
    // Different limits per role
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return 100; // Anonymous

    switch (user.role) {
      case 'admin':
        return 5000;
      case 'document_control':
        return 2000;
      case 'editor':
        return 1000;
      default:
        return 500;
    }
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
// File: backend/src/common/auth/auth.service.spec.ts
describe('AuthService', () => {
  it('should login with valid credentials', async () => {
    const result = await service.login({
      username: 'testuser',
      password: 'password123',
    });

    expect(result.access_token).toBeDefined();
    expect(result.refresh_token).toBeDefined();
  });

  it('should throw error with invalid credentials', async () => {
    await expect(
      service.login({
        username: 'testuser',
        password: 'wrongpassword',
      })
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

### 2. Integration Tests

```bash
# Test login endpoint
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password123"}'

# Test protected endpoint
curl http://localhost:3000/projects \
  -H "Authorization: Bearer <access_token>"

# Test permission guard
curl -X POST http://localhost:3000/correspondences \
  -H "Authorization: Bearer <viewer_token>" \
  -d '{}' # Should return 403
```

### 3. RBAC Testing

```typescript
describe('PermissionGuard', () => {
  it('should allow global admin to access everything', async () => {
    const canAccess = await guard.canActivate(
      mockContext({
        user: globalAdmin,
        permission: 'correspondence.create',
      })
    );

    expect(canAccess).toBe(true);
  });

  it('should deny viewer from creating', async () => {
    const canAccess = await guard.canActivate(
      mockContext({
        user: viewer,
        permission: 'correspondence.create',
      })
    );

    expect(canAccess).toBe(false);
  });
});
```

---

## 📚 Related Documents

- [Backend Guidelines - Security](../03-implementation/backend-guidelines.md#security)
- [ADR-004: RBAC Implementation](../05-decisions/ADR-004-rbac-implementation.md)
- [ADR-006: Redis Caching Strategy](../05-decisions/ADR-006-redis-caching-strategy.md)

---

## 📦 Deliverables

- [ ] AuthModule (login, refresh, logout)
- [ ] JWT Strategy
- [ ] Permission Guard with CASL
- [ ] Custom Decorators (@RequirePermission, @CurrentUser)
- [ ] Idempotency Interceptor
- [ ] Rate Limiting Guard
- [ ] Unit Tests (80% coverage)
- [ ] Integration Tests
- [ ] Documentation

---

## 🚨 Risks & Mitigation

| Risk                | Impact   | Mitigation                             |
| ------------------- | -------- | -------------------------------------- |
| JWT secret exposure | Critical | Use strong secret, rotate periodically |
| Redis cache miss    | Medium   | Fallback to DB query                   |
| Rate limit bypass   | Medium   | Multiple tracking (IP + User)          |
| RBAC complexity     | High     | Comprehensive testing                  |

---

## 📌 Notes

- JWT secret must be 32+ characters
- Refresh tokens expire after 7 days
- Permission cache expires after 30 minutes
- Rate limits differ by role (see RateLimitGuard)
