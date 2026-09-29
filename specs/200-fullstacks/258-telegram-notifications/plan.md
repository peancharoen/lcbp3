// File: specs/200-fullstacks/258-telegram-notifications/plan.md
// Change Log:
// - 2026-09-25: Initial implementation plan for Telegram Notifications

# Implementation Plan: Telegram Notifications

**Branch**: `258-telegram-notifications` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/258-telegram-notifications/spec.md`
**Governing ADR**: [ADR-057 (Draft)](../../06-Decision-Records/ADR-057-dms-telegram-notification-channel.md)

## Summary

Add Telegram as a notification channel alongside EMAIL/LINE: (1) users self-service bind a personal Telegram chat via a deep-link `/start` flow to receive DMs for actionable events (approval assigned, decision returned, SLA reminders); (2) admins bind Telegram groups (optionally to a specific Forum Topic) to projects via an in-group `/link <code>` flow to broadcast team-visible events (transmittal received, correspondence registered/status-changed). All sends go through the existing `notifications` BullMQ queue (ADR-008). **Correction during task planning**: significant-status triggering was originally planned as a Workflow DSL `send_telegram` effect, but no DSL effect executor exists anywhere in the codebase (`EffectSchema` is unused validation-only schema) — triggering is implemented as hardcoded call sites instead, matching the existing `EMAIL`/`SYSTEM` pattern (see data-model.md "Significant-status trigger points"). Inbound Telegram updates arrive via a secret-verified webhook behind the existing Cloudflare Tunnel (ADR-045), fully separate from the Hermes DevOps bot (ADR-031) — own bot, own token, own ingress. Delivery is audited per-attempt in a new `notification_deliveries` table, and the previously-mocked Profile → Notifications tab is wired to the real preferences API.

## Technical Context

**Language/Version**: TypeScript (NestJS 11 backend, Next.js 16 frontend) — per ADR-005
**Primary Dependencies**: `@nestjs/bullmq` + `bullmq` (existing queue infra), `axios` (existing — direct Telegram Bot API calls, see research.md R1), `ioredis` (existing — link tokens, dedup, rate-limit pacing), `class-validator`/`class-transformer` (DTOs), TanStack Query (frontend, existing convention)
**Storage**: MariaDB 11.8 (users/user_preferences ALTER, notifications ENUM extend, 2 new tables — see data-model.md); Redis (transient link tokens + webhook dedup + rate-limit pacing, no persistence)
**Testing**: Jest (`backend`, existing `jest.config.js`), Vitest (`frontend`, existing `vitest`), Playwright (E2E, existing `e2e/`)
**Target Platform**: On-prem Docker stack on `np-dms-lcbp3` host; inbound via Cloudflare Tunnel (ADR-045, sole edge proxy)
**Project Type**: Web (backend + frontend, existing monorepo layout — `backend/`, `frontend/`)
**Performance Goals**: SC-002 (95% of notifications delivered to Telegram within 30s), SC-006 (burst of 500 queued notifications processed without loss, within Telegram's ~30 msg/s global / ~1 msg/s per-chat / ~20 msg/min per-group limits)
**Constraints**: Telegram Bot API rate limits (see research.md R3); message length ≤4096 chars (FR-014); bot token/secret never in source control or logs (FR-012); webhook must respond 200 promptly and defer processing to queue (ADR-008)
**Scale/Scope**: ~5 organizations / 4 projects per current product vision scale; expected channel count low (single/low-digit groups per project); DM volume bounded by active workflow assignment fan-out (typically 1-5 recipients per event)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below._

Gates derived from `specs/00-overview/00-03-product-vision.md` §9 (Design Principles) and Tier 1 non-negotiables in `_LCBP3-CONTEXT.md`:

| Gate | Check | Status |
|---|---|---|
| **Security First** | CASL guards on every mutation; webhook uses dedicated secret-verification guard, not JWT bypass; bot token/secret encrypted in `system_settings`, never in UI/logs | ✅ Pass — FR-012, contracts/telegram-api.md guards |
| **Data Never Lies** | Every send attempt recorded in `notification_deliveries` (audit); force-unlink recorded via `@Audit` decorator | ✅ Pass — FR-009, FR-018 |
| **Fail Gracefully** | Telegram outage/misconfiguration degrades to remaining channels, never silently drops (FR-015); permanent failures detected and excluded, no retry storm | ✅ Pass |
| **Built for Thailand** | All message templates and UI copy in Thai, i18n-keyed (FR per Assumptions, D11b) | ✅ Pass |
| **On-Premise by Design** | Telegram is an external SaaS dependency by necessity of the platform (Telegram Bot API is inherently cloud) — this is the one deliberate exception, scoped narrowly to notification delivery metadata (chat id, message text) and never document content/PII beyond what's already in message templates (D7 minimal content) | ⚠️ Justified exception — see Complexity Tracking |
| **Boring Technology** | Direct `axios` HTTP calls instead of a Telegram SDK (research.md R1); reuse existing `notifications` queue instead of a new queue (R2) | ✅ Pass |

No unjustified violations. One deliberate, scoped exception to "On-Premise by Design" is documented in Complexity Tracking below (this is inherent to the feature's purpose — a Telegram integration cannot avoid calling Telegram's cloud API — and is bounded by minimal-content design (D7) and human-in-the-loop opt-in binding).

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/258-telegram-notifications/
├── spec.md                              # Feature specification (with Clarifications)
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output (schema + trigger points + fan-out logic)
├── quickstart.md                        # Phase 1 output
├── contracts/
│   ├── telegram-api.md                  # REST contract (Phase 1 output)
│   └── telegram-message-templates.md    # Message wire-format contract (from earlier session)
├── checklists/
│   └── requirements.md                  # Spec quality checklist
└── tasks.md                             # Phase 2 output (/105-speckit-tasks)
```

### Source Code (repository root)

```text
backend/src/modules/
├── notification/                         # existing module — extended
│   ├── entities/
│   │   ├── notification.entity.ts        # NotificationType enum +TELEGRAM
│   │   ├── notification-channel.entity.ts        # NEW
│   │   └── notification-delivery.entity.ts       # NEW
│   ├── telegram/                         # NEW sub-folder — Telegram-specific concerns
│   │   ├── telegram-bot.service.ts       # axios wrapper: sendMessage, setWebhook, getMe
│   │   ├── telegram-webhook.controller.ts        # POST /notifications/telegram/webhook
│   │   ├── telegram-link.service.ts      # deep-link token issue/verify (user + group)
│   │   ├── telegram-secret.guard.ts      # X-Telegram-Bot-Api-Secret-Token verification
│   │   └── dto/
│   │       ├── telegram-update.dto.ts
│   │       └── link-code-request.dto.ts
│   ├── notification-channel.service.ts   # NEW — channel CRUD + notifyProject()
│   ├── notification-delivery.service.ts  # NEW — audit log writer/reader
│   ├── notification.processor.ts         # extended — 'send-telegram' job case
│   ├── notification.service.ts           # extended — send() accepts 'TELEGRAM'
│   └── notification.controller.ts        # extended — admin channels/deliveries/settings routes
├── user/
│   ├── entities/user.entity.ts           # +telegramChatId/telegramUsername/telegramLinkedAt
│   ├── entities/user-preference.entity.ts        # +notifyTelegram
│   ├── user-preference.service.ts        # existing — no new methods needed (DTO field addition)
│   └── user.controller.ts                # +telegram/link-token, DELETE telegram, test-message, PATCH :uuid/telegram/unlink
├── rfa/rfa.service.ts                    # extended — +TELEGRAM leg on existing notifyRecipients() SYSTEM send (pending_approval); NEW hook for decision_returned (no existing hook for any channel)
├── correspondence/correspondence-workflow.service.ts     # extended — +TELEGRAM leg on existing after-commit EMAIL send; NEW significant-status hook for status_changed group broadcast
└── reminder/{services/escalation.service.ts,processors/reminder.processor.ts}  # extended — +TELEGRAM leg on existing SYSTEM sends (sla.deadline_reminder)

frontend/
├── app/(dashboard)/profile/page.tsx      # extended — wire real preferences API + Telegram binding card
├── app/(admin)/admin/
│   ├── access-control/users/page.tsx     # extended — Telegram column + unlink action
│   └── notifications/                    # NEW section
│       ├── channels/page.tsx
│       ├── deliveries/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── profile/telegram-binding-card.tsx # NEW
│   └── admin/notifications/              # NEW — channel table, delivery table, settings form
└── types/dto/notification/               # extended — TelegramBindingStatus, NotificationChannel, NotificationDelivery
```

**Structure Decision**: Existing web app monorepo layout (`backend/` NestJS modules, `frontend/` Next.js App Router) — no new top-level structure. Telegram-specific backend logic is isolated in a `notification/telegram/` sub-folder so the boundary from Hermes (ADR-031) and from other channels (EMAIL/LINE) stays visually obvious in the module tree. Frontend gets one new admin route group (`/admin/notifications/*`, D8) and extends two existing pages (profile, admin users) rather than duplicating them.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| External cloud dependency (Telegram Bot API) — deviates from "On-Premise by Design" | The feature's entire purpose is delivering notifications through Telegram, which is an external SaaS the platform does not control; there is no on-prem substitute for the Telegram network itself | Not building the feature at all was rejected by explicit product decision (this spec); routing through a self-hosted Matrix/XMPP bridge instead of Telegram was rejected because users' actual client is Telegram — an alternate protocol would not reach them. Scope is bounded: only chat id + minimal message text (D7) leave the network, never document content, files, or credentials (FR-011/012), and binding is opt-in per user (D11a) |

## Ledger Decision

**A ledger IS required.** Rationale (per `_LCBP3-CONTRACTS.md` §4 "When to create a ledger"):

- **Cross-session**: This unit already spans 3+ sessions (spec authoring + grill session → ADR-057 draft → clarify session → this plan) and implementation (backend entities/services/controllers, frontend 5+ pages/components, multiple producer call-site edits, schema SQL application) will span further sessions.
- **Multiple scopes touched by potentially different workers**: backend notification module, RFA/correspondence/reminder producers, user module, frontend profile page, frontend admin pages — a natural candidate for delegating bounded tasks to multiple workers/subagents per `tasks.md`.
- **Protected boundaries**: new public (secret-verified, non-JWT) webhook endpoint; RBAC/CASL permission wiring (`user.edit`, `notification.manage_all`); schema changes (ADR-044 — SQL applied to a live DB by an operator, not auto-migrated).

**Ledger created at**: `specs/200-fullstacks/258-telegram-notifications/ledger.md`
**ASSURANCE_UNIT_ID**: `np-dms-lcbp3/telegram-notifications/v1`

## Post-Design Constitution Check (re-evaluated after Phase 1)

Re-checked against `data-model.md`, `contracts/telegram-api.md`, `contracts/telegram-message-templates.md`:

- **Security First**: confirmed — every mutating contract endpoint lists an explicit guard/permission; webhook contract explicitly excludes `JwtAuthGuard` in favor of `TelegramSecretGuard`, with rationale (research.md R4).
- **Data Never Lies**: confirmed — `notification_deliveries` schema captures recipient (`target`), event, outcome, and reason for every attempt including DM fan-out (multi-recipient — one row per recipient, data-model.md "DM Fan-out Resolution").
- **Fail Gracefully**: confirmed — permanent-failure detection (`error_code` taxonomy) prevents retry storms; FR-015 degradation path unchanged by design.
- **On-Premise exception**: still scoped to chat id + minimal metadata only, per D7 and FR-011/012 — no widening found during design.
- **Boring Technology**: confirmed — no new queue, no new SDK, no new i18n mechanism, no new DSL execution engine (rejected in favor of hardcoded call sites matching existing convention); only new dependency-free primitives (Redis keys, two new tables following existing partitioned-audit-table pattern).

No new violations introduced during Phase 1 design. Gate: **PASS**.
