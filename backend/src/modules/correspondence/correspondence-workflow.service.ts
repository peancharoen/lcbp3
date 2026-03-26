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
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';

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

      await this.syncStatus(revision, transitionResult.nextState, queryRunner);

      await queryRunner.commitTransaction();

      // Notify TO recipient org users (fire-and-forget)
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
              const targetUserId = await this.userService.findDocControlIdByOrg(
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
    queryRunner?: import('typeorm').QueryRunner
  ) {
    const statusMap: Record<string, string> = {
      DRAFT: 'DRAFT',
      IN_REVIEW: 'SUBOWN',
      APPROVED: 'CLBOWN',
      REJECTED: 'CCBOWN',
    };

    const targetCode = statusMap[workflowState] || 'DRAFT';

    const status = await this.statusRepo.findOne({
      where: { statusCode: targetCode }, // ✅ FIX: CamelCase
    });

    if (status) {
      // ✅ FIX: CamelCase (correspondenceStatusId)
      revision.statusId = status.id;

      const manager = queryRunner
        ? queryRunner.manager
        : this.revisionRepo.manager;
      await manager.save(revision);
    }
  }
}
