// File: src/modules/workflow-engine/workflow-engine.controller.ts

import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common'; // เพิ่ม Patch, Param
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WorkflowEngineService } from './workflow-engine.service';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { EvaluateWorkflowDto } from './dto/evaluate-workflow.dto';
import { GetAvailableActionsDto } from './dto/get-available-actions.dto'; // [NEW]
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto'; // [NEW]
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Workflow Engine (DSL)')
@Controller('workflow-engine')
@UseGuards(JwtAuthGuard) // Protect all endpoints
export class WorkflowEngineController {
  constructor(private readonly workflowService: WorkflowEngineService) {}

  @Post('definitions')
  @ApiOperation({ summary: 'Create or Update Workflow Definition (DSL)' })
  @ApiResponse({ status: 201, description: 'Workflow compiled and saved.' })
  async createDefinition(@Body() dto: CreateWorkflowDefinitionDto) {
    return this.workflowService.createDefinition(dto);
  }

  @Post('evaluate')
  @ApiOperation({
    summary: 'Evaluate transition (Run logic without saving state)',
  })
  async evaluate(@Body() dto: EvaluateWorkflowDto) {
    return this.workflowService.evaluate(dto);
  }

  @Get('actions')
  @ApiOperation({ summary: 'Get available actions for current state' })
  async getAvailableActions(@Query() query: GetAvailableActionsDto) {
    // [UPDATED] ใช้ DTO แทนแยก Query
    return this.workflowService.getAvailableActions(
      query.workflow_code,
      query.current_state,
    );
  }

  // [OPTIONAL/RECOMMENDED] เพิ่ม Endpoint สำหรับ Update (PATCH)
  @Patch('definitions/:id')
  @ApiOperation({
    summary: 'Update workflow status or details (e.g. Deactivate)',
  })
  async updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto, // [NEW] ใช้ Update DTO
  ) {
    // *หมายเหตุ: คุณต้องไปเพิ่ม method update() ใน Service ด้วยถ้าจะใช้ Endpoint นี้
    // return this.workflowService.update(id, dto);
    return { message: 'Update logic not implemented yet', id, ...dto };
  }
}
