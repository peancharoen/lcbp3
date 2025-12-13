import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  ParseIntPipe,
  Query,
  Delete,
  Put,
} from '@nestjs/common';
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

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Audit } from '../../common/decorators/audit.decorator';

@ApiTags('Correspondences')
@Controller('correspondences')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class CorrespondenceController {
  constructor(
    private readonly correspondenceService: CorrespondenceService,
    private readonly workflowService: CorrespondenceWorkflowService
  ) {}

  @Post(':id/workflow/action')
  @ApiOperation({ summary: 'Process workflow action (Approve/Reject/Review)' })
  @ApiResponse({ status: 201, description: 'Action processed successfully.' })
  @RequirePermission('workflow.action_review')
  processAction(
    @Body() actionDto: WorkflowActionDto,
    @Request()
    req: Request & {
      user: {
        user_id: number;
        assignments?: Array<{ role: { roleName: string } }>;
      };
    }
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
    @Request() req: Request & { user: unknown }
  ) {
    return this.correspondenceService.create(
      createDto,
      req.user as Parameters<typeof this.correspondenceService.create>[1]
    );
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
    @Request() req: Request & { user: unknown }
  ) {
    return this.correspondenceService.previewDocumentNumber(
      createDto,
      req.user as Parameters<typeof this.correspondenceService.create>[1]
    );
  }

  @Get()
  @ApiOperation({ summary: 'Search correspondences' })
  @ApiResponse({ status: 200, description: 'Return list of correspondences.' })
  @RequirePermission('document.view')
  findAll(@Query() searchDto: SearchCorrespondenceDto) {
    return this.correspondenceService.findAll(searchDto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit correspondence to Unified Workflow Engine' })
  @ApiResponse({
    status: 201,
    description: 'Correspondence submitted successfully.',
  })
  @RequirePermission('correspondence.create')
  @Audit('correspondence.submit', 'correspondence')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() submitDto: SubmitCorrespondenceDto,
    @Request()
    req: Request & {
      user: {
        user_id: number;
        assignments?: Array<{ role: { roleName: string } }>;
      };
    }
  ) {
    // Extract roles from user assignments
    const userRoles =
      req.user.assignments?.map((a) => a.role?.roleName).filter(Boolean) || [];

    // Use Unified Workflow Engine - pass user roles for DSL requirements check
    return this.workflowService.submitWorkflow(
      id,
      req.user.user_id,
      userRoles,
      submitDto.note
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get correspondence by ID' })
  @ApiResponse({ status: 200, description: 'Return correspondence details.' })
  @RequirePermission('document.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.correspondenceService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update correspondence (Draft only)' })
  @ApiResponse({
    status: 200,
    description: 'Correspondence updated successfully.',
  })
  @RequirePermission('correspondence.create') // Assuming create permission is enough for draft update, or add 'correspondence.edit'
  @Audit('correspondence.update', 'correspondence')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCorrespondenceDto,
    @Request() req: Request & { user: unknown }
  ) {
    return this.correspondenceService.update(
      id,
      updateDto,
      req.user as Parameters<typeof this.correspondenceService.create>[1]
    );
  }

  @Get(':id/references')
  @ApiOperation({ summary: 'Get referenced documents' })
  @ApiResponse({
    status: 200,
    description: 'Return list of referenced documents.',
  })
  @RequirePermission('document.view')
  getReferences(@Param('id', ParseIntPipe) id: number) {
    return this.correspondenceService.getReferences(id);
  }

  @Post(':id/references')
  @ApiOperation({ summary: 'Add reference to another document' })
  @ApiResponse({ status: 201, description: 'Reference added successfully.' })
  @RequirePermission('document.edit')
  addReference(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddReferenceDto
  ) {
    return this.correspondenceService.addReference(id, dto);
  }

  @Delete(':id/references/:targetId')
  @ApiOperation({ summary: 'Remove reference' })
  @ApiResponse({ status: 200, description: 'Reference removed successfully.' })
  @RequirePermission('document.edit')
  removeReference(
    @Param('id', ParseIntPipe) id: number,
    @Param('targetId', ParseIntPipe) targetId: number
  ) {
    return this.correspondenceService.removeReference(id, targetId);
  }
}
