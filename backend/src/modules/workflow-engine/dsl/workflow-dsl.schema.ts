import { z } from 'zod';

/**
 * Zod Schema สำหรับ Workflow DSL
 * ตาม ADR-001: Unified Workflow Engine
 */

// Guard Schema
export const GuardSchema = z.object({
  type: z.enum(['permission', 'condition', 'script']),
  config: z.record(z.string(), z.any()),
});

export type WorkflowGuard = z.infer<typeof GuardSchema>;

// Effect Schema
export const EffectSchema = z.object({
  type: z.enum([
    'update_status',
    'send_email',
    'send_line',
    'create_notification',
    'assign_user',
    'update_field',
  ]),
  config: z.record(z.string(), z.any()),
});

export type WorkflowEffect = z.infer<typeof EffectSchema>;

// Transition Schema
export const TransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  trigger: z.string(),
  label: z.string().optional(),
  guards: z.array(GuardSchema).optional(),
  effects: z.array(EffectSchema).optional(),
});

export type WorkflowTransition = z.infer<typeof TransitionSchema>;

// Main Workflow DSL Schema
export const WorkflowDslSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  version: z
    .string()
    .regex(/^\d+\.\d+(\.\d+)?$/, 'Version must be semver format (e.g., 1.0.0)'),
  description: z.string().optional(),

  states: z.array(z.string()).min(1, 'At least one state is required'),

  initialState: z.string(),

  finalStates: z
    .array(z.string())
    .min(1, 'At least one final state is required'),

  transitions: z
    .array(TransitionSchema)
    .min(1, 'At least one transition is required'),

  metadata: z.record(z.string(), z.any()).optional(),
});

export type WorkflowDsl = z.infer<typeof WorkflowDslSchema>;

/**
 * ตัวอย่าง RFA Workflow DSL
 */
export const RFA_WORKFLOW_EXAMPLE: WorkflowDsl = {
  name: 'RFA_APPROVAL',
  version: '1.0.0',
  description: 'Request for Approval workflow for construction projects',
  states: [
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'REVISED',
  ],
  initialState: 'DRAFT',
  finalStates: ['APPROVED', 'REJECTED'],
  transitions: [
    {
      from: 'DRAFT',
      to: 'SUBMITTED',
      trigger: 'SUBMIT',
      label: 'Submit for approval',
      guards: [
        {
          type: 'permission',
          config: { permission: 'rfa.submit' },
        },
      ],
      effects: [
        {
          type: 'update_status',
          config: { status: 'SUBMITTED' },
        },
        {
          type: 'send_email',
          config: {
            to: 'reviewer@example.com',
            template: 'rfa_submitted',
          },
        },
      ],
    },
    {
      from: 'SUBMITTED',
      to: 'UNDER_REVIEW',
      trigger: 'START_REVIEW',
      label: 'Start review',
      guards: [
        {
          type: 'permission',
          config: { permission: 'rfa.review' },
        },
      ],
    },
    {
      from: 'UNDER_REVIEW',
      to: 'APPROVED',
      trigger: 'APPROVE',
      label: 'Approve',
      guards: [
        {
          type: 'permission',
          config: { permission: 'rfa.approve' },
        },
      ],
      effects: [
        {
          type: 'update_status',
          config: { status: 'APPROVED' },
        },
        {
          type: 'create_notification',
          config: {
            message: 'RFA has been approved',
            type: 'success',
          },
        },
      ],
    },
    {
      from: 'UNDER_REVIEW',
      to: 'REJECTED',
      trigger: 'REJECT',
      label: 'Reject',
      guards: [
        {
          type: 'permission',
          config: { permission: 'rfa.approve' },
        },
      ],
      effects: [
        {
          type: 'update_status',
          config: { status: 'REJECTED' },
        },
      ],
    },
    {
      from: 'UNDER_REVIEW',
      to: 'REVISED',
      trigger: 'REQUEST_REVISION',
      label: 'Request revision',
      effects: [
        {
          type: 'create_notification',
          config: {
            message: 'Please revise and resubmit',
          },
        },
      ],
    },
    {
      from: 'REVISED',
      to: 'SUBMITTED',
      trigger: 'RESUBMIT',
      label: 'Resubmit after revision',
    },
  ],
  metadata: {
    documentType: 'RFA',
    estimatedDuration: '5 days',
  },
};
