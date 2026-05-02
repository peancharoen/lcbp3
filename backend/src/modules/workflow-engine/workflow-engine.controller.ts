// File: src/modules/workflow-engine/workflow-engine.controller.ts

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

// Services
import { WorkflowEngineService } from './workflow-engine.service';

// DTOs
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { EvaluateWorkflowDto } from './dto/evaluate-workflow.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { WorkflowTransitionDto } from './dto/workflow-transition.dto';

// Guards & Decorators
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { WorkflowTransitionGuard } from './guards/workflow-transition.guard';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@ApiTags('Workflow Engine')
@ApiBearerAuth() // ระบุว่าต้องใช้ Token ใน Swagger
@Controller('workflow-engine')
@UseGuards(JwtAuthGuard, RbacGuard) // บังคับ Login และตรวจสอบสิทธิ์ทุก Request
export class WorkflowEngineController {
  constructor(
    private readonly workflowService: WorkflowEngineService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
  ) {}

  // =================================================================
  // Definition Management (Admin / Developer)
  // =================================================================

  @Post('definitions')
  @ApiOperation({ summary: 'สร้าง Workflow Definition ใหม่ (Auto Versioning)' })
  @ApiResponse({ status: 201, description: 'Created successfully' })
  // ใช้ Permission 'system.manage_all' (Admin) หรือสร้าง permission ใหม่ 'workflow.manage' ในอนาคต
  @RequirePermission('system.manage_all')
  async createDefinition(@Body() dto: CreateWorkflowDefinitionDto) {
    return this.workflowService.createDefinition(dto);
  }

  @Get('definitions')
  @ApiOperation({ summary: 'ดึง Workflow Definition ทั้งหมด' })
  @RequirePermission('system.manage_all')
  async getDefinitions() {
    return this.workflowService.getDefinitions();
  }

  @Get('definitions/:id')
  @ApiOperation({ summary: 'ดึง Workflow Definition ด้วย ID' })
  @RequirePermission('system.manage_all')
  async getDefinitionById(@Param('id') id: string) {
    return this.workflowService.getDefinitionById(id);
  }

  @Patch('definitions/:id')
  @ApiOperation({ summary: 'แก้ไข Workflow Definition (Re-compile DSL)' })
  @RequirePermission('system.manage_all')
  async updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto
  ) {
    return this.workflowService.update(id, dto);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'ทดสอบ Logic Workflow (Dry Run) ไม่บันทึกข้อมูล' })
  @RequirePermission('system.manage_all')
  async evaluate(@Body() dto: EvaluateWorkflowDto) {
    return this.workflowService.evaluate(dto);
  }

  @Post('definitions/validate')
  @ApiOperation({
    summary: 'FR-025: ตรวจสอบความถูกต้องของ DSL โดยไม่บันทึกข้อมูล',
  })
  @ApiResponse({
    status: 200,
    description: '{ valid: true } หรือ { valid: false, errors: [...] }',
  })
  @RequirePermission('system.manage_all')
  validateDefinition(@Body() body: { dsl: Record<string, unknown> }) {
    return this.workflowService.validateDsl(body.dsl);
  }

  // =================================================================
  // Runtime Engine (User Actions)
  // =================================================================

  @Post('instances/:id/transition')
  @ApiOperation({
    summary:
      'สั่งเปลี่ยนสถานะเอกสาร (User Action) — ADR-021: 4-Level RBAC + Idempotency',
  })
  @ApiParam({ name: 'id', description: 'Workflow Instance ID (UUID)' })
  // ADR-021: แทนที่ @RequirePermission สามัญใช้ WorkflowTransitionGuard (4-Level RBAC เต็มรูปแบบ)
  @UseGuards(WorkflowTransitionGuard)
  async processTransition(
    @Param('id') instanceId: string,
    @Body() dto: WorkflowTransitionDto,
    @Request() req: RequestWithUser,
    @Headers('Idempotency-Key') idempotencyKey: string
  ) {
    // ADR-016: Idempotency-Key ต้องมีทุก Request
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const userId = req.user.user_id;
    // ADR-019: ใช้ publicId (UUID) แทน INT PK สำหรับ History record
    const userUuid = req.user.publicId;

    // ตรวจ Redis ว่า Request นี้ถูกส่งมาแล้วหรือไม่ (key ผูกกับ userId ป้องกัน cross-user replay)
    const cacheKey = `idempotency:transition:${idempotencyKey}:${userId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached; // คืนผลเดิม (Idempotent Response)
    }

    const result = await this.workflowService.processTransition(
      instanceId,
      dto.action,
      userId,
      dto.comment,
      dto.payload,
      dto.attachmentPublicIds, // ADR-021: step-specific attachments
      userUuid, // ADR-019: UUID สำหรับ history record
      dto.versionNo // ADR-001 v1.1 FR-002: Optimistic lock
    );

    // เก็บใน Redis 24 ชั่วโมง (86400 วินาที = 86400000 ms ใน cache-manager v7)
    await this.cacheManager.set(cacheKey, result, 86_400_000);

    return result;
  }

  @Get('instances/:id/history')
  @ApiOperation({
    summary: 'ดึงประวัติ Workflow พร้อมไฟล์แนบประจำแต่ละ Step (ADR-021)',
  })
  @ApiParam({ name: 'id', description: 'Workflow Instance ID (UUID)' })
  @RequirePermission('document.view')
  async getHistory(@Param('id') instanceId: string) {
    return this.workflowService.getHistoryWithAttachments(instanceId);
  }

  @Get('instances/:id/actions')
  @ApiOperation({
    summary: 'ดึงรายการปุ่ม Action ที่สามารถกดได้ ณ สถานะปัจจุบัน',
  })
  @ApiParam({ name: 'id', description: 'Workflow Instance ID (UUID)' })
  @RequirePermission('document.view')
  async getAvailableActions(@Param('id') instanceId: string) {
    const instance = await this.workflowService.getInstanceById(instanceId);
    const actions = await this.workflowService.getAvailableActions(
      instance.definition.workflow_code,
      instance.currentState
    );
    return {
      instanceId,
      currentState: instance.currentState,
      availableActions: actions,
    };
  }
}
