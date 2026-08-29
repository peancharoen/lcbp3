// src/database/seeds/workflow-definitions.seed.ts

import { DataSource } from 'typeorm';
import { WorkflowDefinition } from '../../modules/workflow-engine/entities/workflow-definition.entity';
import { WorkflowDslService } from '../../modules/workflow-engine/workflow-dsl.service';

export const seedWorkflowDefinitions = async (dataSource: DataSource) => {
  const repo = dataSource.getRepository(WorkflowDefinition);
  const dslService = new WorkflowDslService();

  // 1. RFA Workflow — ADR-049: Multi-Party Sequential Approval
  //    Flow: DRAFT → CONSULTANT_REVIEW → (optional DESIGNER_REVIEW) → OWNER_APPROVAL → terminal
  //    Approve codes (1/2/3/4) เป็น metadata ใน transition — engine เขียนลง rfa_approve_code_id
  //    statusProjection: map state → RFA status code (DFT/FRE/FAP/FCO/CC)
  //    RBAC: require.role ระบุฝ่ายที่มีสิทธิ์ (CONSULTANT/DESIGNER/OWNER/Editor)
  //          CASL guard ที่ controller เป็น coarse gate (authenticated + project access)
  //    Impersonation: admin ทำแทนได้ทุก action (บันทึก impersonated + on_behalf_of ใน history)
  //    Revision: REVISE_REQUIRED เป็น terminal — สร้าง RFA Revision ใหม่ = workflow instance ใหม่
  const rfaDsl = {
    workflow: 'RFA_APPROVAL',
    version: 2, // ADR-049: version bump จาก v1 (เดิมใช้ string condition ที่ห้าม)
    description:
      'RFA Multi-Party Approval — CONSULTANT → (optional DESIGNER) → OWNER (ADR-049)',
    states: [
      {
        name: 'DRAFT',
        initial: true,
        statusProjection: { rfa: 'DFT' },
        on: {
          SUBMIT: {
            to: 'CONSULTANT_REVIEW',
            require: { role: 'Editor' }, // Originator ส่งเข้า review
          },
        },
      },
      {
        name: 'CONSULTANT_REVIEW',
        statusProjection: { rfa: 'FRE' }, // For Review
        on: {
          // CONSULTANT เห็นควรอนุมัติ → ส่งต่อ OWNER
          CONSENT_FOR_APPROVE: {
            to: 'OWNER_APPROVAL',
            require: { role: 'CONSULTANT' },
            // approveCode ไม่ระบุที่นี่ — consent reason เก็บใน rfa_consent_reasons (metadata)
          },
          // CONSULTANT สอบถาม DESIGNER (optional — human decision, ไม่ใช่ condition)
          ASK_DESIGNER: {
            to: 'DESIGNER_REVIEW',
            require: { role: 'CONSULTANT' },
          },
          // CONSULTANT สั่งแก้ไข → terminal (สร้าง revision ใหม่)
          RESUBMIT: {
            to: 'REVISE_REQUIRED',
            require: { role: 'CONSULTANT' },
            approveCode: '3', // ADR-049: code 3 = Revise and Resubmit
          },
          // CONSULTANT ปฏิเสธ → terminal
          REJECT: {
            to: 'REJECTED',
            require: { role: 'CONSULTANT' },
            approveCode: '4', // ADR-049: code 4 = Reject
          },
        },
      },
      {
        name: 'DESIGNER_REVIEW',
        statusProjection: { rfa: 'FRE' }, // ยังอยู่ใน review phase
        on: {
          // DESIGNER เห็นชอบ → กลับ CONSULTANT
          AGREED: {
            to: 'CONSULTANT_REVIEW',
            require: { role: 'DESIGNER' },
          },
          // DESIGNER เห็นชอบพร้อมข้อสังเกต → กลับ CONSULTANT
          AGREED_WITH_COMMENTS: {
            to: 'CONSULTANT_REVIEW',
            require: { role: 'DESIGNER' },
          },
          // DESIGNER ไม่ขัดข้อง → กลับ CONSULTANT
          NO_OBJECTION: {
            to: 'CONSULTANT_REVIEW',
            require: { role: 'DESIGNER' },
          },
          // DESIGNER ไม่เห็นด้วย → กลับ CONSULTANT (พร้อม comment)
          OBJECTED: {
            to: 'CONSULTANT_REVIEW',
            require: { role: 'DESIGNER' },
          },
        },
      },
      {
        name: 'OWNER_APPROVAL',
        statusProjection: { rfa: 'FAP' }, // For Approve
        on: {
          // OWNER อนุมัติ → terminal
          APPROVE: {
            to: 'APPROVED',
            require: { role: 'OWNER' },
            approveCode: '1', // ADR-049: code 1 = Approved
          },
          // OWNER อนุมัติพร้อมข้อสังเกต → terminal
          APPROVE_WITH_COMMENTS: {
            to: 'APPROVED_WITH_COMMENTS',
            require: { role: 'OWNER' },
            approveCode: '2', // ADR-049: code 2 = Approved with Comments
          },
          // OWNER สั่งแก้ไข → กลับ CONSULTANT (ไม่ใช่ terminal — วนกลับ)
          RESUBMIT: {
            to: 'CONSULTANT_REVIEW',
            require: { role: 'OWNER' },
            approveCode: '3', // ADR-049: code 3 = Revise and Resubmit
          },
          // OWNER ปฏิเสธ → terminal
          REJECT: {
            to: 'REJECTED',
            require: { role: 'OWNER' },
            approveCode: '4', // ADR-049: code 4 = Reject
          },
        },
      },
      {
        name: 'APPROVED',
        terminal: true,
        statusProjection: { rfa: 'FCO' }, // For Construction
      },
      {
        name: 'APPROVED_WITH_COMMENTS',
        terminal: true,
        statusProjection: { rfa: 'FCO' }, // For Construction (มี comments แนบ)
      },
      {
        name: 'REJECTED',
        terminal: true,
        statusProjection: { rfa: 'CC' }, // Canceled
      },
      {
        name: 'REVISE_REQUIRED',
        terminal: true, // ADR-049: terminal — สร้าง revision ใหม่ = instance ใหม่
        statusProjection: { rfa: 'DFT' }, // กลับ Draft สำหรับ revision ใหม่
      },
    ],
  };

  // 2. Circulation Workflow — ADR-049: org-scoped (contractId = null)
  //    statusProjection: map state → Circulation status code (OPEN/IN_REVIEW/COMPLETED/CANCELLED)
  const circulationDsl = {
    workflow: 'CIRCULATION_FLOW_V1',
    version: 2, // ADR-049: version bump เพิ่ม statusProjection
    description:
      'Circulation Workflow — DRAFT → ROUTING → COMPLETED | CANCELLED (ADR-049)',
    states: [
      {
        name: 'DRAFT',
        initial: true,
        statusProjection: { circulation: 'OPEN' },
        on: { START: { to: 'ROUTING' } },
      },
      {
        name: 'ROUTING',
        statusProjection: { circulation: 'IN_REVIEW' },
        on: {
          COMPLETE: { to: 'COMPLETED' },
          FORCE_CLOSE: { to: 'CANCELLED' },
        },
      },
      {
        name: 'COMPLETED',
        terminal: true,
        statusProjection: { circulation: 'COMPLETED' },
      },
      {
        name: 'CANCELLED',
        terminal: true,
        statusProjection: { circulation: 'CANCELLED' },
      },
    ],
  };

  // 3. Transmittal Workflow — ADR-049: statusProjection ใช้ correspondence status codes
  //    Transmittal เป็น Correspondence ประเภทหนึ่ง จึงใช้ status ของ correspondence
  const transmittalDsl = {
    workflow: 'TRANSMITTAL_FLOW_V1',
    version: 2, // ADR-049: version bump เพิ่ม statusProjection
    description: 'Transmittal Submission Workflow (ADR-049)',
    states: [
      {
        name: 'DRAFT',
        initial: true,
        statusProjection: { correspondence: 'DRAFT' },
        on: { SUBMIT: { to: 'SUBMITTED' } },
      },
      {
        name: 'SUBMITTED',
        statusProjection: { correspondence: 'SUBOWN' }, // Submitted to Owner
        on: {
          ACKNOWLEDGE: { to: 'COMPLETED' },
          RETURN: { to: 'DRAFT' },
        },
      },
      {
        name: 'COMPLETED',
        terminal: true,
        statusProjection: { correspondence: 'CLBOWN' }, // Closed by Owner
      },
    ],
  };

  // 4. Correspondence Workflow — ADR-049: statusProjection ใช้ correspondence status codes
  //    Generic single-party review (ไม่ใช่ multi-party เหมือน RFA)
  const correspondenceDsl = {
    workflow: 'CORRESPONDENCE_FLOW_V1',
    version: 2, // ADR-049: version bump เพิ่ม statusProjection
    description: 'Standard Correspondence Routing (ADR-049)',
    states: [
      {
        name: 'DRAFT',
        initial: true,
        statusProjection: { correspondence: 'DRAFT' },
        on: { SUBMIT: { to: 'UNDER_REVIEW' } },
      },
      {
        name: 'UNDER_REVIEW',
        statusProjection: { correspondence: 'SUBOWN' }, // Submitted to Owner
        on: {
          APPROVE: { to: 'APPROVED' },
          REJECT: { to: 'REJECTED' },
        },
      },
      {
        name: 'APPROVED',
        terminal: true,
        statusProjection: { correspondence: 'CLBOWN' }, // Closed by Owner
      },
      {
        name: 'REJECTED',
        terminal: true,
        statusProjection: { correspondence: 'CCBOWN' }, // Canceled by Owner (สมมติ)
      },
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
