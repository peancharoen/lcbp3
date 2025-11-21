import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param, // <--- ✅ 1. เพิ่ม Param
  ParseIntPipe, // <--- ✅ 2. เพิ่ม ParseIntPipe
} from '@nestjs/common';
import { CorrespondenceService } from './correspondence.service.js';
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto.js';
import { SubmitCorrespondenceDto } from './dto/submit-correspondence.dto.js'; // <--- ✅ 3. เพิ่ม Import DTO นี้

import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RbacGuard } from '../../common/auth/rbac.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';

import { WorkflowActionDto } from './dto/workflow-action.dto.js';
@Controller('correspondences')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CorrespondenceController {
  constructor(private readonly correspondenceService: CorrespondenceService) {}

  @Post(':id/workflow/action')
  @RequirePermission('workflow.action_review') // สิทธิ์ในการกดอนุมัติ/ตรวจสอบ
  processAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() actionDto: WorkflowActionDto,
    @Request() req: any,
  ) {
    return this.correspondenceService.processAction(id, actionDto, req.user);
  }

  @Post()
  @RequirePermission('correspondence.create') // 🔒 ต้องมีสิทธิ์สร้าง
  create(@Body() createDto: CreateCorrespondenceDto, @Request() req: any) {
    return this.correspondenceService.create(createDto, req.user);
  }

  @Get()
  @RequirePermission('document.view') // 🔒 ต้องมีสิทธิ์ดู
  findAll() {
    return this.correspondenceService.findAll();
  }

  // ✅ เพิ่ม Endpoint นี้ครับ
  @Post(':id/submit')
  @RequirePermission('correspondence.create') // หรือจะสร้าง Permission ใหม่ 'workflow.submit' ก็ได้
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() submitDto: SubmitCorrespondenceDto,
    @Request() req: any,
  ) {
    return this.correspondenceService.submit(
      id,
      submitDto.templateId,
      req.user,
    );
  }
}
