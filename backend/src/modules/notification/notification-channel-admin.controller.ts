// File: backend/src/modules/notification/notification-channel-admin.controller.ts
// Change Log:
// - 2026-09-25: Initial creation (T039) — admin CRUD สำหรับ notification_channels (Feature 258 US2, FR-003/019)

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

import { NotificationChannelService } from './notification-channel.service';
import { LinkCodeRequestDto } from './telegram/dto/link-code-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { User } from '../user/entities/user.entity';

class PatchChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Admin endpoints สำหรับจัดการ notification_channels (Telegram group/topic bindings)
 * ทุก route ต้องการ `notification.manage_all` (ADR-016/CASL)
 */
@ApiTags('Admin — Notification Channels')
@ApiBearerAuth()
@Controller('admin/notifications/channels')
@UseGuards(JwtAuthGuard)
export class NotificationChannelAdminController {
  constructor(private readonly channelService: NotificationChannelService) {}

  @Post('link-code')
  @HttpCode(200)
  @RequirePermission('notification.manage_all')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Issue a one-time group link code for a project' })
  issueLinkCode(@CurrentUser() user: User, @Body() dto: LinkCodeRequestDto) {
    return this.channelService.issueLinkCode(user.user_id, dto);
  }

  @Get()
  @RequirePermission('notification.manage_all')
  @ApiOperation({
    summary: 'List notification channels (optionally by project)',
  })
  list(@Query('projectPublicId') projectPublicId?: string) {
    return this.channelService.list(projectPublicId);
  }

  @Patch(':publicId')
  @RequirePermission('notification.manage_all')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Update channel name / active state' })
  patch(@Param('publicId') publicId: string, @Body() dto: PatchChannelDto) {
    return this.channelService.patch(publicId, dto);
  }

  @Delete(':publicId')
  @RequirePermission('notification.manage_all')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Unbind (delete) a channel' })
  remove(@Param('publicId') publicId: string) {
    return this.channelService.delete(publicId);
  }
}
