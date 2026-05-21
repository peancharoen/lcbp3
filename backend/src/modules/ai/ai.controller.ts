// File: src/modules/ai/ai.controller.ts
// Change Log
// - 2026-05-14: เพิ่ม Legacy Migration staging endpoints ตาม ADR-023.
// - 2026-05-14: ย้าย DeleteAuditLogsQueryDto ไป dto/ folder; ลบ authHeader passthrough (🟢 LOW-1/LOW-2).
// - 2026-05-19: เพิ่ม POST /ai/intent endpoint สำหรับ AI Tool Layer (ADR-025).
// - 2026-05-21: เพิ่ม AI Admin settings endpoints และ AiEnabledGuard สำหรับ ADR-027.
// - 2026-05-21: เพิ่ม GET /ai/admin/health สำหรับดึงสถานะสุขภาพ AI Infrastructure (T028).
// - 2026-05-21: เพิ่ม POST /ai/admin/sandbox/extract endpoint สำหรับ Superadmin OCR sandbox (T041 & T042)
// - 2026-05-21: แก้ไขข้อห้ามใช้ parseInt โดยการใช้ Number แทนตามกฎ Tier 1
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
  UploadedFile,
  HttpException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
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
import { AiSettingsService } from './ai-settings.service';
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
import { AiToolRegistryService } from './tool/ai-tool-registry.service';
import { AiIntentRequestDto } from './dto/ai-intent-request.dto';
import { ToggleAiFeaturesDto } from './dto/ai-admin-settings.dto';
import { AiEnabledGuard } from './guards/ai-enabled.guard';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { FileStorageService } from '../../common/file-storage/file-storage.service';

@ApiTags('AI Gateway')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiIngestService: AiIngestService,
    private readonly aiRagService: AiRagService,
    private readonly aiQueueService: AiQueueService,
    private readonly aiSettingsService: AiSettingsService,
    private readonly aiToolRegistryService: AiToolRegistryService,
    private readonly fileStorageService: FileStorageService,
    @InjectRedis() private readonly redis: Redis
  ) {}

  // --- Real-time Extraction (User Upload) ---

  // ─── AI Tool Layer Endpoint (ADR-025) ──────────────────────────────────────

  @Post('intent')
  @UseGuards(JwtAuthGuard, AiEnabledGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.suggest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI Intent Dispatch — ส่ง Intent ไปยัง Tool Registry (ADR-025)',
    description:
      'รับ intent code + projectPublicId แล้ว dispatch ไปยัง Tool Handler ที่ตรงกัน พร้อม CASL enforcement',
  })
  async dispatchIntent(
    @Body() dto: AiIntentRequestDto,
    @CurrentUser() user: User
  ): Promise<{
    ok: boolean;
    data?: unknown;
    reason?: string;
    message?: string;
  }> {
    const result = await this.aiToolRegistryService.dispatch(dto.intent, {
      requestUser: user,
      projectPublicId: dto.projectPublicId,
      params: dto.params,
    });
    if (result.ok) {
      return { ok: true, data: result.data };
    }
    return { ok: false, reason: result.reason, message: result.message };
  }

  // ---------------------------------------------------------------------------

  @Post('suggest')
  @UseGuards(JwtAuthGuard, AiEnabledGuard, RbacGuard)
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
  @UseGuards(JwtAuthGuard, AiEnabledGuard, RbacGuard)
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

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AI Status — อ่านสถานะเปิด/ปิด AI features สำหรับผู้ใช้ที่ล็อกอิน',
  })
  async getAiStatus(): Promise<{ aiFeaturesEnabled: boolean }> {
    const aiFeaturesEnabled =
      await this.aiSettingsService.getAiFeaturesEnabled();
    return { aiFeaturesEnabled };
  }

  // --- AI Admin Console Settings (ADR-027) ---

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary: 'AI Admin Settings — อ่านสถานะเปิด/ปิด AI features',
  })
  async getAiAdminSettings(): Promise<{ aiFeaturesEnabled: boolean }> {
    const aiFeaturesEnabled =
      await this.aiSettingsService.getAiFeaturesEnabled();
    return { aiFeaturesEnabled };
  }

  @Post('admin/toggle')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI Admin Toggle — เปิด/ปิด AI features สำหรับผู้ใช้ทั่วไป',
  })
  async toggleAiFeatures(
    @Body() dto: ToggleAiFeaturesDto,
    @CurrentUser() user: User
  ): Promise<{ aiFeaturesEnabled: boolean }> {
    const aiFeaturesEnabled = await this.aiSettingsService.setAiFeaturesEnabled(
      dto.enabled,
      user.user_id
    );
    return { aiFeaturesEnabled };
  }

  @Get('admin/health')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'AI System Health — ดึงสถานะสุขภาพ Ollama, Qdrant และ BullMQ queues',
  })
  async getAiSystemHealth() {
    return this.aiService.getSystemHealth();
  }

  @Post('admin/sandbox/rag')
  @UseGuards(JwtAuthGuard, AiEnabledGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'AI Admin Sandbox RAG Query — ส่ง sandbox RAG เข้า queue ai-batch (T035)',
    description:
      'รัน RAG query สำหรับ Superadmin ใน sandbox environment เพื่อคุมทรัพยากร',
  })
  async submitSandboxRagQuery(
    @Body() dto: AiRagQueryDto,
    @CurrentUser() user: User
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> {
    const userPublicId = String(user.publicId ?? user.user_id);
    const activeJob = await this.aiRagService.getActiveJob(userPublicId);
    if (activeJob) {
      return { requestPublicId: activeJob, jobId: activeJob, status: 'queued' };
    }
    const requestPublicId = uuidv7();
    await this.aiRagService.registerActiveJob(userPublicId, requestPublicId);
    const jobId = await this.aiQueueService.enqueueSandboxJob('sandbox-rag', {
      idempotencyKey: requestPublicId,
      projectPublicId: dto.projectPublicId,
      query: dto.question,
      userPublicId,
    });
    return { requestPublicId, jobId, status: 'queued' };
  }

  @Get('admin/sandbox/job/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'AI Admin Sandbox Job Status — ตรวจสอบสถานะ RAG sandbox job (T036)',
  })
  @ApiParam({
    name: 'id',
    description: 'requestPublicId (UUID) ของ sandbox job ที่ส่งคำขอ',
  })
  async getSandboxJobStatus(@Param('id', ParseUuidPipe) id: string) {
    const result = await this.aiRagService.getJobResult(id);
    if (!result) {
      return { requestPublicId: id, status: 'not_found' };
    }
    return result;
  }

  @Post('admin/sandbox/extract')
  @UseGuards(JwtAuthGuard, AiEnabledGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'AI Admin Sandbox OCR Extract — อัปโหลดไฟล์เพื่อทำ OCR Sandbox (T041 & T042)',
    description:
      'รัน OCR Sandbox สำหรับ Superadmin โดยคิว batchQueue ควบคุมอัตราการใช้งาน',
  })
  async submitSandboxExtract(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'pdf' }),
        ],
      })
    )
    file: Express.Multer.File,
    @CurrentUser() user: User
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> {
    const queueSize = await this.aiQueueService.getBatchQueueSize();
    if (queueSize >= 3) {
      const rateKey = `ai:sandbox:rate:${String(user.user_id)}`;
      const countStr = await this.redis.get(rateKey);
      const count = countStr ? Number(countStr) : 0;
      if (count >= 10) {
        throw new HttpException(
          'Rate limit exceeded. Capped at 10 requests per hour when the queue is busy.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      if (!countStr) {
        await this.redis.setex(rateKey, 3600, '1');
      } else {
        await this.redis.incr(rateKey);
      }
    }
    const attachment = await this.fileStorageService.upload(file, user.user_id);
    const requestPublicId = uuidv7();
    const jobId = await this.aiQueueService.enqueueSandboxJob(
      'sandbox-extract',
      {
        idempotencyKey: requestPublicId,
        pdfPath: attachment.filePath,
      }
    );
    return { requestPublicId, jobId, status: 'queued' };
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
  @UseGuards(JwtAuthGuard, AiEnabledGuard, RbacGuard)
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
