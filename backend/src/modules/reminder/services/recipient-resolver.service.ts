// File: backend/src/modules/reminder/services/recipient-resolver.service.ts
// Change Log:
// - 2026-10-06: Initial creation — resolve reminder_rule_recipients → userIds (User Grouping Model)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewTask } from '../../review-team/entities/review-task.entity';
import { ReviewTeamMember } from '../../review-team/entities/review-team-member.entity';
import { ReviewTeamMemberRole } from '../../common/enums/review.enums';
import { UserAssignment } from '../../user/entities/user-assignment.entity';
import { UserOrganization } from '../../user/entities/user-organization.entity';
import { UserGroupMember } from '../../organization/entities/user-group-member.entity';
import { CorrespondenceRevision } from '../../correspondence/entities/correspondence-revision.entity';
import {
  ReminderRuleRecipient,
  ReminderRecipientType,
} from '../entities/reminder-rule-recipient.entity';
import { UuidResolverService } from '../../../common/services/uuid-resolver.service';

/**
 * Resolve structured recipients ของ reminder rule → รายชื่อ user_ids
 * - symbolic (ref=NULL): TASK_ASSIGNEE / TEAM_LEAD / PROJECT_MANAGER — จาก task context
 * - concrete (ref=publicId): USER/ROLE/TEAM/GROUP/DEPARTMENT — fan-out ตาม membership
 */
@Injectable()
export class RecipientResolverService {
  private readonly logger = new Logger(RecipientResolverService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly taskRepo: Repository<ReviewTask>,
    @InjectRepository(ReviewTeamMember)
    private readonly teamMemberRepo: Repository<ReviewTeamMember>,
    @InjectRepository(UserAssignment)
    private readonly assignmentRepo: Repository<UserAssignment>,
    @InjectRepository(UserOrganization)
    private readonly membershipRepo: Repository<UserOrganization>,
    @InjectRepository(UserGroupMember)
    private readonly groupMemberRepo: Repository<UserGroupMember>,
    private readonly uuidResolver: UuidResolverService
  ) {}

  /**
   * Resolve recipients ทั้งหมดของ rule → user_ids (unique)
   * recipient ที่ resolve ไม่ได้ถูก skip พร้อม log warning (fail-soft)
   */
  async resolve(
    recipients: ReminderRuleRecipient[],
    task: ReviewTask
  ): Promise<number[]> {
    const userIds = new Set<number>();
    for (const recipient of recipients) {
      try {
        const ids = await this.resolveOne(recipient, task);
        ids.forEach((id) => userIds.add(id));
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to resolve recipient ${recipient.recipientType}:${recipient.recipientRef ?? ''} — ${String(err)}`
        );
      }
    }
    return [...userIds];
  }

  private async resolveOne(
    recipient: ReminderRuleRecipient,
    task: ReviewTask
  ): Promise<number[]> {
    switch (recipient.recipientType) {
      case ReminderRecipientType.TASK_ASSIGNEE:
        return task.assignedToUserId ? [task.assignedToUserId] : [];

      case ReminderRecipientType.TEAM_LEAD:
        return this.teamMembersByRole(task.teamId, [
          ReviewTeamMemberRole.LEAD,
          ReviewTeamMemberRole.MANAGER,
        ]);

      case ReminderRecipientType.PROJECT_MANAGER:
        return this.projectManagers(task);

      case ReminderRecipientType.USER: {
        if (!recipient.recipientRef) return [];
        const userId = await this.uuidResolver.resolveUserId(
          recipient.recipientRef
        );
        return [userId];
      }

      case ReminderRecipientType.ROLE: {
        if (!recipient.recipientRef) return [];
        const rows = await this.assignmentRepo
          .createQueryBuilder('ua')
          .innerJoin('ua.role', 'r', 'r.uuid = :ref', {
            ref: recipient.recipientRef,
          })
          .select('ua.userId', 'userId')
          .getRawMany<{ userId: number }>();
        return rows.map((r) => r.userId);
      }

      case ReminderRecipientType.TEAM: {
        if (!recipient.recipientRef) return [];
        const rows = await this.teamMemberRepo
          .createQueryBuilder('m')
          .innerJoin('m.team', 't', 't.uuid = :ref', {
            ref: recipient.recipientRef,
          })
          .select('m.userId', 'userId')
          .getRawMany<{ userId: number }>();
        return rows.map((r) => r.userId);
      }

      case ReminderRecipientType.GROUP: {
        if (!recipient.recipientRef) return [];
        const rows = await this.groupMemberRepo
          .createQueryBuilder('m')
          .innerJoin('m.group', 'g', 'g.uuid = :ref', {
            ref: recipient.recipientRef,
          })
          .select('m.userId', 'userId')
          .getRawMany<{ userId: number }>();
        return rows.map((r) => r.userId);
      }

      case ReminderRecipientType.DEPARTMENT: {
        if (!recipient.recipientRef) return [];
        const rows = await this.membershipRepo
          .createQueryBuilder('m')
          .innerJoin('m.department', 'd', 'd.uuid = :ref', {
            ref: recipient.recipientRef,
          })
          .select('m.userId', 'userId')
          .getRawMany<{ userId: number }>();
        return rows.map((r) => r.userId);
      }

      default:
        this.logger.warn(
          `Unknown recipient type: ${recipient.recipientType as string}`
        );
        return [];
    }
  }

  /** Members ของ review team ตาม role (LEAD/MANAGER = escalation target) */
  private async teamMembersByRole(
    teamId: number,
    roles: ReviewTeamMemberRole[]
  ): Promise<number[]> {
    const members = await this.teamMemberRepo.find({
      where: roles.map((role) => ({ teamId, role })),
    });
    return members.map((m) => m.userId);
  }

  /** PM ของโครงการที่ task สังกัด (เหมือน EscalationService.escalateLevel2) */
  private async projectManagers(task: ReviewTask): Promise<number[]> {
    const fullTask = (await this.taskRepo.findOne({
      where: { id: task.id },
      relations: [
        'rfaRevision',
        'rfaRevision.correspondenceRevision',
        'rfaRevision.correspondenceRevision.correspondence',
      ],
    })) as {
      rfaRevision?: {
        correspondenceRevision?: CorrespondenceRevision;
      };
    } | null;

    const projectId =
      fullTask?.rfaRevision?.correspondenceRevision?.correspondence?.projectId;
    if (!projectId) return [];

    const pmAssignments = await this.assignmentRepo.find({
      where: { projectId, role: { roleName: 'Project Manager' } },
      relations: ['role'],
    });
    return pmAssignments.map((a) => a.userId);
  }
}
