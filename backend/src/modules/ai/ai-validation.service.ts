// File: src/modules/ai/ai-validation.service.ts
// Service ตรวจสอบผลลัพธ์จาก AI ก่อน Write ลง Database (ADR-018 Rule 4)

import { Injectable, Logger } from '@nestjs/common';
import { AiCallbackDto } from './dto/ai-callback.dto';
import { AiAuditStatus } from './entities/ai-audit-log.entity';

// ผลการตรวจสอบ AI Output
export interface AiValidationResult {
  isValid: boolean;
  action: ConfidenceAction;
  confidence: number;
  reasons: string[]; // เหตุผลที่ validation ผ่านหรือไม่ผ่าน
}

// Action ที่ต้องทำตามระดับ Confidence (ADR-020 Confidence Scoring Strategy)
export type ConfidenceAction =
  | 'auto_approve' // 0.95-1.00: นำเข้าอัตโนมัติ (Migration เท่านั้น)
  | 'low_priority_review' // 0.85-0.94: รอตรวจสอบ ลำดับต่ำ
  | 'high_priority_review' // 0.60-0.84: รอตรวจสอบ ลำดับสูง
  | 'reject'; // <0.60: ปฏิเสธ ต้องกรอกเอง

// Discipline values ที่ถูกต้องตาม Prompt Strategy ใน ADR-020
const VALID_DISCIPLINES = [
  'Civil',
  'Mechanical',
  'Electrical',
  'Architectural',
] as const;
type ValidDiscipline = (typeof VALID_DISCIPLINES)[number];

function isValidDiscipline(value: unknown): value is ValidDiscipline {
  return (
    typeof value === 'string' &&
    (VALID_DISCIPLINES as readonly string[]).includes(value)
  );
}

@Injectable()
export class AiValidationService {
  private readonly logger = new Logger(AiValidationService.name);

  // Confidence Thresholds ตาม ADR-020
  private readonly THRESHOLD_AUTO_APPROVE = 0.95;
  private readonly THRESHOLD_LOW_PRIORITY = 0.85;
  private readonly THRESHOLD_HIGH_PRIORITY = 0.6;

  // กำหนด Action ตาม Confidence Score
  getConfidenceAction(confidence: number): ConfidenceAction {
    if (confidence >= this.THRESHOLD_AUTO_APPROVE) return 'auto_approve';
    if (confidence >= this.THRESHOLD_LOW_PRIORITY) return 'low_priority_review';
    if (confidence >= this.THRESHOLD_HIGH_PRIORITY)
      return 'high_priority_review';
    return 'reject';
  }

  // ตรวจสอบ AI Output ก่อน Write ลง Database (ADR-018 Rule 4)
  validateAiOutput(payload: AiCallbackDto): AiValidationResult {
    const reasons: string[] = [];

    // 1. ตรวจสอบ Status จาก AI
    if (payload.status !== AiAuditStatus.SUCCESS) {
      reasons.push(`AI processing failed with status: ${payload.status}`);
      this.logger.warn(
        `AI validation failed — status=${payload.status}, model=${payload.aiModel}`
      );
      return { isValid: false, action: 'reject', confidence: 0, reasons };
    }

    // 2. ตรวจสอบ Confidence Score
    const confidence = payload.confidenceScore ?? 0;
    const action = this.getConfidenceAction(confidence);

    if (action === 'reject') {
      reasons.push(
        `Confidence score ${confidence} is below minimum threshold ${this.THRESHOLD_HIGH_PRIORITY}`
      );
    }

    // 3. ตรวจสอบ Extracted Metadata (Enum Enforcement)
    if (payload.extractedMetadata) {
      const { discipline } = payload.extractedMetadata;
      if (discipline !== undefined && !isValidDiscipline(discipline)) {
        reasons.push(
          `Invalid discipline value: "${String(discipline)}". Must be one of: ${VALID_DISCIPLINES.join(', ')}`
        );
      }

      // ตรวจสอบรูปแบบ Date
      if (payload.extractedMetadata.date) {
        const dateStr = String(payload.extractedMetadata.date);
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          reasons.push(
            `Invalid date format: "${dateStr}". Expected YYYY-MM-DD`
          );
        }
      }
    }

    const isValid = action !== 'reject' && reasons.length === 0;

    this.logger.log(
      `AI validation — model=${payload.aiModel}, confidence=${confidence}, action=${action}, valid=${isValid}`
    );

    return { isValid, action, confidence, reasons };
  }

  // สร้าง Summary สำหรับ Log (ADR-018 Rule 5 Audit Logging)
  buildAuditSummary(
    payload: AiCallbackDto,
    validationResult: AiValidationResult
  ): string {
    return [
      `model=${payload.aiModel}`,
      `confidence=${validationResult.confidence}`,
      `action=${validationResult.action}`,
      `valid=${validationResult.isValid}`,
      validationResult.reasons.length > 0
        ? `reasons=[${validationResult.reasons.join('; ')}]`
        : null,
    ]
      .filter(Boolean)
      .join(', ');
  }
}
