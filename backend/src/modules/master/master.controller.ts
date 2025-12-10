// File: src/modules/master/master.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MasterService } from './master.service';

// DTOs (สมมติว่ามีการสร้างไฟล์เหล่านี้แล้วตามแผนงาน)
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { SearchTagDto } from './dto/search-tag.dto';
import { CreateDisciplineDto } from './dto/create-discipline.dto'; // [New]
import { CreateSubTypeDto } from './dto/create-sub-type.dto'; // [New]
import { SaveNumberFormatDto } from './dto/save-number-format.dto'; // [New]

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Master Data')
@Controller('master')
@UseGuards(JwtAuthGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // =================================================================
  // 📦 Common Dropdowns (Read-Only)
  // =================================================================

  @Get('correspondence-types')
  @ApiOperation({ summary: 'Get all active correspondence types' })
  getCorrespondenceTypes() {
    return this.masterService.findAllCorrespondenceTypes();
  }

  @Post('correspondence-types')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create Correspondence Type' })
  createCorrespondenceType(@Body() dto: any) {
    return this.masterService.createCorrespondenceType(dto);
  }

  @Patch('correspondence-types/:id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update Correspondence Type' })
  updateCorrespondenceType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any
  ) {
    return this.masterService.updateCorrespondenceType(id, dto);
  }

  @Delete('correspondence-types/:id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Delete Correspondence Type' })
  deleteCorrespondenceType(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.deleteCorrespondenceType(id);
  }

  @Get('correspondence-statuses')
  @ApiOperation({ summary: 'Get all active correspondence statuses' })
  getCorrespondenceStatuses() {
    return this.masterService.findAllCorrespondenceStatuses();
  }

  @Get('rfa-types')
  @ApiOperation({ summary: 'Get all active RFA types' })
  @ApiQuery({ name: 'contractId', required: false, type: Number })
  getRfaTypes(@Query('contractId') contractId?: number) {
    return this.masterService.findAllRfaTypes(contractId);
  }

  @Post('rfa-types')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create RFA Type' })
  createRfaType(@Body() dto: any) {
    // Note: Should use proper DTO. Delegating to service.
    // Need to add createRfaType to MasterService or RfaService?
    // Given the context, MasterService seems appropriate for "Reference Data".
    return this.masterService.createRfaType(dto);
  }

  @Patch('rfa-types/:id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update RFA Type' })
  updateRfaType(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.masterService.updateRfaType(id, dto);
  }

  @Delete('rfa-types/:id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Delete RFA Type' })
  deleteRfaType(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.deleteRfaType(id);
  }

  @Get('rfa-statuses')
  @ApiOperation({ summary: 'Get all active RFA status codes' })
  getRfaStatuses() {
    return this.masterService.findAllRfaStatuses();
  }

  @Get('rfa-approve-codes')
  @ApiOperation({ summary: 'Get all active RFA approve codes' })
  getRfaApproveCodes() {
    return this.masterService.findAllRfaApproveCodes();
  }

  @Get('circulation-statuses')
  @ApiOperation({ summary: 'Get all active circulation statuses' })
  getCirculationStatuses() {
    return this.masterService.findAllCirculationStatuses();
  }

  // =================================================================
  // 🏗️ Disciplines Management (Req 6B)
  // =================================================================

  @Get('disciplines')
  @ApiOperation({ summary: 'Get disciplines (filter by contract optional)' })
  @ApiQuery({ name: 'contractId', required: false, type: Number })
  getDisciplines(@Query('contractId') contractId?: number) {
    return this.masterService.findAllDisciplines(contractId);
  }

  @Post('disciplines')
  @RequirePermission('master_data.manage') // สิทธิ์ Admin
  @ApiOperation({ summary: 'Create a new discipline' })
  createDiscipline(@Body() dto: CreateDisciplineDto) {
    return this.masterService.createDiscipline(dto);
  }

  @Delete('disciplines/:id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Delete a discipline' })
  deleteDiscipline(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.deleteDiscipline(id);
  }

  // =================================================================
  // 📑 Correspondence Sub-Types (Req 6B)
  // =================================================================

  @Get('sub-types')
  @ApiOperation({ summary: 'Get sub-types (filter by contract/type optional)' })
  @ApiQuery({ name: 'contractId', required: false, type: Number })
  @ApiQuery({ name: 'typeId', required: false, type: Number })
  getSubTypes(
    @Query('contractId') contractId?: number,
    @Query('typeId') typeId?: number
  ) {
    return this.masterService.findAllSubTypes(contractId, typeId);
  }

  @Post('sub-types')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create/Map a new sub-type' })
  createSubType(@Body() dto: CreateSubTypeDto) {
    return this.masterService.createSubType(dto);
  }

  @Delete('sub-types/:id')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Delete a sub-type' })
  deleteSubType(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.deleteSubType(id);
  }

  // =================================================================
  // 🔢 Numbering Formats (Admin Config)
  // =================================================================

  @Get('numbering-formats')
  @RequirePermission('master_data.manage') // ข้อมูล config ควรสงวนสิทธิ์
  @ApiOperation({ summary: 'Get numbering format for specific project/type' })
  getNumberFormat(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('typeId', ParseIntPipe) typeId: number
  ) {
    return this.masterService.findNumberFormat(projectId, typeId);
  }

  @Post('numbering-formats')
  @RequirePermission('system.manage_all') // เฉพาะ Superadmin/System Admin
  @ApiOperation({ summary: 'Save or Update numbering format template' })
  saveNumberFormat(@Body() dto: SaveNumberFormatDto) {
    return this.masterService.saveNumberFormat(dto);
  }

  // =================================================================
  // 🏷️ Tag Management
  // =================================================================

  @Get('tags')
  @ApiOperation({ summary: 'Get all tags (supports search & pagination)' })
  getTags(@Query() query: SearchTagDto) {
    return this.masterService.findAllTags(query);
  }

  @Get('tags/:id')
  @ApiOperation({ summary: 'Get a tag by ID' })
  getTagById(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.findOneTag(id);
  }

  @Post('tags')
  @RequirePermission('master_data.tag.manage')
  @ApiOperation({ summary: 'Create a new tag' })
  createTag(@Body() dto: CreateTagDto) {
    return this.masterService.createTag(dto);
  }

  @Patch('tags/:id')
  @RequirePermission('master_data.tag.manage')
  @ApiOperation({ summary: 'Update a tag' })
  updateTag(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTagDto) {
    return this.masterService.updateTag(id, dto);
  }

  @Delete('tags/:id')
  @RequirePermission('master_data.tag.manage')
  @ApiOperation({ summary: 'Delete a tag' })
  deleteTag(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.deleteTag(id);
  }
}
