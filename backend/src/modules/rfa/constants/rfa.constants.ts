// File: src/modules/rfa/constants/rfa.constants.ts
// RFA-specific constants — replace magic strings throughout rfa.service.ts

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
export const RFA_WORKFLOW_CODE = 'RFA_APPROVAL';

export const RFA_WORKFLOW_STATE_DRAFT = 'DRAFT';
export const RFA_WORKFLOW_STATE_CONSULTANT_REVIEW = 'CONSULTANT_REVIEW';
export const RFA_WORKFLOW_STATE_OWNER_REVIEW = 'OWNER_REVIEW';
export const RFA_WORKFLOW_STATE_APPROVED = 'APPROVED';

// ─── Workflow State → RFA Status Code Map ─────────────────────────────────
export const STATE_TO_STATUS_MAP: Record<string, string> = {
  [RFA_WORKFLOW_STATE_DRAFT]: RFA_STATUS_DRAFT,
  [RFA_WORKFLOW_STATE_CONSULTANT_REVIEW]: RFA_STATUS_FOR_REVIEW,
  [RFA_WORKFLOW_STATE_OWNER_REVIEW]: RFA_STATUS_FOR_APPROVAL,
  [RFA_WORKFLOW_STATE_APPROVED]: RFA_STATUS_FOR_CONSTRUCTION,
};

// ─── Approve Codes ─────────────────────────────────────────────────────────
export const DEFAULT_APPROVED_CODE = '1A';

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
