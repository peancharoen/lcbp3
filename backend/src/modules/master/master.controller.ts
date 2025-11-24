// File: src/modules/master/master.controller.ts

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MasterService } from './master.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Master Data')
@Controller('master')
@UseGuards(JwtAuthGuard) // บังคับ Login ทุก Endpoint
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

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

  @Get('tags')
  @ApiOperation({ summary: 'Get all tags' })
  getTags() {
    return this.masterService.findAllTags();
  }

  @Post('tags')
  @RequirePermission('master_data.tag.manage') // ต้องมีสิทธิ์จัดการ Tag
  @ApiOperation({ summary: 'Create a new tag (Admin only)' })
  createTag(@Body() dto: CreateTagDto) {
    return this.masterService.createTag(dto);
  }
}
