# Quick Start Guide

**Project:** LCBP3-DMS
**Version:** 1.5.0
**Last Updated:** 2025-12-01

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

# Run SQL file
docker exec -i lcbp3-mariadb mysql -u root -p lcbp3_dms < script.sql
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
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
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
- **API Docs:** http://localhost:3000/api/docs
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
- [ ] Access backend (http://localhost:3000/health)
- [ ] Access frontend (http://localhost:3001)
- [ ] Login with default credentials
- [ ] Run tests
- [ ] Read [System Architecture](../02-architecture/system-architecture.md)
- [ ] Read [Backend Guidelines](../03-implementation/backend-guidelines.md)
- [ ] Pick first task from [Tasks](../06-tasks/README.md)

---

**Welcome aboard! 🎉**

**Version:** 1.5.0
**Last Updated:** 2025-12-01
