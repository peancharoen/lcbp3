# Infrastructure & Operations (OPS) Guide

**Project:** LCBP3-DMS
**Version:** 1.8.0
**Last Updated:** 2026-02-23

---

## 📋 Overview

This directory (`04-Infrastructure-OPS/`) serves as the single source of truth for all infrastructure setups, networking rules, Docker Compose configurations, backups, and site reliability operations for the LCBP3-DMS project.

It consolidates what was previously split across multiple operations and specification folders into a cohesive set of manuals for DevOps, System Administrators, and On-Call Engineers.

---

## 📂 Document Index

| File                                                                     | Purpose                | Key Contents                                                                                                                                    |
| ------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **[04-01-docker-compose.md](./04-01-docker-compose.md)**                 | Core Environment Setup | `.env` configs, Blue/Green Docker Compose, MariaDB & Redis optimization, **Appendix A: Live QNAP configs** (MariaDB, Redis/ES, NPM, Gitea, n8n) |
| **[04-02-backup-recovery.md](./04-02-backup-recovery.md)**               | Disaster Recovery      | RTO/RPO strategies, QNAP to ASUSTOR backup scripts, Restic/Mysqldump config                                                                     |
| **[04-03-monitoring.md](./04-03-monitoring.md)**                         | Observability          | Prometheus metrics, AlertManager rules, Grafana alerts                                                                                          |
| **[04-04-deployment-guide.md](./04-04-deployment-guide.md)**             | Production Rollout     | Blue-Green deployment scripts, **Appendix A: QNAP Container Station**, **Appendix B: Gitea Actions CI/CD**, **Appendix C: act_runner setup**    |
| **[04-05-maintenance-procedures.md](./04-05-maintenance-procedures.md)** | Routine Care           | Log rotation, dependency updates, scheduled DB optimizations                                                                                    |
| **[04-06-security-operations.md](./04-06-security-operations.md)**       | Hardening & Audit      | User access review, SSL renewals, vulnerability scanning, **Appendix A: SSH Setup**, **Appendix B: Secrets Management**                         |
| **[04-07-incident-response.md](./04-07-incident-response.md)**           | Escalation             | P0-P3 classifications, incident commander roles, Post-Incident Review                                                                           |

### 🐳 Live Docker Compose Files (QNAP)

| File                                                   | Application                                    | Path on QNAP                  |
| ------------------------------------------------------ | ---------------------------------------------- | ----------------------------- |
| **[docker-compose-app.yml](./docker-compose-app.yml)** | `lcbp3-app` (backend + frontend)               | `/share/np-dms/app/`          |
| **[lcbp3-monitoring.yml](./lcbp3-monitoring.yml)**     | `lcbp3-monitoring` (Prometheus, Grafana, etc.) | `/volume1/np-dms/monitoring/` |
| **[lcbp3-registry.yml](./lcbp3-registry.yml)**         | `lcbp3-registry` (Docker Registry)             | `/volume1/np-dms/registry/`   |
| **[grafana/](./grafana/)**                             | Grafana dashboard JSON configs                 | Imported via Grafana UI       |

---

## 🎯 Guiding Principles

1. **Zero Downtime Deployments**: Utilize the Blue/Green architecture outlined in `04-04` wherever possible.
2. **Infrastructure as Code**: No manual unscripted changes. Modify the `docker-compose.yml` specs and `.env.production` templates directly.
3. **Automated Backups**: Backups must be validated automatically using the ASUSTOR pulling mechanism in `04-02`.
4. **Actionable Alerts**: No noisy monitoring. Prometheus alerts in `04-03` should route to Slack/PagerDuty only when action is required.
