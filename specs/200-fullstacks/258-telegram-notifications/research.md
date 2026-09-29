# Research: Telegram Notifications

**Feature**: `258-telegram-notifications` | **Date**: 2026-09-25
**Purpose**: Resolve Technical Context unknowns before Phase 1 design. All prior architecture decisions (D1–D11 + Q1–Q5 clarifications) already live in `spec.md`; this file resolves the remaining implementation-level unknowns discovered while filling the plan template.

## R1: Telegram Bot API integration approach

**Decision**: Direct HTTP calls to `https://api.telegram.org/bot<token>/<method>` via `axios` — no third-party SDK (`node-telegram-bot-api`, `telegraf`).

**Rationale**:
- `axios` is already a backend dependency and already used for outbound webhook calls in `notification.processor.ts` (`N8N_LINE_WEBHOOK_URL` POST) — no new dependency needed.
- Telegram Bot API surface needed here is tiny: `sendMessage`, `setWebhook` (ops-time, one-off), `getMe` (health check). A full SDK (long-polling loops, update routers, keyboard builders) is overkill and pulls in unused surface area — violates "Boring Technology" design principle (00-03-product-vision.md §9).
- Webhook payloads (`/start`, `my_chat_member`) are simple JSON — no SDK parsing needed, DTOs + `class-validator` suffice per existing convention.

**Alternatives considered**:
- `telegraf` — rejected: designed around its own middleware/session model that doesn't fit NestJS controller/guard conventions; adds a dependency for ~3 API calls.
- `node-telegram-bot-api` — rejected: defaults to polling; webhook mode still requires bypassing most of its API surface.

## R2: Queue

**Decision**: Reuse existing `QUEUE_NOTIFICATIONS` (`'notifications'`, `queue.constants.ts`) — add job name `JOB_SEND_TELEGRAM` and extend `NotificationProcessor.process()` switch. No new BullMQ queue.

**Rationale**: ADR-008 mandates BullMQ for all notification sends; the existing `notifications` queue + processor already handles EMAIL/LINE dispatch with the same reliability requirements (retry/backoff, rate limiting per D1/FR-008). A second queue would only be justified if Telegram needed independent concurrency/priority tuning from email/LINE — it doesn't (all are I/O-bound outbound HTTP calls). Group broadcast fan-out (`notifyProject`) also enqueues onto the same queue, one job per bound channel.

**Alternatives considered**: New `QUEUE_TELEGRAM` — rejected, no isolation requirement found; would just add operational surface (another BullMQ dashboard entry, another `@Processor` registration) without behavior benefit.

## R3: Rate limiting mechanism

**Decision**: BullMQ built-in `limiter` option on the Telegram-sending worker path (`{ max: 25, duration: 1000 }` global via a `QueueEvents`-scoped limiter, per Telegram's ~30 msg/s global cap with headroom) + application-level per-chat pacing check (Redis key `telegram:ratelimit:{chatId}` with 1.05s min-interval, since Telegram also caps ~1 msg/s per chat and ~20 msg/min per group) before calling `sendMessage`.

**Rationale**: BullMQ's queue-level `limiter` already exists as a pattern in this codebase for other constrained external calls (OCR sequential queue design in ADR-055). Global limiter handles the aggregate cap; per-chat/per-group check is needed because BullMQ's limiter is queue-wide, not per-target, and Telegram enforces both a global AND a per-target ceiling.

**Alternatives considered**: External rate-limiter library (`bottleneck`) — rejected, BullMQ limiter + a Redis `SET ... EX` pattern (already used elsewhere for locks, e.g. Redlock in ADR-002) covers this without a new dependency.

## R4: Webhook framework fit

**Decision**: Standard NestJS controller (`TelegramWebhookController`) under the existing `notification` module, `@Public()` (no `JwtAuthGuard`) but with a custom `TelegramSecretGuard` that verifies `X-Telegram-Bot-Api-Secret-Token` against the encrypted `system_settings.TELEGRAM_WEBHOOK_SECRET` value.

**Rationale**: Matches the pattern already established for other unauthenticated-but-verified inbound endpoints in the codebase (sidecar API-key protected endpoints, ADR-040 D6 network isolation) — a dedicated guard, not ad-hoc header checks inline in the controller.

**Alternatives considered**: Reusing `JwtAuthGuard` — impossible, Telegram cannot present a DMS JWT. API Gateway-level secret check only (no app-level guard) — rejected, defense-in-depth already required by ADR-016 and Cloudflare Tunnel is not itself an authorization layer.

## R5: Frontend data fetching pattern

**Decision**: TanStack Query (existing convention per `next-best-practices` skill) for all new frontend surfaces — profile Telegram binding card, admin channels/deliveries/settings pages, admin users Telegram column. Mutations (link, unlink, test-send, bind/unbind channel) invalidate the relevant query keys on success.

**Rationale**: Matches `05-03-frontend-guidelines.md` and all existing admin pages already audited (`access-control/users`, `ai/rag-console`) — no deviation needed.

**Alternatives considered**: None — this is settled convention, not an open decision.

## R6: i18n key namespace

**Decision**: `notification.telegram.*` for UI strings (profile, admin), separate from `notification.telegram.<eventType>` used for outbound message templates (per `contracts/telegram-message-templates.md`). Two namespaces under one prefix keep UI copy and wire-format templates from colliding when both are edited.

**Rationale**: Existing i18n convention is feature-prefixed namespacing (checked against `05-08-i18n-guidelines.md`); no existing `notification.*` namespace collision found.

---

## Summary — Technical Context resolved

| Unknown | Resolution |
|---|---|
| Telegram integration library | Direct `axios` calls (R1) |
| Queue topology | Reuse `QUEUE_NOTIFICATIONS` (R2) |
| Rate limiting | BullMQ limiter + Redis per-chat pacing (R3) |
| Webhook auth | Custom guard + secret header (R4) |
| Frontend data layer | TanStack Query, existing convention (R5) |
| i18n structure | `notification.telegram.*` namespace (R6) |

No NEEDS CLARIFICATION remain.

---

## Implementation Notes (T001 — verified call-site anchors, 2026-09-25)

All paths under `backend/src/`. Line numbers verified against branch `258-telegram-notifications` at implementation start; treat as anchors, re-verify on edit.

### Producer call sites (hardcoded, per D12 correction)

| Event | File | Anchor | Action |
|---|---|---|---|
| `rfa.pending_approval` | `modules/rfa/rfa.service.ts` | `notifyRecipients()` L1025–1048; invoked fire-and-forget at L854 after submit transaction | Add `.send({type:'TELEGRAM', ...})` alongside existing `SYSTEM` call inside the recipient loop |
| `rfa.decision_returned` | `modules/rfa/rfa.service.ts` | `syncRevisionStatus()` L989–1019; caller site at L953–958 where `result.isCompleted` + `result.approveCode` are known | **New hook** — add `notifyDecisionReturned()` call (fire-and-forget `void ... .catch`) after `syncRevisionStatus` returns in the action handler, gated on `result.isCompleted`; fan-out = `correspondence.createdBy` + active `rfa_workflow.assignedTo` rows for the document |
| `sla.deadline_reminder` | `modules/reminder/processors/reminder.processor.ts` | SYSTEM sends at L48–55 (DUE_SOON), L60–68 (ON_DUE), L73–81 (OVERDUE) | Add `type:'TELEGRAM'` send next to each `SYSTEM` send |
| `sla.deadline_reminder` (escalations) | `modules/reminder/services/escalation.service.ts` | SYSTEM sends at L85–92 (L1 assignee), L153–160 (L2 PM), L165–172 (L2 assignee) | Add `type:'TELEGRAM'` legs |
| `transmittal.received` / `correspondence.registered` | `modules/correspondence/correspondence-workflow.service.ts` | after-commit "Notify TO recipient org" block L97–136 (EMAIL to doc-controller per TO org) | Add `TELEGRAM` DM leg (same recipient loop) + `notifyProject()` group leg |
| `correspondence.status_changed` | `modules/correspondence/correspondence-workflow.service.ts` | `processAction()` L151–177 — post-`syncStatus` at L171–173 | **New hook** — significant-status allowlist (terminal/major states vs `finalStates`) → DM fan-out (`correspondence.createdBy` L53-54 + `CirculationRouting` `assignedTo` WHERE `status='PENDING'` — pattern at `correspondence.service.ts` L1273–1279) + `notifyProject()` |

### Entity/DTO anchors

- `UuidBaseEntity` (`common/entities/uuid-base.entity.ts`): `publicId` prop → `uuid` column (`type:'uuid'`, unique) + `@BeforeInsert` uuidv7 — **note**: `unique:true` on partitioned `notification_deliveries` is invalid at DB level; for `NotificationDelivery` entity declare `uuid` column manually WITHOUT `unique` (still `@BeforeInsert` uuidv7), composite PK `(id, created_at)` matching `notification.entity.ts` L52–54 pattern (`@CreateDateColumn` + `@PrimaryColumn` on `createdAt`)
- `User` entity: `user_id` is the INT PK prop name (`@PrimaryGeneratedColumn({name:'user_id'})`, `@Exclude()`); `lineId` precedent at L59–60 for telegram cols; `preference` 1:1 relation at L81–82 (processor reads `user.preference` — `findOne` must eager-load or join preference)
- `UserPreference`: `notifyEmail`/`notifyLine`/`digestMode` at L19–26 — add `notifyTelegram` after `notifyLine`
- `Notification` entity: `NotificationType` enum L14–18 — add `TELEGRAM`; partitioned composite PK precedent L52–54
- `NotificationProcessor`: local `NotificationPayload` interface L15–21 and `NotificationJobData` union L23–25 are **separate** from `notification.service.ts` `NotificationJobData` — 'TELEGRAM' must be added in BOTH files (processor L20/L25/L65/L150 type unions + dispatch legs L102–112 + digest leg L166–170)
- `queue.constants.ts`: `QUEUE_NOTIFICATIONS` L10 — add `JOB_*` constants after it
- `ability.factory.ts`: `Actions` union L14–20 lacks `'view'`/`'manage_all'` (masked by casts at runtime); `Subjects` L23–35 lacks `'notification'` — add `'view'|'manage_all'` to Actions + `'notification'` to Subjects (safe widening; seeded perms `notification.view`/`notification.manage_all` already work via `as` casts in both `ability.factory.ts` `parsePermission` and `permissions.guard.ts` `parsePermission`)
- `PermissionsGuard` (`common/auth/guards/permissions.guard.ts`): `@RequirePermission('notification.manage_all')` + `PermissionsGuard` on controller — scope extraction reads `params/body/query` `organizationId`/`projectId`/`contractId`
- Decorators available: `@RequirePermission` (`common/decorators/require-permission.decorator.ts`), `@Audit` (`common/decorators/audit.decorator.ts`), idempotency via `common/decorators/idempotency.decorator.ts` + `common/interceptors/idempotency.interceptor.ts`
- `SystemSetting` entity (`modules/ai/entities/system-setting.entity.ts`): `settingKey`/`settingValue`/`dataType`/`category`/`isEncrypted`/`isPublic`/`updatedBy` — notification module registers it via `TypeOrmModule.forFeature([SystemSetting])` (cross-module entity reuse)
- `CryptoService` (`common/services/crypto.service.ts`): `encrypt()`/`decrypt()` aes-256-cbc, iv-prefixed hex — decrypt returns plaintext passthrough when value lacks `:` separator (graceful)
- `userService.findDocControlIdByOrg(orgId)` → internal user id (used by both existing hooks)
- Correspondence DM fan-out anchor: `correspondence.createdBy` (`created_by` col L53–54); "active assignees" = `CirculationRouting` `assignedTo` with `status='PENDING'` (L1273–1279)
