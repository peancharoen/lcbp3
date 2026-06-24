// File: backend/src/modules/ai/ai.controller.ts
// Change Log
// - 2026-05-14: เพิ่ม Legacy Migration staging endpoints ตาม ADR-023.
// - 2026-05-14: ย้าย DeleteAuditLogsQueryDto ไป dto/ folder; ลบ authHeader passthrough (🟢 LOW-1/LOW-2).
// - 2026-05-19: เพิ่ม POST /ai/intent endpoint สำหรับ AI Tool Layer (ADR-025).
// - 2026-05-21: เพิ่ม AI Admin settings endpoints และ AiEnabledGuard สำหรับ ADR-027.
// - 2026-05-21: เพิ่ม GET /ai/admin/health สำหรับดึงสถานะสุขภาพ AI Infrastructure (T028).
// - 2026-05-21: เพิ่ม POST /ai/admin/sandbox/extract endpoint สำหรับ Superadmin OCR sandbox (T041 & T042)
// - 2026-05-21: แก้ไขข้อห้ามใช้ parseInt โดยการใช้ Number แทนตามกฎ Tier 1
// - 2026-05-23: เพิ่ม Migration Checkpoint API endpoints แทน MySQL direct access (ADR-023A)
// - 2026-05-30: เพิ่ม @UseInterceptors(FileInterceptor('file')) ใน submitSandboxOcr เพื่อแก้ไขปัญหา BadRequestException (File is required)
// - 2026-05-30: เพิ่ม endpoints GET/POST/PATCH models และ GET vram/status สำหรับ dynamic AI model management และ VRAM monitoring (T031-T034, US2)
// - 2026-06-01: [BUGFIX] submitSandboxOcr: เพิ่ม @ApiBearerAuth(), @HttpCode(ACCEPTED), Body({ engineType }) และส่ง engineType ไปยัง enqueueSandboxJob
// - 2026-06-02: เพิ่ม REST endpoints ocr-engines สำหรับ OCR engine management (T003, T004, ADR-033)
// - 2026-06-06: [BUGFIX] เพิ่ม Throttle บน GET admin/sandbox/job/:id เพื่อแก้ ThrottlerException spam
// - 2026-06-11: แก้ไขการส่งพารามิเตอร์ให้กับ queueSuggestJob ใน suggestDocumentMetadata
// - 2026-06-13: T024-T026 — เพิ่ม sandbox parameter endpoints (GET/PUT/POST reset) ตาม ADR-036
// - 2026-06-13: T036, T037, T039, T040, T041 — เพิ่ม endpoints apply sandbox profile และ get production parameters พร้อม idempotency, CASL, validation และ audit
// - 2026-06-14: เพิ่ม POST /ai/admin/sandbox/rag-prep endpoint (T033)
// Controller สำหรับ AI Gateway Endpoints (ADR-023)

import {
  Controller,
  Post,
  Put,
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
  Optional,
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
  ApiConsumes,
  ApiBody,
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
import { SandboxRagPrepDto } from './dto/sandbox-rag-prep.dto';
import { ExtractDocumentDto } from './dto/extract-document.dto';
import { AiCallbackDto } from './dto/ai-callback.dto';
import { CreateAiJobDto } from './dto/create-ai-job.dto';
import { AiJobResponseDto } from './dto/ai-job-response.dto';
import { MigrationUpdateDto } from './dto/migration-update.dto';
import { MigrationQueryDto } from './dto/migration-query.dto';
import { ValidationException, SystemException } from '../../common/exceptions';
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
import { Audit } from '../../common/decorators/audit.decorator';
import { User } from '../user/entities/user.entity';
import { ServiceAccountGuard } from './guards/service-account.guard';
import { v7 as uuidv7 } from 'uuid';
import { DeleteAuditLogsQueryDto } from './dto/delete-audit-logs.dto';
import { AiToolRegistryService } from './tool/ai-tool-registry.service';
import { AiIntentRequestDto } from './dto/ai-intent-request.dto';
import { AddAiModelDto } from './dto/add-ai-model.dto';
import { ToggleAiFeaturesDto } from './dto/ai-admin-settings.dto';
import { AiEnabledGuard } from './guards/ai-enabled.guard';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { SandboxOcrEngineType } from './services/sandbox-ocr-engine.service';
import { AiMigrationCheckpointService } from './ai-migration-checkpoint.service';
import {
  MigrationErrorLogDto,
  MigrationQueueRecordDto,
  SaveCheckpointDto,
} from './dto/migration-checkpoint.dto';
import { OcrService } from './services/ocr.service';
import { OcrEngineResponseDto } from './dto/ocr-engine-response.dto';
import { OcrEngineConfiguration } from './entities/ocr-engine-configuration.entity';
import { AiPolicyService } from './services/ai-policy.service';
import {
  RuntimePolicy,
  ExecutionProfile,
} from './interfaces/execution-policy.interface';
import { AiExecutionProfilesService } from './services/ai-execution-profiles.service';
import { CreateExecutionProfileDto } from './dto/create-execution-profile.dto';
import { UpdateExecutionProfileDto } from './dto/update-execution-profile.dto';

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
    private readonly migrationCheckpointService: AiMigrationCheckpointService,
    private readonly aiPolicyService: AiPolicyService,
    private readonly aiExecutionProfilesService: AiExecutionProfilesService,
    @InjectRedis() private readonly redis: Redis,
    @Optional() private readonly ocrService?: OcrService
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
    const result = await this.aiService.queueSuggestJob(dto, idempotencyKey);
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

  @Post('jobs')
  @UseGuards(JwtAuthGuard, AiEnabledGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.suggest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit unified AI job — ส่งงานประมวลผล AI แบบรวมศูนย์',
    description:
      'รับชนิดงานและข้อมูลอ้างอิง เพื่อส่งงานประมวลผล AI เข้าคิว BullMQ',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key เพื่อป้องกัน duplicate AI job',
    required: true,
  })
  async submitUnifiedJob(
    @Body() dto: CreateAiJobDto,
    @Headers('idempotency-key') idempotencyKey: string
  ): Promise<AiJobResponseDto> {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }
    return this.aiService.submitUnifiedJob(dto, idempotencyKey);
  }

  @Get('jobs/:jobId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('ai.suggest')
  @ApiOperation({
    summary: 'AI Job Status polling by jobId',
  })
  @ApiParam({ name: 'jobId', description: 'BullMQ job id' })
  async getAiJobStatusById(@Param('jobId') jobId: string) {
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

  // ─── AI Model Management (ADR-027) ─────────────────────────────────────────

  @Get('admin/models')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary: 'AI Models — ดึงรายการโมเดล AI ทั้งหมดที่ใช้งานได้',
  })
  async getAvailableModels() {
    const models = await this.aiSettingsService.getAvailableModels();
    const activeModel = await this.aiSettingsService.getActiveModel();
    return { models, activeModel };
  }

  @Get('admin/models/active')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary: 'AI Active Model — ดึงโมเดล AI ที่ใช้งานอยู่ปัจจุบัน',
  })
  async getActiveModel() {
    const activeModel = await this.aiSettingsService.getActiveModel();
    return { activeModel };
  }

  @Post('admin/models/active')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI Set Active Model — ตั้งค่าโมเดล AI ที่ใช้งาน (global)',
  })
  async setActiveModel(
    @Body() dto: { modelName: string },
    @CurrentUser() user: User
  ) {
    const activeModel = await this.aiSettingsService.setActiveModel(
      dto.modelName,
      user.user_id
    );
    return { activeModel };
  }

  @Post('admin/models')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'AI Add Model — เพิ่มโมเดล AI ใหม่เข้าระบบ (Superadmin only)',
  })
  async addModel(
    @Body()
    dto: {
      modelName: string;
      modelVersion: string;
      description?: string;
      vramGb?: number;
    },
    @CurrentUser() user: User
  ) {
    const model = await this.aiSettingsService.addModel(dto, user.user_id);
    return { model };
  }

  @Patch('admin/models/:modelName/toggle')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI Toggle Model — เปลี่ยนสถานะ active/inactive ของโมเดล',
  })
  @ApiParam({
    name: 'modelName',
    description: 'ชื่อโมเดล เช่น gemma4:e4b',
  })
  async toggleModelActive(
    @Param('modelName') modelName: string,
    @CurrentUser() user: User
  ) {
    const model = await this.aiSettingsService.toggleModelActive(
      modelName,
      user.user_id
    );
    return { model };
  }

  @Delete('admin/models/:modelName')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'AI Remove Model — ลบโมเดล AI (soft delete)',
  })
  @ApiParam({
    name: 'modelName',
    description: 'ชื่อโมเดลที่ต้องการลบ',
  })
  async removeModel(
    @Param('modelName') modelName: string,
    @CurrentUser() user: User
  ): Promise<void> {
    await this.aiSettingsService.removeModel(modelName, user.user_id);
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
  @Throttle({ default: { limit: 300, ttl: 60000 } }) // 300 req/min — รองรับ admin polling ทุก 200ms
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
    @Body('projectPublicId') projectPublicId: string,
    @Body('contractPublicId') contractPublicId: string | undefined,
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
        projectPublicId,
        contractPublicId,
      }
    );
    return { requestPublicId, jobId, status: 'queued' };
  }

  // --- Step 1: OCR Only (สำหรับตรวจคุณภาพ OCR ก่อนทดสอบ AI) ---

  @Post('admin/sandbox/ocr')
  @UseGuards(JwtAuthGuard, AiEnabledGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Step 1: Run OCR Only — สำหรับตรวจคุณภาพ OCR ก่อนทดสอบ AI',
    description:
      'Upload PDF และรัน OCR เท่านั้น ไม่เรียก LLM — ผลลัพธ์ cache ไว้สำหรับ Step 2',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        engineType: {
          type: 'string',
          enum: ['auto', 'np-dms-ocr'],
          description: 'OCR engine ที่ต้องการใช้ (default: auto)',
        },
        temperature: {
          type: 'number',
          description:
            'np-dms-ocr temperature (0.0-1.0) — override Modelfile default (0.1)',
        },
        topP: {
          type: 'number',
          description:
            'np-dms-ocr top_p (0.0-1.0) — override Modelfile default (0.1)',
        },
        repeatPenalty: {
          type: 'number',
          description:
            'np-dms-ocr repeat_penalty — override Modelfile default (1.1)',
        },
      },
    },
  })
  async submitSandboxOcr(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(pdf|application\/pdf)/ }),
        ],
      })
    )
    file: Express.Multer.File,
    @Body('engineType') engineType: string | undefined,
    @Body('temperature') temperature: string | undefined,
    @Body('topP') topP: string | undefined,
    @Body('repeatPenalty') repeatPenalty: string | undefined,
    @CurrentUser() user: User
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> {
    const attachment = await this.fileStorageService.upload(file, user.user_id);
    const requestPublicId = uuidv7();
    // ตรวจสอบและ normalize engineType ให้เป็นค่าที่ valid
    const validEngineTypes = ['auto', 'np-dms-ocr'] as const;
    const resolvedEngineType: SandboxOcrEngineType = validEngineTypes.includes(
      engineType as SandboxOcrEngineType
    )
      ? (engineType as SandboxOcrEngineType)
      : 'auto';
    // แปลง string จาก multipart form เป็น number (optional override)
    const ocrOptions = {
      ...(temperature !== undefined && {
        temperature: parseFloat(temperature),
      }),
      ...(topP !== undefined && { topP: parseFloat(topP) }),
      ...(repeatPenalty !== undefined && {
        repeatPenalty: parseFloat(repeatPenalty),
      }),
    };
    const jobId = await this.aiQueueService.enqueueSandboxJob(
      'sandbox-ocr-only',
      {
        idempotencyKey: requestPublicId,
        pdfPath: attachment.filePath,
        engineType: resolvedEngineType,
        ...(Object.keys(ocrOptions).length > 0 && { ocrOptions }),
      }
    );
    return { requestPublicId, jobId, status: 'queued' };
  }

  // --- Step 2: AI Extraction (ใช้ OCR text ที่ cache จาก Step 1) ---

  @Post('admin/sandbox/ai-extract')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('system.manage_all')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Step 2: Run AI Extraction — ใช้ OCR text ที่ cache จาก Step 1',
    description:
      'รับ requestPublicId จาก Step 1 และ optional promptVersion แล้ว run LLM extraction',
  })
  async submitSandboxAiExtract(
    @Body()
    dto: {
      requestPublicId: string;
      promptVersion?: number;
      projectPublicId: string;
      contractPublicId?: string;
    }
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> {
    const {
      requestPublicId,
      promptVersion,
      projectPublicId,
      contractPublicId,
    } = dto;
    const jobId = await this.aiQueueService.enqueueSandboxJob(
      'sandbox-ai-extract',
      {
        idempotencyKey: requestPublicId,
        projectPublicId,
        contractPublicId,
        extraPayload: { promptVersion },
      }
    );
    return { requestPublicId, jobId, status: 'queued' };
  }

  @Post('admin/sandbox/rag-prep')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('system.manage_all')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Step 3: Run RAG Prep Sandbox testing (T033)',
    description:
      'รับข้อความ OCR และ profileId แล้วรัน semantic chunking และ embedding preview',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key เพื่อป้องกัน duplicate sandbox RAG Prep job',
    required: true,
  })
  async submitSandboxRagPrep(
    @Body() dto: SandboxRagPrepDto,
    @Headers('idempotency-key') idempotencyKey: string
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }
    const requestPublicId = idempotencyKey;
    const jobId = await this.aiQueueService.enqueueSandboxJob(
      'sandbox-rag-prep',
      {
        idempotencyKey: requestPublicId,
        extraPayload: { text: dto.text, profileId: dto.profileId },
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

  // ─── Execution Profiles Endpoints (US4 — T045-T048) ───────────────────────

  @Get('execution-profiles')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary: 'AI Execution Profiles — ดึงรายการโปรไฟล์การทำงานทั้งหมด (T045)',
  })
  async getExecutionProfiles() {
    return this.aiExecutionProfilesService.findAll();
  }

  @Post('execution-profiles')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'AI Create Execution Profile — สร้างโปรไฟล์การทำงานใหม่ (T046)',
  })
  async createExecutionProfile(
    @Body() dto: CreateExecutionProfileDto,
    @CurrentUser() user: User
  ) {
    return this.aiExecutionProfilesService.create(dto, user.user_id);
  }

  @Put('execution-profiles/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary: 'AI Update Execution Profile — อัปเดตโปรไฟล์การทำงาน (T047)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID ของโปรไฟล์ (INT)',
  })
  async updateExecutionProfile(
    @Param('id') id: string,
    @Body() dto: UpdateExecutionProfileDto,
    @CurrentUser() user: User
  ) {
    return this.aiExecutionProfilesService.update(
      Number(id),
      dto,
      user.user_id
    );
  }

  @Delete('execution-profiles/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'AI Delete Execution Profile — ลบโปรไฟล์การทำงาน (T048)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID ของโปรไฟล์ (INT)',
  })
  async deleteExecutionProfile(@Param('id') id: string): Promise<void> {
    await this.aiExecutionProfilesService.delete(Number(id));
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

  // ─── Migration Checkpoint API (ADR-023A) ──────────────────────────────────

  @Get('migration/checkpoint/:batchId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 500, ttl: 60000 } }) // 500 req/min for n8n workflow loop
  @ApiOperation({ summary: 'Migration: ดึง Checkpoint ของ Batch (ADR-023A)' })
  @ApiParam({
    name: 'batchId',
    description: 'Batch ID ที่ต้องการดึง Checkpoint',
  })
  async getMigrationCheckpoint(@Param('batchId') batchId: string) {
    return this.migrationCheckpointService.getCheckpoint(batchId);
  }

  @Post('migration/checkpoint')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 500, ttl: 60000 } }) // 500 req/min for n8n workflow loop
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Migration: บันทึก/อัพเดต Checkpoint (ADR-023A)' })
  async saveMigrationCheckpoint(@Body() dto: SaveCheckpointDto) {
    return this.migrationCheckpointService.saveCheckpoint(dto);
  }

  @Post('migration/queue/record')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 500, ttl: 60000 } }) // 500 req/min for n8n workflow loop
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Migration: บันทึกรายการเข้า Review Queue (ADR-023A)',
  })
  async upsertMigrationQueueRecord(@Body() dto: MigrationQueueRecordDto) {
    return this.migrationCheckpointService.upsertQueueRecord(dto);
  }

  @Post('migration/errors')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 500, ttl: 60000 } }) // 500 req/min for n8n workflow loop
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Migration: บันทึก Error Log (ADR-023A)' })
  async logMigrationError(@Body() dto: MigrationErrorLogDto) {
    return this.migrationCheckpointService.logError(dto);
  }

  // ─── AI Model Management & VRAM Monitoring Endpoints (T031-T034, US2) ───

  @Get(['models', 'ai-models'])
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'AI Models List — ดึงรายการโมเดล AI ทั้งหมดพร้อม VRAM requirement (T031, US2)',
    description:
      'ดึงรายการโมเดล AI ทั้งหมดที่ใช้งานได้ รวมถึงสถานะการทำงานและทรัพยากร VRAM ที่ต้องการ',
  })
  async getAiModels() {
    const result = await this.aiService.getAiModels();
    return {
      data: {
        models: result.models,
        activeModel: result.activeModel,
      },
      models: result.models,
      activeModel: result.activeModel,
    };
  }

  @Post(['models', 'ai-models'])
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'AI Add Model — เพิ่มโมเดล AI ใหม่เข้าระบบพร้อมระบุ VRAM requirement (T032, US2)',
    description:
      'เพิ่มโมเดล AI ใหม่เข้าสู่ระบบเพื่อใช้สำหรับคิวงาน หรือ OCR processing',
  })
  async addAiModel(@Body() dto: AddAiModelDto, @CurrentUser() user: User) {
    const model = await this.aiService.addAiModel(dto, user.user_id);
    return { data: model };
  }

  @Patch(['models/:modelId/activate', 'ai-models/:modelId/activate'])
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'AI Activate Model — สลับโมเดล AI หลักพร้อมตรวจสอบ VRAM (T033, US2)',
    description:
      'เปิดใช้งานโมเดล AI สำหรับระบบหลัก โดยจะมีการตรวจสอบ capacity ของ VRAM GPU ป้องกัน OOM',
  })
  async activateAiModel(
    @Param('modelId') modelId: string,
    @Body() _dto: { isActive?: boolean },
    @CurrentUser() user: User
  ) {
    const activeModelName = await this.aiService.activateAiModel(
      { modelId },
      user.user_id
    );
    return {
      data: { id: modelId, isActive: true, activeModel: activeModelName },
    };
  }

  @Get('vram/status')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'AI VRAM Status — ดึงสถานะ VRAM และโมเดลที่โหลดอยู่บน Ollama (T034, US2)',
    description:
      'ตรวจสอบปริมาณ VRAM ที่เหลืออยู่ และรายการโมเดลทั้งหมดที่โหลดอยู่ใน GPU แบบเรียลไทม์',
  })
  async getVramStatus() {
    const status = await this.aiService.getVramStatus();
    return { data: status };
  }

  @Get('ocr-engines')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary: 'OCR Engines — ดึงรายการเอนจิน OCR ทั้งหมดที่มีในระบบ (T003)',
  })
  async getOcrEngines(): Promise<OcrEngineResponseDto[]> {
    if (!this.ocrService) {
      throw new SystemException('OcrService not injected in AiController');
    }
    return this.ocrService.getOcrEngines();
  }

  @Post('ocr-engines/:engineId/select')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'OCR Select Engine — ตั้งค่าเอนจิน OCR หลักของระบบ (T004)',
  })
  @ApiParam({
    name: 'engineId',
    description: 'UUID ของเอนจิน OCR ที่เลือก',
  })
  async selectOcrEngine(
    @Param('engineId', ParseUuidPipe) engineId: string,
    @CurrentUser() user: User
  ): Promise<OcrEngineConfiguration> {
    if (!this.ocrService) {
      throw new SystemException('OcrService not injected in AiController');
    }
    return this.ocrService.selectOcrEngine(engineId, user.user_id);
  }

  // ─── Sandbox Parameter Management (ADR-036, T024-T026) ────────────────────

  @Get('sandbox-profiles/:profileName')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'Sandbox Parameters — ดึงค่า draft parameters สำหรับ profile (T024)',
    description:
      'ดึงค่า sandbox draft ของ profile; ถ้ายังไม่มีจะ seed จาก production ก่อน',
  })
  @ApiParam({
    name: 'profileName',
    description: 'ชื่อ profile เช่น standard, quality, ocr-extract',
  })
  async getSandboxProfile(
    @Param('profileName') profileName: string
  ): Promise<RuntimePolicy> {
    return this.aiPolicyService.getSandboxParameters(profileName);
  }

  @Put('sandbox-profiles/:profileName')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Save Sandbox Draft — บันทึก draft parameters สำหรับ profile (T025)',
    description:
      'UPSERT sandbox draft parameters สำหรับ profile ที่ระบุ รองรับ partial updates',
  })
  @ApiParam({
    name: 'profileName',
    description: 'ชื่อ profile เช่น standard, quality, ocr-extract',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key เพื่อป้องกัน duplicate save',
    required: true,
  })
  async saveSandboxProfile(
    @Param('profileName') profileName: string,
    @Body()
    updates: Partial<{
      temperature: number;
      topP: number;
      maxTokens: number | null;
      numCtx: number | null;
      repeatPenalty: number;
      keepAliveSeconds: number;
      canonicalModel: 'np-dms-ai' | 'np-dms-ocr';
    }>,
    @CurrentUser() user: User,
    @Headers('idempotency-key') idempotencyKey: string
  ): Promise<RuntimePolicy> {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }
    return this.aiPolicyService.saveSandboxDraft(
      profileName,
      updates,
      user.user_id
    );
  }

  @Post('sandbox-profiles/:profileName/reset')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reset Sandbox to Production — รีเซ็ต draft ให้ตรงกับ production (T026)',
    description: 'เขียนทับ sandbox draft ด้วยค่า production profile ปัจจุบัน',
  })
  @ApiParam({
    name: 'profileName',
    description: 'ชื่อ profile ที่ต้องการ reset',
  })
  async resetSandboxProfile(
    @Param('profileName') profileName: string,
    @CurrentUser() user: User
  ): Promise<RuntimePolicy> {
    return this.aiPolicyService.resetSandboxToProduction(
      profileName,
      user.user_id
    );
  }

  @Post('profiles/:profileName/apply')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_ai')
  @HttpCode(HttpStatus.OK)
  @Audit('APPLY_PROFILE', 'ai_execution_profiles')
  @ApiOperation({
    summary:
      'Apply Sandbox Parameters — ปรับใช้ draft parameters ไปยัง production (T040)',
    description:
      'คัดลอกค่า sandbox draft ไปยัง production profile และล้าง Redis cache key',
  })
  @ApiParam({
    name: 'profileName',
    description: 'ชื่อ profile เช่น standard, quality, ocr-extract',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key เพื่อป้องกัน duplicate apply',
    required: true,
  })
  async applyProfile(
    @Param('profileName') profileName: string,
    @CurrentUser() user: User,
    @Headers('idempotency-key') idempotencyKey: string
  ): Promise<RuntimePolicy> {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }
    const redisKey = `idempotency:apply-profile:${idempotencyKey}`;
    const cachedResult = await this.redis.get(redisKey);
    if (cachedResult) {
      return JSON.parse(cachedResult) as RuntimePolicy;
    }
    const result = await this.aiPolicyService.applyProfile(
      profileName,
      user.user_id
    );
    await this.redis.set(redisKey, JSON.stringify(result), 'EX', 300);
    return result;
  }

  @Get('profiles/:profileName')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @ApiBearerAuth()
  @RequirePermission('system.manage_all')
  @ApiOperation({
    summary:
      'Get Production Profile Parameters — ดึงค่า production parameters (T041)',
    description: 'ดึงค่า production parameters ของ profile ปัจจุบัน',
  })
  @ApiParam({
    name: 'profileName',
    description: 'ชื่อ profile เช่น standard, quality, ocr-extract',
  })
  async getProductionProfile(
    @Param('profileName') profileName: string
  ): Promise<RuntimePolicy> {
    if (profileName === 'ocr-extract') {
      return this.aiPolicyService.getModelDefaults('np-dms-ocr');
    }
    const validProfiles: ExecutionProfile[] = [
      'interactive',
      'standard',
      'quality',
      'deep-analysis',
    ];
    const profile = validProfiles.find((p) => p === profileName);
    if (!profile) {
      throw new ValidationException(`Invalid profile name: ${profileName}`);
    }
    return this.aiPolicyService.getProfileParameters(profile);
  }
}
