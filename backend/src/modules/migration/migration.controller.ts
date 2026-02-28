import { Controller, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

@ApiTags('Migration')
@ApiBearerAuth()
@Controller('migration')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Import generic legacy correspondence record via n8n integration' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key per document and batch to prevent duplicate inserts',
    required: true,
  })
  async importCorrespondence(
    @Body() dto: ImportCorrespondenceDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: any
  ) {
    const userId = user?.id || user?.userId || 5;
    return this.migrationService.importCorrespondence(dto, idempotencyKey, userId);
  }
}
