// File: backend/src/modules/notification/telegram/dto/telegram-update.dto.ts
// Change Log:
// - 2026-09-25: Initial creation — DTO สำหรับ Telegram webhook Update payload (Feature 258)

import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** subset ของ Telegram User object ที่ระบบใช้จริง */
export class TelegramUserDto {
  @IsNumber()
  id!: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  first_name?: string;
}

/** subset ของ Telegram Chat object */
export class TelegramChatDto {
  @IsNumber()
  id!: number;

  @IsString()
  type!: string; // 'private' | 'group' | 'supergroup' | 'channel'

  @IsOptional()
  @IsString()
  title?: string;
}

/** subset ของ Telegram Message object — รองรับ Forum Topics (message_thread_id) */
export class TelegramMessageDto {
  @IsNumber()
  message_id!: number;

  @ValidateNested()
  @Type(() => TelegramUserDto)
  from!: TelegramUserDto;

  @ValidateNested()
  @Type(() => TelegramChatDto)
  chat!: TelegramChatDto;

  @IsOptional()
  @IsString()
  text?: string;

  /** Forum Topics — มีค่าเฉพาะเมื่อข้อความถูกส่งในเธรดของ topic */
  @IsOptional()
  @IsNumber()
  message_thread_id?: number;
}

/** subset ของ ChatMemberUpdated (my_chat_member) */
export class TelegramChatMemberUpdatedDto {
  @ValidateNested()
  @Type(() => TelegramChatDto)
  chat!: TelegramChatDto;

  @ValidateNested()
  @Type(() => TelegramUserDto)
  from!: TelegramUserDto;

  @IsObject()
  new_chat_member!: { status: string };
}

/**
 * Telegram Update object (webhook payload)
 * จัดการเฉพาะ `message` (/start, /link) + `my_chat_member` (bot ถูก add/remove)
 */
export class TelegramUpdateDto {
  @IsNumber()
  update_id!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  message?: TelegramMessageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramChatMemberUpdatedDto)
  my_chat_member?: TelegramChatMemberUpdatedDto;
}
