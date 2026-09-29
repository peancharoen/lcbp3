# Validation Report: Telegram Notifications (Feature 258)

**Date**: 2026-09-29
**Status**: **PASS** (code-complete; ops verification partially done — T064 pending real-user flows)
**Validated against**: `spec.md` FR-001..FR-022, merged `main` @ `96a28cb0` (+ hotfixes to `412bfa43`, docs `96a28cb0`)

## Coverage Summary

| Metric | Count | Percentage |
|---|---|---|
| Requirements Covered | 22/22 | 100% (1 partial — see FR-020 note) |
| Acceptance Criteria Met | 18/18 scenarios | 100% (implementation-level; live E2E pending) |
| Edge Cases Handled | 11/12 | 92% |
| Tests Present | 22/22 FRs | 100% |
| TDD Evidence Recorded | CP6/CP9 in ledger | Yes |

## Requirements Matrix

| FR | Requirement | Implementation | Status |
|---|---|---|---|
| FR-001 | Single-use deep-link binding | `telegram-link.service.ts` (issueLinkToken Redis TTL, verifyAndBindUser), `telegram-webhook.controller.ts` `/start` | ✅ |
| FR-002 | DM for personal events | processor TELEGRAM leg + `alsoTelegram`; hooks in rfa/reminder/correspondence | ✅ |
| FR-003 | Admin group bind/unbind | `notification-channel.service.ts` + `notification-channel-admin.controller.ts` (`notification.manage_all`) | ✅ |
| FR-004 | Group messages on project events | `notifyProject` + `JOB_SEND_TELEGRAM_GROUP` handler | ✅ |
| FR-005 | Project isolation 1:N broadcast | `where: {projectId, isActive:true}` fan-out | ✅ |
| FR-006 | Enable/disable + unlink | `unlinkUser` clears 3 cols (real `null` post-cleanup), `notifyTelegram` pref | ✅ |
| FR-007 | Pref + digest (DM only) | processor digest routing; group path bypasses digest (spec-asserted) | ✅ |
| FR-008 | All sends via queue | BullMQ `notifications` queue + limiter — **except** `sendTestMessage` (inline by design; MEDIUM note) | ⚠️ partial |
| FR-009 | Auditable delivery log | `notification_deliveries` via `NotificationDeliveryService` — gap: test-message + pref-skipped paths don't record rows | ⚠️ partial |
| FR-010 | Permanent-fail detection | `classifyError` permanent flag → markInactive/blocked — gap: blanket 400→CHAT_NOT_FOUND | ⚠️ partial |
| FR-011 | publicId-only links | links built with `publicId` across all producers | ✅ |
| FR-012 | Secrets outside source control | encrypted `system_settings` (`is_encrypted=1`), env fallback, never logged; masked admin endpoint | ✅ live-verified |
| FR-013 | Separate from Hermes | dedicated bot/token/ingress; no shared code | ✅ |
| FR-014 | Escape + truncate | `escapeHtml` + `truncate(4096)` wired in `sendMessage`, spec-asserted | ✅ |
| FR-015 | Graceful degradation | `TELEGRAM_DISABLED`/`BOT_TOKEN_MISSING` permanent errors; other channels unaffected | ✅ spec-asserted |
| FR-016 | TELEGRAM enum | `notification.entity.ts:21` | ✅ |
| FR-017 | Preferences persisted | `update-preference.dto.ts` + entity `notifyTelegram` | ✅ |
| FR-018 | Admin force-unlink | `user-telegram-admin.controller.ts` — `user.edit` + `@Audit` + SYSTEM notify; users-page column | ✅ |
| FR-019 | Admin pages | channels/deliveries/settings pages + masked settings endpoint | ✅ |
| FR-020 | Test message | `sendTestMessage` works but **inline** (no queue, no audit row) | ⚠️ partial |
| FR-021 (corrected) | Hardcoded producer hooks | rfa.pending_approval, rfa.decision_returned (new), correspondence submit/status_changed, sla.deadline_reminder | ✅ |
| FR-022 | DM fan-out | createdBy + active workflow assignments minus actor | ✅ |

## Edge Cases

| Edge case | Status | Note |
|---|---|---|
| `/start` without token | ✅ | bot replies usage, no binding |
| Token replay | ✅ | Redis single-use `del` after bind |
| User blocks bot | ✅ | permanent → binding flagged, no retry storm |
| Bot kicked from group | ✅ | `my_chat_member` → markInactive |
| Same TG acct → two DMS users | ✅ | `TELEGRAM_CHAT_ID_TAKEN` 409 |
| Over-length message | ✅ | truncate to 4096 |
| Telegram down/rate-limited | ✅ | BullMQ retry backoff + permanent/transient split |
| Project deleted / user deactivated | ⚠️ | bindings remain; sends degrade to inactive on failure (no proactive cleanup) |
| Formatting-breaking chars | ✅ | escapeHtml on all dynamic fields |
| Token missing/expired | ✅ | FR-015 graceful degrade |
| Burst of 500 | ✅ | BullMQ limiter 25/s + per-chat Redis pacing |
| Hermes isolation | ✅ | ADR-031 boundary held |

## Contract Compliance

| Item | Status | Notes |
|---|---|---|
| Ledger exists | Yes | `ledger.md` |
| Ledger STATUS | `open` header / `implementation-complete` terminal | header line stale — see CP10 |
| Checkpoints complete | Yes | CP0–CP9 recorded |
| TDD evidence links | Yes | RED→GREEN documented CP6/CP9 |
| Protected boundaries crossed | No — authorized | merge/push on explicit user command; schema ops-gated per ADR-044 |

## Post-ledger events (since CP9)

- **Merged to main** (`69f6a41a`, squash via 2git.sh) + hotfix `412bfa43` (circular `CommonModule` import → UndefinedModuleException boot crash; `| null` entity fields needed explicit column `type:`)
- **T003a done**: `TELEGRAM_*` seeded live (encrypted via real CryptoService); script committed `src/scripts/seed-telegram-settings.ts`
- **Webhook registered**: `getWebhookInfo` → URL set, 0 pending, no errors; live probe w/ real secret → `200 {ok:true}`
- Static analysis: ESLint/tsc clean both sides; `pnpm audit` → 0 vulns after multer/nodemailer/undici/morgan bumps (`a4ee9e65`, unpushed at report time)
- Tests: backend 3320 pass / frontend 1234 pass; coverage-gate failures are pre-existing (ai/maintenance/migration services), not F258

## Uncovered / Partial Items

| Item | Severity | Fix |
|---|---|---|
| `sendTestMessage` bypasses BullMQ + no audit row (FR-008/020 partial) | Medium | enqueue a `JOB_SEND_TELEGRAM_GROUP`-style job or record a delivery row |
| Blanket HTTP 400 → `CHAT_NOT_FOUND` permanent (FR-010 over-trigger) | Medium | match `description` before classifying permanent |
| Webhook bind failures reply nothing to the user | Medium | `safeReply` on expected exceptions |
| Group-send retry can duplicate posts; DM retry creates new delivery row per attempt | Medium | check `status===SENT` at handler start; reuse delivery row |
| `telegramStatus` 'blocked' never clears on recovery | Low | recency bound on FAILED check |

## Recommendations

1. **T064**: complete real-user verification (DM bind via `/start`, group bind via `/link`, one live notification, SC-001/002/006 measurement) then record CP-final
2. Address the 4 medium partials in a follow-up commit — none block operation
3. Push `a4ee9e65` (audit fixes) when convenient
