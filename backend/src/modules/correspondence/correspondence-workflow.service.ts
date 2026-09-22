// File: src/modules/correspondence/correspondence-workflow.service.ts
// Change Log:
// - 2026-09-22: D344 — ตัด triggerRagPrepare/skipRagPrepare ออกจาก status transition
//   (deprecated rag-prepare pipeline — processor skip ทุก job; status ไม่ได้อยู่ใน
//   vector payload เลยไม่มีอะไรต้อง re-index; การ ingest ครอบโดย commit-time trigger)

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { WorkflowTransitionDto } from '../workflow-engine/dto/workflow-transition.dto';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';

@Injectable()
export class CorrespondenceWorkflowService {
  private readonly logger = new Logger(CorrespondenceWorkflowService.name);
  private readonly WORKFLOW_CODE = 'CORRESPONDENCE_FLOW_V1';

  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    @InjectRepository(CorrespondenceRevision)
    private readonly revisionRepo: Repository<CorrespondenceRevision>,
    @InjectRepository(CorrespondenceStatus)
    private readonly statusRepo: Repository<CorrespondenceStatus>,
    @InjectRepository(CorrespondenceRecipient)
    private readonly recipientRepo: Repository<CorrespondenceRecipient>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService
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
        transitionResult.statusProjection,
        queryRunner
      );

      await queryRunner.commitTransaction();

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
        await this.syncStatus(revision, result.statusProjection);
      }
    }

    return result;
  }

  private async syncStatus(
    revision: CorrespondenceRevision,
    statusProjection: Record<string, unknown> = {},
    queryRunner?: import('typeorm').QueryRunner
  ) {
    const targetCode = (statusProjection.correspondence as string) || 'DRAFT';
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
  }
}
