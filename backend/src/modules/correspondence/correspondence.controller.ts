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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CorrespondenceService } from './correspondence.service';
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto';
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
  constructor(private readonly correspondenceService: CorrespondenceService) {}

  @Post(':id/workflow/action')
  @ApiOperation({ summary: 'Process workflow action (Approve/Reject/Review)' })
  @ApiResponse({ status: 201, description: 'Action processed successfully.' })
  @RequirePermission('workflow.action_review')
  processAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() actionDto: WorkflowActionDto,
    @Request() req: any
  ) {
    return this.correspondenceService.processAction(id, actionDto, req.user);
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
  create(@Body() createDto: CreateCorrespondenceDto, @Request() req: any) {
    return this.correspondenceService.create(createDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Search correspondences' })
  @ApiResponse({ status: 200, description: 'Return list of correspondences.' })
  @RequirePermission('document.view')
  findAll(@Query() searchDto: SearchCorrespondenceDto) {
    return this.correspondenceService.findAll(searchDto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit correspondence to workflow' })
  @ApiResponse({
    status: 201,
    description: 'Correspondence submitted successfully.',
  })
  @RequirePermission('correspondence.create')
  @Audit('correspondence.create', 'correspondence')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() submitDto: SubmitCorrespondenceDto,
    @Request() req: any
  ) {
    return this.correspondenceService.submit(
      id,
      submitDto.templateId,
      req.user
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
