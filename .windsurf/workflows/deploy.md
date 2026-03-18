---
description: Deploy the application via Gitea Actions to QNAP Container Station
---

# Deploy to Production

Use this workflow to deploy updated backend and/or frontend to QNAP via Gitea Actions CI/CD.
Follows `specs/04-Infrastructure-OPS/` and ADR-015.

## Pre-deployment Checklist

- [ ] All tests pass locally (`pnpm test:watch`)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No `any` types introduced
- [ ] Schema changes applied to `specs/03-Data-and-Storage/lcbp3-v1.7.0-schema.sql`
- [ ] Environment variables documented (NOT in `.env` files)

## Steps

1. **Commit and push to Gitea**

```bash
git status
git add .
git commit -m "feat(<scope>): <description>"
git push origin main
```

2. **Monitor Gitea Actions** — open Gitea web UI → Actions tab → verify pipeline starts

3. **Pipeline stages (automatic)**
   - `build-backend` → Docker image build + push to registry
   - `build-frontend` → Docker image build + push to registry
   - `deploy` → SSH to QNAP → `docker compose pull` + `docker compose up -d`

4. **Verify backend health**

```bash
curl http://<QNAP_IP>:3000/health
# Expected: { "status": "ok" }
```

5. **Verify frontend**

```bash
curl -I http://<QNAP_IP>:3001
# Expected: HTTP 200
```

6. **Check logs in Grafana** — navigate to Grafana → Loki → filter by container name
   - Backend: `container_name="lcbp3-backend"`
   - Frontend: `container_name="lcbp3-frontend"`

7. **Verify database** — confirm schema changes are reflected (if any)

8. **Rollback (if needed)**

```bash
# SSH into QNAP
docker compose pull <service>=<previous-image-tag>
docker compose up -d <service>
```

## Common Issues

| Symptom           | Cause                 | Fix                                 |
| ----------------- | --------------------- | ----------------------------------- |
| Backend unhealthy | DB connection failed  | Check MariaDB container + env vars  |
| Frontend blank    | Build error           | Check Next.js build logs in Grafana |
| 502 Bad Gateway   | Container not started | `docker compose ps` to check status |
| Pipeline stuck    | Gitea runner offline  | Restart runner on QNAP              |
