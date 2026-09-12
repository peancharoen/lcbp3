// File: backend/src/modules/migration/excel-import-review.controller.ts
// Change Log:
// - 2026-09-06: Initial creation — Excel Import Review Controller (T010)
//   Endpoint POST /api/v1/correspondence/import-review/check สำหรับ Wave 3
//   ใช้ CASL Guard + RequirePermission ตาม ADR-016 (FR-018)
//   RBAC: Superadmin / Org Admin / Document Control สำหรับ check + direct import
//   Endpoints อื่น (download-annotated, confirm, cancel) จะถูกเพิ่มใน Wave 4-6
// - 2026-09-06: Fix Wave 3 review findings —
//   1) เปลี่ยนจาก user.role (ไม่มี field นี้) เป็น permission-based check
//      ผ่าน UserService.getUserPermissions (pattern เดียวกับ workflow-transition.guard)
//   2) ใช้ ForbiddenException แทน BadRequestException สำหรับ authorization failures
//   3) เพิ่ม permission correspondence.import_review (id 221) ใน seed SQL
// - 2026-09-06: Code review fixes —
//   4) ParseUUIDPipe บน @Param('sessionId') ทุก endpoint (early 400 rejection)
//   5) เพิ่ม GET /:sessionId/download-failed-rows endpoint (MIGRATION_STAGING quarantine)
//   6) Static import fs แทน dynamic import('fs') ใน downloadAnnotated
//   7) @ApiBody สำหรับ multipart check endpoint (Swagger documentation)
// - 2026-09-09: Fix double-prefix bug — @Controller เดิมประกาศ 'api/v1/...'
//   ซ้ำกับ app.setGlobalPrefix('api') ใน main.ts ทำให้ route จริงกลายเป็น
//   '/api/api/v1/correspondence/import-review/...' (ใช้งานจริงไม่ได้เลย)
//   แก้เป็น 'v1/correspondence/import-review' ให้ตรงกับ convention ของ
//   controller อื่นทั้งหมดในระบบ (พบระหว่างเพิ่ม frontend menu, feature 252)
// - 2026-09-12: Async/polling pattern (ADR-008) — POST /check คืน sessionId
//   ทันที (ไม่รอประมวลผล) + เพิ่ม GET /:sessionId/status สำหรับ poll
//   แก้ปัญหา axios timeout 15s ไม่พอสำหรับ AI review 265+ แถว

import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  Logger,
  UseGuards,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { CheckImportReviewDto } from './dto/excel-import-review.dto';
import { ExcelDataReviewService } from './services/excel-data-review.service';

/** ขนาดไฟล์สูงสุด 50 MB (รองรับ .zip ที่มี PDFs หลายไฟล์) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** นามสกุลไฟล์ที่อนุญาต */
const ALLOWED_EXTENSIONS = ['.xlsx', '.zip'];

/**
 * Multer file shape (หลีกเลี่ยงการพึ่ง global namespace augmentation)
 */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer: Buffer;
}

/**
 * ExcelImportReviewController — REST API สำหรับ 4-Layer Excel Review Pipeline
 *
 * Wave 3: POST /check (Layer 1 + Layer 2 + Stash)
 * Wave 4: GET /:sessionId/download-annotated (Layer 3 + Annotator)
 * Wave 6: POST /confirm, POST /cancel (Two-phase confirmation + cleanup)
 *
 * RBAC (FR-018):
 * - check: correspondence.import_review (Superadmin, Org Admin, Document Control)
 * - MIGRATION_STAGING: สงวนไว้ให้ Admin เท่านั้น (system.manage_all หรือ
 *   organization.manage_members) — Document Control ใช้ DIRECT_IMPORT เท่านั้น (D7)
 * - External AI (GEMINI/CLAUDE): สงวนไว้ให้ Admin เท่านั้น (D2)
 */
@ApiTags('Excel Import Review')
@ApiBearerAuth()
@Controller('v1/correspondence/import-review')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ExcelImportReviewController {
  private readonly logger = new Logger(ExcelImportReviewController.name);

  constructor(
    private readonly reviewService: ExcelDataReviewService,
    private readonly userService: UserService
  ) {}

  /**
   * POST /api/v1/correspondence/import-review/check
   * อัปโหลดไฟล์ Excel/ZIP และรัน 4-Layer review (FR-001)
   */
  @Post('check')
  @RequirePermission('correspondence.import_review')
  @ApiOperation({
    summary: 'Upload Excel/ZIP and run 4-layer validation review (FR-001)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'projectPublicId',
    description: 'UUIDv7 publicId ของโครงการปลายทาง',
    required: true,
  })
  @ApiQuery({
    name: 'targetMode',
    description: 'MIGRATION_STAGING หรือ DIRECT_IMPORT',
    required: true,
  })
  @ApiQuery({
    name: 'aiProvider',
    description: 'LOCAL_OLLAMA (default), GEMINI, CLAUDE',
    required: false,
  })
  @ApiQuery({
    name: 'nasFolderPath',
    description:
      'พาธโฟลเดอร์ Staging PDF บน NAS (MIGRATION_STAGING เท่านั้น) — ใช้แทน .zip',
    required: false,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext =
          '.' + (file.originalname.split('.').pop() ?? '').toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `นามสกุลไฟล์ "${ext}" ไม่รองรับ — รองรับเฉพาะ .xlsx และ .zip`
            ),
            false
          );
        }
      },
    })
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'ไฟล์ Excel (.xlsx) หรือ ZIP (.zip) ที่มี Excel + PDFs',
        },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async check(
    @Query() dto: CheckImportReviewDto,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: User
  ): Promise<Awaited<ReturnType<ExcelDataReviewService['check']>>> {
    if (!file) {
      throw new BadRequestException('ต้องแนบไฟล์ (file) มากับทุก request');
    }

    // ดึงสิทธิ์ทั้งหมดของ User (pattern เดียวกับ workflow-transition.guard.ts)
    const permissions = await this.userService.getUserPermissions(user.user_id);
    const isSuperadmin = permissions.includes('system.manage_all');
    const isOrgAdmin = permissions.includes('organization.manage_members');
    const isAdmin = isSuperadmin || isOrgAdmin;

    // RBAC เพิ่มเติม: MIGRATION_STAGING สงวนไว้ให้ Admin เท่านั้น (FR-018, D7)
    if (dto.targetMode === 'MIGRATION_STAGING' && !isAdmin) {
      throw new ForbiddenException(
        'โหมด MIGRATION_STAGING สงวนไว้สำหรับผู้ดูแลระบบ (Superadmin, Org Admin) เท่านั้น — Document Control ใช้ DIRECT_IMPORT'
      );
    }

    // RBAC เพิ่มเติม: External AI สงวนไว้ให้ Admin เท่านั้น (FR-008, D2)
    if (dto.aiProvider !== 'LOCAL_OLLAMA' && !isAdmin) {
      throw new ForbiddenException(
        'การใช้ External AI (GEMINI/CLAUDE) สงวนไว้สำหรับผู้ดูแลระบบเท่านั้น — Document Controller ใช้ LOCAL_OLLAMA เท่านั้น'
      );
    }

    this.logger.log(
      `check: user=${user.publicId}, project=${dto.projectPublicId}, mode=${dto.targetMode}, ai=${dto.aiProvider}, batch=${dto.batchStrategy}, file=${file.originalname}`
    );

    return this.reviewService.check({
      projectPublicId: dto.projectPublicId,
      targetMode: dto.targetMode,
      aiProvider: dto.aiProvider,
      batchStrategy: dto.batchStrategy,
      uploadedBy: user.publicId,
      file: {
        originalname: file.originalname,
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
      },
      nasFolderPath: dto.nasFolderPath,
    });
  }

  /**
   * GET /api/v1/correspondence/import-review/:sessionId/status
   * อ่านสถานะของ review session (async pattern — ADR-008)
   * Frontend poll endpoint นี้จนกว่า status จะเป็น READY/FAILED
   */
  @Get(':sessionId/status')
  @RequirePermission('correspondence.import_review')
  @ApiOperation({
    summary: 'Poll review session status (async pattern — ADR-008)',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'UUIDv7 reviewSessionPublicId',
    type: String,
  })
  async getStatus(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string
  ): Promise<Awaited<ReturnType<ExcelDataReviewService['getStatus']>>> {
    return this.reviewService.getStatus(sessionId);
  }

  /**
   * GET /api/v1/correspondence/import-review/:sessionId/download-annotated
   * ดาวน์โหลดไฟล์ .xlsx ฉบับ annotated (FR-013, D4)
   */
  @Get(':sessionId/download-annotated')
  @RequirePermission('correspondence.import_review')
  @ApiOperation({
    summary: 'Download annotated Excel file with AI suggestions (FR-013, D4)',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'UUIDv7 reviewSessionPublicId จาก POST /check',
  })
  async downloadAnnotated(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Res() res: Response,
    @CurrentUser() user: User
  ): Promise<void> {
    this.logger.log(
      `downloadAnnotated: user=${user.publicId}, session=${sessionId}`
    );

    const { filePath, originalFileName } =
      await this.reviewService.getAnnotatedFilePath(sessionId);

    // ตั้งค่า headers สำหรับดาวน์โหลด .xlsx
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(originalFileName)}"`
    );

    // สตรีมไฟล์ไปยัง client
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err: unknown) => {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.error(
        `stream ไฟล์ annotated ล้มเหลว: session=${sessionId}, ${detail}`
      );
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'ไม่สามารถสตรีมไฟล์ได้ — กรุณาลองใหม่',
        });
      }
    });
  }

  /**
   * POST /api/v1/correspondence/import-review/:sessionId/confirm
   * ยืนยันการนำเข้าข้อมูล (T022, FR-014, FR-015, FR-016, FR-017)
   */
  @Post(':sessionId/confirm')
  @RequirePermission('correspondence.import_review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirm import — re-validate + DB commit + stash cleanup (FR-014, FR-015, FR-016, FR-017)',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'UUIDv7 reviewSessionPublicId จาก POST /check',
  })
  async confirm(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: User
  ): Promise<Awaited<ReturnType<ExcelDataReviewService['confirm']>>> {
    this.logger.log(`confirm: user=${user.publicId}, session=${sessionId}`);
    return this.reviewService.confirm({
      reviewSessionPublicId: sessionId,
      confirmedBy: user.publicId,
    });
  }

  /**
   * POST /api/v1/correspondence/import-review/:sessionId/cancel
   * ยกเลิกการนำเข้าข้อมูล + ลบ stash ทันที (T022, FR-016)
   */
  @Post(':sessionId/cancel')
  @RequirePermission('correspondence.import_review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel import — immediate stash cleanup (FR-016)',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'UUIDv7 reviewSessionPublicId จาก POST /check',
  })
  async cancel(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @CurrentUser() user: User
  ): Promise<Awaited<ReturnType<ExcelDataReviewService['cancel']>>> {
    this.logger.log(`cancel: user=${user.publicId}, session=${sessionId}`);
    return this.reviewService.cancel({
      reviewSessionPublicId: sessionId,
      cancelledBy: user.publicId,
    });
  }

  /**
   * GET /api/v1/correspondence/import-review/:sessionId/download-failed-rows
   * ดาวน์โหลดไฟล์ failed_rows.xlsx ที่ถูกย้ายไป quarantine area หลัง confirm (D6)
   */
  @Get(':sessionId/download-failed-rows')
  @RequirePermission('correspondence.import_review')
  @ApiOperation({
    summary:
      'Download failed_rows.xlsx from quarantine area (D6, MIGRATION_STAGING)',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'UUIDv7 reviewSessionPublicId จาก POST /check',
  })
  async downloadFailedRows(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Res() res: Response,
    @CurrentUser() user: User
  ): Promise<void> {
    this.logger.log(
      `downloadFailedRows: user=${user.publicId}, session=${sessionId}`
    );

    const { filePath } =
      await this.reviewService.getFailedRowsFilePath(sessionId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="failed_rows-${sessionId}.xlsx"`
    );

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err: unknown) => {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.error(
        `stream ไฟล์ failed_rows ล้มเหลว: session=${sessionId}, ${detail}`
      );
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          message: 'ไม่สามารถสตรีมไฟล์ได้ — กรุณาลองใหม่',
        });
      }
    });
  }
}
