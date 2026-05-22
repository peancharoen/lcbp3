// File: src/modules/migration/migration-review.service.ts
// Change Log:
// - 2026-05-22: Initial creation for US2 - Migration Review Queue Commit (T020a)
// - 2026-05-22: Integrated UuidResolverService to resolve hybrid identifiers (T020a)

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from './entities/migration-review-queue.entity';
import { ImportTransaction } from './entities/import-transaction.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { Project } from '../project/entities/project.entity';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { Rfa } from '../rfa/entities/rfa.entity';
import { RfaRevision } from '../rfa/entities/rfa-revision.entity';
import { CommitMigrationReviewDto } from './dto/commit-migration-review.dto';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import {
  ConflictException,
  NotFoundException,
  SystemException,
  ValidationException,
} from '../../common/exceptions';

const readTagName = (value: Record<string, string>): string => {
  return value.name || value.tagName || '';
};

@Injectable()
export class MigrationReviewService {
  private readonly logger = new Logger(MigrationReviewService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly uuidResolverService: UuidResolverService
  ) {}

  /**
   * ทำการ Commit ข้อมูลเอกสารจาก Staging Review Queue เข้าระบบจริงอย่างเป็นระบบ
   * มีการทำ SELECT FOR UPDATE เพื่อป้องกันการกดเบิ้ลหรือการทำงานพร้อมกัน
   */
  async commitRecord(dto: CommitMigrationReviewDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const queueItem = await queryRunner.manager.findOne(
        MigrationReviewQueue,
        {
          where: { publicId: dto.publicId },
          lock: { mode: 'pessimistic_write' },
        }
      );
      if (!queueItem) {
        throw new NotFoundException(
          'Migration review record not found',
          dto.publicId
        );
      }
      if (queueItem.status !== MigrationReviewStatus.PENDING) {
        throw new ConflictException(
          'MIGRATION_ALREADY_PROCESSING',
          `Staging record is already processed with status: ${queueItem.status}`,
          'รายการนี้ได้รับการประมวลผลไปแล้ว',
          ['กรุณาตรวจสอบหน้า Review Queue อีกครั้งเพื่อความถูกต้อง']
        );
      }
      const rawProjectId = dto.projectId ?? queueItem.projectId;
      if (!rawProjectId) {
        throw new ValidationException('Project ID is required');
      }
      const resolvedProjectId =
        await this.uuidResolverService.resolveProjectId(rawProjectId);
      const project = await queryRunner.manager.findOne(Project, {
        where: { id: resolvedProjectId },
      });
      if (!project) {
        throw new NotFoundException('Project', String(resolvedProjectId));
      }
      const category = dto.category ?? queueItem.aiSuggestedCategory;
      if (!category) {
        throw new ValidationException('Category is required');
      }
      const CATEGORY_ALIAS: Record<string, string> = {
        Correspondence: 'LETTER',
        Letter: 'LETTER',
        Drawing: 'OTHER',
        Report: 'OTHER',
        Other: 'OTHER',
      };
      const type = await queryRunner.manager.findOne(CorrespondenceType, {
        where: { typeName: category },
      });
      let typeId = type
        ? type.id
        : (
            await queryRunner.manager.findOne(CorrespondenceType, {
              where: { typeCode: category },
            })
          )?.id;
      if (!typeId && CATEGORY_ALIAS[category]) {
        typeId = (
          await queryRunner.manager.findOne(CorrespondenceType, {
            where: { typeCode: CATEGORY_ALIAS[category] },
          })
        )?.id;
      }
      if (!typeId) {
        throw new ValidationException(
          `Category "${category}" not found in system`
        );
      }
      let status = await queryRunner.manager.findOne(CorrespondenceStatus, {
        where: { statusCode: 'CLBOWN' },
      });
      if (!status) {
        status = await queryRunner.manager.findOne(CorrespondenceStatus, {
          where: { statusCode: 'DRAFT' },
        });
      }
      if (!status) {
        throw new SystemException(
          'No default correspondence status found (missing CLBOWN/DRAFT)'
        );
      }
      const docNum = queueItem.documentNumber;
      let correspondence = await queryRunner.manager.findOne(Correspondence, {
        where: {
          correspondenceNumber: docNum,
          projectId: project.id,
        },
      });
      const rawSenderId = dto.senderId ?? queueItem.senderOrganizationId;
      const resolvedSenderId = rawSenderId
        ? await this.uuidResolverService.resolveOrganizationId(rawSenderId)
        : undefined;
      const rawReceiverId = dto.receiverId ?? queueItem.receiverOrganizationId;
      const resolvedReceiverId = rawReceiverId
        ? await this.uuidResolverService.resolveOrganizationId(rawReceiverId)
        : undefined;
      if (!correspondence) {
        correspondence = queryRunner.manager.create(Correspondence, {
          correspondenceNumber: docNum,
          correspondenceTypeId: typeId,
          projectId: project.id,
          originatorId: resolvedSenderId || undefined,
          isInternal: false,
          createdBy: userId,
        });
        await queryRunner.manager.save(correspondence);
        const isRFA = type?.typeCode === 'RFA' || category === 'RFA';
        if (isRFA) {
          const rfaTypeRes = await queryRunner.manager.query<{ id: number }[]>(
            "SELECT id FROM rfa_types WHERE type_code = 'GEN' LIMIT 1"
          );
          const rfa = queryRunner.manager.create(Rfa, {
            id: correspondence.id,
            rfaTypeId: rfaTypeRes[0]?.id || 1,
            createdBy: userId,
          });
          await queryRunner.manager.save(Rfa, rfa);
        }
      } else {
        let hasChanges = false;
        if (resolvedSenderId && !correspondence.originatorId) {
          correspondence.originatorId = resolvedSenderId;
          hasChanges = true;
        }
        if (hasChanges) {
          await queryRunner.manager.save(correspondence);
        }
      }
      if (resolvedReceiverId) {
        await queryRunner.manager.query(
          'INSERT IGNORE INTO correspondence_recipients (correspondence_id, recipient_organization_id, recipient_type) VALUES (?, ?, ?)',
          [correspondence.id, resolvedReceiverId, 'TO']
        );
      }
      let attachmentId: number | null = null;
      if (queueItem.tempAttachmentId) {
        attachmentId = queueItem.tempAttachmentId;
        await queryRunner.manager.update(
          Attachment,
          { id: attachmentId },
          { isTemporary: false }
        );
      }
      const parseDateStr = (d?: string | Date) => {
        if (!d) return undefined;
        if (d instanceof Date) return d;
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? undefined : parsed;
      };
      const finalSubject =
        dto.subject ??
        queueItem.subject ??
        queueItem.originalSubject ??
        'No Subject';
      const finalBody = dto.body ?? queueItem.body ?? '';
      const issuedDateStr =
        dto.issuedDate ??
        (queueItem.issuedDate ? queueItem.issuedDate.toISOString() : undefined);
      const receivedDateStr =
        dto.receivedDate ??
        (queueItem.receivedDate
          ? queueItem.receivedDate.toISOString()
          : undefined);
      const revisionCount = await queryRunner.manager.count(
        CorrespondenceRevision,
        {
          where: { correspondenceId: correspondence.id },
        }
      );
      const revNum = revisionCount;
      const revision = queryRunner.manager.create(CorrespondenceRevision, {
        correspondenceId: correspondence.id,
        revisionNumber: revNum,
        revisionLabel: revNum === 0 ? '0' : revNum.toString(),
        isCurrent: true,
        statusId: status.id,
        subject: finalSubject,
        description: 'Migrated from legacy system via Human Reviewed Commit',
        body: finalBody || undefined,
        documentDate: parseDateStr(issuedDateStr),
        issuedDate: parseDateStr(issuedDateStr),
        receivedDate: parseDateStr(receivedDateStr),
        details: {
          ai_confidence: queueItem.aiConfidence,
          ai_issues: queueItem.aiIssues,
          attachment_id: attachmentId,
        },
        schemaVersion: 1,
        createdBy: userId,
      });
      if (revisionCount > 0) {
        await queryRunner.manager.update(
          CorrespondenceRevision,
          { correspondenceId: correspondence.id, isCurrent: true },
          { isCurrent: false }
        );
      }
      await queryRunner.manager.save(revision);
      const isRFA = type?.typeCode === 'RFA' || category === 'RFA';
      if (isRFA) {
        const rfaStatusRes = await queryRunner.manager.query<{ id: number }[]>(
          "SELECT id FROM rfa_status_codes WHERE status_code = 'APP' LIMIT 1"
        );
        const rfaRev = queryRunner.manager.create(RfaRevision, {
          id: revision.id,
          rfaStatusCodeId: rfaStatusRes[0]?.id || 3,
          details: { drawingCount: 0 },
          schemaVersion: 1,
        });
        await queryRunner.manager.save(RfaRevision, rfaRev);
      }
      let tagsToLink: string[] = [];
      if (dto.tags && dto.tags.length > 0) {
        tagsToLink = dto.tags;
      } else if (
        queueItem.extractedTags &&
        Array.isArray(queueItem.extractedTags)
      ) {
        tagsToLink = queueItem.extractedTags
          .map((tag) => readTagName(tag))
          .filter(Boolean);
      }
      for (const rawTagName of tagsToLink) {
        const tagName = rawTagName.trim().toLowerCase();
        if (!tagName) continue;
        const tagRes = await queryRunner.manager.query<{ id: number }[]>(
          'SELECT id FROM tags WHERE project_id = ? AND tag_name = ? LIMIT 1',
          [project.id, tagName]
        );
        let tagId: number;
        if (tagRes && tagRes.length > 0) {
          tagId = tagRes[0].id;
        } else {
          const insertRes = await queryRunner.manager.query<{
            insertId: number;
          }>(
            "INSERT INTO tags (project_id, tag_name, color_code, created_by) VALUES (?, ?, 'default', ?)",
            [project.id, tagName, userId]
          );
          tagId = insertRes.insertId;
        }
        await queryRunner.manager.query(
          'INSERT IGNORE INTO correspondence_tags (correspondence_id, tag_id) VALUES (?, ?)',
          [correspondence.id, tagId]
        );
      }
      const idempotencyKey = `migration_review_${queueItem.id}`;
      const transaction = queryRunner.manager.create(ImportTransaction, {
        idempotencyKey,
        documentNumber: docNum,
        batchId: 'HUMAN_REVIEW',
        statusCode: 201,
      });
      await queryRunner.manager.save(transaction);
      queueItem.status = MigrationReviewStatus.IMPORTED;
      queueItem.reviewedBy = userId.toString();
      queueItem.reviewedAt = new Date();
      await queryRunner.manager.save(queueItem);
      await queryRunner.commitTransaction();
      return {
        success: true,
        message: 'Staging record successfully imported',
        correspondencePublicId: correspondence.publicId,
        publicId: queueItem.publicId,
        status: queueItem.status,
      };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new SystemException(
        'Failed to commit review queue record: ' + errMsg
      );
    } finally {
      await queryRunner.release();
    }
  }
}
