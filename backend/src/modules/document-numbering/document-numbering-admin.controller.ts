import { Controller, Post, Body, Get } from '@nestjs/common';
import { DocumentNumberingService } from './document-numbering.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

// TODO: Add Auth Guards
@ApiTags('Admin / Document Numbering')
@Controller('admin/document-numbering')
export class DocumentNumberingAdminController {
  constructor(private readonly service: DocumentNumberingService) {}

  @Post('manual-override')
  @ApiOperation({
    summary: 'Manually override or set a document number counter',
  })
  async manualOverride(@Body() dto: any) {
    return this.service.manualOverride(dto);
  }

  @Post('void-and-replace')
  @ApiOperation({ summary: 'Void a number and replace with a new generation' })
  async voidAndReplace(@Body() dto: any) {
    return this.service.voidAndReplace(dto);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel/Skip a specific document number' })
  async cancelNumber(@Body() dto: any) {
    return this.service.cancelNumber(dto);
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Bulk import/set document number counters' })
  async bulkImport(@Body() items: any[]) {
    return this.service.bulkImport(items);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get numbering usage metrics and logs' })
  async getMetrics() {
    const audit = await this.service.getAuditLogs(50);
    const errors = await this.service.getErrorLogs(50);
    return { audit, errors };
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all document numbering templates' })
  async getTemplates() {
    return this.service.getTemplates();
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create or Update a numbering template' })
  async saveTemplate(@Body() dto: any) {
    // TODO: Validate DTO properly
    return this.service.saveTemplate(dto);
  }
}
