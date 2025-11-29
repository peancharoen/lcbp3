// src/database/seeds/workflow-definitions.seed.ts

import { DataSource } from 'typeorm';
import { WorkflowDefinition } from '../../modules/workflow-engine/entities/workflow-definition.entity';
import { WorkflowDslService } from '../../modules/workflow-engine/workflow-dsl.service';

export const seedWorkflowDefinitions = async (dataSource: DataSource) => {
  const repo = dataSource.getRepository(WorkflowDefinition);
  const dslService = new WorkflowDslService();

  // 1. RFA Workflow (Standard)
  const rfaDsl = {
    workflow: 'RFA_FLOW_V1', // [FIX] เปลี่ยนชื่อให้ตรงกับค่าใน RfaWorkflowService
    version: 1,
    description: 'Standard RFA Approval Workflow',
    states: [
      {
        name: 'DRAFT',
        initial: true,
        on: {
          SUBMIT: {
            to: 'IN_REVIEW',
            require: { role: 'Editor' }, // [FIX] แก้ไข Syntax เป็น Object
          },
        },
      },
      {
        name: 'IN_REVIEW',
        on: {
          APPROVE_1: {
            to: 'APPROVED', // [FIX] ชี้ไปที่ State ที่มีอยู่จริง
            require: { role: 'Contract Admin' },
            condition: "context.priority === 'HIGH'",
          },
          APPROVE_2: {
            to: 'APPROVED', // [FIX] ชี้ไปที่ State ที่มีอยู่จริง
            require: { role: 'Contract Admin' },
            condition: "context.priority === 'NORMAL'",
          },
          REJECT: {
            to: 'REJECTED',
            require: { role: 'Contract Admin' },
          },
          COMMENT: {
            to: 'DRAFT',
            require: { role: 'Contract Admin' },
          }, // ส่งกลับแก้ไข
        },
      },
      { name: 'APPROVED', terminal: true },
      { name: 'REJECTED', terminal: true },
    ],
  };

  // 2. Circulation Workflow
  const circulationDsl = {
    workflow: 'CIRCULATION_INTERNAL_V1', // [FIX] เปลี่ยนชื่อให้ตรงกับค่าใน CirculationWorkflowService
    version: 1,
    description: 'Internal Document Circulation',
    states: [
      {
        name: 'OPEN',
        initial: true,
        on: {
          START: {
            // [FIX] เปลี่ยนชื่อ Action ให้ตรงกับที่ Service เรียกใช้ ('START')
            to: 'IN_REVIEW',
          },
        },
      },
      {
        name: 'IN_REVIEW',
        on: {
          COMPLETE_TASK: {
            // [FIX] เปลี่ยนให้สอดคล้องกับ Action ที่ใช้จริง
            to: 'COMPLETED',
          },
          CANCEL: { to: 'CANCELLED' },
        },
      },
      { name: 'COMPLETED', terminal: true },
      { name: 'CANCELLED', terminal: true },
    ],
  };

  // 3. Correspondence Workflow (Optional - ถ้ามี)
  const correspondenceDsl = {
    workflow: 'CORRESPONDENCE_FLOW_V1',
    version: 1,
    description: 'Standard Correspondence Routing',
    states: [
      {
        name: 'DRAFT',
        initial: true,
        on: { SUBMIT: { to: 'IN_REVIEW' } },
      },
      {
        name: 'IN_REVIEW',
        on: {
          APPROVE: { to: 'APPROVED' },
          REJECT: { to: 'REJECTED' },
        },
      },
      { name: 'APPROVED', terminal: true },
      { name: 'REJECTED', terminal: true },
    ],
  };

  const workflows = [rfaDsl, circulationDsl, correspondenceDsl];

  for (const dsl of workflows) {
    const exists = await repo.findOne({
      where: { workflow_code: dsl.workflow, version: dsl.version },
    });

    if (!exists) {
      try {
        // Compile เพื่อ Validate และ Normalize ก่อนบันทึก
        // cast as any เพื่อ bypass type checking ตอน seed raw data
        const compiled = dslService.compile(dsl as any);

        await repo.save(
          repo.create({
            workflow_code: dsl.workflow,
            version: dsl.version,
            description: dsl.description,
            dsl: dsl,
            compiled: compiled,
            is_active: true,
          }),
        );
        console.log(`✅ Seeded Workflow: ${dsl.workflow} v${dsl.version}`);
      } catch (error) {
        console.error(`❌ Failed to seed workflow ${dsl.workflow}:`, error);
      }
    } else {
      console.log(
        `⏭️  Workflow already exists: ${dsl.workflow} v${dsl.version}`,
      );
    }
  }
};
