// File: src/modules/workflow-engine/workflow-engine.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { EvaluateWorkflowDto } from './dto/evaluate-workflow.dto';
import { GetAvailableActionsDto } from './dto/get-available-actions.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { WorkflowEngineService } from './workflow-engine.service';

@ApiTags('Workflow Engine (DSL)')
@Controller('workflow-engine')
@UseGuards(JwtAuthGuard)
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
    return this.workflowService.getAvailableActions(
      query.workflow_code,
      query.current_state,
    );
  }

  @Patch('definitions/:id')
  @ApiOperation({
    summary: 'Update workflow status or details (DSL Re-compile)',
  })
  async updateDefinition(
    @Param('id', ParseUUIDPipe) id: string, // เพิ่ม ParseUUIDPipe เพื่อ Validate ID
    @Body() dto: UpdateWorkflowDefinitionDto,
  ) {
    return this.workflowService.update(id, dto);
  }
}
