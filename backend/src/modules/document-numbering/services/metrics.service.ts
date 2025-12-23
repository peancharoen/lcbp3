import { Injectable, Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('numbering_sequences_total')
    public numbersGenerated: Counter<string>,
    @InjectMetric('numbering_sequence_utilization')
    public sequenceUtilization: Gauge<string>,
    @InjectMetric('numbering_lock_wait_seconds')
    public lockWaitTime: Histogram<string>,
    @InjectMetric('numbering_lock_failures_total')
    public lockFailures: Counter<string>
  ) {}
}
