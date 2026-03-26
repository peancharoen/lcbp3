// File: src/modules/rfa/rfa.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
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
import { UpdateRfaDto } from './dto/update-rfa.dto';
import { SubmitRfaDto } from './dto/submit-rfa.dto';
import { SearchRfaDto } from './dto/search-rfa.dto';
import { RfaService } from './rfa.service';

import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { ProjectService } from '../project/project.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';

@ApiTags('RFA (Request for Approval)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('rfas')
export class RfaController {
  constructor(
    private readonly rfaService: RfaService,
    private readonly projectService: ProjectService,
    private readonly uuidResolver: UuidResolverService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new RFA (Draft)' })
  @ApiBody({ type: CreateRfaDto })
  @ApiResponse({ status: 201, description: 'RFA created successfully' })
  @RequirePermission('rfa.create')
  @Audit('rfa.create', 'rfa')
  create(@Body() createDto: CreateRfaDto, @CurrentUser() user: User) {
    return this.rfaService.create(createDto, user);
  }

  @Post(':uuid/submit')
  @ApiOperation({ summary: 'Submit RFA to Workflow' })
  @ApiParam({
    name: 'uuid',
    description: 'RFA publicId (from correspondences.publicId)',
  })
  @ApiBody({ type: SubmitRfaDto })
  @ApiResponse({ status: 200, description: 'RFA submitted successfully' })
  @RequirePermission('rfa.create')
  @Audit('rfa.submit', 'rfa')
  async submit(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() submitDto: SubmitRfaDto,
    @CurrentUser() user: User
  ) {
    // ADR-019: resolve UUID → internal INT id via findOneByUuidRaw
    const rfa = await this.rfaService.findOneByUuidRaw(uuid);
    return this.rfaService.submit(rfa.id, submitDto.templateId, user);
  }

  @Post(':uuid/action')
  @ApiOperation({ summary: 'Process Workflow Action (Approve/Reject)' })
  @ApiParam({
    name: 'uuid',
    description: 'RFA publicId (from correspondences.publicId)',
  })
  @ApiBody({ type: WorkflowActionDto })
  @ApiResponse({
    status: 200,
    description: 'Workflow action processed successfully',
  })
  @RequirePermission('workflow.action_review')
  @Audit('rfa.action', 'rfa')
  async processAction(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() actionDto: WorkflowActionDto,
    @CurrentUser() user: User
  ) {
    // ADR-019: resolve UUID → internal INT id
    const rfa = await this.rfaService.findOneByUuidRaw(uuid);
    return this.rfaService.processAction(rfa.id, actionDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List all RFAs with pagination' })
  @ApiResponse({ status: 200, description: 'List of RFAs' })
  @RequirePermission('document.view')
  async findAll(@Query() query: SearchRfaDto, @CurrentUser() user: User) {
    // ADR-019: resolve projectId UUID→INT if provided
    if (query.projectId) {
      query.projectId = await this.uuidResolver.resolveProjectId(
        query.projectId
      );
    }
    return this.rfaService.findAll(query, user);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get RFA details with revisions and items' })
  @ApiParam({
    name: 'uuid',
    description: 'RFA publicId (from correspondences.publicId)',
  })
  @ApiResponse({ status: 200, description: 'RFA details' })
  @RequirePermission('document.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.rfaService.findOneByUuid(uuid);
  }

  @Put(':uuid')
  @ApiOperation({ summary: 'Update Draft RFA fields (EC-RFA-002: DFT only)' })
  @ApiParam({ name: 'uuid', description: 'RFA publicId' })
  @ApiBody({ type: UpdateRfaDto })
  @ApiResponse({ status: 200, description: 'RFA updated successfully' })
  @RequirePermission('rfa.create')
  @Audit('rfa.update', 'rfa')
  async update(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() updateDto: UpdateRfaDto,
    @CurrentUser() user: User
  ) {
    return this.rfaService.update(uuid, updateDto, user);
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel Draft RFA (sets status to CC)' })
  @ApiParam({ name: 'uuid', description: 'RFA publicId' })
  @ApiResponse({ status: 200, description: 'RFA cancelled successfully' })
  @RequirePermission('rfa.create')
  @Audit('rfa.cancel', 'rfa')
  async cancel(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User
  ) {
    return this.rfaService.cancel(uuid, user);
  }
}
