# ADR-015: Deployment & Infrastructure Strategy

**Status:** ✅ Accepted
**Date:** 2026-02-24
**Decision Makers:** DevOps Team, System Architect
**Related Documents:** [ADR-005: Technology Stack](./ADR-005-technology-stack.md), [Operations Guide](../04-Infrastructure-OPS/04-04-deployment-guide.md), [Docker Compose Setup](../04-Infrastructure-OPS/04-01-docker-compose.md)
**Version Applicability:** v1.8.0+
**Next Review:** 2026-08-01 (6-month cycle)

---

## Gap Analysis & Requirement Linking

### ปิด Gap จาก Requirements:

| Gap/Requirement | แหล่งที่มา | วิธีการแก้ไขใน ADR นี้ |
|----------------|-------------|-------------------|
| **Deployment Strategy** | [Product Vision](../00-overview/00-03-product-vision.md) - Infrastructure Requirements | Docker Compose + Blue-Green on QNAP |
| **Zero Downtime** | [Acceptance Criteria](../01-Requirements/01-05-acceptance-criteria.md) - AC-DEPLOY-001 | Blue-Green deployment with NGINX proxy |
| **Resource Constraints** | [Infrastructure OPS](../04-Infrastructure-OPS/04-01-docker-compose.md) - QNAP limitations | Single-server Docker Compose (not K8s) |
| **Rollback Capability** | [Edge Cases](../01-Requirements/01-06-edge-cases-and-rules.md) - Deployment failures | Tagged images + NGINX switchback |
| **Environment Management** | [Security ADR-016](./ADR-016-security-authentication.md) - Secrets management | .env files on QNAP only |

### แก้ไขความขัดแย้ง:

- **Conflict:** Complexity vs. Reliability (Docker Compose vs Kubernetes)
- **Resolution:** Chose Docker Compose for QNAP compatibility, added Blue-Green for reliability
- **Trade-off:** Manual scaling vs. Resource efficiency

---

## Impact Analysis

### Affected Components (ส่วนประกอบที่ได้รับผลกระทบ):

| Component | ผลกระทบ | ความสำคัญ |
|-----------|----------|-----------|
| **Docker Compose Files** | Blue/Green structure + NGINX proxy | 🔴 Critical |
| **Deployment Scripts** | deploy.sh with health checks | 🔴 Critical |
| **Environment Config** | .env management strategy | 🔴 Critical |
| **QNAP Storage** | Volume mounting strategy | 🔴 Critical |
| **NGINX Configuration** | Reverse proxy setup | 🟡 Important |
| **CI/CD Pipeline** | Gitea Actions integration | 🟡 Important |
| **Monitoring Setup** | Health check endpoints | 🟡 Important |
| **Backup Strategy** | Database backup automation | 🟡 Important |
| **Documentation** | Deployment runbooks | 🟢 Guidelines |

### Required Changes (การเปลี่ยนแปลงที่ต้องดำเนินการ):

#### Infrastructure (QNAP)
- [x] Create blue/green directory structure
- [x] Setup shared volumes for uploads/logs
- [x] Configure NGINX reverse proxy
- [x] Implement deployment scripts
- [x] Setup environment variables management

#### Application (Backend/Frontend)
- [x] Add health check endpoints
- [x] Implement graceful shutdown
- [x] Add startup validation for required env vars
- [x] Configure logging to shared volume

#### Operations
- [x] Create deployment checklist
- [x] Setup backup automation
- [x] Document rollback procedures
- [x] Configure monitoring alerts

---

## Context and Problem Statement

LCBP3-DMS ต้อง Deploy บน QNAP Container Station โดยใช้ Docker แต่ต้องเลือกกลย modularุทธ์การ Deploy, การจัดการ Environment, และการ Scale ที่เหมาะสม

### ปัญหาที่ต้องแก้:

1. **Container Orchestration:** ใช้ Docker Compose หรือ Kubernetes
2. **Environment Management:** จัดการ Environment Variables อย่างไร
3. **Deployment Strategy:** Blue-Green, Rolling Update, หรือ Recreate
4. **Scaling:** แผน Scale horizontal/vertical
5. **Persistence:** จัดการ Data persistence อย่างไร

---

## Decision Drivers

- 🎯 **Simplicity:** ง่ายต่อการ Deploy และ Maintain
- 🔒 **Security:** Secrets management ปลอดภัย
- ⚡ **Zero Downtime:** Deploy ได้โดยไม่มี Downtime
- 📦 **Resource Efficiency:** ใช้ทรัพยากร QNAP อย่างคุ้มค่า
- 🔄 **Rollback Capability:** Rollback ได้เมื่อมีปัญหา

---

## Considered Options

### Option 1: Docker Compose (Single Server)

**Deployment:**

```yaml
version: '3.8'

services:
  backend:
    image: lcbp3-backend:latest
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      - mariadb
      - redis
    networks:
      - lcbp3-network

  frontend:
    image: lcbp3-frontend:latest
    depends_on:
      - backend
    networks:
      - lcbp3-network

  mariadb:
    image: mariadb:11.8
    volumes:
      - mariadb-data:/var/lib/mysql
    networks:
      - lcbp3-network

  redis:
    image: redis:7.2-alpine
    volumes:
      - redis-data:/data
    networks:
      - lcbp3-network

  elasticsearch:
    image: elasticsearch:8.11.0
    volumes:
      - elastic-data:/usr/share/elasticsearch/data
    networks:
      - lcbp3-network

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    ports:
      - '80:80'
      - '443:443'
    depends_on:
      - backend
      - frontend
    networks:
      - lcbp3-network

volumes:
  mariadb-data:
  redis-data:
  elastic-data:

networks:
  lcbp3-network:
```

**Pros:**

- ✅ Simple และเข้าใจง่าย
- ✅ พอดีกับ QNAP Container Station
- ✅ Resource requirement ต่ำ
- ✅ Debugging ง่าย

**Cons:**

- ❌ Single point of failure
- ❌ ไม่มี Auto-scaling
- ❌ Service discovery manual

### Option 2: Kubernetes (k3s)

**Pros:**

- ✅ Auto-scaling
- ✅ Self-healing
- ✅ Service discovery

**Cons:**

- ❌ ซับซ้อนเกินความจำเป็น
- ❌ Resource overhead สูง
- ❌ Learning curve สูง
- ❌ Overkill สำหรับ Single server

---

## Decision Outcome

**Chosen Option:** **Docker Compose with Blue-Green Deployment Strategy**

### Rationale

1. **Appropriate Complexity:** เหมาะกับ Scale และทีมของโปรเจกต์
2. **QNAP Compatibility:** รองรับโดย QNAP Container Station
3. **Resource Efficiency:** ใช้ทรัพยากรน้อยกว่า K8s
4. **Team Familiarity:** ทีม DevOps คุ้นเคยกับ Docker Compose
5. **Easy Rollback:** Rollback ได้ง่ายด้วย Tagged images

---

## Implementation Details

### 1. Directory Structure

```
/volume1/lcbp3/
├── blue/
│   ├── docker-compose.yml
│   ├── .env.production
│   └── nginx.conf
│
├── green/
│   ├── docker-compose.yml
│   ├── .env.production
│   └── nginx.conf
│
├── nginx-proxy/
│   ├── docker-compose.yml
│   └── nginx.conf (routes to blue or green)
│
├── shared/
│   ├── uploads/
│   ├── logs/
│   └── backups/
│
└── volumes/
    ├── mariadb-data/
    ├── redis-data/
    └── elastic-data/
```

### 2. Blue-Green Deployment Process

```bash
#!/bin/bash
# File: scripts/deploy.sh

CURRENT=$(cat /volume1/lcbp3/current)
TARGET=$([[ "$CURRENT" == "blue" ]] && echo "green" || echo "blue")

echo "Current environment: $CURRENT"
echo "Deploying to: $TARGET"

cd /volume1/lcbp3/$TARGET

# 1. Pull latest images
docker-compose pull

# 2. Start new environment
docker-compose up -d

# 3. Run database migrations
docker exec lcbp3-${TARGET}-backend npm run migration:run

# 4. Health check
for i in {1..30}; do
  if curl -f http://localhost:${TARGET}_PORT/health; then
    echo "Health check passed"
    break
  fi
  sleep 2
done

# 5. Switch nginx to new environment
sed -i "s/$CURRENT/$TARGET/g" /volume1/lcbp3/nginx-proxy/nginx.conf
docker exec lcbp3-nginx nginx -s reload

# 6. Update current pointer
echo "$TARGET" > /volume1/lcbp3/current

# 7. Stop old environment (keep data)
cd /volume1/lcbp3/$CURRENT
docker-compose down

echo "Deployment complete: $TARGET is now active"
```

### 3. Environment Variables Management

```bash
# File: .env.production (NOT in Git)
NODE_ENV=production

# Database
DB_HOST=mariadb
DB_PORT=3306
DB_USERNAME=lcbp3_user
DB_PASSWORD=<secret>
DB_DATABASE=lcbp3_dms

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<secret>

# JWT
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d

# File Storage
UPLOAD_PATH=/app/uploads
ALLOWED_FILE_TYPES=.pdf,.doc,.docx,.xls,.xlsx,.dwg

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=<secret>
SMTP_PASSWORD=<secret>
```

**Secrets Management:**

- Production `.env` files stored on QNAP only (NOT in Git)
- Use `docker-compose.override.yml` for local development
- Validate required env vars at application startup

### 4. Volume Management

```yaml
volumes:
  # Persistent data (survives container recreation)
  mariadb-data:
    driver: local
    driver_opts:
      type: none
      device: /volume1/lcbp3/volumes/mariadb-data
      o: bind

  # Shared uploads across blue/green
  uploads:
    driver: local
    driver_opts:
      type: none
      device: /volume1/lcbp3/shared/uploads
      o: bind

  # Logs
  logs:
    driver: local
    driver_opts:
      type: none
      device: /volume1/lcbp3/shared/logs
      o: bind
```

### 5. NGINX Reverse Proxy

```nginx
# File: nginx-proxy/nginx.conf
upstream backend {
    server lcbp3-blue-backend:3000;  # Switch to green during deployment
}

upstream frontend {
    server lcbp3-blue-frontend:3000;
}

server {
    listen 80;
    server_name lcbp3-dms.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name lcbp3-dms.example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Timeouts for file uploads
        client_max_body_size 50M;
        proxy_read_timeout 300s;
    }

    # Health check
    location /health {
        proxy_pass http://backend/health;
        access_log off;
    }
}
```

---

## Scaling Strategy

### Vertical Scaling (Phase 1)

**Current Recommendation:**

- Backend: 2 CPU cores, 4GB RAM
- Frontend: 1 CPU core, 2GB RAM
- MariaDB: 2 CPU cores, 8GB RAM
- Redis: 1 CPU core, 2GB RAM
- Elasticsearch: 2 CPU cores, 4GB RAM

**Upgrade Path:**

- Increase CPU/RAM ตาม Load
- Monitor with Prometheus/Grafana

### Horizontal Scaling (Phase 2 - Future)

**If needed:**

- Load Balancer หน้า Backend (multiple replicas)
- Database Read Replicas
- Redis Cluster
- Elasticsearch Cluster

**Prerequisite:**

- Stateless application (sessions in Redis)
- Shared file storage (NFS/S3)

---

## Deployment Checklist

```markdown
### Pre-Deployment

- [ ] Backup database
- [ ] Tag Docker images
- [ ] Update .env file
- [ ] Review migration scripts
- [ ] Notify stakeholders

### Deployment

- [ ] Pull latest images
- [ ] Start target environment (blue/green)
- [ ] Run migrations
- [ ] Health check passes
- [ ] Switch NGINX proxy
- [ ] Verify application working

### Post-Deployment

- [ ] Monitor logs for errors
- [ ] Check performance metrics
- [ ] Verify all features working
- [ ] Stop old environment
- [ ] Update deployment log
```

---

## Consequences

### Positive Consequences

1. ✅ **Simple Deployment:** Docker Compose เข้าใจง่าย
2. ✅ **Zero Downtime:** Blue-Green Deployment ไม่มี Downtime
3. ✅ **Easy Rollback:** Rollback = Switch NGINX back
4. ✅ **Cost Effective:** ไม่ต้อง Kubernetes overhead
5. ✅ **QNAP Compatible:** ใช้ได้กับ Container Station

### Negative Consequences

1. ❌ **Manual Scaling:** ต้อง Scale manual
2. ❌ **Single Server:** ไม่มี High Availability
3. ❌ **Limited Auto-healing:** ต้อง Monitor และ Restart manual

### Mitigation Strategies

- **Monitoring:** Setup Prometheus + Alertmanager
- **Automated Backups:** Cron jobs สำหรับ Database backups
- **Documentation:** เขียน Runbook สำหรับ Common issues
- **Health Checks:** Implement comprehensive health endpoints
- **CI/CD Integration (Gitea Actions):** แม้ว่า Deploy Script จะเขียนไว้สำหรับ Manual Run แต่ในทางปฏิบัติควรเขียน Gitea Actions workflow เพื่อ trigger script เหล่านี้ไปรันที่ QNAP สลับ Blue/Green ให้อัตโนมัติเมื่อ Merge โค้ด
- **Compose Templates:** โครงสร้าง Baseline Compose ควรอ้างอิงจาก `04-01-docker-compose.md` เป็นต้นแบบ ก่อนจะแปลงเป็นสองโฟลเดอร์สำหรับ Blue-Green ใน `04-04-deployment-guide.md`

---

## ADR Review Cycle

### Core Principle Review Schedule
- **Review Frequency:** ทุก 6 เดือน (กุมภาพันธ์ และ สิงหาคม)
- **Trigger Events:**
  - Major version upgrade (v1.9.0, v2.0.0)
  - QNAP Container Station updates
  - Performance issues requiring scaling changes
  - Security updates affecting deployment

### Review Checklist
- [ ] Blue-Green deployment still meets zero-downtime requirements
- [ ] Resource allocation matches current load
- [ ] Security best practices still current
- [ ] QNAP compatibility maintained
- [ ] Cross-document dependencies still valid
- [ ] New deployment tools/practices to consider
- [ ] Backup and recovery procedures tested

### Version Dependency Matrix

| System Version | ADR Version | Required Changes | Status |
|----------------|-------------|------------------|---------|
| v1.8.0 - v1.8.5 | ADR-015 v1.0 | Base Docker Compose setup | ✅ Complete |
| v1.9.0+ | ADR-015 v1.1 | Review resource allocation | 📋 Planned |
| v2.0.0+ | ADR-015 v2.0 | Consider horizontal scaling | 📋 Future |

---

## Related ADRs

- [ADR-005: Technology Stack](./ADR-005-technology-stack.md)
- [ADR-009: Database Migration Strategy](./ADR-009-database-migration-strategy.md)

---

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [QNAP Container Station](https://www.qnap.com/en/software/container-station)

---

**Document Version:** v1.0
**Last Updated:** 2026-02-24
**Next Review:** 2026-08-01 (6-month cycle)
**Version Applicability:** LCBP3 v1.8.0+

---

## Change History

| Version | Date | Changes | Author |
|---------|------|---------|---------|
| v1.0 | 2026-02-24 | Initial ADR creation with deployment strategy | DevOps Team |
| v1.1 | 2026-04-04 | Added structured templates: Impact Analysis, Gap Linking, Version Dependency, Review Cycle | System Architect |
