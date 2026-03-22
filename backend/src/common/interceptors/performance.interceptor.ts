// File: src/modules/monitoring/interceptors/performance.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../../modules/monitoring/services/metrics.service';

interface RequestWithRoute extends Request {
  route: {
    path: string;
  };
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // ข้ามการวัดผลสำหรับ Endpoint /metrics และ /health เพื่อลด Noise
    const req = context.switchToHttp().getRequest<Request>();
    if (req.url === '/metrics' || req.url === '/health') {
      return next.handle();
    }

    const method = req.method;
    const reqWithRoute = req as RequestWithRoute;
    const url = reqWithRoute.route ? reqWithRoute.route.path : req.url; // Use Route path if available
    const startTime = process.hrtime();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(context, method, url || '', startTime, 200);
        },
        error: (err: { status?: number }) => {
          const status = err.status || 500;
          this.recordMetrics(context, method, url, startTime, status);
        },
      })
    );
  }

  /**
   * บันทึกข้อมูลลง Metrics Service และ Logger
   */
  private recordMetrics(
    context: ExecutionContext,
    method: string,
    route: string,
    startTime: [number, number],
    statusCode: number
  ) {
    const res = context.switchToHttp().getResponse<Response>();
    const finalStatus = res.statusCode || statusCode;

    // คำนวณระยะเวลา (Seconds)
    const diff = process.hrtime(startTime);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    const durationInMs = durationInSeconds * 1000;

    // 1. บันทึก Metrics (Prometheus)
    this.metricsService.httpRequestsTotal.inc({
      method,
      route,
      status_code: finalStatus.toString(),
    });

    this.metricsService.httpRequestDuration.observe(
      {
        method,
        route,
        status_code: finalStatus.toString(),
      },
      durationInSeconds
    );

    // 2. บันทึก Log (Winston JSON) - เฉพาะ Request ที่ช้าเกิน 200ms หรือ Error
    // ตาม Req 6.5.1 API Response Time Target < 200ms
    if (durationInMs > 200 || finalStatus >= 400) {
      this.logger.log({
        message: 'HTTP Request Performance',
        method,
        route,
        statusCode: finalStatus,
        durationMs: durationInMs,
        level: finalStatus >= 500 ? 'error' : 'warn',
      });
    }
  }
}
