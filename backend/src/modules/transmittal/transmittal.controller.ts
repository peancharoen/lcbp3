// File: src/modules/transmittal/transmittal.controller.ts
// Change Log:
// - 2026-09-07: FR-007 hard-delete ใช้ได้เฉพาะ Superadmin (system.manage_all)

import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransmittalService } from './transmittal.service';
import { CreateTransmittalDto } from './dto/create-transmittal.dto';
import { SearchTransmittalDto } from './dto/search-transmittal.dto';
import { CancelCorrespondenceDto } from '../correspondence/dto/cancel-correspondence.dto';
import { DocumentActionResponseDto } from '../../common/dto/document-action-response.dto';
import { MetadataPatchRequestDto } from '../../common/dto/metadata-patch.dto';
import { DocumentHardDeleteService } from '../../common/services/document-hard-delete.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { User } from '../user/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { ProjectService } from '../project/project.service';
import { Audit } from '../../common/decorators/audit.decorator';

@ApiTags('Transmittals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('transmittals')
export class TransmittalController {
  constructor(
    private readonly transmittalService: TransmittalService,
    private readonly projectService: ProjectService,
    private readonly hardDeleteService: DocumentHardDeleteService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Transmittal' })
  @RequirePermission('document.create')
  create(@Body() createDto: CreateTransmittalDto, @CurrentUser() user: User) {
    return this.transmittalService.create(createDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Search Transmittals' })
  @RequirePermission('document.view')
  async findAll(
    @Query() searchDto: SearchTransmittalDto,
    @CurrentUser() _user: User
  ) {
    // ADR-019: resolve projectUuid → internal INT projectId if needed
    if (searchDto.projectUuid) {
      const project = await this.projectService.findOneByUuid(
        searchDto.projectUuid
      );
      searchDto.projectId = project.id;
    }
    return this.transmittalService.findAll(searchDto);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get Transmittal details' })
  @ApiParam({
    name: 'uuid',
    description: 'Transmittal publicId (from correspondences.publicId)',
  })
  @RequirePermission('document.view')
  findOne(@Param('uuid', ParseUuidPipe) uuid: string) {
    return this.transmittalService.findOneByUuid(uuid);
  }

  @Post(':uuid/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit Transmittal to Workflow (with EC-RFA-004 validation)',
  })
  @ApiParam({
    name: 'uuid',
    description: 'Transmittal publicId (from correspondences.publicId)',
  })
  @RequirePermission('document.manage')
  @Audit('transmittal.submit', 'transmittal')
  submit(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.transmittalService.submit(uuid, user);
  }

  /**
   * POST /transmittals/:uuid/cancel — Unified cancel endpoint (Feature 253)
   * Returns DocumentActionResponse with side-effects info
   */
  @Post(':uuid/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel Transmittal (Unified CRUD — Feature 253)' })
  @ApiParam({ name: 'uuid', description: 'Transmittal publicId' })
  @ApiResponse({
    status: 200,
    description: 'Transmittal cancelled',
    type: DocumentActionResponseDto,
  })
  @RequirePermission('transmittal.cancel')
  @Audit('transmittal.cancel', 'transmittal')
  async cancelUnified(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() cancelDto: CancelCorrespondenceDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ): Promise<DocumentActionResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    await this.transmittalService.cancel(uuid, cancelDto.reason, user);
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
   * PATCH /transmittals/:uuid/metadata — Unified metadata patch (Feature 253 — T058)
   */
  @Patch(':uuid/metadata')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Patch Transmittal metadata (Unified CRUD — Feature 253)',
  })
  @ApiParam({ name: 'uuid', description: 'Transmittal publicId' })
  @ApiResponse({
    status: 200,
    description: 'Metadata updated',
    type: DocumentActionResponseDto,
  })
  @RequirePermission('transmittal.edit_metadata')
  @Audit('transmittal.metadata_patch', 'transmittal')
  async patchMetadata(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @Body() dto: MetadataPatchRequestDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ): Promise<DocumentActionResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const result = await this.transmittalService.patchMetadata(
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
   * DELETE /transmittals/:uuid/hard — Hard-delete (Feature 253 — T071)
   * Superadmin เท่านั้น (system.manage_all)
   * (transmittals + transmittal_items cascade อัตโนมัติ)
   */
  @Delete(':uuid/hard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hard-delete Transmittal (Superadmin only)',
  })
  @ApiParam({ name: 'uuid', description: 'Transmittal publicId' })
  @ApiResponse({
    status: 200,
    description: 'Transmittal hard-deleted',
    type: DocumentActionResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Requires system.manage_all permission.',
  })
  @RequirePermission('system.manage_all')
  @Audit('transmittal.hard_delete', 'transmittal')
  async hardDelete(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ): Promise<DocumentActionResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.hardDeleteService.execute({
      publicId: uuid,
      documentType: 'TRANSMITTAL',
      userId: String(user.user_id),
      cascadePolicy: this.hardDeleteService.buildCascadePolicy('TRANSMITTAL'),
    });
  }
}
