// File: src/modules/monitoring/services/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDuration: Histogram<string>;
  public readonly systemMemoryUsage: Gauge<string>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ app: 'lcbp3-backend' });

    // นับจำนวน HTTP Request ทั้งหมด แยกตาม method, route, status_code
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // วัดระยะเวลา Response Time (Histogram)
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.2, 0.5, 1.0, 1.5, 2.0, 5.0], // Buckets สำหรับวัด Latency
      registers: [this.registry],
    });

    // วัดการใช้ Memory (Gauge)
    this.systemMemoryUsage = new Gauge({
      name: 'system_memory_usage_bytes',
      help: 'Heap memory usage in bytes',
      registers: [this.registry],
    });

    // เริ่มเก็บ Metrics พื้นฐานของ Node.js (Optional)
    // client.collectDefaultMetrics({ register: this.registry });
  }

  /**
   * ดึงข้อมูล Metrics ทั้งหมดในรูปแบบ Text สำหรับ Prometheus Scrape
   */
  async getMetrics(): Promise<string> {
    // อัปเดต Memory Usage ก่อน Return
    const memoryUsage = process.memoryUsage();
    this.systemMemoryUsage.set(memoryUsage.heapUsed);

    return this.registry.metrics();
  }
}
