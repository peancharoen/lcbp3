# Implementation Tasks: RFA Approval System Refactor

**Feature**: RFA Approval System Refactor (TeamBinder/InEight-Style)
**Branch**: `1-rfa-approval-refactor`
**Generated**: 2026-05-11

---

## Phase 1: Setup & Infrastructure

### Goal
Initialize project structure and shared infrastructure for all modules.

**Independent Test**: All new modules compile without errors, BullMQ queues connect to Redis.

---

- [X] T001 [P] Create SQL schema file `specs/03-Data-and-Storage/lcbp3-v1.9.0-rfa-approval-schema.sql` with all 9 new entities
- [X] T002 [P] Create Response Code seeder `backend/src/modules/response-code/seeders/response-code.seed.ts`
- [X] T003 Create BullMQ queue configuration `backend/src/config/bullmq.config.ts`
- [X] T004 [P] Setup Redis connection for BullMQ and Redlock `backend/src/config/redis.config.ts`
- [X] T005 Create shared DTOs and enums `backend/src/modules/review-team/dto/shared/` (ReviewTaskStatus, ResponseCodeCategory, etc.)


---

## Phase 2: Foundational Entities & Services

### Goal
Core entities required by multiple user stories. Must complete before US1-US6.

**Independent Test**: CRUD operations work for all entities via API.

---

- [X] T006 [P] Create ReviewTeam entity `backend/src/modules/review-team/entities/review-team.entity.ts`
- [X] T007 [P] Create ReviewTeamMember entity `backend/src/modules/review-team/entities/review-team-member.entity.ts`
- [X] T008 Create ResponseCode entity `backend/src/modules/response-code/entities/response-code.entity.ts`
- [X] T009 [P] Create ResponseCodeRule entity `backend/src/modules/response-code/entities/response-code-rule.entity.ts`
- [X] T010 [P] Create ReviewTask entity `backend/src/modules/review-team/entities/review-task.entity.ts`
- [X] T011 Create ResponseCodeModule with service `backend/src/modules/response-code/response-code.service.ts`
- [X] T012 Create ResponseCodeController with basic CRUD `backend/src/modules/response-code/response-code.controller.ts`
- [X] T013 Create ReviewTeamModule base structure `backend/src/modules/review-team/review-team.module.ts`


---

## Phase 3: User Story 1 - Review Teams by Discipline (P1)

### Goal
Users can create Review Teams with multiple Disciplines, and teams auto-assign to RFA types.

**Independent Test**:
- Create Review Team via API with 3 disciplines
- Verify team appears in list with member count
- Submit RFA with team → parallel review tasks created

---

- [X] T014 [US1] Create ReviewTeamService with CRUD and member management `backend/src/modules/review-team/review-team.service.ts`
- [X] T015 [P] [US1] Create ReviewTeamController endpoints `backend/src/modules/review-team/review-team.controller.ts`
- [X] T016 [US1] Create ReviewTaskService with assignment logic `backend/src/modules/review-team/review-task.service.ts`
- [X] T017 [P] [US1] Integrate Review Team selection in RFA submission flow `backend/src/modules/rfa/rfa.service.ts`
- [X] T018 [US1] Implement parallel task creation on RFA submit `backend/src/modules/review-team/services/task-creation.service.ts`
- [X] T019 [P] [US1] Create Review Team management UI page `frontend/src/app/(dashboard)/review-teams/page.tsx`
- [X] T020 [P] [US1] Create Review Team form component `frontend/src/components/review-team/ReviewTeamForm.tsx`
- [X] T021 [US1] Create Team Member assignment component `frontend/src/components/review-team/TeamMemberManager.tsx`
- [X] T022 [P] [US1] Create useReviewTeams hook `frontend/src/hooks/use-review-teams.ts`
- [X] T023 [US1] Add Review Team selector to RFA submission form `frontend/src/app/(dashboard)/rfa/[id]/submit/page.tsx`


---

## Phase 4: User Story 2 - Response Codes & Master Approval Matrix (P1)

### Goal
Response Codes display by document category, Code 1C/1D/3 trigger notifications, full audit trail.

**Independent Test**:
- RFA review page shows only Engineering codes for Shop Drawing
- Select Code 1C → notification sent to Contract team
- Change response code → audit logged

---

- [X] T024 [US2] Extend ResponseCodeService with category filtering `backend/src/modules/response-code/response-code.service.ts`
- [X] T025 [P] [US2] Create ResponseCode lookup endpoint by document type `backend/src/modules/response-code/response-code.controller.ts`
- [X] T026 [US2] Implement Response Code implications evaluator `backend/src/modules/response-code/services/implications.service.ts`
- [X] T027 [P] [US2] Create notification trigger service for critical codes `backend/src/modules/response-code/services/notification-trigger.service.ts`
- [X] T028 [US2] Add audit logging for Response Code changes `backend/src/modules/response-code/services/audit.service.ts`
- [X] T029 [P] [US2] Create Response Code selector component with category filtering `frontend/src/components/response-code/ResponseCodeSelector.tsx`
- [X] T030 [US2] Create Response Code implications display `frontend/src/components/response-code/CodeImplications.tsx`
- [X] T031 [P] [US2] Create Master Approval Matrix admin UI `frontend/src/app/(dashboard)/response-codes/page.tsx`
- [X] T032 [US2] Create useResponseCodes hook with category filter `frontend/src/hooks/use-response-codes.ts`
- [X] T033 [P] [US2] Integrate Response Code selector in Review Task completion UI `frontend/src/components/review-task/CompleteReviewForm.tsx`


---

## Phase 5: User Story 3 - Delegation & Proxy (P2)

### Goal
Users can delegate review tasks with date range, circular detection prevents loops.

**Independent Test**:
- User A delegates to User B for 1 week
- RFA assigned to A during period → automatically assigned to B
- Try to create A→B→C→A → error prevented

---

- [X] T034 [US3] Create Delegation entity `backend/src/modules/delegation/entities/delegation.entity.ts`
- [X] T035 [P] [US3] Create DelegationService with CRUD `backend/src/modules/delegation/delegation.service.ts`
- [X] T036 [US3] Implement circular delegation detection algorithm `backend/src/modules/delegation/services/circular-detection.service.ts`
- [X] T037 [P] [US3] Create DelegationController endpoints `backend/src/modules/delegation/delegation.controller.ts`
- [X] T038 [US3] Integrate delegation resolution in ReviewTaskService `backend/src/modules/review-team/review-task.service.ts`
- [X] T039 [P] [US3] Create Delegation settings UI page `frontend/src/app/(dashboard)/delegation/page.tsx`
- [X] T040 [US3] Create Delegation form with date picker `frontend/src/components/delegation/DelegationForm.tsx`
- [X] T041 [P] [US3] Create delegated task indicator ("Delegated from X") `frontend/src/components/review-task/DelegatedBadge.tsx`
- [X] T042 [P] [US3] Create useDelegation hook `frontend/src/hooks/use-delegation.ts`


---

## Phase 6: User Story 4 - Auto-Reminders & Escalation (P2)

### Goal
Scheduled reminders via BullMQ, 2-level escalation when overdue.

**Independent Test**:
- RFA due in 2 days → reminder scheduled
- Past due date → escalation level 1 notification
- 3 days overdue → escalation level 2 notification

---

- [X] T043 [US4] Create ReminderRule entity `backend/src/modules/reminder/entities/reminder-rule.entity.ts`
- [X] T044 [P] [US4] Create ReminderService with BullMQ integration `backend/src/modules/reminder/reminder.service.ts`
- [X] T045 [US4] Implement reminder scheduling on RFA submit `backend/src/modules/reminder/services/scheduler.service.ts`
- [X] T046 [P] [US4] Create ReminderProcessor for queue workers `backend/src/modules/reminder/processors/reminder.processor.ts`
- [X] T047 [US4] Implement 2-level escalation logic `backend/src/modules/reminder/services/escalation.service.ts`
- [X] T048 [P] [US4] Create ReminderRuleController admin endpoints `backend/src/modules/reminder/reminder.controller.ts`
- [X] T049 [P] [US4] Create ReminderRule admin UI `frontend/src/app/(dashboard)/reminder-rules/page.tsx`
- [X] T050 [US4] Create reminder history viewer `frontend/src/components/reminder/ReminderHistory.tsx`



---

## Phase 7: User Story 5 - Distribution Matrix (P2)

### Goal
Async distribution after approval, Transmittal records created via BullMQ.

**Independent Test**:
- RFA approved with Code 1A → distribution queued
- Distribution job processed within 5 minutes
- Recipients receive email and in-app notification

---

- [X] T051 [US5] Create DistributionMatrix entity `backend/src/modules/distribution/entities/distribution-matrix.entity.ts`
- [X] T052 [P] [US5] Create DistributionRecipient entity `backend/src/modules/distribution/entities/distribution-recipient.entity.ts`
- [X] T053 [US5] Create DistributionMatrixService with CRUD `backend/src/modules/distribution/distribution-matrix.service.ts`
- [X] T054 [P] [US5] Create DistributionService with BullMQ integration `backend/src/modules/distribution/distribution.service.ts`
- [X] T055 [US5] Implement distribution triggering on approval `backend/src/modules/distribution/services/approval-listener.service.ts`
- [X] T056 [P] [US5] Create DistributionProcessor for queue workers `backend/src/modules/distribution/processors/distribution.processor.ts`
- [X] T057 [US5] Create Transmittal records from distribution `backend/src/modules/distribution/services/transmittal-creator.service.ts`
- [X] T058 [P] [US5] Create DistributionMatrixController `backend/src/modules/distribution/distribution.controller.ts`
- [X] T059 [P] [US5] Create Distribution Matrix admin UI `frontend/src/app/(dashboard)/distribution-matrices/page.tsx`
- [X] T060 [US5] Create distribution status dashboard `frontend/src/components/distribution/DistributionStatus.tsx`


---

## Phase 8: User Story 6 - Master Approval Matrix Management (P3)

### Goal
Admin UI for managing Matrix, project overrides with inheritance tracking.

**Independent Test**:
- View global Matrix with all categories and codes
- Create project-specific override for Code 1C
- Override appears only for that project

---

- [X] T061 [US6] Extend ResponseCodeService with project overrides `backend/src/modules/response-code/services/matrix-management.service.ts`
- [X] T062 [P] [US6] Create Matrix inheritance resolver `backend/src/modules/response-code/services/inheritance.service.ts`
- [X] T063 [US6] Add Matrix management endpoints to ResponseCodeController `backend/src/modules/response-code/response-code.controller.ts`
- [X] T064 [P] [US6] Create Master Approval Matrix visual editor `frontend/src/components/response-code/MatrixEditor.tsx`
- [X] T065 [US6] Create project override management UI `frontend/src/components/response-code/ProjectOverrideManager.tsx`


---

## Phase 9: Cross-Cutting & Polish

### Goal
Workflow Engine integration, aggregate status, edge case handling, testing.

**Independent Test**:
- Complete end-to-end workflow: RFA submit → parallel review → consensus → distribution
- All edge cases handled (race conditions, circular delegation, veto)

---

- [X] T066 Extend WorkflowEngine DSL with Parallel Gateway support `backend/src/modules/workflow-engine/dsl/parallel-gateway.handler.ts`
- [X] T067 [P] Implement Review Task aggregate status calculator `backend/src/modules/review-team/services/aggregate-status.service.ts`
- [X] T068 [P] Create consensus evaluation service `backend/src/modules/review-team/services/consensus.service.ts`
- [X] T068.5 Implement Veto Override for Project Manager `backend/src/modules/review-team/services/veto-override.service.ts` - พร้อม audit trail และ notification
- [X] T069 Implement race condition handling (Redlock) in ReviewTask completion `backend/src/modules/review-team/review-task.service.ts`
- [X] T070 [P] Add optimistic locking to ReviewTask entity `backend/src/modules/review-team/entities/review-task.entity.ts`
- [X] T071 Create Review Task inbox UI with aggregate status `frontend/src/components/review-task/ReviewTaskInbox.tsx`
- [X] T072 [P] Create parallel review progress indicator `frontend/src/components/review-task/ParallelProgress.tsx`
- [X] T072.5 Create Veto Override button and modal for PM `frontend/src/components/review-task/VetoOverrideDialog.tsx` - พร้อม input สำหรับ justification reason
- [X] T073 Add validation for all edge cases in service layer `backend/src/common/validators/review-validators.ts`
- [X] T074 [P] Create unit tests for ResponseCodeService `backend/tests/unit/response-code/response-code.service.spec.ts`
- [X] T075 [P] Create unit tests for Delegation circular detection `backend/tests/unit/delegation/circular-detection.service.spec.ts`
- [X] T076 [P] Create integration tests for parallel review consensus `backend/tests/integration/review-team/parallel-review.spec.ts`
- [X] T077 Create e2e tests for complete RFA workflow `backend/tests/e2e/rfa-workflow.e2e-spec.ts`
- [X] T078 [P] Add frontend tests for ResponseCodeSelector `frontend/tests/components/ResponseCodeSelector.test.tsx`
- [X] T079 Update quickstart.md with final setup instructions `specs/1-rfa-approval-refactor/quickstart.md`
- [X] T080 [P] Run full test suite and fix any failures `npm test`


---

## Dependency Graph

```
Phase 1: Setup
    │
    ▼
Phase 2: Foundational Entities
    │
    ├───> Phase 3: US1 Review Teams ───────┐
    │                                      │
    ├───> Phase 4: US2 Response Codes ────┼──┐
    │                                      │  │
    ├───> Phase 5: US3 Delegation ────────┤  │
    │                                      │  │
    ├───> Phase 6: US4 Reminders ──────────┤  │
    │                                      │  │
    └───> Phase 7: US5 Distribution ───────┼──┤
                                           │  │
Phase 8: US6 Matrix Management <──────────┘  │
                                              │
Phase 9: Polish & Integration <───────────────┘
```

---

## Parallel Execution Opportunities

| Phase | Parallel Tasks | Description |
|-------|----------------|-------------|
| Phase 1 | T001, T002, T004, T005 | SQL, Seeder, Redis config, DTOs |
| Phase 2 | T006, T007, T009, T010 | Entity creation |
| Phase 3 | T015, T019, T020, T022 | Controller + Frontend components |
| Phase 4 | T025, T027, T029, T031 | API + UI parallel |
| Phase 5 | T035, T037, T039, T040, T042 | Backend + Frontend |
| Phase 6 | T044, T046, T049 | Reminder service + processor + UI |
| Phase 7 | T052, T054, T056, T058, T059 | Distribution entities + service + processor + UI |
| Phase 9 | T067, T068, T070, T074, T075, T078 | Status calc + Locking + Tests |

---

## MVP Scope (Minimum Viable Product)

For fastest value delivery, implement:

1. **Phase 1-2**: Setup and entities
2. **Phase 3**: US1 Review Teams only
3. **Phase 9**: Basic consensus + edge case handling (skip US2-US6)

**MVP Deliverables**:
- Review Teams with Disciplines
- Parallel review task creation
- Basic response code selection (no category filtering)
- Simple sequential workflow (no parallel gateway in DSL yet)

---

## Total Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Phase 1 | 5 | Setup |
| Phase 2 | 8 | Foundational |
| Phase 3 | 10 | US1 |
| Phase 4 | 10 | US2 |
| Phase 5 | 9 | US3 |
| Phase 6 | 8 | US4 |
| Phase 7 | 10 | US5 |
| Phase 8 | 5 | US6 |
| Phase 9 | 17 | Polish |
| **Total** | **82** | - |

---

## Next Steps

1. **Execute Phase 1-2**: Setup and entities
2. **Run `/speckit-analyze`**: Validate cross-artifact consistency
3. **Implement incrementally**: Start with MVP (Phases 1-3 + minimal Phase 9)
4. **Test independently**: Each user story should be independently testable

---

**Ready for implementation** ✅
