import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';

@Injectable()
export class DueDateReminderService {
  private readonly logger = new Logger(DueDateReminderService.name);

  constructor(
    @InjectRepository(CorrespondenceRevision)
    private revisionRepo: Repository<CorrespondenceRevision>,
    private notificationService: NotificationService,
    private userService: UserService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDueDateReminders() {
    this.logger.log('Running due date reminder check...');

    const now = new Date();
    const threeDaysLater = new Date(now);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const revisions = await this.revisionRepo.find({
      where: {
        isCurrent: true,
        dueDate: Between(now, threeDaysLater),
      },
      relations: ['correspondence', 'correspondence.originator', 'status'],
    });

    this.logger.log(
      `Found ${revisions.length} correspondences approaching due date`
    );

    for (const revision of revisions) {
      const corr = revision.correspondence;
      if (!corr) continue;

      const statusCode = revision.status?.statusCode ?? '';
      if (statusCode === 'CANCELLED' || statusCode === 'CLBOWN') continue;

      if (!corr.originatorId) continue;

      try {
        const targetUserId = await this.userService.findDocControlIdByOrg(
          corr.originatorId
        );
        if (!targetUserId) continue;

        const daysLeft = Math.ceil(
          (revision.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        await this.notificationService.send({
          userId: targetUserId,
          title: 'Due Date Approaching',
          message: `${corr.correspondenceNumber} — "${revision.subject}" is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
          type: 'EMAIL',
          entityType: 'correspondence',
          entityId: corr.id,
          link: `/correspondences/${corr.publicId}`,
        });
      } catch (err) {
        this.logger.warn(
          `Due date reminder failed for ${corr.correspondenceNumber}: ${(err as Error).message}`
        );
      }
    }
  }
}
