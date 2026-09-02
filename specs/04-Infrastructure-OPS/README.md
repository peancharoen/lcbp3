# Infrastructure & Operations (OPS) Guide

**Project:** LCBP3-DMS
**Version:** 1.9.17 (post-ADR-041 Server Consolidation + Live Edit Protocol)
**Last Updated:** 2026-09-02

---

## 📋 Overview

This directory (`04-Infrastructure-OPS/`) serves as the single source of truth for all infrastructure setups, networking rules, Docker Compose configurations, backups, and site reliability operations for the LCBP3-DMS project.

It consolidates what was previously split across multiple operations and specification folders into a cohesive set of manuals for DevOps, System Administrators, and On-Call Engineers.

> **ADR-041 (Server Consolidation, 2026-06-20):** ย้าย services ทั้งหมดไปรวมบน `np-dms-lcbp3` (single-host Docker, 4 layers) — QNAP และ Desk-5439 stacks ถูก archived (ดู `99-archives/04-00-docker-compose-QNAP/` และ `99-archives/04-00-docker-compose-Desk-5439/`)
>
> **Real-world state (2026-08-03):** QNAP ไม่รัน Docker อีกต่อไป — Edge proxy ใช้ Cloudflare Tunnel บน `np-dms-lcbp3` (เปลี่ยนจาก ADR-041 เดิมที่วาง NPM ไว้บน QNAP)
>
> **🔒 v1.8.9 Infrastructure Hardening (Apr 2026, historical):** Full Docker Compose security pass — 27 findings addressed. See `04-00-docker-compose/SECURITY-MIGRATION-v1.8.6.md` สำหรับ runbook (pre-ADR-041 layout)

---

## 📂 Document Index

| File                                                                              | Purpose                | Key Contents                                                                                                                                    |
| --------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **[04-00-docker-compose/](./04-00-docker-compose/)**                              | 🔒 **Compose Stacks** | Production compose files — **np-dms-lcbp3 (4 layers, current)** + ASUSTOR (monitoring/registry/runner). See [04-00-docker-compose/README.md](./04-00-docker-compose/README.md) |
| **[04-01-docker-compose.md](./04-01-docker-compose.md)**                          | Core Environment Setup | `.env` configs, Blue/Green Docker Compose, MariaDB & Redis optimization, **Appendix A: Live QNAP configs** (MariaDB, Redis/ES, NPM, Gitea, n8n) — ⚠️ pre-ADR-041, ใช้อ้างอิงประวัติ |
| **[04-02-backup-recovery.md](./04-02-backup-recovery.md)**                        | Disaster Recovery      | RTO/RPO strategies, QNAP to ASUSTOR backup scripts, Restic/Mysqldump config (QNAP = NAS/backup only post-ADR-041)                                |
| **[04-03-monitoring.md](./04-03-monitoring.md)**                                  | Observability          | Prometheus metrics, AlertManager rules, Grafana alerts                                                                                          |
| **[04-04-deployment-guide.md](./04-04-deployment-guide.md)**                      | Production Rollout     | Blue-Green deployment scripts, **Appendix A: QNAP Container Station** (⚠️ archived), **Appendix B: Gitea Actions CI/CD**, **Appendix C: act_runner setup**    |
| **[04-network-infrastructure-guide.md](./04-network-infrastructure-guide.md)**    | 🔥 **Network Design**  | Omada SDN configuration, VLAN mapping, Port Profiles, STP Security, AMPCOM 2.5G integration, Security Hardening |
| **[04-05-maintenance-procedures.md](./04-05-maintenance-procedures.md)**          | Routine Care           | Log rotation, dependency updates, scheduled DB optimizations                                                                                    |
| **[04-06-security-operations.md](./04-06-security-operations.md)**                | Hardening & Audit      | User access review, SSL renewals, vulnerability scanning, **Appendix A: SSH Setup**, **Appendix B: Secrets Management**                         |
| **[04-07-incident-response.md](./04-07-incident-response.md)**                    | Escalation             | P0-P3 classifications, incident commander roles, Post-Incident Review                                                                           |
| **[🚀 04-08-release-management-policy.md](./04-08-release-management-policy.md)** | Release Policy         | SemVer, Git Flow, 5 Release Gates, Hotfix Process, Rollback Policy, CI/CD Pipeline                                                              |

### 🐳 Live Docker Compose Files (post-ADR-041)

หลัง ADR-041 ย้าย services ทั้งหมดไปรวมบน `np-dms-lcbp3` (single-host Docker, 4 layers) — Stack ปัจจุบันอยู่ใต้ [`04-00-docker-compose/np-dms-lcbp3/`](./04-00-docker-compose/np-dms-lcbp3/) และ ASUSTOR (monitoring/registry/runner):

| Stack | File | Path on host |
| ----- | ---- | ----------- |
| **Basic** (portainer) | `np-dms-lcbp3/00-basic/docker-compose.yml` | `/opt/np-dms/00-basic/` |
| **Infrastructure** (mariadb, pma, redis, elasticsearch, qdrant, exporters) | `np-dms-lcbp3/01-infrastructure/docker-compose.yml` | `/opt/np-dms/01-infrastructure/` |
| **Platform** (gitea, n8n) | `np-dms-lcbp3/02-platform/docker-compose.yml` | `/opt/np-dms/02-platform/` |
| **Application** (clamav, backend, frontend) | `np-dms-lcbp3/03-application/docker-compose.yml` | `/opt/np-dms/03-application/` |
| **AI** (ocr-sidecar, ollama, ollama-metrics — ADR-040/043) | `np-dms-lcbp3/04-ai/docker-compose.yml` | `/opt/np-dms/04-ai/` |
| **OCR Sidecar** (FastAPI — ADR-040) | `np-dms-lcbp3/04-ai/ocr-sidecar/docker-compose.yml` | `/opt/np-dms/04-ai/ocr-sidecar/` |
| **Registry** (registry + registry-ui, htpasswd auth) | `ASUSTOR/registry/docker-compose.yml` | `/volume1/np-dms/registry/` |
| **Gitea Runner** (act_runner) | `ASUSTOR/gitea-runner/docker-compose.yml` | `/volume1/np-dms/gitea-runner/` |
| **Monitoring Stack** (prometheus + grafana + loki + promtail + uptime-kuma) | `ASUSTOR/monitoring/docker-compose.yml` | `/volume1/np-dms/monitoring/` |

> **Archived stacks (pre-ADR-041):** QNAP และ Desk-5439 ถูกย้ายไป `99-archives/04-00-docker-compose-QNAP/` และ `99-archives/04-00-docker-compose-Desk-5439/` ตาม ADR-041 + สถานะจริงที่ QNAP ไม่รัน Docker อีกต่อไป

ไฟล์เสริม: [`x-base.yml`](./04-00-docker-compose/x-base.yml) (shared YAML anchors), [`.env.template`](./04-00-docker-compose/.env.template) (ตัวแบบ secrets), per-stack `.env.example` ในแต่ละ folder.

---

## 🎯 Guiding Principles

1. **Zero Downtime Deployments**: Utilize the Blue/Green architecture outlined in `04-04` wherever possible.
2. **Infrastructure as Code**: No manual unscripted changes. Modify the `docker-compose.yml` specs and `.env.production` templates directly.
3. **Automated Backups**: Backups must be validated automatically using the ASUSTOR pulling mechanism in `04-02`.
4. **Actionable Alerts**: No noisy monitoring. Prometheus alerts in `04-03` should route to Slack/PagerDuty only when action is required.
5. **🔒 Secret Hygiene (v1.8.9)**: No secrets in git — use `env_file: .env` (gitignored) per stack. Rotate any secret that appeared in history. Roadmap: Docker Swarm secrets → Infisical / Vault / SOPS (see `04-00-docker-compose/README.md` §S1).
6. **Container Hardening (ADR-016 + M4)**: All app containers must set `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`, non-root `user:`, and `read_only: true` where compatible. Pin every image tag — no `:latest` in production.
