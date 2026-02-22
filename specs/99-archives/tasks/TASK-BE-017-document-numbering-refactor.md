# TASK-BE-017: Document Numbering Backend Refactor

---
status: TODO
priority: HIGH
estimated_effort: 3-5 days
dependencies:
  - specs/01-requirements/01-03.11-document-numbering.md (v1.6.2)
  - specs/03-implementation/03-04-document-numbering.md (v1.6.2)
related_task: TASK-FE-017-document-numbering-refactor.md
---

## Objective

Refactor Document Numbering module ตาม specification v1.6.2 และ Implementation Guide โดยเน้น:
- Single Numbering System (Option A)
- Number State Machine (RESERVED → CONFIRMED → VOID → CANCELLED)
- Two-Phase Commit implementation
- Redis Distributed Lock
- Idempotency-Key support
- Complete Audit & Metrics

---

## Implementation Checklist

### 1. Entity Updates

#### 1.1 DocumentNumberCounter Entity
- [ ] Rename `current_year` → ใช้ `reset_scope` pattern (`YEAR_2025`, `NONE`)
- [ ] Ensure FK columns match: `correspondence_type_id`, `originator_organization_id`, `recipient_organization_id`
- [ ] Add `rfa_type_id`, `sub_type_id`, `discipline_id` columns
- [ ] Update Primary Key & Indices
- [ ] Add `version` column for optimistic locking

#### 1.2 New Entities (Create)
- [ ] **DocumentNumberFormat**: Store templates per project/type (`document_number_formats` table)
- [ ] **DocumentNumberReservation**: Store active reservations (`document_number_reservations` table)
- [ ] **DocumentNumberAudit**: Store complete audit trail (`document_number_audit` table)
- [ ] **DocumentNumberError**: Store error logs (`document_number_errors` table)

---

### 2. Service Updates

#### 2.1 Core Services
- [ ] **DocumentNumberingService**: Main orchestration (Reserve, Confirm, Cancel, Preview)
- [ ] **CounterService**: Handle `incrementCounter` with DB optimistic lock & retry logic
- [ ] **DocumentNumberingLockService**: Implement Redis Redlock (`acquireLock`, `releaseLock`)
- [ ] **ReservationService**: Handle Two-Phase Commit logic (TTL, cleanup)

#### 2.2 Helper Services
- [ ] **FormatService**: Format number string based on template & tokens
- [ ] **TemplateService**: CRUD operations for `DocumentNumberFormat` and validation
- [ ] **AuditService**: Async logging to `DocumentNumberAudit`
- [ ] **MetricsService**: Prometheus counters/gauges (utilization, lock wait time)

#### 2.3 Feature Services
- [ ] **ManualOverrideService**: Handle manual number assignment & sequence adjustment
- [ ] **MigrationService**: Handle bulk import / legacy data migration

---

### 3. Controller Updates

#### 3.1 DocumentNumberingController
- [ ] `POST /reserve`: Reserve number (Phase 1)
- [ ] `POST /confirm`: Confirm number (Phase 2)
- [ ] `POST /cancel`: Cancel reservation
- [ ] `POST /preview`: Preview next number
- [ ] `GET /sequences`: Get current sequence status
- [ ] Add `Idempotency-Key` header validation

#### 3.2 DocumentNumberingAdminController
- [ ] `POST /manual-override`
- [ ] `POST /void-and-replace`
- [ ] `POST /bulk-import`
- [ ] `POST /templates`: Manage templates

#### 3.3 NumberingMetricsController
- [ ] `GET /metrics`: Expose utilization & health metrics for dashboard

---

### 4. Logic & Algorithms

#### 4.1 Counter Key Builder
- Implement logic to build unique key tuple:
  - Global: `(proj, orig, recip, type, 0, 0, 0, YEAR_XXXX)`
  - Transmittal: `(proj, orig, recip, type, subType, 0, 0, YEAR_XXXX)`
  - RFA: `(proj, orig, 0, type, 0, rfaType, discipline, NONE)`
  - Drawing: `(proj, TYPE, main, sub)` (separate namespace)

#### 4.2 State Machine
- [ ] Validate transitions: RESERVED -> CONFIRMED
- [ ] Auto-expire RESERVED -> CANCELLED (via Cron/TTL)
- [ ] CONFIRMED -> VOID

#### 4.3 Lock Strategy
- [ ] Try Redis Lock -> if valid -> Increment -> Release
- [ ] Fallback to DB Lock if Redis unavailable (optional/advanced)

---

### 5. Testing

#### 5.1 Unit Tests
- [ ] `CounterService` optimistic locking
- [ ] `TemplateValidator` grammar check
- [ ] `ReservationService` expiry logic

#### 5.2 Integration Tests
- [ ] Full Two-Phase Commit flow
- [ ] Concurrent requests (check for duplicates)
- [ ] Idempotency-Key behavior

---

## Files to Create/Modify

| Action | Path                                                                                        |
| :----- | :------------------------------------------------------------------------------------------ |
| MODIFY | `backend/src/modules/document-numbering/document-numbering.module.ts`                       |
| MODIFY | `backend/src/modules/document-numbering/entities/document-number-counter.entity.ts`         |
| CREATE | `backend/src/modules/document-numbering/entities/document-number-format.entity.ts`          |
| CREATE | `backend/src/modules/document-numbering/entities/document-number-reservation.entity.ts`     |
| MODIFY | `backend/src/modules/document-numbering/entities/document-number-audit.entity.ts`           |
| CREATE | `backend/src/modules/document-numbering/entities/document-number-error.entity.ts`           |
| MODIFY | `backend/src/modules/document-numbering/controllers/document-numbering.controller.ts`       |
| MODIFY | `backend/src/modules/document-numbering/controllers/document-numbering-admin.controller.ts` |
| CREATE | `backend/src/modules/document-numbering/controllers/numbering-metrics.controller.ts`        |
| MODIFY | `backend/src/modules/document-numbering/services/document-numbering.service.ts`             |
| CREATE | `backend/src/modules/document-numbering/services/counter.service.ts`                        |
| CREATE | `backend/src/modules/document-numbering/services/document-numbering-lock.service.ts`        |
| CREATE | `backend/src/modules/document-numbering/services/reservation.service.ts`                    |
| CREATE | `backend/src/modules/document-numbering/services/manual-override.service.ts`                |
| CREATE | `backend/src/modules/document-numbering/services/format.service.ts`                         |
| CREATE | `backend/src/modules/document-numbering/services/template.service.ts`                       |
| CREATE | `backend/src/modules/document-numbering/services/audit.service.ts`                          |
| CREATE | `backend/src/modules/document-numbering/services/metrics.service.ts`                        |
| CREATE | `backend/src/modules/document-numbering/validators/template.validator.ts`                   |
| CREATE | `backend/src/modules/document-numbering/guards/idempotency.guard.ts`                        |

---

## Acceptance Criteria

- [ ] Schema matches `specs/03-implementation/03-04-document-numbering.md`
- [ ] All 3 levels of locking (Redis, DB Optimistic, Unique Constraints) implemented
- [ ] Zero duplicates in load test
- [ ] Full audit trail visible

---

## References

- [Requirements v1.6.2](../01-requirements/01-03.11-document-numbering.md)
- [Implementation Guide v1.6.2](../03-implementation/03-04-document-numbering.md)
- [ADR-002](../05-decisions/ADR-002-document-numbering-strategy.md)
