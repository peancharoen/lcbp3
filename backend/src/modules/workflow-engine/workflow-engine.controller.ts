// File: src/modules/workflow-engine/workflow-engine.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
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

// Guards & Decorators (อ้างอิงตามโครงสร้าง src/common ในแผนงาน)
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';

@ApiTags('Workflow Engine')
@ApiBearerAuth() // ระบุว่าต้องใช้ Token ใน Swagger
@Controller('workflow-engine')
@UseGuards(JwtAuthGuard, RbacGuard) // บังคับ Login และตรวจสอบสิทธิ์ทุก Request
export class WorkflowEngineController {
  constructor(private readonly workflowService: WorkflowEngineService) {}

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

  @Patch('definitions/:id')
  @ApiOperation({ summary: 'แก้ไข Workflow Definition (Re-compile DSL)' })
  @RequirePermission('system.manage_all')
  async updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
  ) {
    return this.workflowService.update(id, dto);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'ทดสอบ Logic Workflow (Dry Run) ไม่บันทึกข้อมูล' })
  @RequirePermission('system.manage_all')
  async evaluate(@Body() dto: EvaluateWorkflowDto) {
    return this.workflowService.evaluate(dto);
  }

  // =================================================================
  // Runtime Engine (User Actions)
  // =================================================================

  @Post('instances/:id/transition')
  @ApiOperation({ summary: 'สั่งเปลี่ยนสถานะเอกสาร (User Action)' })
  @ApiParam({ name: 'id', description: 'Workflow Instance ID (UUID)' })
  // Permission จะถูกตรวจสอบ Dynamic ภายใน Service ตาม State ของ Workflow แต่ขั้นต้นต้องมีสิทธิ์ทำงาน Workflow
  @RequirePermission('workflow.action_review')
  async processTransition(
    @Param('id') instanceId: string,
    @Body() dto: WorkflowTransitionDto,
    @Request() req: any,
  ) {
    // ดึง User ID จาก Token (req.user มาจาก JwtStrategy)
    const userId = req.user?.userId;

    return this.workflowService.processTransition(
      instanceId,
      dto.action,
      userId,
      dto.comment,
      dto.payload,
    );
  }

  @Get('instances/:id/actions')
  @ApiOperation({
    summary: 'ดึงรายการปุ่ม Action ที่สามารถกดได้ ณ สถานะปัจจุบัน',
  })
  @RequirePermission('document.view') // ผู้ที่มีสิทธิ์ดูเอกสาร ควรดู Action ได้
  async getAvailableActions(@Param('id') instanceId: string) {
    // Note: Logic การดึง Action ตาม Instance ID จะถูก Implement ใน Task ถัดไป
    return { message: 'Pending implementation in Service layer' };
  }
}
