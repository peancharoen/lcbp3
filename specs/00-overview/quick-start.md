# Quick Start Guide

**Project:** LCBP3-DMS
**Version:** 1.5.1
**Last Updated:** 2025-12-02

---

## ⚡ 5-Minute Quick Start

This guide will get you up and running with LCBP3-DMS in 5 minutes.

---

## 👨‍💻 For Developers

### Prerequisites

```bash
# Required
- Docker 20.10+
- Docker Compose 2.0+
- Git
- Node.js 18+ (for local development)

# Recommended
- VS Code
- Postman or similar API testing tool
```

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd lcbp3
```

### Step 2: Setup Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and set required values

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local
```

### Step 3: Start Services

```bash
# Start all services with Docker Compose
docker-compose up -d

# Check status
docker-compose ps
```

### Step 4: Initialize Database

```bash
# Run migrations
docker exec lcbp3-backend npm run migration:run

# (Optional) Seed sample data
docker exec lcbp3-backend npm run seed
```

### Step 5: Access Application

```bash
# Backend API
http://localhost:3000

# Health check
curl http://localhost:3000/health

# Frontend
http://localhost:3001

# API Documentation (Swagger)
http://localhost:3000/api/docs
```

### Step 6: Login

**Default Admin Account:**

- Username: `admin`
- Password: `Admin@123` (Change immediately!)

---

## 🧪 For QA/Testers

### Running Tests

```bash
# Backend unit tests
docker exec lcbp3-backend npm test

# Backend e2e tests
docker exec lcbp3-backend npm run test:e2e

# Frontend tests
docker exec lcbp3-frontend npm test
```

### Test Data

```bash
# Reset database to clean state
docker exec lcbp3-backend npm run migration:revert
docker exec lcbp3-backend npm run migration:run

# Load test data
docker exec lcbp3-backend npm run seed
```

---

## 🚀 For DevOps

### Deploy to Staging

```bash
# Build images
docker-compose build

# Push to registry
docker-compose push

# Deploy to staging server
ssh staging-server
cd /app/lcbp3
git pull
docker-compose pull
docker-compose up -d

# Run migrations
docker exec lcbp3-backend npm run migration:run
```

### Deploy to Production

```bash
# Backup database first!
./scripts/backup-database.sh

# Deploy with zero-downtime
./scripts/zero-downtime-deploy.sh

# Verify deployment
curl -f https://lcbp3-dms.example.com/health
```

---

## 📊 For Project Managers

### View Project Status

**Documentation:**

- Requirements: [specs/01-requirements](../01-requirements/)
- Architecture: [specs/02-architecture](../02-architecture/)
- Tasks: [specs/06-tasks](../06-tasks/)

**Metrics:**

- Check [Monitoring Dashboard](http://localhost:9200) (if setup)
- Review [Task Board](../06-tasks/README.md)

---

## 🔍 Common Tasks

### Create New Module

```bash
# Backend
cd backend
nest g module modules/my-module
nest g controller modules/my-module
nest g service modules/my-module

# Follow backend guidelines
# See: specs/03-implementation/backend-guidelines.md
```

### Create New Migration

```bash
# Generate migration from entity changes
docker exec lcbp3-backend npm run migration:generate -- -n MigrationName

# Create empty migration
docker exec lcbp3-backend npm run migration:create -- -n MigrationName

# Run migrations
docker exec lcbp3-backend npm run migration:run

# Revert last migration
docker exec lcbp3-backend npm run migration:revert
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker logs lcbp3-backend -f --tail=100

# Search logs
docker logs lcbp3-backend 2>&1 | grep "ERROR"
```

### Database Access

```bash
# MySQL CLI
docker exec -it lcbp3-mariadb mysql -u root -p

# Run SQL file (Linux/Mac)
docker exec -i lcbp3-mariadb mysql -u root -p lcbp3_dms < script.sql

# Run SQL file (Windows PowerShell)
Get-Content script.sql | docker exec -i lcbp3-mariadb mysql -u root -p lcbp3_dms

# Run SQL file (Windows CMD)
type script.sql | docker exec -i lcbp3-mariadb mysql -u root -p lcbp3_dms
```

### Redis Access

```bash
# Redis CLI
docker exec -it lcbp3-redis redis-cli -a <password>

# Check keys
docker exec lcbp3-redis redis-cli -a <password> KEYS "*"

# Clear cache
docker exec lcbp3-redis redis-cli -a <password> FLUSHDB
```

---

## 🐛 Troubleshooting

### Backend not starting

```bash
# Check logs
docker logs lcbp3-backend

# Common issues:
# 1. Database connection - check DB_HOST in .env
# 2. Redis connection - check REDIS_HOST in .env
# 3. Port conflict - check if port 3000 is free
```

### Database connection failed

```bash
# Check if MariaDB is running
docker ps | grep mariadb

# Test connection
docker exec lcbp3-mariadb mysqladmin ping -h localhost

# Check credentials
docker exec lcbp3-backend env | grep DB_
```

### Frontend build failed

```bash
# Clear cache and rebuild
docker exec lcbp3-frontend rm -rf .next node_modules
docker exec lcbp3-frontend npm install
docker exec lcbp3-frontend npm run build
```

### Port already in use

```bash
# Linux/Mac: Find process using port
lsof -i :3000

# Windows: Find process using port
netstat -ano | findstr :3000

# Linux/Mac: Kill process
kill -9 <PID>

# Windows: Kill process
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
```

---

## ⚠️ Common Pitfalls

### 1. **Environment Variables Not Loaded**

**Problem:** Backend fails to start with "config is not defined" or similar errors.

**Solution:**
```bash
# Ensure .env file exists
ls backend/.env  # Linux/Mac
dir backend\.env  # Windows

# Check if Docker container has access to .env
docker exec lcbp3-backend env | grep DB_

# Restart containers after .env changes
docker-compose down
docker-compose up -d
```

### 2. **Database Migration Issues**

**Problem:** Tables not found or schema mismatch.

**Solution:**
```bash
# Check migration status
docker exec lcbp3-backend npm run migration:show

# Run pending migrations
docker exec lcbp3-backend npm run migration:run

# If migration fails, check logs
docker logs lcbp3-backend --tail=50

# Rollback and retry if needed
docker exec lcbp3-backend npm run migration:revert
```

### 3. **Redis Connection Timeout**

**Problem:** Queue jobs not processing or "ECONNREFUSED" errors.

**Solution:**
```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
docker exec lcbp3-redis redis-cli ping

# Check Redis logs
docker logs lcbp3-redis

# Verify REDIS_HOST in .env matches docker-compose service name
```

### 4. **CORS Errors in Frontend**

**Problem:** Browser blocks API requests with CORS policy errors.

**Solution:**
```bash
# Check CORS_ORIGIN in backend/.env
# Should match frontend URL (e.g., http://localhost:3001)

# For development, can use:
CORS_ORIGIN=http://localhost:3001,http://localhost:3000

# Restart backend after changes
docker-compose restart backend
```

### 5. **File Upload Fails**

**Problem:** File uploads return 413 (Payload Too Large) or timeout.

**Solution:**
```bash
# Check MAX_FILE_SIZE in .env (default 50MB)
MAX_FILE_SIZE=52428800

# Check NGINX upload limits if using reverse proxy
# client_max_body_size should be set appropriately

# Check disk space
docker exec lcbp3-backend df -h  # Linux/Mac
```

### 6. **Docker Build Fails on Windows**

**Problem:** Line ending issues (CRLF vs LF) cause build failures.

**Solution:**
```bash
# Configure Git to use LF line endings
git config --global core.autocrlf input

# Re-clone or convert existing files
git add --renormalize .
git commit -m "Normalize line endings"

# Or use .gitattributes file (already should be in repo)
```

### 7. **Permission Denied in Containers**

**Problem:** Cannot write files or execute commands inside containers.

**Solution:**
```bash
# Windows: Ensure Docker Desktop has access to the drive
# Settings → Resources → File Sharing

# Linux: Fix volume permissions
sudo chown -R $USER:$USER .

# Check container user
docker exec lcbp3-backend whoami
```

### 8. **Hot Reload Not Working**

**Problem:** Code changes don't reflect immediately during development.

**Solution:**
```bash
# Ensure volumes are mounted correctly in docker-compose.yml
# Check for:
volumes:
  - ./backend/src:/app/src

# Windows: May need to enable polling in NestJS
# Add to nest-cli.json:
"watchAssets": true,
"watchOptions": {
  "poll": 1000
}

# Restart dev server
docker-compose restart backend
```

### 9. **TypeScript Compilation Errors**

**Problem:** "Cannot find module" or type errors.

**Solution:**
```bash
# Clear build cache
docker exec lcbp3-backend rm -rf dist

# Reinstall dependencies
docker exec lcbp3-backend rm -rf node_modules package-lock.json
docker exec lcbp3-backend npm install

# Check TypeScript version matches
docker exec lcbp3-backend npm list typescript
```

### 10. **Document Numbering Duplicates**

**Problem:** Race condition causes duplicate document numbers.

**Solution:**
```bash
# Ensure Redis is running (required for distributed locks)
docker ps | grep redis

# Check Redis connection in logs
docker logs lcbp3-backend | grep -i redis

# Verify ENABLE_REDIS_LOCK=true in .env

# Check database constraints are in place
docker exec -i lcbp3-mariadb mysql -u root -p lcbp3_dms -e "
SHOW CREATE TABLE document_number_counters;
"
```

---

## 📚 Next Steps

### Learn More

1. **Architecture** - [System Architecture](../02-architecture/system-architecture.md)
2. **Development** - [Backend Guidelines](../03-implementation/backend-guidelines.md)
3. **Deployment** - [Deployment Guide](../04-operations/deployment-guide.md)
4. **Decisions** - [ADR Index](../05-decisions/README.md)

### Join the Team

1. Read [Contributing Guidelines](../../CONTRIBUTING.md)
2. Pick a task from [Backend Tasks](../06-tasks/README.md)
3. Create a branch: `git checkout -b feature/my-feature`
4. Make changes and write tests
5. Submit Pull Request

---

## 💡 Tips & Best Practices

### Development

- ✅ Always write tests for new features
- ✅ Follow coding guidelines
- ✅ Use TypeScript strict mode
- ✅ Add JSDoc for public APIs
- ✅ Keep Pull Requests small

### Git Workflow

```bash
# Update main branch
git checkout main
git pull

# Create feature branch
git checkout -b feature/my-feature

# Make commits
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/my-feature
```

### Code Review

- Review [Backend Guidelines](../03-implementation/backend-guidelines.md)
- Check test coverage
- Verify documentation updated
- Run linter: `npm run lint`
- Run tests: `npm test`

---

## 🆘 Getting Help

### Resources

- **Documentation:** `/specs` directory
- **API Docs:** <http://localhost:3000/api/docs>
- **Issue Tracker:** [Link to issue tracker]

### Contact

- **Tech Lead:** [Email]
- **DevOps:** [Email]
- **Slack:** #lcbp3-dms

---

## ✅ Checklist for First Day

- [ ] Clone repository
- [ ] Install prerequisites
- [ ] Setup environment variables
- [ ] Start Docker services
- [ ] Run migrations
- [ ] Access backend (<http://localhost:3000/health>)
- [ ] Access frontend (<http://localhost:3001>)
- [ ] Login with default credentials
- [ ] Run tests
- [ ] Read [System Architecture](../02-architecture/system-architecture.md)
- [ ] Read [Backend Guidelines](../03-implementation/backend-guidelines.md)
- [ ] Pick first task from [Tasks](../06-tasks/README.md)

---

**Welcome aboard! 🎉**

**Version:** 1.5.1
**Last Updated:** 2025-12-02
