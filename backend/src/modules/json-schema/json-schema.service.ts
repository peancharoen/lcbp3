// File: src/modules/json-schema/json-schema.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JsonSchemaService } from './json-schema.service';
import { SchemaMigrationService } from './services/schema-migration.service';

import { CreateJsonSchemaDto } from './dto/create-json-schema.dto';
import { MigrateDataDto } from './dto/migrate-data.dto';
import { SearchJsonSchemaDto } from './dto/search-json-schema.dto';
import { UpdateJsonSchemaDto } from './dto/update-json-schema.dto';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { User } from '../user/entities/user.entity';

@ApiTags('JSON Schemas Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('json-schemas')
export class JsonSchemaController {
  constructor(
    private readonly jsonSchemaService: JsonSchemaService,
    private readonly migrationService: SchemaMigrationService,
  ) {}

  // ----------------------------------------------------------------------
  // Schema Management (CRUD)
  // ----------------------------------------------------------------------

  @Post()
  @ApiOperation({
    summary: 'Create a new schema or new version of existing schema',
  })
  @ApiResponse({
    status: 201,
    description: 'The schema has been successfully created.',
  })
  @RequirePermission('system.manage_all') // Admin Only
  create(@Body() createDto: CreateJsonSchemaDto) {
    return this.jsonSchemaService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all schemas with pagination and filtering' })
  @RequirePermission('document.view') // Viewer+ can see schemas
  findAll(@Query() searchDto: SearchJsonSchemaDto) {
    return this.jsonSchemaService.findAll(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific schema version by ID' })
  @RequirePermission('document.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.jsonSchemaService.findOne(id);
  }

  @Get('latest/:code')
  @ApiOperation({
    summary: 'Get the latest active version of a schema by code',
  })
  @ApiParam({ name: 'code', description: 'Schema Code (e.g., RFA_DWG)' })
  @RequirePermission('document.view')
  findLatest(@Param('code') code: string) {
    return this.jsonSchemaService.findLatestByCode(code);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a specific schema (Not recommended for active schemas)',
  })
  @RequirePermission('system.manage_all')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateJsonSchemaDto,
  ) {
    return this.jsonSchemaService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a schema version (Hard Delete)' })
  @RequirePermission('system.manage_all')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.jsonSchemaService.remove(id);
  }

  // ----------------------------------------------------------------------
  // Validation & Security
  // ----------------------------------------------------------------------

  @Post('validate/:code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate data against the latest schema version' })
  @ApiResponse({
    status: 200,
    description: 'Validation result including errors and sanitized data',
  })
  @RequirePermission('document.view')
  async validate(@Param('code') code: string, @Body() data: any) {
    // Note: Validation API นี้ใช้สำหรับ Test หรือ Pre-check เท่านั้น
    // การ Save จริงจะเรียกผ่าน Service ภายใน
    return this.jsonSchemaService.validateData(code, data);
  }

  @Post('read/:code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process read data (Decrypt & Filter) based on user roles',
  })
  @RequirePermission('document.view')
  async processReadData(
    @Param('code') code: string,
    @Body() data: any,
    @CurrentUser() user: User,
  ) {
    // แปลง User Entity เป็น Security Context
    // แก้ไข TS2339 & TS7006: Type Casting เพื่อให้เข้าถึง roles ได้โดยไม่ error
    // เนื่องจาก User Entity ปกติไม่มี property roles (แต่อาจถูก Inject มาตอน Runtime หรือผ่าน Assignments)
    const userWithRoles = user as any;
    const userRoles = userWithRoles.roles
      ? userWithRoles.roles.map((r: any) => r.roleName)
      : [];

    return this.jsonSchemaService.processReadData(code, data, { userRoles });
  }

  // ----------------------------------------------------------------------
  // Data Migration
  // ----------------------------------------------------------------------

  @Post('migrate/:table/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Migrate specific entity data to target schema version',
  })
  @ApiParam({ name: 'table', description: 'Table Name (e.g. rfa_revisions)' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @RequirePermission('system.manage_all') // Dangerous Op -> Admin Only
  async migrateData(
    @Param('table') tableName: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MigrateDataDto,
  ) {
    return this.migrationService.migrateData(
      tableName,
      id,
      dto.targetSchemaCode,
      dto.targetVersion,
    );
  }
}
