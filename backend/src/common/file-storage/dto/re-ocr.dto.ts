// File: backend/src/common/file-storage/dto/re-ocr.dto.ts
// Change Log
// - 2026-09-19: ADR-055 T019 — DTOs สำหรับ Attachment Manual Re-OCR (trigger/confirm)

import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import type { SandboxOcrEngineType } from '../../../modules/ai/services/sandbox-ocr-engine.service';

/** engine ที่ admin เลือกได้ (ตรงกับ SandboxOcrEngineType — ADR-055 D7) */
export const RE_OCR_ENGINE_TYPES = ['np-dms-ocr', 'auto'] as const;

/** Body ของ POST /files/:publicId/re-ocr */
export class TriggerReOcrDto {
  /** default = 'np-dms-ocr' (vision model) — ห้าม default เป็น 'auto' (ADR-055 D7) */
  @IsOptional()
  @IsIn(RE_OCR_ENGINE_TYPES)
  engineType?: SandboxOcrEngineType;
}

/** Body ของ POST /files/:publicId/re-ocr/confirm */
export class ConfirmReOcrDto {
  /** reOcrToken (UUIDv7) ที่ได้จาก trigger response */
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  reOcrToken!: string;
}
