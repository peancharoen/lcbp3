// File: backend/src/modules/notification/telegram/user-telegram-admin.controller.ts
// Change Log:
// - 2026-09-25: Initial creation (T055) — admin force-unlink Telegram binding (Feature 258 US4, FR-018)
//   อยู่ใน NotificationModule เพื่อเลี่ยง circular dep UserModule↔NotificationModule

import {
  Controller,
  Patch,
  Param,
  UseGuards,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { TelegramLinkService } from './telegram-link.service';
import { NotificationService } from '../notification.service';
import { UserService } from '../../user/user.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { Audit } from '../../../common/decorators/audit.decorator';
import { ParseUuidPipe } from '../../../common/pipes/parse-uuid.pipe';
import { User } from '../../user/entities/user.entity';

/**
 * Admin Telegram management — force-unlink binding ของ user อื่น
 * ต้องการ `user.edit` (ไม่ใช่ notification.manage_all — เพราะแก้ข้อมูล user, FR-018)
 */
@ApiTags('Admin — User Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserTelegramAdminController {
  constructor(
    private readonly telegramLinkService: TelegramLinkService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService
  ) {}

  @Patch(':uuid/telegram/unlink')
  @HttpCode(200)
  @RequirePermission('user.edit')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('user.telegram.force_unlink', 'user')
  @ApiOperation({
    summary: 'Force-unlink a user Telegram binding (admin)',
  })
  async forceUnlink(
    @Param('uuid', ParseUuidPipe) uuid: string,
    @CurrentUser() admin: User
  ) {
    const user = await this.userService.findOneByUuid(uuid);
    if (!user.telegramChatId) {
      return { status: 'not_linked', userPublicId: uuid };
    }

    const previousUsername = user.telegramUsername;
    await this.telegramLinkService.unlinkUser(user.user_id);

    // แจ้ง user ที่ถูกยกเลิกผ่าน SYSTEM in-app notification (FR-018)
    await this.notificationService.send({
      userId: user.user_id,
      title: 'การเชื่อมต่อ Telegram ถูกยกเลิก',
      message: `ผู้ดูแลระบบ (${admin.username}) ได้ยกเลิกการเชื่อมต่อบัญชี Telegram ${previousUsername ? `@${previousUsername}` : ''} ของคุณแล้ว หากต้องการรับการแจ้งเตือนอีกครั้ง กรุณาเชื่อมต่อใหม่ที่หน้าโปรไฟล์`,
      type: 'SYSTEM',
      entityType: 'user',
      entityId: user.user_id,
      entityPublicId: user.publicId,
      link: '/profile',
    });

    return { status: 'unlinked', userPublicId: uuid };
  }
}
