// File: backend/src/common/file-storage/dto/re-ocr.dto.ts
// Change Log
// - 2026-09-19: ADR-055 T019 — DTOs สำหรับ Attachment Manual Re-OCR (trigger/confirm)
// - 2026-09-19: ADR-055 extension (D19) — TriggerReplaceFileDto สำหรับ production file replace

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

/**
 * Body ของ POST /files/:publicId/re-ocr/replace (ADR-055 D19)
 * - `targetCorrespondencePublicId` = link บน current revision ของ correspondence นี้ที่จะถูก swap
 * - candidate source: `storageTempPath` XOR `tempAttachmentPublicId` — enforce XOR ใน service
 *   (pattern เดียวกับ ReplaceQueueFileDto ของ migration)
 */
export class TriggerReplaceFileDto {
  /** default = 'np-dms-ocr' (vision model) — ห้าม default เป็น 'auto' (ADR-055 D7) */
  @IsOptional()
  @IsIn(RE_OCR_ENGINE_TYPES)
  engineType?: SandboxOcrEngineType;

  /** publicId (UUIDv7) ของ correspondence เป้าหมาย */
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  targetCorrespondencePublicId!: string;

  /** path ไฟล์บน staging/Legacy NAS — XOR กับ tempAttachmentPublicId */
  @IsOptional()
  @IsString()
  storageTempPath?: string;

  /** temp attachment จาก POST /files/upload — XOR กับ storageTempPath */
  @IsOptional()
  @IsUUID()
  tempAttachmentPublicId?: string;
}
