# 🚀 Release Management Policy — LCBP3-DMS v1.9.0

---

title: 'Release Management Policy, Versioning Strategy, and Deployment Gates'
version: 1.1.0
status: DRAFT
owner: Nattanin Peancharoen (System Architect / Release Manager / Product Owner)
last_updated: 2026-05-16
related:

- specs/04-Infrastructure-OPS/04-04-deployment-guide.md ← Blue-Green Deployment Detail
- specs/04-Infrastructure-OPS/04-07-incident-response.md
- specs/06-Decision-Records/ADR-015-deployment.md
- specs/00-Overview/00-04-stakeholder-signoff-and-risk.md

---

> [!IMPORTANT]
> ทุก Release สู่ Production **ต้องผ่าน Release Gate** — มีข้อยกเว้นเฉพาะ P0 Emergency เท่านั้น
> เอกสารนี้กำหนด Policy ที่ทุกคนในทีมต้องปฏิบัติตาม

---

## 1. 🏷️ Versioning Strategy

### Semantic Versioning (SemVer) — `MAJOR.MINOR.PATCH`

```
v1.8.1
│ │ └── PATCH: Bug Fixes, Security Patches (Hotfix)
│ └──── MINOR: New Features, Enhancement (Sprint Release)
└────── MAJOR: Breaking Changes, Architectural Shift (กำหนดโดย PO)
```

| Type      | ตัวอย่าง        | เมื่อไหร่                                  |
| --------- | --------------- | ------------------------------------------ |
| **MAJOR** | v1.0.0 → v2.0.0 | Breaking Change, Major Architecture Change |
| **MINOR** | v1.8.0 → v1.9.0 | New Feature หลังจาก Sprint สำเร็จ          |
| **PATCH** | v1.8.0 → v1.8.1 | Bug Fix, Security Patch                    |

### Branch Strategy (Git Flow)

```
main ─────────────────────────────────────── Production (Protected)
  │
  ├── release/v1.9.0 ─────────────────────── Release Candidate
  │     └── bugfix/xxx ──────────────────── Bug Fixes บน RC
  │
  ├── develop ──────────────────────────── Integration Branch
  │     ├── feature/corr-export ──────────── Feature Branch
  │     ├── feature/notification-v2 ──────── Feature Branch
  │     └── ...
  │
  └── hotfix/v1.8.1-security-patch ──────── Hotfix (from main, back to main+develop)
```

### Tag Naming Convention

```bash
# Release Tags
git tag -a v1.8.0 -m "Release v1.8.0: MVP Go-Live"
git tag -a v1.8.1 -m "Hotfix v1.8.1: Security patch CVE-XXXX"

# Docker Image Tags
lcbp3-backend:v1.8.0
lcbp3-backend:latest   ← ชี้ไปยัง Version ล่าสุดที่ Production
lcbp3-backend:v1.8.0-rc.1  ← Release Candidate
```

---

## 2. 📋 Release Types & Cadence

| Release Type               | Cadence       | Who Approves                 | Notes                 |
| -------------------------- | ------------- | ---------------------------- | --------------------- |
| **Sprint Release** (Minor) | ทุก 2 สัปดาห์ (Ideal State) | PO + Lead Dev                | ตามแผน Sprint         |
| **Hotfix** (Patch)         | ตามเหตุการณ์  | System Architect/DevOps → PO Notify | ไม่รอ Sprint          |
| **Emergency Hotfix**       | ทันที (P0)    | System Architect/DevOps → แจ้ง PO พร้อมกัน  | Security, System Down |
| **Major Release**          | กำหนดโดย PO   | PO + กทท. Sign-off           | Phase Change          |

### Sprint Release Calendar (Ideal State - Not Yet Implemented)

> **หมายเหตุ:** Sprint cadence ทุก 2 สัปดาห์เป็น ideal state ยังไม่ได้ทำจริงในปัจจุบัน ปัจจุบะทำ release แบบ as-needed

```
Sprint 1:  01–14 มี.ค. 2569  → Release v1.9.0 (28 มี.ค.)
Sprint 2:  15–28 มี.ค. 2569  → Release v1.10.0 (11 เม.ย.)
...
```

---

## 3. 🚦 Release Gate Process

### Gate 1: Code Complete (วันสุดท้ายของ Sprint)

```
✅ Feature Freeze — ไม่รับ Feature ใหม่เข้า Release Branch
✅ All PRs Merged to release/vX.Y.Z
✅ Version number อัปเดตใน package.json + CHANGELOG.md
```

### Gate 2: Quality Gate (T-3 วันก่อน Release)

| Checkpoint                 | Tool               | Threshold                           |
| -------------------------- | ------------------ | ----------------------------------- |
| **TypeScript Compile**     | `tsc --noEmit`     | 0 Errors                            |
| **Unit Tests Pass**        | Jest               | ≥ 80% Pass Rate                     |
| **E2E Tests (Core Flows)** | Playwright          | 100% Core Flows ผ่าน                |
| **Security Scan**          | `npm audit`        | 0 Critical/High Vulnerabilities     |
| **UUID Misuse Check**      | grep script        | 0 parseInt on UUID (ADR-019)        |
| **Console.log Check**      | grep script        | 0 console.log in committed code     |
| **Lint**                   | ESLint             | 0 Errors (Warnings ยอมรับได้)       |
| **Build Success**          | Docker Build       | Exit 0                              |
| **Image Size**             | Docker inspect     | < 2GB (Backend), < 1.5GB (Frontend) |

**Owner:** System Architect/DevOps
**Tool:** Gitea CI/CD Pipeline (.gitea/workflows/ci-deploy.yml)

---

### Gate 3: Staging Validation (T-2 วันก่อน Release)

| Checkpoint                                                  | ผ่านเมื่อ                    | Owner       |
| ----------------------------------------------------------- | ---------------------------- | ----------- |
| Deploy to Staging Environment                               | สำเร็จ, ไม่มี Error          | DevOps      |
| Health Check `/health` → 200                                | ✅                           | Automated   |
| Smoke Test (Manual): Login → Create Correspondence → Submit | ผ่าน                         | Dev หรือ QA |
| Migration Script (ถ้ามี Schema Change)                      | รันสำเร็จบน Staging Schema   | System Architect/DevOps   |
| Rollback Test: Deploy → Rollback → Verify                   | ระบบ Rollback ได้ใน < 5 นาที | DevOps      |

**Owner:** Nattanin P. (System Architect / Release Manager / Product Owner)

---

### Gate 4: Release Approval (T-1 วันก่อน Release)

```
PO Review: ✅ Feature ครบตาม Sprint Goal?
PO Review: ✅ ไม่มี Known Blocker Issues?
PO Sign-off: ✅ อนุมัติ Release

ถ้ามี Schema Change:
  System Architect/DevOps Confirm: ✅ Schema SQL พร้อม Apply บน Production
  System Architect/DevOps Confirm: ✅ Rollback SQL พร้อม (ถ้าจำเป็น)
```

**Owner:** Nattanin P. (System Architect / Release Manager / Product Owner)

---

### Gate 5: Production Deployment & Verification

```
1. Deploy ตาม Blue-Green Process (deploy.sh)
   → Full script: specs/04-Infrastructure-OPS/04-04-deployment-guide.md

2. Post-Deploy Verification (15 นาที):
   ✅ Health Check: All containers healthy
   ✅ Smoke Test: Login + Core Feature
   ✅ Error Rate: < 1% (Grafana on ASUSTOR) ใน 15 นาทีแรก
   ✅ Response Time: P90 < 500ms (Grafana on ASUSTOR)

3. ถ้าผ่าน → RELEASE COMPLETE ✅
4. ถ้าไม่ผ่าน → ROLLBACK ทันที (rollback.sh)
```

---

## 4. 🔥 Hotfix Process

### เมื่อไหร่ต้อง Hotfix

| Priority          | ตัวอย่าง                                  | SLA Start Hotfix  | Deploy Target  |
| ----------------- | ----------------------------------------- | ----------------- | -------------- |
| **P0 — Critical** | ระบบล่ม, Data Corruption, Security Breach | ทันที (< 30 นาที) | < 4 ชั่วโมง    |
| **P1 — High**     | Feature หลักทำงานผิด, Login Fail          | < 2 ชั่วโมง       | < 24 ชั่วโมง   |
| **P2 — Medium**   | Feature รองทำงานผิด                       | ใน Sprint ถัดไป   | Sprint Release |
| **P3 — Low**      | UI Cosmetic, Minor UX                     | Backlog           | Sprint Release |

### Hotfix Workflow

```
1. Identify Bug (P0 หรือ P1)
   ↓
2. Create Branch: hotfix/v1.8.1-brief-description from main
   ↓
3. Fix + Unit Test + Security Check (< 2 ชั่วโมง สำหรับ P1)
   ↓
4. PR → Code Review (อย่างน้อย 1 คน)
   ↓
5. กรณี P0: Skip Staging → Deploy ตรง Production
   กรณี P1: Quick Staging Smoke Test → Deploy Production
   ↓
6. Merge back: main ← hotfix + develop ← hotfix
   ↓
7. Tag: v1.8.1 + Update CHANGELOG.md
   ↓
8. Notify PO + Stakeholders (LINE Group)
```

### P0 Emergency Deploy Script

```bash
# ใช้เฉพาะกรณี P0 เท่านั้น — ข้าม Staging
# ต้องได้รับ Lead Dev Approval ก่อน

cd /volume1/lcbp3/scripts
./deploy.sh --hotfix --skip-staging --version v1.8.1

# Log ทุก Step อัตโนมัติ
# Auto-rollback ถ้า Health Check Fail
```

---

## 5. 🔄 Rollback Policy

### เมื่อไหร่ต้อง Rollback

| Trigger                       | Threshold                 | Action                           |
| ----------------------------- | ------------------------- | -------------------------------- |
| Health Check Fail หลัง Deploy | 3 consecutive failures    | Auto-rollback                    |
| Error Rate สูง                | > 5% ใน 15 นาทีแรก        | Manual Rollback (DevOps trigger) |
| P90 Response Time สูงมาก      | > 2000ms ต่อเนื่อง 5 นาที | Manual Rollback                  |
| Critical Bug พบใน Production  | P0 Bug                    | Manual Rollback ทันที            |
| Migration Fail                | Error Rate > 20%          | Manual Rollback + Notify         |

### Rollback SLA

| Scenario                         | Target Rollback Time |
| -------------------------------- | -------------------- |
| Blue-Green Switch (nginx reload) | < 30 วินาที          |
| Full Container Restart           | < 5 นาที             |
| Database Rollback (SQL Revert)   | < 30 นาที            |
| Full System Restore (Backup)     | < 4 ชั่วโมง (RTO)    |

### Rollback Decision Tree

```
ตรวจพบปัญหาหลัง Deploy
         ↓
    P0 Bug? ──→ YES → Rollback ทันที (ไม่ต้องรอ Approval)
         ↓ NO
    Error Rate > 5%? ──→ YES → Consult Developer → Rollback ถ้าแก้ไม่ได้ใน 30 นาที
         ↓ NO
    Response Time > 2s? ──→ YES → Monitor 15 นาที → ถ้าไม่ดีขึ้น → Rollback
         ↓ NO
    Continue Monitoring (1 ชั่วโมง Hypercare)
```

---

## 6. 🧪 Testing Requirements per Release Type

### Sprint Release (Full Testing)

```
Unit Tests:          ≥ 80% coverage จาก Code Changed
Integration Tests:   ทุก API Endpoint ที่เปลี่ยน
E2E Tests:           Core Flows (Login, Submit Doc, Approve)
Security Scan:       npm audit + OWASP ZAP Passive Scan
Performance Test:    ถ้า Feature ใหม่กระทบ DB หรือ API
```

### Hotfix (Fast Testing)

```
Unit Tests:          เฉพาะ Code ที่ Fix
Regression Tests:    Test ที่ตรงกับ Bug ที่แก้
Smoke Test:          Login + Feature ที่ Fix
Security Check:      npm audit (ถ้าเป็น Security Bug)
```

### Schema Change Requirements

> ทุกครั้งที่มี DB Schema Change ต้องปฏิบัติตาม ADR-009 (No TypeORM Migrations)

```
1. แก้ไข: specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql
2. Update: specs/03-Data-and-Storage/03-01-data-dictionary.md
3. เตรียม: Delta SQL file ใน specs/03-Data-and-Storage/deltas/
   → ชื่อ: XX-description.sql (เรียงตามลำดับ)
4. Test บน Staging ก่อน Apply Production
5. แจ้ง User: ต้องมี Maintenance Window ถ้า ALTER TABLE กระทบ Performance
```

---

## 7. 📢 Release Communication

### Release Note Template

```markdown
# Release Notes — LCBP3-DMS v[X.Y.Z]

**Date:** YYYY-MM-DD | **Type:** Sprint Release / Hotfix

## 🆕 New Features

- [Feature Name]: [Brief description]

## 🐛 Bug Fixes

- **[BUG-ID]** [Screen/Module]: [What was wrong → What's fixed]

## 🔒 Security Updates

- [CVE/Issue]: [Description]

## ⚠️ Breaking Changes

- [If any — ระบุชัดเจน]

## 📋 Schema Changes

- [Table]: [Column added/modified/removed]
- **Action Required:** Admin ต้อง Apply SQL ใน `deltas/XX-description.sql`

## 🔧 Configuration Changes

- [Env Var]: [Change description]

## 📊 Performance Impact

- [Module]: [Expected improvement/change]
```

### Communication Channels

| Release Type           | Channel              | ผู้รับ                | Timing                        |
| ---------------------- | -------------------- | --------------------- | ----------------------------- |
| **Sprint Release**     | LINE Group (Support) | Org Admin ทุกองค์กร   | T-1 วัน (แจ้งล่วงหน้า)        |
| **Sprint Release**     | Email                | ผู้บริหาร + PO        | หลัง Deploy เสร็จ             |
| **Hotfix (P1)**        | LINE Group           | Org Admin             | พร้อมกับ Deploy               |
| **Hotfix (P0)**        | LINE Direct          | กทท. IT + NAP On-call | ก่อน Deploy (แจ้งว่ากำลังแก้) |
| **Maintenance Window** | Email + LINE         | ทุก User              | T-24 ชั่วโมง                  |

### Maintenance Window Policy

```
ทำได้เฉพาะ:
- วันอังคารหรือพฤหัสบดี (ลด Impact)
- เวลา 20:00–23:00 (นอกเวลางาน)
- ต้องแจ้ง 24 ชั่วโมงล่วงหน้า
- ระยะเวลา Maintenance: ไม่เกิน 2 ชั่วโมง

ยกเว้น P0 Emergency: ทำได้ทันที ไม่ต้องรอ Window
```

---

## 8. 📊 Release Metrics & Tracking

| Metric                          | Target                              | วิธีวัด                   |
| ------------------------------- | ----------------------------------- | ------------------------- |
| **Deployment Frequency**        | 1 ครั้ง/สองสัปดาห์                  | Gitea Release History     |
| **Lead Time for Change**        | < 3 วัน (code → production)         | Commit Date → Deploy Date |
| **Change Failure Rate**         | < 5% (% Release ที่ต้อง Rollback)   | Rollback Log              |
| **Mean Time to Restore (MTTR)** | < 4 ชั่วโมง (P0) / < 8 ชั่วโมง (P1) | Incident Log              |
| **Time to Rollback**            | < 5 นาที (Blue-Green Switch)        | Deploy Log                |

> **หมายเหตุ:** Metrics เหล่านี้คือ **DORA Metrics** (DevOps Research and Assessment)
> ติดตามใน Monthly Engineering Review

---

## 9. 🗂️ CI/CD Pipeline (Gitea Actions)

### Pipeline Stages (ทุก PR เข้า `develop` หรือ `release/*`)

```yaml
# .gitea/workflows/ci-deploy.yml (Actual Implementation)

jobs:
  # JOB 1: CI & Quality Gate
  build:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm lint
      - Security checks:
        - UUID misuse check (grep parseInt.*uuid)
        - Console.log check (grep console.log)
      - pnpm test (backend + frontend)

  # JOB 2: Deploy — Trigger Blue-Green on QNAP (main branch only)
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - SSH to QNAP
      - git pull origin main
      - ./scripts/deploy.sh
```

> **หมายเหตุ:** Pipeline จริงมี 2 jobs เท่านั้น ไม่มี stages แยก 5 ขั้นตอนตามที่เคยระบุในเอกสารเดิม

### Environment Variables ที่ CI/CD ใช้

```bash
# Gitea Secrets (ตั้งค่าใน Gitea Settings → Secrets)
SSH_KEY=<private key for QNAP>
HOST=192.168.10.8
PORT=22
USERNAME=admin
```

---

## 10. 🔐 Release Security Requirements

### Pre-Release Security Checklist

```
✅ npm audit: 0 Critical, 0 High vulnerabilities
✅ ไม่มี Secret/Credential hardcoded ใน Code (git secrets check)
✅ .env ไม่ถูก Commit (gitignore check)
✅ JWT_SECRET และ DB_PASSWORD ไม่ใช่ Default Values
✅ Docker Image ไม่มี Root User (USER node)
✅ Helmet.js Security Headers ยังทำงาน (Smoke Test)
✅ Rate Limiting ยังทำงาน (Login endpoint test)
✅ UUID misuse check: 0 parseInt on UUID (ADR-019)
✅ Console.log check: 0 console.log in committed code
```

### ข้อห้ามเด็ดขาด (Forbidden in Release)

```
❌ ห้าม Deploy โดยไม่มี Code Review (อย่างน้อย 1 คน)
❌ ห้าม Merge feature/* ตรงไปยัง main (ต้องผ่าน develop + release/*)
❌ ห้าม Deploy ช่วง 08:00–18:00 วันทำงาน (ยกเว้น Hotfix P0)
❌ ห้าม Skip Quality Gate (Unit Test, Security Scan) สำหรับ Sprint Release
❌ ห้าม Deploy โดยไม่มี Rollback Plan ที่ทดสอบแล้ว
❌ ห้าม Apply Schema Change บน Production โดยไม่มี Backup
```

---

## 11. 📁 Release Artifacts

### สิ่งที่ต้องสร้างทุก Release

| Artifact               | Location                                 | Owner         | Retention         |
| ---------------------- | ---------------------------------------- | ------------- | ----------------- |
| Release Notes          | `specs/99-archives/releases/v{X.Y.Z}.md` | PO            | ตลอดไป            |
| Docker Images          | Internal Registry (Gitea)                | DevOps        | ล่าสุด 5 Versions |
| DB Backup (Pre-deploy) | QNAP `/volume1/lcbp3/shared/backups/`    | DevOps        | 30 วัน            |
| Delta SQL File         | `specs/03-Data-and-Storage/deltas/`      | Dev           | ตลอดไป (Git)      |
| CHANGELOG.md Update    | Root of Repo                             | Dev           | ตลอดไป            |
| Deploy Log             | `/volume1/lcbp3/shared/logs/deploy.log`  | DevOps (Auto) | 90 วัน            |

---

## 12. 📋 Release Checklist

### Sprint Release Checklist

**T-3 วัน (Quality Gate)**

- [ ] All Unit Tests pass ≥ 80% coverage
- [ ] TypeScript 0 Errors
- [ ] ESLint 0 Errors
- [ ] `npm audit` 0 Critical/High
- [ ] UUID misuse check: 0 parseInt on UUID
- [ ] Console.log check: 0 console.log in committed code
- [ ] Docker Build Success
- [ ] CHANGELOG.md Updated
- [ ] Delta SQL file ready (ถ้ามี Schema Change)

**T-1 วัน (Staging + Approval)**

- [ ] Deploy to Staging สำเร็จ
- [ ] Smoke Test on Staging ผ่าน
- [ ] Schema Migration Test on Staging ผ่าน (ถ้ามี)
- [ ] PO Review Complete
- [ ] PO Sign-off: "**_ วันที่ _**"
- [ ] Org Admin Notification ส่งแล้ว (LINE)

**Release Day**

- [ ] DB Backup created + verified
- [ ] Schema Delta Applied (ถ้ามี) — แจ้ง Admin ทำ Manual
- [ ] `./deploy.sh` รัน (Blue-Green)
- [ ] Health Check ✅ All containers
- [ ] Smoke Test ✅ Login + Core Feature
- [ ] Grafana: Error Rate < 1%, P90 < 500ms (15 นาที)
- [ ] `git tag vX.Y.Z` + Push
- [ ] Release Notes Published
- [ ] Notify Org Admins: "Release vX.Y.Z เสร็จสมบูรณ์"

---

## 📝 Document Control

- **Version:** 1.1.0 | **Status:** DRAFT
- **Created:** 2026-03-11 | **Owner:** Nattanin Peancharoen (System Architect / Release Manager / Product Owner)
- **Last Updated:** 2026-05-16 | Updated CI/CD pipeline to match actual implementation
- **Next Review:** Pre Sprint 1 (T-2 สัปดาห์ก่อน Go-Live)
- **Classification:** Internal — Developer + DevOps + PO Only

## 📝 Change History

| Version | Date | Changes | Author |
|---------|------|---------|---------|
| 1.0.0 | 2026-03-11 | Initial release policy document | Nattanin P. |
| 1.1.0 | 2026-05-16 | Updated to v1.9.0: Fixed CI/CD pipeline description, clarified monitoring infrastructure (ASUSTOR vs QNAP), updated role references to reflect actual team structure, marked Sprint cadence as ideal state | Nattanin P. |
