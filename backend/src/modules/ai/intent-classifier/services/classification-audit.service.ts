// File: src/modules/ai/intent-classifier/services/classification-audit.service.ts
// Change Log
// - 2026-05-19: สร้าง Audit Service สำหรับบันทึก Classification request ลง ai_audit_logs (FR-010, ADR-024).

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AiAuditLog, AiAuditStatus } from '../../entities/ai-audit-log.entity';
import {
  ClassificationInput,
  ClassificationResult,
} from '../interfaces/classification-result.interface';

/** ข้อมูลที่ต้องบันทึก Audit */
export interface ClassificationAuditData {
  input: ClassificationInput;
  result: ClassificationResult;
}

/**
 * Service สำหรับบันทึก Audit Log ของ Classification Requests
 * บันทึก input, output, method, latency, projectPublicId, userPublicId
 * ตาม FR-010 และ SC-006
 */
@Injectable()
export class ClassificationAuditService {
  private readonly logger = new Logger(ClassificationAuditService.name);

  constructor(
    @InjectRepository(AiAuditLog)
    private readonly auditRepo: Repository<AiAuditLog>
  ) {}

  /**
   * บันทึก Classification audit log (fire-and-forget)
   * ไม่ block classification response — ใช้ catch เพื่อป้องกัน error propagation
   */
  async log(data: ClassificationAuditData): Promise<void> {
    try {
      const inputJson = JSON.stringify({
        query: data.input.query,
        projectPublicId: data.input.projectPublicId,
        userPublicId: data.input.userPublicId,
        currentDocumentId: data.input.currentDocumentId,
      });

      const outputJson = JSON.stringify(data.result);

      const audit = this.auditRepo.create({
        aiModel: 'intent-classifier',
        modelName:
          data.result.method === 'llm_fallback'
            ? 'gemma4:e4b'
            : 'pattern-match',
        aiSuggestionJson: {
          intentCode: data.result.intentCode,
          confidence: data.result.confidence,
          method: data.result.method,
          latencyMs: data.result.latencyMs,
        },
        processingTimeMs: data.result.latencyMs,
        confidenceScore: data.result.confidence,
        inputHash: this.sha256(inputJson),
        outputHash: this.sha256(outputJson),
        status: this.mapStatus(data.result),
      });

      await this.auditRepo.save(audit);
    } catch (err) {
      // Fire-and-forget — ไม่ให้ audit failure block classification
      this.logger.error(
        'Failed to save classification audit log',
        err instanceof Error ? err.stack : String(err)
      );
    }
  }

  /** สร้าง SHA-256 hash */
  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /** แปลง classification result เป็น AiAuditStatus */
  private mapStatus(result: ClassificationResult): AiAuditStatus {
    if (
      result.method === 'llm_error' ||
      result.method === 'semaphore_overflow'
    ) {
      return AiAuditStatus.FAILED;
    }
    return AiAuditStatus.SUCCESS;
  }
}
