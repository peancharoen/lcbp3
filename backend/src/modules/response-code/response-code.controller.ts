// File: src/modules/response-code/response-code.controller.ts
// Change Log:
// - 2026-05-13: Resolve project query identifiers through UuidResolverService and stop numeric coercion on public IDs.
// - 2026-05-13: Add basic CRUD endpoints with RBAC enforcement for response code management.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { ResponseCodeService } from './response-code.service';
import { ResponseCodeCategory } from '../common/enums/review.enums';
import { CreateResponseCodeDto } from './dto/create-response-code.dto';
import { UpdateResponseCodeDto } from './dto/update-response-code.dto';
import { UpsertResponseCodeRuleDto } from './dto/upsert-response-code-rule.dto';
import { MatrixManagementService } from './services/matrix-management.service';
import { InheritanceService } from './services/inheritance.service';

@ApiTags('Response Codes')
@ApiBearerAuth()
@Controller('response-codes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ResponseCodeController {
  constructor(
    private readonly responseCodeService: ResponseCodeService,
    private readonly uuidResolver: UuidResolverService,
    private readonly matrixManagementService: MatrixManagementService,
    private readonly inheritanceService: InheritanceService
  ) {}

  /**
   * GET /response-codes
   * ดึง Response Codes ทั้งหมด
   */
  @Get()
  @ApiOperation({ summary: 'Get all active response codes' })
  findAll() {
    return this.responseCodeService.findAll();
  }

  /**
   * GET /response-codes/category/:category
   * ดึง Response Codes ตาม Category (FR-006)
   */
  @Get('category/:category')
  @ApiOperation({ summary: 'Get response codes by category' })
  findByCategory(@Param('category') category: ResponseCodeCategory) {
    return this.responseCodeService.findByCategory(category);
  }

  /**
   * GET /response-codes/document-type/:id
   * ดึง Response Codes ที่ใช้ได้กับ document type + project
   */
  @Get('document-type/:documentTypeId')
  @ApiOperation({ summary: 'Get response codes by document type and project' })
  async findByDocumentType(
    @Param('documentTypeId', ParseIntPipe) documentTypeId: number,
    @Query('projectId') projectId?: string
  ) {
    const resolvedProjectId = projectId
      ? await this.uuidResolver.resolveProjectId(projectId)
      : undefined;

    return this.responseCodeService.findByDocumentType(
      documentTypeId,
      resolvedProjectId
    );
  }

  /**
   * GET /response-codes/:publicId
   * ดึง Response Code ตาม publicId (ADR-019)
   */
  @Get(':publicId')
  @ApiOperation({ summary: 'Get response code by publicId' })
  findOne(@Param('publicId', ParseUuidPipe) publicId: string) {
    return this.responseCodeService.findByPublicId(publicId);
  }

  @Post()
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create a custom response code' })
  create(@Body() dto: CreateResponseCodeDto) {
    return this.responseCodeService.create(dto);
  }

  @Patch(':publicId')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Update response code by publicId' })
  update(
    @Param('publicId', ParseUuidPipe) publicId: string,
    @Body() dto: UpdateResponseCodeDto
  ) {
    return this.responseCodeService.update(publicId, dto);
  }

  @Delete(':publicId')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Deactivate response code by publicId' })
  async remove(@Param('publicId', ParseUuidPipe) publicId: string) {
    await this.responseCodeService.deactivate(publicId);
    return { success: true };
  }

  @Get('matrix/:documentTypeId')
  @ApiOperation({ summary: 'Resolve response code matrix by document type' })
  async getMatrix(
    @Param('documentTypeId', ParseIntPipe) documentTypeId: number,
    @Query('projectId') projectId?: string
  ) {
    const resolvedProjectId = projectId
      ? await this.uuidResolver.resolveProjectId(projectId)
      : undefined;

    return this.inheritanceService.resolveMatrix(
      documentTypeId,
      resolvedProjectId
    );
  }

  @Post('matrix/rules')
  @RequirePermission('master_data.manage')
  @ApiOperation({ summary: 'Create or update a response code matrix rule' })
  async upsertRule(@Body() dto: UpsertResponseCodeRuleDto) {
    const resolvedProjectId = dto.projectPublicId
      ? await this.uuidResolver.resolveProjectId(dto.projectPublicId)
      : undefined;

    return this.matrixManagementService.upsertRule({
      documentTypeId: dto.documentTypeId,
      responseCodePublicId: dto.responseCodePublicId,
      projectId: resolvedProjectId,
      isEnabled: dto.isEnabled,
      requiresComments: dto.requiresComments,
      triggersNotification: dto.triggersNotification,
    });
  }

  @Delete('matrix/rules/:rulePublicId')
  @RequirePermission('master_data.manage')
  @ApiOperation({
    summary: 'Delete a project-specific response code matrix override',
  })
  async deleteRuleOverride(
    @Param('rulePublicId', ParseUuidPipe) rulePublicId: string
  ) {
    await this.matrixManagementService.deleteProjectOverride(rulePublicId);
    return { success: true };
  }
}
