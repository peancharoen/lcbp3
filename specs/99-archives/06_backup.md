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
