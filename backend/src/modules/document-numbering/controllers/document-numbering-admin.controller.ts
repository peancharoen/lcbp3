import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { DocumentNumberingService } from '../services/document-numbering.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@ApiTags('Admin / Document Numbering')
@ApiBearerAuth()
@Controller('admin/document-numbering')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DocumentNumberingAdminController {
  constructor(private readonly service: DocumentNumberingService) {}

  // ----------------------------------------------------------
  // Template Management
  // ----------------------------------------------------------

  @Get('templates')
  @ApiOperation({ summary: 'Get all document numbering templates' })
  @RequirePermission('system.manage_settings')
  async getTemplates(@Query('projectId') projectId?: number) {
    if (projectId) {
      return this.service.getTemplatesByProject(projectId);
    }
    return this.service.getTemplates();
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create or Update a numbering template' })
  @RequirePermission('system.manage_settings')
  async saveTemplate(@Body() dto: any) {
    return this.service.saveTemplate(dto);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete a numbering template' })
  @RequirePermission('system.manage_settings')
  async deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    await this.service.deleteTemplate(id);
    return { success: true };
  }

  // ----------------------------------------------------------
  // Metrics & Logs
  // ----------------------------------------------------------

  @Get('metrics')
  @ApiOperation({ summary: 'Get numbering usage metrics and logs' })
  @RequirePermission('system.view_logs')
  async getMetrics() {
    const audit = await this.service.getAuditLogs(50);
    const errors = await this.service.getErrorLogs(50);
    return { audit, errors };
  }

  // ----------------------------------------------------------
  // Admin Operations
  // ----------------------------------------------------------

  @Post('manual-override')
  @ApiOperation({
    summary: 'Manually override or set a document number counter',
  })
  @RequirePermission('system.manage_settings')
  async manualOverride(@Body() dto: any) {
    return this.service.manualOverride(dto);
  }

  @Post('void-and-replace')
  @ApiOperation({ summary: 'Void a number and replace with a new generation' })
  @RequirePermission('system.manage_settings')
  async voidAndReplace(@Body() dto: any) {
    return this.service.voidAndReplace(dto);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel/Skip a specific document number' })
  @RequirePermission('system.manage_settings')
  async cancelNumber(@Body() dto: any) {
    return this.service.cancelNumber(dto);
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Bulk import/set document number counters' })
  @RequirePermission('system.manage_settings')
  async bulkImport(@Body() items: any[]) {
    return this.service.bulkImport(items);
  }
}
