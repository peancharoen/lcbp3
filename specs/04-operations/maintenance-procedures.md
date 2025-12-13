# Maintenance Procedures

**Project:** LCBP3-DMS
**Version:** 1.6.0
**Last Updated:** 2025-12-02

---

## 📋 Overview

This document outlines routine maintenance tasks, update procedures, and optimization guidelines for LCBP3-DMS.

---

## 📅 Maintenance Schedule

### Daily Tasks

- Monitor system health and backups
- Review error logs
- Check disk space

### Weekly Tasks

- Database optimization
- Log rotation and cleanup
- Security patch review
- Performance monitoring review

### Monthly Tasks

- SSL certificate check
- Dependency updates (Security patches)
- Database maintenance
- Backup restoration test

### Quarterly Tasks

- Full system update
- Capacity planning review
- Security audit
- Disaster recovery drill

---

## 🔄 Update Procedures

### Application Updates

#### Backend Update

```bash
#!/bin/bash
# File: /scripts/update-backend.sh

# Step 1: Backup database
/scripts/backup-database.sh

# Step 2: Pull latest code
cd /app/lcbp3/backend
git pull origin main

# Step 3: Install dependencies
docker exec lcbp3-backend npm install

# Step 4: Run migrations
docker exec lcbp3-backend npm run migration:run

# Step 5: Build application
docker exec lcbp3-backend npm run build

# Step 6: Restart backend
docker restart lcbp3-backend

# Step 7: Verify health
sleep 10
curl -f http://localhost:3000/health || {
  echo "Health check failed! Rolling back..."
  docker exec lcbp3-backend npm run migration:revert
  docker restart lcbp3-backend
  exit 1
}

echo "Backend updated successfully"
```

#### Frontend Update

```bash
#!/bin/bash
# File: /scripts/update-frontend.sh

# Step 1: Pull latest code
cd /app/lcbp3/frontend
git pull origin main

# Step 2: Install dependencies
docker exec lcbp3-frontend npm install

# Step 3: Build application
docker exec lcbp3-frontend npm run build

# Step 4: Restart frontend
docker restart lcbp3-frontend

# Step 5: Verify
sleep 10
curl -f http://localhost:3001 || {
  echo "Frontend failed to start!"
  exit 1
}

echo "Frontend updated successfully"
```

### Zero-Downtime Deployment

```bash
#!/bin/bash
# File: /scripts/zero-downtime-deploy.sh

# Using blue-green deployment strategy

# Step 1: Start new "green" backend
docker-compose -f docker-compose.green.yml up -d backend

# Step 2: Wait for health check
for i in {1..30}; do
  curl -f http://localhost:3002/health && break
  sleep 2
done

# Step 3: Switch NGINX to green
docker exec lcbp3-nginx nginx -s reload

# Step 4: Stop old "blue" backend
docker stop lcbp3-backend-blue

echo "Deployment completed with zero downtime"
```

---

## 🗄️ Database Maintenance

### Weekly Database Optimization

```sql
-- File: /scripts/optimize-database.sql

-- Optimize tables
OPTIMIZE TABLE correspondences;
OPTIMIZE TABLE rfas;
OPTIMIZE TABLE workflow_instances;
OPTIMIZE TABLE attachments;

-- Analyze tables for query optimization
ANALYZE TABLE correspondences;
ANALYZE TABLE rfas;

-- Check for table corruption
CHECK TABLE correspondences;
CHECK TABLE rfas;

-- Rebuild indexes if fragmented
ALTER TABLE correspondences ENGINE=InnoDB;
```

```bash
#!/bin/bash
# File: /scripts/weekly-db-maintenance.sh

docker exec lcbp3-mariadb mysql -u root -p lcbp3_dms < /scripts/optimize-database.sql

echo "Database optimization completed: $(date)"
```

### Monthly Database Cleanup

```sql
-- Archive old audit logs (older than 1 year)
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

DELETE FROM audit_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

-- Clean up deleted notifications (older than 90 days)
DELETE FROM notifications
WHERE deleted_at IS NOT NULL
AND deleted_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Clean up expired temp uploads (older than 24h)
DELETE FROM temp_uploads
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 DAY);

-- Optimize after cleanup
OPTIMIZE TABLE audit_logs;
OPTIMIZE TABLE notifications;
OPTIMIZE TABLE temp_uploads;
```

---

## 📦 Dependency Updates

### Security Patch Updates (Monthly)

```bash
#!/bin/bash
# File: /scripts/update-dependencies.sh

cd /app/lcbp3/backend

# Check for security vulnerabilities
npm audit

# Update security patches only (no major versions)
npm audit fix

# Run tests
npm test

# If tests pass, commit and deploy
git add package*.json
git commit -m "chore: security patch updates"
git push origin main
```

### Major Version Updates (Quarterly)

```bash
# Check for outdated packages
npm outdated

# Update one major dependency at a time
npm install @nestjs/core@latest

# Test thoroughly
npm test
npm run test:e2e

# If successful, commit
git commit -am "chore: update @nestjs/core to vX.X.X"
```

---

## 🧹 Log Management

### Log Rotation Configuration

```bash
# File: /etc/logrotate.d/lcbp3-dms

/app/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  missingok
  notifempty
  create 0640 node node
  sharedscripts
  postrotate
    docker exec lcbp3-backend kill -USR1 1
  endscript
}
```

### Manual Log Cleanup

```bash
#!/bin/bash
# File: /scripts/cleanup-logs.sh

# Delete logs older than 90 days
find /app/logs -name "*.log" -type f -mtime +90 -delete

# Compress logs older than 7 days
find /app/logs -name "*.log" -type f -mtime +7 -exec gzip {} \;

# Clean Docker logs
docker system prune -f --volumes --filter "until=720h"

echo "Log cleanup completed: $(date)"
```

---

## 🔐 SSL Certificate Renewal

### Check Certificate Expiry

```bash
#!/bin/bash
# File: /scripts/check-ssl-cert.sh

CERT_FILE="/app/nginx/ssl/cert.pem"
EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

echo "SSL certificate expires in $DAYS_LEFT days"

if [ $DAYS_LEFT -lt 30 ]; then
  echo "WARNING: SSL certificate expires soon!"
  # Send alert
  /scripts/send-alert-email.sh "SSL Certificate Expiring" "Certificate expires in $DAYS_LEFT days"
fi
```

### Renew SSL Certificate (Let's Encrypt)

```bash
#!/bin/bash
# File: /scripts/renew-ssl.sh

# Renew certificate
certbot renew --webroot -w /app/nginx/html

# Copy new certificate
cp /etc/letsencrypt/live/lcbp3-dms.example.com/fullchain.pem /app/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/lcbp3-dms.example.com/privkey.pem /app/nginx/ssl/key.pem

# Reload NGINX
docker exec lcbp3-nginx nginx -s reload

echo "SSL certificate renewed: $(date)"
```

---

## 🧪 Performance Optimization

### Database Query Optimization

```sql
-- Find slow queries
SELECT * FROM mysql.slow_log
ORDER BY query_time DESC
LIMIT 10;

-- Add indexes for frequently queried columns
CREATE INDEX idx_correspondences_status ON correspondences(status);
CREATE INDEX idx_rfas_workflow_status ON rfas(workflow_status);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);

-- Analyze query execution plan
EXPLAIN SELECT * FROM correspondences
WHERE status = 'PENDING'
AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### Redis Cache Optimization

```bash
#!/bin/bash
# File: /scripts/optimize-redis.sh

# Check Redis memory usage
docker exec lcbp3-redis redis-cli INFO memory

# Set max memory policy
docker exec lcbp3-redis redis-cli CONFIG SET maxmemory 1gb
docker exec lcbp3-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Save configuration
docker exec lcbp3-redis redis-cli CONFIG REWRITE

# Clear stale cache (if needed)
docker exec lcbp3-redis redis-cli FLUSHDB
```

### Application Performance Tuning

```typescript
// Enable production optimizations in NestJS
// File: backend/src/main.ts

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'error', 'warn', 'debug'],
  });

  // Enable compression
  app.use(compression());

  // Enable caching
  app.useGlobalInterceptors(new CacheInterceptor());

  // Set global timeout
  app.use(timeout('30s'));

  await app.listen(3000);
}
```

---

## 🔒 Security Maintenance

### Monthly Security Tasks

```bash
#!/bin/bash
# File: /scripts/security-maintenance.sh

# Update system packages
apt-get update && apt-get upgrade -y

# Update ClamAV virus definitions
docker exec lcbp3-clamav freshclam

# Scan for rootkits
rkhunter --check --skip-keypress

# Check for unauthorized users
awk -F: '($3 >= 1000) {print $1}' /etc/passwd

# Review sudo access
cat /etc/sudoers

# Check firewall rules
iptables -L -n -v

echo "Security maintenance completed: $(date)"
```

---

## ✅ Maintenance Checklist

### Pre-Maintenance

- [ ] Announce maintenance window to users
- [ ] Backup database and files
- [ ] Document current system state
- [ ] Prepare rollback plan

### During Maintenance

- [ ] Put system in maintenance mode (if needed)
- [ ] Perform updates/changes
- [ ] Run smoke tests
- [ ] Monitor system health

### Post-Maintenance

- [ ] Verify all services running
- [ ] Run full test suite
- [ ] Monitor performance metrics
- [ ] Communicate completion to users
- [ ] Document changes made

---

## 🔧 Emergency Maintenance

### Unplanned Maintenance Procedures

1. **Assess Urgency**

   - Can it wait for scheduled maintenance?
   - Is it causing active issues?

2. **Communicate Impact**

   - Notify stakeholders immediately
   - Estimate downtime
   - Provide updates every 30 minutes

3. **Execute Carefully**

   - Always backup first
   - Have rollback plan ready
   - Test in staging if possible

4. **Post-Maintenance Review**
   - Document what happened
   - Identify preventive measures
   - Update runbooks

---

## 📚 Related Documents

- [Deployment Guide](./deployment-guide.md)
- [Backup & Recovery](./backup-recovery.md)
- [Monitoring & Alerting](./monitoring-alerting.md)

---

**Version:** 1.6.0
**Last Review:** 2025-12-01
**Next Review:** 2026-03-01
