// File: src/modules/review-team/review-team.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

// Entities
import { ReviewTeam } from './entities/review-team.entity';
import { ReviewTeamMember } from './entities/review-team-member.entity';
import { ReviewTask } from './entities/review-task.entity';

// External entities needed for resolution
import { User } from '../user/entities/user.entity';
import { Discipline } from '../master/entities/discipline.entity';

// Services
import { ReviewTeamService } from './review-team.service';
import { ReviewTaskService } from './review-task.service';
import { TaskCreationService } from './services/task-creation.service';
import { AggregateStatusService } from './services/aggregate-status.service';
import { ConsensusService } from './services/consensus.service';
import { VetoOverrideService } from './services/veto-override.service';

// Controllers
import { ReviewTeamController } from './review-team.controller';

// Modules
import { ResponseCodeModule } from '../response-code/response-code.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { DistributionModule } from '../distribution/distribution.module';

// Queue constants
import { QUEUE_REMINDERS, QUEUE_VETO_NOTIFICATIONS } from '../common/constants/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewTeam, ReviewTeamMember, ReviewTask, User, Discipline]),
    BullModule.registerQueue(
      { name: QUEUE_REMINDERS },
      { name: QUEUE_VETO_NOTIFICATIONS },
    ),
    ResponseCodeModule,
    NotificationModule,
    UserModule,
    DistributionModule,
  ],
  providers: [
    ReviewTeamService,
    ReviewTaskService,
    TaskCreationService,
    AggregateStatusService,
    ConsensusService,
    VetoOverrideService,
  ],
  controllers: [ReviewTeamController],
  exports: [
    ReviewTeamService,
    ReviewTaskService,
    TaskCreationService,
    AggregateStatusService,
    ConsensusService,
    VetoOverrideService,
    TypeOrmModule,
  ],
})
export class ReviewTeamModule {}
