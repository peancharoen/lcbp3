// File: backend/src/modules/maintenance/maintenance.controller.ts
// Change Log:
// - 2026-09-07: Maintenance Console API endpoints (Feature 253 — T093)
// - 2026-09-07: Replace inline @Body() with class-validator DTOs (Code Review M2)
// - 2026-09-07: Type idempotencyKey as string|undefined (Code Review L2)
// - 2026-09-07: Pass real user to bulkHardPurge (Code Review S1)
// - 2026-09-09: SECURITY FIX — controller had no @UseGuards at all. @RequirePermission
//   is metadata only; with no JwtAuthGuard/RbacGuard applied, every route (including
//   emergency-unlock/bulk-hard-purge, a permanent document delete, and
//   numbering/override) was reachable unauthenticated in production. Also the root
//   cause of live crashes on @CurrentUser() (undefined — no guard ever populated
//   request.user), e.g. orphan-cleanup/purge: "Cannot read properties of undefined
//   (reading 'user_id')" (backend log, 2026-09-09 09:37).

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ValidationException } from '../../common/exceptions/base.exception';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { User } from '../user/entities/user.entity';
import {
  SyncCountersDto,
  OverrideCounterDto,
  PurgeOrphansDto,
  EnqueueReEmbedDto,
  ReleaseLocksDto,
  BulkHardPurgeDto,
} from './dto/maintenance.dto';

/**
 * Controller สำหรับ Maintenance Console
 * - Numbering Tools
 * - Orphan Cleanup
 * - Vector Sync
 * - Emergency Unlock
 */
@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  private assertIdempotencyKey(key?: string): void {
    if (!key || key.trim().length === 0) {
      throw new ValidationException('Idempotency-Key header is required', [
        {
          field: 'Idempotency-Key',
          message: 'ต้องระบุ Idempotency-Key header',
        },
      ]);
    }
  }

  // ============= Numbering Tools =============
  @Get('numbering/gaps')
  @RequirePermission('system.numbering_override')
  @ApiOperation({ summary: 'List numbering gaps' })
  numberingGaps(@Query('projectId') projectId?: string) {
    return this.maintenanceService.getNumberingGaps(projectId);
  }

  @Post('numbering/sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('system.numbering_override')
  @ApiOperation({ summary: 'Sync numbering counters to actual used numbers' })
  syncCounters(
    @Body() dto: SyncCountersDto,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.maintenanceService.syncNumberingCounters(dto.projectId);
  }

  @Post('numbering/override')
  @RequirePermission('system.numbering_override')
  @ApiOperation({ summary: 'Manual override numbering counter' })
  overrideCounter(
    @Body() dto: OverrideCounterDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.maintenanceService.overrideNumbering(
      dto.counterKey,
      dto.newLastNumber,
      dto.reason,
      user
    );
  }

  // ============= Orphan Cleanup =============
  @Get('orphan-cleanup/scan')
  @RequirePermission('system.orphan_cleanup')
  @ApiOperation({ summary: 'Scan orphan files in storage' })
  scanOrphans() {
    return this.maintenanceService.scanOrphans();
  }

  @Post('orphan-cleanup/purge')
  @RequirePermission('system.orphan_cleanup')
  @ApiOperation({ summary: 'Purge listed orphan files' })
  purgeOrphans(
    @Body() dto: PurgeOrphansDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.maintenanceService.purgeOrphans(dto.paths, user);
  }

  // ============= Vector Sync =============
  @Get('vector-sync/missing')
  @RequirePermission('system.vector_sync')
  @ApiOperation({ summary: 'List documents missing vectors' })
  missingVectors(@Query('projectId') projectId?: string) {
    return this.maintenanceService.findMissingVectors(projectId);
  }

  @Post('vector-sync/enqueue')
  @RequirePermission('system.vector_sync')
  @ApiOperation({ summary: 'Enqueue document for re-embed' })
  enqueueReEmbed(
    @Body() dto: EnqueueReEmbedDto,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.maintenanceService.enqueueReEmbed(
      dto.projectPublicId,
      dto.documentPublicId
    );
  }

  @Get('vector-sync/orphans')
  @RequirePermission('system.vector_sync')
  @ApiOperation({ summary: 'List orphan vectors' })
  orphanVectors(@Query('projectId') projectId?: string) {
    return this.maintenanceService.findOrphanVectors(projectId);
  }

  // ============= Emergency Unlock =============
  @Get('emergency-unlock/stuck-locks')
  @RequirePermission('system.emergency_unlock')
  @ApiOperation({ summary: 'Scan stuck Redlock keys' })
  stuckLocks() {
    return this.maintenanceService.scanStuckLocks();
  }

  @Post('emergency-unlock/release')
  @RequirePermission('system.emergency_unlock')
  @ApiOperation({ summary: 'Force release Redlock keys' })
  releaseLocks(
    @Body() dto: ReleaseLocksDto,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.maintenanceService.forceReleaseLocks(dto.lockKeys);
  }

  @Post('emergency-unlock/bulk-hard-purge')
  @RequirePermission('system.emergency_unlock')
  @ApiOperation({ summary: 'Emergency bulk hard purge of documents' })
  bulkHardPurge(
    @Body() dto: BulkHardPurgeDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey?: string
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return this.maintenanceService.bulkHardPurge(
      dto.publicIds,
      dto.documentType,
      user
    );
  }
}
