import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
// import { PermissionGuard } from '../../auth/guards/permission.guard';
// import { Permissions } from '../../auth/decorators/permissions.decorator';

@Controller('admin/document-numbering/metrics')
// @UseGuards(PermissionGuard)
export class NumberingMetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  // @Permissions('system.view_logs')
  async getMetrics() {
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
