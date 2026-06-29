// src/database/seeds/workflow-definitions.seed.ts

import { DataSource } from 'typeorm';
import { WorkflowDefinition } from '../../modules/workflow-engine/entities/workflow-definition.entity';
import { WorkflowDslService } from '../../modules/workflow-engine/workflow-dsl.service';

export const seedWorkflowDefinitions = async (dataSource: DataSource) => {
  const repo = dataSource.getRepository(WorkflowDefinition);
  const dslService = new WorkflowDslService();

  // 1. RFA Workflow — all RFA types (incl. drawing subtypes DDW/SDW/ADW) share one definition
  const rfaDsl = {
    workflow: 'RFA_APPROVAL', // [C2] Single code for all RFA types
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

  // 2. Circulation Workflow — org-scoped (contractId = null), states match delta-06
  const circulationDsl = {
    workflow: 'CIRCULATION_FLOW_V1', // [C1] renamed from CIRCULATION_INTERNAL_V1
    version: 1,
    description:
      'Circulation Workflow — DRAFT → ROUTING → COMPLETED | CANCELLED',
    states: [
      {
        name: 'DRAFT',
        initial: true,
        on: { START: { to: 'ROUTING' } },
      },
      {
        name: 'ROUTING',
        on: {
          COMPLETE: { to: 'COMPLETED' },
          FORCE_CLOSE: { to: 'CANCELLED' },
        },
      },
      { name: 'COMPLETED', terminal: true },
      { name: 'CANCELLED', terminal: true },
    ],
  };

  // 4. Transmittal Workflow
  const transmittalDsl = {
    workflow: 'TRANSMITTAL_FLOW_V1',
    version: 1,
    description: 'Transmittal Submission Workflow',
    states: [
      {
        name: 'DRAFT',
        initial: true,
        on: { SUBMIT: { to: 'SUBMITTED' } },
      },
      {
        name: 'SUBMITTED',
        on: {
          ACKNOWLEDGE: { to: 'COMPLETED' },
          RETURN: { to: 'DRAFT' },
        },
      },
      { name: 'COMPLETED', terminal: true },
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

  const workflows = [rfaDsl, circulationDsl, correspondenceDsl, transmittalDsl];

  for (const dsl of workflows) {
    const exists = await repo.findOne({
      where: { workflow_code: dsl.workflow, version: dsl.version },
    });

    if (!exists) {
      try {
        // Compile เพื่อ Validate และ Normalize ก่อนบันทึก
        const compiled = dslService.compile(
          dsl as unknown as import('../../modules/workflow-engine/workflow-dsl.service').RawWorkflowDSL
        );

        await repo.save(
          repo.create({
            workflow_code: dsl.workflow,
            version: dsl.version,
            description: dsl.description,
            dsl: dsl as unknown as Record<string, unknown>,
            compiled: compiled as unknown as Record<string, unknown>,
            is_active: true,
          })
        );
      } catch (_error) {
        // Ignore error as logs are removed
      }
    }
  }
};
