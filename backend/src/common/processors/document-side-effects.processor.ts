// File: backend/src/common/processors/document-side-effects.processor.ts
// Change Log:
// - 2026-09-09: Create processor for the 'document-side-effects' queue (Feature 253
//   T010+T011) — DocumentSideEffectsService.executeNonCritical() has enqueued
//   SEARCH_REINDEX/NOTIFICATION/VECTOR_DELETE jobs since it shipped, but no
//   @Processor ever existed to consume them; jobs sat as 'waiting' in Redis forever.
//   Found while auditing the maintenance/document controller auth-guard bugs —
//   same "designed, never wired up" pattern.
//   Only correspondence.service.ts (metadata patch, FR-015) currently calls
//   executeNonCritical(), and only ever with documentType='CORRESPONDENCE' and no
//   projectPublicId — SEARCH_REINDEX is implemented for that type; other document
//   types log a clear "not implemented" warning rather than guessing their query
//   shape with zero real callers to verify against. NOTIFICATION's job payload
//   only carries the acting user's id (not a stakeholder list), so it notifies the
//   actor that their change was processed — implementing a stakeholder-notification
//   feature would require a product decision this processor shouldn't invent.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import {
  DOCUMENT_SIDE_EFFECTS_QUEUE,
  SideEffectJobType,
} from '../services/document-side-effects.service';
import { SearchService } from '../../modules/search/search.service';
import { AiQdrantService } from '../../modules/ai/qdrant.service';
import { NotificationService } from '../../modules/notification/notification.service';
import { Correspondence } from '../../modules/correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../../modules/correspondence/entities/correspondence-revision.entity';

interface SearchReindexJobData {
  documentType: string;
  publicId: string;
  auditId: string;
}

interface NotificationJobData {
  documentType: string;
  publicId: string;
  userId: string;
  auditId: string;
}

interface VectorDeleteJobData {
  documentType: string;
  publicId: string;
  projectPublicId: string;
  auditId: string;
}

@Processor(DOCUMENT_SIDE_EFFECTS_QUEUE, { concurrency: 3 })
export class DocumentSideEffectsProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentSideEffectsProcessor.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly qdrantService: AiQdrantService,
    private readonly notificationService: NotificationService,
    @InjectRepository(Correspondence)
    private readonly correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(CorrespondenceRevision)
    private readonly correspondenceRevisionRepo: Repository<CorrespondenceRevision>
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name as SideEffectJobType) {
      case SideEffectJobType.SEARCH_REINDEX:
        await this.handleSearchReindex(job.data as SearchReindexJobData);
        break;
      case SideEffectJobType.NOTIFICATION:
        await this.handleNotification(job.data as NotificationJobData);
        break;
      case SideEffectJobType.VECTOR_DELETE:
        await this.handleVectorDelete(job.data as VectorDeleteJobData);
        break;
      default:
        this.logger.warn(`Unknown document side-effect job type: ${job.name}`);
    }
  }

  private async handleSearchReindex(data: SearchReindexJobData): Promise<void> {
    if (data.documentType !== 'CORRESPONDENCE') {
      this.logger.warn(
        `SEARCH_REINDEX not implemented for documentType=${data.documentType} ` +
          `(no existing caller enqueues this type — see change log) — skipping publicId=${data.publicId}`
      );
      return;
    }

    const correspondence = await this.correspondenceRepo.findOne({
      where: { publicId: data.publicId },
    });
    if (!correspondence) {
      this.logger.warn(
        `SEARCH_REINDEX: correspondence not found for publicId=${data.publicId}, auditId=${data.auditId}`
      );
      return;
    }

    const currentRevision = await this.correspondenceRevisionRepo.findOne({
      where: { correspondenceId: correspondence.id, isCurrent: true },
      relations: ['status'],
    });

    await this.searchService.indexDocument({
      id: correspondence.id,
      publicId: correspondence.publicId,
      type: 'correspondence',
      docNumber: correspondence.correspondenceNumber,
      title: currentRevision?.subject ?? correspondence.correspondenceNumber,
      description: currentRevision?.description,
      status: currentRevision?.status?.statusCode,
      projectId: correspondence.projectId,
      createdAt: correspondence.createdAt,
    });

    this.logger.log(
      `SEARCH_REINDEX completed for correspondence publicId=${data.publicId}, auditId=${data.auditId}`
    );
  }

  private async handleNotification(data: NotificationJobData): Promise<void> {
    const userId = Number(data.userId);
    if (!Number.isFinite(userId)) {
      this.logger.warn(
        `NOTIFICATION: invalid userId "${data.userId}" for auditId=${data.auditId} — skipping`
      );
      return;
    }

    // หมายเหตุ: job data มีแค่ userId ของผู้ทำรายการ ไม่มีรายชื่อ stakeholder อื่น —
    // แจ้งเฉพาะผู้ทำรายการว่าการแก้ไขถูกประมวลผลแล้ว ไม่ได้แจ้ง stakeholder อื่น
    // (การแจ้ง stakeholder ต้องมี product decision ว่าใครควรได้รับ ไม่ควรเดาเอง)
    await this.notificationService.send({
      userId,
      title: 'อัปเดตข้อมูลเอกสารสำเร็จ',
      message: `การแก้ไขข้อมูลเอกสาร (${data.documentType}) เสร็จสมบูรณ์แล้ว`,
      type: 'SYSTEM',
      entityType: data.documentType.toLowerCase(),
    });
  }

  private async handleVectorDelete(data: VectorDeleteJobData): Promise<void> {
    if (!data.projectPublicId) {
      this.logger.warn(
        `VECTOR_DELETE: missing projectPublicId for publicId=${data.publicId}, auditId=${data.auditId} — skipping`
      );
      return;
    }
    await this.qdrantService.deleteByDocumentPublicId(
      data.projectPublicId,
      data.publicId
    );
    this.logger.log(
      `VECTOR_DELETE completed for publicId=${data.publicId}, auditId=${data.auditId}`
    );
  }
}
