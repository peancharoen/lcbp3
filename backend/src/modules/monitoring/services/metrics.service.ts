// File: src/modules/monitoring/services/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    public readonly httpRequestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    public readonly httpRequestDuration: Histogram<string>
  ) {}

  // Removed manual getMetrics() as PrometheusModule handles /metrics
}
