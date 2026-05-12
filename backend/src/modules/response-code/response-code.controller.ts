// File: src/modules/response-code/response-code.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResponseCodeService } from './response-code.service';
import { ResponseCodeCategory } from '../common/enums/review.enums';

@Controller('response-codes')
@UseGuards(JwtAuthGuard)
export class ResponseCodeController {
  constructor(private readonly responseCodeService: ResponseCodeService) {}

  /**
   * GET /response-codes
   * ดึง Response Codes ทั้งหมด
   */
  @Get()
  findAll() {
    return this.responseCodeService.findAll();
  }

  /**
   * GET /response-codes/category/:category
   * ดึง Response Codes ตาม Category (FR-006)
   */
  @Get('category/:category')
  findByCategory(@Param('category') category: ResponseCodeCategory) {
    return this.responseCodeService.findByCategory(category);
  }

  /**
   * GET /response-codes/document-type/:id
   * ดึง Response Codes ที่ใช้ได้กับ document type + project
   */
  @Get('document-type/:documentTypeId')
  findByDocumentType(
    @Param('documentTypeId') documentTypeId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.responseCodeService.findByDocumentType(
      Number(documentTypeId),
      projectId ? Number(projectId) : undefined,
    );
  }

  /**
   * GET /response-codes/:publicId
   * ดึง Response Code ตาม publicId (ADR-019)
   */
  @Get(':publicId')
  findOne(@Param('publicId') publicId: string) {
    return this.responseCodeService.findByPublicId(publicId);
  }
}
