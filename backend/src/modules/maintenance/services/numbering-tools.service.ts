// File: backend/src/modules/maintenance/services/numbering-tools.service.ts
// Change Log:
// - 2026-09-07: Numbering Tools skeleton for Maintenance Console (Feature 253 — T094)

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  BusinessException,
  NotFoundException,
} from '../../../common/exceptions/base.exception';

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

/**
 * บริการ Numbering Tools สำหรับ Maintenance Console
 * - Gap audit, counter sync, manual override, void & replace
 */
@Injectable()
export class NumberingToolsService {
  private readonly logger = new Logger(NumberingToolsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * ตรวจหาเลขที่เอกสารที่ขาดหายไปในแต่ละ counter
   */
  async findGaps(projectId?: string): Promise<NumberingGapResult[]> {
    const where = projectId ? 'WHERE project_id = ?' : '';
    const params = projectId ? [projectId] : [];
    const rows = await this.dataSource.query<
      Array<{
        counter_key: string;
        last_number: number;
      }>
    >(
      `SELECT counter_key, last_number FROM document_numbering_counters ${where} ORDER BY counter_key`,
      params
    );

    const results: NumberingGapResult[] = [];
    for (const row of rows) {
      // หาเลขที่ใช้จริงจาก correspondences ตาม counter_key (prefix/project/type)
      const usedRows = await this.dataSource.query<
        Array<{ used_number: number }>
      >(
        `SELECT CAST(SUBSTRING(correspondence_number FROM -(? + 1)) AS UNSIGNED) AS used_number
         FROM correspondences
         WHERE correspondence_number LIKE CONCAT(?, '%')
         ORDER BY used_number`,
        [10, row.counter_key]
      );
      const usedNumbers = usedRows.map((r) => Number(r.used_number));
      const missing: number[] = [];
      for (let n = 1; n < row.last_number; n += 1) {
        if (!usedNumbers.includes(n) && n < row.last_number) {
          missing.push(n);
        }
      }

      results.push({
        counterKey: row.counter_key,
        expectedNext: row.last_number + 1,
        actualNext: (usedNumbers[usedNumbers.length - 1] ?? 0) + 1,
        missingNumbers: missing.slice(0, 50), // จำกัดผลลัพธ์
      });
    }

    return results;
  }

  /**
   * Sync counter ให้ตรงกับเลขที่ใช้จริงสูงสุด + 1
   */
  async syncCounters(projectId?: string): Promise<{ updated: number }> {
    const gaps = await this.findGaps(projectId);
    let updated = 0;
    for (const gap of gaps) {
      if (gap.expectedNext !== gap.actualNext) {
        await this.dataSource.query(
          'UPDATE document_numbering_counters SET last_number = ? WHERE counter_key = ?',
          [gap.actualNext - 1, gap.counterKey]
        );
        updated += 1;
        this.logger.log(
          `Synced counter ${gap.counterKey} to ${gap.actualNext - 1}`
        );
      }
    }
    return { updated };
  }

  /**
   * Manual override — กำหนดค่า counter ด้วยตนเอง (void ช่วงที่ข้าม)
   */
  async overrideCounter(
    counterKey: string,
    newLastNumber: number,
    userId: number
  ): Promise<NumberingOverrideResult> {
    const row = await this.dataSource.query<Array<{ last_number: number }>>(
      'SELECT last_number FROM document_numbering_counters WHERE counter_key = ? FOR UPDATE',
      [counterKey]
    );
    if (row.length === 0) {
      throw new NotFoundException('document numbering counter', counterKey);
    }
    const previousValue = row[0].last_number;
    if (newLastNumber < previousValue) {
      throw new BusinessException(
        'NUMBERING_OVERRIDE_INVALID',
        `newLastNumber ${newLastNumber} is less than previous value ${previousValue}`,
        'ไม่สามารถกำหนดเลขล่าสุดให้น้อยกว่าค่าปัจจุบันได้',
        [
          'ระบุเลขล่าสุดที่มากกว่าหรือเท่ากับค่าปัจจุบัน',
          'ตรวจสอบ counter ก่อนแก้ไข',
        ]
      );
    }

    const voided: number[] = [];
    for (let n = previousValue + 1; n <= newLastNumber; n += 1) {
      voided.push(n);
    }

    await this.dataSource.query(
      'UPDATE document_numbering_counters SET last_number = ?, updated_by = ?, updated_at = NOW() WHERE counter_key = ?',
      [newLastNumber, userId, counterKey]
    );

    return {
      counterKey,
      previousValue,
      newValue: newLastNumber,
      voidedNumbers: voided,
    };
  }
}
