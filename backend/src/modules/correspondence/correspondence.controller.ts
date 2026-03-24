import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
  Delete,
  Put,
  ParseIntPipe,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CorrespondenceService } from './correspondence.service';
import { CorrespondenceWorkflowService } from './correspondence-workflow.service';
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto';
import { UpdateCorrespondenceDto } from './dto/update-correspondence.dto';
import { SubmitCorrespondenceDto } from './dto/submit-correspondence.dto';
import { WorkflowActionDto } from './dto/workflow-action.dto';
import { AddReferenceDto } from './dto/add-reference.dto';
import { SearchCorrespondenceDto } from './dto/search-correspondence.dto';
import { CancelCorrespondenceDto } from './dto/cancel-correspondence.dto';
import { BulkCancelDto } from './dto/bulk-cancel.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import type { RequestWithUser } from '../../common/interfaces/request-with-user.interface';

@ApiTags('Correspondences')
@Controller('correspondences')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class CorrespondenceController {
  constructor(
    private readonly correspondenceService: CorrespondenceService,
    private readonly workflowService: CorrespondenceWorkflowService
  ) {}

  @Post(':uuid/workflow/action')
  @ApiOperation({ summary: 'Process workflow action (Approve/Reject/Review)' })
  @ApiResponse({ status: 201, description: 'Action processed successfully.' })
  @RequirePermission('workflow.action_review')
  processAction(
    @Body() actionDto: WorkflowActionDto,
    @Request() req: RequestWithUser
  ) {
    // Extract roles from user assignments for DSL requirements check
    const userRoles =
      req.user.assignments?.map((a) => a.role?.roleName).filter(Boolean) || [];

    // Use Unified Workflow Engine via CorrespondenceWorkflowService
    if (!actionDto.instanceId) {
      throw new Error('instanceId is required for workflow action');
    }

    return this.workflowService.processAction(
      actionDto.instanceId,
      req.user.user_id,
      {
        action: actionDto.action,
        comment: actionDto.comment,
        payload: { ...actionDto.payload, roles: userRoles },
      }
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create new correspondence' })
  @ApiResponse({
    status: 201,
    description: 'Correspondence created successfully.',
    type: CreateCorrespondenceDto,
  })
  @RequirePermission('correspondence.create')
  @Audit('correspondence.create', 'correspondence')
  create(
    @Body() createDto: CreateCorrespondenceDto,
    @Request() req: RequestWithUser
  ) {
    return this.correspondenceService.create(createDto, req.user);
  }

  @Post('preview-number')
  @ApiOperation({ summary: 'Preview next document number' })
  @ApiResponse({
    status: 200,
    description: 'Return preview number and status.',
  })
  @RequirePermission('correspondence.create')
  previewNumber(
    @Body() createDto: CreateCorrespondenceDto,
    @Request() req: RequestWithUser
  ) {
    return this.correspondenceService.previewDocumentNumber(
      createDto,
      req.user
    );
  }

  @Get()
  @ApiOperation({ summary: 'Search correspondences' })
  @ApiResponse({ status: 200, description: 'Return list of correspondences.' })
  @RequirePermission('document.view')
  findAll(@Query() searchDto: SearchCorrespondenceDto) {
    return this.correspondenceService.findAll(searchDto);
  }

  @Post(':uuid/submit')
  @ApiOperation({ summary: 'Submit correspondence to Unified Workflow Engine' })
  @ApiResponse({
    status: 201,
    description: 'Correspondence submitted successfully.',
  })
  @RequirePermission('correspondence.create')
  @Audit('correspondence.submit', 'correspondence')
  async submit(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() submitDto: SubmitCorrespondenceDto,
    @Request() req: RequestWithUser
  ) {
    const corr = await this.correspondenceService.findOneByUuid(uuid);
    // Extract roles from user assignments
    const userRoles =
      req.user.assignments?.map((a) => a.role?.roleName).filter(Boolean) || [];

    // Use Unified Workflow Engine - pass user roles for DSL requirements check
    return this.workflowService.submitWorkflow(
      corr.id,
      req.user.user_id,
      userRoles,
      submitDto.note
    );
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get correspondence by UUID' })
  @ApiResponse({ status: 200, description: 'Return correspondence details.' })
  @RequirePermission('document.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.correspondenceService.findOneByUuid(uuid);
  }

  @Put(':uuid')
  @ApiOperation({ summary: 'Update correspondence (Draft only)' })
  @ApiResponse({
    status: 200,
    description: 'Correspondence updated successfully.',
  })
  @RequirePermission('correspondence.create') // Assuming create permission is enough for draft update, or add 'correspondence.edit'
  @Audit('correspondence.update', 'correspondence')
  async update(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() updateDto: UpdateCorrespondenceDto,
    @Request() req: RequestWithUser
  ) {
    const corr = await this.correspondenceService.findOneByUuid(uuid);
    return this.correspondenceService.update(corr.id, updateDto, req.user);
  }

  @Get(':uuid/references')
  @ApiOperation({ summary: 'Get referenced documents' })
  @ApiResponse({
    status: 200,
    description: 'Return list of referenced documents.',
  })
  @RequirePermission('document.view')
  async getReferences(@Param('uuid', ParseUuidPipe) uuid: string) {
    const corr = await this.correspondenceService.findOneByUuid(uuid);
    return this.correspondenceService.getReferences(corr.id);
  }

  @Post(':uuid/references')
  @ApiOperation({ summary: 'Add reference to another document' })
  @ApiResponse({ status: 201, description: 'Reference added successfully.' })
  @RequirePermission('document.edit')
  async addReference(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: AddReferenceDto
  ) {
    const corr = await this.correspondenceService.findOneByUuid(uuid);
    return this.correspondenceService.addReference(corr.id, dto);
  }

  @Delete(':uuid/references/:targetUuid')
  @ApiOperation({ summary: 'Remove reference' })
  @ApiResponse({ status: 200, description: 'Reference removed successfully.' })
  @RequirePermission('document.edit')
  async removeReference(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Param('targetUuid', ParseUuidPipe) targetUuid: string
  ) {
    const corr = await this.correspondenceService.findOneByUuid(uuid);
    const target = await this.correspondenceService.findOneByUuid(targetUuid);
    return this.correspondenceService.removeReference(corr.id, target.id);
  }

  @Get(':uuid/tags')
  @ApiOperation({ summary: 'Get tags for a correspondence' })
  @RequirePermission('document.view')
  async getTags(@Param('uuid', ParseUuidPipe) uuid: string) {
    const corr = await this.correspondenceService.findOneByUuid(uuid);
    return this.correspondenceService.getTags(corr.id);
  }

  @Post(':uuid/tags/:tagId')
  @ApiOperation({ summary: 'Add tag to a correspondence' })
  @RequirePermission('document.edit')
  async addTag(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Param('tagId', ParseIntPipe) tagId: number
  ) {
    const corr = await this.correspondenceService.findOneByUuid(uuid);
    return this.correspondenceService.addTag(corr.id, tagId);
  }

  @Delete(':uuid/tags/:tagId')
  @ApiOperation({ summary: 'Remove tag from a correspondence' })
  @RequirePermission('document.edit')
  async removeTag(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Param('tagId', ParseIntPipe) tagId: number
  ) {
    const corr = await this.correspondenceService.findOneByUuid(uuid);
    return this.correspondenceService.removeTag(corr.id, tagId);
  }

  @Post('bulk-cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bulk cancel correspondences (Org Admin+)' })
  @RequirePermission('correspondence.cancel')
  @Audit('correspondence.bulk_cancel', 'correspondence')
  async bulkCancel(
    @Body() dto: BulkCancelDto,
    @Request() req: RequestWithUser
  ) {
    return this.correspondenceService.bulkCancel(
      dto.uuids,
      dto.reason,
      req.user
    );
  }

  @Get('export-csv')
  @ApiOperation({ summary: 'Export correspondence list as CSV' })
  @RequirePermission('document.view')
  async exportCsv(
    @Query() searchDto: SearchCorrespondenceDto,
    @Res() res: Response
  ) {
    const csv = await this.correspondenceService.exportCsv(searchDto);
    const filename = `correspondences-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Cancel correspondence (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Correspondence cancelled successfully.',
  })
  @RequirePermission('correspondence.cancel')
  @Audit('correspondence.cancel', 'correspondence')
  async cancel(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() cancelDto: CancelCorrespondenceDto,
    @Request() req: RequestWithUser
  ) {
    return this.correspondenceService.cancel(uuid, cancelDto.reason, req.user);
  }
}
