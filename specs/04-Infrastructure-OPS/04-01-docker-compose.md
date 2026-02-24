# 04.1 Infrastructure Setup & Docker Compose
**Project:** LCBP3-DMS
**Version:** 1.8.0
**Status:** Active
**Owner:** Nattanin Peancharoen / DevOps Team
**Last Updated:** 2026-02-23

> 📍 **Primary Server:** QNAP TS-473A (Application & Database)
> 💾 **Backup Server:** ASUSTOR AS5403T (Infrastructure & Backup)

---

## 📖 Overview

This document serves as the authoritative guide for the environment setup, Docker Compose configurations, and technical infrastructure operations for the LCBP3-DMS deployment. It combines configuration parameters, secrets management, database/cache optimizations, and disaster recovery procedures.

---

# Environment Setup & Configuration

**Project:** LCBP3-DMS
**Version:** 1.8.0
**Last Updated:** 2025-12-02

---

## 📋 Overview

This document describes environment variables, configuration files, and secrets management for LCBP3-DMS deployment.

---

## 🔐 Environment Variables

### Backend (.env)

```bash
# File: backend/.env (DO NOT commit to Git)

# Application
NODE_ENV=production
APP_PORT=3000
APP_URL=https://lcbp3-dms.example.com

# Database
DB_HOST=lcbp3-mariadb
DB_PORT=3306
DB_USER=lcbp3_user
DB_PASS=<STRONG_PASSWORD>
DB_NAME=lcbp3_dms

# Redis
REDIS_HOST=lcbp3-redis
REDIS_PORT=6379
REDIS_PASSWORD=<STRONG_PASSWORD>

# JWT Authentication
JWT_SECRET=<RANDOM_256_BIT_SECRET>
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=<RANDOM_256_BIT_SECRET>
JWT_REFRESH_EXPIRATION=7d

# File Storage
UPLOAD_DIR=/app/uploads
TEMP_UPLOAD_DIR=/app/uploads/temp
MAX_FILE_SIZE=104857600  # 100MB
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,dwg,jpg,png

# SMTP Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=<APP_PASSWORD>
SMTP_FROM="LCBP3-DMS System <noreply@example.com>"

# LINE Notify (Optional)
LINE_NOTIFY_ENABLED=true

# ClamAV Virus Scanner
CLAMAV_HOST=clamav
CLAMAV_PORT=3310

# Elasticsearch
ELASTICSEARCH_NODE=http://lcbp3-elasticsearch:9200
ELASTICSEARCH_INDEX_PREFIX=lcbp3_

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/app/logs

# Frontend URL (for email links)
FRONTEND_URL=https://lcbp3-dms.example.com

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

### Frontend (.env.local)

```bash
# File: frontend/.env.local (DO NOT commit to Git)

# API Backend
NEXT_PUBLIC_API_URL=https://lcbp3-dms.example.com/api

# Application
NEXT_PUBLIC_APP_NAME=LCBP3-DMS
NEXT_PUBLIC_APP_VERSION=1.8.0

# Feature Flags
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_LINE_NOTIFY=true
```

---

## 🐳 Docker Compose Configuration

### Production docker-compose.yml

```yaml
# File: docker-compose.yml
version: '3.8'

services:
  # NGINX Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: lcbp3-nginx
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx-logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
    networks:
      - lcbp3-network

  # NestJS Backend
  backend:
    image: lcbp3-backend:latest
    container_name: lcbp3-backend
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env
    volumes:
      - uploads:/app/uploads
      - backend-logs:/app/logs
    depends_on:
      - mariadb
      - redis
      - elasticsearch
    restart: unless-stopped
    networks:
      - lcbp3-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  # Next.js Frontend
  frontend:
    image: lcbp3-frontend:latest
    container_name: lcbp3-frontend
    environment:
      - NODE_ENV=production
    env_file:
      - ./frontend/.env.local
    restart: unless-stopped
    networks:
      - lcbp3-network

  # MariaDB Database
  mariadb:
    image: mariadb:11.8
    container_name: lcbp3-mariadb
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASS}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASS}
    volumes:
      - mariadb-data:/var/lib/mysql
      - ./mariadb/init:/docker-entrypoint-initdb.d:ro
    ports:
      - '3306:3306'
    restart: unless-stopped
    networks:
      - lcbp3-network
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

  # Redis Cache & Queue
  redis:
    image: redis:7.2-alpine
    container_name: lcbp3-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    ports:
      - '6379:6379'
    restart: unless-stopped
    networks:
      - lcbp3-network

  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: lcbp3-elasticsearch
    environment:
      - discovery.type=single-node
      - 'ES_JAVA_OPTS=-Xms512m -Xmx512m'
      - xpack.security.enabled=false
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    ports:
      - '9200:9200'
    restart: unless-stopped
    networks:
      - lcbp3-network

  # ClamAV (Optional - for virus scanning)
  clamav:
    image: clamav/clamav:latest
    container_name: lcbp3-clamav
    restart: unless-stopped
    networks:
      - lcbp3-network

networks:
  lcbp3-network:
    driver: bridge

volumes:
  mariadb-data:
  redis-data:
  elasticsearch-data:
  uploads:
  backend-logs:
  nginx-logs:
```

### Development docker-compose.override.yml

```yaml
# File: docker-compose.override.yml (Local development only)
# Add to .gitignore
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    ports:
      - '3000:3000'
      - '9229:9229' # Node.js debugger

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    ports:
      - '3001:3000'

  mariadb:
    ports:
      - '3307:3306' # Avoid conflict with local MySQL

  redis:
    ports:
      - '6380:6379'

  elasticsearch:
    environment:
      - 'ES_JAVA_OPTS=-Xms256m -Xmx256m' # Lower memory for dev
```

---

## 🔑 Secrets Management

### Using Docker Secrets (Recommended for Production)

```yaml
# docker-compose.yml
services:
  backend:
   secrets:
      - db_password
      - jwt_secret
    environment:
      DB_PASS_FILE: /run/secrets/db_password
      JWT_SECRET_FILE: /run/secrets/jwt_secret

secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

### Generate Strong Secrets

```bash
# Generate JWT Secret
openssl rand -base64 64

# Generate Database Password
openssl rand -base64 32

# Generate Redis Password
openssl rand -base64 32
```

---

## 📁 Directory Structure

```
lcbp3/
├── backend/
│   ├── .env                 # Backend environment (DO NOT commit)
│   ├── .env.example         # Example template (commit this)
│   └── ...
├── frontend/
│   ├── .env.local           # Frontend environment (DO NOT commit)
│   ├── .env.example         # Example template
│   └── ...
├── nginx/
│   ├── nginx.conf
│   └── ssl/
│       ├── cert.pem
│       └── key.pem
├── secrets/                 # Docker secrets (DO NOT commit)
│   ├── db_password.txt
│   ├── jwt_secret.txt
│   └── redis_password.txt
├── docker-compose.yml       # Production config
└── docker-compose.override.yml  # Development config (DO NOT commit)
```

---

## ⚙️ Configuration Management

### Environment-Specific Configs

**Development:**

```bash
NODE_ENV=development
LOG_LEVEL=debug
DB_HOST=localhost
```

**Staging:**

```bash
NODE_ENV=staging
LOG_LEVEL=info
DB_HOST=staging-db.internal
```

**Production:**

```bash
NODE_ENV=production
LOG_LEVEL=warn
DB_HOST=prod-db.internal
```

### Configuration Validation

Backend validates environment variables at startup:

```typescript
// File: backend/src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  // ...
});
```

---

## 🔒 Security Best Practices

### DO:

- ✅ Use strong, random passwords (minimum 32 characters)
- ✅ Rotate secrets every 90 days
- ✅ Use Docker secrets for production
- ✅ Add `.env` files to `.gitignore`
- ✅ Provide `.env.example` templates
- ✅ Validate environment variables at startup

### DON'T:

- ❌ Commit `.env` files to Git
- ❌ Use weak or default passwords
- ❌ Share production credentials via email/chat
- ❌ Reuse passwords across environments
- ❌ Hardcode secrets in source code

---

## 🛠️ Troubleshooting

### Common Issues

**Backend can't connect to database:**

```bash
# Check database container is running
docker ps | grep mariadb

# Check database logs
docker logs lcbp3-mariadb

# Verify credentials
docker exec lcbp3-backend env | grep DB_
```

**Redis connection refused:**

```bash
# Test Redis connection
docker exec lcbp3-redis redis-cli -a <PASSWORD> ping
# Should return: PONG
```

**Environment variable not loading:**

```bash
# Check if env file exists
ls -la backend/.env

# Check if backend loaded the env
docker exec lcbp3-backend env | grep NODE_ENV
```

---

## 📚 Related Documents

- [Deployment Guide](04-01-deployment-guide.md)
- [Security Operations](04-06-security-operations.md)
- [ADR-005: Technology Stack](../05-decisions/ADR-005-technology-stack.md)

---

**Version:** 1.8.0
**Last Review:** 2025-12-01
**Next Review:** 2026-03-01


---

# Infrastructure Setup

> 📍 **Document Version:** v1.8.0
> 🖥️ **Primary Server:** QNAP TS-473A (Application & Database)
> 💾 **Backup Server:** ASUSTOR AS5403T (Infrastructure & Backup)

---

## Overview

> 📖 **ดูรายละเอียด Server Roles และ Service Distribution ได้ที่:** [README.md](README.md#-hardware-infrastructure)
>
> เอกสารนี้มุ่งเน้นการตั้งค่า Technical Configuration สำหรับแต่ละ Service

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
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD} --maxmemory 1gb --maxmemory-policy allkeys-lru
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
  lcbp3:
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
      - DB_HOST=mariadb
      - REDIS_HOST=cache
      - REDIS_PORT=6379
      - NUMBERING_LOCK_TIMEOUT=5000
      - NUMBERING_RESERVATION_TTL=300
    ports:
      - "3001:3000"
    depends_on:
      - mariadb
      - cache
    networks:
      - lcbp3
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
      - DB_HOST=mariadb
      - REDIS_HOST=cache
      - REDIS_PORT=6379
    ports:
      - "3002:3000"
    depends_on:
      - mariadb
      - cache
    networks:
      - lcbp3
    restart: unless-stopped

networks:
  lcbp3:
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
5. **Redis Health (Single instance)** - Node status
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

echo "Backing up Redis..."

# Trigger BGSAVE
docker exec cache redis-cli BGSAVE

# Wait for save to complete
sleep 10

# Copy RDB file
docker cp cache:/data/dump.rdb \
  $BACKUP_DIR/redis_${DATE}.rdb

# Copy AOF file
docker cp cache:/data/appendonly.aof \
  $BACKUP_DIR/redis_${DATE}.aof

# Compress
tar -czf $BACKUP_DIR/redis_${DATE}.tar.gz \
  $BACKUP_DIR/redis_${DATE}.rdb \
  $BACKUP_DIR/redis_${DATE}.aof

# Cleanup
rm $BACKUP_DIR/redis_${DATE}.rdb $BACKUP_DIR/redis_${DATE}.aof

echo "✅ Redis backup complete: redis_${DATE}.tar.gz"
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

#### Scenario 2: Redis Failure
```bash
# Check Redis status
docker exec cache redis-cli ping

# If Redis is down, restart container
docker restart cache

# Verify Redis is running
docker exec cache redis-cli ping

# If restart fails, restore from backup
./scripts/restore-redis.sh /backups/redis/latest.tar.gz
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

### 8.3 Redis Down

**Alert**: `RedisUnavailable`

**Steps**:
1. Verify Redis is down
   ```bash
   docker exec cache redis-cli ping || echo "Redis DOWN"
   ```

2. Check system falls back to DB-only mode
   ```bash
   curl http://localhost:3001/health/numbering
   # Should show: fallback_mode: true
   ```

3. Restart Redis container
   ```bash
   docker restart cache
   sleep 10
   docker exec cache redis-cli ping
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
   ```bash
   docker logs cache --tail 100
   ```

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

### 9.2 Redis Memory Optimization

```bash
# Check memory usage
docker exec cache redis-cli INFO memory

# If memory high, check keys
docker exec cache redis-cli --bigkeys

# Set maxmemory policy
docker exec cache redis-cli CONFIG SET maxmemory 2gb
docker exec cache redis-cli CONFIG SET maxmemory-policy allkeys-lru
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
  lcbp3:
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

---

# Appendix A — Live QNAP Production Configs

> 🖥️ **Server:** QNAP TS-473A · Path: `/share/np-dms/`
> These are the **actual running Docker Compose configurations** on QNAP Container Station (v1.8.0).
> They differ from the generic Blue-Green templates above in that they use the real `lcbp3` Docker external network.

---

## A.1 Database Stack (`lcbp3-db`)

> **Path:** `/share/np-dms/mariadb/docker-compose.yml`
> **Application name:** `lcbp3-db` — Services: `mariadb`, `pma`

### Pre-requisite: File Permissions

```bash
chown -R 999:999 /share/np-dms/mariadb
chmod -R 755 /share/np-dms/mariadb
setfacl -R -m u:999:rwx /share/np-dms/mariadb

# phpMyAdmin (UID 33)
chown -R 33:33 /share/np-dms/pma/tmp
chmod 755 /share/np-dms/pma/tmp

# Add Prometheus exporter user
# docker exec -it mariadb mysql -u root -p
# CREATE USER 'exporter'@'%' IDENTIFIED BY '<PASSWORD>' WITH MAX_USER_CONNECTIONS 3;
# GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';
# FLUSH PRIVILEGES;
```

### Add Databases for NPM & Gitea

```sql
-- Nginx Proxy Manager
CREATE DATABASE npm;
CREATE USER 'npm'@'%' IDENTIFIED BY 'npm';
GRANT ALL PRIVILEGES ON npm.* TO 'npm'@'%';
FLUSH PRIVILEGES;

-- Gitea
CREATE DATABASE gitea CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci';
CREATE USER 'gitea'@'%' IDENTIFIED BY '<PASSWORD>';
GRANT ALL PRIVILEGES ON gitea.* TO 'gitea'@'%';
FLUSH PRIVILEGES;
```

```yaml
# /share/np-dms/mariadb/docker-compose.yml
x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"

networks:
  lcbp3:
    external: true

services:
  mariadb:
    <<: [*restart_policy, *default_logging]
    image: mariadb:11.8
    container_name: mariadb
    stdin_open: true
    tty: true
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 4G
        reservations:
          cpus: "0.5"
          memory: 1G
    environment:
      MYSQL_ROOT_PASSWORD: "<ROOT_PASSWORD>"
      MYSQL_DATABASE: "lcbp3"
      MYSQL_USER: "center"
      MYSQL_PASSWORD: "<PASSWORD>"
      TZ: "Asia/Bangkok"
    ports:
      - "3306:3306"
    networks:
      - lcbp3
    volumes:
      - "/share/np-dms/mariadb/data:/var/lib/mysql"
      - "/share/np-dms/mariadb/my.cnf:/etc/mysql/conf.d/my.cnf:ro"
      - "/share/np-dms/mariadb/init:/docker-entrypoint-initdb.d:ro"
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

  pma:
    <<: [*restart_policy, *default_logging]
    image: phpmyadmin:5-apache
    container_name: pma
    deploy:
      resources:
        limits:
          cpus: "0.25"
          memory: 256M
    environment:
      TZ: "Asia/Bangkok"
      PMA_HOST: "mariadb"
      PMA_PORT: "3306"
      PMA_ABSOLUTE_URI: "https://pma.np-dms.work/"
      UPLOAD_LIMIT: "1G"
      MEMORY_LIMIT: "512M"
    ports:
      - "89:80"
    networks:
      - lcbp3
    volumes:
      - "/share/np-dms/pma/config.user.inc.php:/etc/phpmyadmin/config.user.inc.php:ro"
      - "/share/np-dms/pma/tmp:/var/lib/phpmyadmin/tmp:rw"
    depends_on:
      mariadb:
        condition: service_healthy
```

---

## A.2 Cache + Search Stack (`services`)

> **Path:** `/share/np-dms/services/docker-compose.yml`
> **Application name:** `services` — Services: `cache` (Redis 7.2), `search` (Elasticsearch 8.11)

### Pre-requisite: File Permissions

```bash
mkdir -p /share/np-dms/services/cache/data
mkdir -p /share/np-dms/services/search/data

# Redis (UID 999)
chown -R 999:999 /share/np-dms/services/cache/data
chmod -R 750 /share/np-dms/services/cache/data

# Elasticsearch (UID 1000)
chown -R 1000:1000 /share/np-dms/services/search/data
chmod -R 750 /share/np-dms/services/search/data
```

```yaml
# /share/np-dms/services/docker-compose.yml
x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"

networks:
  lcbp3:
    external: true

services:
  cache:
    <<: [*restart_policy, *default_logging]
    image: redis:7-alpine
    container_name: cache
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 2G
        reservations:
          cpus: "0.25"
          memory: 512M
    environment:
      TZ: "Asia/Bangkok"
    ports:
      - "6379:6379"
    networks:
      - lcbp3
    volumes:
      - "/share/np-dms/services/cache/data:/data"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  search:
    <<: [*restart_policy, *default_logging]
    image: elasticsearch:8.11.1
    container_name: search
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 4G
        reservations:
          cpus: "0.5"
          memory: 2G
    environment:
      TZ: "Asia/Bangkok"
      discovery.type: "single-node"
      xpack.security.enabled: "false"
      # Heap locked at 1GB per ADR-005
      ES_JAVA_OPTS: "-Xms1g -Xmx1g"
    ports:
      - "9200:9200"
    networks:
      - lcbp3
    volumes:
      - "/share/np-dms/services/search/data:/usr/share/elasticsearch/data"
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"green\"\\|\"status\":\"yellow\"'"]
      interval: 30s
      timeout: 10s
      retries: 5
```

---

## A.3 Nginx Proxy Manager (`lcbp3-npm`)

> **Path:** `/share/np-dms/npm/docker-compose.yml`
> **Application name:** `lcbp3-npm` — Services: `npm`, `landing`

### NPM Proxy Host Config Reference

| Domain                | Forward Host | Port | Cache | Block Exploits | WebSocket | SSL  |
| :-------------------- | :----------- | :--- | :---- | :------------- | :-------- | :--- |
| `backend.np-dms.work` | `backend`    | 3000 | ❌     | ✅              | ❌         | ✅    |
| `lcbp3.np-dms.work`   | `frontend`   | 3000 | ✅     | ✅              | ✅         | ✅    |
| `git.np-dms.work`     | `gitea`      | 3000 | ✅     | ✅              | ✅         | ✅    |
| `n8n.np-dms.work`     | `n8n`        | 5678 | ✅     | ✅              | ✅         | ✅    |
| `chat.np-dms.work`    | `rocketchat` | 3000 | ✅     | ✅              | ✅         | ✅    |
| `npm.np-dms.work`     | `npm`        | 81   | ❌     | ✅              | ✅         | ✅    |
| `pma.np-dms.work`     | `pma`        | 80   | ✅     | ✅              | ❌         | ✅    |

```yaml
# /share/np-dms/npm/docker-compose.yml
x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"

networks:
  lcbp3:
    external: true
  giteanet:
    external: true
    name: gitnet

services:
  npm:
    <<: [*restart_policy, *default_logging]
    image: jc21/nginx-proxy-manager:latest
    container_name: npm
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    environment:
      TZ: "Asia/Bangkok"
      DB_MYSQL_HOST: "mariadb"
      DB_MYSQL_PORT: 3306
      DB_MYSQL_USER: "npm"
      DB_MYSQL_PASSWORD: "npm"
      DB_MYSQL_NAME: "npm"
      DISABLE_IPV6: "true"
    networks:
      - lcbp3
      - giteanet
    volumes:
      - "/share/np-dms/npm/data:/data"
      - "/share/np-dms/npm/letsencrypt:/etc/letsencrypt"
      - "/share/np-dms/npm/custom:/data/nginx/custom"

  landing:
    image: nginx:1.27-alpine
    container_name: landing
    restart: unless-stopped
    volumes:
      - "/share/np-dms/npm/landing:/usr/share/nginx/html:ro"
    networks:
      - lcbp3
```

---

## A.4 Gitea (`git`)

> **Path:** `/share/np-dms/git/docker-compose.yml`
> **Application name:** `git` — Service: `gitea` (rootless)

### Pre-requisite: File Permissions

```bash
chown -R 1000:1000 /share/np-dms/gitea/
setfacl -m u:1000:rwx /share/np-dms/gitea/etc \
        /share/np-dms/gitea/lib \
        /share/np-dms/gitea/backup
```

```yaml
# /share/np-dms/git/docker-compose.yml
networks:
  lcbp3:
    external: true
  giteanet:
    external: true
    name: gitnet

services:
  gitea:
    image: gitea/gitea:latest-rootless
    container_name: gitea
    restart: always
    environment:
      USER_UID: "1000"
      USER_GID: "1000"
      TZ: Asia/Bangkok
      GITEA__server__ROOT_URL: https://git.np-dms.work/
      GITEA__server__DOMAIN: git.np-dms.work
      GITEA__server__SSH_DOMAIN: git.np-dms.work
      GITEA__server__START_SSH_SERVER: "true"
      GITEA__server__SSH_PORT: "22"
      GITEA__server__SSH_LISTEN_PORT: "22"
      GITEA__server__LFS_START_SERVER: "true"
      GITEA__server__HTTP_PORT: "3000"
      GITEA__server__TRUSTED_PROXIES: "127.0.0.1/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
      GITEA__database__DB_TYPE: mysql
      GITEA__database__HOST: mariadb:3306
      GITEA__database__NAME: "gitea"
      GITEA__database__USER: "gitea"
      GITEA__database__PASSWD: "<PASSWORD>"
      GITEA__packages__ENABLED: "true"
      GITEA__security__INSTALL_LOCK: "true"
    volumes:
      - /share/np-dms/gitea/backup:/backup
      - /share/np-dms/gitea/etc:/etc/gitea
      - /share/np-dms/gitea/lib:/var/lib/gitea
      - /share/np-dms/gitea/gitea_repos:/var/lib/gitea/git/repositories
      - /share/np-dms/gitea/gitea_registry:/data/registry
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "3003:3000"
      - "2222:22"
    networks:
      - lcbp3
      - giteanet
```

---

## A.5 n8n Automation

> **Path:** `/share/np-dms/n8n/docker-compose.yml`

```bash
chown -R 1000:1000 /share/np-dms/n8n
chmod -R 755 /share/np-dms/n8n
```

```yaml
# /share/np-dms/n8n/docker-compose.yml
x-restart: &restart_policy
  restart: unless-stopped

x-logging: &default_logging
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "5"

networks:
  lcbp3:
    external: true

services:
  n8n:
    <<: [*restart_policy, *default_logging]
    image: n8nio/n8n:latest
    container_name: n8n
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 2G
        reservations:
          cpus: "0.25"
          memory: 512M
    environment:
      TZ: "Asia/Bangkok"
      NODE_ENV: "production"
      N8N_PUBLIC_URL: "https://n8n.np-dms.work/"
      WEBHOOK_URL: "https://n8n.np-dms.work/"
      N8N_HOST: "n8n.np-dms.work"
      N8N_PORT: 5678
      N8N_PROTOCOL: "https"
      N8N_PROXY_HOPS: "1"
      N8N_DIAGNOSTICS_ENABLED: 'false'
      N8N_SECURE_COOKIE: 'true'
      # N8N_ENCRYPTION_KEY should be kept in .env (gitignored)
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true'
      DB_TYPE: mysqldb
      DB_MYSQLDB_DATABASE: "n8n"
      DB_MYSQLDB_USER: "center"
      DB_MYSQLDB_HOST: "mariadb"
      DB_MYSQLDB_PORT: 3306
    ports:
      - "5678:5678"
    networks:
      lcbp3: {}
    volumes:
      - "/share/np-dms/n8n:/home/node/.n8n"
      - "/share/np-dms/n8n/cache:/home/node/.cache"
      - "/share/np-dms/n8n/scripts:/scripts"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:5678/"]
      interval: 15s
      timeout: 5s
      retries: 30
```

---

## A.6 Application Stack (`lcbp3-app`)

> **Path:** `/share/np-dms/app/docker-compose.yml`
> See the annotated version in [`04-Infrastructure-OPS/docker-compose-app.yml`](./docker-compose-app.yml)

This stack contains `backend` (NestJS) and `frontend` (Next.js).
Refer to [04-04-deployment-guide.md](./04-04-deployment-guide.md) for full deployment steps and CI/CD pipeline details.

