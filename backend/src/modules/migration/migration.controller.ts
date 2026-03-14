import { Controller, Post, Body, Headers, UseGuards, Get, Param, Query, Res, ParseIntPipe } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { EnqueueMigrationDto } from './dto/enqueue-migration.dto';
import { CommitBatchDto } from './dto/commit-batch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiQuery, ApiParam } from '@nestjs/swagger';
import { MigrationQueueQueryDto } from './dto/migration-queue-query.dto';
import type { Response } from 'express';

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

  @Post('commit_batch')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Batch approve and import migration review queue items' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key for the entire batch to prevent duplicate execution',
    required: true,
  })
  async commitBatch(
    @Body() dto: CommitBatchDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: any
  ) {
    const userId = user?.id || user?.userId || 5;
    return this.migrationService.commitBatch(dto, idempotencyKey, userId);
  }

  @Post('queue')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Enqueue a record into the staging migration review queue' })
  async enqueueRecord(@Body() dto: EnqueueMigrationDto) {
    return this.migrationService.enqueueRecord(dto);
  }

  @Get('queue')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get migration review queue' })
  async getReviewQueue(@Query() query: MigrationQueueQueryDto) {
    return this.migrationService.getReviewQueue(query);
  }

  @Get('queue/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a specific queue item by ID' })
  @ApiParam({ name: 'id', type: Number })
  async getQueueItemById(@Param('id', ParseIntPipe) id: number) {
    return this.migrationService.getQueueItemById(id);
  }

  @Get('errors')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get migration errors' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getErrors(
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.migrationService.getErrors(page, limit);
  }

  @Post('queue/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Approve and import a queued migration item' })
  @ApiParam({ name: 'id', type: Number })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key per document and batch to prevent duplicate inserts',
    required: true,
  })
  async approveQueueItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ImportCorrespondenceDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: any
  ) {
    const userId = user?.id || user?.userId || 5;
    return this.migrationService.approveQueueItem(id, dto, idempotencyKey, userId);
  }

  @Post('queue/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Reject a queued migration item' })
  @ApiParam({ name: 'id', type: Number })
  async rejectQueueItem(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any
  ) {
    const userId = user?.id || user?.userId || 5;
    return this.migrationService.rejectQueueItem(id, userId);
  }

  @Get('staging-file')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stream a file from staging' })
  @ApiQuery({ name: 'path', required: true, type: String })
  async getStagingFile(
    @Query('path') filePath: string,
    @Res() res: Response
  ) {
    const stream = this.migrationService.getStagingFileStream(filePath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="document.pdf"',
    });
    stream.pipe(res);
  }
}

