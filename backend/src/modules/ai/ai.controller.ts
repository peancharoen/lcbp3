// File: src/modules/ai/ai.controller.ts
// Controller สำหรับ AI Gateway Endpoints (ADR-018, ADR-020)

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
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
import { ExtractDocumentDto } from './dto/extract-document.dto';
import { AiCallbackDto } from './dto/ai-callback.dto';
import { MigrationUpdateDto } from './dto/migration-update.dto';
import { MigrationQueryDto } from './dto/migration-query.dto';
import { MigrationLog } from './entities/migration-log.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('AI Gateway')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // --- Real-time Extraction (User Upload) ---

  @Post('extract')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @ApiOperation({
    summary: 'AI Callback Endpoint — รับผลลัพธ์จาก n8n หลัง AI ประมวลผลเสร็จ',
    description:
      'เรียกโดย n8n Service Account เท่านั้น ต้องใส่ Bearer Token ใน Authorization header',
  })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer {AI_N8N_AUTH_TOKEN} — Service Account Token จาก n8n',
    required: true,
  })
  @ApiHeader({
    name: 'X-AI-Source',
    description: 'ระบุแหล่งที่มา เช่น ollama, n8n',
    required: false,
  })
  async handleCallback(
    @Body() dto: AiCallbackDto,
    @Headers('authorization') authHeader: string,
    @Headers('x-ai-source') aiSource: string
  ): Promise<{ message: string }> {
    await this.aiService.handleWebhookCallback(
      dto,
      aiSource ?? 'unknown',
      authHeader
    );
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
}
