// File: src/modules/reminder/dto/create-reminder-rule.dto.ts
import { IsEnum, IsInt, IsOptional, IsString, IsArray, MaxLength } from 'class-validator';
import { ReminderType } from '../../common/enums/review.enums';

export class CreateReminderRuleDto {
  @IsOptional()
  @IsInt()
  projectId?: number;

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notifyRoles?: string[];
}
