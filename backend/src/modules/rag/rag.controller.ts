import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { RagQueryDto } from './dto/rag-query.dto';
import { RagService } from './rag.service';

@ApiTags('RAG')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('rag')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(
    private readonly ragService: RagService,
    private readonly userService: UserService
  ) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'RAG Q&A — ค้นหาคำตอบจากเอกสารโครงการ' })
  @RequirePermission('rag.query')
  async query(
    @Body() dto: RagQueryDto,
    @CurrentUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ) {
    if (!idempotencyKey) {
      this.logger.warn(`Missing Idempotency-Key from user ${user.user_id}`);
    }

    const permissions = await this.userService.getUserPermissions(user.user_id);
    return this.ragService.query(dto, permissions);
  }

  @Get('status/:attachmentId')
  @ApiOperation({ summary: 'ดูสถานะ RAG ingestion ของ attachment' })
  @RequirePermission('rag.query')
  async getStatus(@Param('attachmentId', ParseUuidPipe) attachmentId: string) {
    return this.ragService.getStatus(attachmentId);
  }

  @Post('ingest/:attachmentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-ingest attachment ที่ FAILED (Admin only)' })
  @RequirePermission('rag.manage')
  async reIngest(@Param('attachmentId', ParseUuidPipe) attachmentId: string) {
    await this.ragService.reIngest(attachmentId);
    return { message: 'Re-ingestion queued' };
  }

  @Delete('vectors/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'ลบ vectors ของ attachment ออกจาก Qdrant' })
  @RequirePermission('rag.manage')
  async deleteVectors(
    @Param('attachmentId', ParseUuidPipe) attachmentId: string
  ) {
    await this.ragService.deleteVectors(attachmentId);
  }

  @Post('admin/init-collection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'T038: Init Qdrant collection lcbp3_vectors (admin only)',
  })
  @RequirePermission('rag.manage')
  async initCollection() {
    await this.ragService.initCollection();
    return { message: 'Qdrant collection initialized' };
  }
}
