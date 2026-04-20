# Quick Start Guide: Infrastructure Operations & Deployment Automation

**Purpose**: Get started with the Infrastructure Operations & Deployment Automation feature  
**Date**: 2026-04-20  
**Target Audience**: DevOps Engineers, System Administrators

## Prerequisites

### Hardware Requirements
- QNAP NAS (192.168.10.8) with Docker support
- ASUSTOR NAS (192.168.10.9) with Docker support
- SSH access between NAS devices configured
- Minimum 100GB storage for backups

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Bash 5.0+ or PowerShell 7.2+
- Git client
- SSH key authentication

### Network Requirements
- Static IP addresses for both NAS devices
- Open ports: 22 (SSH), 80/443 (HTTP/HTTPS), 8080 (applications)
- VPN or secure network connection for remote access

## Initial Setup

### 1. Repository Configuration

```bash
# Clone the repository
git clone https://git.np-dms.work/np-dms/lcbp3.git
cd lcbp3

# Switch to the infrastructure branch
git checkout 002-infra-ops
```

### 2. SSH Key Authentication

Ensure SSH keys are configured between QNAP and ASUSTOR:

```bash
# Test SSH connectivity
ssh admin@192.168.10.8 "docker --version"
ssh admin@192.168.10.9 "docker --version"
```

### 3. Environment Configuration

Copy and configure environment files:

```bash
# QNAP environments
cp specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/.env.example \
   specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app/.env

# ASUSTOR environments
cp specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/registry/.env.example \
   specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/registry/.env
```

Edit the `.env` files with your specific configurations:
- Database passwords
- SSL certificate paths
- Backup storage locations
- Monitoring endpoints

## Core Services Deployment

### 1. Database Services (QNAP)

```bash
# Navigate to QNAP database directory
cd specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/mariadb

# Deploy MariaDB with phpMyAdmin
docker-compose -f docker-compose-lcbp3-db.yml up -d

# Verify deployment
docker-compose -f docker-compose-lcbp3-db.yml ps
```

### 2. Application Services (QNAP)

```bash
# Navigate to QNAP app directory
cd specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app

# Deploy backend, frontend, and ClamAV
docker-compose -f docker-compose-app.yml up -d

# Verify deployment
docker-compose -f docker-compose-app.yml ps
```

### 3. Reverse Proxy (QNAP)

```bash
# Navigate to Nginx Proxy Manager directory
cd specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/npm

# Deploy reverse proxy
docker-compose -f docker-compose.yml up -d

# Access Nginx Proxy Manager
# URL: http://192.168.10.8:81
# Default: admin@example.com / changeme
```

### 4. Monitoring Stack (ASUSTOR)

```bash
# Navigate to ASUSTOR monitoring directory
cd specs/04-Infrastructure-OPS/04-00-docker-compose/ASUSTOR/monitoring

# Deploy Prometheus, Grafana, and supporting services
docker-compose -f docker-compose.yml up -d

# Verify deployment
docker-compose -f docker-compose.yml ps
```

## SSL Certificate Setup

### 1. Initial Certificate Generation

```bash
# On QNAP, generate Let's Encrypt certificates
cd specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/npm

# Run certbot for initial certificate
docker-compose exec npm certbot --nginx -d your-domain.com
```

### 2. Automated Renewal

Add to crontab for automatic renewal:

```bash
# Edit crontab
crontab -e

# Add renewal task (runs daily at 2 AM)
0 2 * * * cd /path/to/npm && docker-compose exec npm certbot renew
```

## Backup Configuration

### 1. Initial Backup Setup

```bash
# Navigate to backup scripts directory
cd specs/04-Infrastructure-OPS/04-02-backup-recovery

# Configure backup destinations
cp backup-config.example.yml backup-config.yml

# Edit backup-config.yml with your storage locations
nano backup-config.yml
```

### 2. Automated Backup Schedule

```bash
# Add backup cron job (runs daily at 1 AM)
0 1 * * * /path/to/backup-scripts/daily-backup.sh

# Add backup validation (runs weekly on Sunday at 3 AM)
0 3 * * 0 /path/to/backup-scripts/validate-backups.sh
```

## Monitoring Configuration

### 1. Grafana Dashboard Access

1. Access Grafana: `http://192.168.10.9:3000`
2. Default credentials: `admin / admin` (change on first login)
3. Import dashboards from `specs/04-Infrastructure-OPS/04-03-monitoring/dashboards/`

### 2. Alert Configuration

1. Access AlertManager: `http://192.168.10.9:9093`
2. Configure notification channels (email, Slack, etc.)
3. Test alert rules to ensure notifications work

## Blue-Green Deployment

### 1. Environment Setup

```bash
# Create blue environment (current production)
cd specs/04-Infrastructure-OPS/04-00-docker-compose/QNAP/app
docker-compose -f docker-compose-app.yml -p app-blue up -d

# Create green environment (new version)
docker-compose -f docker-compose-app.yml -p app-green up -d
```

### 2. Traffic Switching

```bash
# Switch traffic to green environment
# Update Nginx Proxy Manager upstream configuration
# Point to green environment containers
# Test green environment functionality
```

### 3. Rollback Procedure

```bash
# If issues detected, rollback to blue
# Update Nginx Proxy Manager upstream configuration
# Point back to blue environment containers
# Stop green environment containers
```

## Security Hardening

### 1. Container Security Scan

```bash
# Install Trivy
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Scan all running containers
trivy image --severity HIGH,CRITICAL $(docker ps --format "table {{.Image}}" | tail -n +2)
```

### 2. Security Policy Validation

```bash
# Run security validation script
cd specs/04-Infrastructure-OPS/04-06-security-operations
./validate-security-policies.sh
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker-compose logs [service-name]
   
   # Check resource usage
   docker stats
   ```

2. **Backup failures**
   ```bash
   # Check backup logs
   tail -f /var/log/backup.log
   
   # Test connectivity to backup storage
   ping backup-storage-host
   ```

3. **Monitoring alerts not working**
   ```bash
   # Check Prometheus targets
   curl http://192.168.10.9:9090/api/v1/targets
   
   # Test AlertManager
   curl http://192.168.10.9:9093/api/v1/alerts
   ```

### Health Checks

```bash
# Check all services health
curl -f http://192.168.10.8:3000/health || echo "Backend unhealthy"
curl -f http://192.168.10.8/health || echo "Frontend unhealthy"
curl -f http://192.168.10.9:9090/-/healthy || echo "Prometheus unhealthy"
```

## Next Steps

1. **Configure automated monitoring alerts** for your specific thresholds
2. **Set up backup retention policies** based on your compliance requirements
3. **Implement disaster recovery testing** on a regular schedule
4. **Configure log aggregation** for centralized monitoring
5. **Set up automated security scanning** in your CI/CD pipeline

## Support

For issues and questions:
- Check the troubleshooting section above
- Review logs in `/var/log/` directories
- Consult the full documentation in `specs/04-Infrastructure-OPS/`
- Contact the infrastructure team for escalated issues
