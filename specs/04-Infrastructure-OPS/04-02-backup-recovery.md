# 04.2 Backup & Disaster Recovery
**Project:** LCBP3-DMS
**Version:** 1.8.0
**Status:** Active
**Owner:** Nattanin Peancharoen / DevOps Team
**Last Updated:** 2026-02-23

> 📍 **Backup Target Server:** ASUSTOR AS5403T (Infrastructure & Backup)
> 🖥️ **Primary Source Server:** QNAP TS-473A (Application & Database)

---

## 📖 Overview

This document outlines the backup strategies, scripts (ASUSTOR pulling from QNAP), recovery procedures, and comprehensive disaster recovery planning for LCBP3-DMS.

---

# Backup & Recovery Procedures

**Project:** LCBP3-DMS
**Version:** 1.8.0
**Last Updated:** 2025-12-02

---

## 📋 Overview

This document outlines backup strategies, recovery procedures, and disaster recovery planning for LCBP3-DMS.

---

## 🎯 Backup Strategy

### Backup Schedule

| Data Type              | Frequency      | Retention | Method                  |
| ---------------------- | -------------- | --------- | ----------------------- |
| Database (Full)        | Daily at 02:00 | 30 days   | mysqldump + compression |
| Database (Incremental) | Every 6 hours  | 7 days    | Binary logs             |
| File Uploads           | Daily at 03:00 | 30 days   | rsync to backup server  |
| Configuration Files    | Weekly         | 90 days   | Git repository          |
| Elasticsearch Indexes  | Weekly         | 14 days   | Snapshot to S3/NFS      |
| Application Logs       | Daily          | 90 days   | Rotation + archival     |

### Backup Locations

**Primary Backup:** QNAP NAS `/backup/lcbp3-dms`
**Secondary Backup:** External backup server (rsync)
**Offsite Backup:** Cloud storage (optional - for critical data)

---

## 💾 Database Backup

### Automated Daily Backup Script

```bash
#!/bin/bash
# File: /scripts/backup-database.sh

# Configuration
BACKUP_DIR="/backup/lcbp3-dms/database"
DB_CONTAINER="lcbp3-mariadb"
DB_NAME="lcbp3_dms"
DB_USER="backup_user"
DB_PASS="<BACKUP_USER_PASSWORD>"
RETENTION_DAYS=30

# Create backup directory
BACKUP_FILE="$BACKUP_DIR/lcbp3_$(date +%Y%m%d_%H%M%S).sql.gz"
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Starting database backup to $BACKUP_FILE"
docker exec $DB_CONTAINER mysqldump \
  --user=$DB_USER \
  --password=$DB_PASS \
  --single-transaction \
  --routines \
  --triggers \
  --databases $DB_NAME \
  | gzip > "$BACKUP_FILE"

# Check backup success
if [ $? -eq 0 ]; then
  echo "Backup completed successfully"

  # Delete old backups
  find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
  echo "Old backups cleaned up (retention: $RETENTION_DAYS days)"
else
  echo "ERROR: Backup failed!"
  exit 1
fi
```

### Schedule with Cron

```bash
# Edit crontab
crontab -e

# Add backup job (runs daily at 2 AM)
0 2 * * * /scripts/backup-database.sh >> /var/log/backup-database.log 2>&1
```

### Manual Database Backup

```bash
# Backup specific database
docker exec lcbp3-mariadb mysqldump \
  -u root -p \
  --single-transaction \
  lcbp3_dms > backup_$(date +%Y%m%d).sql

# Compress backup
gzip backup_$(date +%Y%m%d).sql
```

---

## 📂 File Uploads Backup

### Automated Rsync Backup

```bash
#!/bin/bash
# File: /scripts/backup-uploads.sh

SOURCE="/var/lib/docker/volumes/lcbp3_uploads/_data"
DEST="/backup/lcbp3-dms/uploads"
RETENTION_DAYS=30

# Create incremental backup with rsync
rsync -av --delete \
  --backup --backup-dir="$DEST/backup-$(date +%Y%m%d)" \
  "$SOURCE/" "$DEST/current/"

# Cleanup old backups
find "$DEST" -maxdepth 1 -type d -name "backup-*" -mtime +$RETENTION_DAYS -exec rm -rf {} \;

echo "Upload backup completed: $(date)"
```

### Schedule Uploads Backup

```bash
# Run daily at 3 AM
0 3 * * * /scripts/backup-uploads.sh >> /var/log/backup-uploads.log 2>&1
```

---

## 🔄 Database Recovery

### Full Database Restore

```bash
# Step 1: Stop backend application
docker stop lcbp3-backend

# Step 2: Restore database from backup
gunzip < backup_20241201.sql.gz | \
  docker exec -i lcbp3-mariadb mysql -u root -p lcbp3_dms

# Step 3: Verify restore
docker exec lcbp3-mariadb mysql -u root -p -e "
  USE lcbp3_dms;
  SELECT COUNT(*) FROM users;
  SELECT COUNT(*) FROM correspondences;
"

# Step 4: Restart backend
docker start lcbp3-backend
```

### Point-in-Time Recovery (Using Binary Logs)

```bash
# Step 1: Restore last full backup
gunzip < backup_20241201_020000.sql.gz | \
  docker exec -i lcbp3-mariadb mysql -u root -p lcbp3_dms

# Step 2: Apply binary logs since backup
docker exec lcbp3-mariadb mysqlbinlog \
  --start-datetime="2024-12-01 02:00:00" \
  --stop-datetime="2024-12-01 14:30:00" \
  /var/lib/mysql/mysql-bin.000001 | \
  docker exec -i lcbp3-mariadb mysql -u root -p lcbp3_dms
```

---

## 📁 File Uploads Recovery

### Restore from Backup

```bash
# Stop backend to prevent file operations
docker stop lcbp3-backend

# Restore files
rsync -av \
  /backup/lcbp3-dms/uploads/current/ \
  /var/lib/docker/volumes/lcbp3_uploads/_data/

# Verify permissions
docker exec lcbp3-backend chown -R node:node /app/uploads

# Restart backend
docker start lcbp3-backend
```

---

## 🚨 Disaster Recovery Plan

### RTO & RPO

- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 24 hours (for files), 6 hours (for database)

### DR Scenarios

#### Scenario 1: Database Corruption

**Detection:** Database errors in logs, application errors
**Recovery Time:** 30 minutes
**Steps:**

1. Stop backend
2. Restore last full backup
3. Apply binary logs (if needed)
4. Verify data integrity
5. Restart services

#### Scenario 2: Complete Server Failure

**Detection:** Server unresponsive
**Recovery Time:** 4 hours
**Steps:**

1. Provision new QNAP server or VM
2. Install Docker & Container Station
3. Clone Git repository
4. Restore database backup
5. Restore file uploads
6. Deploy containers
7. Update DNS (if needed)
8. Verify functionality

#### Scenario 3: Ransomware Attack

**Detection:** Encrypted files, ransom note
**Recovery Time:** 6 hours
**Steps:**

1. **DO NOT pay ransom**
2. Isolate infected server
3. Provision clean environment
4. Restore from offsite backup
5. Scan restored backup for malware
6. Deploy and verify
7. Review security logs
8. Implement additional security measures

---

## ✅ Backup Verification

### Weekly Backup Testing

```bash
#!/bin/bash
# File: /scripts/test-backup.sh

# Create temporary test database
docker exec lcbp3-mariadb mysql -u root -p -e "
  CREATE DATABASE IF NOT EXISTS test_restore;
"

# Restore latest backup to test database
LATEST_BACKUP=$(ls -t /backup/lcbp3-dms/database/*.sql.gz | head -1)
gunzip < "$LATEST_BACKUP" | \
  sed 's/USE `lcbp3_dms`/USE `test_restore`/g' | \
  docker exec -i lcbp3-mariadb mysql -u root -p

# Verify table counts
docker exec lcbp3-mariadb mysql -u root -p -e "
  SELECT COUNT(*)  FROM test_restore.users;
  SELECT COUNT(*) FROM test_restore.correspondences;
"

# Cleanup
docker exec lcbp3-mariadb mysql -u root -p -e "
  DROP DATABASE test_restore;
"

echo "Backup verification completed: $(date)"
```

### Monthly DR Drill

- Test full system restore on standby server
- Document time taken and issues encountered
- Update DR procedures based on findings

---

## 📊 Backup Monitoring

### Backup Status Dashboard

Monitor:

- ✅ Last successful backup timestamp
- ✅ Backup file size (detect anomalies)
- ✅ Backup success/failure rate
- ✅ Available backup storage space

### Alerts

Send alert if:

- ❌ Backup fails
- ❌ Backup file size < 50% of average (possible corruption)
- ❌ No backup in last 48 hours
- ❌ Backup storage < 20% free

---

## 🔧 Maintenance

### Optimize Backup Performance

```sql
-- Enable InnoDB compression for large tables
ALTER TABLE correspondences ROW_FORMAT=COMPRESSED;
ALTER TABLE workflow_history ROW_FORMAT=COMPRESSED;

-- Archive old audit logs
-- Move records older than 1 year to archive table
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

DELETE FROM audit_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

---

## 📚 Backup Checklist

### Daily Tasks

- [ ] Verify automated backups completed
- [ ] Check backup log files for errors
- [ ] Monitor backup storage space

### Weekly Tasks

- [ ] Test restore from random backup
- [ ] Review backup size trends
- [ ] Verify offsite backups synced

### Monthly Tasks

- [ ] Full DR drill
- [ ] Review and update DR procedures
- [ ] Test backup restoration on different server

### Quarterly Tasks

- [ ] Audit backup access controls
- [ ] Review backup retention policies
- [ ] Update backup documentation

---

## 🔗 Related Documents

- [Deployment Guide](04-01-deployment-guide.md)
- [Monitoring & Alerting](04-03-monitoring-alerting.md)
- [Incident Response](04-07-incident-response.md)

---

**Version:** 1.8.0
**Last Review:** 2025-12-01
**Next Review:** 2026-03-01


---

# Backup Strategy สำหรับ LCBP3-DMS

> 📍 **Deploy on:** ASUSTOR AS5403T (Infrastructure Server)
> 🎯 **Backup Target:** QNAP TS-473A (Application & Database)
> 📄 **Version:** v1.8.0

---

## Overview

ระบบ Backup แบบ Pull-based: ASUSTOR ดึงข้อมูลจาก QNAP เพื่อความปลอดภัย
หาก QNAP ถูกโจมตี ผู้โจมตีจะไม่สามารถลบ Backup บน ASUSTOR ได้

```
┌─────────────────────────────────────────────────────────────────┐
│                     BACKUP ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   QNAP (Source)                    ASUSTOR (Backup Target)       │
│   192.168.10.8                     192.168.10.9                  │
│                                                                  │
│   ┌──────────────┐   SSH/Rsync    ┌──────────────────────┐       │
│   │  MariaDB     │ ─────────────▶ │  /volume1/backup/db/ │       │
│   │  (mysqldump) │   Daily 2AM    │  (Restic Repository) │       │
│   └──────────────┘                └──────────────────────┘       │
│                                                                  │
│   ┌──────────────┐                ┌──────────────────────┐       │
│   │  Redis RDB   │ ─────────────▶ │  /volume1/backup/    │       │
│   │  + AOF       │   Daily 3AM    │  redis/              │       │
│   └──────────────┘                └──────────────────────┘       │
│                                                                  │
│   ┌──────────────┐                ┌──────────────────────┐       │
│   │  App Config  │ ─────────────▶ │  /volume1/backup/    │       │
│   │  + Volumes   │   Weekly Sun   │  config/             │       │
│   └──────────────┘                └──────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. MariaDB Backup

### 1.1 Daily Database Backup Script

```bash
#!/bin/bash
# File: /volume1/np-dms/scripts/backup-mariadb.sh
# Run on: ASUSTOR (Pull from QNAP)

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/volume1/backup/db"
QNAP_IP="192.168.10.8"
DB_NAME="lcbp3_db"
DB_USER="root"
DB_PASSWORD="${MARIADB_ROOT_PASSWORD}"

echo "🔄 Starting MariaDB backup at $DATE"

# Create backup directory
mkdir -p $BACKUP_DIR

# Remote mysqldump via SSH
ssh admin@$QNAP_IP "docker exec mariadb mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  -u $DB_USER -p$DB_PASSWORD $DB_NAME" > $BACKUP_DIR/lcbp3_$DATE.sql

# Compress
gzip $BACKUP_DIR/lcbp3_$DATE.sql

# Add to Restic repository
restic -r $BACKUP_DIR/restic-repo backup $BACKUP_DIR/lcbp3_$DATE.sql.gz

# Keep only last 30 days of raw files
find $BACKUP_DIR -name "lcbp3_*.sql.gz" -mtime +30 -delete

echo "✅ MariaDB backup complete: lcbp3_$DATE.sql.gz"
```

### 1.2 Cron Schedule (ASUSTOR)

```cron
# MariaDB daily backup at 2 AM
0 2 * * * /volume1/np-dms/scripts/backup-mariadb.sh >> /var/log/backup-mariadb.log 2>&1
```

---

## 2. Redis Backup

### 2.1 Redis Backup Script

```bash
#!/bin/bash
# File: /volume1/np-dms/scripts/backup-redis.sh
# Run on: ASUSTOR (Pull from QNAP)

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/volume1/backup/redis"
QNAP_IP="192.168.10.8"

echo "🔄 Starting Redis backup at $DATE"

mkdir -p $BACKUP_DIR

# Trigger BGSAVE on QNAP Redis
ssh admin@$QNAP_IP "docker exec cache redis-cli BGSAVE"
sleep 10

# Copy RDB and AOF files
scp admin@$QNAP_IP:/share/np-dms/services/cache/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb
scp admin@$QNAP_IP:/share/np-dms/services/cache/data/appendonly.aof $BACKUP_DIR/redis_$DATE.aof

# Compress
tar -czf $BACKUP_DIR/redis_$DATE.tar.gz \
  $BACKUP_DIR/redis_$DATE.rdb \
  $BACKUP_DIR/redis_$DATE.aof

# Cleanup raw files
rm $BACKUP_DIR/redis_$DATE.rdb $BACKUP_DIR/redis_$DATE.aof

echo "✅ Redis backup complete: redis_$DATE.tar.gz"
```

### 2.2 Cron Schedule

```cron
# Redis daily backup at 3 AM
0 3 * * * /volume1/np-dms/scripts/backup-redis.sh >> /var/log/backup-redis.log 2>&1
```

---

## 3. Application Config Backup

### 3.1 Weekly Config Backup Script

```bash
#!/bin/bash
# File: /volume1/np-dms/scripts/backup-config.sh
# Run on: ASUSTOR (Pull from QNAP)

DATE=$(date +%Y%m%d)
BACKUP_DIR="/volume1/backup/config"
QNAP_IP="192.168.10.8"

echo "🔄 Starting config backup at $DATE"

mkdir -p $BACKUP_DIR

# Sync Docker compose files and configs
rsync -avz --delete \
  admin@$QNAP_IP:/share/np-dms/ \
  $BACKUP_DIR/np-dms_$DATE/ \
  --exclude='*/data/*' \
  --exclude='*/logs/*' \
  --exclude='node_modules'

# Compress
tar -czf $BACKUP_DIR/config_$DATE.tar.gz $BACKUP_DIR/np-dms_$DATE

# Cleanup
rm -rf $BACKUP_DIR/np-dms_$DATE

echo "✅ Config backup complete: config_$DATE.tar.gz"
```

### 3.2 Cron Schedule

```cron
# Config weekly backup on Sunday at 4 AM
0 4 * * 0 /volume1/np-dms/scripts/backup-config.sh >> /var/log/backup-config.log 2>&1
```

---

## 4. Retention Policy

| Backup Type | Frequency | Retention | Storage Est. |
| :---------- | :-------- | :-------- | :----------- |
| MariaDB     | Daily     | 30 days   | ~5GB/month   |
| Redis       | Daily     | 7 days    | ~500MB       |
| Config      | Weekly    | 4 weeks   | ~200MB       |
| Restic      | Daily     | 6 months  | Deduplicated |

---

## 5. Restic Repository Setup

```bash
# Initialize Restic repository (one-time)
restic init -r /volume1/backup/restic-repo

# Set password in environment
export RESTIC_PASSWORD="your-secure-backup-password"

# Check repository status
restic -r /volume1/backup/restic-repo snapshots

# Prune old snapshots (keep 30 daily, 4 weekly, 6 monthly)
restic -r /volume1/backup/restic-repo forget \
  --keep-daily 30 \
  --keep-weekly 4 \
  --keep-monthly 6 \
  --prune
```

---

## 6. Verification Script

```bash
#!/bin/bash
# File: /volume1/np-dms/scripts/verify-backup.sh

echo "📋 Backup Verification Report"
echo "=============================="
echo ""

# Check latest MariaDB backup
LATEST_DB=$(ls -t /volume1/backup/db/*.sql.gz 2>/dev/null | head -1)
if [ -n "$LATEST_DB" ]; then
  echo "✅ Latest DB backup: $LATEST_DB"
  echo "   Size: $(du -h $LATEST_DB | cut -f1)"
else
  echo "❌ No DB backup found!"
fi

# Check latest Redis backup
LATEST_REDIS=$(ls -t /volume1/backup/redis/*.tar.gz 2>/dev/null | head -1)
if [ -n "$LATEST_REDIS" ]; then
  echo "✅ Latest Redis backup: $LATEST_REDIS"
else
  echo "❌ No Redis backup found!"
fi

# Check Restic repository
echo ""
echo "📦 Restic Snapshots:"
restic -r /volume1/backup/restic-repo snapshots --latest 5
```

---

> 📝 **หมายเหตุ**: เอกสารนี้อ้างอิงจาก Architecture Document **v1.8.0**


---

# Disaster Recovery Plan สำหรับ LCBP3-DMS

> 📍 **Version:** v1.8.0
> 🖥️ **Primary Server:** QNAP TS-473A (Application & Database)
> 💾 **Backup Server:** ASUSTOR AS5403T (Infrastructure & Backup)

---

## RTO/RPO Targets

| Scenario                    | RTO     | RPO    | Priority |
| :-------------------------- | :------ | :----- | :------- |
| Single backend node failure | 0 min   | 0      | P0       |
| Redis failure               | 5 min   | 0      | P0       |
| MariaDB failure             | 10 min  | 0      | P0       |
| QNAP total failure          | 2 hours | 15 min | P1       |
| Data corruption             | 4 hours | 1 day  | P2       |

---

## 1. Quick Recovery Procedures

### 1.1 Service Not Responding

```bash
# Check container status
docker ps -a | grep <service-name>

# Restart specific service
docker restart <container-name>

# Check logs for errors
docker logs <container-name> --tail 100
```

### 1.2 Redis Failure

```bash
# Check status
docker exec cache redis-cli ping

# Restart
docker restart cache

# Verify
docker exec cache redis-cli ping
```

### 1.3 MariaDB Failure

```bash
# Check status
docker exec mariadb mysql -u root -p -e "SELECT 1"

# Restart
docker restart mariadb

# Wait for startup
sleep 30

# Verify
docker exec mariadb mysql -u root -p -e "SHOW DATABASES"
```

---

## 2. Full System Recovery

### 2.1 Recovery Prerequisites (ASUSTOR)

ตรวจสอบว่า Backup files พร้อมใช้งาน:

```bash
# SSH to ASUSTOR
ssh admin@192.168.10.9

# List available backups
ls -la /volume1/backup/db/
ls -la /volume1/backup/redis/
ls -la /volume1/backup/config/

# Check Restic snapshots
restic -r /volume1/backup/restic-repo snapshots
```

### 2.2 QNAP Recovery Script

```bash
#!/bin/bash
# File: /volume1/np-dms/scripts/disaster-recovery.sh
# Run on: ASUSTOR (Push to QNAP)

QNAP_IP="192.168.10.8"
BACKUP_DIR="/volume1/backup"

echo "🚨 Starting Disaster Recovery..."
echo "================================"

# 1. Restore Docker Network
echo "1️⃣ Creating Docker network..."
ssh admin@$QNAP_IP "docker network create lcbp3 || true"

# 2. Restore config files
echo "2️⃣ Restoring configuration files..."
LATEST_CONFIG=$(ls -t $BACKUP_DIR/config/*.tar.gz | head -1)
tar -xzf $LATEST_CONFIG -C /tmp/
rsync -avz /tmp/np-dms/ admin@$QNAP_IP:/share/np-dms/

# 3. Start infrastructure services
echo "3️⃣ Starting MariaDB..."
ssh admin@$QNAP_IP "cd /share/np-dms/mariadb && docker-compose up -d"
sleep 30

# 4. Restore database
echo "4️⃣ Restoring database..."
LATEST_DB=$(ls -t $BACKUP_DIR/db/*.sql.gz | head -1)
gunzip -c $LATEST_DB | ssh admin@$QNAP_IP "docker exec -i mariadb mysql -u root -p\$MYSQL_ROOT_PASSWORD lcbp3_db"

# 5. Start Redis
echo "5️⃣ Starting Redis..."
ssh admin@$QNAP_IP "cd /share/np-dms/services && docker-compose up -d cache"

# 6. Restore Redis data (if needed)
echo "6️⃣ Restoring Redis data..."
LATEST_REDIS=$(ls -t $BACKUP_DIR/redis/*.tar.gz | head -1)
tar -xzf $LATEST_REDIS -C /tmp/
scp /tmp/redis_*.rdb admin@$QNAP_IP:/share/np-dms/services/cache/data/dump.rdb
ssh admin@$QNAP_IP "docker restart cache"

# 7. Start remaining services
echo "7️⃣ Starting application services..."
ssh admin@$QNAP_IP "cd /share/np-dms/services && docker-compose up -d"
ssh admin@$QNAP_IP "cd /share/np-dms/npm && docker-compose up -d"

# 8. Health check
echo "8️⃣ Running health checks..."
sleep 60
curl -f https://lcbp3.np-dms.work/health || echo "⚠️ Frontend not ready"
curl -f https://backend.np-dms.work/health || echo "⚠️ Backend not ready"

echo ""
echo "✅ Disaster Recovery Complete"
echo "⚠️ Please verify system functionality manually"
```

---

## 3. Data Corruption Recovery

### 3.1 Point-in-Time Recovery (Database)

```bash
# List available Restic snapshots
restic -r /volume1/backup/restic-repo snapshots

# Restore specific snapshot
restic -r /volume1/backup/restic-repo restore <snapshot-id> --target /tmp/restore/

# Apply restored backup
gunzip -c /tmp/restore/lcbp3_*.sql.gz | \
  ssh admin@192.168.10.8 "docker exec -i mariadb mysql -u root -p\$MYSQL_ROOT_PASSWORD lcbp3_db"
```

### 3.2 Selective Table Recovery

```bash
# Extract specific tables from backup
gunzip -c /volume1/backup/db/lcbp3_YYYYMMDD.sql.gz | \
  grep -A1000 "CREATE TABLE \`documents\`" | \
  grep -B1000 "UNLOCK TABLES" > /tmp/documents_table.sql

# Restore specific table
ssh admin@192.168.10.8 "docker exec -i mariadb mysql -u root -p\$MYSQL_ROOT_PASSWORD lcbp3_db" < /tmp/documents_table.sql
```

---

## 4. Communication & Escalation

### 4.1 Incident Response

| Severity | Response Time | Notify                         |
| :------- | :------------ | :----------------------------- |
| P0       | Immediate     | Admin Team + Management        |
| P1       | 30 minutes    | Admin Team                     |
| P2       | 2 hours       | Admin Team (next business day) |

### 4.2 Post-Incident Checklist

- [ ] Identify root cause
- [ ] Document timeline of events
- [ ] Verify all services restored
- [ ] Check data integrity
- [ ] Update monitoring alerts if needed
- [ ] Create incident report

---

## 5. Testing Schedule

| Test Type               | Frequency | Last Tested | Next Due |
| :---------------------- | :-------- | :---------- | :------- |
| Backup Verification     | Weekly    | -           | -        |
| Single Service Recovery | Monthly   | -           | -        |
| Full DR Test            | Quarterly | -           | -        |

---

> 📝 **หมายเหตุ**: เอกสารนี้อ้างอิงจาก Architecture Document **v1.8.0**
