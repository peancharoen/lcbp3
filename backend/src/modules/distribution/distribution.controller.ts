// File: src/modules/distribution/distribution.controller.ts
// Change Log
// - 2026-05-14: Add RBAC and validated public-ID DTOs for Distribution Matrix CRUD.
// Admin endpoints สำหรับจัดการ Distribution Matrix (T058)
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { DistributionMatrixService } from './distribution-matrix.service';
import { CreateDistributionMatrixDto } from './dto/create-distribution-matrix.dto';
import { AddDistributionRecipientDto } from './dto/add-distribution-recipient.dto';
import { UpdateDistributionMatrixDto } from './dto/update-distribution-matrix.dto';

@Controller('admin/distribution-matrices')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DistributionController {
  constructor(private readonly matrixService: DistributionMatrixService) {}

  @Get()
  findByProject(@Query('projectPublicId') projectPublicId?: string) {
    return this.matrixService.findByProjectPublicId(projectPublicId);
  }

  @Post()
  @RequirePermission('master_data.manage')
  create(@Body() dto: CreateDistributionMatrixDto) {
    return this.matrixService.create(dto);
  }

  @Patch(':publicId')
  @RequirePermission('master_data.manage')
  update(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Body() dto: UpdateDistributionMatrixDto
  ) {
    return this.matrixService.update(publicId, dto);
  }

  @Post(':publicId/recipients')
  @RequirePermission('master_data.manage')
  addRecipient(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Body() dto: AddDistributionRecipientDto
  ) {
    return this.matrixService.addRecipient(publicId, dto);
  }

  @Delete(':publicId/recipients/:recipientPublicId')
  @RequirePermission('master_data.manage')
  async removeRecipient(
    @Param('recipientPublicId', ParseUuidPipe) recipientPublicId: string
  ) {
    await this.matrixService.removeRecipient(recipientPublicId);
    return { success: true };
  }

  @Delete(':publicId')
  @RequirePermission('master_data.manage')
  async remove(@Param('publicId', ParseUuidPipe) publicId: string) {
    await this.matrixService.remove(publicId);
    return { success: true };
  }
}
