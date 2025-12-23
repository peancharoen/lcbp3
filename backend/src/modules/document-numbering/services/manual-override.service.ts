import { Injectable, Logger } from '@nestjs/common';
import { CounterService } from './counter.service';
import { AuditService } from './audit.service';
import { ManualOverrideDto } from '../dto/manual-override.dto';

@Injectable()
export class ManualOverrideService {
  private readonly logger = new Logger(ManualOverrideService.name);

  constructor(
    private readonly counterService: CounterService,
    private readonly auditService: AuditService
  ) {}

  async applyOverride(dto: ManualOverrideDto, userId: number): Promise<void> {
    this.logger.log(
      `Applying manual override by user ${userId}: ${JSON.stringify(dto)}`
    );

    // 1. Force update the counter
    await this.counterService.forceUpdateCounter(dto, dto.newLastNumber);

    // 2. Log Audit
    await this.auditService.log({
      documentId: undefined, // No specific document
      generatedNumber: `OVERRIDE-TO-${dto.newLastNumber}`,
      operation: 'MANUAL_OVERRIDE',
      status: 'MANUAL',
      counterKey: dto, // CounterKeyDto part of ManualOverrideDto
      templateUsed: 'MANUAL_OVERRIDE',
      userId: userId,
      isSuccess: true,
      metadata: { reason: dto.reason, reference: dto.reference },
      totalDurationMs: 0,
    });
  }
}
