// File: src/modules/rfa/rfa.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { CorrespondenceRouting } from '../correspondence/entities/correspondence-routing.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { RoutingTemplate } from '../correspondence/entities/routing-template.entity';
import { RoutingTemplateStep } from '../correspondence/entities/routing-template-step.entity';
import { ShopDrawingRevision } from '../drawing/entities/shop-drawing-revision.entity';
import { RfaApproveCode } from './entities/rfa-approve-code.entity';
import { RfaItem } from './entities/rfa-item.entity';
import { RfaRevision } from './entities/rfa-revision.entity';
import { RfaStatusCode } from './entities/rfa-status-code.entity';
import { RfaType } from './entities/rfa-type.entity';
import { RfaWorkflowTemplateStep } from './entities/rfa-workflow-template-step.entity';
import { RfaWorkflowTemplate } from './entities/rfa-workflow-template.entity';
import { RfaWorkflow } from './entities/rfa-workflow.entity';
import { Rfa } from './entities/rfa.entity';

// Services & Controllers
import { RfaWorkflowService } from './rfa-workflow.service'; // Register Service
import { RfaController } from './rfa.controller';
import { RfaService } from './rfa.service';

// External Modules
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { NotificationModule } from '../notification/notification.module';
import { SearchModule } from '../search/search.module';
import { UserModule } from '../user/user.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rfa,
      RfaRevision,
      RfaItem,
      RfaType,
      RfaStatusCode,
      RfaApproveCode,
      Correspondence,
      ShopDrawingRevision,
      RfaWorkflow,
      RfaWorkflowTemplate,
      RfaWorkflowTemplateStep,
      CorrespondenceRouting,
      RoutingTemplate,
      RoutingTemplateStep,
    ]),
    DocumentNumberingModule,
    UserModule,
    SearchModule,
    WorkflowEngineModule,
    NotificationModule,
  ],
  providers: [RfaService, RfaWorkflowService],
  controllers: [RfaController],
  exports: [RfaService],
})
export class RfaModule {}
