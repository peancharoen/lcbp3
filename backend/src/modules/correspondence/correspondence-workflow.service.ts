// File: src/modules/correspondence/correspondence-workflow.service.ts
// Change Log:
// - 2026-09-22: D344 — ตัด triggerRagPrepare/skipRagPrepare ออกจาก status transition
//   (deprecated rag-prepare pipeline — processor skip ทุก job; status ไม่ได้อยู่ใน
//   vector payload เลยไม่มีอะไรต้อง re-index; การ ingest ครอบโดย commit-time trigger)

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';

import { WorkflowTransitionDto } from '../workflow-engine/dto/workflow-transition.dto';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationChannelService } from '../notification/notification-channel.service';
import { TelegramBotService } from '../notification/telegram/telegram-bot.service';
import { UserService } from '../user/user.service';
import { CirculationRouting } from '../circulation/entities/circulation-routing.entity';
import { Circulation } from '../circulation/entities/circulation.entity';

// Feature 258 (T041): significant-status allowlist สำหรับ correspondence.status_changed
// — เฉพาะผลลัพธ์ที่ทีมต้องรู้: ตอบกลับ (REP*), ปิดงาน (CLB*), ยกเลิก (CCB*)
// ไม่แจ้ง DRAFT/SUB*/RSB* (forward transitions — ไม่ใช่ outcome)
const SIGNIFICANT_STATUS_PREFIXES = ['REP', 'CLB', 'CCB'] as const;

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
    private readonly channelService: NotificationChannelService,
    private readonly configService: ConfigService,
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
        // Feature 258 (T040): nested relations สำหรับ group notification template
        relations: [
          'correspondence',
          'correspondence.project',
          'correspondence.originator',
          'correspondence.type',
        ],
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
                  // Feature 258 (T040): DM leg — EMAIL เดิม + TELEGRAM leg (alsoTelegram
                  // รวมกับ primary channel ใน notification row เดียวกัน)
                  await this.notificationService.send({
                    userId: targetUserId,
                    title: 'New Correspondence Received',
                    message: `${corrForNotify.correspondenceNumber} has been submitted to your organization.`,
                    type: 'EMAIL',
                    alsoTelegram: true,
                    entityType: 'correspondence',
                    entityId: revision.correspondenceId,
                    entityPublicId: corrForNotify.publicId,
                    link: `/correspondences/${corrForNotify.publicId}`,
                  });
                }
              }
            })
            .catch((err: Error) =>
              this.logger.warn(`Submit notification failed: ${err.message}`)
            );

          // Feature 258 (T040): group leg — แจ้งทุก active channel ของ project
          const typeCode = corrForNotify.type?.typeCode;
          const eventType =
            typeCode === 'TRANSMITTAL'
              ? 'transmittal.received'
              : 'correspondence.registered';
          const documentUrl = `${this.appBaseUrl}/correspondences/${corrForNotify.publicId}`;
          const projectName = TelegramBotService.escapeHtml(
            corrForNotify.project?.projectName ?? ''
          );
          const docNumber = TelegramBotService.escapeHtml(
            corrForNotify.correspondenceNumber
          );
          const originatorOrg = TelegramBotService.escapeHtml(
            corrForNotify.originator?.organizationName ?? '-'
          );
          // Template: contracts/telegram-message-templates.md (minimal — ไม่ใส่ title, D7)
          const groupText =
            eventType === 'transmittal.received'
              ? `<b>📥 Transmittal ใหม่ — ${projectName}</b>\n\n<b>${docNumber}</b>\nจาก: ${originatorOrg}\nสถานะ: รอตรวจรับ\n\n<a href="${documentUrl}">ดูรายละเอียด →</a>`
              : `<b>📄 Correspondence ใหม่ — ${projectName}</b>\n\n<b>${docNumber}</b> [${TelegramBotService.escapeHtml(typeCode ?? '-')}] \nจาก: ${originatorOrg}\n\n<a href="${documentUrl}">ดูรายละเอียด →</a>`;
          void this.channelService
            .notifyProject(corrForNotify.projectId, eventType, {
              text: groupText,
              entityType: 'correspondence',
              entityPublicId: corrForNotify.publicId,
            })
            .catch((err: Error) =>
              this.logger.warn(
                `Telegram group notify failed (non-critical): ${err.message}`
              )
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
        relations: ['correspondence', 'correspondence.project'],
      });
      if (revision) {
        // Feature 258 (T041): จับ status เดิมก่อน sync เพื่อเปรียบเทียบใน notification
        const oldStatusId = revision.statusId;
        await this.syncStatus(revision, result.statusProjection);
        void this.notifyCorrespondenceStatusChanged(
          revision,
          oldStatusId,
          userId
        ).catch((err: Error) =>
          this.logger.warn(
            `Status-change notification failed (non-critical): ${err.message}`
          )
        );
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

  /** Frontend base URL สำหรับลิงก์ใน Telegram message (absolute — Telegram ไม่ resolve relative) */
  private get appBaseUrl(): string {
    return (
      this.configService.get<string>('APP_BASE_URL') ??
      'https://lcbp3.np-dms.work'
    );
  }

  /**
   * Feature 258 (T041): แจ้ง `correspondence.status_changed` เมื่อสถานะใหม่
   * อยู่ใน allowlist (prefix REP, CLB, CCB) — DM fan-out (createdBy + circulation assignees PENDING)
   * + group leg ผ่าน notifyProject (minimal template ตาม D7)
   */
  private async notifyCorrespondenceStatusChanged(
    revision: CorrespondenceRevision,
    oldStatusId: number | undefined,
    actorUserId: number
  ): Promise<void> {
    const newStatus = await this.statusRepo.findOne({
      where: { id: revision.statusId },
    });
    if (!newStatus) return;
    const isSignificant = SIGNIFICANT_STATUS_PREFIXES.some((p) =>
      newStatus.statusCode.startsWith(p)
    );
    if (!isSignificant) return;

    const corr = revision.correspondence;
    if (!corr) return;
    const oldStatus = oldStatusId
      ? await this.statusRepo.findOne({ where: { id: oldStatusId } })
      : null;
    const oldCode = oldStatus?.statusCode ?? '-';
    const newCode = newStatus.statusCode;
    const docNumber = TelegramBotService.escapeHtml(corr.correspondenceNumber);
    const documentUrl = `${this.appBaseUrl}/correspondences/${corr.publicId}`;
    const actorName = await this.resolveUserDisplayName(actorUserId);

    // DM fan-out: creator + circulation assignees ที่ยัง PENDING (dedup, ไม่รวม actor)
    const recipientIds = new Set<number>();
    if (corr.createdBy) recipientIds.add(corr.createdBy);
    const pendingRoutings = await this.dataSource
      .getRepository(CirculationRouting)
      .createQueryBuilder('r')
      .innerJoin(Circulation, 'c', 'c.id = r.circulation_id')
      .where('c.correspondence_id = :cid', { cid: corr.id })
      .andWhere('r.status = :st', { st: 'PENDING' })
      .andWhere('r.assigned_to IS NOT NULL')
      .getMany();
    for (const r of pendingRoutings) {
      if (r.assignedTo) recipientIds.add(r.assignedTo);
    }
    recipientIds.delete(actorUserId); // actor ไม่ต้องรับแจ้งเตือนการกระทำของตัวเอง

    for (const recipientId of recipientIds) {
      await this.notificationService.send({
        userId: recipientId,
        title: 'Correspondence Status Changed',
        message: `${corr.correspondenceNumber}: ${oldCode} → ${newCode} (by ${actorName})`,
        type: 'SYSTEM',
        alsoTelegram: true,
        entityType: 'correspondence',
        entityId: corr.id,
        entityPublicId: corr.publicId,
        link: `/correspondences/${corr.publicId}`,
      });
    }

    // Group leg — minimal template (ไม่ใส่ title/subject, D7)
    const projectName = TelegramBotService.escapeHtml(
      corr.project?.projectName ?? ''
    );
    const groupText = `<b>🔄 อัปเดตสถานะ — ${projectName}</b>\n\n<b>${docNumber}</b>: ${TelegramBotService.escapeHtml(oldCode)} → <b>${TelegramBotService.escapeHtml(newCode)}</b>\nโดย: ${TelegramBotService.escapeHtml(actorName)}\n\n<a href="${documentUrl}">ดูรายละเอียด →</a>`;
    await this.channelService.notifyProject(
      corr.projectId,
      'correspondence.status_changed',
      {
        text: groupText,
        entityType: 'correspondence',
        entityPublicId: corr.publicId,
      }
    );
  }

  /** ชื่อแสดงของ user สำหรับใส่ใน message (fallback = user id) */
  private async resolveUserDisplayName(userId: number): Promise<string> {
    try {
      const user = await this.userService.findOne(userId);
      const fullName = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      return fullName || user?.username || `user ${userId}`;
    } catch {
      return `user ${userId}`;
    }
  }
}
