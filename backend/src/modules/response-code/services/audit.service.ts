// File: src/modules/response-code/services/audit.service.ts
// Change Log:
// - 2026-05-13: Add response code audit service for review task response code changes.

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../../common/entities/audit-log.entity';

@Injectable()
export class ResponseCodeAuditService {
  private readonly logger = new Logger(ResponseCodeAuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>
  ) {}

  /**
   * บันทึก audit trail เมื่อมีการเลือกหรือเปลี่ยน Response Code บน Review Task
   */
  async logReviewTaskResponseCodeChange(input: {
    reviewTaskPublicId: string;
    responseCodePublicId: string;
    previousResponseCodeId?: number;
    currentResponseCodeId: number;
    comments?: string;
    userId?: number;
  }): Promise<void> {
    const auditLog = this.auditLogRepo.create({
      userId: input.userId ?? null,
      action: 'response_code.change',
      severity: 'INFO',
      entityType: 'review_task',
      entityId: input.reviewTaskPublicId,
      detailsJson: {
        previousResponseCodeId: input.previousResponseCodeId ?? null,
        currentResponseCodeId: input.currentResponseCodeId,
        responseCodePublicId: input.responseCodePublicId,
        comments: input.comments ?? null,
      },
    });

    await this.auditLogRepo.save(auditLog);
    this.logger.debug(
      `Recorded response code audit for review task ${input.reviewTaskPublicId}`
    );
  }
}
