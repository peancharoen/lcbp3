# Tasks: Telegram Notifications

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/telegram-api.md](./contracts/telegram-api.md), [contracts/telegram-message-templates.md](./contracts/telegram-message-templates.md), [research.md](./research.md), [quickstart.md](./quickstart.md), ADR-057, [ledger.md](./ledger.md)
**Tests**: INCLUDED — TDD (RED before GREEN) required per `_LCBP3-CONTRACTS.md` for behavior changes; write/extend the listed spec file first and confirm it fails before implementing.
**Format**: `- [ ] TID [P?] [Story] Description with file path` — `[P]` = parallelizable (different files, no incomplete dependency)
**Paths**: `B=backend/src`, `F=frontend`

**Schema status**: The SQL delta (users +3 cols, user_preferences +notify_telegram, notifications ENUM +TELEGRAM, notification_channels, notification_deliveries — including telegram_topic_id/Forum Topics) is **already applied** to the live DB at `192.168.10.11` (ledger CP1/CP2). No schema task appears below — implementation starts from TypeORM entities.

**Known correction (ledger CP3)**: FR-021 originally planned a Workflow DSL `send_telegram` effect. No DSL effect executor exists anywhere in the codebase — `EffectSchema`/`WorkflowEffect` is unused validation-only schema. Tasks below implement significant-status triggering as **hardcoded call sites** instead (same pattern as existing `EMAIL`/`SYSTEM` sends), per explicit user decision.

## Phase 1: Setup

- [X] T001 Read `B/modules/notification/notification.processor.ts` (existing `handleDispatch`/digest pattern, axios usage for LINE via n8n), `B/modules/notification/notification.service.ts` (`NotificationJobData`), `B/modules/rfa/rfa.service.ts` `notifyRecipients()` (~line 1025) and the `isTerminal && approveCodeStr` sync block (~line 1005) where a NEW `rfa.decision_returned` hook must be added, `B/modules/correspondence/correspondence-workflow.service.ts` after-commit "Notify TO recipient org" block (~line 97-130) where a NEW significant-status hook must be added, `B/modules/reminder/services/escalation.service.ts` + `B/modules/reminder/processors/reminder.processor.ts` SYSTEM send call sites, and `B/modules/rfa/entities/rfa-workflow.entity.ts` (`assignedTo`, `status`) for the DM fan-out query shape. Record exact method names/line ranges and the correspondence-side "active assignee" equivalent (grep `assignedTo` in `B/modules/correspondence/correspondence.service.ts` ~line 1279) in `research.md` (new "Implementation Notes" section) — this closes the open items left by the plan/data-model correction.
- [X] T002 [P] Add BullMQ job name constants `JOB_SEND_TELEGRAM_DM` and `JOB_SEND_TELEGRAM_GROUP` to `B/modules/common/constants/queue.constants.ts` (reuses existing `QUEUE_NOTIFICATIONS` — no new queue per research.md R2)
- [X] T003 [P] Create `B/modules/notification/telegram/telegram.constants.ts` — Redis key builders (`telegramLinkKey(token)`, `telegramGroupLinkKey(code)`, `telegramWebhookDedupKey(updateId)`, `telegramRateLimitKey(chatId)`) and TTL constants (`TELEGRAM_LINK_TTL_SECONDS=900`, `TELEGRAM_GROUP_LINK_TTL_SECONDS=900`, `TELEGRAM_WEBHOOK_DEDUP_TTL_SECONDS=300`)
- [ ] T003a (ops-gated — **BLOCKED: รอ BotFather token จาก ops**; Insert the `TELEGRAM_*` seed rows (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ENABLED`, `TELEGRAM_BOT_USERNAME`) into the live `system_settings` table at 192.168.10.11 using an idempotent `INSERT ... ON DUPLICATE KEY UPDATE` script — real TOKEN/SECRET values come from the operator after BotFather registration, never committed to the repo; blocks T064 real-app verification)

## Phase 2: Foundational (blocks all user stories)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Add `telegramChatId`, `telegramUsername`, `telegramLinkedAt` columns to `User` entity in `B/modules/user/entities/user.entity.ts` (match live schema column names `telegram_chat_id`/`telegram_username`/`telegram_linked_at`; no `@Exclude()` needed but expose only `linked`/`telegramUsername`/`telegramLinkedAt` at the DTO/controller layer per data-model.md)
- [X] T005 [P] Add `notifyTelegram` boolean column (default `false`) to `UserPreference` entity in `B/modules/user/entities/user-preference.entity.ts`
- [X] T006 [P] Add `notifyTelegram?: boolean` (`@IsOptional @IsBoolean`) to `UpdatePreferenceDto` in `B/modules/user/dto/update-preference.dto.ts`
- [X] T007 [P] Add `TELEGRAM` to `NotificationType` enum in `B/modules/notification/entities/notification.entity.ts`
- [X] T008 [P] Create `NotificationChannel` entity in `B/modules/notification/entities/notification-channel.entity.ts` — fields per data-model.md `notification_channels` table incl. `telegramTopicId` (nullable int), extends `UuidBaseEntity` (ADR-019), `id`/`created_by`/`project_id` internal-only with `@Exclude()`
- [X] T009 [P] Create `NotificationDelivery` entity in `B/modules/notification/entities/notification-delivery.entity.ts` — fields per data-model.md `notification_deliveries` table; `uuid` column has **no** `@Unique` decorator (DB index is non-unique per MariaDB partition constraint — see data-model.md); composite `@PrimaryColumn` on `id`+`createdAt` matching `notifications` entity's existing pattern
- [X] T010 Extend `NotificationJobData.type` union to include `'TELEGRAM'` in `B/modules/notification/notification.service.ts`
- [X] T011 [P] Add `'notification'` to the `Subjects` union type in `B/common/auth/casl/ability.factory.ts` (matches existing `permissions.permission_name` values `notification.view`/`notification.manage_all` already seeded — id 151/152)
- [X] T012 Create `TelegramBotService` in `B/modules/notification/telegram/telegram-bot.service.ts` — `sendMessage(chatId, text, messageThreadId?)`, `setWebhook(url, secretToken)`, `getMe()` via direct `axios` calls to `https://api.telegram.org/bot<token>/...` (research.md R1); token read from `SystemSettingsService`/`ConfigService`, never logged; `sendMessage` must HTML-escape dynamic fields (FR-014) and include per-chat pacing via `telegramRateLimitKey` Redis check (research.md R3, SC-006); throw `BusinessException` with Thai `userMessage` per ADR-007 on failures
- [X] T012a Add BullMQ `limiter` (~25 jobs/s global, per research.md R3 / SC-006) to the `@Processor('notifications')` worker options in `B/modules/notification/notification.processor.ts` — covers all channels; per-chat pacing lives in `TelegramBotService.sendMessage` (T012)
- [X] T013 Create `TelegramSecretGuard` in `B/modules/notification/telegram/telegram-secret.guard.ts` — verifies `X-Telegram-Bot-Api-Secret-Token` header against `system_settings.TELEGRAM_WEBHOOK_SECRET` (research.md R4)
- [X] T014 [P] Create `TelegramUpdateDto` and `LinkCodeRequestDto` in `B/modules/notification/telegram/dto/telegram-update.dto.ts` and `link-code-request.dto.ts`
- [X] T015 Register `TelegramBotService`, `TelegramSecretGuard`, and the two new entities in `B/modules/notification/notification.module.ts`
- [X] T015a Update assurance ledger checkpoint after Foundational phase in `specs/200-fullstacks/258-telegram-notifications/ledger.md`

**Checkpoint**: Foundation ready — entities compile, `pnpm --filter backend build` passes, no user-facing behavior yet.

---

## Phase 3: User Story 1 — User links Telegram and receives personal notifications (Priority: P1) 🎯 MVP

**Goal**: Deep-link binding flow works end to end; RFA pending-approval / decision-returned / SLA-reminder events reach the bound user as Telegram DMs.
**Independent Test**: quickstart.md "Manual flow — DM binding" steps 1-6.

### Tests (RED first)

- [X] T016 [P] [US1] RED `B/modules/notification/telegram/telegram-link.service.spec.ts` (new) — `issueLinkToken()` writes Redis key with correct TTL/value shape, rejects if already linked (409); `verifyAndBindUser()` binds on valid token (deletes Redis key), rejects expired/invalid token (no DB write), rejects if chat id already bound to a different user
- [X] T017 [P] [US1] RED extend `B/modules/notification/notification.processor.spec.ts` — `TELEGRAM` dispatch respects `notifyTelegram` preference (skip if false), applies digest exactly like `EMAIL`/`LINE` when `digestMode=true`, calls `TelegramBotService.sendMessage` on immediate send, permanent-failure response (bot blocked) does not retry and is recorded
- [X] T018 [P] [US1] RED extend `B/modules/user/user.controller.spec.ts` — `POST me/telegram/link-token` / `DELETE me/telegram` / `POST me/telegram/test-message`: `Idempotency-Key` required (400 if missing), owner-only, correct status codes per contracts/telegram-api.md
- [X] T019 [P] [US1] RED `B/modules/notification/telegram/telegram-webhook.controller.spec.ts` (new) — `TelegramSecretGuard` rejects missing/wrong secret header (403); valid `/start <token>` binds and replies; `/start` without valid token sends generic reply only; duplicate `update_id` short-circuits to 200 without reprocessing (dedup)

### Implementation

- [X] T020 [US1] Implement `TelegramLinkService` (`issueLinkToken`, `verifyAndBindUser`) in `B/modules/notification/telegram/telegram-link.service.ts` — `BusinessException` with Thai `userMessage`/`recoveryAction` per ADR-007 on conflict/expired-token paths; T016 GREEN
- [X] T021 [US1] Implement `TELEGRAM` leg in `NotificationProcessor.handleDispatch` + `sendTelegramImmediate`/`sendTelegramDigest` (call `TelegramBotService.sendMessage`, no `messageThreadId` for DM) in `B/modules/notification/notification.processor.ts`; T017 GREEN
- [X] T022 [US1] Add `POST me/telegram/link-token`, `DELETE me/telegram`, `POST me/telegram/test-message` routes to `B/modules/user/user.controller.ts` (owner-only, `Idempotency-Key`, `@Throttle` per contracts/telegram-api.md); T018 GREEN
- [X] T023 [US1] Implement `TelegramWebhookController` (`/start` handling, Redis dedup, defer heavy work to queue, always reply 200) in `B/modules/notification/telegram/telegram-webhook.controller.ts`, guarded by `TelegramSecretGuard`; T019 GREEN
- [X] T024 [US1] Add `TELEGRAM` leg to `notifyRecipients()` in `B/modules/rfa/rfa.service.ts` (alongside existing `SYSTEM` send) for `rfa.pending_approval`, using exact method/line findings from T001
- [X] T025 [US1] Create a new notification hook in `B/modules/rfa/rfa.service.ts` at the terminal-state sync point (`isTerminal && approveCodeStr`, ~line 1005) for `rfa.decision_returned` — no existing hook for any channel today; implement DM fan-out resolution (document `created_by` + every user with an active `rfa_workflow.assignedTo` on that RFA, per data-model.md "DM Fan-out Resolution") and call `notificationService.send({type:'TELEGRAM', ...})` once per resolved recipient
- [X] T026 [US1] Add `TELEGRAM` leg to the existing `SYSTEM` sends in `B/modules/reminder/services/escalation.service.ts` and `B/modules/reminder/processors/reminder.processor.ts` for `sla.deadline_reminder`
- [X] T027 [P] [US1] Create `TelegramBindingCard` component (deep-link button, linked status with `@username`/linked date, unlink button, "ส่งข้อความทดสอบ" button, unreachable badge) in `F/components/profile/telegram-binding-card.tsx`
- [X] T028 [US1] Wire `F/app/(dashboard)/profile/page.tsx` Notifications tab to real preferences API — replace the `useState(true)` mocks (`notifyEmail`, `notifyLine`, `digestMode`) with TanStack Query (`GET/PATCH /users/me/preferences`), add `notifyTelegram` toggle **disabled until linked** (D2), mount `TelegramBindingCard`
- [X] T029 [P] [US1] Add client methods (`getTelegramLinkToken`, `unlinkTelegram`, `sendTestMessage`, `getPreferences`, `updatePreferences`) to `F/lib/services/notification.service.ts` and hooks in `F/hooks/use-notification.ts`
- [X] T030 [P] [US1] Add Thai i18n keys for profile Telegram UI + bot reply strings under `notification.telegram.*` namespace in `public/locales/th/common.json` (per research.md R6)
- [X] T031 [P] [US1] Frontend tests for `TelegramBindingCard` and the wired preferences tab (toggle disabled pre-link, link/unlink/test-message flows, toast on save) in `F/components/profile/__tests__/telegram-binding-card.test.tsx` and `F/app/(dashboard)/profile/__tests__/page.test.tsx`
- [X] T032 [US1] Update assurance ledger checkpoint after US1 in `ledger.md`

**Checkpoint**: MVP complete — quickstart.md DM binding manual flow (steps 1-6) passes independently.

---

## Phase 4: User Story 2 — Project team receives shared notifications in a Telegram group (Priority: P1)

**Goal**: Admin binds a Telegram group (optionally to a Forum Topic) to a project via `/link <code>`; transmittal/correspondence events broadcast to it with strict project isolation.
**Independent Test**: quickstart.md "Manual flow — Group binding" steps 1-6.

### Tests (RED first)

- [X] T033 [P] [US2] RED `B/modules/notification/notification-channel.service.spec.ts` (new) — `issueLinkCode()` TTL/value; `notifyProject()` resolves only `is_active=1` channels for the given project and enqueues one job per channel carrying `messageThreadId` when set; rejects duplicate NULL-topic "whole group" bind for the same `externalChatId` (app-layer guard, ledger known gap)
- [X] T034 [P] [US2] RED extend `telegram-webhook.controller.spec.ts` — `/link <code>` in a group creates a channel bound to the pre-selected project; captures `update.message.message_thread_id` as `telegramTopicId` when present (Forum Topic), `NULL` when absent (whole group); rejects expired/invalid/reused code
- [X] T035 [P] [US2] RED same spec file — `my_chat_member` with the bot's own status `left`/`kicked` marks the matching channel `isActive=false` with `lastError` set
- [X] T036 [P] [US2] RED extend `B/modules/notification/notification.controller.spec.ts` — admin channel routes (`POST link-code`, `GET`, `PATCH`, `DELETE`) require `notification.manage_all`, `Idempotency-Key` on mutations

### Implementation

- [X] T037 [US2] Implement `NotificationChannelService` (`issueLinkCode`, `notifyProject`, `list`, `patch`, `delete`, `markInactive`) in `B/modules/notification/notification-channel.service.ts` — `BusinessException` per ADR-007; T033 GREEN
- [X] T038 [US2] Extend `TelegramWebhookController` to handle `/link <code>` (capturing `message_thread_id`) and `my_chat_member` updates; T034/T035 GREEN
- [X] T039 [US2] Add `POST admin/notifications/channels/link-code`, `GET/PATCH/DELETE admin/notifications/channels[/:publicId]` routes to `B/modules/notification/notification.controller.ts`; T036 GREEN
- [X] T040 [US2] Add both `TELEGRAM` legs to the existing after-commit hook in `B/modules/correspondence/correspondence-workflow.service.ts` for `transmittal.received`/`correspondence.registered` — DM leg: `notificationService.send({type:'TELEGRAM'})` to the doc-controller recipients (same fan-out as the existing EMAIL send, per D5 table where `transmittal.received` is DM ✅ + group ✅); group leg: `notifyProject()` call
- [X] T041 [US2] Create a new significant-status hook in `B/modules/correspondence/correspondence-workflow.service.ts` for `correspondence.status_changed` — define the hardcoded significant-status allowlist (terminal/major states, per data-model.md) and call both the DM fan-out (pattern from T025) and `notifyProject()` for the group leg, rendering the **minimal** group template (no title, per D7)
- [X] T042 [P] [US2] Create `NotificationChannelsPage` (list with project/status/last-error columns, "เพิ่ม Telegram Channel" flow showing the generated code + instructions, unbind/deactivate actions) in `F/app/(admin)/admin/notifications/channels/page.tsx`
- [X] T043 [P] [US2] Create `F/lib/services/notification-channel.service.ts` (new) + `F/hooks/use-notification-channels.ts` (new) — TanStack Query client/hooks for channel CRUD
- [X] T044 [P] [US2] Add Thai i18n keys for the admin channels UI under `notification.telegram.*`
- [X] T045 [P] [US2] Frontend tests for `NotificationChannelsPage` in `F/app/(admin)/admin/notifications/channels/__tests__/page.test.tsx`
- [X] T046 [US2] Update assurance ledger checkpoint after US2 in `ledger.md`

**Checkpoint**: US1 + US2 — quickstart.md group binding manual flow passes; SC-004 (zero cross-project leakage) verifiable by binding two projects' groups and confirming isolation.

---

## Phase 5: User Story 3 — User controls Telegram preferences and unlinks (Priority: P2)

**Goal**: Toggle on/off without losing binding; unlink clears binding and stops DMs immediately.
**Independent Test**: quickstart.md DM binding steps 5-6 (already covered by T028's wiring — this phase adds explicit verification + the digest-scope distinction).

- [X] T047 [P] [US3] RED test asserting `digestMode` batches `TELEGRAM` DMs but never delays/batches `notifyProject()` group sends (extend `notification.processor.spec.ts` and `notification-channel.service.spec.ts` with one assertion each, per Clarification Q2)
- [X] T048 [US3] Verify end-to-end: disabling the preference stops new DMs but leaves the binding intact (re-enabling resumes without re-linking); confirm against T017/T028 — fix any gap found
- [X] T049 [US3] Update assurance ledger checkpoint after US3 in `ledger.md`

**Checkpoint**: All acceptance scenarios in spec.md User Story 3 pass.

---

## Phase 6: User Story 4 — Admin observes and manages delivery health (Priority: P3)

**Goal**: Admin sees channel/delivery health and can force-unlink a user's Telegram binding.
**Independent Test**: quickstart.md failure drills ("Block the bot..." / admin sees `unreachable`).

### Tests (RED first)

- [X] T050 [P] [US4] RED `B/modules/notification/notification-delivery.service.spec.ts` (new) — records `PENDING`→`SENT`/`FAILED`/`SKIPPED` with `errorCode`/`errorMessage`; permanent-failure codes (`BOT_BLOCKED`, `CHAT_NOT_FOUND`) do not retry and flag the binding/channel unreachable/inactive on the next lookup
- [X] T051 [P] [US4] RED extend `notification.controller.spec.ts` — `GET admin/notifications/deliveries` filters (channelType/status/date/target), `GET/PATCH admin/notifications/settings` never exposes token/secret values, both require `notification.manage_all`
- [X] T052 [P] [US4] RED extend `user.controller.spec.ts` — `GET users` response includes `telegramStatus` per row; `PATCH :uuid/telegram/unlink` requires `user.edit` (not `notification.manage_all`), writes `@Audit`, and creates a `SYSTEM` notification for the affected user

### Implementation

- [X] T053 [US4] Implement `NotificationDeliveryService` (`record`, `list`, permanent-error-code taxonomy) in `B/modules/notification/notification-delivery.service.ts` — `BusinessException` per ADR-007; wire into `NotificationProcessor`/`NotificationChannelService` send paths from Phase 3/4; T050 GREEN
- [X] T053a [US4] Extend `B/modules/notification/notification-cleanup.service.ts` — add 90-day retention cleanup for `notification_deliveries` (`DELETE ... WHERE created_at < NOW() - INTERVAL 90 DAY`, matching the existing `cleanupOldNotifications` cron pattern, per D11f) with a spec test asserting the delete criteria in `notification-cleanup.service.spec.ts`
- [X] T054 [US4] Add `GET admin/notifications/deliveries`, `GET/PATCH admin/notifications/settings` routes to `notification.controller.ts`; T051 GREEN
- [X] T055 [US4] Add `telegramStatus` to the `GET users` response and implement `PATCH :uuid/telegram/unlink` (force-unlink) in `B/modules/user/user.controller.ts`/`user.service.ts` — `user.edit` guard, `@Audit('user.telegram.force_unlink','user')`, system notification to the affected user; T052 GREEN
- [X] T056 [P] [US4] Add a "Telegram" column (`✈️ @username` / `⚠️ blocked` / `—`) and "Unlink Telegram" dropdown action to `F/app/(admin)/admin/access-control/users/page.tsx`
- [X] T057 [P] [US4] Create `NotificationDeliveriesPage` and `NotificationSettingsPage` (bot status masked, global enable/disable toggle) in `F/app/(admin)/admin/notifications/deliveries/page.tsx` and `F/app/(admin)/admin/notifications/settings/page.tsx`
- [X] T057a [US4] Register a 'การแจ้งเตือน' (Notifications) menu entry in `F/components/admin/sidebar.tsx` under the 'การปฏิบัติการ' (Operations) section (or a new top-level group if the section pattern prefers) with children linking `/admin/notifications/channels`, `/admin/notifications/deliveries`, `/admin/notifications/settings` — use i18n keys, not hardcoded Thai labels if the menu already supports translation keys
- [X] T058 [P] [US4] Frontend tests for the users-page Telegram column/action and the two new admin pages
- [X] T059 [US4] Update assurance ledger checkpoint after US4 in `ledger.md`

**Checkpoint**: All user stories independently functional; `/admin/notifications/*` fully navigable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T060 [P] Tier-2 conformance sweep on all new/edited files: `// File:` header + Change Log, JSDoc (Thai) on public methods, explicit types, zero `any`/`console.log`/`parseInt`/unary `+`, single export per file
- [X] T061 [P] Run `pnpm --filter backend lint:ci && pnpm --filter backend build && pnpm --filter backend test`
- [X] T062 [P] Run `pnpm --filter lcbp3-frontend lint && pnpm --filter lcbp3-frontend test run && pnpm --filter lcbp3-frontend build`
- [X] T063 Security review: CASL guard present on every mutating endpoint, `TelegramSecretGuard` correctly rejects unauthenticated webhook calls, bot token/secret never logged or returned via any endpoint, `Idempotency-Key` enforced on all mutations, no `parseInt`/`Number`/`+` on any UUID, publicId used in every message link (ADR-019), FR-014 HTML-escape/truncation assertions present in tests, FR-015 graceful degradation verified (missing bot token disables TELEGRAM sends only — EMAIL/LINE unaffected) — recommend an independent `/112-speckit-security-audit` pass before merge
- [ ] T064 Real-app verification per `quickstart.md` via `check-real-app` — **blocked until ops completes BotFather registration + `setWebhook`** (see quickstart.md "Setting the webhook"); also measure SC-001 (link time), SC-002 (delivery latency), SC-006 (500-burst) and record results in `ledger.md`
- [X] T065 Finalize ledger terminal status (`FINAL_STATUS`) in `ledger.md` before handoff/PR; do not push/merge without explicit user authorization (repo hard limit)

## Dependencies & Execution Order

- Phase 1 (Setup) → Phase 2 (Foundational, blocks all stories) → Phase 3 (US1/MVP) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (Polish).
- US1 and US2 are both P1 and are largely independent (different controllers/services), but US2's `notifyProject()` and its message templates share the `TELEGRAM` job-dispatch primitives built in US1 (T012, T021) — so US2 cannot start implementation until Foundational + T012/T021 exist, even though its own tests (T033-T036) can be written in parallel with US1.
- US3 depends only on US1 (extends the preferences wiring from T028) — trivial once US1 is done.
- US4 depends on US1 (per-user delivery records) and US2 (per-channel delivery records) both existing, since its delivery-audit view surfaces both.
- Within each story: tests before implementation; backend before frontend wiring (frontend tasks marked `[P]` can start once the contract shape is fixed, even before backend GREEN, using contracts/telegram-api.md as the interface).

## Parallel Example (Foundational phase)

```text
T004 (user.entity.ts) ∥ T005 (user-preference.entity.ts) ∥ T006 (update-preference.dto.ts) ∥ T007 (notification.entity.ts) ∥ T008 (notification-channel.entity.ts) ∥ T009 (notification-delivery.entity.ts) ∥ T011 (ability.factory.ts) ∥ T014 (telegram DTOs)
T010 → after T007 (same file family, sequential with T007 if touching notification.service.ts vs entity — actually different files, so ∥ is fine)
T012 → T013 → T015 (bot service, guard, then module registration — sequential, same module wiring)
```

## Parallel Example (US1 tests)

```text
T016 (telegram-link.service.spec.ts) ∥ T017 (notification.processor.spec.ts) ∥ T018 (user.controller.spec.ts) ∥ T019 (telegram-webhook.controller.spec.ts)
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational — CRITICAL, blocks everything)
2. Complete Phase 3 (User Story 1 — DM binding)
3. **STOP and VALIDATE**: run quickstart.md DM binding flow manually (requires BotFather registration first — T064's blocker applies here too for the *real* Telegram round-trip; unit/integration tests from T016-T019/T021/T024-T026 validate logic without a live bot)
4. Demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 (DM) → independently testable → demo
3. Add US2 (Group, incl. Forum Topics) → independently testable → demo
4. Add US3 (preferences polish) → quick, low-risk
5. Add US4 (admin observability) → operational readiness
6. Polish → merge-ready

## Summary

- **70 tasks** (T001–T065 plus T003a, T012a, T015a, T053a, T057a lettered inserts): Setup 4, Foundational 15 (incl. ledger checkpoint + rate limiter), US1 17, US2 14, US3 3, US4 12 (incl. retention cleanup + sidebar nav), Polish 6
- **Parallel opportunities**: all Foundational entity/DTO tasks (T004-T009, T011, T014); all test-writing tasks within each story phase; most frontend tasks once backend contracts are fixed
- **Suggested MVP scope**: User Story 1 only (Phase 1-3) — delivers the core value (personal actionable notifications) independently of group/admin features
- **Independent test criteria**: each phase checkpoint above references the exact quickstart.md section that validates it without needing later phases
- **Format validation**: every task line starts with `- [ ]`, has a sequential `TID`, `[P]` only where genuinely parallel, `[USx]` only inside story phases (never in Setup/Foundational/Polish), and an exact file path in the description
