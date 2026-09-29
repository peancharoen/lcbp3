// File: backend/src/modules/notification/telegram/dto/telegram-update.dto.ts
// Change Log:
// - 2026-09-25: Initial creation — DTO สำหรับ Telegram webhook Update payload (Feature 258)
// - 2026-09-29: เปลี่ยนเป็น plain interfaces — global ValidationPipe ใช้ forbidNonWhitelisted:true
//   ซึ่ง reject real Telegram update เสมอ (Telegram ส่ง field เสริมเช่น date/entities/old_chat_member
//   ที่เปลี่ยนแปลงตาม API version) — endpoint นี้ auth ด้วย secret token แล้ว + handler มี null-guard เอง

/**
 * Type shapes สำหรับ Telegram webhook Update payload
 * — ใช้เป็น interface (ไม่ใช่ class-validator DTO) เพื่อให้ ValidationPipe skip
 *   ผ่าน metatype=Object: Telegram ส่ง extra fields ที่เราไม่ได้ declare เสมอ
 */

/** subset ของ Telegram User object ที่ระบบใช้จริง */
export interface TelegramUserDto {
  id: number;
  username?: string;
  first_name?: string;
}

/** subset ของ Telegram Chat object */
export interface TelegramChatDto {
  id: number;
  type: string; // 'private' | 'group' | 'supergroup' | 'channel'
  title?: string;
}

/** subset ของ Telegram Message object — รองรับ Forum Topics (message_thread_id) */
export interface TelegramMessageDto {
  message_id: number;
  from: TelegramUserDto;
  chat: TelegramChatDto;
  text?: string;
  /** Forum Topics — มีค่าเฉพาะเมื่อข้อความถูกส่งในเธรดของ topic */
  message_thread_id?: number;
}

/** subset ของ ChatMemberUpdated (my_chat_member) */
export interface TelegramChatMemberUpdatedDto {
  chat: TelegramChatDto;
  from: TelegramUserDto;
  new_chat_member: { status: string };
}

/**
 * Telegram Update object (webhook payload)
 * จัดการเฉพาะ `message` (/start, /link) + `my_chat_member` (bot ถูก add/remove)
 */
export interface TelegramUpdateDto {
  update_id: number;
  message?: TelegramMessageDto;
  my_chat_member?: TelegramChatMemberUpdatedDto;
}
