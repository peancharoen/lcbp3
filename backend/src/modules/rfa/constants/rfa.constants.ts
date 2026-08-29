// File: src/modules/rfa/constants/rfa.constants.ts
// RFA-specific constants — replace magic strings throughout rfa.service.ts
// ADR-049 review-fix: RFA_ACTION_* constants อ้างอิงจาก WorkflowAction enum (single source of truth)
import { WorkflowAction } from '../../workflow-engine/interfaces/workflow.interface';

// ─── RFA Type Codes ─────────────────────────────────────────────────────────
export const RFA_TYPE_CODE_DDW = 'DDW';
export const RFA_TYPE_CODE_SDW = 'SDW';
export const RFA_TYPE_CODE_ADW = 'ADW';

export const DRAWING_RFA_TYPES = [
  RFA_TYPE_CODE_DDW,
  RFA_TYPE_CODE_SDW,
] as const;
export const ASBUILT_RFA_TYPES = [RFA_TYPE_CODE_ADW] as const;
export const ALL_RFA_TYPES = [
  ...DRAWING_RFA_TYPES,
  ...ASBUILT_RFA_TYPES,
] as const;

// ─── RFA Status Codes ──────────────────────────────────────────────────────
export const RFA_STATUS_DRAFT = 'DFT';
export const RFA_STATUS_FOR_REVIEW = 'FRE';
export const RFA_STATUS_FOR_APPROVAL = 'FAP';
export const RFA_STATUS_FOR_CONSTRUCTION = 'FCO';
export const RFA_STATUS_CANCELLED = 'CC';
export const RFA_STATUS_OBSOLETE = 'OBS';

// ─── Correspondence Status Codes ──────────────────────────────────────────
export const CORR_STATUS_DRAFT = 'DRAFT';

// ─── Correspondence Revision Status ────────────────────────────────────────
export const REVISION_STATUS_CURRENT = 'CURRENT';
export const REVISION_STATUS_OLD = 'OLD';
export const REVISION_STATUS_ALL = 'ALL';

// ─── Recipient Types ──────────────────────────────────────────────────────
export const RECIPIENT_TYPE_TO = 'TO';

// ─── Workflow ──────────────────────────────────────────────────────────────
// ADR-049: RFA_APPROVAL v2 — 8 canonical states (multi-party sequential approval)
export const RFA_WORKFLOW_CODE = 'RFA_APPROVAL';

export const RFA_WORKFLOW_STATE_DRAFT = 'DRAFT';
export const RFA_WORKFLOW_STATE_CONSULTANT_REVIEW = 'CONSULTANT_REVIEW';
export const RFA_WORKFLOW_STATE_DESIGNER_REVIEW = 'DESIGNER_REVIEW';
export const RFA_WORKFLOW_STATE_OWNER_APPROVAL = 'OWNER_APPROVAL';
export const RFA_WORKFLOW_STATE_APPROVED = 'APPROVED';
export const RFA_WORKFLOW_STATE_APPROVED_WITH_COMMENTS =
  'APPROVED_WITH_COMMENTS';
export const RFA_WORKFLOW_STATE_REJECTED = 'REJECTED';
export const RFA_WORKFLOW_STATE_REVISE_REQUIRED = 'REVISE_REQUIRED';

// Terminal states — workflow instance จบที่นี่
export const RFA_WORKFLOW_TERMINAL_STATES = [
  RFA_WORKFLOW_STATE_APPROVED,
  RFA_WORKFLOW_STATE_APPROVED_WITH_COMMENTS,
  RFA_WORKFLOW_STATE_REJECTED,
  RFA_WORKFLOW_STATE_REVISE_REQUIRED,
] as const;

// ─── Workflow Actions ─────────────────────────────────────────────────────
// ADR-049 review-fix: อ้างอิงจาก WorkflowAction enum เพื่อให้มี single source of truth
export const RFA_ACTION_SUBMIT = WorkflowAction.SUBMIT;
export const RFA_ACTION_CONSENT_FOR_APPROVE =
  WorkflowAction.CONSENT_FOR_APPROVE;
export const RFA_ACTION_ASK_DESIGNER = WorkflowAction.ASK_DESIGNER;
export const RFA_ACTION_RESUBMIT = WorkflowAction.RESUBMIT;
export const RFA_ACTION_REJECT = WorkflowAction.REJECT;
export const RFA_ACTION_AGREED = WorkflowAction.AGREED;
export const RFA_ACTION_AGREED_WITH_COMMENTS =
  WorkflowAction.AGREED_WITH_COMMENTS;
export const RFA_ACTION_NO_OBJECTION = WorkflowAction.NO_OBJECTION;
export const RFA_ACTION_OBJECTED = WorkflowAction.OBJECTED;
export const RFA_ACTION_APPROVE = WorkflowAction.APPROVE;
export const RFA_ACTION_APPROVE_WITH_COMMENTS =
  WorkflowAction.APPROVE_WITH_COMMENTS;

// ─── Approve Codes (ADR-049 scheme ใหม่) ─────────────────────────────────
export const RFA_APPROVE_CODE_APPROVED = '1';
export const RFA_APPROVE_CODE_APPROVED_WITH_COMMENTS = '2';
export const RFA_APPROVE_CODE_REVISE_REQUIRED = '3';
export const RFA_APPROVE_CODE_REJECTED = '4';

export const RFA_APPROVE_CODES = [
  RFA_APPROVE_CODE_APPROVED,
  RFA_APPROVE_CODE_APPROVED_WITH_COMMENTS,
  RFA_APPROVE_CODE_REVISE_REQUIRED,
  RFA_APPROVE_CODE_REJECTED,
] as const;

// ─── Consent Reason Codes (ADR-049 — metadata ไม่มีผลต่อ state) ──────────
export const RFA_CONSENT_REASON_NO_OBJECTION = 'NO_OBJECTION';
export const RFA_CONSENT_REASON_COMMENTS_PROVIDED = 'COMMENTS_PROVIDED';
export const RFA_CONSENT_REASON_AGREED_WITH_CONDITIONS =
  'AGREED_WITH_CONDITIONS';
export const RFA_CONSENT_REASON_FORWARDED_TO_DESIGNER = 'FORWARDED_TO_DESIGNER';
export const RFA_CONSENT_REASON_REQUESTED_REVISION = 'REQUESTED_REVISION';

// ─── Entity Types ─────────────────────────────────────────────────────────
export const ENTITY_TYPE_RFA = 'rfa';

// ─── Drawing Item Types ───────────────────────────────────────────────────
export const ITEM_TYPE_SHOP = 'SHOP';
export const ITEM_TYPE_AS_BUILT = 'AS_BUILT';

// ─── Search Index ─────────────────────────────────────────────────────────
export const SEARCH_TYPE_RFA = 'rfa';
export const SEARCH_STATUS_DRAFT = 'DRAFT';

// ─── Error Codes ──────────────────────────────────────────────────────────
export const ERROR_RFA_TYPE_CONTRACT_MISMATCH = 'RFA_TYPE_CONTRACT_MISMATCH';
export const ERROR_DISCIPLINE_CONTRACT_MISMATCH =
  'DISCIPLINE_CONTRACT_MISMATCH';
export const ERROR_EC_RFA_001 = 'EC_RFA_001_ACTIVE_RFA_EXISTS';
export const ERROR_RFA_INVALID_SUBMIT_STATUS = 'RFA_INVALID_SUBMIT_STATUS';
export const ERROR_RFA_ALREADY_SUBMITTED = 'RFA_ALREADY_SUBMITTED';
export const ERROR_NO_ACTIVE_WORKFLOW = 'NO_ACTIVE_WORKFLOW_STEP';
export const ERROR_RFA_EDIT_NON_DRAFT = 'RFA_EDIT_NON_DRAFT';
export const ERROR_RFA_CANCEL_NON_DRAFT = 'RFA_CANCEL_NON_DRAFT';
