# Document Numbering Operations Guide

---
title: 'Operations Guide: Document Numbering System'
version: 1.5.1
status: draft
owner: Operations Team
last_updated: 2025-12-02
related:
  - specs/01-requirements/03.11-document-numbering.md
  - specs/03-implementation/document-numbering.md
  - specs/04-operations/monitoring-alerting.md
---

## Overview

เอกสารนี้อธิบาย operations procedures, monitoring, และ troubleshooting สำหรับระบบ Document Numbering

## 1. Performance Requirements

### 1.1. Response Time Targets

| Metric           | Target   | Measurement              |
| ---------------- | -------- | ------------------------ |
| 95th percentile  | ≤ 2 วินาที | ตั้งแต่ request ถึง response |
| 99th percentile  | ≤ 5 วินาที | ตั้งแต่ request ถึง response |
| Normal operation | ≤ 500ms  | ไม่มี retry                |

### 1.2. Throughput Targets

| Load Level     | Target      | Notes                    |
| -------------- | ----------- | ------------------------ |
| Normal load    | ≥ 50 req/s  | ใช้งานปกติ                 |
| Peak load      | ≥ 100 req/s | ช่วงเร่งงาน                |
| Burst capacity | ≥ 200 req/s | Short duration (< 1 min) |

### 1.3. Availability SLA

- **Uptime**: ≥ 99.5% (excluding planned maintenance)
- **Maximum downtime**: ≤ 3.6 ชั่วโมง/เดือน (~ 8.6 นาที/วัน)
- **Recovery Time Objective (RTO)**: ≤ 30 นาที
- **Recovery Point Objective (RPO)**: ≤ 5 นาที

## 2. Infrastructure Setup

### 2.1. Database Configuration

#### MariaDB Connection Pool

```typescript
// ormconfig.ts
{
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  extra: {
    connectionLimit: 20,      // Pool size
    queueLimit: 0,            // Unlimited queue
    acquireTimeout: 10000,    // 10s timeout
    retryAttempts: 3,
    retryDelay: 1000
  }
}
```

#### High Availability Setup

```yaml
# docker-compose.yml
services:
  mariadb-master:
    image: mariadb:11.8
    environment:
      MYSQL_REPLICATION_MODE: master
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - mariadb-master-data:/var/lib/mysql
    networks:
      - backend

  mariadb-replica:
    image: mariadb:11.8
    environment:
      MYSQL_REPLICATION_MODE: slave
      MYSQL_MASTER_HOST: mariadb-master
      MYSQL_MASTER_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - mariadb-replica-data:/var/lib/mysql
    networks:
      - backend
```

### 2.2. Redis Configuration

#### Redis Sentinel for High Availability

```yaml
# docker-compose.yml
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-master-data:/data
    networks:
      - backend

  redis-replica:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --appendonly yes
    volumes:
      - redis-replica-data:/data
    networks:
      - backend

  redis-sentinel:
    image: redis:7-alpine
    command: >
      redis-sentinel /etc/redis/sentinel.conf
      --sentinel monitor mymaster redis-master 6379 2
      --sentinel down-after-milliseconds mymaster 5000
      --sentinel failover-timeout mymaster 10000
    networks:
      - backend
```

#### Redis Connection Pool

```typescript
// redis.config.ts
import IORedis from 'ioredis';

export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  poolSize: 10,
  retryStrategy: (times: number) => {
    if (times > 3) {
      return null; // Stop retry
    }
    return Math.min(times * 100, 3000);
  },
};
```

### 2.3. Load Balancing

#### Nginx Configuration

```nginx
# nginx.conf
upstream backend {
  least_conn;  # Least connections algorithm
  server backend-1:3000 max_fails=3 fail_timeout=30s weight=1;
  server backend-2:3000 max_fails=3 fail_timeout=30s weight=1;
  server backend-3:3000 max_fails=3 fail_timeout=30s weight=1;

  keepalive 32;
}

server {
  listen 80;
  server_name api.lcbp3.local;

  location /api/v1/document-numbering/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    proxy_next_upstream error timeout;
    proxy_connect_timeout 10s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
  }
}
```

#### Docker Compose Scaling

```yaml
# docker-compose.yml
services:
  backend:
    image: lcbp3-backend:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    environment:
      NODE_ENV: production
      DB_POOL_SIZE: 20
    networks:
      - backend
```

## 3. Monitoring & Metrics

### 3.1. Prometheus Metrics

#### Key Metrics to Collect

```typescript
// metrics.service.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// Lock acquisition metrics
export const lockAcquisitionDuration = new Histogram({
  name: 'docnum_lock_acquisition_duration_ms',
  help: 'Lock acquisition time in milliseconds',
  labelNames: ['project', 'type'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
});

export const lockAcquisitionFailures = new Counter({
  name: 'docnum_lock_acquisition_failures_total',
  help: 'Total number of lock acquisition failures',
  labelNames: ['project', 'type', 'reason'],
});

// Generation metrics
export const generationDuration = new Histogram({
  name: 'docnum_generation_duration_ms',
  help: 'Total document number generation time',
  labelNames: ['project', 'type', 'status'],
  buckets: [100, 200, 500, 1000, 2000, 5000],
});

export const retryCount = new Histogram({
  name: 'docnum_retry_count',
  help: 'Number of retries per generation',
  labelNames: ['project', 'type'],
  buckets: [0, 1, 2, 3, 5, 10],
});

// Connection health
export const redisConnectionStatus = new Gauge({
  name: 'docnum_redis_connection_status',
  help: 'Redis connection status (1=up, 0=down)',
});

export const dbConnectionPoolUsage = new Gauge({
  name: 'docnum_db_connection_pool_usage',
  help: 'Database connection pool usage percentage',
});
```

### 3.2. Prometheus Alert Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: document_numbering_alerts
    interval: 30s
    rules:
      # CRITICAL: Redis unavailable
      - alert: RedisUnavailable
        expr: docnum_redis_connection_status == 0
        for: 1m
        labels:
          severity: critical
          component: document-numbering
        annotations:
          summary: "Redis is unavailable for document numbering"
          description: "System is falling back to DB-only locking. Performance degraded by 30-50%."
          runbook_url: "https://wiki.lcbp3/runbooks/redis-unavailable"

      # CRITICAL: High lock failure rate
      - alert: HighLockFailureRate
        expr: |
          rate(docnum_lock_acquisition_failures_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
          component: document-numbering
        annotations:
          summary: "Lock acquisition failure rate > 10%"
          description: "Check Redis and database performance immediately"
          runbook_url: "https://wiki.lcbp3/runbooks/high-lock-failure"

      # WARNING: Elevated lock failure rate
      - alert: ElevatedLockFailureRate
        expr: |
          rate(docnum_lock_acquisition_failures_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
          component: document-numbering
        annotations:
          summary: "Lock acquisition failure rate > 5%"
          description: "Monitor closely. May escalate to critical soon."

      # WARNING: Slow lock acquisition
      - alert: SlowLockAcquisition
        expr: |
          histogram_quantile(0.95,
            rate(docnum_lock_acquisition_duration_ms_bucket[5m])
          ) > 1000
        for: 5m
        labels:
          severity: warning
          component: document-numbering
        annotations:
          summary: "P95 lock acquisition time > 1 second"
          description: "Lock acquisition is slower than expected. Check Redis latency."

      # WARNING: High retry count
      - alert: HighRetryCount
        expr: |
          sum by (project) (
            rate(docnum_retry_count_sum[1h])
          ) > 100
        for: 1h
        labels:
          severity: warning
          component: document-numbering
        annotations:
          summary: "Retry count > 100 per hour in project {{ $labels.project }}"
          description: "High contention detected. Consider scaling."

      # WARNING: Slow generation
      - alert: SlowDocumentNumberGeneration
        expr: |
          histogram_quantile(0.95,
            rate(docnum_generation_duration_ms_bucket[5m])
          ) > 2000
        for: 5m
        labels:
          severity: warning
          component: document-numbering
        annotations:
          summary: "P95 generation time > 2 seconds"
          description: "Document number generation is slower than SLA target"
```

### 3.3. AlertManager Configuration

```yaml
# alertmanager/config.yml
global:
  resolve_timeout: 5m
  slack_api_url: ${SLACK_WEBHOOK_URL}

route:
  group_by: ['alertname', 'severity', 'project']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'ops-team'

  routes:
    # CRITICAL alerts → PagerDuty + Slack
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true

    - match:
        severity: critical
      receiver: 'slack-critical'
      continue: false

    # WARNING alerts → Slack only
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: ${PAGERDUTY_SERVICE_KEY}
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
        details:
          firing: '{{ .Alerts.Firing | len }}'
          resolved: '{{ .Alerts.Resolved | len }}'
          runbook: '{{ .CommonAnnotations.runbook_url }}'

  - name: 'slack-critical'
    slack_configs:
      - channel: '#lcbp3-critical-alerts'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: |
          *Summary:* {{ .CommonAnnotations.summary }}
          *Description:* {{ .CommonAnnotations.description }}
          *Runbook:* {{ .CommonAnnotations.runbook_url }}
        color: 'danger'

  - name: 'slack-warnings'
    slack_configs:
      - channel: '#lcbp3-alerts'
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
        color: 'warning'

  - name: 'ops-team'
    email_configs:
      - to: 'ops@example.com'
        subject: '[LCBP3] {{ .GroupLabels.alertname }}'
```

### 3.4. Grafana Dashboard

Dashboard panels ที่สำคัญ:

1. **Lock Acquisition Success Rate** (Gauge)
   - Query: `1 - (rate(docnum_lock_acquisition_failures_total[5m]) / rate(docnum_lock_acquisition_total[5m]))`
   - Alert threshold: < 95%

2. **Lock Acquisition Time Percentiles** (Graph)
   - P50: `histogram_quantile(0.50, rate(docnum_lock_acquisition_duration_ms_bucket[5m]))`
   - P95: `histogram_quantile(0.95, rate(docnum_lock_acquisition_duration_ms_bucket[5m]))`
   - P99: `histogram_quantile(0.99, rate(docnum_lock_acquisition_duration_ms_bucket[5m]))`

3. **Generation Rate** (Stat)
   - Query: `sum(rate(docnum_generation_duration_ms_count[1m])) * 60`
   - Unit: documents/minute

4. **Error Rate by Type** (Graph)
   - Query: `sum by (reason) (rate(docnum_lock_acquisition_failures_total[5m]))`

5. **Redis Connection Status** (Stat)
   - Query: `docnum_redis_connection_status`
   - Thresholds: 0 = red, 1 = green

6. **DB Connection Pool Usage** (Gauge)
   - Query: `docnum_db_connection_pool_usage`
   - Alert threshold: > 80%

## 4. Troubleshooting Runbooks

### 4.1. Scenario: Redis Unavailable

**Symptoms:**
- Alert: `RedisUnavailable`
- System falls back to DB-only locking
- Performance degraded 30-50%

**Action Steps:**

1. **Check Redis status:**
   ```bash
   docker exec lcbp3-redis redis-cli ping
   # Expected: PONG
   ```

2. **Check Redis logs:**
   ```bash
   docker logs lcbp3-redis --tail=100
   ```

3. **Restart Redis (if needed):**
   ```bash
   docker restart lcbp3-redis
   ```

4. **Verify failover (if using Sentinel):**
   ```bash
   docker exec lcbp3-redis-sentinel redis-cli -p 26379 SENTINEL masters
   ```

5. **Monitor recovery:**
   - Check metric: `docnum_redis_connection_status` returns to 1
   - Check performance: P95 latency returns to normal (< 500ms)

### 4.2. Scenario: High Lock Failure Rate

**Symptoms:**
- Alert: `HighLockFailureRate` (> 10%)
- Users report "ระบบกำลังยุ่ง" errors

**Action Steps:**

1. **Check concurrent load:**
   ```bash
   # Check current request rate
   curl http://prometheus:9090/api/v1/query?query=rate(docnum_generation_duration_ms_count[1m])
   ```

2. **Check database connections:**
   ```sql
   SHOW PROCESSLIST;
   -- Look for waiting/locked queries
   ```

3. **Check Redis memory:**
   ```bash
   docker exec lcbp3-redis redis-cli INFO memory
   ```

4. **Scale up if needed:**
   ```bash
   # Increase backend replicas
   docker-compose up -d --scale backend=5
   ```

5. **Check for deadlocks:**
   ```sql
   SHOW ENGINE INNODB STATUS;
   -- Look for LATEST DETECTED DEADLOCK section
   ```

### 4.3. Scenario: Slow Performance

**Symptoms:**
- Alert: `SlowDocumentNumberGeneration`
- P95 > 2 seconds

**Action Steps:**

1. **Check database query performance:**
   ```sql
   SELECT * FROM document_number_counters USE INDEX (idx_counter_lookup)
   WHERE project_id = 2 AND correspondence_type_id = 6 AND current_year = 2025;

   -- Check execution plan
   EXPLAIN SELECT ...;
   ```

2. **Check for missing indexes:**
   ```sql
   SHOW INDEX FROM document_number_counters;
   ```

3. **Check Redis latency:**
   ```bash
   docker exec lcbp3-redis redis-cli --latency
   ```

4. **Check network latency:**
   ```bash
   ping mariadb-master
   ping redis-master
   ```

5. **Review slow query log:**
   ```bash
   docker exec lcbp3-mariadb-master cat /var/log/mysql/slow.log
   ```

### 4.4. Scenario: Version Conflicts

**Symptoms:**
- High retry count
- Users report "เลขที่เอกสารถูกเปลี่ยน" errors

**Action Steps:**

1. **Check concurrent requests to same counter:**
   ```sql
   SELECT
     project_id,
     correspondence_type_id,
     COUNT(*) as concurrent_requests
   FROM document_number_audit
   WHERE created_at > NOW() - INTERVAL 5 MINUTE
   GROUP BY project_id, correspondence_type_id
   HAVING COUNT(*) > 10
   ORDER BY concurrent_requests DESC;
   ```

2. **Investigate specific counter:**
   ```sql
   SELECT * FROM document_number_counters
   WHERE project_id = X AND correspondence_type_id = Y;

   -- Check audit trail
   SELECT * FROM document_number_audit
   WHERE counter_key LIKE '%project_id:X%'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

3. **Check for application bugs:**
   - Review error logs for stack traces
   - Check if retry logic is working correctly

4. **Temporary mitigation:**
   - Increase retry count in application config
   - Consider manual counter adjustment (last resort)

## 5. Maintenance Procedures

### 5.1. Counter Reset (Manual)

**Requires:** SUPER_ADMIN role + 2-person approval

**Steps:**

1. **Request approval via API:**
   ```bash
   POST /api/v1/document-numbering/configs/{configId}/reset-counter
   {
     "reason": "เหตุผลที่ชัดเจน อย่างน้อย 20 ตัวอักษร",
     "approver_1": "user_id",
     "approver_2": "user_id"
   }
   ```

2. **Verify in audit log:**
   ```sql
   SELECT * FROM document_number_config_history
   WHERE config_id = X
   ORDER BY changed_at DESC
   LIMIT 1;
   ```

### 5.2. Template Update

**Best Practices:**

1. Always test template in staging first
2. Preview generated numbers before applying
3. Document reason for change
4. Template changes do NOT affect existing documents

**API Call:**
```bash
PUT /api/v1/document-numbering/configs/{configId}
{
  "template": "{ORIGINATOR}-{RECIPIENT}-{SEQ:4}-{YEAR:B.E.}",
  "change_reason": "เหตุผลในการเปลี่ยนแปลง"
}
```

### 5.3. Database Maintenance

**Weekly Tasks:**
- Check slow query log
- Optimize tables if needed:
  ```sql
  OPTIMIZE TABLE document_number_counters;
  OPTIMIZE TABLE document_number_audit;
  ```

**Monthly Tasks:**
- Review and archive old audit logs (> 2 years)
- Check index usage:
  ```sql
  SELECT * FROM sys.schema_unused_indexes
  WHERE object_schema = 'lcbp3_db';
  ```

## 6. Backup & Recovery

### 6.1. Backup Strategy

**Database:**
- Full backup: Daily at 02:00 AM
- Incremental backup: Every 4 hours
- Retention: 30 days

**Redis:**
- AOF (Append-Only File) enabled
- Snapshot every 1 hour
- Retention: 7 days

### 6.2. Recovery Procedures

See: [Backup & Recovery Guide](file:///e:/np-dms/lcbp3/specs/04-operations/backup-recovery.md)

## References

- [Requirements](file:///e:/np-dms/lcbp3/specs/01-requirements/03.11-document-numbering.md)
- [Implementation Guide](file:///e:/np-dms/lcbp3/specs/03-implementation/document-numbering.md)
- [Monitoring & Alerting](file:///e:/np-dms/lcbp3/specs/04-operations/monitoring-alerting.md)
- [Incident Response](file:///e:/np-dms/lcbp3/specs/04-operations/incident-response.md)
