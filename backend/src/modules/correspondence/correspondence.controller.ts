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

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RbacGuard } from '../../common/guards/rbac.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';

import { WorkflowActionDto } from './dto/workflow-action.dto.js';
// ... imports ...
import { AddReferenceDto } from './dto/add-reference.dto.js';
import { SearchCorrespondenceDto } from './dto/search-correspondence.dto.js';
import { Query, Delete } from '@nestjs/common'; // เพิ่ม Query, Delete
import { Audit } from '../../common/decorators/audit.decorator'; // Import

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
  @Audit('correspondence.create', 'correspondence') // ✅ แปะตรงนี้
  create(@Body() createDto: CreateCorrespondenceDto, @Request() req: any) {
    return this.correspondenceService.create(createDto, req.user);
  }

  // ✅ ปรับปรุง findAll ให้รับ Query Params
  @Get()
  @RequirePermission('document.view')
  findAll(@Query() searchDto: SearchCorrespondenceDto) {
    return this.correspondenceService.findAll(searchDto);
  }

  // ✅ เพิ่ม Endpoint นี้ครับ
  @Post(':id/submit')
  @RequirePermission('correspondence.create') // หรือจะสร้าง Permission ใหม่ 'workflow.submit' ก็ได้
  @Audit('correspondence.create', 'correspondence') // ✅ แปะตรงนี้
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

  // --- REFERENCES ---

  @Get(':id/references')
  @RequirePermission('document.view')
  getReferences(@Param('id', ParseIntPipe) id: number) {
    return this.correspondenceService.getReferences(id);
  }

  @Post(':id/references')
  @RequirePermission('document.edit') // ต้องมีสิทธิ์แก้ไขถึงจะเพิ่ม Ref ได้
  addReference(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddReferenceDto,
  ) {
    return this.correspondenceService.addReference(id, dto);
  }

  @Delete(':id/references/:targetId')
  @RequirePermission('document.edit')
  removeReference(
    @Param('id', ParseIntPipe) id: number,
    @Param('targetId', ParseIntPipe) targetId: number,
  ) {
    return this.correspondenceService.removeReference(id, targetId);
  }
}
