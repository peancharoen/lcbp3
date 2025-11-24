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

// Services
import { RfaService } from './rfa.service';

// Controllers
import { RfaController } from './rfa.controller';

// External Modules
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { UserModule } from '../user/user.module';

// ... imports
import { RfaWorkflow } from './entities/rfa-workflow.entity';
import { RfaWorkflowTemplate } from './entities/rfa-workflow-template.entity';
import { RfaWorkflowTemplateStep } from './entities/rfa-workflow-template-step.entity';

import { SearchModule } from '../search/search.module'; // ✅ เพิ่ม
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
      // ... (ตัวเดิม)
      RfaWorkflow,
      RfaWorkflowTemplate,
      RfaWorkflowTemplateStep,
    ]),
    DocumentNumberingModule,
    UserModule,
    SearchModule,
  ],
  providers: [RfaService],
  controllers: [RfaController],
  exports: [RfaService],
})
export class RfaModule {}
