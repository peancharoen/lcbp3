import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  providers: [WorkflowEngineService],
  // ✅ เพิ่มบรรทัดนี้ เพื่ออนุญาตให้ Module อื่น (เช่น Correspondence) เรียกใช้ Service นี้ได้
  exports: [WorkflowEngineService],
})
export class WorkflowEngineModule {}
