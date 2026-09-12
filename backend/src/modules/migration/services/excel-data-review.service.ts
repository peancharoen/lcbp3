// File: backend/src/modules/migration/services/excel-data-review.service.ts
// Change Log:
// - 2026-09-06: Initial creation — ExcelDataReviewService orchestrator (T009)
//   ประสาน Layer 1 (Schema) + Layer 2 (Business Rules) + Layer 4 (Stash)
//   สำหรับ POST /check endpoint — Layer 3 (AI) จะถูกเพิ่มใน Wave 4 (T014)
//   ใช้ ExcelRowBuilder เดียวกันทั้ง Check และ Commit (FR-002)
// - 2026-09-06: Fix Wave 3 review findings —
//   1) Sanitize temp filename ด้วย path.basename ป้องกัน path traversal
//   2) Catch workbook parse errors → BadRequestException (ไม่ปล่อย 500)
//   3) แปลง raw Error ของ upload/zip → BadRequestException
//   4) Log cleanup errors ด้วย Logger.warn แทนการ swallow
//   5) Validate project ก่อนสร้าง session/stash (ไม่ทิ้ง dead stash)
//   6) canConfirm รวม global BLOCK + แยกตาม targetMode
//      (MIGRATION_STAGING = partial quarantine, DIRECT_IMPORT = atomic)
// - 2026-09-06: Wave 4 — เพิ่ม Layer 3 (AI Reviewer) + Annotator (T014)
//   7) Layer 3 รันหลัง Layer 2 ด้วย Fail-Open policy (FR-009)
//   8) สร้างไฟล์ annotated .xlsx หลังสร้าง session (FR-010, D4)
//   9) อัปเดต annotatedFilePath ใน Redis session
// - 2026-09-12: Async/polling pattern (ADR-008) — check() คืน sessionId ทันที
//   แล้ว BullMQ worker ประมวลผลใน background, frontend poll GET /status
//   แก้ปัญหา axios timeout 15s ไม่พอสำหรับ AI review 265+ แถว

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import AdmZip from 'adm-zip';
import { Project } from '../../project/entities/project.entity';
import { ExcelRowBuilderService } from './excel-row-builder.service';
import { ExcelSchemaValidatorService } from './excel-schema-validator.service';
import { ExcelBusinessRulesService } from './excel-business-rules.service';
import { ReviewSessionStashService } from './review-session-stash.service';
import { ExcelRowBuilderResult } from './excel-row-builder.service';
import { AiReviewProviderFactory } from './ai-review-provider.factory';
import { ExcelAnnotatorService } from './excel-annotator.service';
import { ExcelQuarantineService } from './excel-quarantine.service';
import { ImportTransaction } from '../entities/import-transaction.entity';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from '../entities/migration-review-queue.entity';
import {
  MigrationError,
  MigrationErrorType,
} from '../entities/migration-error.entity';
import { DataSource } from 'typeorm';
import {
  ReviewFinding,
  ReviewSummaryCounts,
  ReviewTargetMode,
  AiReviewerProvider,
  BatchStrategy,
  ExcelCorrespondenceRow,
  FAST_SELECTIVE_SAMPLE_PERCENT,
  FAST_SELECTIVE_WARN_CAP,
  REVIEW_SESSION_TTL_SECONDS,
} from '../types/excel-review.types';
import {
  QUEUE_IMPORT_REVIEW,
  JOB_IMPORT_REVIEW_CHECK,
} from '../../common/constants/queue.constants';
import {
  ENV_LEGACY_NAS_PATH,
  LEGACY_NAS_PATH_DEFAULT,
} from '../constants/migration.constants';

/**
 * Input สำหรับ check() — มาจาก controller หลังผ่าน DTO validation
 */
export interface CheckReviewInput {
  projectPublicId: string;
  targetMode: ReviewTargetMode;
  aiProvider: AiReviewerProvider;
  batchStrategy: BatchStrategy;
  uploadedBy: string;
  /** ไฟล์ที่อัปโหลด (Multer file shape) */
  file: {
    originalname: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
  };
  /** พาธโฟลเดอร์ Staging PDF บน NAS (MIGRATION_STAGING เท่านั้น) */
  nasFolderPath?: string;
}

/**
 * ผลลัพธ์ check() — ส่งกลับผ่าน API ตาม contracts/import-review-api.yaml
 */
export interface CheckReviewResponse {
  reviewSessionPublicId: string;
  targetMode: ReviewTargetMode;
  totalRows: number;
  passCount: number;
  warnCount: number;
  blockCount: number;
  aiSuggestCount: number;
  canConfirm: boolean;
  downloadAnnotatedUrl: string;
  findings: ReviewFinding[];
  /** AI พร้อมใช้งานหรือไม่ (Fail-Open: false = ข้าม Layer 3) */
  aiAvailable: boolean;
  /** เหตุผลที่ AI ไม่พร้อมใช้งาน (ถ้ามี) */
  aiUnavailableReason?: string;
  /** จำนวนแถวที่ส่งให้ AI ตรวจจริง (อาจน้อยกว่า totalRows ใน FAST_SELECTIVE) */
  aiReviewedRowCount: number;
  /** โหมดการ sampling ที่ใช้: FULL หรือ FAST_SELECTIVE */
  aiSamplingMode: BatchStrategy;
}

/** Input สำหรับ confirm() (T020, FR-014) */
export interface ConfirmInput {
  reviewSessionPublicId: string;
  confirmedBy: string;
}

/** ผลลัพธ์ confirm() */
export interface ConfirmResponse {
  reviewSessionPublicId: string;
  batchId: string;
  targetMode: ReviewTargetMode;
  totalRows: number;
  enqueuedCount: number;
  quarantinedCount: number;
  failedRowsDownloadUrl: string;
  status: 'CONFIRMED';
}

/** Input สำหรับ cancel() (T021, FR-016) */
export interface CancelInput {
  reviewSessionPublicId: string;
  cancelledBy: string;
}

/** ผลลัพธ์ cancel() */
export interface CancelResponse {
  reviewSessionPublicId: string;
  status: 'CANCELLED';
}

/** นามสกุลไฟล์ที่รองรับ */
const SUPPORTED_EXTENSIONS = ['.xlsx', '.zip'];

/**
 * Response ของ POST /check (async pattern — คืนทันที ไม่รอประมวลผล)
 * Frontend ใช้ reviewSessionPublicId เพื่อ poll GET /:sessionId/status
 */
export interface CheckReviewAsyncResponse {
  reviewSessionPublicId: string;
  status: 'PENDING';
  /** URL สำหรับ poll status */
  statusUrl: string;
}

/**
 * Response ของ GET /:sessionId/status (async pattern)
 * เมื่อ status === 'READY' จะมี result (เหมือน CheckReviewResponse เดิม)
 */
export interface ReviewStatusResponse {
  reviewSessionPublicId: string;
  status:
    | 'PENDING'
    | 'PROCESSING'
    | 'READY'
    | 'FAILED'
    | 'CONFIRMED'
    | 'CANCELLED'
    | 'EXPIRED';
  progress?: number;
  currentStep?: string;
  errorMessage?: string;
  /** ผลลัพธ์เมื่อ status === 'READY' (เหมือน CheckReviewResponse เดิม) */
  result?: CheckReviewResponse;
}

/** Redis key prefix สำหรับเก็บ check result (findings + metadata) */
const REVIEW_RESULT_REDIS_PREFIX = 'import_review:result:';

/**
 * ExcelDataReviewService — orchestrator กลางของ 4-Layer Pipeline (T009)
 *
 * หน้าที่ปัจจุบัน (Wave 3):
 * - รับไฟล์ .xlsx หรือ .zip จาก controller
 * - Validate project มีอยู่จริงก่อน (ป้องกัน dead stash)
 * - แตก .zip เพื่อแยก Excel + PDFs (ถ้าเป็น .zip)
 * - รัน Layer 1 (Schema) + Layer 2 (Business Rules)
 * - สร้าง Review Session ใน Redis (24h TTL) + เขียนไฟล์ดิบใน stash
 * - คืน CheckReviewResponse
 *
 * Layer 3 (AI) จะถูกเพิ่มใน Wave 4 (T014) ด้วย Fail-Open policy
 * Confirm/Cancel จะถูกเพิ่มใน Wave 6 (T020/T021)
 */
@Injectable()
export class ExcelDataReviewService {
  private readonly logger = new Logger(ExcelDataReviewService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ImportTransaction)
    private readonly importTxRepo: Repository<ImportTransaction>,
    private readonly dataSource: DataSource,
    private readonly rowBuilder: ExcelRowBuilderService,
    private readonly schemaValidator: ExcelSchemaValidatorService,
    private readonly businessRules: ExcelBusinessRulesService,
    private readonly stash: ReviewSessionStashService,
    private readonly aiFactory: AiReviewProviderFactory,
    private readonly annotator: ExcelAnnotatorService,
    private readonly quarantine: ExcelQuarantineService,
    @InjectRedis()
    private readonly redis: Redis,
    @InjectQueue(QUEUE_IMPORT_REVIEW)
    private readonly importReviewQueue: Queue
  ) {}

  /**
   * รับไฟล์ Excel/ZIP และเริ่ม 4-Layer review แบบ async (ADR-008)
   *
   * Flow:
   * 1. Validate file extension + project
   * 2. สร้าง pending session ใน Redis + เขียนไฟล์ใน stash
   * 3. Queue BullMQ job เพื่อประมวลผลใน background
   * 4. คืน { reviewSessionPublicId, status: 'PENDING' } ทันที
   *
   * Frontend poll GET /:sessionId/status จนกว่า status จะเป็น READY/FAILED
   */
  async check(input: CheckReviewInput): Promise<CheckReviewAsyncResponse> {
    this.logger.log(
      `เริ่ม check (async): project=${input.projectPublicId}, mode=${input.targetMode}, file=${input.file.originalname}`
    );

    // 1) ตรวจนามสกุลไฟล์ — แปลงเป็น BadRequestException (ไม่ปล่อย 500)
    const ext = path.extname(input.file.originalname).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `นามสกุลไฟล์ "${ext}" ไม่รองรับ — รองรับเฉพาะ .xlsx และ .zip`
      );
    }

    // 2) Validate project มีอยู่จริงก่อนสร้าง stash/session (ป้องกัน dead stash)
    const project = await this.projectRepo.findOne({
      where: { publicId: input.projectPublicId },
    });
    if (!project) {
      throw new BadRequestException(
        `ไม่พบโครงการที่มี publicId "${input.projectPublicId}" ในระบบ — ตรวจสอบ projectPublicId อีกครั้ง`
      );
    }

    // 3) สร้าง pending session + เขียนไฟล์ใน stash (async pattern)
    const session = await this.stash.createPendingSession({
      projectPublicId: input.projectPublicId,
      targetMode: input.targetMode,
      uploadedBy: input.uploadedBy,
      selectedAiProvider: input.aiProvider,
      batchStrategy: input.batchStrategy,
      originalFileName: input.file.originalname,
      fileBuffer: input.file.buffer,
      nasFolderPath: input.nasFolderPath,
    });

    // 4) Queue BullMQ job เพื่อประมวลผลใน background (ADR-008)
    await this.importReviewQueue.add(
      JOB_IMPORT_REVIEW_CHECK,
      {
        reviewSessionPublicId: session.reviewSessionPublicId,
      },
      {
        // jobId ซ้ำซ้อนไม่ได้ — ใช้ sessionId เป็น jobId เพื่อ idempotency
        jobId: session.reviewSessionPublicId,
        // timeout ยาวเพราะ AI review 265+ แถวใช้เวลานาน
        removeOnComplete: 100,
        removeOnFail: 100,
      }
    );

    this.logger.log(
      `check (async) queued: session=${session.reviewSessionPublicId}, file=${input.file.originalname}`
    );

    return {
      reviewSessionPublicId: session.reviewSessionPublicId,
      status: 'PENDING',
      statusUrl: `/api/v1/correspondence/import-review/${session.reviewSessionPublicId}/status`,
    };
  }

  /**
   * ประมวลผล 4-Layer review ใน background (เรียกโดย BullMQ worker)
   *
   * Flow:
   * 1. อ่าน session จาก Redis — เปลี่ยน status เป็น PROCESSING
   * 2. อ่านไฟล์จาก stash
   * 3. รัน Layer 1 (Schema) + Layer 2 (Business Rules) + Layer 3 (AI)
   * 4. สร้างไฟล์ annotated .xlsx
   * 5. อัปเดต session ด้วย result + เปลี่ยน status เป็น READY
   * 6. บันทึก CheckReviewResponse ใน Redis (สำหรับ getStatus)
   *
   * ถ้าเกิด error: เปลี่ยน status เป็น FAILED + บันทึก errorMessage
   */
  async processCheck(reviewSessionPublicId: string): Promise<void> {
    const session = await this.stash.getSession(reviewSessionPublicId);
    if (!session) {
      this.logger.warn(
        `processCheck: session ${reviewSessionPublicId} ไม่มีอยู่ — อาจหมดอายุ`
      );
      return;
    }

    if (session.status !== 'PENDING') {
      this.logger.warn(
        `processCheck: session ${reviewSessionPublicId} status=${session.status} — ข้าม (ไม่ใช่ PENDING)`
      );
      return;
    }

    // เปลี่ยน status เป็น PROCESSING
    await this.stash.updateStatus(reviewSessionPublicId, 'PROCESSING');
    await this.stash.updateProgress(reviewSessionPublicId, 5, 'Reading file');

    try {
      // 1) อ่านไฟล์จาก stash
      const fileBuffer = await this.readFileFromStash(session.originalFilePath);
      const file = {
        originalname: session.originalFileName,
        buffer: fileBuffer,
        mimetype: '',
        size: fileBuffer.length,
      };

      // 2) แยก Excel buffer + attachment file names
      await this.stash.updateProgress(
        reviewSessionPublicId,
        10,
        'Extracting Excel'
      );
      const {
        excelBuffer,
        excelFileName,
        attachmentFileNames: zipAttachments,
      } = this.extractExcelAndAttachments(file);

      // 2b) ถ้ามี nasFolderPath (MIGRATION_STAGING) ให้สแกนหา PDFs ใน NAS
      let attachmentFileNames = zipAttachments;
      if (session.nasFolderPath) {
        attachmentFileNames = this.scanNasFolderForPdfs(session.nasFolderPath);
        this.logger.log(
          `NAS folder scan: ${session.nasFolderPath} → ${attachmentFileNames.length} PDFs`
        );
      }

      // 3) รัน ExcelRowBuilder (single parser — FR-002)
      await this.stash.updateProgress(
        reviewSessionPublicId,
        20,
        'Parsing Excel'
      );
      const tmpDir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'excel-review-')
      );
      const sanitizedFileName = this.sanitizeFileName(excelFileName);
      const tmpExcelPath = path.join(tmpDir, sanitizedFileName);
      let parsed: ExcelRowBuilderResult | undefined;
      try {
        await fs.promises.writeFile(tmpExcelPath, excelBuffer);
        try {
          parsed = await this.rowBuilder.buildFromWorkbook(tmpExcelPath);
        } catch (err: unknown) {
          const detail = err instanceof Error ? err.message : 'unknown';
          this.logger.warn(`อ่าน workbook ไม่ได้: ${detail}`);
          throw new BadRequestException(
            `ไม่สามารถอ่านไฟล์ Excel ได้ — ไฟล์อาจเสียหรือรูปแบบไม่ถูกต้อง: ${detail}`
          );
        }
      } finally {
        try {
          await fs.promises.rm(tmpDir, { recursive: true, force: true });
        } catch (cleanupErr: unknown) {
          const detail =
            cleanupErr instanceof Error ? cleanupErr.message : 'unknown';
          this.logger.warn(
            `ไม่สามารถลบ temp dir "${tmpDir}" ได้: ${detail} — อาจต้อง cleanup ด้วย cron`
          );
        }
      }

      if (!parsed) {
        throw new BadRequestException(
          'ไม่สามารถอ่านไฟล์ Excel ได้ — กรุณาตรวจสอบรูปแบบไฟล์อีกครั้ง'
        );
      }

      // 4) Layer 1 — Schema validation
      await this.stash.updateProgress(
        reviewSessionPublicId,
        35,
        'Layer 1: Schema validation'
      );
      const layer1 = this.schemaValidator.validate(parsed);

      // 5) Layer 2 — Business rules
      await this.stash.updateProgress(
        reviewSessionPublicId,
        50,
        'Layer 2: Business rules'
      );
      const layer2 = await this.businessRules.validate({
        rows: layer1.rows,
        projectPublicId: session.projectPublicId,
        targetMode: session.targetMode,
        attachmentFileNames,
      });

      // 6) Layer 3 — AI Reviewer (Fail-Open, FR-009)
      const batchStrategy = session.batchStrategy ?? 'FULL';
      const rowsForAi = this.selectRowsForAi(layer2.rows, batchStrategy);
      const aiRowCount = rowsForAi.length;
      const aiStep =
        aiRowCount > 50
          ? `Layer 3: AI Review (${aiRowCount} แถว — อาจใช้เวลา ${Math.ceil(aiRowCount / 30)}+ นาที)`
          : 'Layer 3: AI Review';
      await this.stash.updateProgress(reviewSessionPublicId, 60, aiStep);

      // Progress ticker: ค่อยๆ เพิ่ม 60% → 84% ระหว่าง AI review
      // (ป้องกัน progress ค้างที่ 60% ตลอดการประมวลผล 10+ นาที)
      let tickerPct = 60;
      const ticker = setInterval(() => {
        if (tickerPct >= 84) return;
        tickerPct += 2;
        void this.stash
          .updateProgress(
            reviewSessionPublicId,
            tickerPct,
            `${aiStep} (${tickerPct}%)`
          )
          .catch(() => undefined); // session อาจหมดอายุระหว่างนั้น — ไม่เป็นไร
      }, 15000); // อัปเดตทุก 15 วินาที

      let aiResult: Awaited<ReturnType<typeof this.aiFactory.review>>;
      try {
        aiResult = await this.aiFactory.review({
          rows: rowsForAi,
          projectPublicId: session.projectPublicId,
          provider: session.selectedAiProvider,
          batchStrategy,
        });
      } finally {
        clearInterval(ticker);
      }

      // 7) รวม findings
      await this.stash.updateProgress(
        reviewSessionPublicId,
        85,
        'Computing results'
      );
      const allFindings = [
        ...layer1.findings,
        ...layer2.findings,
        ...aiResult.findings,
      ];

      // 8) นับ pass/warn/block + canConfirm
      const counts = this.computeCounts(
        layer2.rows,
        allFindings,
        session.targetMode
      );

      // 9) สร้างไฟล์ annotated .xlsx (Fail-Open)
      let annotatedFilePath = '';
      try {
        annotatedFilePath = path.join(
          path.dirname(session.originalFilePath),
          'annotated.xlsx'
        );
        await this.annotator.generateAnnotated({
          originalFilePath: session.originalFilePath,
          rows: layer2.rows,
          counts,
          findings: allFindings,
          outputPath: annotatedFilePath,
        });
        await this.stash.updateAnnotatedPath(
          reviewSessionPublicId,
          annotatedFilePath
        );
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : 'unknown';
        this.logger.warn(
          `สร้างไฟล์ annotated ล้มเหลว: ${detail} — ผู้ใช้ยังสามารถตรวจ findings ได้`
        );
      }

      // 10) อัปเดต session ด้วย result + เปลี่ยน status เป็น READY
      await this.stash.updateResult(reviewSessionPublicId, {
        totalRows: counts.totalRows,
        passCount: counts.passCount,
        warnCount: counts.warnCount,
        blockCount: counts.blockCount,
        aiSuggestCount: counts.aiSuggestCount,
        annotatedFilePath,
      });

      // 11) บันทึก CheckReviewResponse ใน Redis (สำหรับ getStatus)
      const checkResult: CheckReviewResponse = {
        reviewSessionPublicId,
        targetMode: session.targetMode,
        totalRows: counts.totalRows,
        passCount: counts.passCount,
        warnCount: counts.warnCount,
        blockCount: counts.blockCount,
        aiSuggestCount: counts.aiSuggestCount,
        canConfirm: counts.canConfirm,
        downloadAnnotatedUrl: `/api/v1/correspondence/import-review/${reviewSessionPublicId}/download-annotated`,
        findings: allFindings,
        aiAvailable: aiResult.available,
        aiUnavailableReason: aiResult.unavailableReason,
        aiReviewedRowCount: rowsForAi.length,
        aiSamplingMode: batchStrategy,
      };
      await this.redis.set(
        REVIEW_RESULT_REDIS_PREFIX + reviewSessionPublicId,
        JSON.stringify(checkResult),
        'EX',
        REVIEW_SESSION_TTL_SECONDS
      );

      this.logger.log(
        `processCheck เสร็จ: session=${reviewSessionPublicId}, rows=${counts.totalRows}, pass=${counts.passCount}, warn=${counts.warnCount}, block=${counts.blockCount}, ai=${aiResult.available ? 'available' : 'unavailable'} (sampled=${rowsForAi.length}/${counts.totalRows}, mode=${batchStrategy}), canConfirm=${counts.canConfirm}`
      );
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.error(
        `processCheck ล้มเหลว: session=${reviewSessionPublicId}, error=${detail}`
      );
      await this.stash.updateStatus(reviewSessionPublicId, 'FAILED', detail);
    }
  }

  /**
   * อ่านสถานะของ session (async pattern — เรียกโดย GET /:sessionId/status)
   * คืน status + progress + result (เมื่อ status === 'READY')
   */
  async getStatus(
    reviewSessionPublicId: string
  ): Promise<ReviewStatusResponse> {
    const session = await this.stash.getSession(reviewSessionPublicId);
    if (!session) {
      throw new NotFoundException(
        `ไม่พบ Review Session "${reviewSessionPublicId}" — อาจหมดอายุแล้ว (TTL 24 ชั่วโมง)`
      );
    }

    const response: ReviewStatusResponse = {
      reviewSessionPublicId,
      status: session.status,
      progress: session.progress,
      currentStep: session.currentStep,
      errorMessage: session.errorMessage,
    };

    // ถ้า status === 'READY' ให้ดึง result จาก Redis
    if (session.status === 'READY') {
      const raw = await this.redis.get(
        REVIEW_RESULT_REDIS_PREFIX + reviewSessionPublicId
      );
      if (raw) {
        try {
          response.result = JSON.parse(raw) as CheckReviewResponse;
        } catch {
          this.logger.warn(
            `getStatus: parse result ล้มเหลวสำหรับ session ${reviewSessionPublicId}`
          );
        }
      }
    }

    return response;
  }

  /**
   * ดาวน์โหลดไฟล์ annotated .xlsx ของ session ที่ระบุ (T015, FR-013)
   * คืน path ของไฟล์ หรือ throw NotFoundException ถ้า session ไม่มี
   * คืน annotatedFilePath ว่าง ถ้ายังไม่ได้สร้างไฟล์ annotated
   */
  async getAnnotatedFilePath(
    reviewSessionPublicId: string
  ): Promise<{ filePath: string; originalFileName: string }> {
    const session = await this.stash.getSession(reviewSessionPublicId);
    if (!session) {
      throw new NotFoundException(
        `ไม่พบ Review Session "${reviewSessionPublicId}" — อาจหมดอายุแล้ว (TTL 24 ชั่วโมง)`
      );
    }
    if (!session.annotatedFilePath) {
      throw new NotFoundException(
        'ไฟล์ annotated ยังไม่ถูกสร้าง — กรุณาเรียก POST /check ก่อน'
      );
    }
    // บังคับนามสกุล .xlsx เสมอ (แม้ต้นฉบับเป็น .zip) เพราะไฟล์ annotated เป็น .xlsx
    const baseName = path.parse(session.originalFileName).name;
    return {
      filePath: session.annotatedFilePath,
      originalFileName: `annotated-${baseName}.xlsx`,
    };
  }

  /**
   * ดาวน์โหลดไฟล์ failed_rows.xlsx จาก quarantine area (D6, MIGRATION_STAGING)
   * คืน path ของไฟล์ หรือ throw NotFoundException ถ้าไม่มีไฟล์
   */
  async getFailedRowsFilePath(
    reviewSessionPublicId: string
  ): Promise<{ filePath: string }> {
    // ไฟล์ failed_rows.xlsx ถูกย้ายไป quarantine area หลัง confirm
    // ไม่ได้อ่านจาก Redis session เพราะ session ถูกลบไปแล้ว
    const stagingRoot = path.dirname(
      path.dirname(this.stash.getStashDir(reviewSessionPublicId))
    );
    const quarantinePath = path.join(
      stagingRoot,
      'import-review',
      'quarantine-failed-rows',
      `${reviewSessionPublicId}-failed_rows.xlsx`
    );

    try {
      await fs.promises.access(quarantinePath);
    } catch {
      throw new NotFoundException(
        `ไม่พบไฟล์ failed_rows.xlsx สำหรับ session "${reviewSessionPublicId}" — อาจไม่มีแถวที่ถูกกักกัน หรือไฟล์ถูกลบแล้ว`
      );
    }

    return { filePath: quarantinePath };
  }

  /**
   * ยืนยันการนำเข้าข้อมูล (T020, FR-014, FR-015, FR-016, FR-017)
   *
   * ขั้นตอน:
   * 1. อ่าน session จาก Redis (NotFoundException ถ้าหมดอายุ)
   * 2. ตรวจสถานะ session ต้องเป็น READY
   *    และ atomic lock โดยเปลี่ยน status เป็น CONFIRMED ก่อนทำงาน
   *    (ป้องกัน race condition ถ้าผู้ใช้กด confirm ซ้ำ)
   * 3. Re-validate Layer 1 + Layer 2 ซ้ำจากไฟล์ใน stash (FR-014)
   *    - รองรับ .zip: แตก Excel จาก zip ก่อน parse
   *    - ตรวจ global BLOCK จาก layer1.findings + layer2.findings
   * 4. เรียก quarantine.prepareQuarantine แยกแถว
   * 5. บันทึก DB ใน transaction (FR-015 Atomic All-or-Nothing):
   *    - passed rows → migration_review_queue
   *    - quarantined rows → migration_errors
   *    - import_transactions (audit trail)
   * 6. ย้าย failed_rows.xlsx ไป quarantine area ถ้ามี (ก่อน delete stash)
   * 7. ลบ stash directory + Redis key (FR-016)
   */
  async confirm(input: ConfirmInput): Promise<ConfirmResponse> {
    this.logger.log(
      `confirm: session=${input.reviewSessionPublicId}, user=${input.confirmedBy}`
    );

    const session = await this.stash.getSession(input.reviewSessionPublicId);
    if (!session) {
      throw new NotFoundException(
        `ไม่พบ Review Session "${input.reviewSessionPublicId}" — อาจหมดอายุแล้ว (TTL 24 ชั่วโมง)`
      );
    }
    if (session.status !== 'READY') {
      throw new BadRequestException(
        `Session นี้ถูก ${session.status} ไปแล้ว — ไม่สามารถ confirm ซ้ำได้`
      );
    }

    // Atomic lock: เปลี่ยน status เป็น CONFIRMED ก่อนทำงาน
    // ป้องกัน race condition ถ้าผู้ใช้กด confirm ซ้ำ (concurrent requests)
    // ถ้าอัปเดตไม่สำเร็จ = มี request อื่น beat เราไปก่อน
    const locked = await this.stash.tryLockForConfirm(
      input.reviewSessionPublicId
    );
    if (!locked) {
      throw new BadRequestException(
        `Session นี้กำลังถูก confirm โดย request อื่น — กรุณารอสักครู่และลองใหม่`
      );
    }

    const project = await this.projectRepo.findOne({
      where: { publicId: session.projectPublicId },
    });
    if (!project) {
      throw new BadRequestException(
        `โครงการ "${session.projectPublicId}" ไม่มีอยู่อีกแล้ว — ติดต่อผู้ดูแล`
      );
    }

    // Re-validate Layer 1 + Layer 2 (FR-014)
    // รองรับ .zip: แตก Excel จาก zip ก่อน parse (stashed file เป็น original .zip)
    let revalidatedRows: ExcelCorrespondenceRow[];
    let allFindings: ReviewFinding[];
    try {
      const stashedBuffer = await this.readFileFromStash(
        session.originalFilePath
      );
      const { excelBuffer, attachmentFileNames } =
        this.extractExcelAndAttachments({
          originalname: session.originalFileName,
          buffer: stashedBuffer,
        });

      // เขียน Excel buffer ลง temp file สำหรับ rowBuilder
      const tmpDir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), 'confirm-revalidate-')
      );
      const tmpExcelPath = path.join(tmpDir, 'register.xlsx');
      try {
        await fs.promises.writeFile(tmpExcelPath, excelBuffer);
        const parsed = await this.rowBuilder.buildFromWorkbook(tmpExcelPath);
        const layer1 = this.schemaValidator.validate(parsed);
        const layer2 = await this.businessRules.validate({
          rows: layer1.rows,
          projectPublicId: session.projectPublicId,
          targetMode: session.targetMode,
          attachmentFileNames,
        });
        revalidatedRows = layer2.rows;
        allFindings = [...layer1.findings, ...layer2.findings];
      } finally {
        await fs.promises
          .rm(tmpDir, { recursive: true, force: true })
          .catch(() => undefined);
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      throw new BadRequestException(
        `Re-validation ล้มเหลว: ${detail} — กรุณาอัปโหลดไฟล์ใหม่`
      );
    }

    // ตรวจ global BLOCK จาก Layer 1 + Layer 2 findings (FR-014)
    const counts = this.computeCounts(
      revalidatedRows,
      allFindings,
      session.targetMode
    );
    if (!counts.canConfirm) {
      throw new BadRequestException(
        'การตรวจสอบซ้ำพบปัญหา BLOCK ที่ต้องแก้ไข — กรุณาตรวจไฟล์ annotated และแก้ไขก่อน confirm'
      );
    }

    const stashDir = path.dirname(session.originalFilePath);
    const quarantineResult = await this.quarantine.prepareQuarantine({
      reviewSessionPublicId: session.reviewSessionPublicId,
      projectPublicId: session.projectPublicId,
      targetMode: session.targetMode,
      rows: revalidatedRows,
      findings: allFindings,
      stashDir,
      confirmedBy: input.confirmedBy,
    });

    // บันทึก DB ใน transaction (FR-015 Atomic All-or-Nothing)
    let enqueuedCount = 0;
    let quarantinedCount = 0;
    const batchId = quarantineResult.batchId;

    await this.dataSource.transaction(async (txMgr) => {
      if (quarantineResult.passedRows.length > 0) {
        const queueRepo = txMgr.getRepository(MigrationReviewQueue);
        const entities = quarantineResult.passedRows.map((row) => {
          const item = new MigrationReviewQueue();
          item.batchId = batchId;
          item.documentNumber = row.documentNumber;
          item.subject = row.subject;
          item.originalSubject = row.subject;
          item.status = MigrationReviewStatus.PENDING;
          item.projectId = project.id;
          item.receivedDate = row.receivedDate;
          item.issuedDate = row.issuedDate;
          item.remarks = row.remarks;
          return item;
        });
        const saved = await queueRepo.save(entities);
        enqueuedCount = saved.length;
      }

      if (quarantineResult.quarantinedRows.length > 0) {
        const errorRepo = txMgr.getRepository(MigrationError);
        const errors = quarantineResult.quarantinedRows.map((row) => {
          const blockFindings = row.findings.filter((f) => f.level === 'BLOCK');
          const messages = blockFindings.map((f) => f.message).join('; ');
          const err = new MigrationError();
          err.batchId = batchId;
          err.documentNumber = row.documentNumber;
          err.errorType = MigrationErrorType.UNKNOWN;
          err.errorMessage = messages || 'BLOCK finding — ไม่ระบุสาเหตุ';
          return err;
        });
        const saved = await errorRepo.save(errors);
        quarantinedCount = saved.length;
      }

      // Audit trail (FR-017)
      const importTx = new ImportTransaction();
      importTx.idempotencyKey = `import-review-${session.reviewSessionPublicId}`;
      importTx.batchId = batchId;
      importTx.documentNumber = `${enqueuedCount}/${quarantineResult.passedRows.length + quarantineResult.quarantinedRows.length}`;
      importTx.statusCode = 201;
      await txMgr.getRepository(ImportTransaction).save(importTx);
    });

    // ย้าย failed_rows.xlsx ไป quarantine area ก่อนลบ stash (FR-015 D6)
    let failedRowsDownloadUrl = '';
    if (quarantineResult.failedRowsFilePath) {
      try {
        const quarantineDir = path.join(
          path.dirname(stashDir),
          'quarantine-failed-rows'
        );
        await fs.promises.mkdir(quarantineDir, { recursive: true });
        const permanentPath = path.join(
          quarantineDir,
          `${session.reviewSessionPublicId}-failed_rows.xlsx`
        );
        await fs.promises.copyFile(
          quarantineResult.failedRowsFilePath,
          permanentPath
        );
        failedRowsDownloadUrl = `/api/v1/correspondence/import-review/${session.reviewSessionPublicId}/download-failed-rows`;
        this.logger.log(
          `ย้าย failed_rows.xlsx ไป ${permanentPath} (ก่อนลบ stash)`
        );
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : 'unknown';
        this.logger.warn(
          `ย้าย failed_rows.xlsx ล้มเหลว: ${detail} — ผู้ใช้ไม่สามารถดาวน์โหลดได้`
        );
      }
    }

    // Stash cleanup (FR-016)
    await this.stash.deleteSession(session.reviewSessionPublicId);

    this.logger.log(
      `confirm เสร็จ: session=${session.reviewSessionPublicId}, batch=${batchId}, enqueued=${enqueuedCount}, quarantined=${quarantinedCount}`
    );

    return {
      reviewSessionPublicId: session.reviewSessionPublicId,
      batchId,
      targetMode: session.targetMode,
      totalRows:
        quarantineResult.passedRows.length +
        quarantineResult.quarantinedRows.length,
      enqueuedCount,
      quarantinedCount,
      failedRowsDownloadUrl,
      status: 'CONFIRMED',
    };
  }

  /**
   * ยกเลิกการนำเข้าข้อมูล (T021, FR-016)
   */
  async cancel(input: CancelInput): Promise<CancelResponse> {
    this.logger.log(
      `cancel: session=${input.reviewSessionPublicId}, user=${input.cancelledBy}`
    );

    const session = await this.stash.getSession(input.reviewSessionPublicId);
    if (!session) {
      throw new NotFoundException(
        `ไม่พบ Review Session "${input.reviewSessionPublicId}" — อาจหมดอายุแล้ว`
      );
    }
    if (session.status !== 'READY') {
      throw new BadRequestException(
        `Session นี้ถูก ${session.status} ไปแล้ว — ไม่สามารถ cancel ได้`
      );
    }

    await this.stash.deleteSession(session.reviewSessionPublicId);

    this.logger.log(`cancel เสร็จ: session=${input.reviewSessionPublicId}`);

    return {
      reviewSessionPublicId: session.reviewSessionPublicId,
      status: 'CANCELLED',
    };
  }

  // ---------- internals ----------

  /**
   * อ่านไฟล์จาก stash directory เป็น Buffer
   * ใช้สำหรับ re-validation ตอน confirm (FR-014)
   */
  private async readFileFromStash(filePath: string): Promise<Buffer> {
    try {
      return await fs.promises.readFile(filePath);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      throw new BadRequestException(
        `อ่านไฟล์จาก stash ล้มเหลว: ${detail} — ไฟล์อาจถูกลบแล้ว`
      );
    }
  }

  /**
   * Sanitize uploaded filename ป้องกัน path traversal
   * - แปลง backslash เป็น forward slash
   * - เอาเฉพาะ basename (ตัด ../ และ path segments)
   * - ถ้าผลลัพธ์ว่าง ใช้ fallback "register.xlsx"
   */
  private sanitizeFileName(fileName: string): string {
    const normalized = fileName.replace(/\\/g, '/');
    const base = path.basename(normalized);
    return base.trim() !== '' ? base : 'register.xlsx';
  }

  /**
   * แยก Excel buffer + attachment file names จากไฟล์ที่อัปโหลด
   * - .xlsx: คืน buffer เดิม + attachmentFileNames = []
   * - .zip: แตกหา .xlsx และเก็บรายชื่อ PDF
   */
  private extractExcelAndAttachments(file: {
    originalname: string;
    buffer: Buffer;
  }): {
    excelBuffer: Buffer;
    excelFileName: string;
    attachmentFileNames: string[];
  } {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.xlsx') {
      return {
        excelBuffer: file.buffer,
        excelFileName: this.sanitizeFileName(file.originalname),
        attachmentFileNames: [],
      };
    }

    return this.extractFromZip(file.buffer);
  }

  /** แตก .zip เพื่อหา Excel + PDFs — แปลง error เป็น BadRequestException */
  private extractFromZip(zipBuffer: Buffer): {
    excelBuffer: Buffer;
    excelFileName: string;
    attachmentFileNames: string[];
  } {
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      throw new BadRequestException(
        `ไม่สามารถอ่านไฟล์ .zip ได้ — ไฟล์อาจเสียหรือรูปแบบไม่ถูกต้อง: ${detail}`
      );
    }

    const entries = zip.getEntries();
    const attachmentFileNames: string[] = [];
    let excelBuffer: Buffer | undefined;
    let excelFileName = 'register.xlsx';
    let xlsxCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }
      // Sanitize entry name ป้องกัน path traversal ใน zip
      const ext = path.extname(entry.entryName).toLowerCase();
      const baseName = this.sanitizeFileName(entry.entryName);

      if (ext === '.xlsx') {
        xlsxCount++;
        if (!excelBuffer) {
          excelBuffer = entry.getData();
          excelFileName = baseName;
        }
      } else if (ext === '.pdf') {
        attachmentFileNames.push(baseName);
      }
    }

    if (!excelBuffer) {
      throw new BadRequestException(
        'ไม่พบไฟล์ .xlsx ในแพ็กเกจ .zip — ต้องมี Excel register อย่างน้อย 1 ไฟล์'
      );
    }

    if (xlsxCount > 1) {
      this.logger.warn(
        `พบไฟล์ .xlsx ${xlsxCount} ไฟล์ใน .zip — เลือกไฟล์แรก "${excelFileName}" เท่านั้น`
      );
    }

    return {
      excelBuffer,
      excelFileName,
      attachmentFileNames,
    };
  }

  /**
   * สแกนโฟลเดอร์ NAS เพื่อหาไฟล์ PDF (MIGRATION_STAGING mode)
   * ใช้แทนการแตก .zip — ไฟล์แนบอยู่บน NAS อยู่แล้ว (ADR-047)
   *
   * Security: path traversal guard — ต้องอยู่ภายใต้ LEGACY_NAS_PATH
   */
  private scanNasFolderForPdfs(folderPath: string): string[] {
    const basePath = path.resolve(
      process.env[ENV_LEGACY_NAS_PATH] || LEGACY_NAS_PATH_DEFAULT
    );
    const resolvedPath = path.resolve(folderPath);

    // ADR-016: path traversal guard — ต้องอยู่ใต้ basePath เสมอ
    const relative = path.relative(basePath, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      this.logger.warn(
        `NAS folder path traversal blocked: ${folderPath} (base=${basePath})`
      );
      return [];
    }

    if (!fs.existsSync(resolvedPath)) {
      this.logger.warn(`NAS folder not found: ${resolvedPath}`);
      return [];
    }

    const pdfFiles: string[] = [];
    try {
      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.pdf') {
            pdfFiles.push(this.sanitizeFileName(entry.name));
          }
        }
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`ไม่สามารถอ่าน NAS folder "${resolvedPath}": ${detail}`);
    }

    return pdfFiles;
  }

  /**
   * เลือกแถวที่จะส่งให้ AI Reviewer ตาม batchStrategy (Q3, US3 Acceptance 1)
   *
   * - FULL: ส่งทุกแถวให้ AI (default, สำหรับ ≤200 แถว)
   * - FAST_SELECTIVE: ส่งเฉพาะแถวที่ติด WARN + สุ่ม 5% ของแถวที่เหลือ
   *   (สำหรับ >200 แถว เพื่อลดเวลาประมวลผลโดยไม่ติด Rate Limit)
   *
   * หมายเหตุ: แถวที่ติด BLOCK ก็จะถูกส่งให้ AI ด้วยในโหมด FULL
   * เพราะ AI อาจมีคำแนะนำเพิ่มเติม แต่ใน FAST_SELECTIVE จะกรองเฉพาะ
   * WARN เพราะ BLOCK จะถูกจัดการใน Layer 4 อยู่แล้ว
   */
  private selectRowsForAi(
    rows: ExcelCorrespondenceRow[],
    batchStrategy: BatchStrategy
  ): ExcelCorrespondenceRow[] {
    if (batchStrategy === 'FULL') {
      return rows;
    }

    // FAST_SELECTIVE: แยกแถว WARN/BLOCK และแถวที่ผ่าน
    const warnRows = rows.filter((r) =>
      r.findings.some((f) => f.level === 'WARN')
    );
    const passRows = rows.filter(
      (r) => !r.findings.some((f) => f.level === 'WARN' || f.level === 'BLOCK')
    );

    // Fisher-Yates shuffle แบบสุ่มตัวอย่าง (ไม่กลาง array เพื่อหลีกเลี่ยง O(n))
    const sample = <T>(source: T[], size: number): T[] => {
      const sampled: T[] = [];
      const copy = [...source];
      for (let i = 0; i < size && i < copy.length; i++) {
        const j = i + Math.floor(Math.random() * (copy.length - i));
        [copy[i], copy[j]] = [copy[j], copy[i]];
        sampled.push(copy[i]);
      }
      return sampled;
    };

    // Cap WARN rows: ถ้ามี WARN เยอะเกินไป (เช่น migration data ที่ทุกแถวมี WARN
    // จาก master mismatch) ให้สุ่มตัวอย่างแทนการส่งหมด
    // — ป้องกัน FAST_SELECTIVE ส่ง AI ทุกแถวเหมือน FULL mode
    const warnSampleSize = Math.min(warnRows.length, FAST_SELECTIVE_WARN_CAP);
    const sampledWarn =
      warnSampleSize < warnRows.length
        ? sample(warnRows, warnSampleSize)
        : warnRows;

    // สุ่ม 5% ของแถวที่ผ่าน (อย่างน้อย 1 แถว ถ้ามี passRows)
    const passSampleSize = Math.max(
      1,
      Math.ceil(passRows.length * FAST_SELECTIVE_SAMPLE_PERCENT)
    );
    const sampledPass = sample(passRows, passSampleSize);

    // รวม sampled WARN + sampled pass แล้วเรียงตาม row index
    const selected = [...sampledWarn, ...sampledPass];
    selected.sort((a, b) => a.rowIndex - b.rowIndex);

    const warnCapped = warnRows.length > FAST_SELECTIVE_WARN_CAP;
    this.logger.log(
      `FAST_SELECTIVE: ส่ง AI ${selected.length}/${rows.length} แถว ` +
        `(WARN=${sampledWarn.length}/${warnRows.length}${warnCapped ? ` [capped@${FAST_SELECTIVE_WARN_CAP}]` : ''}, ` +
        `sampled=${sampledPass.length}/${passRows.length})`
    );

    return selected;
  }

  /**
   * นับ pass/warn/block จาก rows + findings
   *
   * canConfirm logic (แก้ตาม Wave 3 review):
   * - global BLOCK (row=0) เช่น project-not-found, missing headers → ห้าม confirm
   * - DIRECT_IMPORT: atomic — มี row BLOCK แม้ 1 แถว → ห้าม confirm
   * - MIGRATION_STAGING: partial quarantine — row BLOCK ไป quarantine,
   *   แถวที่ผ่านยัง confirm ได้ (แต่ global BLOCK ยังห้าม confirm)
   */
  private computeCounts(
    rows: ExcelCorrespondenceRow[],
    allFindings: ReviewFinding[],
    targetMode: ReviewTargetMode
  ): ReviewSummaryCounts {
    const totalRows = rows.length;
    const aiSuggestCount = allFindings.filter(
      (f) => f.level === 'AI_SUGGEST'
    ).length;

    // Global blocks = findings ที่ row=0 (ไม่ผูกกับแถวใด) และ level=BLOCK
    const hasGlobalBlock = allFindings.some(
      (f) => f.level === 'BLOCK' && (f.row === 0 || f.row === undefined)
    );

    let blockRows = 0;
    let warnRows = 0;

    // นับแถวตามระดับปัญหาที่รุนแรงที่สุด (BLOCK > WARN)
    // แถวที่มีทั้ง BLOCK และ WARN จะถูกนับเป็น BLOCK เท่านั้น
    // passCount = totalRows - blockRows - warnRows (แถวที่ไม่มีปัญหาเลย)
    for (const row of rows) {
      const hasBlock = row.findings.some((f) => f.level === 'BLOCK');
      const hasWarn = row.findings.some((f) => f.level === 'WARN');
      if (hasBlock) {
        blockRows++;
      } else if (hasWarn) {
        warnRows++;
      }
    }

    const passCount = totalRows - blockRows - warnRows;

    // canConfirm: ไม่มี global block และ (MIGRATION_STAGING อนุญาต partial
    // ส่วน DIRECT_IMPORT ต้องไม่มี row block เลย)
    const hasRowBlock = blockRows > 0;
    const canConfirm =
      !hasGlobalBlock &&
      (targetMode === 'MIGRATION_STAGING' ? true : !hasRowBlock);

    return {
      totalRows,
      passCount,
      warnCount: warnRows,
      blockCount: blockRows,
      aiSuggestCount,
      canConfirm,
    };
  }
}
