# ADR-010: Logging & Monitoring Strategy

**Status:** ✅ Accepted (Pending)
**Date:** 2026-02-24
**Decision Makers:** Backend Team, DevOps Team
**Related Documents:** [Backend Guidelines](../03-implementation/03-02-backend-guidelines.md)
**Version Applicability:** v1.8.0+
**Next Review:** 2026-08-01 (6-month cycle)

---

## Gap Analysis & Requirement Linking

### ปิด Gap จาก Requirements:

| Gap/Requirement | แหล่งที่มา | วิธีการแก้ไขใน ADR นี้ |
|----------------|-------------|-------------------|
| **Structured Logging** | [Product Vision](../00-overview/00-03-product-vision.md) - Operations Requirements | Winston with JSON format for searchability |
| **Performance Monitoring** | [Acceptance Criteria](../01-Requirements/01-05-acceptance-criteria.md) - AC-PERF-002 | Request logging and performance interceptors |
| **Error Tracking** | [Business Rules](../01-Requirements/01-02-business-rules/01-02-03-ui-ux-rules.md) - User Experience | Global exception filter with context |
| **Audit Trail** | [Security ADR-016](./ADR-016-security-authentication.md) - Security events | Structured audit logging for compliance |
| **Scalability** | [Architecture](../02-architecture/02-02-software-architecture.md) - Performance | Phase 2 ELK Stack for centralized logging |

### แก้ไขความขัดแย้ง:

- **Conflict:** Cost vs. Features (Winston vs. Full ELK Stack)
- **Resolution:** Phased approach - Winston now, ELK later
- **Trade-off:** Manual log search initially vs. Future centralized dashboard

---

## Impact Analysis

### Affected Components (ส่วนประกอบที่ได้รับผลกระทบ):

| Component | ผลกระทบ | ความสำคัำ |
|-----------|----------|-----------|
| **Logger Configuration** | Winston setup with transports | 🔴 Critical |
| **NestJS Integration** | Custom logger service | 🔴 Critical |
| **Request Middleware** | HTTP request logging | 🟡 Important |
| **Exception Filter** | Global error logging | 🔴 Critical |
| **Performance Interceptor** | Slow request detection | 🟡 Important |
| **Database Logging** | Query performance tracking | 🟡 Important |
| **Log Rotation** | File management strategy | 🟡 Important |
| **Docker Logging** | Container log configuration | 🟢 Guidelines |
| **Future ELK Stack** | Phase 2 centralized logging | 🟢 Guidelines |

### Required Changes (การเปลี่ยนแปลงที่ต้องดำเนินการ):

#### Backend (NestJS)
- [x] Configure Winston with multiple transports
- [x] Create custom NestJS logger service
- [x] Implement request logging middleware
- [x] Add global exception filter
- [x] Create performance interceptor
- [x] Configure database query logging
- [x] Setup log rotation policies

#### Infrastructure
- [x] Configure Docker logging driver
- [x] Setup log volume persistence
- [x] Create log monitoring alerts
- [x] Plan ELK Stack architecture (Phase 2)

#### Development Process
- [x] Define logging standards and best practices
- [x] Create logging guidelines documentation
- [x] Setup log analysis procedures

---

## Context and Problem Statement

ระบบ LCBP3-DMS ต้องการ Logging และ Monitoring ที่ดีเพื่อ:

- Debug ปัญหาใน Production
- ติดตาม Performance metrics
- Audit trail สำหรับ Security และ Compliance
- Alert เมื่อมี Errors หรือ Anomalies

### ปัญหาที่ต้องแก้:

1. **Structured Logging:** บันทึก Logs ในรูปแบบที่ค้นหาและวิเคราะห์ได้ง่าย
2. **Log Levels:** กำหนด Log levels ที่เหมาะสมสำหรับแต่ละสถานการณ์
3. **Performance Monitoring:** ติดตาม Response time, Database queries, Memory usage
4. **Error Tracking:** ติดตาม Errors และ Exceptions อย่างเป็นระบบ
5. **Centralized Logging:** รวม Logs จากหลาย Services ไว้ที่เดียว

---

## Decision Drivers

- 🔍 **Debuggability:** หา Root cause ของปัญหาได้เร็ว
- 📊 **Performance Insights:** ดู Metrics และ Bottlenecks
- 🚨 **Alerting:** แจ้งเตือนเมื่อมีปัญหา
- 📈 **Scalability:** รองรับ High-volume logs
- 💰 **Cost:** ไม่ต้องลงทุนมากในช่วงเริ่มต้น

---

## Considered Options

### Option 1: Console.log (Built-in)

**Pros:**

- ✅ Simple, ไม่ต้อง Setup
- ✅ ไม่มีค่าใช้จ่าย

**Cons:**

- ❌ ไม่มี Structure
- ❌ ไม่มี Log levels
- ❌ ไม่มี Log rotation
- ❌ ยากต่อการ Search/Filter

### Option 2: Winston (Structured Logging Library)

**Pros:**

- ✅ Structured logs (JSON format)
- ✅ Multiple transports (File, Console, HTTP)
- ✅ Log levels (error, warn, info, debug)
- ✅ Log rotation
- ✅ Mature library

**Cons:**

- ❌ ต้อง Configure transports
- ❌ Performance overhead (minimal)

### Option 3: Full Observability Stack (ELK/Datadog/New Relic)

**Pros:**

- ✅ Complete solution (Logs + Metrics + APM)
- ✅ Powerful query และ Visualization
- ✅ Built-in Alerting

**Cons:**

- ❌ **ค่าใช้จ่ายสูง**
- ❌ Complex setup
- ❌ Overkill สำหรับ MVP

---

## Decision Outcome

**Chosen Option:** **Option 2 (Winston) + Docker Logging + Future ELK Stack**

### Rationale

**Phase 1 (MVP):** Winston with File/Console outputs

- ✅ เพียงพอสำหรับ MVP
- ✅ Structured logs พร้อมสำหรับ ELK ในอนาคต
- ✅ ไม่มีค่าใช้จ่ายเพิ่ม

**Phase 2 (Production Scale):** Add ELK Stack (Elasticsearch, Logstash, Kibana)

- ✅ Centralized logging
- ✅ Search และ Visualization
- ✅ Open-source (ไม่มี Vendor lock-in)

---

## Implementation Details

### 1. Winston Configuration

```typescript
// File: backend/src/config/logger.config.ts
import * as winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'lcbp3-dms-backend',
    environment: process.env.NODE_ENV,
  },
  transports: [
    // Console output (for Development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
    }),

    // File output (for Production)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});
```

### 2. NestJS Logger Integration

```typescript
// File: backend/src/main.ts
import { Logger } from '@nestjs/common';
import { logger as winstonLogger } from './config/logger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLogger(winstonLogger),
  });

  // ...
}
```

### 3. Custom Winston Logger for NestJS

```typescript
// File: backend/src/common/logger/winston.logger.ts
import { LoggerService } from '@nestjs/common';
import { Logger as WinstonLoggerType } from 'winston';

export class WinstonLogger implements LoggerService {
  constructor(private readonly logger: WinstonLoggerType) {}

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }
}
```

### 4. Request Logging Middleware

```typescript
// File: backend/src/common/middleware/request-logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logger } from 'src/config/logger.config';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: (req as any).user?.user_id,
      });
    });

    next();
  }
}
```

### 5. Database Query Logging

```typescript
// File: backend/src/config/database.config.ts
export default {
  // ...
  logging: process.env.NODE_ENV === 'development' ? 'all' : ['error', 'warn', 'schema'],
  logger: 'advanced-console',
  maxQueryExecutionTime: 1000, // Warn if query > 1s
};
```

### 6. Error Logging in Exception Filter

```typescript
// File: backend/src/common/filters/global-exception.filter.ts
import { logger } from 'src/config/logger.config';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // ... get status, message

    // Log error
    logger.error('Exception occurred', {
      error: exception,
      statusCode: status,
      path: request.url,
      method: request.method,
      userId: request.user?.user_id,
      stack: exception instanceof Error ? exception.stack : null,
    });

    // Send response to client
    response.status(status).json({ ... });
  }
}
```

### 7. Log Levels Usage

```typescript
// ERROR: จับ Exceptions และ Errors
logger.error('Failed to create correspondence', { error, userId, documentId });

// WARN: สถานการณ์ผิดปกติ แต่ไม่ Error
logger.warn('Document numbering retry attempt 2/3', { template, counter });

// INFO: Business events สำคัญ
logger.info('Correspondence approved', { documentId, approvedBy });

// DEBUG: ข้อมูลละเอียดสำหรับ Development
logger.debug('Workflow transition guard check', { workflowId, guardResult });

// VERBOSE: ข้อมูลละเอียดมากๆ
logger.verbose('Cache hit', { key, ttl });
```

### 8. Performance Monitoring

```typescript
// File: backend/src/common/interceptors/performance.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { logger } from 'src/config/logger.config';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;

        if (duration > 1000) {
          logger.warn('Slow request detected', {
            method: request.method,
            url: request.url,
            duration: `${duration}ms`,
          });
        }
      })
    );
  }
}
```

---

## Log Format Example

### Development (Console)

```
2024-01-01 10:30:15 [info]: Correspondence approved { documentId: 123, approvedBy: 5 }
2024-01-01 10:30:16 [error]: Failed to send email { error: 'SMTP timeout', userId: 5 }
```

### Production (JSON File)

```json
{
  "timestamp": "2024-01-01T10:30:15.123Z",
  "level": "info",
  "message": "Correspondence approved",
  "service": "lcbp3-dms-backend",
  "environment": "production",
  "documentId": 123,
  "approvedBy": 5
}
```

---

## Future: ELK Stack Integration

**Phase 2 Setup:**

```yaml
# docker-compose.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
    ports:
      - '9200:9200'

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - '5601:5601'
    depends_on:
      - elasticsearch
```

**Winston transport to Logstash:**

```typescript
import { LogstashTransport } from 'winston-logstash';

logger.add(
  new LogstashTransport({
    host: process.env.LOGSTASH_HOST,
    port: parseInt(process.env.LOGSTASH_PORT),
  })
);
```

---

## Consequences

### Positive Consequences

1. ✅ **Structured Logs:** ค้นหาและวิเคราะห์ได้ง่าย
2. ✅ **Performance Insights:** ดู Slow requests ได้
3. ✅ **Error Tracking:** ติดตาม Errors พร้อม Context
4. ✅ **Scalable:** พร้อมสำหรับ ELK Stack ในอนาคต
5. ✅ **Cost Effective:** ไม่มีค่าใช้จ่ายในช่วง MVP

### Negative Consequences

1. ❌ **Manual Log Search:** ใน Phase 1 ต้องค้นหา Logs ใน Files
2. ❌ **No Centralized Dashboard:** ต้องรอ Phase 2 (ELK)
3. ❌ **Log Rotation Management:** ต้อง Monitor disk space

### Mitigation Strategies

- **Docker Logging Driver:** ใช้ Docker log driver สำหรับ Log rotation
- **Log Aggregation:** ใช้ `docker logs` รวม Logs จากหลาย Containers
- **Monitoring:** Set up Disk space alerts

---

## Logging Best Practices

### DO:

- ✅ Log ทุก HTTP requests พร้อม Response time
- ✅ Log Business events สำคัญ (Approved, Rejected, Created)
- ✅ Log Errors พร้อม Stack trace และ Context
- ✅ ใช้ Structured logging (JSON format)

### DON'T:

- ❌ Log Sensitive data (Passwords, Tokens)
- ❌ Log ทุก Database query ใน Production
- ❌ Log Large payloads (> 1KB) ทั้งหมด
- ❌ ใช้ `console.log` แทน Logger

---

## ADR Review Cycle

### Core Principle Review Schedule
- **Review Frequency:** ทุก 6 เดือน (กุมภาพันธ์ และ สิงหาคม)
- **Trigger Events:**
  - Major version upgrade (v1.9.0, v2.0.0)
  - Log volume exceeds capacity
  - Performance issues requiring deeper monitoring
  - ELK Stack implementation (Phase 2)

### Review Checklist
- [ ] Logging strategy still meeting observability needs
- [ ] Log storage and rotation policies effective
- [ ] Performance monitoring providing adequate insights
- [ ] Error tracking and alerting working properly
- [ ] Cross-document dependencies still valid
- [ ] New logging technologies or patterns to consider
- [ ] ELK Stack implementation timeline and requirements

### Version Dependency Matrix

| System Version | ADR Version | Required Changes | Status |
|----------------|-------------|------------------|---------|
| v1.8.0 - v1.8.5 | ADR-010 v1.0 | Base Winston logging setup | ✅ Complete |
| v1.9.0+ | ADR-010 v1.1 | Review logging performance and ELK readiness | 📋 Planned |
| v2.0.0+ | ADR-010 v2.0 | Implement ELK Stack (Phase 2) | 📋 Future |

---

## Related ADRs

- [ADR-007: API Design & Error Handling](./ADR-007-api-design-error-handling.md)
- [ADR-005: Technology Stack](./ADR-005-technology-stack.md)

---

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [NestJS Logging](https://docs.nestjs.com/techniques/logger)
- [ELK Stack](https://www.elastic.co/elastic-stack)

---

**Document Version:** v1.0
**Last Updated:** 2026-02-24
**Next Review:** 2026-08-01 (6-month cycle)
**Version Applicability:** LCBP3 v1.8.0+

---

## Change History

| Version | Date | Changes | Author |
|---------|------|---------|---------|
| v1.0 | 2026-02-24 | Initial ADR creation with logging strategy | Backend Team |
| v1.1 | 2026-04-04 | Added structured templates: Impact Analysis, Gap Linking, Version Dependency, Review Cycle | System Architect |
