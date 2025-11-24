// File: src/modules/master/master.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MasterService } from './master.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { SearchTagDto } from './dto/search-tag.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Master Data')
@Controller('master')
@UseGuards(JwtAuthGuard) // บังคับ Login ทุก Endpoint
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // =================================================================
  // 📦 Dropdowns Endpoints (Read-Only for Frontend)
  // =================================================================

  @Get('correspondence-types')
  @ApiOperation({ summary: 'Get all active correspondence types' })
  getCorrespondenceTypes() {
    return this.masterService.findAllCorrespondenceTypes();
  }

  @Get('correspondence-statuses')
  @ApiOperation({ summary: 'Get all active correspondence statuses' })
  getCorrespondenceStatuses() {
    return this.masterService.findAllCorrespondenceStatuses();
  }

  @Get('rfa-types')
  @ApiOperation({ summary: 'Get all active RFA types' })
  getRfaTypes() {
    return this.masterService.findAllRfaTypes();
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
  // 🏷️ Tag Management Endpoints
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
  @RequirePermission('master_data.tag.manage') // ต้องมีสิทธิ์ (Admin/Doc Control)
  @ApiOperation({ summary: 'Create a new tag' })
  createTag(@Body() dto: CreateTagDto) {
    return this.masterService.createTag(dto);
  }

  @Patch('tags/:id')
  @RequirePermission('master_data.tag.manage') // ต้องมีสิทธิ์
  @ApiOperation({ summary: 'Update a tag' })
  updateTag(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTagDto) {
    return this.masterService.updateTag(id, dto);
  }

  @Delete('tags/:id')
  @RequirePermission('master_data.tag.manage') // ต้องมีสิทธิ์
  @ApiOperation({ summary: 'Delete a tag' })
  deleteTag(@Param('id', ParseIntPipe) id: number) {
    return this.masterService.deleteTag(id);
  }
}
