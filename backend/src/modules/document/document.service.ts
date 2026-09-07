// File: backend/src/modules/document/document.service.ts
// Change Log:
// - 2026-09-07: Generic bulk operations (cancel/tag/export/progress) for cross-type documents (Feature 253 — T087-T089)
// - 2026-09-07: Add TTL eviction for bulkStore to prevent memory leak (Code Review M3)
// - 2026-09-07: Implement real CSV export with metadata columns (Code Review L5)
// - 2026-09-07: Add Redis Redlock around bulk-cancel per document (FR-041)
// - 2026-09-07: Pre-filter CANCELLED documents in bulk cancel (FR-018)
// - 2026-09-07: Back bulk operations with BullMQ (cancel/tag/export)

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotFoundException,
  BusinessException,
  ValidationException,
} from '../../common/exceptions/base.exception';
import { randomUUID } from 'crypto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { DataSource } from 'typeorm';
import { QUEUE_BULK_OPERATIONS } from '../../modules/common/constants/queue.constants';
import { User } from '../user/entities/user.entity';
import { CorrespondenceService } from '../correspondence/correspondence.service';
import { RfaService } from '../rfa/rfa.service';
import { TransmittalService } from '../transmittal/transmittal.service';
import { ContractDrawingService } from '../drawing/contract-drawing.service';
import { CirculationService } from '../circulation/circulation.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { ExportFormat } from '../../common/dto/bulk-export.dto';

type BulkOperationStatus = {
  bulkId: string;
  total: number;
  completed: number;
  failed: number;
  failedItems: string[];
  done: boolean;
  result?: {
    downloadUrl?: string;
    filename?: string;
    mimeType?: string;
    buffer?: Buffer;
  };
  /** Timestamp เมื่อ operation เสร็จสิ้น (สำหรับ TTL eviction) */
  completedAt?: number;
  /** Timeout handle สำหรับ cleanup */
  evictionTimer?: ReturnType<typeof setTimeout>;
};

/** TTL สำหรับเก็บ bulk operation results (5 นาที) */
const BULK_STORE_TTL_MS = 5 * 60 * 1000;

/** Payload สำหรับ bulk cancel job (BullMQ) */
export interface BulkCancelJobData {
  type: 'cancel';
  bulkId: string;
  publicIds: string[];
  documentType: string;
  reason: string;
  userId: number;
}

/** Payload สำหรับ bulk tag job (BullMQ) */
export interface BulkTagJobData {
  type: 'tag';
  bulkId: string;
  publicIds: string[];
  documentType: string;
  addTags: number[];
  removeTags: number[];
  userId: number;
}

/** Payload สำหรับ bulk export job (BullMQ) */
export interface BulkExportJobData {
  type: 'export';
  bulkId: string;
  publicIds: string[];
  documentType: string;
  format: ExportFormat;
  columns: string[] | undefined;
  userId: number;
}

/** Union สำหรับ BullMQ bulk operation jobs */
export type BulkOperationJobData =
  | BulkCancelJobData
  | BulkTagJobData
  | BulkExportJobData;

/**
 * บริการจัดการเอกสารแบบ cross-type
 * รวม bulk operations ที่ไม่ขึ้นกับ module ใด module หนึ่ง (T087-T089)
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  /** In-memory progress store สำหรับ async bulk operations (T087-T089) */
  private readonly bulkStore = new Map<string, BulkOperationStatus>();
  private readonly redlock: Redlock;

  constructor(
    private readonly correspondenceService: CorrespondenceService,
    private readonly rfaService: RfaService,
    private readonly transmittalService: TransmittalService,
    private readonly contractDrawingService: ContractDrawingService,
    private readonly circulationService: CirculationService,
    private readonly uuidResolver: UuidResolverService,
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_BULK_OPERATIONS)
    private readonly bulkQueue: Queue,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.redlock = new Redlock([this.redis], {
      driftFactor: 0.01,
      retryCount: 5,
      retryDelay: 100,
      retryJitter: 50,
    });
  }

  /**
   * ยกเลิกเอกสารหลายรายการพร้อมกัน (T077-T082/T087)
   * - แยก dispatch ตาม document type
   * - รายงาน partial failure
   * - คืน bulkId สำหรับ polling progress
   */
  async bulkCancel(
    publicIds: string[],
    documentType: string,
    reason: string,
    user: User
  ): Promise<{ bulkId: string }> {
    this.validateBulkInput(publicIds, documentType);

    const bulkId = this.createBulk(publicIds);
    const jobData: BulkCancelJobData = {
      type: 'cancel',
      bulkId,
      publicIds,
      documentType,
      reason,
      userId: user.user_id,
    };

    await this.bulkQueue.add('process', jobData, {
      jobId: bulkId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return { bulkId };
  }

  /**
   * แก้ไขแท็กเอกสารหลายรายการพร้อมกัน (T088)
   * ปัจจุบันเป็น cross-type stub — อนุญาตเฉพาะ CORRESPONDENCE
   * addTags/removeTags เป็น tag IDs (integer FKs)
   */
  async bulkTag(
    publicIds: string[],
    documentType: string,
    addTags: number[],
    removeTags: number[]
  ): Promise<{ bulkId: string }> {
    this.validateBulkInput(publicIds, documentType);

    const bulkId = this.createBulk(publicIds);
    const jobData: BulkTagJobData = {
      type: 'tag',
      bulkId,
      publicIds,
      documentType,
      addTags,
      removeTags,
      userId: 0, // tag ไม่ต้องใช้ user context ในขณะนี้
    };

    await this.bulkQueue.add('process', jobData, {
      jobId: bulkId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return { bulkId };
  }

  /**
   * ส่งออก metadata เอกสารหลายรายการพร้อมกัน (T089)
   * สร้าง CSV จาก publicIds ที่ส่งมา และเก็บ URL สำหรับดาวน์โหลด
   */
  async bulkExport(
    publicIds: string[],
    documentType: string,
    format: ExportFormat,
    columns: string[] | undefined,
    user: User
  ): Promise<{ bulkId: string; downloadUrl?: string }> {
    this.validateBulkInput(publicIds, documentType);

    if (format !== ExportFormat.CSV) {
      throw new ValidationException('Unsupported export format', [
        { field: 'format', message: 'รองรับเฉพาะการส่งออกรูปแบบ CSV ในขณะนี้' },
      ]);
    }

    const bulkId = this.createBulk(publicIds);
    const jobData: BulkExportJobData = {
      type: 'export',
      bulkId,
      publicIds,
      documentType,
      format,
      columns,
      userId: user.user_id,
    };

    await this.bulkQueue.add('process', jobData, {
      jobId: bulkId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return { bulkId };
  }

  /**
   * ประมวลผล cancel job จาก BullMQ worker (FR-041/BullMQ)
   */
  async processCancelJob(jobData: BulkCancelJobData): Promise<void> {
    const user = { user_id: jobData.userId } as User;
    await this.processBulkWithCancelFilter(
      jobData.bulkId,
      jobData.publicIds,
      jobData.documentType,
      user,
      async (publicId) => {
        await this.cancelOne(
          publicId,
          jobData.documentType,
          jobData.reason,
          user
        );
      }
    );
  }

  /**
   * ประมวลผล tag job จาก BullMQ worker
   */
  async processTagJob(jobData: BulkTagJobData): Promise<void> {
    await this.processBulk(
      jobData.bulkId,
      jobData.publicIds,
      async (publicId) => {
        if (jobData.documentType === 'CORRESPONDENCE') {
          const id = await this.uuidResolver.resolveCorrespondenceId(publicId);
          for (const tagId of jobData.addTags) {
            await this.correspondenceService.addTag(id, tagId);
          }
          for (const tagId of jobData.removeTags) {
            await this.correspondenceService.removeTag(id, tagId);
          }
          return;
        }
        throw new BusinessException(
          'BULK_TAG_UNSUPPORTED_TYPE',
          `Bulk tag not yet implemented for ${jobData.documentType}`,
          'ยังไม่รองรับการแก้ไขแท็กสำหรับประเภทเอกสารนี้',
          ['เลือกประเภทเอกสารที่รองรับ', 'ติดต่อผู้ดูแลระบบ']
        );
      }
    );
  }

  /**
   * ประมวลผล export job จาก BullMQ worker
   */
  async processExportJob(jobData: BulkExportJobData): Promise<void> {
    const user = { user_id: jobData.userId } as User;
    await this.processBulk(jobData.bulkId, jobData.publicIds, async () => {
      // no-op per item; CSV สร้างทีเดียวตอนจบ
    });
    await this.generateExportBuffer(
      jobData.bulkId,
      jobData.publicIds,
      jobData.documentType,
      jobData.format,
      jobData.columns,
      user
    );
  }

  /**
   * ดึงความคืบหน้าของ bulk operation
   */
  getBulkProgress(bulkId: string): {
    total: number;
    completed: number;
    failed: number;
    done: boolean;
    downloadUrl?: string;
    failedItems?: string[];
  } {
    const op = this.bulkStore.get(bulkId);
    if (!op) {
      throw new NotFoundException('bulk operation', bulkId);
    }
    return {
      total: op.total,
      completed: op.completed,
      failed: op.failed,
      done: op.done,
      downloadUrl: op.result?.downloadUrl,
      failedItems: op.failedItems,
    };
  }

  /**
   * ดึงไฟล์ที่สร้างจาก bulk export
   */
  getBulkDownload(
    bulkId: string
  ): { buffer: Buffer; filename: string; mimeType: string } | undefined {
    const op = this.bulkStore.get(bulkId);
    if (!op?.result?.buffer) return undefined;
    return {
      buffer: op.result.buffer,
      filename:
        op.result.filename ??
        `export-${bulkId}.${this.getExt(op.result.mimeType ?? 'text/csv')}`,
      mimeType: op.result.mimeType ?? 'text/csv',
    };
  }

  private validateBulkInput(publicIds: string[], documentType: string): void {
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      throw new ValidationException('publicIds must not be empty', [
        {
          field: 'publicIds',
          message: 'ต้องระบุรายการเอกสารอย่างน้อย 1 รายการ',
        },
      ]);
    }

    if (publicIds.length > 100) {
      throw new ValidationException('publicIds exceeds maximum of 100', [
        {
          field: 'publicIds',
          message: 'สามารถประมวลผลได้สูงสุด 100 รายการต่อครั้ง',
        },
      ]);
    }
    const allowedTypes = [
      'CORRESPONDENCE',
      'RFA',
      'TRANSMITTAL',
      'DRAWING',
      'CIRCULATION',
    ];
    if (!allowedTypes.includes(documentType)) {
      throw new ValidationException('Invalid document type', [
        {
          field: 'documentType',
          message: `ประเภทเอกสาร ${documentType} ไม่ถูกต้อง`,
        },
      ]);
    }
  }

  private createBulk(publicIds: string[]): string {
    const bulkId = randomUUID();
    this.bulkStore.set(bulkId, {
      bulkId,
      total: publicIds.length,
      completed: 0,
      failed: 0,
      failedItems: [],
      done: false,
    });
    return bulkId;
  }

  /**
   * กรองเอกสารที่ CANCELLED แล้วออกก่อน process ยกเลิกจริง (FR-018)
   * สำหรับ CORRESPONDENCE ตรวจด้วย current revision + correspondence_status
   * สำหรับประเภทอื่นยังไม่มีเกณฑ์ CANCELLED ชัดเจน — ปล่อยผ่านให้ per-item guard จัดการ
   */
  private async preFilterCancelled(
    publicIds: string[],
    documentType: string
  ): Promise<string[]> {
    if (documentType !== 'CORRESPONDENCE') {
      return [];
    }
    if (publicIds.length === 0) {
      return [];
    }
    try {
      const placeholders = publicIds.map(() => '?').join(',');
      const sql = `SELECT c.uuid
        FROM correspondences c
        INNER JOIN correspondence_revisions cr ON cr.correspondence_id = c.id AND cr.is_current = true
        INNER JOIN correspondence_status cs ON cs.id = cr.correspondence_status_id
        WHERE c.uuid IN (${placeholders}) AND cs.status_code = 'CANCELLED'`;
      const rows: unknown = await this.dataSource.query(sql, publicIds);
      const arr = rows as Array<{ uuid: string }>;
      return arr.map((r) => r.uuid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`preFilterCancelled for ${documentType} failed: ${msg}`);
      return [];
    }
  }

  /**
   * processBulk สำหรับ bulk cancel ที่ pre-filter CANCELLED ก่อน
   */
  private async processBulkWithCancelFilter(
    bulkId: string,
    publicIds: string[],
    documentType: string,
    user: User,
    processor: (publicId: string) => Promise<void>
  ): Promise<void> {
    const op = this.bulkStore.get(bulkId);
    if (!op) return;

    const cancelledIds = await this.preFilterCancelled(publicIds, documentType);
    const toProcess = publicIds.filter((id) => !cancelledIds.includes(id));

    // รายการที่ CANCELLED แล้วถือว่าเสร็จ — ไม่ต้องยกเลิกซ้ำ
    op.completed = cancelledIds.length;

    if (toProcess.length === 0) {
      op.done = true;
      op.completedAt = Date.now();
      this.scheduleEviction(bulkId);
      return;
    }

    await this.processBulk(bulkId, toProcess, processor, {
      documentType,
      userId: user.user_id,
    });
  }

  private async processBulk(
    bulkId: string,
    publicIds: string[],
    processor: (publicId: string) => Promise<void>,
    auditContext?: { documentType: string; userId: number }
  ): Promise<void> {
    const op = this.bulkStore.get(bulkId);
    if (!op) return;

    for (const publicId of publicIds) {
      try {
        await processor(publicId);
        op.completed++;
        if (auditContext) {
          void this.persistBulkItemAudit(bulkId, publicId, auditContext);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Bulk operation ${bulkId} failed for ${publicId}: ${msg}`
        );
        op.failed++;
        op.failedItems.push(publicId);
      }
    }

    op.done = true;
    op.completedAt = Date.now();
    this.scheduleEviction(bulkId);
  }

  /**
   * บันทึก audit log ทีละรายการสำหรับ bulk operation (FR-038)
   * best-effort — ไม่ throw ถ้าบันทึก audit ล้มเหลว
   */
  private async persistBulkItemAudit(
    bulkId: string,
    publicId: string,
    auditContext: { documentType: string; userId: number }
  ): Promise<void> {
    try {
      const repo = this.dataSource.getRepository(AuditLog);
      await repo.save(
        repo.create({
          userId: auditContext.userId,
          action: 'BULK_CANCEL_ITEM',
          entityType: auditContext.documentType.toLowerCase(),
          entityId: publicId,
          severity: 'INFO',
          detailsJson: { bulkId },
        })
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to persist bulk item audit for ${publicId} in ${bulkId}: ${msg}`
      );
    }
  }

  /**
   * กำหนดเวลาลบ entry ออกจาก bulkStore หลังจาก TTL
   * ป้องกัน memory leak จาก completed operations ที่ไม่ถูก cleanup
   */
  private scheduleEviction(bulkId: string): void {
    const op = this.bulkStore.get(bulkId);
    if (!op) return;
    if (op.evictionTimer) clearTimeout(op.evictionTimer);
    op.evictionTimer = setTimeout(() => {
      this.bulkStore.delete(bulkId);
      this.logger.debug(`Evicted bulk operation ${bulkId} from store (TTL)`);
    }, BULK_STORE_TTL_MS);
    // ไม่ให้ timer กั้น process exit
    op.evictionTimer.unref?.();
  }

  private async cancelOne(
    publicId: string,
    documentType: string,
    reason: string,
    user: User
  ): Promise<void> {
    const lockKey = `lock:bulk-cancel:${publicId}`;
    const lockTtl = 10000;
    let lock: Lock | null = null;

    try {
      lock = await this.redlock.acquire([lockKey], lockTtl);
      switch (documentType) {
        case 'CORRESPONDENCE':
          await this.correspondenceService.cancel(publicId, reason, user);
          return;
        case 'RFA':
          await this.rfaService.cancel(publicId, user);
          return;
        case 'TRANSMITTAL':
          await this.transmittalService.cancel(publicId, reason, user);
          return;
        case 'DRAWING': {
          const id = await this.uuidResolver.resolve(
            'ContractDrawing',
            'contract_drawings',
            'id',
            publicId
          );
          await this.contractDrawingService.remove(id, user, reason);
          return;
        }
        case 'CIRCULATION':
          await this.circulationService.forceClose(publicId, reason, user);
          return;
        default:
          throw new BusinessException(
            'BULK_CANCEL_UNSUPPORTED_TYPE',
            `Unsupported document type for bulk cancel: ${documentType}`,
            'ไม่รองรับการยกเลิกเอกสารประเภทนี้',
            ['เลือกประเภทเอกสารที่รองรับ', 'ตรวจสอบประเภทเอกสาร']
          );
      }
    } finally {
      if (lock) {
        try {
          await lock.release();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to release bulk-cancel lock for ${publicId}: ${msg}`
          );
        }
      }
    }
  }

  /**
   * สร้าง CSV export buffer จาก metadata ของเอกสาร
   * ดึงข้อมูลจริงจากแต่ละ document type service
   */
  private async generateExportBuffer(
    bulkId: string,
    publicIds: string[],
    documentType: string,
    _format: ExportFormat,
    columns: string[] | undefined,
    _user: User
  ): Promise<void> {
    // กำหนด columns เริ่มต้นตาม document type
    const defaultColumns =
      columns && columns.length > 0
        ? columns
        : this.getDefaultExportColumns(documentType);

    // ดึง metadata สำหรับแต่ละ publicId
    const rows: Record<string, string | number>[] = [];
    for (const publicId of publicIds) {
      try {
        const meta = await this.fetchDocumentMetadata(publicId, documentType);
        const row: Record<string, string | number> = {};
        for (const col of defaultColumns) {
          row[col] = meta[col] ?? '';
        }
        rows.push(row);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Export: failed to fetch metadata for ${documentType}:${publicId}: ${msg}`
        );
        const emptyRow: Record<string, string | number> = { publicId };
        for (const col of defaultColumns) {
          if (col !== 'publicId') emptyRow[col] = '';
        }
        rows.push(emptyRow);
      }
    }

    // สร้าง CSV
    const header = defaultColumns.join(',');
    const csvLines = rows.map((row) =>
      defaultColumns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          const str = String(val);
          // CSV escaping: ถ้ามี comma, quote, หรือ newline ให้ wrap ด้วย double quotes
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    );
    const csv = [header, ...csvLines].join('\n');
    const buffer = Buffer.from('\uFEFF' + csv, 'utf-8');

    const op = this.bulkStore.get(bulkId);
    if (op) {
      op.result = {
        buffer,
        filename: `export-${documentType.toLowerCase()}-${bulkId}.csv`,
        mimeType: 'text/csv',
        downloadUrl: `/documents/bulk/${bulkId}/download`,
      };
    }
  }

  /**
   * คอลัมน์เริ่มต้นสำหรับ export ตาม document type
   */
  private getDefaultExportColumns(documentType: string): string[] {
    const base: string[] = [
      'publicId',
      'documentType',
      'documentNo',
      'subject',
      'status',
      'createdAt',
    ];
    switch (documentType) {
      case 'CORRESPONDENCE':
        return [...base, 'fromOrg', 'toOrg', 'docDate'];
      case 'RFA':
        return [...base, 'rfaType', 'discipline'];
      case 'TRANSMITTAL':
        return [...base, 'sender', 'recipient'];
      case 'DRAWING':
        return [...base, 'drawingNo', 'revision', 'discipline'];
      case 'CIRCULATION':
        return [...base, 'circulationNo', 'closedAt'];
      default:
        return base;
    }
  }

  /**
   * ดึง metadata ของเอกสารตาม type สำหรับ export
   * ใช้ Record<string, unknown> เพื่อรองรับ property ที่แตกต่างกันในแต่ละ entity
   */
  private async fetchDocumentMetadata(
    publicId: string,
    documentType: string
  ): Promise<Record<string, string | number>> {
    const getStr = (obj: Record<string, unknown>, key: string): string => {
      const val = obj[key];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'string') return val;
      if (typeof val === 'number' || typeof val === 'boolean')
        return String(val);
      return '';
    };

    switch (documentType) {
      case 'CORRESPONDENCE': {
        const doc = await this.correspondenceService.findOneByUuid(publicId);
        const d = doc as unknown as Record<string, unknown>;
        return {
          publicId,
          documentType,
          documentNo: getStr(d, 'correspondenceNumber'),
          subject: getStr(d, 'subject'),
          status: getStr(d, 'status'),
          createdAt: getStr(d, 'createdAt'),
          fromOrg: getStr(d, 'fromOrganization'),
          toOrg: getStr(d, 'toOrganization'),
          docDate: getStr(d, 'documentDate'),
        };
      }
      case 'RFA': {
        const doc = await this.rfaService.findOneByUuid(publicId);
        const d = doc as unknown as Record<string, unknown>;
        return {
          publicId,
          documentType,
          documentNo: getStr(d, 'rfaNumber'),
          subject: getStr(d, 'subject'),
          status: getStr(d, 'status'),
          createdAt: getStr(d, 'createdAt'),
          rfaType: getStr(d, 'rfaType'),
          discipline: getStr(d, 'discipline'),
        };
      }
      case 'TRANSMITTAL': {
        const doc = await this.transmittalService.findOneByUuid(publicId);
        const d = doc as unknown as Record<string, unknown>;
        return {
          publicId,
          documentType,
          documentNo: getStr(d, 'transmittalNumber'),
          subject: getStr(d, 'subject'),
          status: getStr(d, 'status'),
          createdAt: getStr(d, 'createdAt'),
          sender: getStr(d, 'sender'),
          recipient: getStr(d, 'recipient'),
        };
      }
      case 'DRAWING': {
        const doc = await this.contractDrawingService.findOneByUuid(publicId);
        const d = doc as unknown as Record<string, unknown>;
        return {
          publicId,
          documentType,
          documentNo: getStr(d, 'drawingNumber'),
          subject: getStr(d, 'title'),
          status: getStr(d, 'status'),
          createdAt: getStr(d, 'createdAt'),
          drawingNo: getStr(d, 'drawingNumber'),
          revision: getStr(d, 'revision'),
          discipline: getStr(d, 'discipline'),
        };
      }
      case 'CIRCULATION': {
        const doc = await this.circulationService.findOneByUuid(publicId);
        const d = doc as unknown as Record<string, unknown>;
        return {
          publicId,
          documentType,
          documentNo: getStr(d, 'circulationNo'),
          subject: getStr(d, 'subject'),
          status: getStr(d, 'statusCode'),
          createdAt: getStr(d, 'createdAt'),
          circulationNo: getStr(d, 'circulationNo'),
          closedAt: getStr(d, 'closedAt'),
        };
      }
      default:
        return { publicId, documentType };
    }
  }

  private getExt(mimeType: string): string {
    if (mimeType.includes('json')) return 'json';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'xlsx';
    return 'csv';
  }
}
