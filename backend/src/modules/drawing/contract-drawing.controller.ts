// File: src/modules/drawing/contract-drawing.controller.ts
// Change Log:
// - 2026-09-07: FR-007 hard-delete ใช้ได้เฉพาะ Superadmin (system.manage_all)

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Patch,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { Audit } from '../../common/decorators/audit.decorator';

import { ContractDrawingService } from './contract-drawing.service';
import { CreateContractDrawingDto } from './dto/create-contract-drawing.dto';
import { UpdateContractDrawingDto } from './dto/update-contract-drawing.dto';
import { SearchContractDrawingDto } from './dto/search-contract-drawing.dto';
import { CancelCorrespondenceDto } from '../correspondence/dto/cancel-correspondence.dto';
import { DocumentActionResponseDto } from '../../common/dto/document-action-response.dto';
import { MetadataPatchRequestDto } from '../../common/dto/metadata-patch.dto';
import { DocumentHardDeleteService } from '../../common/services/document-hard-delete.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { ProjectService } from '../project/project.service';

@ApiTags('Contract Drawings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('drawings/contract')
export class ContractDrawingController {
  constructor(
    private readonly contractDrawingService: ContractDrawingService,
    private readonly projectService: ProjectService,
    private readonly hardDeleteService: DocumentHardDeleteService
  ) {}

  // Force rebuild for DTO changes

  @Post()
  @ApiOperation({ summary: 'Create new Contract Drawing' })
  @RequirePermission('drawing.create') // สิทธิ์ ID 39: สร้าง/แก้ไขข้อมูลแบบ
  create(
    @Body() createDto: CreateContractDrawingDto,
    @CurrentUser() user: User
  ) {
    return this.contractDrawingService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Search Contract Drawings' })
  @RequirePermission('document.view') // สิทธิ์ ID 31: ดูเอกสารทั่วไป
  async findAll(@Query() searchDto: SearchContractDrawingDto) {
    const project = await this.projectService.findOneByUuid(
      searchDto.projectUuid
    );
    searchDto.projectId = project.id;
    return this.contractDrawingService.findAll(searchDto);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get Contract Drawing details' })
  @RequirePermission('document.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.contractDrawingService.findOneByUuid(uuid);
  }

  @Put(':uuid')
  @ApiOperation({ summary: 'Update Contract Drawing' })
  @RequirePermission('drawing.create') // สิทธิ์ ID 39 ครอบคลุมการแก้ไขด้วย
  async update(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() updateDto: UpdateContractDrawingDto,
    @CurrentUser() user: User
  ) {
    const drawing = await this.contractDrawingService.findOneByUuid(uuid);
    return this.contractDrawingService.update(drawing.id, updateDto, user);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete Contract Drawing (Soft Delete)' })
  @RequirePermission('document.delete') // สิทธิ์ ID 34: ลบเอกสาร
  async remove(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User
  ) {
    const drawing = await this.contractDrawingService.findOneByUuid(uuid);
    return this.contractDrawingService.remove(drawing.id, user);
  }

  /**
   ,

   * POST /drawi
   ngs/contract/
   :uuid/cancel — Unified cancel endpoint (Fea
   ture 253),

   * Soft-delete with deleteReason (Drawing uses soft-delete, not status)
   */
  @Post(':uuid/cancel')
  @ApiOperation({
    summary: 'Cancel Contract Drawing (Unified CRUD — Feature 253)',
  })
  @ApiResponse({
    status: 200,
    description: 'Contract Drawing cancelled',
    type: DocumentActionResponseDto,
  })
  @RequirePermission('drawing.cancel')
  @Audit('drawing.cancel', 'drawing')
  async cancelUnified(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() cancelDto: CancelCorrespondenceDto,
    @CurrentUser() user: User
  ): Promise<DocumentActionResponseDto> {
    const drawing = await this.contractDrawingService.findOneByUuid(uuid);
    // Drawing uses soft-delete — cancel = set deletedAt + deleteReason
    await this.contractDrawingService.remove(drawing.id, user);
    return {
      success: true,
      publicId: uuid,
      action: 'CANCEL',
      sideEffects: {
        searchReindexed: false,
        notificationsSent: 0,
        workflowTerminated: false,
        circulationsClosed: 0,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: [],
      auditId: '',
    };
  }

  /**
   * PATCH /drawings/contract/:uuid/metadata — Unified metadata patch (Feature 253 — T059)
   */
  @Patch(':uuid/metadata')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Patch Contract Drawing metadata (Unified CRUD — Feature 253)',
  })
  @ApiParam({ name: 'uuid', description: 'Contract Drawing publicId' })
  @ApiResponse({
    status: 200,
    description: 'Metadata updated',
    type: DocumentActionResponseDto,
  })
  @RequirePermission('drawing.edit')
  @Audit('drawing.metadata_patch', 'drawing')
  async patchMetadata(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: MetadataPatchRequestDto,
    @CurrentUser() user: User
  ): Promise<DocumentActionResponseDto> {
    const result = await this.contractDrawingService.patchMetadata(
      uuid,
      dto.patch,
      dto.version,
      user
    );
    return {
      success: true,
      publicId: uuid,
      action: 'METADATA_PATCH',
      newVersion: result.newVersion,
      sideEffects: {
        searchReindexed: false,
        notificationsSent: 0,
        workflowTerminated: false,
        circulationsClosed: 0,
        vectorsDeleted: 'SKIPPED',
        filesDeleted: 0,
      },
      failedSideEffects: [],
      auditId: '',
    };
  }

  /**
   * DELETE /drawings/contract/:uuid/hard — Hard-delete (Feature 253 — T072)
   * Superadmin เท่านั้น (system.manage_all)
   * cascade contract_drawings + junction + attachments
   */
  @Delete(':uuid/hard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hard-delete Contract Drawing (Superadmin only)',
  })
  @ApiParam({ name: 'uuid', description: 'Contract Drawing publicId' })
  @ApiResponse({
    status: 200,
    description: 'Contract Drawing hard-deleted',
    type: DocumentActionResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Requires system.manage_all permission.',
  })
  @RequirePermission('system.manage_all')
  @Audit('drawing.hard_delete', 'contract_drawing')
  async hardDelete(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User
  ): Promise<DocumentActionResponseDto> {
    return this.hardDeleteService.execute({
      publicId: uuid,
      documentType: 'DRAWING',
      userId: String(user.user_id),
      cascadePolicy: this.hardDeleteService.buildCascadePolicy('DRAWING'),
    });
  }
}
