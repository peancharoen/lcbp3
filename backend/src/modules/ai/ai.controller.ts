// File: src/modules/ai/ai.controller.ts
// Change Log
// - 2026-05-14: เพิ่ม Legacy Migration staging endpoints ตาม ADR-023.
// - 2026-05-14: ย้าย DeleteAuditLogsQueryDto ไป dto/ folder; ลบ authHeader passthrough (🟢 LOW-1/LOW-2).
// Controller สำหรับ AI Gateway Endpoints (ADR-023)

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AiService, ExtractionResult, PaginatedResult } from './ai.service';
import {
  AiIngestService,
  MigrationReviewResponse,
  PaginatedMigrationReviewResponse,
} from './ai-ingest.service';
import { AiRagService } from './ai-rag.service';
import { AiQueueService } from './ai-queue.service';
import { AiRagQueryDto } from './dto/ai-rag-query.dto';
import { ExtractDocumentDto } from './dto/extract-document.dto';
import { AiCallbackDto } from './dto/ai-callback.dto';
import { CreateAiJobDto } from './dto/create-ai-job.dto';
import { MigrationUpdateDto } from './dto/migration-update.dto';
import { MigrationQueryDto } from './dto/migration-query.dto';
import {
  ApproveLegacyMigrationDto,
  LegacyMigrationIngestDto,
  LegacyMigrationQueueQueryDto,
} from './dto/legacy-migration.dto';
import { MigrationLog } from './entities/migration-log.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../user/entities/user.entity';
import { ServiceAccountGuard } from './guards/service-account.guard';
import { v7 as uuidv7 } from 'uuid';
import { DeleteAuditLogsQueryDto } from './dto/delete-audit-logs.dto';

@ApiTags('AI Gateway')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiIngestService: AiIngestService,
    private readonly aiRagService: AiRagService,
    private readonly aiQueueService: AiQueueService
  ) {}

  // --- Real-time Extraction (User Upload) ---

  @Post('suggest')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.suggest')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'AI Suggest — enqueue metadata suggestion job',
    description:
      'รับ documentPublicId/projectPublicId แล้วส่งงานเข้า ai-realtime queue เพื่อให้ frontend polling สถานะ',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key เพื่อป้องกัน duplicate AI Suggest job',
    required: true,
  })
  async suggestDocumentMetadata(
    @Body() dto: CreateAiJobDto,
    @Headers('idempotency-key') idempotencyKey: string
  ): Promise<{ success: boolean; jobId?: string; status: string }> {
    const result = await this.aiService.queueSuggestJob({
      ...dto,
      jobType: 'ai-suggest',
      idempotencyKey: idempotencyKey || dto.idempotencyKey,
    });
    return {
      success: result.success,
      jobId: result.jobId,
      status: result.success ? 'queued' : 'failed',
    };
  }

  @Get('jobs/:jobId/status')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.suggest')
  @ApiOperation({
    summary: 'AI Job Status — polling endpoint สำหรับ AI Suggest',
  })
  @ApiParam({ name: 'jobId', description: 'BullMQ job id' })
  async getAiJobStatus(@Param('jobId') jobId: string) {
    return this.aiService.getAiJobStatus(jobId);
  }

  @Post('extract')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.extract')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Rate limit: 5 requests/minute (ADR-020)
  @ApiOperation({
    summary:
      'Real-time AI Extraction — สกัด Metadata จากเอกสารที่ผู้ใช้อัปโหลด',
    description:
      'ส่งเอกสารไปยัง AI Pipeline ผ่าน n8n และรอผลลัพธ์ (timeout 30s)',
  })
  async extractDocument(
    @Body() dto: ExtractDocumentDto,
    @CurrentUser() user: User
  ): Promise<ExtractionResult> {
    return this.aiService.extractRealtime(dto, user.user_id);
  }

  // --- Webhook Callback จาก n8n (Service Account) ---

  @Post('callback')
  @UseGuards(ServiceAccountGuard) // T029: กำหนด guard ที่ controller layer (ADR-016)
  @ApiOperation({
    summary: 'AI Callback Endpoint — รับผลลัพธ์จาก n8n หลัง AI ประมวลผลเสร็จ',
    description:
      'เรียกโดย n8n Service Account เท่านั้น ต้องใส่ Bearer Token ใน Authorization header',
  })
  @ApiHeader({
    name: 'Authorization',
    description:
      'Bearer {AI_N8N_SERVICE_TOKEN} — Service Account Token จาก n8n',
    required: true,
  })
  @ApiHeader({
    name: 'X-AI-Source',
    description: 'ระบุแหล่งที่มา เช่น ollama, n8n',
    required: false,
  })
  async handleCallback(
    @Body() dto: AiCallbackDto,
    @Headers('x-ai-source') aiSource: string
  ): Promise<{ message: string }> {
    await this.aiService.handleWebhookCallback(dto, aiSource ?? 'unknown');
    return { message: 'Callback processed successfully' };
  }

  // --- Admin: ดูรายการ MigrationLog ---

  @Get('migration')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('migration.read')
  @ApiOperation({
    summary: 'Admin: ดูรายการ MigrationLog ทั้งหมด',
    description: 'กรองตามสถานะและ Confidence Score พร้อม Pagination',
  })
  @ApiQuery({ name: 'status', required: false, description: 'กรองตามสถานะ' })
  @ApiQuery({
    name: 'minConfidence',
    required: false,
    type: Number,
    description: 'Confidence Score ขั้นต่ำ',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'หน้าที่ต้องการ',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'จำนวนรายการต่อหน้า',
  })
  async getMigrationList(
    @Query() query: MigrationQueryDto
  ): Promise<PaginatedResult<MigrationLog>> {
    return this.aiService.getMigrationList(query);
  }

  // --- Admin: อัปเดตสถานะ MigrationLog ---

  @Patch('migration/:publicId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('migration.approve')
  @ApiOperation({
    summary: 'Admin: อัปเดตสถานะ MigrationLog หลังตรวจสอบ',
    description:
      'Admin ยืนยัน (VERIFIED) หรือปฏิเสธ (FAILED) รายการ — ใช้ publicId (UUID)',
  })
  @ApiParam({
    name: 'publicId',
    description: 'UUID ของ MigrationLog (ADR-019)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key เพื่อป้องกัน Duplicate Update',
    required: true,
  })
  async updateMigration(
    @Param('publicId') publicId: string,
    @Body() dto: MigrationUpdateDto,
    @CurrentUser() user: User
  ): Promise<MigrationLog> {
    return this.aiService.updateMigrationLog(publicId, dto, user.user_id);
  }

  // ─── AI Audit Log Endpoints (Phase 5 — T026) ──────────────────────────────

  @Delete('audit-logs')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'AI Audit Log Hard Delete — ลบ log ถาวร (SYSTEM_ADMIN เท่านั้น) (T026)',
    description:
      'ต้องระบุ documentPublicId หรือ olderThanDays อย่างน้อยหนึ่งอย่าง',
  })
  async deleteAuditLogs(
    @Query() query: DeleteAuditLogsQueryDto
  ): Promise<{ deleted: number }> {
    return this.aiService.deleteAuditLogs({
      documentPublicId: query.documentPublicId,
      olderThanDays: query.olderThanDays,
    });
  }

  // ─── Phase 6: AI Analytics & Single Audit Log Delete (T036, T037) ────────

  @Get('analytics/summary')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.read_analytics')
  @ApiOperation({
    summary: 'AI Analytics Summary — สรุปสถิติ AI Audit Logs (T036)',
    description:
      'คำนวณ avgConfidence, overrideRate, rejectedRate แยกตาม document type และ overall',
  })
  async getAnalyticsSummary() {
    return this.aiService.getAnalyticsSummary();
  }

  @Delete('audit-logs/:publicId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.delete_audit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'AI Audit Log Single Delete — ลบ log เดี่ยวโดย publicId (SYSTEM_ADMIN เท่านั้น) (T037)',
    description:
      'ลบ AiAuditLog เดี่ยวและบันทึกใน audit_logs (action: AI_AUDIT_LOG_DELETED)',
  })
  @ApiParam({
    name: 'publicId',
    description: 'UUID ของ AiAuditLog (ADR-019)',
  })
  async deleteAuditLogByPublicId(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @CurrentUser() user: User
  ): Promise<{ deleted: boolean; publicId: string }> {
    return this.aiService.deleteAuditLogByPublicId(publicId, user.user_id);
  }

  // ─── RAG Query Endpoints (Phase 4 — FR-009, FR-010, FR-011) ────────────────

  @Post('rag/query')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Rate limit: 5 requests/minute per user (FR-010)
  @RequirePermission('rag.query')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'RAG Query — ส่ง query เข้า BullMQ เพื่อประมวลผลแบบ async (FR-009, FR-010)',
    description:
      'ส่งคำถาม RAG เข้าคิว BullMQ (concurrency=1 บน Desk-5439) แล้วคืน requestPublicId สำหรับ polling',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key สำหรับ request',
    required: true,
  })
  async submitRagQuery(
    @Body() dto: AiRagQueryDto,
    @CurrentUser() user: User,
    @Headers('idempotency-key') _idempotencyKey: string
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> {
    // ตรวจสอบว่า user มี active job อยู่แล้วหรือไม่ (FR-009: 1 active job per user)
    const activeJob = await this.aiRagService.getActiveJob(
      String(user.publicId ?? user.user_id)
    );
    if (activeJob) {
      return { requestPublicId: activeJob, jobId: '', status: 'queued' };
    }

    // สร้าง requestPublicId ใหม่ (ADR-019: UUID)
    const requestPublicId = uuidv7();
    const userPublicId = String(user.publicId ?? user.user_id);

    // ลงทะเบียน job ใน Redis ก่อนส่งเข้า BullMQ
    await this.aiRagService.registerActiveJob(userPublicId, requestPublicId);

    // ส่ง job เข้า BullMQ ตาม ADR-008
    const jobId = await this.aiQueueService.enqueueRagQuery({
      requestPublicId,
      userPublicId,
      projectPublicId: dto.projectPublicId,
      query: dto.question,
    });

    return { requestPublicId, jobId, status: 'queued' };
  }

  @Get('rag/jobs/:requestPublicId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('rag.query')
  @ApiOperation({
    summary: 'RAG Job Status — ดูสถานะและผลลัพธ์ของ RAG query (polling)',
  })
  @ApiParam({
    name: 'requestPublicId',
    description: 'requestPublicId จาก submit endpoint',
  })
  async getRagJobStatus(
    @Param('requestPublicId', ParseUuidPipe) requestPublicId: string
  ) {
    const result = await this.aiRagService.getJobResult(requestPublicId);
    if (!result) {
      return { requestPublicId, status: 'not_found' };
    }
    return result;
  }

  @Delete('rag/jobs/:requestPublicId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('rag.query')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'RAG Job Cancel — ยกเลิก RAG job ที่กำลังประมวลผล (T022, FR-011)',
  })
  @ApiParam({
    name: 'requestPublicId',
    description: 'requestPublicId ของ job ที่ต้องการยกเลิก',
  })
  async cancelRagJob(
    @Param('requestPublicId', ParseUuidPipe) requestPublicId: string
  ): Promise<void> {
    await this.aiRagService.cancelJob(requestPublicId);
  }

  @Post('legacy-migration/ingest')
  @UseGuards(ServiceAccountGuard)
  @UseInterceptors(FilesInterceptor('files', 25))
  @ApiOperation({
    summary: 'Legacy Migration: ingest PDF batch into AI staging queue',
  })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer {AI_N8N_SERVICE_TOKEN}',
    required: true,
  })
  async ingestLegacyMigration(
    @Body() dto: LegacyMigrationIngestDto,
    @UploadedFiles() files: Express.Multer.File[] = []
  ) {
    return this.aiIngestService.ingest(dto, files);
  }

  @Get('legacy-migration/queue')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.migration_manage')
  @ApiOperation({ summary: 'Legacy Migration: list AI staging queue records' })
  async getLegacyMigrationQueue(
    @Query() query: LegacyMigrationQueueQueryDto
  ): Promise<PaginatedMigrationReviewResponse> {
    return this.aiIngestService.listQueue(query);
  }

  @Post('legacy-migration/queue/:publicId/approve')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.migration_manage')
  @ApiOperation({ summary: 'Legacy Migration: approve AI staging record' })
  @ApiParam({ name: 'publicId', description: 'Migration review publicId' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key for this approval/import operation',
    required: true,
  })
  async approveLegacyMigrationRecord(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Body() dto: ApproveLegacyMigrationDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: User
  ): Promise<{ record: MigrationReviewResponse; importResult: unknown }> {
    return this.aiIngestService.approve(
      publicId,
      dto,
      idempotencyKey,
      user.user_id
    );
  }
}
