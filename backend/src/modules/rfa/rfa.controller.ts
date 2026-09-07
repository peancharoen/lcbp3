// File: src/modules/rfa/rfa.controller.ts
// Change Log:
// - 2026-05-13: Wire submit reviewTeamPublicId through to the submit workflow for parallel review task creation.
// - 2026-06-14: ADR-016 Idempotency-Key enforcement on mutations; pass RBAC roles to Unified Workflow Engine; drop templateId.
// - 2026-09-07: FR-007 hard-delete ใช้ได้เฉพาะ Superadmin (system.manage_all)
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Patch,
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
import { DocumentActionResponseDto } from '../../common/dto/document-action-response.dto';
import { MetadataPatchRequestDto } from '../../common/dto/metadata-patch.dto';
import { DocumentHardDeleteService } from '../../common/services/document-hard-delete.service';

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
    private readonly uuidResolver: UuidResolverService,
    private readonly hardDeleteService: DocumentHardDeleteService
  ) {}

  /** ADR-016: บังคับให้ทุก mutation ส่ง Idempotency-Key header */
  private assertIdempotencyKey(idempotencyKey?: string): void {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
  }

  /** ดึง role name จาก user assignments เพื่อส่งให้ Unified Workflow Engine ตรวจ DSL requirements */
  private extractRoles(user: User): string[] {
    return (
      user.assignments
        ?.map((a) => a.role?.roleName)
        .filter((name): name is string => Boolean(name)) ?? []
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create new RFA (Draft)' })
  @ApiBody({ type: CreateRfaDto })
  @ApiResponse({ status: 201, description: 'RFA created successfully' })
  @RequirePermission('rfa.create')
  @Audit('rfa.create', 'rfa')
  create(
    @Body() createDto: CreateRfaDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
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
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    // ADR-019: resolve UUID → internal INT id via findOneByUuidRaw
    const rfa = await this.rfaService.findOneByUuidRaw(uuid);
    return this.rfaService.submit(
      rfa.id,
      user,
      submitDto.reviewTeamPublicId,
      this.extractRoles(user)
    );
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
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    // ADR-019: resolve UUID → internal INT id
    const rfa = await this.rfaService.findOneByUuidRaw(uuid);
    return this.rfaService.processAction(
      rfa.id,
      actionDto,
      user,
      this.extractRoles(user)
    );
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
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
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
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.rfaService.cancel(uuid, user);
  }

  /**
   * POST /rfas/:uuid/cancel — Unified cancel endpoint (Feature 253)
   * Returns DocumentActionResponse with side-effects info
   */
  @Post(':uuid/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel RFA (Unified CRUD — Feature 253)' })
  @ApiParam({ name: 'uuid', description: 'RFA publicId' })
  @ApiResponse({
    status: 200,
    description: 'RFA cancelled',
    type: DocumentActionResponseDto,
  })
  @RequirePermission('rfa.cancel')
  @Audit('rfa.cancel', 'rfa')
  async cancelUnified(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ): Promise<DocumentActionResponseDto> {
    this.assertIdempotencyKey(idempotencyKey);
    await this.rfaService.cancel(uuid, user);
    return {
      success: true,
      publicId: uuid,
      action: 'CANCEL',
      sideEffects: {
        searchReindexed: false,
        notificationsSent: 0,
        workflowTerminated: false,
        circulationsClosed: 0,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: [],
      auditId: '',
    };
  }

  /**
   * PATCH /rfas/:uuid/metadata — Unified metadata patch (Feature 253 — T057)
   */
  @Patch(':uuid/metadata')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patch RFA metadata (Unified CRUD — Feature 253)' })
  @ApiParam({ name: 'uuid', description: 'RFA publicId' })
  @ApiResponse({
    status: 200,
    description: 'Metadata updated',
    type: DocumentActionResponseDto,
  })
  @RequirePermission('rfa.edit')
  @Audit('rfa.metadata_patch', 'rfa')
  async patchMetadata(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: MetadataPatchRequestDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ): Promise<DocumentActionResponseDto> {
    this.assertIdempotencyKey(idempotencyKey);
    const result = await this.rfaService.patchMetadata(
      uuid,
      dto.patch,
      dto.version,
      user
    );
    return {
      success: true,
      publicId: uuid,
      action: 'METADATA_PATCH',
      newVersion: result.newVersion,
      sideEffects: {
        searchReindexed: false,
        notificationsSent: 0,
        workflowTerminated: false,
        circulationsClosed: 0,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: [],
      auditId: '',
    };
  }

  /**
   * DELETE /rfas/:uuid/hard — Hard-delete (Feature 253 — T070)
   * Superadmin เท่านั้น (system.manage_all)
   */
  @Delete(':uuid/hard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hard-delete RFA (Superadmin only)' })
  @ApiParam({ name: 'uuid', description: 'RFA publicId' })
  @ApiResponse({
    status: 200,
    description: 'RFA hard-deleted',
    type: DocumentActionResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Requires system.manage_all permission.',
  })
  @RequirePermission('system.manage_all')
  @Audit('rfa.hard_delete', 'rfa')
  async hardDelete(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ): Promise<DocumentActionResponseDto> {
    this.assertIdempotencyKey(idempotencyKey);
    return this.hardDeleteService.execute({
      publicId: uuid,
      documentType: 'RFA',
      userId: String(user.user_id),
      cascadePolicy: this.hardDeleteService.buildCascadePolicy('RFA'),
    });
  }
}
