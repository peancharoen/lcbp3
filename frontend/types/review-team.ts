// File: types/review-team.ts
// Types สำหรับ Review Team feature

export type ReviewTeamMemberRole = 'REVIEWER' | 'LEAD' | 'MANAGER';

export type DelegationScope = 'ALL' | 'RFA_ONLY' | 'CORRESPONDENCE_ONLY' | 'SPECIFIC_TYPES';

export type ReviewTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELEGATED'
  | 'EXPIRED'
  | 'CANCELLED';

export type ResponseCodeCategory =
  | 'ENGINEERING'
  | 'MATERIAL'
  | 'CONTRACT'
  | 'TESTING'
  | 'ESG';

export interface ReviewTeam {
  publicId: string;
  name: string;
  description?: string;
  projectId?: number;
  defaultForRfaTypes?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  members?: ReviewTeamMember[];
}

export interface ReviewTeamMember {
  publicId: string;
  teamId?: number;
  userId?: number;
  disciplineId?: number;
  role: ReviewTeamMemberRole;
  priorityOrder: number;
  createdAt: string;
  user?: {
    publicId: string;
    fullName?: string;
    email?: string;
  };
  discipline?: {
    publicId: string;
    disciplineCode: string;
    codeNameEn?: string;
    codeNameTh?: string;
  };
}

export interface ReviewTask {
  publicId: string;
  rfaRevisionId?: number;
  teamId?: number;
  disciplineId?: number;
  assignedToUserId?: number;
  status: ReviewTaskStatus;
  dueDate?: string;
  responseCodeId?: number;
  comments?: string;
  attachments?: string[];
  completedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  team?: Pick<ReviewTeam, 'publicId' | 'name'>;
  responseCode?: ResponseCode;
  discipline?: ReviewTeamMember['discipline'];
  assignedToUser?: ReviewTeamMember['user'];
}

export interface ResponseCode {
  publicId: string;
  code: string;
  subStatus?: string;
  category: ResponseCodeCategory;
  descriptionTh: string;
  descriptionEn: string;
  implications?: {
    affectsSchedule?: boolean;
    affectsCost?: boolean;
    requiresContractReview?: boolean;
    requiresEiaAmendment?: boolean;
  };
  notifyRoles?: string[];
  isActive: boolean;
  isSystem: boolean;
}

export interface ReviewTaskAggregateStatus {
  total: number;
  completed: number;
  pending: number;
  summary: string;
}
