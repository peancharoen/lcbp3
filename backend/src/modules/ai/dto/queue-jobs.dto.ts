// File: backend/src/modules/ai/dto/queue-jobs.dto.ts
// Change Log:
// - 2026-08-24: ADR-048 T002 — สร้าง DTO สำหรับ Queue Job inspection, retry, delete,
//   และ async clear-failed operation

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

/** สถานะของ BullMQ job */
export type QueueJobStatus =
  | 'active'
  | 'waiting'
  | 'delayed'
  | 'completed'
  | 'failed';

/**
 * DTO แสดงรายละเอียดของ BullMQ job 1 รายการ
 * ใช้สำหรับ GET /ai/admin/queues/:queueName/jobs response
 */
export class QueueJobItemDto {
  @ApiProperty({ description: 'BullMQ job ID', example: '42' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'ชื่อ job type', example: 'embed-document' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'jobType field จาก payload',
    example: 'embed-document',
  })
  @IsString()
  jobType!: string;

  @ApiProperty({
    enum: ['active', 'waiting', 'delayed', 'completed', 'failed'],
    description: 'สถานะปัจจุบันของ job',
  })
  @IsEnum(['active', 'waiting', 'delayed', 'completed', 'failed'])
  status!: QueueJobStatus;

  @ApiProperty({
    description: 'ข้อมูล payload ของ job (ไม่รวม sensitive fields)',
    example: { documentPublicId: 'xxx', projectPublicId: 'yyy' },
  })
  data!: Record<string, unknown>;

  @ApiProperty({
    description: 'เหตุผลที่ job ล้มเหลว (เฉพาะ failed jobs)',
    required: false,
    nullable: true,
    example: 'Ollama connection timeout',
  })
  @IsOptional()
  @IsString()
  failedReason?: string;

  @ApiProperty({
    description: 'Stack trace เมื่อ job ล้มเหลว (array ของ string)',
    required: false,
    nullable: true,
    type: [String],
  })
  @IsOptional()
  stacktrace?: string[];

  @ApiProperty({ description: 'จำนวนครั้งที่ retry แล้ว', example: 2 })
  @IsNumber()
  attemptsMade!: number;

  @ApiProperty({
    description: 'Unix timestamp (ms) ที่สร้าง job',
    example: 1724463600000,
  })
  @IsNumber()
  createdAt!: number;

  @ApiProperty({
    description: 'Unix timestamp (ms) ที่เริ่มประมวลผล',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  processedOn?: number;

  @ApiProperty({
    description: 'Unix timestamp (ms) ที่เสร็จสิ้น',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  finishedOn?: number;
}

/**
 * DTO สำหรับ response ของ GET /ai/admin/queues/:queueName/jobs
 * รองรับ pagination และ status filtering
 */
export class GetQueueJobsResponseDto {
  @ApiProperty({
    type: [QueueJobItemDto],
    description: 'รายการ jobs ในหน้านั้น',
  })
  jobs!: QueueJobItemDto[];

  @ApiProperty({
    description: 'จำนวน jobs ทั้งหมดที่ตรงกับ status filter',
    example: 150,
  })
  @IsNumber()
  total!: number;

  @ApiProperty({ description: 'หน้าปัจจุบัน (1-indexed)', example: 1 })
  @IsNumber()
  page!: number;

  @ApiProperty({ description: 'จำนวนรายการต่อหน้า', example: 20 })
  @IsNumber()
  limit!: number;
}

/**
 * DTO สำหรับ response ของ POST /ai/admin/queues/:queueName/clear-failed
 * ระบบจะ enqueue งาน async และคืน jobId สำหรับ polling
 */
export class ClearFailedJobsResponseDto {
  @ApiProperty({
    description: 'BullMQ job ID สำหรับ polling progress',
    example: 'cf-ai-batch-1724463600',
  })
  @IsString()
  jobId!: string;

  @ApiProperty({
    enum: ['queued', 'processing', 'completed', 'failed'],
    description: 'สถานะของ cleanup job',
    example: 'queued',
  })
  @IsEnum(['queued', 'processing', 'completed', 'failed'])
  status!: 'queued' | 'processing' | 'completed' | 'failed';
}

/**
 * DTO สำหรับ response ของ GET /ai/admin/queues/:queueName/clear-failed/:jobId
 * ใช้สำหรับ polling ผล cleanup operation
 */
export class ClearFailedJobsStatusDto {
  @ApiProperty({
    description: 'BullMQ job ID',
    example: 'cf-ai-batch-1724463600',
  })
  @IsString()
  jobId!: string;

  @ApiProperty({ description: 'ชื่อ queue ที่ทำ cleanup', example: 'ai-batch' })
  @IsString()
  targetQueueName!: string;

  @ApiProperty({
    enum: ['queued', 'processing', 'completed', 'failed'],
    description: 'สถานะปัจจุบันของ cleanup operation',
  })
  @IsEnum(['queued', 'processing', 'completed', 'failed'])
  status!: 'queued' | 'processing' | 'completed' | 'failed';

  @ApiProperty({
    description: 'จำนวน failed jobs ที่ลบออกไปสำเร็จ',
    required: false,
    nullable: true,
    example: 8450,
  })
  @IsOptional()
  @IsNumber()
  clearedCount?: number;

  @ApiProperty({
    description: 'จำนวน failed jobs ที่ยังคงเหลืออยู่ (เกิน 10,000 safety cap)',
    required: false,
    nullable: true,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  remainingFailed?: number;

  @ApiProperty({
    description: 'error message กรณี cleanup ล้มเหลว',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({
    description: 'ISO timestamp ที่เสร็จสิ้น',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  completedAt?: string;
}
