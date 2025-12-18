import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { DocumentNumberingService } from '../services/document-numbering.service';
import { PreviewNumberDto } from '../dto/preview-number.dto';

@ApiTags('Document Numbering')
@ApiBearerAuth()
@Controller('document-numbering')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DocumentNumberingController {
  constructor(private readonly numberingService: DocumentNumberingService) {}

  // ----------------------------------------------------------
  // Logs
  // ----------------------------------------------------------

  @Get('logs/audit')
  @ApiOperation({ summary: 'Get document generation audit logs' })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermission('system.view_logs')
  getAuditLogs(@Query('limit') limit?: number) {
    return this.numberingService.getAuditLogs(limit ? Number(limit) : 100);
  }

  @Get('logs/errors')
  @ApiOperation({ summary: 'Get document generation error logs' })
  @ApiResponse({ status: 200, description: 'List of error logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermission('system.view_logs')
  getErrorLogs(@Query('limit') limit?: number) {
    return this.numberingService.getErrorLogs(limit ? Number(limit) : 100);
  }

  // ----------------------------------------------------------
  // Sequences / Counters
  // ----------------------------------------------------------

  @Get('sequences')
  @ApiOperation({ summary: 'Get all number sequences/counters' })
  @ApiResponse({ status: 200, description: 'List of counter sequences' })
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  @RequirePermission('correspondence.read')
  getSequences(@Query('projectId') projectId?: number) {
    return this.numberingService.getSequences(
      projectId ? Number(projectId) : undefined
    );
  }

  @Patch('counters/:id')
  @ApiOperation({ summary: 'Update counter sequence value (Admin only)' })
  @RequirePermission('system.manage_settings')
  async updateCounter(
    @Param('id', ParseIntPipe) id: number,
    @Body('sequence') sequence: number
  ) {
    return this.numberingService.setCounterValue(id, sequence);
  }

  // ----------------------------------------------------------
  // Preview / Test
  // ----------------------------------------------------------

  @Post('preview')
  @ApiOperation({ summary: 'Preview what a document number would look like' })
  @ApiResponse({
    status: 200,
    description: 'Preview result without incrementing counter',
  })
  @RequirePermission('correspondence.read')
  async previewNumber(@Body() dto: PreviewNumberDto) {
    return this.numberingService.previewNumber({
      projectId: dto.projectId,
      originatorOrganizationId: dto.originatorOrganizationId,
      typeId: dto.correspondenceTypeId,
      subTypeId: dto.subTypeId,
      rfaTypeId: dto.rfaTypeId,
      disciplineId: dto.disciplineId,
      recipientOrganizationId: dto.recipientOrganizationId,
      year: dto.year,
      customTokens: dto.customTokens,
    });
  }
}
