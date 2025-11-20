import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JsonSchemaService } from './json-schema.service.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RbacGuard } from '../../common/auth/rbac.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';

@Controller('json-schemas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class JsonSchemaController {
  constructor(private readonly schemaService: JsonSchemaService) {}

  @Post(':code')
  @RequirePermission('system.manage_all') // เฉพาะ Superadmin หรือผู้มีสิทธิ์จัดการ System
  create(@Param('code') code: string, @Body() definition: any) {
    return this.schemaService.createOrUpdate(code, definition);
  }

  // Endpoint สำหรับ Test Validate (Optional)
  @Post(':code/validate')
  @RequirePermission('document.view')
  async validate(@Param('code') code: string, @Body() data: any) {
    const isValid = await this.schemaService.validate(code, data);
    return { valid: isValid };
  }
}
