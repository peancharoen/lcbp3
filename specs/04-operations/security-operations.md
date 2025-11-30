# Security Operations

**Project:** LCBP3-DMS
**Version:** 1.5.0
**Last Updated:** 2025-12-01

---

## 📋 Overview

This document outlines security monitoring, access control management, vulnerability management, and security incident response for LCBP3-DMS.

---

## 🔒 Access Control Management

### User Access Review

**Monthly Tasks:**

```bash
#!/bin/bash
# File: /scripts/audit-user-access.sh

# Export active users
docker exec lcbp3-mariadb mysql -u root -p -e "
  SELECT user_id, username, email, primary_organization_id, is_active, last_login_at
  FROM lcbp3_dms.users
  WHERE is_active = 1
  ORDER BY last_login_at DESC;
" > /reports/active-users-$(date +%Y%m%d).csv

# Find dormant accounts (no login > 90 days)
docker exec lcbp3-mariadb mysql -u root -p -e "
  SELECT user_id, username, email, last_login_at,
         DATEDIFF(NOW(), last_login_at) AS days_inactive
  FROM lcbp3_dms.users
  WHERE is_active = 1
  AND (last_login_at IS NULL OR last_login_at < DATE_SUB(NOW(), INTERVAL 90 DAY));
"

echo "User access audit completed: $(date)"
```

### Role & Permission Audit

```sql
-- Review users with elevated permissions
SELECT u.username, u.email, r.role_name, r.scope
FROM users u
JOIN user_assignments ua ON u.user_id = ua.user_id
JOIN roles r ON ua.role_id = r.role_id
WHERE r.role_name IN ('Superadmin', 'Document Controller', 'Project Manager')
ORDER BY r.role_name, u.username;

-- Review Global scope roles (highest privilege)
SELECT u.username, r.role_name
FROM users u
JOIN user_assignments ua ON u.user_id = ua.user_id
JOIN roles r ON ua.role_id = r.role_id
WHERE r.scope = 'Global';
```

---

## 🛡️ Security Monitoring

### Log Monitoring for Security Events

```bash
#!/bin/bash
# File: /scripts/monitor-security-events.sh

# Check for failed login attempts
docker logs lcbp3-backend | grep "Failed login" | tail -20

# Check for unauthorized access attempts (403)
docker logs lcbp3-backend | grep "403" | tail -20

# Check for unusual activity patterns
docker logs lcbp3-backend | grep -E "DELETE|DROP|TRUNCATE" | tail -20

# Check for SQL injection attempts
docker logs lcbp3-backend | grep -i "SELECT.*FROM.*WHERE" | grep -v "legitimate" | tail -20
```

### Failed Login Monitoring

```sql
-- Find accounts with multiple failed login attempts
SELECT username, failed_attempts, locked_until
FROM users
WHERE failed_attempts >= 3
ORDER BY failed_attempts DESC;

-- Unlock user account after verification
UPDATE users
SET failed_attempts = 0, locked_until = NULL
WHERE user_id = ?;
```

---

## 🔐 Secrets & Credentials Management

### Password Rotation Schedule

| Credential             | Rotation Frequency       | Owner        |
| ---------------------- | ------------------------ | ------------ |
| Database Root Password | Every 90 days            | DBA          |
| Database App Password  | Every 90 days            | DevOps       |
| JWT Secret             | Every 180 days           | Backend Team |
| Redis Password         | Every 90 days            | DevOps       |
| SMTP Password          | When provider requires   | Operations   |
| SSL Private Key        | With certificate renewal | Operations   |

### Password Rotation Procedure

```bash
#!/bin/bash
# File: /scripts/rotate-db-password.sh

# Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update database user password
docker exec lcbp3-mariadb mysql -u root -p -e "
  ALTER USER 'lcbp3_user'@'%' IDENTIFIED BY '$NEW_PASSWORD';
  FLUSH PRIVILEGES;
"

# Update application .env file
sed -i "s/^DB_PASS=.*/DB_PASS=$NEW_PASSWORD/" /app/backend/.env

# Restart backend to apply new password
docker restart lcbp3-backend

# Verify connection
sleep 10
curl -f http://localhost:3000/health || {
  echo "FAILED: Backend cannot connect with new password"
  # Rollback procedure...
  exit 1
}

echo "Database password rotated successfully: $(date)"
# Store password securely (e.g., password manager)
```

---

## 🚨 Vulnerability Management

### Dependency Vulnerability Scanning

```bash
#!/bin/bash
# File: /scripts/scan-vulnerabilities.sh

# Backend dependencies
cd /app/backend
npm audit --production

# Critical/High vulnerabilities
VULNERABILITIES=$(npm audit --production --json | jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical')

if [ "$VULNERABILITIES" -gt 0 ]; then
  echo "WARNING: $VULNERABILITIES critical/high vulnerabilities found!"
  npm audit --production > /reports/security-audit-$(date +%Y%m%d).txt
  # Send alert
  /scripts/send-alert-email.sh "Security Vulnerabilities Detected" "Found $VULNERABILITIES critical/high vulnerabilities"
fi

# Frontend dependencies
cd /app/frontend
npm audit --production
```

### Container Image Scanning

```bash
#!/bin/bash
# File: /scripts/scan-images.sh

# Install Trivy (if not installed)
# wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | apt-key add -
# echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee -a /etc/apt/sources.list.d/trivy.list
# apt-get update && apt-get install trivy

# Scan Docker images
trivy image --severity HIGH,CRITICAL lcbp3-backend:latest
trivy image --severity HIGH,CRITICAL lcbp3-frontend:latest
trivy image --severity HIGH,CRITICAL mariadb:10.11
trivy image --severity HIGH,CRITICAL redis:7.2-alpine
```

---

## 🔍 Security Hardening

### Server Hardening Checklist

- [ ] Disable root SSH login
- [ ] Use SSH key authentication only
- [ ] Configure firewall (allow only necessary ports)
- [ ] Enable automatic security updates
- [ ] Remove unnecessary services
- [ ] Configure fail2ban for brute-force protection
- [ ] Enable SELinux/AppArmor
- [ ] Regular security patch updates

### Docker Security

```yaml
# docker-compose.yml - Security best practices

services:
  backend:
    # Run as non-root user
    user: 'node:node'

    # Read-only root filesystem
    read_only: true

    # No new privileges
    security_opt:
      - no-new-privileges:true

    # Limit capabilities
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 512M
```

### Database Security

```sql
-- Remove anonymous users
DELETE FROM mysql.user WHERE User='';

-- Remove test database
DROP DATABASE IF EXISTS test;

-- Remove remote root login
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1');

-- Create dedicated backup user with minimal privileges
CREATE USER 'backup_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON lcbp3_dms.* TO 'backup_user'@'localhost';

-- Enable SSL for database connections
-- GRANT USAGE ON *.* TO 'lcbp3_user'@'%' REQUIRE SSL;

FLUSH PRIVILEGES;
```

---

## 🚨 Security Incident Response

### Incident Classification

| Type                    | Examples                     | Response Time    |
| ----------------------- | ---------------------------- | ---------------- |
| **Data Breach**         | Unauthorized data access     | Immediate (< 1h) |
| **Account Compromise**  | Stolen credentials           | Immediate (< 1h) |
| **DDoS Attack**         | Service unavailable          | Immediate (< 1h) |
| **Malware/Ransomware**  | Infected systems             | Immediate (< 1h) |
| **Unauthorized Access** | Failed authentication spikes | High (< 4h)      |
| **Suspicious Activity** | Unusual patterns             | Medium (< 24h)   |

### Data Breach Response

**Immediate Actions:**

1. **Contain the breach**

   ```bash
   # Block suspicious IPs at firewall level
   iptables -A INPUT -s <SUSPICIOUS_IP> -j DROP

   # Disable compromised user accounts
   docker exec lcbp3-mariadb mysql -u root -p -e "
     UPDATE lcbp3_dms.users
     SET is_active = 0
     WHERE user_id = <COMPROMISED_USER_ID>;
   "
   ```

2. **Assess impact**

   ```sql
   -- Check audit logs for unauthorized access
   SELECT * FROM audit_logs
   WHERE user_id = <COMPROMISED_USER_ID>
   AND created_at >= '<SUSPECTED_START_TIME>'
   ORDER BY created_at DESC;

   -- Check what documents were accessed
   SELECT DISTINCT entity_id, entity_type, action
   FROM audit_logs
   WHERE user_id = <COMPROMISED_USER_ID>;
   ```

3. **Notify stakeholders**

   - Security officer
   - Management
   - Affected users (if applicable)
   - Legal team (if required by law)

4. **Document everything**
   - Timeline of events
   - Data accessed/compromised
   - Actions taken
   - Lessons learned

### Account Compromise Response

```bash
#!/bin/bash
# File: /scripts/respond-account-compromise.sh

USER_ID=$1

# 1. Immediately disable account
docker exec lcbp3-mariadb mysql -u root -p -e "
  UPDATE lcbp3_dms.users
  SET is_active = 0,
      locked_until = DATE_ADD(NOW(), INTERVAL 24 HOUR)
  WHERE user_id = $USER_ID;
"

# 2. Invalidate all sessions
docker exec lcbp3-redis redis-cli DEL "session:user:$USER_ID:*"

# 3. Generate audit report
docker exec lcbp3-mariadb mysql -u root -p -e "
  SELECT * FROM lcbp3_dms.audit_logs
  WHERE user_id = $USER_ID
  AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  ORDER BY created_at DESC;
" > /reports/compromise-audit-user-$USER_ID-$(date +%Y%m%d).txt

# 4. Notify security team
/scripts/send-alert-email.sh "Account Compromise" "User ID $USER_ID has been compromised and disabled"

echo "Account compromise response completed for User ID: $USER_ID"
```

---

## 📊 Security Metrics & KPIs

### Monthly Security Report

| Metric                      | Target    | Actual |
| --------------------------- | --------- | ------ |
| Failed Login Attempts       | < 100/day | Track  |
| Locked Accounts             | < 5/month | Track  |
| Critical Vulnerabilities    | 0         | Track  |
| High Vulnerabilities        | < 5       | Track  |
| Unpatched Systems           | 0         | Track  |
| Security Incidents          | 0         | Track  |
| Mean Time To Detect (MTTD)  | < 1 hour  | Track  |
| Mean Time To Respond (MTTR) | < 4 hours | Track  |

---

## 🔐 Compliance & Audit

### Audit Log Retention

- **Access Logs:** 1 year
- **Security Events:** 2 years
- **Admin Actions:** 3 years
- **Data Changes:** 7 years (as required)

### Compliance Checklist

- [ ] Regular security audits (quarterly)
- [ ] Penetration testing (annually)
- [ ] Access control reviews (monthly)
- [ ] Encryption at rest and in transit
- [ ] Secure password policies enforced
- [ ] Multi-factor authentication (if required)
- [ ] Data backup and recovery tested
- [ ] Incident response plan documented and tested

---

## ✅ Security Operations Checklist

### Daily

- [ ] Review security alerts and logs
- [ ] Monitor failed login attempts
- [ ] Check for unusual access patterns
- [ ] Verify backup completion

### Weekly

- [ ] Review user access logs
- [ ] Scan for vulnerabilities
- [ ] Update virus definitions
- [ ] Review firewall logs

### Monthly

- [ ] User access audit
- [ ] Role and permission review
- [ ] Security patch application
- [ ] Compliance review

### Quarterly

- [ ] Full security audit
- [ ] Penetration testing
- [ ] Disaster recovery drill
- [ ] Update security policies

---

## 🔗 Related Documents

- [Incident Response](./incident-response.md)
- [Monitoring & Alerting](./monitoring-alerting.md)
- [ADR-004: RBAC Implementation](../05-decisions/ADR-004-rbac-implementation.md)

---

**Version:** 1.5.0
**Last Review:** 2025-12-01
**Next Review:** 2026-03-01
