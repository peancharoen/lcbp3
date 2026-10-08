import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CirculationRouting } from './entities/circulation-routing.entity';
import { CirculationStatusCode } from './entities/circulation-status-code.entity';
import { Circulation } from './entities/circulation.entity';
import { UserGroupMember } from '../organization/entities/user-group-member.entity';
import { UserGroup } from '../organization/entities/user-group.entity';

import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { CirculationWorkflowService } from './circulation-workflow.service';
import { CirculationController } from './circulation.controller';
import { CirculationService } from './circulation.service';
import { CirculationActionStrategy } from './strategies/circulation-action.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Circulation,
      CirculationRouting,
      CirculationStatusCode,
      UserGroupMember,
      UserGroup,
    ]),
    UserModule,
    NotificationModule, // Telegram fan-out สำหรับ group-assigned routings
    WorkflowEngineModule,
    DocumentNumberingModule,
  ],
  controllers: [CirculationController],
  providers: [
    CirculationService,
    CirculationWorkflowService,
    CirculationActionStrategy,
  ],
  exports: [CirculationService, CirculationActionStrategy],
})
export class CirculationModule {}
