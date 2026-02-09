# Secrets Management สำหรับ LCBP3-DMS

> 📍 **Version:** v1.8.0
> ⚠️ **Security Level:** CONFIDENTIAL

---

## Overview

เอกสารนี้อธิบายวิธีการจัดการ Secrets และ Sensitive Data สำหรับ LCBP3-DMS

---

## 1. Secret Categories

| Category             | Examples                       | Storage Location         |
| :------------------- | :----------------------------- | :----------------------- |
| Database Credentials | `MYSQL_ROOT_PASSWORD`          | `.env` file (gitignored) |
| API Keys             | `JWT_SECRET`, `REDIS_PASSWORD` | `.env` file (gitignored) |
| SSL Certificates     | Let's Encrypt certs            | NPM volume               |
| SSH Keys             | Backup access keys             | ASUSTOR secure storage   |

---

## 2. Environment File Structure

### 2.1 Main Environment File

```bash
# File: /share/np-dms/.env (QNAP)
# ⚠️ This file MUST be in .gitignore

# === Database ===
MYSQL_ROOT_PASSWORD=<strong-password>
MYSQL_DATABASE=lcbp3_db
MYSQL_USER=lcbp3_user
MYSQL_PASSWORD=<strong-password>

# === Redis ===
REDIS_PASSWORD=<strong-password>

# === Application ===
JWT_SECRET=<random-256-bit-string>
SESSION_SECRET=<random-256-bit-string>

# === Monitoring ===
GRAFANA_PASSWORD=<admin-password>

# === External Services ===
LINE_CHANNEL_SECRET=<line-secret>
LINE_CHANNEL_ACCESS_TOKEN=<line-token>
SMTP_PASSWORD=<email-password>
```

### 2.2 Docker Compose Override (Optional)

```yaml
# File: /share/np-dms/docker-compose.override.yml
# For additional local development secrets

services:
  backend:
    environment:
      - DEBUG_MODE=true
      - LOG_LEVEL=debug
```

---

## 3. Secret Generation

### 3.1 Generate Strong Passwords

```bash
# Generate random 32-character password
openssl rand -base64 32

# Generate random hex string (for JWT)
openssl rand -hex 64
```

### 3.2 Recommended Password Policy

| Type       | Length | Characters             | Example Tool              |
| :--------- | :----- | :--------------------- | :------------------------ |
| Database   | 24+    | Alphanumeric + symbols | `openssl rand -base64 32` |
| JWT Secret | 64+    | Hex                    | `openssl rand -hex 64`    |
| API Keys   | 32+    | Alphanumeric           | `openssl rand -base64 32` |

---

## 4. Secret Rotation

### 4.1 Rotation Schedule

| Secret Type       | Rotation Period      | Impact on Services     |
| :---------------- | :------------------- | :--------------------- |
| JWT Secret        | 90 days              | Users need to re-login |
| Database Password | 180 days             | Requires restart       |
| Redis Password    | 180 days             | Requires restart       |
| SSL Certificates  | Auto (Let's Encrypt) | None                   |

### 4.2 Rotation Procedure

```bash
# 1. Update .env file with new secret
nano /share/np-dms/.env

# 2. Restart affected services
docker-compose up -d --force-recreate backend

# 3. Verify services are running
docker ps
curl https://backend.np-dms.work/health
```

---

## 5. Access Control

### 5.1 Who Has Access

| Role         | .env Access | Server SSH | Backup Access |
| :----------- | :---------- | :--------- | :------------ |
| System Admin | ✅ Full      | ✅ Full     | ✅ Full        |
| DevOps       | ✅ Read      | ✅ Limited  | ❌ None        |
| Developer    | ❌ None      | ❌ None     | ❌ None        |

### 5.2 Audit Logging

```bash
# View SSH login attempts
tail -100 /var/log/auth.log

# Monitor file access
auditctl -w /share/np-dms/.env -p rwa -k secrets_access
```

---

## 6. Emergency Procedures

### 6.1 Secret Compromised

1. **Immediately** rotate the compromised secret
2. **Check** access logs for unauthorized access
3. **Notify** security team
4. **Document** incident

### 6.2 Lost Access to Secrets

1. Contact QNAP Admin for direct access
2. Use backup `.env` from ASUSTOR (encrypted)
3. If both unavailable, regenerate all secrets and reset passwords

---

## 7. Backup of Secrets

```bash
# Encrypted backup of .env (run on QNAP)
gpg --symmetric --cipher-algo AES256 \
  /share/np-dms/.env -o /tmp/env.gpg

# Copy to ASUSTOR
scp /tmp/env.gpg admin@192.168.10.9:/volume1/backup/secrets/

# Clean up
rm /tmp/env.gpg
```

### 7.1 Restore from Backup

```bash
# Copy from ASUSTOR
scp admin@192.168.10.9:/volume1/backup/secrets/env.gpg /tmp/

# Decrypt
gpg --decrypt /tmp/env.gpg > /share/np-dms/.env

# Clean up
rm /tmp/env.gpg
```

---

## 8. Checklist

- [ ] `.env` file exists and is configured
- [ ] `.env` is in `.gitignore`
- [ ] All passwords are strong (24+ characters)
- [ ] JWT secret is 64+ hex characters
- [ ] Encrypted backup of secrets exists on ASUSTOR
- [ ] Access control is properly configured
- [ ] Rotation schedule is documented

---

> ⚠️ **Security Warning**: ห้ามเก็บ secrets ใน version control หรือ commit ไปยัง Git repository
> 
> 📝 **หมายเหตุ**: เอกสารนี้อ้างอิงจาก Architecture Document **v1.8.0**
