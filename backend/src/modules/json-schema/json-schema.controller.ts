import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { JsonSchemaService } from './json-schema.service';
// ✅ FIX: Import DTO
import { CreateJsonSchemaDto } from './dto/create-json-schema.dto';
// ✅ FIX: แก้ไข Path ของ Guards
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('JSON Schemas') // ✅ Add Swagger Tag
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('json-schemas')
export class JsonSchemaController {
  constructor(private readonly schemaService: JsonSchemaService) {}

  @Post()
  @ApiOperation({ summary: 'Create or Update JSON Schema' })
  @RequirePermission('system.manage_all') // Admin Only
  create(@Body() createDto: CreateJsonSchemaDto) {
    return this.schemaService.createOrUpdate(
      createDto.schemaCode,
      createDto.schemaDefinition,
    );
  }

  @Post(':code/validate')
  @ApiOperation({ summary: 'Test validation against a schema' })
  @RequirePermission('document.view')
  async validate(@Param('code') code: string, @Body() data: any) {
    const isValid = await this.schemaService.validate(code, data);
    return { valid: isValid, message: 'Validation passed' };
  }
}
