// File: src/modules/workflow-engine/dto/update-workflow-definition.dto.ts

import { PartialType } from '@nestjs/swagger';
import { CreateWorkflowDefinitionDto } from './create-workflow-definition.dto';

// PartialType จะทำให้ทุก field ใน CreateDto กลายเป็น Optional (?)
// เหมาะสำหรับ PATCH method
export class UpdateWorkflowDefinitionDto extends PartialType(
  CreateWorkflowDefinitionDto,
) {}
