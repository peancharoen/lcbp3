// File: src/modules/migration/migration-review.controller.ts
// Change Log:
// - 2026-05-22: Initial creation for US2 - Staging Migration Review Commit (T020b)
// - 2026-08-17: ADR-016/019 compliance — ลบ hardcoded `|| 5` userId fallback,
//   ส่ง idempotencyKey เข้า service เพื่อบันทึกลง import_transactions จริง (Issue #3)

import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { MigrationReviewService } from './migration-review.service';
import { CommitMigrationReviewDto } from './dto/commit-migration-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { ValidationException } from '../../common/exceptions';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';

@ApiTags('Migration Review')
@ApiBearerAuth()
@Controller('ai/migration')
export class MigrationReviewController {
  constructor(private readonly reviewService: MigrationReviewService) {}

  @Post('review')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('migration.commit')
  @ApiOperation({
    summary:
      'Approve and commit a document from staging review queue into the live system',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key per commit request to prevent duplicate inserts',
    required: true,
  })
  async commitRecord(
    @Body() dto: CommitMigrationReviewDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: User
  ) {
    if (!idempotencyKey) {
      throw new ValidationException('Idempotency-Key header is required');
    }
    if (!user?.user_id) {
      throw new UnauthorizedException(
        'Authentication context missing user identity'
      );
    }
    return this.reviewService.commitRecord(dto, user.user_id, idempotencyKey);
  }
}
