import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CorrespondenceService } from './correspondence.service.js';
import { CreateCorrespondenceDto } from './dto/create-correspondence.dto.js';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard.js';
import { RbacGuard } from '../../common/auth/rbac.guard.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';

@Controller('correspondences')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CorrespondenceController {
  constructor(private readonly correspondenceService: CorrespondenceService) {}

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
}
