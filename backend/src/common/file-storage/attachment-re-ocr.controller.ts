// File: backend/src/common/file-storage/attachment-re-ocr.controller.ts
// Change Log
// - 2026-09-19: ADR-055 T022 — 3 endpoints ของ Attachment Manual Re-OCR (contract ตาม D11 / precedent `reingest`)
//   Controller อยู่ใน file-storage (URL อยู่ใน attachment context) แต่ register ใน AiModule เพราะ
//   AiEnabledGuard ต้องการ AiSettingsService ที่อยู่ใน AiModule (FileStorageModule resolve ไม่ได้)
// - 2026-09-19: review fix — เพิ่ม GET re-ocr/preview (rag.manage) เพราะ /files/preview/:publicId
//   เดิมต้องการ document.view ซึ่ง RAG admin อาจไม่มี → PDF reference pane จะ 403
// - 2026-09-19: ADR-055 extension (D19) — POST re-ocr/replace (rag.admin.write + correspondence.edit)
//   + GET re-ocr/links สำหรับ link picker เมื่อ attachment ถูก share หลาย correspondence
// - 2026-09-19: security-audit fix — POST re-ocr/replace/confirm แยกจาก re-ocr/confirm
//   (junction swap ต้องการ rag.admin.write + correspondence.edit ไม่ใช่ rag.admin.write เพียงอย่างเดียว)

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Audit } from '../decorators/audit.decorator';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import { ValidationException } from '../exceptions';
import { ParseUuidPipe } from '../pipes/parse-uuid.pipe';
import type { RequestWithUser } from '../interfaces/request-with-user.interface';
import { AiEnabledGuard } from '../../modules/ai/guards/ai-enabled.guard';
import { FileStorageService } from './file-storage.service';
import { AttachmentReOcrService } from './attachment-re-ocr.service';
import type {
  AttachmentLinkView,
  ReOcrConfirmResult,
  ReOcrStatusResult,
  ReOcrTriggerResult,
} from './attachment-re-ocr.service';
import {
  ConfirmReOcrDto,
  TriggerReOcrDto,
  TriggerReplaceFileDto,
} from './dto/re-ocr.dto';

/** throttle ของ endpoint ที่เขียน/enqueue — ~10 ครั้ง/นาที (เทียบ sandbox) */
const RE_OCR_WRITE_THROTTLE = { default: { limit: 10, ttl: 60000 } };
/** throttle ของ polling status (frontend poll ทุก 3 วินาที) */
const RE_OCR_STATUS_THROTTLE = { default: { limit: 60, ttl: 60000 } };

/**
 * ตรวจ Idempotency-Key header (Security rule — ADR-016)
 * หมายเหตุ: dedup จริงอยู่ที่ reOcrToken + BullMQ deterministic jobId + trigger mutex
 * (retry ด้วย key เดิมหลังจบ flow จะสร้าง job ใหม่ — by design ของ ADR-055)
 */
const assertIdempotencyKey = (key?: string): void => {
  if (!key || key.trim().length === 0) {
    throw new ValidationException('Idempotency-Key header is required', [
      {
        field: 'Idempotency-Key',
        message: 'ต้องระบุ Idempotency-Key header',
      },
    ]);
  }
};

/** Attachment Manual Re-OCR (ADR-055) — admin เท่านั้น (rag.admin.write) */
@ApiTags('Attachment Re-OCR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('files')
export class AttachmentReOcrController {
  constructor(
    private readonly reOcrService: AttachmentReOcrService,
    private readonly fileStorageService: FileStorageService
  ) {}

  /** POST /files/:publicId/re-ocr — enqueue re-OCR (ไม่แตะ ocr_text จนกว่าจะ confirm) */
  @Post(':publicId/re-ocr')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('rag.admin.write')
  @UseGuards(AiEnabledGuard)
  @Throttle(RE_OCR_WRITE_THROTTLE)
  @Audit('attachment.re_ocr.trigger', 'attachment')
  @ApiOperation({ summary: 'Trigger manual re-OCR of a PDF attachment' })
  async trigger(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Body() dto: TriggerReOcrDto,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Request() req: RequestWithUser
  ): Promise<ReOcrTriggerResult> {
    assertIdempotencyKey(idempotencyKey);
    const { firstName, lastName, username } = req.user;
    const displayName =
      [firstName, lastName].filter(Boolean).join(' ').trim() || username;
    return this.reOcrService.trigger(publicId, dto.engineType ?? 'np-dms-ocr', {
      displayName,
    });
  }

  /**
   * POST /files/:publicId/re-ocr/replace — re-OCR ไฟล์ candidate แล้วให้เทียบก่อน swap junction (ADR-055 D19)
   * ต้องการ rag.admin.write AND correspondence.edit — เพราะเปลี่ยน link ของเอกสาร production
   */
  @Post(':publicId/re-ocr/replace')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('rag.admin.write', 'correspondence.edit')
  @UseGuards(AiEnabledGuard)
  @Throttle(RE_OCR_WRITE_THROTTLE)
  @Audit('attachment.re_ocr.replace', 'attachment')
  @ApiOperation({
    summary:
      'Trigger re-OCR on a candidate file for compare-before-replace junction swap',
  })
  async triggerReplace(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Body() dto: TriggerReplaceFileDto,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Request() req: RequestWithUser
  ): Promise<ReOcrTriggerResult> {
    assertIdempotencyKey(idempotencyKey);
    const { firstName, lastName, username, user_id } = req.user;
    const displayName =
      [firstName, lastName].filter(Boolean).join(' ').trim() || username;
    return this.reOcrService.triggerReplace(
      publicId,
      {
        engineType: dto.engineType ?? 'np-dms-ocr',
        targetCorrespondencePublicId: dto.targetCorrespondencePublicId,
        storageTempPath: dto.storageTempPath,
        tempAttachmentPublicId: dto.tempAttachmentPublicId,
      },
      { displayName, userId: user_id }
    );
  }

  /**
   * GET /files/:publicId/re-ocr/links — link ทั้งหมดของ attachment (link picker ของ replace flow)
   * permission เดียวกับ replace — endpoint นี้มีไว้เพื่อ flow เดียวกันเท่านั้น
   */
  @Get(':publicId/re-ocr/links')
  @RequirePermission('rag.admin.write', 'correspondence.edit')
  @Throttle(RE_OCR_STATUS_THROTTLE)
  @ApiOperation({
    summary: 'List correspondence links of an attachment for replace picker',
  })
  async links(
    @Param('publicId', ParseUuidPipe) publicId: string
  ): Promise<AttachmentLinkView[]> {
    return this.reOcrService.listLinks(publicId);
  }

  /** GET /files/:publicId/re-ocr/status — polling (newText เฉพาะตอน completed) */
  @Get(':publicId/re-ocr/status')
  @RequirePermission('rag.manage')
  @Throttle(RE_OCR_STATUS_THROTTLE)
  @ApiOperation({ summary: 'Get re-OCR job status / result' })
  async status(
    @Param('publicId', ParseUuidPipe) publicId: string
  ): Promise<ReOcrStatusResult> {
    return this.reOcrService.getStatus(publicId);
  }

  /**
   * GET /files/:publicId/re-ocr/preview — stream PDF ต้นฉบับสำหรับ diff pane
   * (ใช้ rag.manage แทน document.view ของ /files/preview/:publicId — RAG admin อาจไม่มี document.view)
   */
  @Get(':publicId/re-ocr/preview')
  @RequirePermission('rag.manage')
  @Throttle(RE_OCR_STATUS_THROTTLE)
  @ApiOperation({ summary: 'Stream source PDF for re-OCR diff reference' })
  async preview(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { stream, attachment } =
      await this.fileStorageService.preview(publicId);
    const encodedFilename = encodeURIComponent(attachment.originalFilename);
    res.set({
      'Content-Type': attachment.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      'Content-Length': String(attachment.fileSize),
    });
    return new StreamableFile(stream);
  }

  /** POST /files/:publicId/re-ocr/confirm — แทนที่ ocr_text + re-index (final, ไม่มี rollback) */
  @Post(':publicId/re-ocr/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rag.admin.write')
  @UseGuards(AiEnabledGuard)
  @Throttle(RE_OCR_WRITE_THROTTLE)
  @Audit('attachment.re_ocr.confirm', 'attachment')
  @ApiOperation({ summary: 'Confirm re-OCR result and replace OCR text' })
  async confirm(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Body() dto: ConfirmReOcrDto,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined
  ): Promise<ReOcrConfirmResult> {
    assertIdempotencyKey(idempotencyKey);
    return this.reOcrService.confirm(publicId, dto.reOcrToken);
  }

  /**
   * POST /files/:publicId/re-ocr/replace/confirm — confirm ของ replace mode (junction swap)
   * ต้องการ rag.admin.write AND correspondence.edit เหมือน trigger (D19) —
   * junction swap คือ mutation ของ production correspondence link จึงห้ามยืนยันด้วย rag.admin.write อย่างเดียว
   */
  @Post(':publicId/re-ocr/replace/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rag.admin.write', 'correspondence.edit')
  @UseGuards(AiEnabledGuard)
  @Throttle(RE_OCR_WRITE_THROTTLE)
  @Audit('attachment.re_ocr.replace_confirm', 'attachment')
  @ApiOperation({
    summary: 'Confirm replace-mode re-OCR — swaps the attachment junction link',
  })
  async confirmReplace(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Body() dto: ConfirmReOcrDto,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Request() req: RequestWithUser
  ): Promise<ReOcrConfirmResult> {
    assertIdempotencyKey(idempotencyKey);
    const { firstName, lastName, username, user_id } = req.user;
    const displayName =
      [firstName, lastName].filter(Boolean).join(' ').trim() || username;
    return this.reOcrService.confirmReplace(publicId, dto.reOcrToken, {
      displayName,
      userId: user_id,
    });
  }
}
