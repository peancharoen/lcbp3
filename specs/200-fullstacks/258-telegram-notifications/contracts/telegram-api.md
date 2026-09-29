# Contract: Telegram Notifications API

All `:publicId` are UUIDv7 strings (ADR-019). All mutating endpoints require `Idempotency-Key` (ADR-016) unless noted. All sends happen via `QUEUE_NOTIFICATIONS` (ADR-008) — none of these endpoints call Telegram synchronously.

## User self-service (Profile → Notifications)

### POST `/users/me/telegram/link-token`

- Auth: `JwtAuthGuard` (any authenticated user, no extra permission — D11a)
- Headers: `Idempotency-Key` required; `@Throttle` ≈5/min (prevent token-gen spam)
- 200: `{ deepLink: "https://t.me/<bot_username>?start=<token>", expiresAt: "<ISO>" }`
- Effects: writes `telegram:link:{token}` in Redis (TTL 900s, value `{userId, userPublicId, iat}`); does not touch `users` table yet
- Errors: 409 if user already linked (`telegram_chat_id IS NOT NULL`) — must unlink first

### DELETE `/users/me/telegram`

- Auth: `JwtAuthGuard`; owner only
- Headers: `Idempotency-Key` required
- 200: `{ status: "unlinked" }`
- Effects: clears `telegram_chat_id`/`telegram_username`/`telegram_linked_at`; sets `user_preferences.notify_telegram = false`
- Errors: 404 if not currently linked

### POST `/users/me/telegram/test-message`

- Auth: `JwtAuthGuard`; owner only
- Headers: `Idempotency-Key` required; `@Throttle` ≈3/min
- 202: `{ status: "queued", deliveryId: "<uuid>" }`
- Errors: 409 if not linked; 503 if Telegram channel globally unavailable (`TELEGRAM_ENABLED=false` or bot token missing — FR-015)
- Effects: enqueues one `JOB_SEND_TELEGRAM` job with a fixed test template; writes `notification_deliveries` row (`event_type='system.test_message'`)

### GET/PATCH `/users/me/preferences` (existing — extended)

- Existing endpoints (`UserPreferenceService`) — `UpdatePreferenceDto` gains `notifyTelegram?: boolean` alongside existing `notifyEmail`/`notifyLine`/`digestMode` (FR-017, D9)
- No new endpoint — this is a field addition to an existing contract

## Telegram → DMS webhook (public, secret-verified)

### POST `/notifications/telegram/webhook`

- Auth: **no** `JwtAuthGuard` — custom `TelegramSecretGuard` verifying `X-Telegram-Bot-Api-Secret-Token` header against `system_settings.TELEGRAM_WEBHOOK_SECRET`
- Body: raw Telegram Update object (validated via DTO — only `message.text` starting `/start` or `/link`, and `my_chat_member`, are handled; everything else is ack'd and ignored)
- 200 always (Telegram retries on non-2xx) — even on internal no-op, to avoid Telegram's automatic retry storm; actual processing is deferred to the queue
- Dedup: `telegram:webhook:dedup:{update_id}` Redis key (TTL 300s) — duplicate `update_id` short-circuits to 200 without re-processing
- Effects by update type:
  - `/start <token>` (private chat) → validates against `telegram:link:{token}`; on success, writes `users.telegram_chat_id/telegram_username/telegram_linked_at`, deletes Redis key, sends confirmation reply
  - `/start` without valid token → sends generic instructions reply only; no DB write
  - `/link <code>` (group chat) → validates against `telegram:groupLink:{code}` (admin-issued, see below); on success, creates `notification_channels` row (capturing `update.message.message_thread_id` as `telegram_topic_id` if present — Forum Topics support), sends confirmation reply in the same thread/topic it was invoked from
  - `my_chat_member` where `new_chat_member.status IN ('left','kicked')` for the bot itself → marks matching `notification_channels.is_active=0`, `last_error='Bot removed from group'`

## Admin — Channel management (`/admin/notifications/channels`)

### POST `/admin/notifications/channels/link-code`

- Auth: `JwtAuthGuard, PermissionsGuard`; `notification.manage_all`
- Body: `{ projectPublicId: "<uuid>", channelType: "TELEGRAM_GROUP" | "TELEGRAM_CHANNEL", name?: string }`
- Headers: `Idempotency-Key` required
- 200: `{ code: "KX7F2P", expiresAt: "<ISO>", instructions: "..." }`
- Effects: writes `telegram:groupLink:{code}` in Redis (TTL 900s, value `{projectId, channelType, name, adminUserId}`)

### GET `/admin/notifications/channels`

- Auth: `notification.manage_all`
- Query: `projectPublicId?`, `isActive?`, pagination
- 200: `{ data: [{ publicId, channelType, name, projectPublicId, projectName, isActive, lastError, telegramTopicId, createdAt }], meta }` — `telegramTopicId: null` means the whole group/channel, not a specific topic (Forum Topics support, added post-plan)

### PATCH `/admin/notifications/channels/:publicId`

- Auth: `notification.manage_all`; `Idempotency-Key` required
- Body: `{ isActive?: boolean, name?: string }`
- 200: updated channel
- Use case: reactivate after re-inviting bot, or deactivate without deleting

### DELETE `/admin/notifications/channels/:publicId`

- Auth: `notification.manage_all`; `Idempotency-Key` required
- 200: `{ status: "unbound" }`
- Effects: hard-deletes the row; `notification_deliveries.channel_id` on prior rows → application-level `SET NULL` in `NotificationChannelService.delete()` (no FK — MariaDB forbids FK on partitioned tables; `channel_id` uses a plain index, see data-model.md)

## Admin — Delivery audit (`/admin/notifications/deliveries`)

### GET `/admin/notifications/deliveries`

- Auth: `notification.manage_all`
- Query: `channelType?`, `status?`, `dateFrom?`, `dateTo?`, `target?`, pagination
- 200: `{ data: [{ publicId, channelType, target, eventType, status, errorCode, errorMessage, attemptCount, sentAt, createdAt }], meta }`

## Admin — Bot status (`/admin/notifications/settings`)

### GET `/admin/notifications/settings`

- Auth: `notification.manage_all`
- 200: `{ telegramEnabled: boolean, botConfigured: boolean, botUsername: string, webhookConfigured: boolean }` — never returns token/secret values, only presence flags

### PATCH `/admin/notifications/settings`

- Auth: `notification.manage_all`; `Idempotency-Key` required
- Body: `{ telegramEnabled: boolean }` — toggles `system_settings.TELEGRAM_ENABLED` only; token/secret editing is NOT exposed via this or any endpoint (D8 — ops sets via direct DB/deploy config)

## Admin — Users list (`/admin/access-control/users` — extended, existing controller)

### PATCH `/users/:uuid/telegram/unlink` (new sub-route on existing `UserController`)

- Auth: `JwtAuthGuard, PermissionsGuard`; `user.edit` (Clarification Q4 — same permission as the existing `PATCH /users/:uuid`, not `notification.manage_all`)
- Headers: `Idempotency-Key` required; `@Audit('user.telegram.force_unlink', 'user')`
- 200: `{ status: "unlinked" }`
- Errors: 404 if target user not linked
- Effects: clears the same fields as self-service unlink; additionally creates a `notifications` row (type `SYSTEM`) addressed to the affected user: "บัญชี Telegram ของคุณถูกยกเลิกการเชื่อมโดยผู้ดูแลระบบ"

### GET `/users` (existing — response extended)

- Existing list endpoint response gains `telegramStatus: "linked" | "unreachable" | "unlinked"` per row (derived: `linked` if `telegram_chat_id` set and last delivery not permanently failed; `unreachable` if set but last delivery `error_code` is a permanent-failure code; `unlinked` if not set)

## Internal service contracts (not HTTP — for `plan.md`/`tasks.md` reference)

- `NotificationService.notifyProject(projectPublicId: string, eventType: string, payload: object): Promise<void>` — resolves active `notification_channels` for the project, enqueues one `JOB_SEND_TELEGRAM` per channel (D4)
- `NotificationService.send(data: NotificationJobData & { type: 'TELEGRAM' }): Promise<void>` — existing per-user `send()` extended to accept `'TELEGRAM'` in its type union
