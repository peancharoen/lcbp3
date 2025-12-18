# Monitoring & Alerting

**Project:** LCBP3-DMS
**Version:** 1.6.0
**Last Updated:** 2025-12-02

---

## 📋 Overview

This document describes monitoring setup, health checks, and alerting rules for LCBP3-DMS.

---

## 🎯 Monitoring Objectives

- **Availability:** System uptime > 99.5%
- **Performance:** API response time < 500ms (P95)
- **Reliability:** Error rate < 1%
- **Capacity:** Resource utilization < 80%

---

## 📊 Key Metrics

### Application Metrics

| Metric                  | Target  | Alert Threshold    |
| ----------------------- | ------- | ------------------ |
| API Response Time (P95) | < 500ms | > 1000ms           |
| Error Rate              | < 1%    | > 5%               |
| Request Rate            | N/A     | Sudden ±50% change |
| Active Users            | N/A     | -                  |
| Queue Length (BullMQ)   | < 100   | > 500              |

### Infrastructure Metrics

| Metric       | Target | Alert Threshold   |
| ------------ | ------ | ----------------- |
| CPU Usage    | < 70%  | > 90%             |
| Memory Usage | < 80%  | > 95%             |
| Disk Usage   | < 80%  | > 90%             |
| Network I/O  | N/A    | Anomaly detection |

### Database Metrics

| Metric                | Target  | Alert Threshold |
| --------------------- | ------- | --------------- |
| Query Time (P95)      | < 100ms | > 500ms         |
| Connection Pool Usage | < 80%   | > 95%           |
| Slow Queries          | 0       | > 10/min        |
| Replication Lag       | 0s      | > 30s           |

---

## 🔍 Health Checks

### Backend Health Endpoint

```typescript
// File: backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health
      () => this.db.pingCheck('database'),

      // Disk health
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),

      // Redis health
      async () => {
        const redis = await this.redis.ping();
        return { redis: { status: redis === 'PONG' ? 'up' : 'down' } };
      },
    ]);
  }
}
```

### Health Check Response

```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "storage": {
      "status": "up",
      "freePercent": 0.75
    },
    "redis": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    },
    "storage": {
      "status": "up",
      "freePercent": 0.75
    },
    "redis": {
      "status": "up"
    }
  }
}
```

---

## 🐳 Docker Container Monitoring

### Health Check in docker-compose.yml

```yaml
services:
  backend:
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  mariadb:
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 30s
      timeout: 10s
      retries: 3
```

### Monitor Container Status

```bash
#!/bin/bash
# File: /scripts/monitor-containers.sh

# Check all containers are healthy
CONTAINERS=("lcbp3-backend" "lcbp3-frontend" "lcbp3-mariadb" "lcbp3-redis")

for CONTAINER in "${CONTAINERS[@]}"; do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER 2>/dev/null)

  if [ "$HEALTH" != "healthy" ]; then
    echo "ALERT: $CONTAINER is $HEALTH"
    # Send alert (email, Slack, etc.)
  fi
done
```

---

## 📈 Application Performance Monitoring (APM)

### Log-Based Monitoring (MVP Phase)

```typescript
// File: backend/src/common/interceptors/performance.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { logger } from 'src/config/logger.config';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;

          logger.info('Request completed', {
            method: request.method,
            url: request.url,
            statusCode: context.switchToHttp().getResponse().statusCode,
            duration: `${duration}ms`,
            userId: request.user?.user_id,
          });

          // Alert on slow requests
          if (duration > 1000) {
            logger.warn('Slow request detected', {
              method: request.method,
              url: request.url,
              duration: `${duration}ms`,
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - start;

          logger.error('Request failed', {
            method: request.method,
            url: request.url,
            duration: `${duration}ms`,
            error: error.message,
          });
        },
      })
    );
  }
}
```

---

## 🚨 Alerting Rules

### Critical Alerts (Immediate Action Required)

| Alert           | Condition                                   | Action                      |
| --------------- | ------------------------------------------- | --------------------------- |
| Service Down    | Health check fails for 3 consecutive checks | Page on-call engineer       |
| Database Down   | Cannot connect to database                  | Page DBA + on-call engineer |
| Disk Full       | Disk usage > 95%                            | Page operations team        |
| High Error Rate | Error rate > 10% for 5 min                  | Page on-call engineer       |

### Warning Alerts (Review Within 1 Hour)

| Alert         | Condition               | Action                 |
| ------------- | ----------------------- | ---------------------- |
| High CPU      | CPU > 90% for 10 min    | Notify operations team |
| High Memory   | Memory > 95% for 10 min | Notify operations team |
| Slow Queries  | > 50 slow queries/min   | Notify DBA             |
| Queue Backlog | BullMQ queue > 500 jobs | Notify backend team    |

### Info Alerts (Review During Business Hours)

| Alert              | Condition                            | Action                |
| ------------------ | ------------------------------------ | --------------------- |
| Backup Failed      | Daily backup job failed              | Email operations team |
| SSL Expiring       | SSL certificate expires in < 30 days | Email operations team |
| Disk Space Warning | Disk usage > 80%                     | Email operations team |

---

## 📧 Alert Notification Channels

### Email Alerts

```bash
#!/bin/bash
# File: /scripts/send-alert-email.sh

TO="ops-team@example.com"
SUBJECT="$1"
MESSAGE="$2"

echo "$MESSAGE" | mail -s "[LCBP3-DMS] $SUBJECT" "$TO"
```

### Slack Alerts

```bash
#!/bin/bash
# File: /scripts/send-alert-slack.sh

WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
MESSAGE="$1"

curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"🚨 LCBP3-DMS Alert: $MESSAGE\"}" \
  "$WEBHOOK_URL"
```

---

## 📊 Monitoring Dashboard

### Metrics to Display

**System Overview:**

- Service status (up/down)
- Overall system health score
- Active user count
- Request rate (req/s)

**Performance:**

- API response time (P50, P95, P99)
- Database query time
- Queue processing time

**Resources:**

- CPU usage %
- Memory usage %
- Disk usage %
- Network I/O

**Business Metrics:**

- Documents created today
- Workflows completed today
- Active correspondences
- Pending approvals

---

## 🔧 Log Aggregation

### Centralized Logging with Docker

```bash
# Configure Docker logging driver
# File: /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "labels": "service,environment"
  }
}
```

### View Aggregated Logs

```bash
# View all LCBP3 container logs
docker-compose logs -f --tail=100

# View specific service logs
docker logs lcbp3-backend -f --since=1h

# Search logs
docker logs lcbp3-backend 2>&1 | grep "ERROR"

# Export logs for analysis
docker logs lcbp3-backend > backend-logs.txt
```

---

## 📈 Performance Baseline

### Establish Baselines

Run load tests to establish performance baselines:

```bash
# Install Apache Bench
apt-get install apache2-utils

# Test API endpoint
ab -n 1000 -c 10 \
  -H "Authorization: Bearer <TOKEN>" \
  https://lcbp3-dms.example.com/api/correspondences

# Results to record:
# - Requests per second
# - Mean response time
# - P95 response time
# - Error rate
```

### Regular Performance Testing

- **Weekly:** Quick health check (100 requests)
- **Monthly:** Full load test (10,000 requests)
- **Quarterly:** Stress test (find breaking point)

---

## ✅ Monitoring Checklist

### Daily

- [ ] Check service health dashboard
- [ ] Review error logs
- [ ] Verify backup completion
- [ ] Check disk space

### Weekly

- [ ] Review performance metrics trends
- [ ] Analyze slow query log
- [ ] Check SSL certificate expiry
- [ ] Review security alerts

### Monthly

- [ ] Capacity planning review
- [ ] Update monitoring thresholds
- [ ] Test alert notifications
- [ ] Review and tune performance

---

## 🔗 Related Documents

- [Backup & Recovery](04-04-backup-recovery.md)
- [Incident Response](04-07-incident-response.md)
- [ADR-010: Logging Strategy](../05-decisions/ADR-010-logging-monitoring-strategy.md)

---

**Version:** 1.6.0
**Last Review:** 2025-12-01
**Next Review:** 2026-03-01
