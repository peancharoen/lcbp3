// File: src/modules/reminder/reminder.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ReminderRule } from './entities/reminder-rule.entity';
import { ReminderRuleRecipient } from './entities/reminder-rule-recipient.entity';
import { ReminderHistory } from './entities/reminder-history.entity';
import { ReviewTask } from '../review-team/entities/review-task.entity';
import { ReviewTeamMember } from '../review-team/entities/review-team-member.entity';
import { UserOrganization } from '../user/entities/user-organization.entity';
import { UserGroupMember } from '../organization/entities/user-group-member.entity';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { SchedulerService } from './services/scheduler.service';
import { EscalationService } from './services/escalation.service';
import { RecipientResolverService } from './services/recipient-resolver.service';
import { ReminderProcessor } from './processors/reminder.processor';
import { QUEUE_REMINDERS } from '../common/constants/queue.constants';
import { NotificationModule } from '../notification/notification.module';
import { Project } from '../project/entities/project.entity';
import { UserAssignment } from '../user/entities/user-assignment.entity';
import { Role } from '../user/entities/role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReminderRule,
      ReminderRuleRecipient,
      ReminderHistory,
      ReviewTask,
      ReviewTeamMember,
      UserOrganization,
      UserGroupMember,
      Project,
      UserAssignment,
      Role,
    ]),

    BullModule.registerQueue({ name: QUEUE_REMINDERS }),
    NotificationModule,
  ],
  providers: [
    ReminderService,
    SchedulerService,
    EscalationService,
    RecipientResolverService,
    ReminderProcessor,
  ],
  controllers: [ReminderController],
  exports: [
    ReminderService,
    SchedulerService,
    EscalationService,
    RecipientResolverService,
  ],
})
export class ReminderModule {}
