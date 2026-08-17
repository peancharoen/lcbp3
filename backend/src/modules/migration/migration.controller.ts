import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  Get,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  Patch,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { MigrationService } from './migration.service';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { EnqueueMigrationDto } from './dto/enqueue-migration.dto';
import { CommitBatchDto } from './dto/commit-batch.dto';
import { CreateMigrationErrorDto } from './dto/create-migration-error.dto';
import { ResolveBatchDto } from './dto/resolve-batch.dto';
import { TriggerRagBatchDto } from './dto/trigger-rag-batch.dto';
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
} from '@nestjs/swagger';
import { MigrationQueueQueryDto } from './dto/migration-queue-query.dto';
import { MetadataResolutionService } from './services/metadata-resolution.service';
import { ReviewThresholdService } from './services/review-threshold.service';
import { RagBatchService } from './services/rag-batch.service';
import { ValidationException } from '../../common/exceptions';
import type { Response } from 'express';

/**
 * Helper: บังคับให้ user ต้องมี user_id จริง (ADR-016)
 * ห้ามใช้ hardcoded fallback (เช่น `|| 5`) เพราะจะทำให้ audit log
 * ระบุตัวตนผิดและ bypass RBAC ได้
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
 * ใช้ร่วมกับ @ApiHeader({ required: true }) และส่งเข้า service
 * เพื่อบันทึกลง import_transactions ป้องกัน duplicate submit
 */
function requireIdempotencyKey(key: string | undefined): string {
  if (!key) {
    throw new ValidationException('Idempotency-Key header is required');
  }
  return key;
}

@ApiTags('Migration')
@ApiBearerAuth()
@Controller('migration')
export class MigrationController {
  constructor(
    private readonly migrationService: MigrationService,
    private readonly metadataResolutionService: MetadataResolutionService,
    private readonly reviewThresholdService: ReviewThresholdService,
    private readonly ragBatchService: RagBatchService
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
    summary: 'Batch approve and import migration review queue items',
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
  async enqueueRecord(@Body() dto: EnqueueMigrationDto) {
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
  async createError(@Body() dto: CreateMigrationErrorDto) {
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
  async rejectQueueItem(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @CurrentUser() user: User
  ) {
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
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    requireIdempotencyKey(idempotencyKey);
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
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    requireIdempotencyKey(idempotencyKey);
    return this.ragBatchService.triggerRagBatch(dto.batchId);
  }
}
