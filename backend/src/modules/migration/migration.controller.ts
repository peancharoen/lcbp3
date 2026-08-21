// File: backend/src/modules/migration/migration.controller.ts
// Change Log:
// - 2026-08-06: Initial creation with resolution & review endpoints
// - 2026-08-20: Added Streaming Legacy Ingestion & OCR sync endpoints (ADR-047)

import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  UseGuards,
  Get,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  Patch,
  HttpCode,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

/**
 * Minimal shape of a Multer file object (avoids relying on global Express.Multer
 * namespace augmentation which some IDEs/linters fail to resolve).
 */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}
import { MigrationService } from './migration.service';
import { MigrationReviewService } from './migration-review.service';
import { LegacyIngestionService } from './services/legacy-ingestion.service';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { EnqueueMigrationDto } from './dto/enqueue-migration.dto';
import { CommitBatchDto } from './dto/commit-batch.dto';
import { CreateMigrationErrorDto } from './dto/create-migration-error.dto';
import { ResolveBatchDto } from './dto/resolve-batch.dto';
import { TriggerRagBatchDto } from './dto/trigger-rag-batch.dto';
import { StartIngestDto } from './dto/start-ingest.dto';
import { UpdateQueueOcrDto } from './dto/update-queue-ocr.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../user/entities/user.entity';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { MigrationQueueQueryDto } from './dto/migration-queue-query.dto';
import { MetadataResolutionService } from './services/metadata-resolution.service';
import { ReviewThresholdService } from './services/review-threshold.service';
import { RagBatchService } from './services/rag-batch.service';
import { ValidationException } from '../../common/exceptions';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  ENV_LEGACY_NAS_PATH,
  LEGACY_NAS_PATH_DEFAULT,
} from './constants/migration.constants';

/**
 * Helper: บังคับให้ user ต้องมี user_id จริง (ADR-016)
 * ห้ามใช้ hardcoded fallback เพราะจะทำให้ audit log ระบุตัวตนผิด
 */
function requireUserId(user: User | undefined): number {
  if (!user?.user_id) {
    throw new UnauthorizedException(
      'Authentication context missing user identity'
    );
  }
  return user.user_id;
}

/**
 * Helper: บังคับ Idempotency-Key header จริง (ADR-016)
 */
function requireIdempotencyKey(key: string | undefined): string {
  if (!key) {
    throw new ValidationException('Idempotency-Key header is required');
  }
  return key;
}

// ADR-047: Recursive tree node สำหรับ Legacy NAS folder tree view
interface LegacyFolderTreeNode {
  name: string;
  path: string;
  children: LegacyFolderTreeNode[];
}

@ApiTags('Migration')
@ApiBearerAuth()
@Controller('migration')
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  constructor(
    private readonly migrationService: MigrationService,
    private readonly migrationReviewService: MigrationReviewService,
    private readonly metadataResolutionService: MetadataResolutionService,
    private readonly reviewThresholdService: ReviewThresholdService,
    private readonly ragBatchService: RagBatchService,
    private readonly legacyIngestionService: LegacyIngestionService
  ) {}

  @Post('import')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.import')
  @ApiOperation({
    summary: 'Import generic legacy correspondence record via n8n integration',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description:
      'Unique key per document and batch to prevent duplicate inserts',
    required: true,
  })
  async importCorrespondence(
    @Body() dto: ImportCorrespondenceDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    const userId = requireUserId(user);
    const key = requireIdempotencyKey(idempotencyKey);
    return this.migrationService.importCorrespondence(dto, key, userId);
  }

  @Post('commit_batch')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.commit')
  @ApiOperation({
    summary:
      'Batch approve and import migration review queue items (ADR-019: queuePublicId)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description:
      'Unique key for the entire batch to prevent duplicate execution',
    required: true,
  })
  async commitBatch(
    @Body() dto: CommitBatchDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    const userId = requireUserId(user);
    const key = requireIdempotencyKey(idempotencyKey);
    return this.migrationService.commitBatch(dto, key, userId);
  }

  @Post('queue')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.enqueue')
  @ApiOperation({
    summary: 'Enqueue a record into the staging migration review queue',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key per enqueue request to prevent duplicate records',
    required: true,
  })
  async enqueueRecord(
    @Body() dto: EnqueueMigrationDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    requireIdempotencyKey(idempotencyKey);
    return this.migrationService.enqueueRecord(dto);
  }

  @Get('queue')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.view')
  @ApiOperation({ summary: 'Get migration review queue' })
  async getReviewQueue(@Query() query: MigrationQueueQueryDto) {
    return this.migrationService.getReviewQueue(query);
  }

  @Get('queue/:publicId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.view')
  @ApiOperation({ summary: 'Get a specific queue item by publicId (ADR-019)' })
  @ApiParam({ name: 'publicId', type: String, format: 'uuid' })
  async getQueueItemByPublicId(
    @Param('publicId', ParseUUIDPipe) publicId: string
  ) {
    return this.migrationService.getQueueItemByPublicId(publicId);
  }

  @Post('errors')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.error_log')
  @ApiOperation({ summary: 'Log a migration error from n8n workflow' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key per error log to prevent duplicate entries',
    required: true,
  })
  async createError(
    @Body() dto: CreateMigrationErrorDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    requireIdempotencyKey(idempotencyKey);
    return this.migrationService.createError(dto);
  }

  @Get('errors')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.view')
  @ApiOperation({ summary: 'Get migration errors' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getErrors(
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.migrationService.getErrors(page, limit);
  }

  @Post('queue/:publicId/approve')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.commit')
  @ApiOperation({ summary: 'Approve and import a queued migration item' })
  @ApiParam({ name: 'publicId', type: String, format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description:
      'Unique key per document and batch to prevent duplicate inserts',
    required: true,
  })
  async approveQueueItem(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: ImportCorrespondenceDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    const userId = requireUserId(user);
    const key = requireIdempotencyKey(idempotencyKey);
    return this.migrationService.approveQueueItemByPublicId(
      publicId,
      dto,
      key,
      userId
    );
  }

  @Post('queue/:publicId/reject')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.commit')
  @ApiOperation({ summary: 'Reject a queued migration item' })
  @ApiParam({ name: 'publicId', type: String, format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique key per rejection to prevent duplicate state changes (ADR-016)',
  })
  async rejectQueueItem(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    requireIdempotencyKey(idempotencyKey);
    const userId = requireUserId(user);
    return this.migrationService.rejectQueueItemByPublicId(publicId, userId);
  }

  @Get('staging-file')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.view')
  @ApiOperation({
    summary: 'Stream a file from staging (path-traversal guarded)',
  })
  @ApiQuery({ name: 'path', required: true, type: String })
  getStagingFile(@Query('path') filePath: string, @Res() res: Response) {
    const stream = this.migrationService.getStagingFileStream(filePath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="document.pdf"',
    });
    stream.pipe(res);
  }

  // Feature 242 — T049: POST /api/migration/resolve-batch (FR-020, FR-029)
  @Post('resolve-batch')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'Batch resolve register-derived reference data (FR-017, FR-018, FR-019, FR-020)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique key for batch resolution to prevent duplicate execution (FR-029)',
  })
  async resolveBatch(
    @Body() dto: ResolveBatchDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    requireIdempotencyKey(idempotencyKey);
    const userId = requireUserId(user);
    this.logger.log(
      `resolveBatch called by user [${userId}] for batch [${dto.batchId}]`
    );
    return this.metadataResolutionService.resolveBatch(dto.batchId);
  }

  // Feature 242 — T033: GET /api/migration/review-thresholds (admin-only)
  @Get('review-thresholds')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary: 'Get current review thresholds (maxMismatchFields, minConfidence)',
  })
  async getReviewThresholds() {
    return this.reviewThresholdService.getThresholds();
  }

  // Feature 242 — T033: PATCH /api/migration/review-thresholds (admin-only)
  @Patch('review-thresholds')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'Update review thresholds (admin-only, validates ranges, invalidates cache)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique key for threshold update to prevent duplicate execution',
  })
  async updateReviewThresholds(
    @Body() body: { maxMismatchFields?: number; minConfidence?: number },
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    requireIdempotencyKey(idempotencyKey);
    const userId = requireUserId(user);
    return this.reviewThresholdService.updateThresholds(
      {
        maxMismatchFields: body.maxMismatchFields,
        minConfidence: body.minConfidence,
      },
      userId
    );
  }

  // Feature 242 — T054: POST /api/migration/trigger-rag-batch (FR-026b)
  @Post('trigger-rag-batch')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'Trigger RAG batch embedding for committed attachments with persisted OCR text (FR-021, FR-026)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique key for RAG batch trigger to prevent duplicate execution (FR-029)',
  })
  @HttpCode(202)
  async triggerRagBatch(
    @Body() dto: TriggerRagBatchDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    requireIdempotencyKey(idempotencyKey);
    const userId = requireUserId(user);
    this.logger.log(
      `triggerRagBatch called by user [${userId}] for batch [${dto.batchId}]`
    );
    return this.ragBatchService.triggerRagBatch(dto.batchId);
  }

  // ADR-047: Streaming Legacy Ingestion API Endpoints
  @Post('ingest/upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.import')
  @ApiOperation({
    summary: 'Upload Excel file for legacy document ingestion (ADR-047)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadExcelFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({
            fileType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        ],
      })
    )
    file: MulterFile
  ) {
    return {
      message: 'File uploaded successfully',
      filePath: file.path,
      originalFilename: file.originalname,
      size: file.size,
    };
  }

  @Post('ingest/start')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.import')
  @ApiOperation({
    summary: 'Start streaming legacy ingestion from Excel file (ADR-047)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique key per batch ingestion request to prevent duplicate triggers',
  })
  @HttpCode(202)
  startIngestion(
    @Body() dto: StartIngestDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    requireIdempotencyKey(idempotencyKey);
    // สร้าง batchId ล่วงหน้าเพื่อส่งกลับทันที (ป้องกัน 'GENERATING' สับสน)
    const batchId = dto.batchId || `BATCH-${Date.now()}`;
    dto.batchId = batchId;

    // รันการ Ingest เบื้องหลัง และตอบกลับผลลัพธ์ทันที (ADR-008: BullMQ-style background)
    const summaryPromise = this.legacyIngestionService.startIngestion(dto);
    summaryPromise.catch((err: unknown) => {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Background ingestion failed for batch [${batchId}]: ${errMsg}`
      );
    });

    return {
      message: 'Legacy ingestion process started successfully in background',
      batchId,
      filePath: dto.filePath,
    };
  }

  @Patch('queue/:publicId/ocr')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.commit')
  @ApiOperation({
    summary:
      'Update OCR text for a staging document and trigger RAG re-embedding (ADR-042/047)',
  })
  @ApiParam({
    name: 'publicId',
    description: 'UUIDv7 of the migration review queue item',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique key per OCR update to prevent duplicate re-embedding (ADR-016)',
  })
  async updateQueueOcr(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: UpdateQueueOcrDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    requireIdempotencyKey(idempotencyKey);
    const userId = requireUserId(user);
    return this.migrationReviewService.updateQueueOcr(publicId, dto, userId);
  }

  // ADR-047: List ไฟล์ Excel (.xlsx) จาก Legacy NAS สำหรับหน้า Legacy Management
  @Get('legacy-files')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.view')
  @ApiOperation({
    summary: 'List Excel (.xlsx) files from Legacy NAS folder (ADR-047)',
  })
  listLegacyExcelFiles() {
    const basePath =
      process.env[ENV_LEGACY_NAS_PATH] || LEGACY_NAS_PATH_DEFAULT;

    if (!fs.existsSync(basePath)) {
      this.logger.warn(`Legacy NAS path not found: ${basePath}`);
      return { files: [] };
    }

    try {
      const entries = fs.readdirSync(basePath, { withFileTypes: true });
      const xlsxFiles = entries
        .filter(
          (entry) =>
            entry.isFile() &&
            (entry.name.toLowerCase().endsWith('.xlsx') ||
              entry.name.toLowerCase().endsWith('.xls'))
        )
        .map((entry) => ({
          filename: entry.name,
          fullPath: path.join(basePath, entry.name),
          size: fs.statSync(path.join(basePath, entry.name)).size,
        }))
        .sort((a, b) => a.filename.localeCompare(b.filename));

      return { files: xlsxFiles };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to list legacy Excel files: ${errMsg}`);
      return { files: [] };
    }
  }

  // ADR-047: List โฟลเดอร์ย่อยจาก Legacy NAS สำหรับเลือก Staging PDF folder
  // แสดงเป็น tree structure (recursive) สำหรับ frontend tree view
  @Get('legacy-folders')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('migration.view')
  @ApiOperation({
    summary:
      'List subdirectories (recursive tree) from Legacy NAS folder for Staging PDF selection (ADR-047)',
  })
  listLegacyFolders() {
    const basePath = path.resolve(
      process.env[ENV_LEGACY_NAS_PATH] || LEGACY_NAS_PATH_DEFAULT
    );

    if (!fs.existsSync(basePath)) {
      this.logger.warn(`Legacy NAS path not found: ${basePath}`);
      return { tree: [] };
    }

    // ADR-047: Recursive tree node สำหรับ frontend tree view
    const MAX_DEPTH = 5;
    const buildTree = (
      currentPath: string,
      depth: number
    ): LegacyFolderTreeNode[] => {
      if (depth >= MAX_DEPTH) return [];

      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        const nodes: LegacyFolderTreeNode[] = [];
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const childPath = path.resolve(currentPath, entry.name);
          // ADR-016: path traversal guard — child ต้องอยู่ใต้ basePath เสมอ
          const relative = path.relative(basePath, childPath);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            continue;
          }
          nodes.push({
            name: entry.name,
            path: childPath,
            children: buildTree(childPath, depth + 1),
          });
        }
        return nodes.sort((a, b) => a.name.localeCompare(b.name));
      } catch {
        return [];
      }
    };

    try {
      const tree = buildTree(basePath, 0);
      return { tree };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to list legacy folders: ${errMsg}`);
      return { tree: [] };
    }
  }
}
