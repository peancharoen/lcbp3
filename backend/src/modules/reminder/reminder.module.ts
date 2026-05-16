// File: src/modules/reminder/reminder.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ReminderRule } from './entities/reminder-rule.entity';
import { ReminderHistory } from './entities/reminder-history.entity';
import { ReviewTask } from '../review-team/entities/review-task.entity';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { SchedulerService } from './services/scheduler.service';
import { EscalationService } from './services/escalation.service';
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
      ReminderHistory,
      ReviewTask,
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
    ReminderProcessor,
  ],
  controllers: [ReminderController],
  exports: [ReminderService, SchedulerService, EscalationService],
})
export class ReminderModule {}
