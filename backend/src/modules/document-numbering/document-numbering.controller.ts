import {
  Controller,
  Get,
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DocumentNumberingService } from './document-numbering.service';

@ApiTags('Document Numbering')
@ApiBearerAuth()
@Controller('document-numbering')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DocumentNumberingController {
  constructor(private readonly numberingService: DocumentNumberingService) {}

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
}
