import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorrespondenceController } from './correspondence.controller.js';
import { CorrespondenceService } from './correspondence.service.js';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceType } from './entities/correspondence-type.entity';
import { Correspondence } from './entities/correspondence.entity';
// Import Entities ใหม่
import { CorrespondenceRouting } from './entities/correspondence-routing.entity';
import { RoutingTemplateStep } from './entities/routing-template-step.entity';
import { RoutingTemplate } from './entities/routing-template.entity';

import { DocumentNumberingModule } from '../document-numbering/document-numbering.module.js'; // ต้องใช้ตอน Create
import { JsonSchemaModule } from '../json-schema/json-schema.module.js'; // ต้องใช้ Validate Details
import { SearchModule } from '../search/search.module'; // ✅ 1. เพิ่ม Import SearchModule
import { UserModule } from '../user/user.module.js'; // <--- 1. Import UserModule
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module.js'; // <--- ✅ เพิ่มบรรทัดนี้ครับ
import { CorrespondenceReference } from './entities/correspondence-reference.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
// Controllers & Services
import { CorrespondenceWorkflowService } from './correspondence-workflow.service'; // Register Service นี้

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Correspondence,
      CorrespondenceRevision,
      CorrespondenceType,
      CorrespondenceStatus,
      RoutingTemplate, // <--- ลงทะเบียน
      RoutingTemplateStep, // <--- ลงทะเบียน
      CorrespondenceRouting, // <--- ลงทะเบียน
      CorrespondenceReference, // <--- ลงทะเบียน
    ]),
    DocumentNumberingModule, // Import เพื่อขอเลขที่เอกสาร
    JsonSchemaModule, // Import เพื่อ Validate JSON
    UserModule, // <--- 2. ใส่ UserModule ใน imports เพื่อให้ RbacGuard ทำงานได้
    WorkflowEngineModule, // <--- Import WorkflowEngine
    SearchModule, // ✅ 2. ใส่ SearchModule ที่นี่
  ],
  controllers: [CorrespondenceController],
  providers: [CorrespondenceService, CorrespondenceWorkflowService],
  exports: [CorrespondenceService],
})
export class CorrespondenceModule {}
