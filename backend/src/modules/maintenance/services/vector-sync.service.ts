// File: backend/src/modules/maintenance/services/vector-sync.service.ts
// Change Log:
// - 2026-09-07: Vector Sync skeleton for Maintenance Console (Feature 253 — T096)
// - 2026-09-08: Implement real Qdrant/DB sync: missing-vector scan, orphan-vector scan, and re-embed enqueue
// - 2026-09-08: Fix raw SQL — projects table ใช้ column `uuid` ไม่ใช่ `public_id` (ADR-019)
// - 2026-09-18: Migrate เป็น generation-aware pipeline (Feature 254+):
//   - findMissingVectors เช็ค ACTIVE generation ของ attachment แทนการนับ doc_public_id
//   - enqueueReEmbed ใช้ ai-rag-ingest (RagAttachmentIngestionService + BullMQ) แทน
//     legacy rag-prepare/EmbeddingService (@deprecated — payload schema เก่าไม่มี
//     generation_uuid ทำให้ guard filter ทิ้ง vector ที่สร้าง)
//   - findOrphanVectors เช็ค chunk_public_id ใน rag_attachment_chunks เป็นหลัก
//     (doc_public_id เหลือไว้เฉพาะ backward-compat สำหรับ legacy points)

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { AiQdrantService } from '../../ai/qdrant.service';
import { AiQueueService } from '../../ai/ai-queue.service';
import { RagAttachmentIngestionService } from '../../ai/services/rag-attachment-ingestion.service';

export interface VectorSyncResult {
  projectPublicId: string;
  documentPublicId: string;
  attachmentPublicId?: string;
  action: 'RE_EMBED' | 'DELETE_ORPHAN' | 'NOOP';
}

export interface EnqueueReEmbedResult {
  queued: boolean;
  jobId?: string;
  queuedCount?: number;
  error?: string;
}

/** ขนาด batch สำหรับ scroll Qdrant */
const ORPHAN_SCAN_BATCH_SIZE = 100;

interface MissingVectorRow {
  projectPublicId: string;
  documentPublicId: string;
  attachmentPublicId: string;
}

interface DocAttachmentRow {
  attachmentPublicId: string;
  checksum: string | null;
  filePath: string | null;
  hasActiveGeneration: number;
}

/**
 * บริการ Vector Sync สำหรับ Maintenance Console (generation-aware pipeline)
 * - missing = attachment ของเอกสารที่ไม่มี ACTIVE generation
 * - re-embed = สร้าง BUILDING generation + enqueue ai-rag-ingest
 * - orphan = Qdrant point ที่ chunk/document ไม่มีใน DB แล้ว
 */
@Injectable()
export class VectorSyncService {
  private readonly logger = new Logger(VectorSyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly qdrantService: AiQdrantService,
    private readonly aiQueueService: AiQueueService,
    private readonly ingestionService: RagAttachmentIngestionService
  ) {}

  /**
   * หาเอกสารที่ attachment ปัจจุบันยังไม่มี ACTIVE generation
   * (เดิมนับ doc_public_id ใน Qdrant — legacy schema ใช้กับ pipeline ใหม่ไม่ได้)
   */
  async findMissingVectors(
    projectPublicId?: string
  ): Promise<VectorSyncResult[]> {
    let query = `
      SELECT p.uuid AS projectPublicId, c.uuid AS documentPublicId,
             a.uuid AS attachmentPublicId
      FROM correspondences c
      INNER JOIN projects p ON c.project_id = p.id
      INNER JOIN correspondence_revisions cr
        ON cr.correspondence_id = c.id AND cr.is_current = 1
      INNER JOIN correspondence_revision_attachments cra
        ON cra.correspondence_revision_id = cr.id
      INNER JOIN attachments a ON a.id = cra.attachment_id
      LEFT JOIN rag_attachment_generations g
        ON g.attachment_uuid = a.uuid AND g.status = 'ACTIVE'
      WHERE c.deleted_at IS NULL AND g.generation_uuid IS NULL
    `;
    const params: string[] = [];
    if (projectPublicId) {
      query += ' AND p.uuid = ?';
      params.push(projectPublicId);
    }
    query += ' ORDER BY c.id DESC LIMIT 100';

    const rows = await this.dataSource.query<MissingVectorRow[]>(query, params);

    return rows.map((row) => ({
      projectPublicId: row.projectPublicId,
      documentPublicId: row.documentPublicId,
      attachmentPublicId: row.attachmentPublicId,
      action: 'RE_EMBED' as const,
    }));
  }

  /**
   * ส่งงาน re-embed ผ่าน ai-rag-ingest pipeline (generation-aware)
   * - ข้าม attachment ที่มี ACTIVE generation อยู่แล้ว
   * - attachment ที่ไม่มี checksum → คำนวณจากไฟล์แล้ว persist ก่อน
   * - ingest() สร้าง/reuse BUILDING → enqueueRagAttachmentIngestion
   */
  async enqueueReEmbed(
    projectPublicId: string,
    documentPublicId: string
  ): Promise<EnqueueReEmbedResult> {
    const attachRows = await this.dataSource.query<DocAttachmentRow[]>(
      `SELECT DISTINCT a.uuid AS attachmentPublicId,
              a.CHECKSUM AS checksum, a.file_path AS filePath,
              EXISTS(
                SELECT 1 FROM rag_attachment_generations g
                WHERE g.attachment_uuid = a.uuid AND g.status = 'ACTIVE'
              ) AS hasActiveGeneration
       FROM correspondences c
       INNER JOIN projects p ON p.id = c.project_id
       INNER JOIN correspondence_revisions cr
         ON cr.correspondence_id = c.id AND cr.is_current = 1
       INNER JOIN correspondence_revision_attachments cra
         ON cra.correspondence_revision_id = cr.id
       INNER JOIN attachments a ON a.id = cra.attachment_id
       WHERE c.uuid = ? AND p.uuid = ? AND c.deleted_at IS NULL`,
      [documentPublicId, projectPublicId]
    );

    if (attachRows.length === 0) {
      return { queued: false, error: 'Document not found' };
    }

    const targets = attachRows.filter((r) => !r.hasActiveGeneration);
    if (targets.length === 0) {
      return {
        queued: false,
        error: 'All attachments already have ACTIVE generation',
      };
    }

    const jobIds: string[] = [];
    const errors: string[] = [];
    for (const att of targets) {
      try {
        if (!att.checksum) {
          const computed = att.filePath
            ? await this.computeFileChecksum(att.filePath)
            : null;
          if (!computed) {
            errors.push(`${att.attachmentPublicId}: checksum unavailable`);
            continue;
          }
          await this.dataSource.query(
            'UPDATE attachments SET CHECKSUM = ? WHERE uuid = ?',
            [computed, att.attachmentPublicId]
          );
        }

        const generation = await this.ingestionService.ingest(
          att.attachmentPublicId,
          false
        );
        if (generation.status === 'ACTIVE') {
          continue;
        }

        const jobId = await this.aiQueueService.enqueueRagAttachmentIngestion({
          attachmentPublicId: att.attachmentPublicId,
          attachmentChecksum: generation.attachmentChecksumSnapshot,
          force: false,
        });
        jobIds.push(jobId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${att.attachmentPublicId}: ${msg}`);
      }
    }

    if (jobIds.length === 0) {
      return { queued: false, error: errors.join('; ') || 'Nothing enqueued' };
    }
    this.logger.log(
      `Re-embed queued for ${documentPublicId}: ${jobIds.length} attachment job(s)`
    );
    return {
      queued: true,
      jobId: jobIds[0],
      queuedCount: jobIds.length,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * หา vector orphan ที่ไม่มีข้อมูลใน DB
   * - new schema: เทียบ chunk_public_id กับ rag_attachment_chunks
   * - legacy schema (doc_public_id): เทียบกับ correspondences (defensive —
   *   legacy points ถูก cleanup ไปแล้วแต่คง check ไว้เผื่อมีหลงเหลือ)
   */
  async findOrphanVectors(
    projectPublicId?: string
  ): Promise<VectorSyncResult[]> {
    const projectPublicIds = projectPublicId
      ? [projectPublicId]
      : (
          await this.dataSource.query<Array<{ public_id: string }>>(
            'SELECT uuid AS public_id FROM projects WHERE is_active = 1 AND is_sandbox = 0'
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

          // New schema — chunk_public_id ต้องมีใน rag_attachment_chunks
          const chunkPublicIds = points
            .map((p) => p.payload?.['chunk_public_id'] as string | undefined)
            .filter((id): id is string => !!id);
          if (chunkPublicIds.length > 0) {
            const placeholders = chunkPublicIds.map(() => '?').join(',');
            const existingChunks = await this.dataSource.query<
              Array<{ chunk_public_id: string }>
            >(
              `SELECT chunk_public_id FROM rag_attachment_chunks
               WHERE chunk_public_id IN (${placeholders})`,
              chunkPublicIds
            );
            const existingSet = new Set(
              existingChunks.map((c) => c.chunk_public_id)
            );
            for (const p of points) {
              const chunkId = p.payload?.['chunk_public_id'] as
                | string
                | undefined;
              if (chunkId && !existingSet.has(chunkId)) {
                results.push({
                  projectPublicId: projectId,
                  documentPublicId:
                    (p.payload?.['owner_public_id'] as string) ??
                    (p.payload?.['attachment_public_id'] as string) ??
                    '',
                  attachmentPublicId: p.payload?.['attachment_public_id'] as
                    | string
                    | undefined,
                  action: 'DELETE_ORPHAN',
                });
              }
            }
          }

          // Legacy schema — doc_public_id เทียบกับ correspondences
          const docPublicIds = points
            .filter((p) => !p.payload?.['chunk_public_id'])
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

  /** Compute SHA-256 checksum ของไฟล์แบบ streaming (เดียวกับ RagAdminService.computeFileChecksum) */
  private async computeFileChecksum(filePath: string): Promise<string | null> {
    try {
      if (!existsSync(filePath)) {
        this.logger.warn(`computeFileChecksum: file not found: ${filePath}`);
        return null;
      }
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      for await (const chunk of stream) {
        hash.update(chunk as Buffer);
      }
      return hash.digest('hex');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`computeFileChecksum: failed for ${filePath}: ${msg}`);
      return null;
    }
  }
}
