// File: src/modules/rfa/rfa.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Rfa } from './entities/rfa.entity';
import { RfaRevision } from './entities/rfa-revision.entity';
import { RfaItem } from './entities/rfa-item.entity';
import { RfaType } from './entities/rfa-type.entity';
import { RfaStatusCode } from './entities/rfa-status-code.entity';
import { RfaApproveCode } from './entities/rfa-approve-code.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { ShopDrawingRevision } from '../drawing/entities/shop-drawing-revision.entity';
import { RfaWorkflow } from './entities/rfa-workflow.entity';
import { RfaWorkflowTemplate } from './entities/rfa-workflow-template.entity';
import { RfaWorkflowTemplateStep } from './entities/rfa-workflow-template-step.entity';
import { CorrespondenceRouting } from '../correspondence/entities/correspondence-routing.entity';
import { RoutingTemplate } from '../correspondence/entities/routing-template.entity';
// หมายเหตุ: ตรวจสอบชื่อไฟล์ Entity ให้ตรงกับที่มีจริง (บางทีอาจชื่อ RoutingTemplate)

// Services & Controllers
import { RfaService } from './rfa.service';
import { RfaController } from './rfa.controller';

// External Modules
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { UserModule } from '../user/user.module';
import { SearchModule } from '../search/search.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module'; // ✅ Import
import { NotificationModule } from '../notification/notification.module'; // ✅ เพิ่ม NotificationModule

@Module({
  imports: [
    // 1. Register Entities (เฉพาะ Entity เท่านั้น ห้ามใส่ Module)
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
    ]),

    // 2. Import External Modules (Services ที่ Inject เข้ามา)
    DocumentNumberingModule,
    UserModule,
    SearchModule,
    WorkflowEngineModule, // ✅ ย้ายมาใส่ตรงนี้ (imports หลัก)
    NotificationModule, // ✅ เพิ่มตรงนี้ เพื่อแก้ dependency index [13]
  ],
  providers: [RfaService],
  controllers: [RfaController],
  exports: [RfaService],
})
export class RfaModule {}
