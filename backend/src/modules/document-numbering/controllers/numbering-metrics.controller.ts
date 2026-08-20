// File: src/modules/document-numbering/controllers/numbering-metrics.controller.ts
// Change Log:
// - 2026-08-20: SEV-006 — เปิดใช้งาน JwtAuthGuard + RbacGuard (ก่อนหน้านี้ comment ไว้)

import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';

@Controller('admin/document-numbering/metrics')
@UseGuards(JwtAuthGuard, RbacGuard)
export class NumberingMetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @RequirePermission('system.view_logs')
  getMetrics() {
    // Determine how to return metrics.
    // Standard Prometheus metrics are usually exposed via a separate /metrics endpoint processing all metrics.
    // If the frontend needs JSON data, we might need to query the current values from the registry or metrics service.

    // For now, returning a simple status or aggregated view if supported by MetricsService,
    // otherwise this might be a placeholder for a custom dashboard API.
    return {
      status: 'Metrics are being collected',
      // TODO: Implement custom JSON export of metric values if needed for custom dashboard
    };
  }
}
