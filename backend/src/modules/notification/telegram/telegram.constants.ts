// File: backend/src/modules/notification/telegram/telegram.constants.ts
// Change Log:
// - 2026-09-25: Initial creation — Redis key builders + TTL constants สำหรับ Telegram notification channel (Feature 258)

/**
 * Redis key builders และ TTL constants สำหรับ Telegram integration
 * — ทุก key เป็น ephemeral state เท่านั้น (ไม่เข้า MariaDB)
 * ดู data-model.md ส่วน "Redis (transient)"
 */

/** TTL ของ deep-link binding token (`/start <token>`) — 15 นาที */
export const TELEGRAM_LINK_TTL_SECONDS = 900;

/** TTL ของ group link code (`/link <code>`) — 15 นาที */
export const TELEGRAM_GROUP_LINK_TTL_SECONDS = 900;

/** TTL ของ webhook dedup key — กัน Telegram retry update ซ้ำ */
export const TELEGRAM_WEBHOOK_DEDUP_TTL_SECONDS = 300;

/** Per-chat pacing window (1 msg/วินาที ต่อ chat — Telegram Bot API limit) */
export const TELEGRAM_CHAT_PACING_MS = 1000;

/** Key สำหรับ deep-link binding token ของ user */
export function telegramLinkKey(token: string): string {
  return `telegram:link:${token}`;
}

/** Key สำหรับ one-time group link code */
export function telegramGroupLinkKey(code: string): string {
  return `telegram:grouplink:${code}`;
}

/** Key สำหรับ webhook update_id dedup */
export function telegramWebhookDedupKey(updateId: number): string {
  return `telegram:webhook:dedup:${updateId}`;
}

/** Key สำหรับ per-chat send pacing (set NX PX — ถ้ามีอยู่แล้วแปลว่าส่งเร็วเกิน) */
export function telegramRateLimitKey(chatId: string): string {
  return `telegram:ratelimit:${chatId}`;
}

/** Telegram Bot API reject ข้อความยาวกว่า 4096 chars — truncate ก่อนส่งเสมอ (FR-014) */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
