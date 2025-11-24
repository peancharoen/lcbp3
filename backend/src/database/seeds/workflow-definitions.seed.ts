// src/database/seeds/workflow-definitions.seed.ts

import { DataSource } from 'typeorm';
import { WorkflowDefinition } from '../../modules/workflow-engine/entities/workflow-definition.entity';
import { WorkflowDslService } from '../../modules/workflow-engine/workflow-dsl.service';

export const seedWorkflowDefinitions = async (dataSource: DataSource) => {
  const repo = dataSource.getRepository(WorkflowDefinition);
  const dslService = new WorkflowDslService();

  // 1. RFA Workflow (Standard)
  const rfaDsl = {
    workflow: 'RFA',
    version: 1,
    states: [
      {
        name: 'DRAFT',
        initial: true,
        on: { SUBMIT: { to: 'IN_REVIEW', requirements: [{ role: 'Editor' }] } },
      },
      {
        name: 'IN_REVIEW',
        on: {
          APPROVE: {
            to: 'APPROVED',
            requirements: [{ role: 'Contract Admin' }],
          },
          REJECT: {
            to: 'REJECTED',
            requirements: [{ role: 'Contract Admin' }],
          },
          COMMENT: { to: 'DRAFT', requirements: [{ role: 'Contract Admin' }] }, // ส่งกลับแก้ไข
        },
      },
      { name: 'APPROVED', terminal: true },
      { name: 'REJECTED', terminal: true },
    ],
  };

  // 2. Circulation Workflow
  const circulationDsl = {
    workflow: 'CIRCULATION',
    version: 1,
    states: [
      {
        name: 'OPEN',
        initial: true,
        on: { SEND: { to: 'IN_REVIEW' } },
      },
      {
        name: 'IN_REVIEW',
        on: {
          COMPLETE: { to: 'COMPLETED' }, // เมื่อทุกคนตอบครบ
          CANCEL: { to: 'CANCELLED' },
        },
      },
      { name: 'COMPLETED', terminal: true },
      { name: 'CANCELLED', terminal: true },
    ],
  };

  const workflows = [rfaDsl, circulationDsl];

  for (const dsl of workflows) {
    const exists = await repo.findOne({
      where: { workflow_code: dsl.workflow, version: dsl.version },
    });
    if (!exists) {
      const compiled = dslService.compile(dsl);
      await repo.save(
        repo.create({
          workflow_code: dsl.workflow,
          version: dsl.version,
          dsl: dsl,
          compiled: compiled,
          is_active: true,
        }),
      );
      console.log(`✅ Seeded Workflow: ${dsl.workflow} v${dsl.version}`);
    }
  }
};
