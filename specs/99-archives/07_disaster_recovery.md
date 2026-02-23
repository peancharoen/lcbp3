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
