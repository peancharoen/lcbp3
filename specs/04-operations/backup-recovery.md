# Backup & Recovery Procedures

**Project:** LCBP3-DMS
**Version:** 1.5.1
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

- [Deployment Guide](./deployment-guide.md)
- [Monitoring & Alerting](./monitoring-alerting.md)
- [Incident Response](./incident-response.md)

---

**Version:** 1.5.1
**Last Review:** 2025-12-01
**Next Review:** 2026-03-01
