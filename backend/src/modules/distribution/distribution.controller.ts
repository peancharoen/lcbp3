// File: src/modules/distribution/distribution.controller.ts
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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { DistributionMatrixService } from './distribution-matrix.service';

class CreateMatrixDto {
  projectId!: number;
  documentTypeCode!: string;
  responseCodeFilter?: string[];
}

class AddRecipientDto {
  recipientType!: string;
  recipientId?: number;
  roleCode?: string;
  deliveryMethod?: string;
  isCc?: boolean;
}

@Controller('admin/distribution-matrices')
@UseGuards(JwtAuthGuard)
export class DistributionController {
  constructor(private readonly matrixService: DistributionMatrixService) {}

  @Get()
  findByProject(
    @Query('projectPublicId', ParseUuidPipe) projectPublicId: string
  ) {
    return this.matrixService.findByProjectPublicId(projectPublicId);
  }

  @Post()
  create(@Body() dto: CreateMatrixDto) {
    return this.matrixService.create(dto);
  }

  @Post(':publicId/recipients')
  addRecipient(
    @Param('publicId') publicId: string,
    @Body() dto: AddRecipientDto
  ) {
    return this.matrixService.addRecipient(publicId, dto);
  }

  @Delete(':publicId/recipients/:recipientPublicId')
  removeRecipient(@Param('recipientPublicId') recipientPublicId: string) {
    return this.matrixService.removeRecipient(recipientPublicId);
  }

  @Delete(':publicId')
  remove(@Param('publicId') publicId: string) {
    return this.matrixService.remove(publicId);
  }
}
