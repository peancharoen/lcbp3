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

| File                                                                     | Purpose                | Key Contents                                                                                |
| ------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------- |
| **[04-01-docker-compose.md](./04-01-docker-compose.md)**                 | Core Environment Setup | `.env` configs, Blue/Green Docker Compose, MariaDB & Redis optimization                     |
| **[04-02-backup-recovery.md](./04-02-backup-recovery.md)**               | Disaster Recovery      | RTO/RPO strategies, QNAP to ASUSTOR backup scripts, Restic/Mysqldump config                 |
| **[04-03-monitoring.md](./04-03-monitoring.md)**                         | Observability          | Prometheus metrics, AlertManager rules (inclusive of Document Numbering DB), Grafana alerts |
| **[04-04-deployment-guide.md](./04-04-deployment-guide.md)**             | Production Rollout     | Step-by-step Blue-Green deployment scripts, rollback playbooks, Nginx Reverse Proxy         |
| **[04-05-maintenance-procedures.md](./04-05-maintenance-procedures.md)** | Routine Care           | Log rotation, dependency zero-downtime updates, scheduled DB optimizations                  |
| **[04-06-security-operations.md](./04-06-security-operations.md)**       | Hardening & Audit      | User access review scripts, SSL renewals, vulnerability scanning procedures                 |
| **[04-07-incident-response.md](./04-07-incident-response.md)**           | Escalation             | P0-P3 classifications, incident commander roles, Post-Incident Review (PIR)                 |

---

## 🎯 Guiding Principles

1. **Zero Downtime Deployments**: Utilize the Blue/Green architecture outlined in `04-04` wherever possible.
2. **Infrastructure as Code**: No manual unscripted changes. Modify the `docker-compose.yml` specs and `.env.production` templates directly.
3. **Automated Backups**: Backups must be validated automatically using the ASUSTOR pulling mechanism in `04-02`.
4. **Actionable Alerts**: No noisy monitoring. Prometheus alerts in `04-03` should route to Slack/PagerDuty only when action is required.
