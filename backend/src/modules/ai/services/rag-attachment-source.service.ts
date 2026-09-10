// File: backend/src/modules/ai/services/rag-attachment-source.service.ts
// Change Log:
// - 2026-09-10: T024 rename RagOwnerContextService → RagAttachmentSourceService (Feature 254)
// - 2026-09-09: เพิ่ม service สำหรับ resolve owner context จาก Attachment (Feature 254)

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** ผลลัพธ์การ resolve owner context ของ Attachment */
export interface RagOwnerContext {
  ownerType: string;
  ownerPublicId: string;
  projectPublicId: string;
  docType?: string;
  docNumber?: string;
  revision?: string;
}

/** บริการสำหรับ resolve owner context (project/owner) จาก Attachment UUID */
@Injectable()
export class RagAttachmentSourceService {
  private readonly logger = new Logger(RagAttachmentSourceService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Resolve owner context จาก Attachment publicId
   * ลำดับการค้นหา:
   * 1. correspondence_revision_attachments → correspondence → project
   * 2. workflow_histories → workflow_instances → entity → project
   */
  public async resolveFromAttachment(
    attachmentPublicId: string
  ): Promise<RagOwnerContext | null> {
    const context = await this.resolveViaCorrespondence(attachmentPublicId);
    if (context) return context;

    return this.resolveViaWorkflow(attachmentPublicId);
  }

  /** ค้นหาผ่าน correspondence_revision_attachments */
  private async resolveViaCorrespondence(
    attachmentPublicId: string
  ): Promise<RagOwnerContext | null> {
    try {
      const result: Array<{
        owner_public_id: string;
        project_public_id: string;
        doc_type: string | null;
        doc_number: string | null;
      }> = await this.dataSource.query(
        `SELECT
           c.uuid AS owner_public_id,
           p.uuid AS project_public_id,
           c.correspondence_number AS doc_number,
           ct.code AS doc_type
         FROM attachments a
         INNER JOIN correspondence_revision_attachments cra ON cra.attachment_id = a.id
         INNER JOIN correspondence_revisions cr ON cr.id = cra.correspondence_revision_id
         INNER JOIN correspondences c ON c.id = cr.correspondence_id
         INNER JOIN projects p ON p.id = c.project_id
         LEFT JOIN correspondence_types ct ON ct.id = c.correspondence_type_id
         WHERE a.uuid = ?
         LIMIT 1`,
        [attachmentPublicId]
      );
      if (result.length === 0) return null;
      const row = result[0];
      return {
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: row.owner_public_id,
        projectPublicId: row.project_public_id,
        docType: row.doc_type ?? undefined,
        docNumber: row.doc_number ?? undefined,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `resolveViaCorrespondence failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  /** ค้นหาผ่าน workflow_histories → workflow_instances → entity */
  private async resolveViaWorkflow(
    attachmentPublicId: string
  ): Promise<RagOwnerContext | null> {
    try {
      const result: Array<{
        entity_type: string;
        owner_public_id: string;
        project_public_id: string | null;
      }> = await this.dataSource.query(
        `SELECT
           wi.entity_type,
           wi.entity_id AS owner_public_id,
           p.uuid AS project_public_id
         FROM attachments a
         INNER JOIN workflow_histories wh ON wh.id = a.workflow_history_id
         INNER JOIN workflow_instances wi ON wi.id = wh.instance_id
         LEFT JOIN correspondences c ON c.uuid = wi.entity_id AND wi.entity_type = 'correspondence'
         LEFT JOIN projects p ON p.id = c.project_id
         WHERE a.uuid = ?
         LIMIT 1`,
        [attachmentPublicId]
      );
      if (result.length === 0) return null;
      const row = result[0];
      if (!row.project_public_id) return null;
      const entityType = String(row.entity_type).toUpperCase();
      return {
        ownerType: entityType,
        ownerPublicId: row.owner_public_id,
        projectPublicId: row.project_public_id,
      };
    } catch (err: unknown) {
      this.logger.warn(
        `resolveViaWorkflow failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }
}
