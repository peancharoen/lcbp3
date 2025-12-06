// File: src/modules/rfa/rfa.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { WorkflowActionDto } from '../correspondence/dto/workflow-action.dto';
import { User } from '../user/entities/user.entity';
import { CreateRfaDto } from './dto/create-rfa.dto';
import { SubmitRfaDto } from './dto/submit-rfa.dto';
import { RfaService } from './rfa.service';

import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';

@ApiTags('RFA (Request for Approval)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('rfas')
export class RfaController {
  constructor(private readonly rfaService: RfaService) {}

  @Post()
  @ApiOperation({ summary: 'Create new RFA (Draft)' })
  @ApiBody({ type: CreateRfaDto })
  @ApiResponse({ status: 201, description: 'RFA created successfully' })
  @RequirePermission('rfa.create')
  @Audit('rfa.create', 'rfa')
  create(@Body() createDto: CreateRfaDto, @CurrentUser() user: User) {
    return this.rfaService.create(createDto, user);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit RFA to Workflow' })
  @ApiParam({ name: 'id', description: 'RFA ID' })
  @ApiBody({ type: SubmitRfaDto })
  @ApiResponse({ status: 200, description: 'RFA submitted successfully' })
  @RequirePermission('rfa.create')
  @Audit('rfa.submit', 'rfa')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() submitDto: SubmitRfaDto,
    @CurrentUser() user: User
  ) {
    return this.rfaService.submit(id, submitDto.templateId, user);
  }

  @Post(':id/action')
  @ApiOperation({ summary: 'Process Workflow Action (Approve/Reject)' })
  @ApiParam({ name: 'id', description: 'RFA ID' })
  @ApiBody({ type: WorkflowActionDto })
  @ApiResponse({
    status: 200,
    description: 'Workflow action processed successfully',
  })
  @RequirePermission('workflow.action_review')
  @Audit('rfa.action', 'rfa')
  processAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() actionDto: WorkflowActionDto,
    @CurrentUser() user: User
  ) {
    return this.rfaService.processAction(id, actionDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get RFA details with revisions and items' })
  @ApiParam({ name: 'id', description: 'RFA ID' })
  @ApiResponse({ status: 200, description: 'RFA details' })
  @RequirePermission('document.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rfaService.findOne(id);
  }
}
