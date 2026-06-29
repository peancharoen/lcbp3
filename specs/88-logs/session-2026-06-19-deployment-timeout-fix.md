# Session — 2026-06-19 (Deployment Timeout Fix)

## Summary

Fixed CI/CD deployment timeout issue caused by ClamAV container recreation taking 5+ minutes during healthcheck, causing SSH connection to timeout before deployment completed.

## ปัญหาที่พบ (Root Cause)

**Error:** `context deadline exceeded` during container recreation on QNAP

**Root Cause:**
- CI workflow SSH timeout: `ConnectTimeout=30` + `ServerAliveCountMax=10` (5 minutes total keepalive)
- ClamAV healthcheck `start_period: 300s` (5 minutes) before it's considered healthy
- Backend depends on clamav being healthy before starting
- `docker compose up -d --force-recreate` recreates clamav first, which takes 5+ minutes to become healthy
- No output during this period → SSH connection times out

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------------- |
| `scripts/deploy.sh` | Added clamav health check before recreation - if healthy, only recreate backend/frontend (skip 5-minute delay) |
| `.gitea/workflows/ci-deploy.yml` | Increased CI timeout from 20 to 30 minutes as safety net |

## กฎที่ Lock แล้ว

- **D18:** Deploy script must check ClamAV health status before recreation to avoid unnecessary 5-minute healthcheck delay
- **D19:** CI timeout should be at least 30 minutes to accommodate ClamAV startup if full recreation is needed

## Verification

- [ ] Deploy script tested locally to verify clamav health check logic
- [ ] CI workflow tested with new timeout setting
- [ ] Next deployment completes without SSH timeout
