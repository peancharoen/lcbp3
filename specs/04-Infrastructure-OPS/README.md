# Infrastructure & Operations (OPS) Guide

**Project:** LCBP3-DMS
**Version:** 1.8.9 (Infrastructure Hardening)
**Last Updated:** 2026-04-18

---

## 📋 Overview

This directory (`04-Infrastructure-OPS/`) serves as the single source of truth for all infrastructure setups, networking rules, Docker Compose configurations, backups, and site reliability operations for the LCBP3-DMS project.

It consolidates what was previously split across multiple operations and specification folders into a cohesive set of manuals for DevOps, System Administrators, and On-Call Engineers.

> **🔒 v1.8.9 Infrastructure Hardening (Apr 2026):**
> Full Docker Compose security pass completed — 27 findings (C1–C6, H1–H7, M1–M9, L1–L5, S1–S4) addressed.
> All secrets externalized, container hardening applied, auth enforced on Mongo + Registry. See `04-00-docker-compose/SECURITY-MIGRATION-v1.8.6.md` for the full runbook.

---

## 📂 Document Index

| File                                                                              | Purpose                | Key Contents                                                                                                                                    |
| --------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **[04-00-docker-compose/](./04-00-docker-compose/)**                              | 🔒 **Compose Stacks** | Production compose files for all QNAP + ASUSTOR stacks. See [04-00-docker-compose/README.md](./04-00-docker-compose/README.md) + `SECURITY-MIGRATION-v1.8.6.md` |
| **[04-01-docker-compose.md](./04-01-docker-compose.md)**                          | Core Environment Setup | `.env` configs, Blue/Green Docker Compose, MariaDB & Redis optimization, **Appendix A: Live QNAP configs** (MariaDB, Redis/ES, NPM, Gitea, n8n) |
| **[04-02-backup-recovery.md](./04-02-backup-recovery.md)**                        | Disaster Recovery      | RTO/RPO strategies, QNAP to ASUSTOR backup scripts, Restic/Mysqldump config                                                                     |
| **[04-03-monitoring.md](./04-03-monitoring.md)**                                  | Observability          | Prometheus metrics, AlertManager rules, Grafana alerts                                                                                          |
| **[04-04-deployment-guide.md](./04-04-deployment-guide.md)**                      | Production Rollout     | Blue-Green deployment scripts, **Appendix A: QNAP Container Station**, **Appendix B: Gitea Actions CI/CD**, **Appendix C: act_runner setup**    |
| **[04-05-maintenance-procedures.md](./04-05-maintenance-procedures.md)**          | Routine Care           | Log rotation, dependency updates, scheduled DB optimizations                                                                                    |
| **[04-06-security-operations.md](./04-06-security-operations.md)**                | Hardening & Audit      | User access review, SSL renewals, vulnerability scanning, **Appendix A: SSH Setup**, **Appendix B: Secrets Management**                         |
| **[04-07-incident-response.md](./04-07-incident-response.md)**                    | Escalation             | P0-P3 classifications, incident commander roles, Post-Incident Review                                                                           |
| **[🚀 04-08-release-management-policy.md](./04-08-release-management-policy.md)** | Release Policy         | SemVer, Git Flow, 5 Release Gates, Hotfix Process, Rollback Policy, CI/CD Pipeline                                                              |

### 🐳 Live Docker Compose Files (v1.8.9)

ทั้งหมดย้ายมาอยู่ใต้ [`04-00-docker-compose/`](./04-00-docker-compose/) แล้ว พร้อม hardening (secrets ผ่าน `env_file`, `read_only`, `cap_drop`, healthchecks, resource limits, auth บน Mongo + Registry):

| Stack | File | Path on NAS |
| ----- | ---- | ----------- |
| **App** (backend + frontend + clamav) | `QNAP/app/docker-compose-app.yml` | `/share/np-dms/app/` |
| **Database** (mariadb + pma) | `QNAP/mariadb/docker-compose-lcbp3-db.yml` | `/share/np-dms/mariadb/` |
| **Services** (redis + elasticsearch) | `QNAP/service/docker-compose.yml` | `/share/np-dms/services/` |
| **Reverse Proxy** (npm + landing) | `QNAP/npm/docker-compose.yml` | `/share/np-dms/npm/` |
| **Git** (gitea) | `QNAP/gitea/docker-compose.yml` | `/share/np-dms/git/` |
| **Automation** (n8n + tika + docker-socket-proxy) | `QNAP/n8n/docker-compose.yml` | `/share/np-dms/n8n/` |
| **Chat** (mongodb + rocketchat) | `QNAP/rocketchat/docker-compose.yml` | `/share/np-dms/rocketchat/` |
| **Monitoring Exporters** (node-exporter + cadvisor) | `QNAP/monitoring/docker-compose.yml` | `/share/np-dms/monitoring/` |
| **Registry** (registry + registry-ui, htpasswd auth) | `ASUSTOR/registry/docker-compose.yml` | `/volume1/np-dms/registry/` |
| **Gitea Runner** (act_runner) | `ASUSTOR/gitea-runner/docker-compose.yml` | `/volume1/np-dms/gitea-runner/` |
| **Monitoring Stack** (prometheus + grafana + loki + promtail + uptime-kuma) | `ASUSTOR/monitoring/docker-compose.yml` | `/volume1/np-dms/monitoring/` |

ไฟล์เสริม: [`x-base.yml`](./04-00-docker-compose/x-base.yml) (shared YAML anchors), [`.env.template`](./04-00-docker-compose/.env.template) (ตัวแบบ secrets), per-stack `.env.example` ในแต่ละ folder.

---

## 🎯 Guiding Principles

1. **Zero Downtime Deployments**: Utilize the Blue/Green architecture outlined in `04-04` wherever possible.
2. **Infrastructure as Code**: No manual unscripted changes. Modify the `docker-compose.yml` specs and `.env.production` templates directly.
3. **Automated Backups**: Backups must be validated automatically using the ASUSTOR pulling mechanism in `04-02`.
4. **Actionable Alerts**: No noisy monitoring. Prometheus alerts in `04-03` should route to Slack/PagerDuty only when action is required.
5. **🔒 Secret Hygiene (v1.8.9)**: No secrets in git — use `env_file: .env` (gitignored) per stack. Rotate any secret that appeared in history. Roadmap: Docker Swarm secrets → Infisical / Vault / SOPS (see `04-00-docker-compose/README.md` §S1).
6. **Container Hardening (ADR-016 + M4)**: All app containers must set `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`, non-root `user:`, and `read_only: true` where compatible. Pin every image tag — no `:latest` in production.
