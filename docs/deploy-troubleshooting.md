# Deploy Troubleshooting Guide

## 🔧 Common Deploy Issues & Solutions

### ⚠️ Container Removal Timeout

**Error**: `failed to remove container: Error response from daemon: removal of container xxx is already in progress`

**Causes**:

- Container is still running processes
- QNAP Container Station interference
- Docker daemon issues

**Solutions**:

#### 1. **Manual Cleanup (SSH to QNAP)**

```bash
# SSH to QNAP
ssh admin@your-qnap-ip

# Export Docker PATH
export PATH="/share/CACHEDEV1_DATA/.qpkg/container-station/bin:/opt/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Force stop containers
docker stop backend frontend 2>/dev/null || true
docker kill backend frontend 2>/dev/null || true

# Force remove with multiple attempts
docker rm -f backend frontend 2>/dev/null || true
sleep 3
docker rm -f $(docker ps -aq) 2>/dev/null || true

# System cleanup
docker system prune -f --volumes
docker system df
```

#### 2. **Container Station GUI Fix**

1. Open QNAP Container Station
2. Stop all containers manually
3. Delete containers manually
4. Try deploy again

#### 3. **Docker Daemon Restart**

```bash
# Restart Docker service (QNAP specific)
/etc/init.d/container-station.sh restart
# Or reboot QNAP if needed
reboot
```

### ⚠️ SSH Connection Timeout

**Error**: `Run Command Timeout`

**Solutions**:

#### 1. **Increase Timeouts** (Updated in deploy.yaml)

```yaml
timeout: 1200s # 20 minutes total
command_timeout: 900s # 15 minutes per command
```

#### 2. **Check Network**

```bash
# Test SSH connectivity
ssh -o ConnectTimeout=30 admin@your-qnap-ip "echo 'SSH OK'"

# Test Docker via SSH
ssh admin@your-qnap-ip "docker --version"
```

### ⚠️ Build Failures

**Frontend Build Issues**:

```bash
# Check Node.js version
node --version  # Should be v18+
npm --version   # Should be v9+

# Clear build cache
cd /share/np-dms/app/source/lcbp3
rm -rf frontend/.next frontend/node_modules/.cache
pnpm install
pnpm run build
```

**Backend Build Issues**:

```bash
# Check dependencies
cd /share/np-dms/app/source/lcbp3/backend
pnpm install
pnpm run build
```

### ⚠️ Health Check Failures

**Backend not healthy**:

```bash
# Check container logs
docker logs backend

# Check container status
docker ps
docker inspect backend

# Manual health check
curl -f http://localhost:3001/health || echo "Health check failed"
```

## 🚀 Quick Deploy Commands

### Manual Deploy (SSH to QNAP)

```bash
# 1. Update code
cd /share/np-dms/app/source/lcbp3
git pull origin main

# 2. Build images
docker build -f backend/Dockerfile -t lcbp3-backend:latest .
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api \
  -t lcbp3-frontend:latest .

# 3. Deploy
cd /share/np-dms/app
docker compose -f docker-compose-app.yml down
docker compose -f docker-compose-app.yml up -d
```

### Rollback Commands

```bash
# Stop current
cd /share/np-dms/app
docker compose -f docker-compose-app.yml down

# Use previous images (if tagged)
docker compose -f docker-compose-app.yml up -d

# Or checkout previous commit
cd /share/np-dms/app/source/lcbp3
git log --oneline -10  # Find previous commit
git checkout <previous-commit-hash>
# Then rebuild and deploy
```

## 📊 Monitoring Deploy Status

### Check Services

```bash
# Container status
docker ps -a

# Service URLs
curl -I https://lcbp3.np-dms.work
curl -I https://backend.np-dms.work/api/health

# Logs
docker logs backend --tail 50
docker logs frontend --tail 50
```

### System Resources

```bash
# Docker system info
docker system df
docker stats

# QNAP resources
top
free -h
df -h
```

## 🆘 Emergency Procedures

### Full Reset

```bash
# Stop everything
docker stop $(docker ps -q) 2>/dev/null || true

# Remove everything
docker rm -f $(docker ps -aq) 2>/dev/null || true
docker system prune -af --volumes

# Rebuild from scratch
cd /share/np-dms/app/source/lcbp3
git pull origin main
docker build -f backend/Dockerfile -t lcbp3-backend:latest .
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.np-dms.work/api \
  -t lcbp3-frontend:latest .

cd /share/np-dms/app
docker compose -f docker-compose-app.yml up -d
```

### Contact Support

- Check logs: `docker logs backend`, `docker logs frontend`
- System status: `docker ps -a`, `docker system df`
- Network: `curl -I` test URLs
- QNAP Container Station status

---

**Last Updated**: 2026-03-19  
**Version**: LCBP3-DMS v1.8.1
