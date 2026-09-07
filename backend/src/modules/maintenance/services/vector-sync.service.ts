// File: backend/src/modules/maintenance/services/vector-sync.service.ts
// Change Log:
// - 2026-09-07: Vector Sync skeleton for Maintenance Console (Feature 253 — T096)
// - 2026-09-08: Implement real Qdrant/DB sync: missing-vector scan, orphan-vector scan, and re-embed enqueue

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiQdrantService } from '../../ai/qdrant.service';
import { AiQueueService } from '../../ai/ai-queue.service';

export interface VectorSyncResult {
  projectPublicId: string;
  documentPublicId: string;
  action: 'RE_EMBED' | 'DELETE_ORPHAN' | 'NOOP';
}

/** ขนาด batch สำหรับ scroll Qdrant */
const ORPHAN_SCAN_BATCH_SIZE = 100;

/**
 * บริการ Vector Sync สำหรับ Maintenance Console
 * - หาเอกสารที่ยังไม่มี vector หรือ vector orphan
 * - ส่งงาน Re-embed ผ่าน BullMQ (ai-batch)
 */
@Injectable()
export class VectorSyncService {
  private readonly logger = new Logger(VectorSyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly qdrantService: AiQdrantService,
    private readonly aiQueueService: AiQueueService
  ) {}

  /**
   * หาเอกสารที่ยังไม่มี vector ใน Qdrant (ในบาง project)
   * ตรวจเฉพาะ CORRESPONDENCE ก่อน เนื่องจากระบบ RAG ปัจจุบันอิงจาก attachment ของ Correspondence
   */
  async findMissingVectors(
    projectPublicId?: string
  ): Promise<VectorSyncResult[]> {
    let query = `
      SELECT p.public_id AS projectPublicId, c.uuid AS documentPublicId
      FROM correspondences c
      INNER JOIN projects p ON c.project_id = p.id
      WHERE c.deleted_at IS NULL
    `;
    const params: string[] = [];
    if (projectPublicId) {
      query += ' AND p.public_id = ?';
      params.push(projectPublicId);
    }
    query += ' ORDER BY c.id DESC LIMIT 100';

    const rows = await this.dataSource.query<
      Array<{ projectPublicId: string; documentPublicId: string }>
    >(query, params);

    const results: VectorSyncResult[] = [];
    for (const row of rows) {
      try {
        const count = await this.qdrantService.countByDocumentPublicId(
          row.projectPublicId,
          row.documentPublicId
        );
        if (count === 0) {
          results.push({
            projectPublicId: row.projectPublicId,
            documentPublicId: row.documentPublicId,
            action: 'RE_EMBED',
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `findMissingVectors: Qdrant count failed for ${row.documentPublicId}: ${msg}`
        );
      }
    }

    return results;
  }

  /**
   * ส่งงาน re-embed ไป BullMQ ai-batch
   * ดึงข้อมูลเอกสาร + attachment ปัจจุบันแล้วเรียก AiQueueService.enqueueRagPrepare
   */
  async enqueueReEmbed(
    projectPublicId: string,
    documentPublicId: string
  ): Promise<{ queued: boolean; jobId?: string; error?: string }> {
    const docRows = await this.dataSource.query<
      Array<{
        correspondenceNumber: string;
        documentDate: string | null;
        revisionNumber: number;
        subject: string;
        statusCode: string;
        docType: string;
        attachmentPublicId: string | null;
        ocrText: string | null;
        projectPublicIdResult: string;
      }>
    >(
      `SELECT
        c.correspondence_number AS correspondenceNumber,
        cr.document_date AS documentDate,
        cr.revision_number AS revisionNumber,
        cr.subject,
        cs.status_code AS statusCode,
        ct.name AS docType,
        a.uuid AS attachmentPublicId,
        a.ocr_text AS ocrText,
        p.public_id AS projectPublicIdResult
      FROM correspondences c
      INNER JOIN projects p ON p.id = c.project_id
      INNER JOIN correspondence_revisions cr ON cr.correspondence_id = c.id AND cr.is_current = true
      INNER JOIN correspondence_status cs ON cs.id = cr.correspondence_status_id
      INNER JOIN correspondence_types ct ON ct.id = c.correspondence_type_id
      LEFT JOIN correspondence_revision_attachments cra ON cra.correspondence_revision_id = cr.id
      LEFT JOIN attachments a ON a.id = cra.attachment_id
      WHERE c.uuid = ? AND p.public_id = ?
      ORDER BY a.id ASC
      LIMIT 1`,
      [documentPublicId, projectPublicId]
    );

    if (docRows.length === 0) {
      return { queued: false, error: 'Document not found' };
    }

    const doc = docRows[0];
    try {
      const jobId = await this.aiQueueService.enqueueRagPrepare({
        documentPublicId,
        projectPublicId: doc.projectPublicIdResult,
        correspondenceNumber: doc.correspondenceNumber,
        docType: doc.docType,
        statusCode: doc.statusCode,
        revisionNumber: doc.revisionNumber,
        subject: doc.subject,
        documentDate: doc.documentDate ?? undefined,
        cachedOcrText: doc.ocrText ?? undefined,
        attachmentPublicId: doc.attachmentPublicId ?? undefined,
      });
      this.logger.log(
        `Re-embed queued for ${documentPublicId}: jobId=${jobId}`
      );
      return { queued: true, jobId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `enqueueRagPrepare failed for ${documentPublicId}: ${msg}`
      );
      return { queued: false, error: msg };
    }
  }

  /**
   * หา vector orphan ที่ไม่มีเอกสารใน DB
   * ใช้ Qdrant scroll ทีละ project แล้วเทียบ doc_public_id กับ correspondences
   */
  async findOrphanVectors(
    projectPublicId?: string
  ): Promise<VectorSyncResult[]> {
    const projectPublicIds = projectPublicId
      ? [projectPublicId]
      : (
          await this.dataSource.query<Array<{ public_id: string }>>(
            'SELECT public_id FROM projects WHERE is_active = 1 AND is_sandbox = 0'
          )
        ).map((r) => r.public_id);

    const results: VectorSyncResult[] = [];

    for (const projectId of projectPublicIds) {
      let offset: string | number | undefined;

      do {
        try {
          const { points, nextOffset } =
            await this.qdrantService.scrollByProject(
              projectId,
              ORPHAN_SCAN_BATCH_SIZE,
              offset
            );

          if (points.length === 0) break;

          const docPublicIds = points
            .map((p) => p.payload?.['doc_public_id'] as string | undefined)
            .filter((id): id is string => !!id);

          if (docPublicIds.length > 0) {
            const placeholders = docPublicIds.map(() => '?').join(',');
            const existingDocs = await this.dataSource.query<
              Array<{ uuid: string }>
            >(
              `SELECT DISTINCT c.uuid
               FROM correspondences c
               INNER JOIN correspondence_revisions cr ON cr.correspondence_id = c.id
               WHERE c.deleted_at IS NULL AND c.uuid IN (${placeholders})`,
              docPublicIds
            );
            const existingSet = new Set(existingDocs.map((d) => d.uuid));

            for (const docId of docPublicIds) {
              if (!existingSet.has(docId)) {
                results.push({
                  projectPublicId: projectId,
                  documentPublicId: docId,
                  action: 'DELETE_ORPHAN',
                });
              }
            }
          }

          if (results.length >= 100) {
            return results.slice(0, 100);
          }

          offset = nextOffset ?? undefined;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `findOrphanVectors: scroll failed for project ${projectId}: ${msg}`
          );
          break;
        }
      } while (offset !== null && offset !== undefined);
    }

    return results;
  }
}
