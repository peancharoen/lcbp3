// File: src/modules/correspondence/correspondence-workflow.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { WorkflowTransitionDto } from '../workflow-engine/dto/workflow-transition.dto';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { CorrespondenceRevisionAttachment } from './entities/correspondence-revision-attachment.entity';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { AiQueueService } from '../ai/ai-queue.service';
import { Project } from '../project/entities/project.entity';

@Injectable()
export class CorrespondenceWorkflowService {
  private readonly logger = new Logger(CorrespondenceWorkflowService.name);
  private readonly WORKFLOW_CODE = 'CORRESPONDENCE_FLOW_V1';

  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    @InjectRepository(Correspondence)
    private readonly correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(CorrespondenceRevision)
    private readonly revisionRepo: Repository<CorrespondenceRevision>,
    @InjectRepository(CorrespondenceStatus)
    private readonly statusRepo: Repository<CorrespondenceStatus>,
    @InjectRepository(CorrespondenceRecipient)
    private readonly recipientRepo: Repository<CorrespondenceRecipient>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly aiQueueService: AiQueueService
  ) {}

  async submitWorkflow(
    correspondenceId: number,
    userId: number,
    userRoles: string[], // [FIX] Added roles for DSL requirements check
    note?: string
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const revision = await this.revisionRepo.findOne({
        // ✅ FIX: CamelCase (correspondenceId, isCurrent)
        where: { correspondenceId: correspondenceId, isCurrent: true },
        relations: ['correspondence'],
      });

      if (!revision) {
        throw new NotFoundException(
          `Correspondence Revision for ID ${correspondenceId} not found`
        );
      }

      // ✅ FIX: Check undefined before access
      if (!revision.correspondence) {
        throw new NotFoundException(`Correspondence relation not found`);
      }

      const context = {
        // ✅ FIX: CamelCase (projectId, correspondenceTypeId)
        projectId: revision.correspondence.projectId,
        typeId: revision.correspondence.correspondenceTypeId,
        ownerId: userId,
        amount: 0,
        priority: 'NORMAL',
      };

      const instance = await this.workflowEngine.createInstance(
        this.WORKFLOW_CODE,
        'correspondence_revision',
        revision.id.toString(),
        context
      );

      const transitionResult = await this.workflowEngine.processTransition(
        instance.id,
        'SUBMIT',
        userId,
        note || 'Initial Submission',
        { roles: userRoles } // [FIX] Pass roles for DSL requirements check
      );

      await this.syncStatus(
        revision,
        transitionResult.nextState,
        queryRunner,
        true
      );

      await queryRunner.commitTransaction();

      // After-commit: RAG preparation (fire-and-forget)
      // ย้ายมาหลัง commit เพื่อป้องกัน job ถูก enqueue แต่ transaction rollback
      try {
        if (transitionResult.nextState !== 'DRAFT') {
          await this.triggerRagPrepare(revision, transitionResult.nextState);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `After-commit RAG preparation failed (non-critical): ${errMsg}`
        );
      }

      // Notify TO recipient org users (fire-and-forget)
      try {
        const corrForNotify = revision.correspondence;
        if (corrForNotify) {
          void this.recipientRepo
            .find({
              where: {
                correspondenceId: corrForNotify.id,
                recipientType: 'TO',
              },
            })
            .then(async (recipients) => {
              for (const r of recipients) {
                const targetUserId =
                  await this.userService.findDocControlIdByOrg(
                    r.recipientOrganizationId
                  );
                if (targetUserId) {
                  await this.notificationService.send({
                    userId: targetUserId,
                    title: 'New Correspondence Received',
                    message: `${corrForNotify.correspondenceNumber} has been submitted to your organization.`,
                    type: 'EMAIL',
                    entityType: 'correspondence',
                    entityId: revision.correspondenceId,
                    link: `/correspondences/${corrForNotify.publicId}`,
                  });
                }
              }
            })
            .catch((err: Error) =>
              this.logger.warn(`Submit notification failed: ${err.message}`)
            );
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `After-commit notification setup failed (non-critical): ${errMsg}`
        );
      }

      return {
        instanceId: instance.id,
        currentState: transitionResult.nextState,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to submit workflow: ${String(error)}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async processAction(
    instanceId: string,
    userId: number,
    dto: WorkflowTransitionDto
  ) {
    const result = await this.workflowEngine.processTransition(
      instanceId,
      dto.action,
      userId,
      dto.comment,
      dto.payload
    );

    // ✅ FIX: Method exists now
    const instance = await this.workflowEngine.getInstanceById(instanceId);

    if (instance && instance.entityType === 'correspondence_revision') {
      const revision = await this.revisionRepo.findOne({
        where: { id: Number(instance.entityId) },
      });
      if (revision) {
        await this.syncStatus(revision, result.nextState);
      }
    }

    return result;
  }

  private async syncStatus(
    revision: CorrespondenceRevision,
    workflowState: string,
    queryRunner?: import('typeorm').QueryRunner,
    skipRagPrepare = false
  ) {
    const statusMap: Record<string, string> = {
      DRAFT: 'DRAFT',
      IN_REVIEW: 'SUBOWN',
      APPROVED: 'CLBOWN',
      REJECTED: 'CCBOWN',
    };
    const targetCode = statusMap[workflowState] || 'DRAFT';
    const status = await this.statusRepo.findOne({
      where: { statusCode: targetCode },
    });
    if (status) {
      revision.statusId = status.id;
      const manager = queryRunner
        ? queryRunner.manager
        : this.revisionRepo.manager;
      await manager.save(revision);
    }
    // Await RAG preparation เพื่อให้ unit test assert ได้
    // caller (submitWorkflow/processAction) ก็ยังคง await syncStatus ตามปกติ
    if (!skipRagPrepare && workflowState !== 'DRAFT') {
      await this.triggerRagPrepare(revision, targetCode);
    }
  }

  /**
   * triggerRagPrepare — รวบรวมข้อมูลจาก revision/correspondence แล้ว enqueue rag-prepare job
   * คืน Promise เพื่อให้ test สามารถ await และ assert ได้ ส่วน production caller ก็ await ผ่าน syncStatus
   */
  private async triggerRagPrepare(
    revision: CorrespondenceRevision,
    statusCode: string
  ): Promise<void> {
    try {
      let correspondence: Correspondence | null | undefined =
        revision.correspondence;
      if (!correspondence) {
        correspondence = await this.correspondenceRepo.findOne({
          where: { id: revision.correspondenceId },
          relations: ['project', 'type'],
        });
      }
      if (!correspondence) {
        return;
      }
      let projectPublicId = '';
      if (correspondence.project) {
        projectPublicId = correspondence.project.publicId;
      } else {
        const proj = await this.correspondenceRepo.manager.findOne(Project, {
          where: { id: correspondence.projectId },
        });
        if (proj) {
          projectPublicId = proj.publicId;
        }
      }
      const docType = correspondence.type?.typeCode || 'LETTER';
      let attachmentPath: string | undefined;
      const attachments = await this.revisionRepo.manager.find(
        CorrespondenceRevisionAttachment,
        { where: { correspondenceRevisionId: revision.id } }
      );
      if (attachments && attachments.length > 0) {
        const pdfAtt = attachments.find((att) => {
          const ext =
            att.attachment?.originalFilename?.split('.').pop()?.toLowerCase() ||
            '';
          return (
            ext === 'pdf' ||
            att.attachment?.filePath?.toLowerCase().endsWith('.pdf')
          );
        });
        if (pdfAtt && pdfAtt.attachment) {
          attachmentPath = pdfAtt.attachment.filePath;
        } else if (attachments[0].attachment) {
          attachmentPath = attachments[0].attachment.filePath;
        }
      }
      await this.aiQueueService.enqueueRagPrepare({
        documentPublicId: correspondence.publicId,
        projectPublicId: projectPublicId,
        correspondenceNumber: correspondence.correspondenceNumber,
        docType: docType,
        statusCode: statusCode,
        revisionNumber: revision.revisionNumber,
        subject: revision.subject,
        documentDate: revision.documentDate
          ? revision.documentDate.toISOString().split('T')[0]
          : undefined,
        attachmentPath: attachmentPath,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to enqueue RAG preparation for revision ${revision.id}: ${errMsg}`
      );
    }
  }
}
