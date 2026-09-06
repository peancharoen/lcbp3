// File: backend/src/modules/migration/services/excel-quarantine.service.ts
// Change Log:
// - 2026-09-06: Initial creation — ExcelQuarantineService (T017, FR-015, D6)
//   ทำหน้าที่จัดการ Partial Quarantine สำหรับ MIGRATION_STAGING
//   แยกแถวที่ติด BLOCK ลง migration_errors + สร้าง failed_rows.xlsx
//   ส่งแถวที่ผ่านเข้า migration_review_queue (เตรียมไว้ให้ Wave 6 เรียก)

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import {
  MigrationError,
  MigrationErrorType,
} from '../entities/migration-error.entity';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from '../entities/migration-review-queue.entity';
import { ExcelAnnotatorService } from './excel-annotator.service';
import { ReviewSessionStashService } from './review-session-stash.service';
import {
  ExcelCorrespondenceRow,
  ReviewFinding,
  ReviewTargetMode,
} from '../types/excel-review.types';

/**
 * ผลลัพธ์การ quarantine — สรุปจำนวนแถวที่ผ่าน/ถูกกักกัน
 */
export interface QuarantineResult {
  /** จำนวนแถวที่ผ่าน (จะถูกส่งเข้า migration_review_queue) */
  passedCount: number;
  /** จำนวนแถวที่ถูกกักกัน (บันทึกลง migration_errors) */
  quarantinedCount: number;
  /** แถวที่ผ่าน — พร้อมส่งเข้า staging queue */
  passedRows: ExcelCorrespondenceRow[];
  /** แถวที่ถูกกักกัน — บันทึกลง migration_errors แล้ว */
  quarantinedRows: ExcelCorrespondenceRow[];
  /** Path ของไฟล์ failed_rows.xlsx (ว่าง ถ้าไม่มีแถวถูกกักกัน) */
  failedRowsFilePath: string;
  /** Batch ID ของการ import ครั้งนี้ */
  batchId: string;
}

/**
 * Input สำหรับ quarantine
 * หมายเหตุ: projectPublicId, confirmedBy, findings สงวนไว้สำหรับ Wave 6
 * (Confirm endpoint) ที่จะใช้ใน transactional DB writes + audit log
 */
export interface QuarantineInput {
  reviewSessionPublicId: string;
  /** สงวนไว้สำหรับ Wave 6 — ใช้ใน audit log ตอน confirm */
  projectPublicId: string;
  targetMode: ReviewTargetMode;
  /** แถวทั้งหมดจากการตรวจทาน (มี findings แนบอยู่) */
  rows: ExcelCorrespondenceRow[];
  /** สงวนไว้สำหรับ Wave 6 — ใช้ใน audit log + error detail */
  findings: ReviewFinding[];
  /** Path ของ stash directory สำหรับเขียน failed_rows.xlsx */
  stashDir: string;
  /** สงวนไว้สำหรับ Wave 6 — ใช้ใน audit log ตอน confirm */
  confirmedBy: string;
}

/**
 * ExcelQuarantineService — Partial Quarantine & Ingest logic (T017, FR-015, D6)
 *
 * นโยบายสำหรับ MIGRATION_STAGING:
 * - แถวที่ผ่าน (ไม่มี BLOCK) → ส่งเข้า migration_review_queue (PENDING)
 * - แถวที่ติด BLOCK → บันทึกลง migration_errors + สร้าง failed_rows.xlsx
 *
 * นโยบายสำหรับ DIRECT_IMPORT:
 * - ถ้ามี BLOCK แม้แต่แถวเดียว → ปฏิเสธทั้งชุด (Atomic All-or-Nothing)
 * - ถ้าไม่มี BLOCK → ทุกแถวผ่านเข้า migration_review_queue
 *
 * ไม่ทำ DB transaction ทั้งหมดในนี้ — Wave 6 (Confirm endpoint) จะคุม transaction
 *  service นี้ทำหน้าที่แยกแถว + สร้างไฟล์ + เตรียมข้อมูลให้ Confirm เรียก
 */
@Injectable()
export class ExcelQuarantineService {
  private readonly logger = new Logger(ExcelQuarantineService.name);

  constructor(
    @InjectRepository(MigrationError)
    private readonly errorRepo: Repository<MigrationError>,
    @InjectRepository(MigrationReviewQueue)
    private readonly queueRepo: Repository<MigrationReviewQueue>,
    private readonly annotator: ExcelAnnotatorService,
    private readonly stash: ReviewSessionStashService
  ) {}

  /**
   * แยกแถวเป็น passed / quarantined ตาม BLOCK findings
   * ไม่บันทึก DB — ใช้สำหรับเตรียมข้อมูลก่อน confirm
   */
  splitRows(rows: ExcelCorrespondenceRow[]): {
    passedRows: ExcelCorrespondenceRow[];
    quarantinedRows: ExcelCorrespondenceRow[];
  } {
    const passedRows: ExcelCorrespondenceRow[] = [];
    const quarantinedRows: ExcelCorrespondenceRow[] = [];

    for (const row of rows) {
      const hasBlock = row.findings.some((f) => f.level === 'BLOCK');
      if (hasBlock) {
        quarantinedRows.push(row);
      } else {
        passedRows.push(row);
      }
    }

    return { passedRows, quarantinedRows };
  }

  /**
   * บันทึกแถวที่ผ่านเข้า migration_review_queue (PENDING)
   * เรียกโดย Confirm endpoint ใน Wave 6
   */
  async enqueuePassedRows(
    passedRows: ExcelCorrespondenceRow[],
    batchId: string,
    projectId: number
  ): Promise<MigrationReviewQueue[]> {
    const entities = passedRows.map((row) => {
      const queueItem = new MigrationReviewQueue();
      queueItem.batchId = batchId;
      queueItem.documentNumber = row.documentNumber;
      queueItem.subject = row.subject;
      queueItem.originalSubject = row.subject;
      queueItem.status = MigrationReviewStatus.PENDING;
      queueItem.projectId = projectId;
      queueItem.receivedDate = row.receivedDate;
      queueItem.issuedDate = row.issuedDate;
      queueItem.remarks = row.remarks;
      return queueItem;
    });

    if (entities.length === 0) {
      return [];
    }

    return this.queueRepo.save(entities);
  }

  /**
   * บันทึกแถวที่ถูกกักกันลง migration_errors
   * เรียกโดย Confirm endpoint ใน Wave 6
   */
  async quarantineFailedRows(
    quarantinedRows: ExcelCorrespondenceRow[],
    batchId: string
  ): Promise<MigrationError[]> {
    const errors = quarantinedRows.map((row) => {
      const blockFindings = row.findings.filter((f) => f.level === 'BLOCK');
      const messages = blockFindings.map((f) => f.message).join('; ');
      const err = new MigrationError();
      err.batchId = batchId;
      err.documentNumber = row.documentNumber;
      err.errorType = MigrationErrorType.UNKNOWN;
      err.errorMessage = messages || 'BLOCK finding — ไม่ระบุสาเหตุ';
      return err;
    });

    if (errors.length === 0) {
      return [];
    }

    return this.errorRepo.save(errors);
  }

  /**
   * สร้างไฟล์ failed_rows.xlsx สำหรับแถวที่ถูกกักกัน (T018, D6)
   * ไฟล์จะถูกเขียนใน stash directory ของ session
   */
  async generateFailedRowsExcel(
    quarantinedRows: ExcelCorrespondenceRow[],
    outputPath: string
  ): Promise<string> {
    if (quarantinedRows.length === 0) {
      return '';
    }

    // ใช้ annotator เพื่อสร้างไฟล์ .xlsx ที่มีเฉพาะแถวที่ถูกกักกัน
    // สีแดงอ่อน (#FCE4D6) สำหรับ BLOCK + Cell Comments
    const counts = {
      totalRows: quarantinedRows.length,
      passCount: 0,
      warnCount: 0,
      blockCount: quarantinedRows.length,
      aiSuggestCount: 0,
      canConfirm: false,
    };
    const allFindings = quarantinedRows.flatMap((r) => r.findings);

    // originalFilePath ไม่ถูกอ่านโดย annotator (ใช้แค่ outputPath)
    // ส่ง '' เพราะ failed_rows.xlsx ไม่มีไฟล์ต้นฉบับแยกต่างหาก
    await this.annotator.generateAnnotated({
      originalFilePath: '',
      rows: quarantinedRows,
      counts,
      findings: allFindings,
      outputPath,
    });

    this.logger.log(
      `สร้าง failed_rows.xlsx: ${outputPath} (${quarantinedRows.length} แถว)`
    );

    return outputPath;
  }

  /**
   * ทำ Partial Quarantine ทั้งกระบวนการ (T017)
   * 1. แยกแถว passed / quarantined
   * 2. สร้าง failed_rows.xlsx
   * 3. อัปเดต failedRowsFilePath ใน Redis session
   * 4. คืนผลลัพธ์ให้ Confirm endpoint ใช้บันทึก DB
   *
   * ไม่บันทึก DB ในขั้นนี้ — Confirm endpoint จะทำใน transaction (Wave 6)
   */
  async prepareQuarantine(input: QuarantineInput): Promise<QuarantineResult> {
    // ตรวจ target mode — DIRECT_IMPORT ไม่อนุญาต partial quarantine
    if (input.targetMode === 'DIRECT_IMPORT') {
      const hasBlock = input.rows.some((r) =>
        r.findings.some((f) => f.level === 'BLOCK')
      );
      if (hasBlock) {
        throw new BadRequestException(
          'DIRECT_IMPORT ไม่อนุญาตให้ confirm เมื่อมี BLOCK — กรุณาแก้ไขไฟล์จนไม่มี BLOCK'
        );
      }
    }

    // 1) แยกแถว
    const { passedRows, quarantinedRows } = this.splitRows(input.rows);

    // 2) สร้าง batch ID
    const batchId = uuidv7();

    // 3) สร้าง failed_rows.xlsx ถ้ามีแถวถูกกักกัน
    let failedRowsFilePath = '';
    if (quarantinedRows.length > 0) {
      failedRowsFilePath = `${input.stashDir}/failed_rows.xlsx`;
      try {
        await this.generateFailedRowsExcel(quarantinedRows, failedRowsFilePath);
        // 4) อัปเดต Redis session
        await this.stash.updateFailedRowsPath(
          input.reviewSessionPublicId,
          failedRowsFilePath
        );
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : 'unknown';
        this.logger.warn(
          `สร้าง failed_rows.xlsx ล้มเหลว: ${detail} — แถวที่ถูกกักกันยังบันทึกใน migration_errors ได้`
        );
        failedRowsFilePath = '';
      }
    }

    this.logger.log(
      `prepareQuarantine: session=${input.reviewSessionPublicId}, passed=${passedRows.length}, quarantined=${quarantinedRows.length}, batch=${batchId}`
    );

    return {
      passedCount: passedRows.length,
      quarantinedCount: quarantinedRows.length,
      passedRows,
      quarantinedRows,
      failedRowsFilePath,
      batchId,
    };
  }
}
