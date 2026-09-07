// File: backend/src/common/services/document-hard-delete.service.ts
// บันทึกการแก้ไข: Hard-delete orchestration with Redlock + snapshot + cascade (Feature 253 — T012)
// 2026-09-07 | FR-008: แยก Transmittal cascade ไม่ลบ root Correspondence
// 2026-09-07 | FR-011: sync Qdrant delete + pending_vector_deletions สำหรับทุก document type

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { DataSource, QueryRunner } from 'typeorm';
import * as fs from 'fs-extra';
import { randomUUID } from 'crypto';
import { NotFoundException } from '../exceptions';
import { ActionResult } from '../interfaces/action-result.interface';
import { HardDeleteCascadePolicy } from '../interfaces/hard-delete-cascade-policy.interface';
import { AiQdrantService } from '../../modules/ai/qdrant.service';
import { PendingVectorDeletion } from '../../modules/ai/entities/pending-vector-deletion.entity';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Input สำหรับ hard-delete
 */
export interface HardDeleteInput {
  publicId: string;
  documentType: string;
  userId: string;
  cascadePolicy: HardDeleteCascadePolicy;
}

/**
 * Service สำหรับ hard-delete เอกสาร
 * - Redis Redlock — ป้องกัน concurrent delete ของเอกสารเดียวกัน
 * - Snapshot before delete (audit trail)
 * - Cascade delete children + files + vectors
 * - Vector deletion เป็น post-commit side effect (retry 3 ครั้ง)
 */
@Injectable()
export class DocumentHardDeleteService {
  private readonly logger = new Logger(DocumentHardDeleteService.name);
  private readonly redlock: Redlock;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
    private readonly aiQdrantService: AiQdrantService
  ) {
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 5,
      retryDelay: 100,
      retryJitter: 50,
    });
  }

  /**
   * Execute hard-delete with Redlock protection
   * Steps:
   * 1. Acquire Redlock on lock:hard-delete:{publicId}
   * 2. Begin transaction
   * 3. Snapshot document state (audit)
   * 4. Execute cascade policy (deleteRelated)
   * 5. Commit transaction
   * 6. Delete storage files (post-commit)
   * 7. Delete vectors (post-commit, retry 3x via BullMQ — handled by side-effects service)
   * 8. Release lock
   * 9. Return ActionResult with auditId
   */
  async execute(input: HardDeleteInput): Promise<ActionResult> {
    const lockKey = `lock:hard-delete:${input.publicId}`;
    const ttl = 10000; // 10 seconds — hard-delete can be slow
    let lock: Lock | null = null;
    const failedSideEffects: string[] = [];

    try {
      // 1. Acquire Redlock
      lock = await this.redlock.acquire([lockKey], ttl);
      this.logger.log(`Acquired Redlock for hard-delete: ${input.publicId}`);

      // 2. Begin transaction
      const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 3. Snapshot document state (audit trail — Code Review S2)
        const snapshot = await this.captureSnapshot(
          input.publicId,
          input.documentType,
          queryRunner
        );

        // 4. Execute cascade policy
        const { filesToDelete, projectPublicId } =
          await input.cascadePolicy.deleteRelated(input.publicId, queryRunner);

        // 5. Commit transaction
        await queryRunner.commitTransaction();

        // Log snapshot for audit trail (post-commit — ไม่ rollback ถ้า log fail)
        this.logger.log(
          `Hard-delete snapshot for ${input.documentType}:${input.publicId} — ` +
            `userId=${input.userId}, snapshotKeys=${Object.keys(snapshot).join(',')}, ` +
            `filesToDelete=${filesToDelete.length}`
        );

        // FR-009: persist structured hard-delete snapshot to audit_log (best-effort)
        void this.persistHardDeleteSnapshot(
          input.publicId,
          input.documentType,
          Number(input.userId),
          snapshot
        );

        // 6. Delete storage files (post-commit)
        for (const filePath of filesToDelete) {
          try {
            await this.deleteStorageFile(filePath);
          } catch (err) {
            this.logger.error(
              `Failed to delete storage file ${filePath} for ${input.publicId}`,
              err
            );
            failedSideEffects.push(`storage:${filePath}`);
          }
        }

        // 7. Vector deletion (post-commit sync Qdrant) — FR-011
        let vectorDeletionStatus: 'COMPLETED' | 'PENDING_RETRY' | 'SKIPPED' =
          'SKIPPED';
        if (projectPublicId) {
          vectorDeletionStatus = await this.deleteQdrantVectors(
            projectPublicId,
            input.publicId,
            Number(input.userId)
          );
        }

        // 9. Return result
        return {
          success: true,
          publicId: input.publicId,
          action: 'HARD_DELETE',
          sideEffects: {
            searchReindexed: false,
            notificationsSent: 0,
            workflowTerminated: false,
            circulationsClosed: 0,
            vectorsDeleted: vectorDeletionStatus,
            filesDeleted: filesToDelete.length - failedSideEffects.length,
          },
          failedSideEffects,
          auditId: undefined, // AuditLogInterceptor สร้าง audit entry แบบ async (post-response)
        };
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (err) {
      this.logger.error(
        `Hard-delete failed for ${input.documentType}:${input.publicId}`,
        err
      );
      throw err;
    } finally {
      // 8. Release lock
      if (lock) {
        try {
          await lock.release();
        } catch (err) {
          this.logger.warn(
            `Failed to release Redlock for ${input.publicId} (may have expired)`,
            err
          );
        }
      }
    }
  }

  /**
   * สร้าง cascade policy ตาม document type (Feature 253 — T068)
   *
   * - CORRESPONDENCE / RFA: root = correspondences
   *   (rfas.id cascade จาก correspondences.id)
   * - TRANSMITTAL: ลบเฉพาะ transmittals + transmittal_items ไม่ลบ root Correspondence
   * - DRAWING: root = contract_drawings (junction contract_drawing_attachments)
   * - CIRCULATION: ไม่รองรับ hard-delete (ใช้ force-close แทน)
   */
  buildCascadePolicy(documentType: string): HardDeleteCascadePolicy {
    const type = documentType.toUpperCase();

    if (type === 'CIRCULATION') {
      // Circulation ไม่รองรับ hard-delete — ใช้ force-close แทน
      throw new NotFoundException('Cascade policy for', 'CIRCULATION');
    }

    if (type === 'DRAWING') {
      return this.buildDrawingCascadePolicy();
    }

    if (type === 'TRANSMITTAL') {
      return this.buildTransmittalCascadePolicy();
    }

    // CORRESPONDENCE, RFA — shared correspondences root
    return this.buildCorrespondenceRootCascadePolicy(type);
  }

  /**
   * Cascade policy สำหรับเอกสารที่ root อยู่ที่ตาราง correspondences
   * (Correspondence, RFA ใช้ร่วมกัน — subtype tables cascade อัตโนมัติ)
   */
  private buildCorrespondenceRootCascadePolicy(
    documentType: string
  ): HardDeleteCascadePolicy {
    const dataSource = this.dataSource;
    const logger = this.logger;

    const resolveCorrespondenceId = async (
      publicId: string
    ): Promise<number> => {
      const rows = await dataSource.query<Array<{ id: number }>>(
        'SELECT id FROM correspondences WHERE uuid = ?',
        [publicId]
      );
      if (!rows || rows.length === 0) {
        throw new NotFoundException(documentType, publicId);
      }
      return rows[0].id;
    };

    const collectAttachmentFiles = async (
      correspondenceId: number
    ): Promise<{ id: number; file_path: string }[]> => {
      return dataSource.query<{ id: number; file_path: string }[]>(
        `SELECT a.id, a.file_path
         FROM attachments a
         INNER JOIN correspondence_revision_attachments cra
           ON cra.attachment_id = a.id
         INNER JOIN correspondence_revisions cr
           ON cr.id = cra.correspondence_revision_id
         WHERE cr.correspondence_id = ?`,
        [correspondenceId]
      );
    };

    const resolveProjectPublicId = async (
      publicId: string
    ): Promise<string | undefined> => {
      const rows = await dataSource.query<Array<{ public_id: string }>>(
        `SELECT p.public_id
         FROM projects p
         INNER JOIN correspondences c ON c.project_id = p.id
         WHERE c.uuid = ?`,
        [publicId]
      );
      return rows && rows.length > 0 ? rows[0].public_id : undefined;
    };

    return {
      deleteRelated: async (publicId, queryRunner) => {
        const correspondenceId = await resolveCorrespondenceId(publicId);
        const projectPublicId = await resolveProjectPublicId(publicId);
        const attachmentRows = await collectAttachmentFiles(correspondenceId);
        const filesToDelete = attachmentRows.map((r) => r.file_path);
        const m = queryRunner.manager;

        // 1. ลบ circulations (FK ไม่มี cascade — ต้องลบเอง)
        await m.query(
          `DELETE cr FROM circulation_routings cr
           INNER JOIN circulations c ON cr.circulation_id = c.id
           WHERE c.correspondence_id = ?`,
          [correspondenceId]
        );
        await m.query(
          `DELETE ca FROM circulation_attachments ca
           INNER JOIN circulations c ON ca.circulation_id = c.id
           WHERE c.correspondence_id = ?`,
          [correspondenceId]
        );
        await m.query('DELETE FROM circulations WHERE correspondence_id = ?', [
          correspondenceId,
        ]);

        // 2. ลบ workflow instance + history (entity_id = publicId)
        await m.query(
          `DELETE wh FROM workflow_histories wh
           INNER JOIN workflow_instances wi ON wh.instance_id = wi.id
           WHERE wi.entity_id = ?`,
          [publicId]
        );
        await m.query('DELETE FROM workflow_instances WHERE entity_id = ?', [
          publicId,
        ]);

        // 3. ลบ attachment rows (junction cascade อัตโนมัติ)
        if (attachmentRows.length > 0) {
          const ids = attachmentRows.map((r) => r.id);
          await m.query(
            `DELETE FROM attachments WHERE id IN (${ids.map(() => '?').join(',')})`,
            ids
          );
        }

        // 4. ลบ correspondence root — cascade: revisions, recipients, tags,
        //    references, rfas, rfa_revisions, rfa_items, transmittals, transmittal_items
        await m.query('DELETE FROM correspondences WHERE id = ?', [
          correspondenceId,
        ]);

        logger.log(
          `Cascade delete ${documentType}:${publicId} — correspondenceId=${correspondenceId}, attachments=${attachmentRows.length}`
        );
        return { filesToDelete, projectPublicId };
      },

      getStorageFiles: async (publicId) => {
        const correspondenceId = await resolveCorrespondenceId(publicId);
        const rows = await collectAttachmentFiles(correspondenceId);
        return rows.map((r) => r.file_path);
      },

      deleteVectors: async () => {
        // Vector deletion ถูกจัดการ post-commit ผ่าน BullMQ side-effects / pending_vector_deletions
        await Promise.resolve();
      },
    };
  }

  /**
   * Cascade policy สำหรับ Transmittal (FR-008)
   * ลบเฉพาะ transmittals + transmittal_items ไม่ลบ root Correspondence ต้นทาง
   */
  private buildTransmittalCascadePolicy(): HardDeleteCascadePolicy {
    const dataSource = this.dataSource;
    const logger = this.logger;

    const resolveCorrespondenceId = async (
      publicId: string
    ): Promise<number> => {
      const rows = await dataSource.query<Array<{ id: number }>>(
        'SELECT id FROM correspondences WHERE uuid = ?',
        [publicId]
      );
      if (!rows || rows.length === 0) {
        throw new NotFoundException('TRANSMITTAL', publicId);
      }
      return rows[0].id;
    };

    const resolveProjectPublicId = async (
      publicId: string
    ): Promise<string | undefined> => {
      const rows = await dataSource.query<Array<{ public_id: string }>>(
        `SELECT p.public_id
         FROM projects p
         INNER JOIN correspondences c ON c.project_id = p.id
         WHERE c.uuid = ?`,
        [publicId]
      );
      return rows && rows.length > 0 ? rows[0].public_id : undefined;
    };

    return {
      deleteRelated: async (publicId, queryRunner) => {
        const correspondenceId = await resolveCorrespondenceId(publicId);
        const projectPublicId = await resolveProjectPublicId(publicId);
        const m = queryRunner.manager;

        // ลบ transmittal_items ก่อน แล้วจึงลบ transmittals
        await m.query(
          'DELETE FROM transmittal_items WHERE transmittal_id = ?',
          [correspondenceId]
        );
        await m.query('DELETE FROM transmittals WHERE correspondence_id = ?', [
          correspondenceId,
        ]);

        logger.log(
          `Transmittal cascade delete:${publicId} — correspondenceId=${correspondenceId}`
        );
        return { filesToDelete: [], projectPublicId };
      },

      getStorageFiles: () => {
        // Transmittal ไม่มีไฟล์แนบเป็นของตัวเอง (ไฟล์อยู่ที่ Correspondence ต้นทาง)
        return Promise.resolve([]);
      },

      deleteVectors: async () => {
        // Transmittal ไม่มี vector เป็นของตัวเอง
        await Promise.resolve();
      },
    };
  }

  /**
   * Cascade policy สำหรับ Contract Drawing (root = contract_drawings)
   */
  private buildDrawingCascadePolicy(): HardDeleteCascadePolicy {
    const dataSource = this.dataSource;
    const logger = this.logger;

    const resolveDrawingId = async (publicId: string): Promise<number> => {
      const rows = await dataSource.query<Array<{ id: number }>>(
        'SELECT id FROM contract_drawings WHERE uuid = ?',
        [publicId]
      );
      if (!rows || rows.length === 0) {
        throw new NotFoundException('DRAWING', publicId);
      }
      return rows[0].id;
    };

    const collectFiles = async (
      drawingId: number
    ): Promise<{ id: number; file_path: string }[]> => {
      return dataSource.query<{ id: number; file_path: string }[]>(
        `SELECT a.id, a.file_path
         FROM attachments a
         INNER JOIN contract_drawing_attachments cda
           ON cda.attachment_id = a.id
         WHERE cda.contract_drawing_id = ?`,
        [drawingId]
      );
    };

    const resolveProjectPublicId = async (
      publicId: string
    ): Promise<string | undefined> => {
      const rows = await dataSource.query<Array<{ public_id: string }>>(
        `SELECT p.public_id
         FROM projects p
         INNER JOIN contract_drawings cd ON cd.project_id = p.id
         WHERE cd.uuid = ?`,
        [publicId]
      );
      return rows && rows.length > 0 ? rows[0].public_id : undefined;
    };

    return {
      deleteRelated: async (publicId, queryRunner) => {
        const drawingId = await resolveDrawingId(publicId);
        const projectPublicId = await resolveProjectPublicId(publicId);
        const attachmentRows = await collectFiles(drawingId);
        const filesToDelete = attachmentRows.map((r) => r.file_path);
        const m = queryRunner.manager;

        // junction + attachments
        if (attachmentRows.length > 0) {
          const ids = attachmentRows.map((r) => r.id);
          await m.query(
            'DELETE FROM contract_drawing_attachments WHERE contract_drawing_id = ?',
            [drawingId]
          );
          await m.query(
            `DELETE FROM attachments WHERE id IN (${ids.map(() => '?').join(',')})`,
            ids
          );
        }

        // workflow instance (entity_id = publicId)
        await m.query(
          `DELETE wh FROM workflow_histories wh
           INNER JOIN workflow_instances wi ON wh.instance_id = wi.id
           WHERE wi.entity_id = ?`,
          [publicId]
        );
        await m.query('DELETE FROM workflow_instances WHERE entity_id = ?', [
          publicId,
        ]);

        // drawing root — cascade: contract_drawing_attachments, shop_drawing_revision_contract_refs
        await m.query('DELETE FROM contract_drawings WHERE id = ?', [
          drawingId,
        ]);

        logger.log(
          `Cascade delete DRAWING:${publicId} — drawingId=${drawingId}, attachments=${attachmentRows.length}`
        );
        return { filesToDelete, projectPublicId };
      },

      getStorageFiles: async (publicId) => {
        const drawingId = await resolveDrawingId(publicId);
        const rows = await collectFiles(drawingId);
        return rows.map((r) => r.file_path);
      },

      deleteVectors: async () => {
        await Promise.resolve();
      },
    };
  }

  /**
   * ลบ Qdrant vectors แบบ sync แล้วเก็บ pending ถ้า fail (FR-011)
   */
  private async deleteQdrantVectors(
    projectPublicId: string,
    documentPublicId: string,
    userId: number
  ): Promise<'COMPLETED' | 'PENDING_RETRY' | 'SKIPPED'> {
    try {
      await this.aiQdrantService.deleteByDocumentPublicId(
        projectPublicId,
        documentPublicId
      );
      this.logger.log(
        `Hard-delete Qdrant vectors deleted for doc=${documentPublicId}`
      );
      return 'COMPLETED';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Hard-delete Qdrant sync deletion failed for doc=${documentPublicId}: ${msg} — storing pending_vector_deletions`
      );

      try {
        const pendingRepo = this.dataSource.getRepository(
          PendingVectorDeletion
        );
        const pending = pendingRepo.create({
          publicId: randomUUID(),
          documentPublicId,
          projectPublicId,
          requestedByUserId: userId,
          lastError: msg,
        });
        await pendingRepo.save(pending);
        return 'PENDING_RETRY';
      } catch (pendingErr: unknown) {
        const pendingMsg =
          pendingErr instanceof Error ? pendingErr.message : String(pendingErr);
        this.logger.error(
          `Hard-delete: Failed to store pending vector deletion for doc=${documentPublicId}: ${pendingMsg}`
        );
        return 'PENDING_RETRY';
      }
    }
  }

  /**
   * ลบไฟล์จาก Storage ด้วย fs-extra (best-effort — log ไม่ throw)
   */
  private async deleteStorageFile(filePath: string): Promise<void> {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete storage file: ${filePath}`, err);
      throw err;
    }
  }

  /**
   * บันทึก hard-delete snapshot ลง audit_log แบบ best-effort (FR-009)
   */
  private async persistHardDeleteSnapshot(
    publicId: string,
    documentType: string,
    userId: number,
    snapshot: Record<string, unknown>
  ): Promise<void> {
    try {
      const repo = this.dataSource.getRepository(AuditLog);
      await repo.save(
        repo.create({
          userId,
          action: 'HARD_DELETE',
          entityType: documentType.toLowerCase(),
          entityId: publicId,
          severity: 'CRITICAL',
          detailsJson: snapshot,
        })
      );
      this.logger.log(
        `Hard-delete snapshot persisted for ${documentType}:${publicId}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to persist hard-delete snapshot for ${documentType}:${publicId}: ${msg}`
      );
    }
  }

  /**
   * บันทึก snapshot ของเอกสารก่อน hard-delete (audit trail — FR-009)
   * ดึง root row, projectPublicId, attachment count/files, และ Qdrant vector count
   * ถ้าไม่พบเอกสาร จะคืน empty object (cascade policy จะ throw NotFoundException อยู่แล้ว)
   */
  private async captureSnapshot(
    publicId: string,
    documentType: string,
    queryRunner: QueryRunner
  ): Promise<Record<string, unknown>> {
    try {
      const type = documentType.toUpperCase();
      const isDrawing = type === 'DRAWING';

      const rootSql = isDrawing
        ? 'SELECT * FROM contract_drawings WHERE uuid = ? LIMIT 1'
        : 'SELECT * FROM correspondences WHERE uuid = ? LIMIT 1';
      const rootRows: unknown = await queryRunner.query(rootSql, [publicId]);
      const rootArr = rootRows as Record<string, unknown>[];
      const root = rootArr[0] ?? {};

      const attachmentSql = isDrawing
        ? `SELECT p.public_id AS projectPublicId, a.file_path AS filePath
           FROM contract_drawings cd
           INNER JOIN projects p ON p.id = cd.project_id
           LEFT JOIN contract_drawing_attachments cda ON cda.contract_drawing_id = cd.id
           LEFT JOIN attachments a ON a.id = cda.attachment_id
           WHERE cd.uuid = ?`
        : `SELECT p.public_id AS projectPublicId, a.file_path AS filePath
           FROM correspondences c
           INNER JOIN projects p ON p.id = c.project_id
           LEFT JOIN correspondence_revisions cr ON cr.correspondence_id = c.id
           LEFT JOIN correspondence_revision_attachments cra ON cra.correspondence_revision_id = cr.id
           LEFT JOIN attachments a ON a.id = cra.attachment_id
           WHERE c.uuid = ?`;
      const attachmentRows: unknown = await queryRunner.query(attachmentSql, [
        publicId,
      ]);
      const arr = attachmentRows as Array<{
        projectPublicId: string;
        filePath?: string | null;
      }>;
      const projectPublicId = arr[0]?.projectPublicId;
      const filePaths = arr
        .map((r) => r.filePath)
        .filter((p): p is string => typeof p === 'string');

      let vectorCount = 0;
      if (projectPublicId) {
        try {
          vectorCount = await this.aiQdrantService.countByDocumentPublicId(
            projectPublicId,
            publicId
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to count Qdrant vectors for ${publicId}: ${msg}`
          );
          vectorCount = 0;
        }
      }

      return {
        root,
        projectPublicId,
        attachmentCount: filePaths.length,
        attachmentFilePaths: filePaths,
        vectorCount,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to capture snapshot for ${documentType}:${publicId}: ${msg}`
      );
      return { captureError: true };
    }
  }
}
