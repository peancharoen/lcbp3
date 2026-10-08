// File: src/modules/reminder/dto/create-reminder-rule.dto.ts
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReminderType } from '../../common/enums/review.enums';
import { ReminderRecipientType } from '../entities/reminder-rule-recipient.entity';

export class ReminderRecipientDto {
  @IsEnum(ReminderRecipientType)
  recipientType!: ReminderRecipientType;

  @IsOptional()
  @IsUUID()
  recipientRef?: string; // publicId ของ entity (USER/ROLE/TEAM/GROUP/DEPARTMENT) — NULL สำหรับ symbolic
}

export class CreateReminderRuleDto {
  @IsOptional()
  @IsInt()
  projectId?: number;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentTypeCode?: string;

  @IsEnum(ReminderType)
  reminderType!: ReminderType;

  @IsInt()
  daysBeforeDue!: number;

  @IsOptional()
  @IsInt()
  escalationLevel?: number;

  /** @deprecated ใช้ recipients แทน — คงไว้เพื่อ backward-compat (map → symbolic recipients) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyRoles?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReminderRecipientDto)
  recipients?: ReminderRecipientDto[];

  @IsOptional()
  @IsString()
  messageTemplate?: string;
}
