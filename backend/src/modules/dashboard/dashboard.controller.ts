// File: src/modules/dashboard/dashboard.controller.ts
// บันทึกการแก้ไข: สร้างใหม่สำหรับ Dashboard API Endpoints

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

// Guards & Decorators
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

// Service
import { DashboardService } from './dashboard.service';

// DTOs
import { GetActivityDto, GetPendingDto } from './dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * ดึงสถิติ Dashboard
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats(@CurrentUser() user: User) {
    return this.dashboardService.getStats(user.user_id);
  }

  /**
   * ดึง Recent Activity
   */
  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity' })
  async getActivity(@CurrentUser() user: User, @Query() query: GetActivityDto) {
    return this.dashboardService.getActivity(user.user_id, query);
  }

  /**
   * ดึง Pending Tasks
   */
  @Get('pending')
  @ApiOperation({ summary: 'Get pending tasks for current user' })
  async getPending(@CurrentUser() user: User, @Query() query: GetPendingDto) {
    return this.dashboardService.getPending(user.user_id, query);
  }
}
