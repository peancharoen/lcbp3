// File: src/modules/ai/intent-classifier/controllers/intent-analytics.controller.ts
// Change Log
// - 2026-05-19: สร้าง Analytics Controller สำหรับ Intent Classification (T035, US3).

import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { IntentAnalyticsService } from '../services/intent-analytics.service';

/**
 * Analytics Controller สำหรับ Intent Classification
 * Route prefix: /admin/ai/intent-analytics
 * Protected by JwtAuthGuard + RbacGuard (system admin only)
 */
@Controller('admin/ai/intent-analytics')
@UseGuards(JwtAuthGuard, RbacGuard)
export class IntentAnalyticsController {
  private readonly logger = new Logger(IntentAnalyticsController.name);

  constructor(private readonly analyticsService: IntentAnalyticsService) {}

  /**
   * GET /admin/ai/intent-analytics
   * ดึงสถิติ Classification ทั้งหมด
   * @param from ISO date string (optional, default: 30 วันก่อน)
   * @param to ISO date string (optional, default: ปัจจุบัน)
   */
  @Get()
  async getAnalytics(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const data = await this.analyticsService.getAnalytics(fromDate, toDate);
    return { data };
  }
}
