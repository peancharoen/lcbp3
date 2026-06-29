import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermission('audit-log.view')
  findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      entityName?: string;
      action?: string;
      userId?: number;
    }
  ) {
    return this.auditLogService.findAll(query);
  }
}
