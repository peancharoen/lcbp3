import {
  Controller,
  Get,
  Put,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SearchNotificationDto } from './dto/search-notification.dto'; // ✅ Import

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  async getMyNotifications(
    @CurrentUser() user: User,
    @Query() searchDto: SearchNotificationDto, // ✅ ใช้ DTO แทน
  ) {
    const { page = 1, limit = 20, isRead } = searchDto;

    const where: any = { userId: user.user_id };

    // เพิ่ม Filter isRead ถ้ามีการส่งมา
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [items, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const unreadCount = await this.notificationRepo.count({
      where: { userId: user.user_id, isRead: false },
    });

    return { data: items, meta: { total, page, limit, unreadCount } };
  }

  @Get('unread')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: User) {
    const count = await this.notificationService.getUnreadCount(user.user_id);
    return { unreadCount: count };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.notificationService.markAsRead(id, user.user_id);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all as read' })
  async markAllAsRead(@CurrentUser() user: User) {
    return this.notificationService.markAllAsRead(user.user_id);
  }
}
