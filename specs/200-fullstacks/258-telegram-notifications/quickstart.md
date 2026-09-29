# Quickstart: Telegram Notifications

## Prereqs

- `np-dms-lcbp3` stack up (backend, redis, mariadb); `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` set in `system_settings` (or docker-compose env for local dev); a test bot registered via `@BotFather` with webhook pointed at `https://api.np-dms.work/api/notifications/telegram/webhook` (see "Setting the webhook" in ops notes).
- One test DMS user; one test project; admin account holding `notification.manage_all` + `user.edit`.

## Setting the webhook (ops, one-time per bot/environment)

Prereq: bot registered via @BotFather (token in hand), `TELEGRAM_WEBHOOK_SECRET` decided (any random string ≥32 chars — this is a value **you** choose, not something Telegram gives you; store it in `system_settings.TELEGRAM_WEBHOOK_SECRET`), Cloudflare Tunnel already routes `api.np-dms.work` → `192.168.10.11:3000` (existing ingress rule — no tunnel config change needed since this feature reuses the existing backend API host).

1. Confirm the backend is reachable externally first: `curl https://api.np-dms.work/ping` → should return 200 (existing public health endpoint).
2. Register the webhook with Telegram (run once — replace `<BOT_TOKEN>` and `<WEBHOOK_SECRET>`):
   ```bash
   curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://api.np-dms.work/api/notifications/telegram/webhook",
       "secret_token": "<WEBHOOK_SECRET>",
       "allowed_updates": ["message", "my_chat_member"],
       "drop_pending_updates": true
     }'
   ```
   Expected response: `{"ok":true,"result":true,"description":"Webhook was set"}`
3. Verify it registered correctly:
   ```bash
   curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
   ```
   Check `url` matches, `pending_update_count` is low/zero, and `last_error_message` is absent. If `last_error_message` shows a connection/TLS error, the tunnel or backend route isn't reachable yet — fix that before retrying.
4. Send `/start` to the bot from Telegram — if `TelegramWebhookController` isn't deployed yet, `getWebhookInfo` will start accumulating `last_error_message` (Telegram retries failed webhook deliveries with backoff, then eventually gives up — no action needed on your end, it self-recovers once the endpoint is live).

**Notes**:
- `allowed_updates` is a filter — only `message` and `my_chat_member` are needed for this feature (binding + kicked-from-group detection); omitting other update types (`callback_query`, `edited_message`, etc.) reduces noise, matching the "no interactive commands beyond linking" assumption in `spec.md`.
- `secret_token` here is **not** the bot token — it's a separate shared secret only you and Telegram know, checked on every incoming webhook call via the `X-Telegram-Bot-Api-Secret-Token` header (this is what `TelegramSecretGuard` verifies — see `contracts/telegram-api.md` R4).
- To point the same bot at a different environment later (e.g. staging → prod), just re-run step 2 with the new `url` — Telegram only keeps one active webhook per bot token.
- To temporarily disable delivery without deleting the bot: `curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"` (Telegram stops calling out; `TELEGRAM_ENABLED=false` in `system_settings` is the app-level equivalent and is preferred for normal on/off toggling per D8).

## Manual flow — DM binding (US1)

1. Log in as test user → Profile → Notifications tab → "เชื่อม Telegram" → deep link opens Telegram app.
2. Press Start in Telegram → verify bot replies "เชื่อมบัญชีสำเร็จ" and profile shows `✈️ @<username>` linked status within a few seconds (poll or refetch).
3. Trigger `rfa.pending_approval` (assign an RFA to this user for approval) → verify DM arrives with document number, title, due date, and a working link.
4. Click "ส่งข้อความทดสอบ" in profile → verify a second, distinct test DM arrives.
5. Toggle Telegram preference off → trigger another event → verify no DM (other channels still fire per FR-007).
6. Unlink → verify profile returns to "ยังไม่ผูก" and re-running step 1 issues a fresh token.

## Manual flow — Group binding (US2)

1. As admin: `/admin/notifications/channels` → "เพิ่ม Telegram Channel" → select the test project → receive code `KX7F2P`.
2. In Telegram, add the bot to a test group → send `/link KX7F2P` in the group.
3. Verify bot replies confirmation in-group and the channel appears in the admin list bound to the correct project, `is_active=true`.
4. Register a transmittal on the test project → verify the group receives a **minimal** message (document number + type + org + link, no title — D7/Clarification).
5. Register the same event type on a *different* project with no bound group → verify the test group receives nothing (FR-005 isolation).
6. Remove the bot from the group → trigger another event → verify delivery fails, channel flips `is_active=false` with `last_error` set, and admin sees the broken state (not repeated retries).

## Failure drills

- Unset `TELEGRAM_BOT_TOKEN` → trigger an event → verify delivery to other channels (email/LINE/SYSTEM) still succeeds and admin settings page shows `botConfigured: false` (FR-015).
- Block the bot from the test Telegram account after linking → trigger a DM event → verify `notification_deliveries.status='FAILED'`, `error_code='BOT_BLOCKED'`, and the user's binding shows `unreachable` in both profile and admin users list — no retry storm.
- Replay a used `/start` token → verify no new binding, no duplicate Redis writes.
- Send the same Telegram `update_id` twice to the webhook (simulate Telegram's retry) → verify only one side effect occurs (dedup key).

## Verification commands

```bash
pnpm --filter backend test -- telegram notification-channels notification-deliveries workflow-dsl
pnpm --filter backend lint:ci
pnpm --filter backend build
pnpm --filter lcbp3-frontend test run
pnpm --filter lcbp3-frontend lint
```
