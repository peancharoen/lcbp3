// File: backend/src/modules/migration/services/legacy-ingestion.service.ts
// Change Log:
// - 2026-08-20: สร้าง Native Ingestion Engine สำหรับอ่าน Excel ขนาดใหญ่ (Streaming) และนำเข้าสู่ Staging Queue (ADR-047)
// - 2026-08-25: ลบ auto-enqueue BullMQ ออกจาก Ingestion — ผู้ใช้ต้องกด Start Extract เอง (D156)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
  MigrationAiStatus,
  CompareStatus,
} from '../entities/migration-review-queue.entity';
import {
  MigrationProgress,
  MigrationProgressStatus,
} from '../../ai/entities/migration-progress.entity';
import {
  MigrationError,
  MigrationErrorType,
} from '../entities/migration-error.entity';
import { Project } from '../../project/entities/project.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { CorrespondenceType } from '../../correspondence/entities/correspondence-type.entity';
import {
  NotFoundException,
  ValidationException,
} from '../../../common/exceptions';
import { StartIngestDto } from '../dto/start-ingest.dto';

export interface IngestSummary {
  batchId: string;
  totalRowsProcessed: number;
  enqueuedCount: number;
  skippedCount: number;
  errorCount: number;
  lastProcessedIndex: number;
  status: 'COMPLETED' | 'PAUSED' | 'FAILED';
}

export type IngestProgressCallback = (progress: {
  processed: number;
  enqueued: number;
  skipped: number;
  errors: number;
  currentDocumentNumber?: string;
}) => void;

interface ColumnMapping {
  docNumberCol: number;
  subjectCol: number;
  issuedDateCol: number;
  receivedDateCol: number;
  fromCol: number;
  toCol: number;
  categoryCol: number;
  correspondenceTypeIdCol: number;
  fileNameCol: number;
  remarksCol: number;
}

@Injectable()
export class LegacyIngestionService {
  private readonly logger = new Logger(LegacyIngestionService.name);

  constructor(
    @InjectRepository(MigrationReviewQueue)
    private readonly reviewQueueRepo: Repository<MigrationReviewQueue>,
    @InjectRepository(MigrationProgress)
    private readonly progressRepo: Repository<MigrationProgress>,
    @InjectRepository(MigrationError)
    private readonly errorRepo: Repository<MigrationError>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(CorrespondenceType)
    private readonly correspondenceTypeRepo: Repository<CorrespondenceType>,
    @InjectQueue('ai-batch')
    private readonly aiBatchQueue: Queue
  ) {}

  /**
   * เริ่มต้นกระบวนการ Streaming Ingestion จากไฟล์ Excel
   */
  async startIngestion(
    dto: StartIngestDto,
    onProgress?: IngestProgressCallback
  ): Promise<IngestSummary> {
    const { filePath, projectPublicId, sheetName, pdfFolderPath, resume } = dto;

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Excel File', filePath);
    }

    // 1. ตรวจสอบและค้นหา Project จาก UUIDv7
    const project = await this.projectRepo.findOne({
      where: { publicId: projectPublicId },
    });
    if (!project) {
      throw new NotFoundException('Project', projectPublicId);
    }

    // 2. โหลด Master Organizations ไว้ใน Memory Cache สำหรับ Lookup
    const allOrgs = await this.organizationRepo.find();
    const orgMap = new Map<string, number>();
    for (const org of allOrgs) {
      orgMap.set(org.organizationCode.trim().toUpperCase(), org.id);
      orgMap.set(org.organizationName.trim().toUpperCase(), org.id);
    }

    // 2b. โหลด Master Correspondence Types สำหรับ resolve ค่า type_id จาก Excel
    const allCorrespondenceTypes = await this.correspondenceTypeRepo.find();
    const correspondenceTypeById = new Map<number, CorrespondenceType>();
    const correspondenceTypeByCode = new Map<string, CorrespondenceType>();
    for (const ct of allCorrespondenceTypes) {
      correspondenceTypeById.set(ct.id, ct);
      correspondenceTypeByCode.set(ct.typeCode.trim().toUpperCase(), ct);
    }

    // 3. กำหนด Batch ID และตรวจสอบ Checkpoint เดิม
    const batchId =
      dto.batchId ||
      `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    let startIndex = 0;
    let progressEntity = await this.progressRepo.findOne({
      where: { batchId },
    });

    if (progressEntity) {
      if (resume) {
        startIndex = progressEntity.lastProcessedIndex || 0;
        this.logger.log(
          `Resuming batch [${batchId}] from row index ${startIndex}`
        );
      }
    } else {
      progressEntity = this.progressRepo.create({
        batchId,
        lastProcessedIndex: 0,
        status: MigrationProgressStatus.RUNNING,
      });
      await this.progressRepo.save(progressEntity);
    }

    const stagingFolder =
      pdfFolderPath ||
      process.env.MIGRATION_STAGING_DIR ||
      path.join(process.cwd(), 'uploads/staging');

    let totalRowsProcessed = 0;
    let enqueuedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    let columnMapping: ColumnMapping | null = null;
    let currentRowIndex = 0;

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
    });

    try {
      for await (const worksheetReader of workbookReader) {
        // กรอง Sheet หากมีการระบุ sheetName เจาะจง
        const currentSheetName = (
          worksheetReader as unknown as { name?: string }
        ).name;
        if (sheetName && currentSheetName && currentSheetName !== sheetName) {
          continue;
        }

        const headerRowBuffer: unknown[][] = [];

        for await (const row of worksheetReader) {
          currentRowIndex++;

          // ตรวจจับ Header Mapping จากหลายแถวแรก (รองรับ Excel ที่มีหัวเรื่อง/คำอธิบายก่อนแถว Header)
          if (!columnMapping) {
            const rowValues = row.values as unknown[];
            headerRowBuffer.push(rowValues);
            if (headerRowBuffer.length > 5) {
              throw new ValidationException(
                'ไม่พบคอลัมน์เลขที่เอกสาร (Document Number) ในหัวตาราง Excel'
              );
            }
            columnMapping = this.detectHeaderMapping(headerRowBuffer);
            if (columnMapping.docNumberCol === -1) {
              continue;
            }
            continue;
          }

          // ข้ามแถวที่เคยประมวลผลแล้วกรณีสั่ง Resume
          if (currentRowIndex <= startIndex) {
            skippedCount++;
            continue;
          }

          totalRowsProcessed++;

          try {
            const rawValues = row.values as unknown[];
            const docNumber = this.extractCellString(
              rawValues[columnMapping.docNumberCol]
            )?.trim();

            // ข้ามแถวที่ไม่มีเลขที่เอกสาร
            if (!docNumber) {
              skippedCount++;
              continue;
            }

            const subject = this.extractCellString(
              rawValues[columnMapping.subjectCol]
            );
            const issuedDate = this.parseDateCell(
              rawValues[columnMapping.issuedDateCol]
            );
            const receivedDate = this.parseDateCell(
              rawValues[columnMapping.receivedDateCol]
            );
            const category = this.extractCellString(
              rawValues[columnMapping.categoryCol]
            );
            const rawCorrespondenceTypeId = this.extractCellString(
              rawValues[columnMapping.correspondenceTypeIdCol]
            );
            const rawFileName = this.extractCellString(
              rawValues[columnMapping.fileNameCol]
            );
            const remarks = this.extractCellString(
              rawValues[columnMapping.remarksCol]
            );

            const rawSender = this.extractCellString(
              rawValues[columnMapping.fromCol]
            );
            const rawReceiver = this.extractCellString(
              rawValues[columnMapping.toCol]
            );

            const senderOrgId = rawSender
              ? orgMap.get(rawSender.trim().toUpperCase())
              : undefined;
            const receiverOrgId = rawReceiver
              ? orgMap.get(rawReceiver.trim().toUpperCase())
              : undefined;

            const unresolvedOrgs: Record<string, string> = {};
            if (rawSender && !senderOrgId)
              unresolvedOrgs.sender = rawSender.trim();
            if (rawReceiver && !receiverOrgId)
              unresolvedOrgs.receiver = rawReceiver.trim();

            // แปลงค่า correspondence_type จาก Excel (ID หรือ Code) เป็น type_code
            let resolvedCategory: string | undefined;
            const normalizedCategory =
              rawCorrespondenceTypeId || (category ?? '');
            const numericCategory = Number(normalizedCategory);
            if (!isNaN(numericCategory) && numericCategory > 0) {
              const ct = correspondenceTypeById.get(numericCategory);
              if (ct) resolvedCategory = ct.typeCode;
            } else if (normalizedCategory) {
              const ct = correspondenceTypeByCode.get(
                normalizedCategory.trim().toUpperCase()
              );
              if (ct) resolvedCategory = ct.typeCode;
            }

            // ตรวจสอบการมีอยู่ของไฟล์ PDF บน Staging Disk
            let resolvedPdfPath: string | null = null;
            if (rawFileName) {
              resolvedPdfPath = this.resolveStagingPdf(
                stagingFolder,
                rawFileName
              );
              if (!resolvedPdfPath) {
                await this.logError(
                  batchId,
                  docNumber,
                  MigrationErrorType.FILE_NOT_FOUND,
                  `ไม่พบไฟล์ PDF '${rawFileName}' ในโฟลเดอร์ Staging: ${stagingFolder}`
                );
              }
            }

            // บันทึกหรืออัปเดตลง migration_review_queue
            // FR-007: หากเลขที่เอกสารซ้ำใน Batch เดียวกัน ให้เพิ่ม revisionNumber
            let queueItem = await this.reviewQueueRepo.findOne({
              where: { documentNumber: docNumber },
            });

            // ตรวจหา duplicate ใน batch เดียวกัน → สร้าง revision suffix
            let finalDocNumber = docNumber;
            let revisionNumber = 0;
            if (queueItem && queueItem.batchId === batchId) {
              // หา revision ถัดไปที่ไม่ซ้ำ
              revisionNumber = 1;
              while (true) {
                finalDocNumber = `${docNumber}-R${revisionNumber}`;
                const existing = await this.reviewQueueRepo.findOne({
                  where: { documentNumber: finalDocNumber },
                });
                if (!existing) break;
                revisionNumber++;
              }
              queueItem = null; // สร้างรายการใหม่สำหรับ revision
            }

            if (!queueItem) {
              queueItem = this.reviewQueueRepo.create({
                documentNumber: finalDocNumber,
                batchId,
              });
            }

            queueItem.subject = subject || undefined;
            queueItem.originalSubject = subject || undefined;
            queueItem.aiSuggestedCategory =
              resolvedCategory ?? category ?? undefined;
            queueItem.projectId = project.id;
            queueItem.senderOrganizationId = senderOrgId;
            queueItem.receiverOrganizationId = receiverOrgId;
            queueItem.issuedDate = issuedDate;
            queueItem.receivedDate = receivedDate;
            queueItem.remarks = remarks || undefined;
            queueItem.status = MigrationReviewStatus.PENDING;
            queueItem.aiStatus = MigrationAiStatus.PENDING;
            queueItem.compareStatus = CompareStatus.COMPARED;
            queueItem.details = {
              source_file_path: resolvedPdfPath || rawFileName || undefined,
              unresolved_orgs:
                Object.keys(unresolvedOrgs).length > 0
                  ? unresolvedOrgs
                  : undefined,
              original_row_index: currentRowIndex,
              original_document_number:
                revisionNumber > 0 ? docNumber : undefined,
              revision_number: revisionNumber > 0 ? revisionNumber : undefined,
            };

            await this.reviewQueueRepo.save(queueItem);
            enqueuedCount++;

            // ADR-047: ห้าม auto-enqueue BullMQ ในขั้นตอน Ingestion
            // ผู้ใช้ต้องกด "Start Extract" เองเพื่อส่งงานเข้า BullMQ (D156)
            // Ingestion เก็บเฉพาะ source_file_path ใน details เพื่อให้ Start Extract ใช้ภายหลัง
            // aiStatus คงเป็น PENDING (ค่าเริ่มต้น) จนกว่าผู้ใช้จะกด Start Extract

            // บันทึก Checkpoint ทุก 50 แถว
            if (currentRowIndex % 50 === 0) {
              await this.progressRepo.update(
                { batchId },
                {
                  lastProcessedIndex: currentRowIndex,
                  status: MigrationProgressStatus.RUNNING,
                }
              );
            }

            if (onProgress) {
              onProgress({
                processed: totalRowsProcessed,
                enqueued: enqueuedCount,
                skipped: skippedCount,
                errors: errorCount,
                currentDocumentNumber: docNumber,
              });
            }
          } catch (rowError: unknown) {
            errorCount++;
            const errMsg =
              rowError instanceof Error ? rowError.message : String(rowError);
            this.logger.error(
              `Error processing row ${currentRowIndex}: ${errMsg}`
            );
            await this.logError(
              batchId,
              `ROW-${currentRowIndex}`,
              MigrationErrorType.AI_PARSE_ERROR,
              errMsg
            );
          }
        }

        // หากประมวลผล Sheet แรกเสร็จแล้ว และไม่ได้ระบุ SheetName ให้จบการอ่าน
        if (!sheetName) {
          break;
        }
      }

      // บันทึกสถานะสำเร็จ
      await this.progressRepo.update(
        { batchId },
        {
          lastProcessedIndex: currentRowIndex,
          status: MigrationProgressStatus.COMPLETED,
        }
      );

      return {
        batchId,
        totalRowsProcessed,
        enqueuedCount,
        skippedCount,
        errorCount,
        lastProcessedIndex: currentRowIndex,
        status: 'COMPLETED',
      };
    } catch (streamError: unknown) {
      await this.progressRepo.update(
        { batchId },
        {
          lastProcessedIndex: currentRowIndex,
          status: MigrationProgressStatus.FAILED,
        }
      );
      throw streamError;
    }
  }

  /**
   * ตรวจจับ Header Mapping จากหลายแถวแรกของ Excel อัตโนมัติ (TH / EN)
   * รองรับหัวเรื่อง/คำอธิบายก่อนแถว Header จริง (ADR-047)
   */
  private detectHeaderMapping(headerRows: unknown[][]): ColumnMapping {
    const mapping: ColumnMapping = {
      docNumberCol: -1,
      subjectCol: -1,
      issuedDateCol: -1,
      receivedDateCol: -1,
      fromCol: -1,
      toCol: -1,
      categoryCol: -1,
      correspondenceTypeIdCol: -1,
      fileNameCol: -1,
      remarksCol: -1,
    };

    if (!Array.isArray(headerRows) || headerRows.length === 0) return mapping;

    const colHeaders = new Map<number, string[]>();
    for (const rowValues of headerRows) {
      if (!Array.isArray(rowValues)) continue;
      for (let col = 1; col < rowValues.length; col++) {
        const header = this.extractCellString(rowValues[col])?.trim();
        if (!header) continue;
        const existing = colHeaders.get(col) ?? [];
        existing.push(header.toLowerCase());
        colHeaders.set(col, existing);
      }
    }

    const firstMatch = (
      predicates: string[],
      mustInclude?: string[],
      mustNotInclude?: string[]
    ): number => {
      for (const [col, headers] of colHeaders) {
        if (headers.length === 0) continue;
        for (const h of headers) {
          if (predicates.some((p) => h.includes(p))) {
            if (
              mustNotInclude?.some((ex) => h.includes(ex)) ||
              mustInclude?.some((req) => !h.includes(req))
            ) {
              continue;
            }
            return col;
          }
        }
      }
      return -1;
    };

    mapping.docNumberCol = firstMatch(
      ['เอกสารเลขที่', 'corr', 'correspondence_number'],
      [],
      ['รับ', 'dc']
    );
    if (mapping.docNumberCol === -1) {
      mapping.docNumberCol = firstMatch([
        'เลขที่เอกสาร',
        'doc no',
        'doc number',
        'document no',
        'document number',
      ]);
    }
    if (mapping.docNumberCol === -1) {
      mapping.docNumberCol = firstMatch(['เลขที่หนังสือ', 'หนังสือ']);
    }
    if (mapping.docNumberCol === -1) {
      mapping.docNumberCol = firstMatch(['no'], ['number']);
    }

    mapping.subjectCol = firstMatch([
      'subject',
      'title',
      'เรื่อง',
      'ชื่อเรื่อง',
      'หัวข้อ',
    ]);

    mapping.receivedDateCol = firstMatch([
      'วันที่รับ',
      'วันรับ',
      'date received',
      'received',
    ]);

    mapping.issuedDateCol = firstMatch([
      'วันที่ออก',
      'วันที่ออกหนังสือ',
      'date of issue',
      'issued',
      'sent',
      'ลงวันที่',
    ]);

    mapping.fromCol = firstMatch(['ผู้ส่ง', 'จาก', 'from', 'sender', 'ส่ง']);

    mapping.toCol = firstMatch([
      'ผู้รับ',
      'to',
      'receiver',
      'recipient',
      'ถึง',
    ]);

    mapping.categoryCol = firstMatch(['category', 'ประเภท', 'หมวดหมู่']);

    mapping.correspondenceTypeIdCol = firstMatch([
      'correspondence_type',
      'type_id',
      'correspondence type',
      'corr type',
      'รหัสประเภท',
    ]);

    mapping.fileNameCol = firstMatch([
      'ชื่อไฟล์',
      'file name',
      'filename',
      'pdf',
      'ไฟล์',
      'เอกสารแนบ',
    ]);

    mapping.remarksCol = firstMatch(['หมายเหตุ', 'remark', 'note', 'notes']);

    return mapping;
  }

  /**
   * ตรวจสอบและค้นหาไฟล์ PDF ใน Staging Directory แบบ Case-insensitive
   * รองรับ Excel ที่ระบุชื่อไฟล์โดยไม่มี .pdf extension
   */
  private resolveStagingPdf(
    stagingDir: string,
    fileName: string
  ): string | null {
    const cleanFileName = fileName.trim();
    const candidates = [cleanFileName];

    // หากไฟล์ไม่มีนามสกุล .pdf ให้ลองเติม .pdf เพิ่ม
    const hasPdfExt = cleanFileName.toLowerCase().endsWith('.pdf');
    if (!hasPdfExt) {
      candidates.push(`${cleanFileName}.pdf`);
    }

    for (const candidate of candidates) {
      const exactPath = path.join(stagingDir, candidate);
      if (fs.existsSync(exactPath)) {
        return exactPath;
      }

      // Case-insensitive search ใน Directory
      try {
        if (!fs.existsSync(stagingDir)) return null;
        const files = fs.readdirSync(stagingDir);
        const lowerTarget = candidate.toLowerCase();
        const match = files.find((f) => f.toLowerCase() === lowerTarget);
        if (match) {
          return path.join(stagingDir, match);
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * ดึงค่าข้อความจาก Cell ป้องกัน Object หรือ RichText
   */
  private extractCellString(cellVal: unknown): string | null {
    if (cellVal == null) return null;
    if (typeof cellVal === 'string') return cellVal;
    if (typeof cellVal === 'number' || typeof cellVal === 'boolean')
      return String(cellVal);
    if (typeof cellVal === 'object') {
      const obj = cellVal as Record<string, unknown>;
      if ('text' in obj && typeof obj.text === 'string') return obj.text;
      if ('result' in obj && typeof obj.result === 'string') return obj.result;
    }
    return null;
  }

  /**
   * แปลงค่า Date จาก Excel (รองรับทั้ง Date object, Serial Number, ISO string)
   */
  private parseDateCell(cellVal: unknown): Date | undefined {
    if (cellVal == null) return undefined;
    if (cellVal instanceof Date && !isNaN(cellVal.getTime())) return cellVal;

    const num = Number(cellVal);
    if (!isNaN(num) && num > 20000 && num < 100000) {
      // Excel serial date formula
      return new Date(Math.round((num - 25569) * 86400 * 1000));
    }

    if (typeof cellVal === 'string') {
      const parsed = new Date(cellVal);
      if (!isNaN(parsed.getTime())) {
        if (parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  /**
   * บันทึกข้อผิดพลาดลงตาราง migration_errors
   */
  private async logError(
    batchId: string,
    documentNumber: string,
    errorType: MigrationErrorType,
    errorMessage: string
  ): Promise<void> {
    try {
      const errorEntry = this.errorRepo.create({
        batchId,
        documentNumber,
        errorType,
        errorMessage,
      });
      await this.errorRepo.save(errorEntry);
    } catch (saveErr: unknown) {
      this.logger.warn(
        `Failed to persist migration error for [${documentNumber}]: ${String(saveErr)}`
      );
    }
  }
}
