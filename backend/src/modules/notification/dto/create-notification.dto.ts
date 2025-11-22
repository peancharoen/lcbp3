import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsUrl,
} from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsInt()
  @IsNotEmpty()
  userId!: number; // ผู้รับ

  @IsString()
  @IsNotEmpty()
  title!: string; // หัวข้อ

  @IsString()
  @IsNotEmpty()
  message!: string; // ข้อความ

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type!: NotificationType; // ประเภท: EMAIL, LINE, SYSTEM

  @IsString()
  @IsOptional()
  entityType?: string; // e.g., 'rfa', 'correspondence'

  @IsInt()
  @IsOptional()
  entityId?: number; // e.g., rfa_id

  @IsString()
  @IsOptional()
  link?: string; // Link ไปยังหน้าเว็บ (Frontend)
}
