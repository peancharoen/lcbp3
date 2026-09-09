// File: backend/src/modules/maintenance/services/numbering-tools.service.ts
// Change Log:
// - 2026-09-07: Numbering Tools skeleton for Maintenance Console (Feature 253 — T094)
// - 2026-09-09: Full rewrite — the skeleton queried a table (document_numbering_counters
//   with a single string counter_key column) that never existed; the real table is
//   document_number_counters with a 7-column composite primary key (see
//   document-numbering/entities/document-number-counter.entity.ts). This service now
//   reads/writes through the existing, safe document-numbering services instead of
//   raw SQL against an invented schema — see the plan doc for the full root-cause
//   analysis and why precise "missing number" enumeration is intentionally not
//   attempted (correspondence_number templates are admin-configurable and
//   non-fixed-width, so reverse-parsing sequence numbers out of them is unsafe).

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ValidationException } from '../../../common/exceptions/base.exception';
import { UuidResolverService } from '../../../common/services/uuid-resolver.service';
import { DocumentNumberCounter } from '../../document-numbering/entities/document-number-counter.entity';
import { DocumentNumberAudit } from '../../document-numbering/entities/document-number-audit.entity';
import { CounterKeyDto } from '../../document-numbering/dto/counter-key.dto';
import { ManualOverrideDto } from '../../document-numbering/dto/manual-override.dto';
import { ManualOverrideService } from '../../document-numbering/services/manual-override.service';

export interface NumberingGapResult {
  counterKey: string;
  expectedNext: number;
  actualNext: number;
  missingNumbers: number[];
}

export interface NumberingOverrideResult {
  counterKey: string;
  previousValue: number;
  newValue: number;
  voidedNumbers: number[];
}

/** จำกัดช่วงเวลาที่ดึง audit trail มาเทียบ — ป้องกัน full table scan บนตารางที่โตเรื่อยๆ */
const AUDIT_LOOKBACK_DAYS = 400;

const COUNTER_KEY_FIELDS = [
  'projectId',
  'originatorOrganizationId',
  'recipientOrganizationId',
  'correspondenceTypeId',
  'subTypeId',
  'rfaTypeId',
  'disciplineId',
] as const;

/**
 * บริการ Numbering Tools สำหรับ Maintenance Console
 * - Gap audit (สัญญาณ mismatch เท่านั้น ไม่ enumerate เลขที่หายเป๊ะๆ), manual override
 *   (delegate ไป ManualOverrideService ที่มี audit trail + safe write อยู่แล้ว)
 */
@Injectable()
export class NumberingToolsService {
  private readonly logger = new Logger(NumberingToolsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly manualOverrideService: ManualOverrideService,
    private readonly uuidResolverService: UuidResolverService
  ) {}

  private toCounterKeyDto(counter: DocumentNumberCounter): CounterKeyDto {
    return {
      projectId: counter.projectId,
      originatorOrganizationId: counter.originatorId,
      recipientOrganizationId: counter.recipientOrganizationId,
      correspondenceTypeId: counter.correspondenceTypeId,
      subTypeId: counter.subTypeId,
      rfaTypeId: counter.rfaTypeId,
      disciplineId: counter.disciplineId,
      resetScope: counter.resetScope,
    };
  }

  /**
   * เทียบ counterKey ของ audit row (JSON, รูปแบบอาจไม่ตรงกัน 100% ระหว่าง
   * buildCounterKey() กับ generateNextNumber() — ดู plan doc) กับ key ของ counter
   * โดยเทียบทีละ field แทนการเทียบ JSON string ตรงๆ
   */
  private counterKeyMatches(
    auditCounterKey: Record<string, unknown>,
    key: CounterKeyDto
  ): boolean {
    for (const field of COUNTER_KEY_FIELDS) {
      if (Number(auditCounterKey[field]) !== key[field]) return false;
    }
    return String(auditCounterKey['resetScope']) === key.resetScope;
  }

  /**
   * ตรวจสัญญาณ gap: เทียบ last_number (เพิ่มขึ้นใน transaction ของตัวเองเสมอ ไม่ว่า
   * flow ที่เรียกจะสำเร็จหรือไม่ — นี่คือกลไกที่ทำให้เกิด gap จริงตาม ADR-002) กับ
   * จำนวน audit row ที่สำเร็จจริง (GENERATE/CONFIRM, isSuccess=true) ของ key เดียวกัน
   * ไม่ enumerate เลขที่หายเป๊ะๆ เพราะ correspondence_number ใช้ template ที่ config ได้
   * ต่อ project/type และ token ความยาวไม่คงที่ — reverse-parse เลข sequence ออกมาไม่ปลอดภัย
   */
  async findGaps(projectPublicId?: string): Promise<NumberingGapResult[]> {
    const projectId = projectPublicId
      ? await this.uuidResolverService.resolveProjectId(projectPublicId)
      : undefined;

    const counterRepo = this.dataSource.getRepository(DocumentNumberCounter);
    const counters = await counterRepo.find({
      where: projectId ? { projectId } : {},
    });

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - AUDIT_LOOKBACK_DAYS);
    const auditRepo = this.dataSource.getRepository(DocumentNumberAudit);
    const successfulAudits = await auditRepo
      .createQueryBuilder('audit')
      .where('audit.operation IN (:...ops)', {
        ops: ['GENERATE', 'CONFIRM'],
      })
      .andWhere('audit.isSuccess = true')
      .andWhere('audit.createdAt >= :lookback', { lookback: lookbackDate })
      .getMany();

    return counters.map((counter) => {
      const key = this.toCounterKeyDto(counter);
      const successfulCount = successfulAudits.filter((audit) =>
        this.counterKeyMatches(audit.counterKey, key)
      ).length;

      return {
        counterKey: JSON.stringify(key),
        expectedNext: counter.lastNumber + 1,
        actualNext: successfulCount + 1,
        // ไม่สามารถ enumerate เลขที่หายเป๊ะๆ ได้อย่างน่าเชื่อถือ (ดู comment ด้านบน) —
        // expectedNext !== actualNext คือสัญญาณว่าน่าจะมี gap ให้ admin ตรวจสอบต่อ
        missingNumbers: [],
      };
    });
  }

  /**
   * ไม่ auto-correct last_number อีกต่อไป — ไม่มี ground truth ที่เชื่อถือได้พอจะเขียนทับ
   * Tier-1 counter state แบบไม่มีคนตรวจสอบ (เสี่ยงออกเลขซ้ำในอนาคตถ้า sync ผิด) การแก้ไข
   * ต้องผ่าน overrideCounter() ทีละตัวพร้อมเหตุผลที่ admin ระบุเท่านั้น
   */
  async syncCounters(projectPublicId?: string): Promise<{ updated: number }> {
    const gaps = await this.findGaps(projectPublicId);
    const withGapSignal = gaps.filter(
      (g) => g.expectedNext !== g.actualNext
    ).length;
    this.logger.warn(
      `syncCounters: automatic correction is disabled — ${withGapSignal} counter(s) show a gap signal. ` +
        `Use overrideCounter() with a reviewed reason for deliberate, audited correction instead.`
    );
    return { updated: 0 };
  }

  /**
   * Manual override — parse counterKey token แล้ว delegate ไป ManualOverrideService
   * ที่มี safe force-update (CounterService.forceUpdateCounter) + audit trail
   * (document_number_audit, operation=MANUAL_OVERRIDE) อยู่แล้ว ไม่ raw SQL
   */
  async overrideCounter(
    counterKeyToken: string,
    newLastNumber: number,
    userId: number,
    reason: string
  ): Promise<NumberingOverrideResult> {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(counterKeyToken) as Record<string, unknown>;
    } catch {
      throw new ValidationException(
        'Malformed counterKey token: not valid JSON',
        undefined,
        'รูปแบบ counterKey ไม่ถูกต้อง กรุณาคัดลอกค่าจากรายการที่สแกนไว้'
      );
    }

    for (const field of COUNTER_KEY_FIELDS) {
      if (
        typeof parsed[field] !== 'number' ||
        !Number.isFinite(parsed[field])
      ) {
        throw new ValidationException(
          `Malformed counterKey token: field "${field}" is not a number`,
          undefined,
          'รูปแบบ counterKey ไม่ถูกต้อง กรุณาคัดลอกค่าจากรายการที่สแกนไว้'
        );
      }
    }
    if (
      typeof parsed['resetScope'] !== 'string' ||
      parsed['resetScope'].trim().length === 0
    ) {
      throw new ValidationException(
        'Malformed counterKey token: resetScope missing',
        undefined,
        'รูปแบบ counterKey ไม่ถูกต้อง กรุณาคัดลอกค่าจากรายการที่สแกนไว้'
      );
    }

    const key = parsed as unknown as CounterKeyDto;

    const counterRepo = this.dataSource.getRepository(DocumentNumberCounter);
    const existing = await counterRepo.findOne({
      where: {
        projectId: key.projectId,
        originatorId: key.originatorOrganizationId,
        recipientOrganizationId: key.recipientOrganizationId,
        correspondenceTypeId: key.correspondenceTypeId,
        subTypeId: key.subTypeId,
        rfaTypeId: key.rfaTypeId,
        disciplineId: key.disciplineId,
        resetScope: key.resetScope,
      },
    });
    const previousValue = existing?.lastNumber ?? 0;

    const dto: ManualOverrideDto = {
      ...key,
      newLastNumber,
      reason,
    };
    await this.manualOverrideService.applyOverride(dto, userId);

    return {
      counterKey: counterKeyToken,
      previousValue,
      newValue: newLastNumber,
      // เหตุผลเดียวกับ missingNumbers ใน findGaps — ไม่ enumerate เลขที่ถูก void เป๊ะๆ
      voidedNumbers: [],
    };
  }
}
