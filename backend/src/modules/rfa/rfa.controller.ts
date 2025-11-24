import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { RfaService } from './rfa.service';
import { CreateRfaDto } from './dto/create-rfa.dto';
import { WorkflowActionDto } from '../correspondence/dto/workflow-action.dto'; // Reuse DTO
import { User } from '../user/entities/user.entity';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator'; // Import

@ApiTags('RFA (Request for Approval)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('rfas')
export class RfaController {
  constructor(private readonly rfaService: RfaService) {}

  @Post()
  @ApiOperation({ summary: 'Create new RFA (Draft)' })
  @RequirePermission('rfa.create') // สิทธิ์ ID 37
  @Audit('rfa.create', 'rfa') // ✅ แปะตรงนี้
  create(@Body() createDto: CreateRfaDto, @CurrentUser() user: User) {
    return this.rfaService.create(createDto, user);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit RFA to Workflow' })
  @RequirePermission('rfa.create') // ผู้สร้างมีสิทธิ์ส่ง
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body('templateId', ParseIntPipe) templateId: number, // รับ Template ID
    @CurrentUser() user: User,
  ) {
    return this.rfaService.submit(id, templateId, user);
  }

  @Post(':id/action')
  @ApiOperation({ summary: 'Process Workflow Action (Approve/Reject)' })
  @RequirePermission('workflow.action_review') // สิทธิ์ในการ Approve/Review
  processAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() actionDto: WorkflowActionDto,
    @CurrentUser() user: User,
  ) {
    return this.rfaService.processAction(id, actionDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get RFA details with revisions and items' })
  @RequirePermission('document.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rfaService.findOne(id);
  }
}
