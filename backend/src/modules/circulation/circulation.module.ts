import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CirculationRouting } from './entities/circulation-routing.entity';
import { CirculationStatusCode } from './entities/circulation-status-code.entity';
import { Circulation } from './entities/circulation.entity';

import { UserModule } from '../user/user.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { CirculationWorkflowService } from './circulation-workflow.service';
import { CirculationController } from './circulation.controller';
import { CirculationService } from './circulation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Circulation,
      CirculationRouting,
      CirculationStatusCode,
    ]),
    UserModule,
    WorkflowEngineModule,
    DocumentNumberingModule,
  ],
  controllers: [CirculationController],
  providers: [CirculationService, CirculationWorkflowService],
  exports: [CirculationService],
})
export class CirculationModule {}
