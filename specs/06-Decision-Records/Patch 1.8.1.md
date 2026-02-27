สรุป Patch 1.8.1
---

# 📘 1) Formal Spec — Version 1.8.1

**Document ID:** DMS-SPEC-1.8.1
**Status:** Approved for Implementation
**Supersedes:** 1.8.0
**Effective Date:** 2026-02-26

---

## 1. Purpose

Spec 1.8.1 แก้ความไม่สอดคล้องระหว่าง:

* 03-04-legacy-data-migration.md
* 03-05-n8n-migration-setup-guide.md
* ADR-017-ollama-data-migration.md

และกำหนด Production Boundary ที่ชัดเจน

---

## 2. Authoritative Architecture (Binding)

### Infrastructure Layout

| Component     | Host    | Responsibility       |
| ------------- | ------- | -------------------- |
| DMS App       | QNAP    | Production system    |
| MariaDB       | QNAP    | Authoritative DB     |
| File Storage  | QNAP    | Primary file store   |
| Reverse Proxy | QNAP    | Public ingress       |
| Ollama        | ASUSTOR | AI processing only   |
| n8n           | ASUSTOR | Automation engine    |
| Portainer     | ASUSTOR | Container management |

**Constraint:**

* Ollama MUST NOT run on QNAP
* AI containers MUST NOT access production DB directly

---

## 3. Source of Truth Definition

During Migration:

| Data Type    | Authority                               |
| ------------ | --------------------------------------- |
| File content | Legacy file server                      |
| RFA metadata | Gmail notification                      |
| Assignment   | Circulation sheet                       |
| DMS DB       | NOT authoritative until validation pass |

---

## 4. Metadata Mapping Contract (Mandatory)

| Legacy        | DMS           | Required | Rule              |
| ------------- | ------------- | -------- | ----------------- |
| RFA No        | rfa_number    | YES      | UNIQUE            |
| Title         | title         | YES      | NOT NULL          |
| Issue Date    | issue_date    | YES      | Valid date        |
| Revision      | revision_code | YES      | Pattern validated |
| Assigned User | user_id       | YES      | FK must exist     |
| File Path     | file_path     | YES      | File must exist   |

Migration MUST fail if required fields invalid.

---

## 5. Idempotent Execution Requirement

Automation must:

* Check existence by rfa_number
* Validate file hash
* UPDATE instead of INSERT if exists
* Prevent duplicate revision chain

---

## 6. Folder Standard

```
/data/dms/
 ├── uploads/YYYY/MM/
 ├── staging_ai/
 ├── migration_logs/
 └── archive_legacy/
```

---

## 7. File Naming Standard

```
{RFA_NO}_{REV}_{YYYYMMDD}.pdf
```

Example:

```
RFA-2026-001_A_20260225.pdf
```

---

## 8. Logging Standard

| System           | Required       |
| ---------------- | -------------- |
| Migration script | structured log |
| n8n              | execution log  |
| Ollama           | inference log  |
| DMS              | audit_log      |

Retention: 90 days minimum.

---

## 9. Dry Run Policy

All migrations MUST run with:

```
--dry-run
```

No DB commit until validation approved.

---

## 10. Rollback Strategy

1. Disable n8n
2. Restore DB snapshot
3. Restore file snapshot
4. Clear staging_ai
5. Re-run validation

---

---

# 📄 2) ADR-018 — AI Boundary Hardening

**Title:** AI Isolation & Production Boundary Enforcement
**Status:** Accepted
**Date:** 2026-02-26
**Supersedes:** Clarifies ADR-017

---

## Context

AI-based migration using Ollama introduces:

* DB corruption risk
* Hallucinated metadata
* Unauthorized modification
* Privilege escalation risk

Production DMS must remain authoritative.

---

## Decision

### 1. AI Isolation Model

Ollama must:

* Run on ASUSTOR only
* Have NO DB credentials
* Have NO write access to uploads
* Access only `/staging_ai`
* Output JSON only

---

### 2. Data Flow Model

```
Legacy File → staging_ai → Ollama → JSON
             ↓
        Validation Script
             ↓
         DMS API (write)
```

AI never writes directly.

---

### 3. API Gatekeeping

All writes must go through:

* Authenticated DMS API
* RBAC enforced
* Audit log recorded

---

### 4. Hallucination Mitigation

AI output must:

* Match schema
* Pass validation script
* Fail on missing required fields
* Reject unknown users

---

### 5. Security Controls

| Risk               | Control            |
| ------------------ | ------------------ |
| DB corruption      | No DB access       |
| File overwrite     | Read-only mount    |
| Public AI exposure | No exposed port    |
| Data leak          | Internal VLAN only |

---

## Consequences

Pros:

* Production safe
* Predictable migration
* Audit trail preserved

Cons:

* Slightly slower pipeline
* Requires validation layer

---

---

# 🧠 3) Full Migration Runbook

**Production Execution Guide**

---

# PHASE 0 — Pre-Run Validation

☐ Full DB backup
☐ File storage snapshot
☐ Restore test verified
☐ 10-sample manual compare
☐ Dry-run executed
☐ Dry-run report approved

---

# PHASE 1 — Environment Preparation

1. Stop public automation
2. Disable n8n production workflows
3. Clear `/staging_ai`
4. Confirm Ollama healthy
5. Confirm DMS API reachable

---

# PHASE 2 — Controlled Batch Migration

Batch size recommendation:

* 20–50 RFAs per batch

Process:

1. Copy files to `/staging_ai`
2. Run AI extraction
3. Validate JSON
4. Push via DMS API
5. Log result
6. Manual sample verify (10%)

---

# PHASE 3 — Post-Batch Validation

After each batch:

☐ Record count match
☐ File open test
☐ Revision chain correct
☐ Assignment correct
☐ No duplicate rfa_number

If fail → STOP and rollback.

---

# PHASE 4 — Cutover

When all batches pass:

1. Enable n8n automation
2. Monitor logs 24h
3. Lock legacy system (read-only)
4. Final backup snapshot

---

# PHASE 5 — Post-Go-Live Monitoring (72 hours)

Monitor:

* DB errors
* Duplicate insert
* Missing files
* AI extraction errors
* API error rate

If anomaly >5% → trigger rollback plan.

---

# 🚨 Emergency Rollback Procedure

1. Disable n8n
2. Restore DB snapshot
3. Restore file snapshot
4. Clear staging_ai
5. Reconcile delta manually

Target RTO: < 2 hours

---

# 📊 Risk Matrix (Condensed)

| Risk             | Probability | Impact   | Mitigation        |
| ---------------- | ----------- | -------- | ----------------- |
| Duplicate RFA    | Medium      | High     | Idempotent check  |
| Wrong assignment | Medium      | Medium   | Validation rule   |
| AI hallucination | Medium      | High     | Schema validation |
| Storage mismatch | Low         | High     | File hash verify  |
| DB corruption    | Low         | Critical | No AI DB access   |

---

# 🏁 Production Readiness Criteria

System may go live only if:

* All dry-run tests pass
* 100% required fields valid
* 0 duplicate RFA
* Sample QA pass >95%
* Backup verified

---

---

# 🎯 Final Result

ตอนนี้เอกสารทั้งชุด:

✔ Architecture consistent
✔ AI boundary hardened
✔ Migration deterministic
✔ Rollback defined
✔ Production-safe

---
