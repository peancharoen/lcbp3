// File: backend/src/modules/document/document.controller.ts
// Change Log:
// - 2026-09-07: Cross-type bulk operations endpoints (Feature 253 — T087-T089)
// - 2026-09-09: SECURITY FIX — controller had no @UseGuards at all, same pattern
//   as maintenance.controller.ts (fixed same day): @RequirePermission is dead
//   metadata without a guard to enforce it, and @CurrentUser() resolved undefined
//   (no JwtAuthGuard ever populated request.user), crashing bulkCancel/bulkTag/
//   bulkExport. Every bulk endpoint here — including bulk cancel across document
//   types — was reachable unauthenticated in production.
//   Also fixed: bulkCancel/bulkTag/bulkExport referenced document.cancel (never
//   existed)/document.edit/document.view instead of the purpose-built
//   document.bulk_cancel/document.bulk_tag/document.bulk_export permissions
//   (which also never existed in the live DB — applied via delta
//   2026-09-09-unified-document-crud-permissions.sql). downloadBulkExport had no
//   @RequirePermission at all — added document.bulk_export to match the action
//   that produced the file.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Headers,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ValidationException,
  NotFoundException,
} from '../../common/exceptions/base.exception';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DocumentService } from './document.service';
import { BulkCancelRequestDto } from '../../common/dto/bulk-cancel.dto';
import { BulkTagRequestDto } from '../../common/dto/bulk-tag.dto';
import { BulkExportRequestDto } from '../../common/dto/bulk-export.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '../user/entities/user.entity';

/**
 * Controller สำหรับ cross-type document operations
 * - Bulk Cancel / Tag / Export (Feature 253 T087-T089)
 * - Progress polling + download
 */
@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  private assertIdempotencyKey(idempotencyKey?: string): void {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new ValidationException('Idempotency-Key header is required', [
        {
          field: 'Idempotency-Key',
          message: 'ต้องระบุ Idempotency-Key header',
        },
      ]);
    }
  }

  /**
   * POST /documents/bulk/cancel — ยกเลิกเอกสารหลายรายการพร้อมกัน
   */
  @Post('bulk/cancel')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Bulk cancel documents' })
  @ApiResponse({ status: 202, description: 'Bulk cancel started' })
  @RequirePermission('document.bulk_cancel')
  @Audit('document.bulk_cancel', 'document')
  async bulkCancel(
    @Body() dto: BulkCancelRequestDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ): Promise<{ bulkId: string }> {
    this.assertIdempotencyKey(idempotencyKey);
    return this.documentService.bulkCancel(
      dto.publicIds,
      dto.documentType,
      dto.reason ?? '',
      user
    );
  }

  /**
   * POST /documents/bulk/tag — แก้ไขแท็กเอกสารหลายรายการพร้อมกัน
   */
  @Post('bulk/tag')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Bulk tag documents' })
  @ApiResponse({ status: 202, description: 'Bulk tag started' })
  @RequirePermission('document.bulk_tag')
  @Audit('document.bulk_tag', 'document')
  async bulkTag(
    @Body() dto: BulkTagRequestDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ): Promise<{ bulkId: string }> {
    this.assertIdempotencyKey(idempotencyKey);
    return this.documentService.bulkTag(
      dto.publicIds,
      dto.documentType,
      dto.addTags,
      dto.removeTags ?? []
    );
  }

  /**
   * POST /documents/bulk/export — ส่งออก metadata หลายรายการพร้อมกัน
   */
  @Post('bulk/export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Bulk export document metadata' })
  @ApiResponse({ status: 202, description: 'Bulk export started' })
  @RequirePermission('document.bulk_export')
  @Audit('document.bulk_export', 'document')
  async bulkExport(
    @Body() dto: BulkExportRequestDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ): Promise<{ bulkId: string; downloadUrl?: string }> {
    this.assertIdempotencyKey(idempotencyKey);
    return this.documentService.bulkExport(
      dto.publicIds,
      dto.documentType,
      dto.format,
      dto.columns,
      user
    );
  }

  /**
   * GET /documents/bulk/:bulkId/progress — ตรวจสอบความคืบหน้า
   */
  @Get('bulk/:bulkId/progress')
  @ApiOperation({ summary: 'Get bulk operation progress' })
  @ApiResponse({ status: 200, description: 'Progress returned' })
  @RequirePermission('document.view')
  getBulkProgress(@Param('bulkId', ParseUUIDPipe) bulkId: string): {
    total: number;
    completed: number;
    failed: number;
    done: boolean;
    downloadUrl?: string;
  } {
    return this.documentService.getBulkProgress(bulkId);
  }

  /**
   * GET /documents/bulk/:bulkId/download — ดึงไฟล์ export
   */
  @Get('bulk/:bulkId/download')
  @ApiOperation({ summary: 'Download bulk export file' })
  @RequirePermission('document.bulk_export')
  downloadBulkExport(
    @Param('bulkId', ParseUUIDPipe) bulkId: string,
    @Res() res: Response
  ): void {
    const file = this.documentService.getBulkDownload(bulkId);
    if (!file) {
      const exception = new NotFoundException('Bulk export', bulkId);
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    res.set({
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Type': file.mimeType,
    });
    res.send(file.buffer);
  }
}
