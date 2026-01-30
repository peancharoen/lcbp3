# Infrastructure Setup

> 📍 **Document Version:** v1.8.0
> 🖥️ **Primary Server:** QNAP TS-473A (Application & Database)
> 💾 **Backup Server:** ASUSTOR AS5403T (Infrastructure & Backup)

---

## Server Role Overview

| Component             | QNAP TS-473A                  | ASUSTOR AS5403T              |
| :-------------------- | :---------------------------- | :--------------------------- |
| **Redis/Cache**       | ✅ Primary (Section 1)         | ❌ Not deployed               |
| **Database**          | ✅ Primary MariaDB (Section 2) | ❌ Not deployed               |
| **Backend Service**   | ✅ NestJS API (Section 3)      | ❌ Not deployed               |
| **Monitoring**        | ❌ Exporters only              | ✅ Prometheus/Grafana         |
| **Backup Target**     | ❌ Source only                 | ✅ Backup storage (Section 5) |
| **Disaster Recovery** | ✅ Recovery target             | ✅ Backup source (Section 7)  |

> 📖 See [monitoring.md](monitoring.md) for ASUSTOR-specific monitoring setup

---

## 1. Redis Configuration (Standalone + Persistence)

### 1.1 Docker Compose Setup
```yaml
# docker-compose-redis.yml
version: '3.8'

services:
  redis:
    image: 'redis:7.2-alpine'
    container_name: lcbp3-redis
    restart: unless-stopped
    # AOF: Enabled for durability
    # Maxmemory: Prevent OOM
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD} --maxmemory 1gb --maxmemory-policy noeviction
    volumes:
      - ./redis/data:/data
    ports:
      - '6379:6379'
    networks:
      - lcbp3
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1.5G
networks:
  lcbp3-network:
    external: true
```


## 2. Database Configuration

### 2.1 MariaDB Optimization for Numbering
```sql
-- /etc/mysql/mariadb.conf.d/50-numbering.cnf

[mysqld]
# Connection pool
max_connections = 200
thread_cache_size = 50

# Query cache (disabled for InnoDB)
query_cache_type = 0
query_cache_size = 0

# InnoDB settings
innodb_buffer_pool_size = 4G
innodb_log_file_size = 512M
innodb_flush_log_at_trx_commit = 1
innodb_lock_wait_timeout = 50

# Performance Schema
performance_schema = ON
performance_schema_instrument = 'wait/lock/%=ON'

# Binary logging
log_bin = /var/log/mysql/mysql-bin.log
expire_logs_days = 7
max_binlog_size = 100M

# Slow query log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time = 1
```

### 2.2 Monitoring Locks
```sql
-- Check for lock contention
SELECT
  r.trx_id waiting_trx_id,
  r.trx_mysql_thread_id waiting_thread,
  r.trx_query waiting_query,
  b.trx_id blocking_trx_id,
  b.trx_mysql_thread_id blocking_thread,
  b.trx_query blocking_query
FROM information_schema.innodb_lock_waits w
INNER JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
INNER JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id;

-- Check active transactions
SELECT * FROM information_schema.innodb_trx;

-- Kill long-running transaction (if needed)
KILL <thread_id>;
```

---

## 3. Backend Service Configuration

### 3.1 Backend Service Deployment

#### Docker Compose
```yaml
# docker-compose-backend.yml
version: '3.8'

services:
  backend-1:
    image: lcbp3-backend:latest
    container_name: lcbp3-backend-1
    environment:
      - NODE_ENV=production
      - DB_HOST=mariadb-primary
      - REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,redis-3:6379
      - NUMBERING_LOCK_TIMEOUT=5000
      - NUMBERING_RESERVATION_TTL=300
    ports:
      - "3001:3000"
    depends_on:
      - mariadb-primary
      - redis-1
      - redis-2
      - redis-3
    networks:
      - lcbp3-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend-2:
    image: lcbp3-backend:latest
    container_name: lcbp3-backend-2
    environment:
      - NODE_ENV=production
      - DB_HOST=mariadb-primary
      - REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,redis-3:6379
    ports:
      - "3002:3000"
    depends_on:
      - mariadb-primary
      - redis-1
    networks:
      - lcbp3-network
    restart: unless-stopped

networks:
  lcbp3-network:
    external: true
```

#### Health Check Endpoint
```typescript
// health/numbering.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';

@Injectable()
export class NumberingHealthIndicator extends HealthIndicator {
  constructor(
    private redis: Redis,
    private dataSource: DataSource,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const checks = await Promise.all([
      this.checkRedis(),
      this.checkDatabase(),
      this.checkSequenceIntegrity(),
    ]);

    const isHealthy = checks.every((check) => check.status === 'up');

    return this.getStatus(key, isHealthy, { checks });
  }

  private async checkRedis(): Promise<any> {
    try {
      await this.redis.ping();
      return { name: 'redis', status: 'up' };
    } catch (error) {
      return { name: 'redis', status: 'down', error: error.message };
    }
  }

  private async checkDatabase(): Promise<any> {
    try {
      await this.dataSource.query('SELECT 1');
      return { name: 'database', status: 'up' };
    } catch (error) {
      return { name: 'database', status: 'down', error: error.message };
    }
  }

  private async checkSequenceIntegrity(): Promise<any> {
    try {
      const result = await this.dataSource.query(`
        SELECT COUNT(*) as count
        FROM document_numbering_sequences
        WHERE current_value > (
          SELECT max_value FROM document_numbering_configs
          WHERE id = config_id
        )
      `);

      const hasIssue = result[0].count > 0;

      return {
        name: 'sequence_integrity',
        status: hasIssue ? 'degraded' : 'up',
        exceeded_sequences: result[0].count,
      };
    } catch (error) {
      return { name: 'sequence_integrity', status: 'down', error: error.message };
    }
  }
}
```

---

## 4. Monitoring & Alerting

### 4.1 Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - "/etc/prometheus/alerts/numbering.yml"

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets:
          - 'backend-1:3000'
          - 'backend-2:3000'
    metrics_path: '/metrics'

  - job_name: 'redis-numbering'
    static_configs:
      - targets:
          - 'redis-1:6379'
          - 'redis-2:6379'
          - 'redis-3:6379'
    metrics_path: '/metrics'

  - job_name: 'mariadb'
    static_configs:
      - targets:
          - 'mariadb-exporter:9104'
```

### 4.2 Alert Manager Configuration

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'default'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true

    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#lcbp3-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

  - name: 'critical'
    email_configs:
      - to: 'devops@lcbp3.com'
        from: 'alerts@lcbp3.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@lcbp3.com'
        auth_password: 'your-password'
        headers:
          Subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'

    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'

  - name: 'warning'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#lcbp3-warnings'
```

### 4.3 Grafana Dashboards

#### Import Dashboard JSON
```bash
# Download dashboard template
curl -o numbering-dashboard.json \
  https://raw.githubusercontent.com/lcbp3/grafana-dashboards/main/numbering.json

# Import to Grafana
curl -X POST http://admin:admin@localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @numbering-dashboard.json
```

#### Key Panels to Monitor
1. **Numbers Generated per Minute** - Rate of number creation
2. **Sequence Utilization** - Current usage vs max (alert >90%)
3. **Lock Wait Time (p95)** - Performance indicator
4. **Lock Failures** - System health indicator
5. **Redis Cluster Health** - Node status
6. **Database Connection Pool** - Resource usage

---

## 5. Backup & Recovery

### 5.1 Database Backup Strategy

#### Automated Backup Script
```bash
#!/bin/bash
# scripts/backup-numbering-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/numbering"
DB_NAME="lcbp3_production"

echo "🔄 Starting backup at $DATE"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup numbering tables only
docker exec lcbp3-mariadb mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  $DB_NAME \
  document_numbering_configs \
  document_numbering_sequences \
  document_numbering_audit_logs \
  > $BACKUP_DIR/numbering_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/numbering_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "numbering_*.sql.gz" -mtime +30 -delete

echo "✅ Backup complete: numbering_$DATE.sql.gz"
```

#### Cron Schedule
```cron
# Run backup daily at 2 AM
0 2 * * * /opt/lcbp3/scripts/backup-numbering-db.sh >> /var/log/numbering-backup.log 2>&1

# Run integrity check weekly on Sunday at 3 AM
0 3 * * 0 /opt/lcbp3/scripts/check-sequence-integrity.sh >> /var/log/numbering-integrity.log 2>&1
```

### 5.2 Redis Backup

#### Enable RDB Persistence
```conf
# redis.conf
save 900 1      # Save if 1 key changed after 900 seconds
save 300 10     # Save if 10 keys changed after 300 seconds
save 60 10000   # Save if 10000 keys changed after 60 seconds

dbfilename dump.rdb
dir /data

# Enable AOF for durability
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
```

#### Backup Script
```bash
#!/bin/bash
# scripts/backup-redis.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/redis"

mkdir -p $BACKUP_DIR

for i in 1 2 3; do
  echo "Backing up redis-$i..."

  # Trigger BGSAVE
  docker exec lcbp3-redis-$i redis-cli -p 6379 BGSAVE

  # Wait for save to complete
  sleep 10

  # Copy RDB file
  docker cp lcbp3-redis-$i:/data/dump.rdb \
    $BACKUP_DIR/redis-${i}_${DATE}.rdb

  # Copy AOF file
  docker cp lcbp3-redis-$i:/data/appendonly.aof \
    $BACKUP_DIR/redis-${i}_${DATE}.aof
done

# Compress
tar -czf $BACKUP_DIR/redis_cluster_${DATE}.tar.gz $BACKUP_DIR/*_${DATE}.*

# Cleanup
rm $BACKUP_DIR/*_${DATE}.rdb $BACKUP_DIR/*_${DATE}.aof

echo "✅ Redis backup complete"
```

### 5.3 Recovery Procedures

#### Scenario 1: Restore from Database Backup
```bash
#!/bin/bash
# scripts/restore-numbering-db.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore-numbering-db.sh <backup_file>"
  exit 1
fi

echo "⚠️  WARNING: This will overwrite current numbering data!"
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted"
  exit 0
fi

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c $BACKUP_FILE > /tmp/restore.sql
  RESTORE_FILE="/tmp/restore.sql"
else
  RESTORE_FILE=$BACKUP_FILE
fi

# Restore
docker exec -i lcbp3-mariadb mysql lcbp3_production < $RESTORE_FILE

echo "✅ Restore complete"
echo "🔄 Please verify sequence integrity"
```

#### Scenario 2: Redis Node Failure
```bash
# Automatically handled by cluster
# Node will rejoin cluster when restarted

# Check cluster status
docker exec lcbp3-redis-1 redis-cli cluster info

# If node is failed, remove and add back
docker exec lcbp3-redis-1 redis-cli --cluster del-node <node-id>
docker exec lcbp3-redis-1 redis-cli --cluster add-node <new-node-ip>:6379 <cluster-ip>:6379
```

---

## 6. Maintenance Procedures

### 6.1 Sequence Adjustment

#### Increase Max Value
```sql
-- Check current utilization
SELECT
  dc.document_type,
  ds.current_value,
  dc.max_value,
  ROUND((ds.current_value * 100.0 / dc.max_value), 2) as utilization
FROM document_numbering_sequences ds
JOIN document_numbering_configs dc ON ds.config_id = dc.id
WHERE ds.current_value > dc.max_value * 0.8;

-- Increase max_value for type approaching limit
UPDATE document_numbering_configs
SET max_value = max_value * 10,
    updated_at = CURRENT_TIMESTAMP
WHERE document_type = 'COR'
  AND max_value < 9999999;

-- Audit log
INSERT INTO document_numbering_audit_logs (
  operation, document_type, old_value, new_value,
  user_id, metadata
) VALUES (
  'ADJUST_MAX_VALUE', 'COR', '999999', '9999999',
  1, '{"reason": "Approaching limit", "automated": false}'
);
```

#### Reset Yearly Sequence
```sql
-- For document types with yearly reset
-- Run on January 1st

START TRANSACTION;

-- Create new sequence for new year
INSERT INTO document_numbering_sequences (
  config_id,
  scope_value,
  current_value,
  last_used_at
)
SELECT
  id as config_id,
  YEAR(CURDATE()) as scope_value,
  0 as current_value,
  NULL as last_used_at
FROM document_numbering_configs
WHERE scope = 'YEARLY';

-- Verify
SELECT * FROM document_numbering_sequences
WHERE scope_value = YEAR(CURDATE());

COMMIT;
```

### 6.2 Cleanup Old Audit Logs

```sql
-- Archive logs older than 2 years
-- Run monthly

START TRANSACTION;

-- Create archive table (if not exists)
CREATE TABLE IF NOT EXISTS document_numbering_audit_logs_archive
LIKE document_numbering_audit_logs;

-- Move old logs to archive
INSERT INTO document_numbering_audit_logs_archive
SELECT * FROM document_numbering_audit_logs
WHERE timestamp < DATE_SUB(CURDATE(), INTERVAL 2 YEAR);

-- Delete from main table
DELETE FROM document_numbering_audit_logs
WHERE timestamp < DATE_SUB(CURDATE(), INTERVAL 2 YEAR);

-- Optimize table
OPTIMIZE TABLE document_numbering_audit_logs;

COMMIT;

-- Export archive to file (optional)
SELECT * FROM document_numbering_audit_logs_archive
INTO OUTFILE '/tmp/audit_archive_2023.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';
```

### 6.3 Redis Maintenance

#### Flush Expired Reservations
```bash
#!/bin/bash
# scripts/cleanup-expired-reservations.sh

echo "🧹 Cleaning up expired reservations..."

# Get all reservation keys
KEYS=$(docker exec lcbp3-redis-1 redis-cli --cluster call 172.20.0.2:6379 KEYS "reservation:*" | grep -v "(error)")

COUNT=0
for KEY in $KEYS; do
  # Check TTL
  TTL=$(docker exec lcbp3-redis-1 redis-cli TTL "$KEY")

  if [ "$TTL" -lt 0 ]; then
    # Delete expired key
    docker exec lcbp3-redis-1 redis-cli DEL "$KEY"
    ((COUNT++))
  fi
done

echo "✅ Cleaned up $COUNT expired reservations"
```

---

## 7. Disaster Recovery

### 7.1 Total System Failure

#### Recovery Steps
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

echo "🚨 Starting disaster recovery..."

# 1. Start Redis cluster
echo "1️⃣ Starting Redis cluster..."
docker-compose -f docker-compose-redis.yml up -d
sleep 30

# 2. Restore Redis backups
echo "2️⃣ Restoring Redis backups..."
./scripts/restore-redis.sh /backups/redis/latest.tar.gz

# 3. Start database
echo "3️⃣ Starting MariaDB..."
docker-compose -f docker-compose-db.yml up -d
sleep 30

# 4. Restore database
echo "4️⃣ Restoring database..."
./scripts/restore-numbering-db.sh /backups/db/latest.sql.gz

# 5. Verify sequence integrity
echo "5️⃣ Verifying sequence integrity..."
./scripts/check-sequence-integrity.sh

# 6. Start backend services
echo "6️⃣ Starting backend services..."
docker-compose -f docker-compose-backend.yml up -d

# 7. Run health checks
echo "7️⃣ Running health checks..."
sleep 60
for i in {1..5}; do
  curl -f http://localhost:3001/health || echo "Backend $i not healthy"
done

echo "✅ Disaster recovery complete"
echo "⚠️  Please verify system functionality manually"
```

### 7.2 RTO/RPO Targets

| Scenario                     | RTO     | RPO    | Priority |
| ---------------------------- | ------- | ------ | -------- |
| Single backend node failure  | 0 min   | 0      | P0       |
| Single Redis node failure    | 0 min   | 0      | P0       |
| Database primary failure     | 5 min   | 0      | P0       |
| Complete data center failure | 1 hour  | 15 min | P1       |
| Data corruption              | 4 hours | 1 day  | P2       |

---

## 8. Runbooks

### 8.1 High Sequence Utilization (>90%)

**Alert**: `SequenceWarning` or `SequenceCritical`

**Steps**:
1. Check current utilization
   ```sql
   SELECT document_type, current_value, max_value,
          ROUND((current_value * 100.0 / max_value), 2) as pct
   FROM document_numbering_sequences s
   JOIN document_numbering_configs c ON s.config_id = c.id
   WHERE current_value > max_value * 0.9;
   ```

2. Assess impact
   - How many numbers left?
   - Daily usage rate?
   - Days until exhaustion?

3. Take action
   ```sql
   -- Option A: Increase max_value
   UPDATE document_numbering_configs
   SET max_value = max_value * 10
   WHERE document_type = 'COR';

   -- Option B: Reset sequence (yearly types only)
   -- Schedule for next year/month
   ```

4. Notify stakeholders
5. Update monitoring thresholds if needed

---

### 8.2 High Lock Wait Time

**Alert**: `HighLockWaitTime`

**Steps**:
1. Check Redis cluster health
   ```bash
   docker exec lcbp3-redis-1 redis-cli cluster info
   docker exec lcbp3-redis-1 redis-cli cluster nodes
   ```

2. Check database locks
   ```sql
   SELECT * FROM information_schema.innodb_lock_waits;
   SELECT * FROM information_schema.innodb_trx
   WHERE trx_started < NOW() - INTERVAL 30 SECOND;
   ```

3. Identify bottleneck
   - Redis slow?
   - Database slow?
   - High concurrent load?

4. Take action based on cause:
   - **Redis**: Add more nodes, check network latency
   - **Database**: Optimize queries, increase connection pool
   - **High load**: Scale horizontally (add backend nodes)

5. Monitor improvements

---

### 8.3 Redis Cluster Down

**Alert**: `RedisUnavailable`

**Steps**:
1. Verify all nodes down
   ```bash
   for i in {1..3}; do
     docker exec lcbp3-redis-$i redis-cli ping || echo "Node $i DOWN"
   done
   ```

2. Check system falls back to DB-only mode
   ```bash
   curl http://localhost:3001/health/numbering
   # Should show: fallback_mode: true
   ```

3. Restart Redis cluster
   ```bash
   docker-compose -f docker-compose-redis.yml restart
   sleep 30
   ./scripts/check-redis-cluster.sh
   ```

4. If restart fails, restore from backup
   ```bash
   ./scripts/restore-redis.sh /backups/redis/latest.tar.gz
   ```

5. Verify numbering system back to normal
   ```bash
   curl http://localhost:3001/health/numbering
   # Should show: fallback_mode: false
   ```

6. Review logs for root cause

---

## 9. Performance Tuning

### 9.1 Slow Number Generation

**Diagnosis**:
```sql
-- Check slow queries
SELECT * FROM mysql.slow_log
WHERE sql_text LIKE '%document_numbering%'
ORDER BY query_time DESC
LIMIT 10;

-- Check index usage
EXPLAIN SELECT * FROM document_numbering_sequences
WHERE config_id = 1 AND scope_value = '2025'
FOR UPDATE;
```

**Optimizations**:
```sql
-- Add missing indexes
CREATE INDEX idx_sequence_lookup
ON document_numbering_sequences(config_id, scope_value);

-- Optimize table
OPTIMIZE TABLE document_numbering_sequences;

-- Update statistics
ANALYZE TABLE document_numbering_sequences;
```

### 8.2 Redis Memory Optimization

```bash
# Check memory usage
docker exec lcbp3-redis-1 redis-cli INFO memory

# If memory high, check keys
docker exec lcbp3-redis-1 redis-cli --bigkeys

# Set maxmemory policy
docker exec lcbp3-redis-1 redis-cli CONFIG SET maxmemory 2gb
docker exec lcbp3-redis-1 redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## 10. Security Hardening

### 10.1 Redis Security

```conf
# redis.conf
requirepass your-strong-redis-password
bind 0.0.0.0
protected-mode yes
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG "CONFIG_abc123"
```

### 10.2 Database Security

```sql
-- Create dedicated numbering user
CREATE USER 'numbering'@'%' IDENTIFIED BY 'strong-password';

-- Grant minimal permissions
GRANT SELECT, INSERT, UPDATE ON lcbp3_production.document_numbering_* TO 'numbering'@'%';
GRANT SELECT ON lcbp3_production.users TO 'numbering'@'%';

FLUSH PRIVILEGES;
```

### 10.3 Network Security

```yaml
# docker-compose-network.yml
networks:
  lcbp3-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
    driver_opts:
      com.docker.network.bridge.name: lcbp3-br
      com.docker.network.bridge.enable_icc: "true"
      com.docker.network.bridge.enable_ip_masquerade: "true"
```

---

## 11. Compliance & Audit

### 11.1 Audit Log Retention

```sql
-- Export audit logs for compliance
SELECT *
FROM document_numbering
