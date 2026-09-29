// File: backend/src/modules/notification/telegram/telegram.errors.ts
// Change Log:
// - 2026-09-25: Initial creation — error taxonomy สำหรับ Telegram Bot API send (Feature 258)

/** Error code ที่บันทึกลง notification_deliveries.error_code */
export type TelegramErrorCode =
  | 'BOT_BLOCKED'
  | 'CHAT_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'BOT_TOKEN_MISSING'
  | 'TELEGRAM_DISABLED'
  | 'API_ERROR';

/**
 * Error จากการส่ง Telegram — `permanent=true` หมายถึงห้าม retry
 * (bot ถูก block / chat ไม่พบ) → บันทึก FAILED + flag binding/channel ทันที (FR-010)
 */
export class TelegramSendError extends Error {
  constructor(
    public readonly code: TelegramErrorCode,
    message: string,
    public readonly permanent: boolean,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'TelegramSendError';
  }
}
