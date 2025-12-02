# Environment Setup & Configuration

**Project:** LCBP3-DMS
**Version:** 1.5.1
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
NEXT_PUBLIC_APP_VERSION=1.5.0

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
    image: mariadb:10.11
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

- [Deployment Guide](./deployment-guide.md)
- [Security Operations](./security-operations.md)
- [ADR-005: Technology Stack](../05-decisions/ADR-005-technology-stack.md)

---

**Version:** 1.5.1
**Last Review:** 2025-12-01
**Next Review:** 2026-03-01
