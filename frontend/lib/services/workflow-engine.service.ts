// File: lib/services/workflow-engine.service.ts
import apiClient from '@/lib/api/client';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
  EvaluateWorkflowDto,
  GetAvailableActionsDto,
} from '@/types/dto/workflow-engine/workflow-engine.dto';

import { Workflow, WorkflowType } from '@/types/workflow';

interface WorkflowResponseShape {
  data?: unknown;
}

interface WorkflowDslShape {
  workflowName?: string;
  description?: string;
  dslDefinition?: string;
  workflow?: string;
  states?: unknown;
}

interface BackendWorkflowShape {
  id?: string | number;
  workflow_code?: string;
  description?: string;
  version?: number;
  is_active?: boolean;
  dsl?: string | WorkflowDslShape;
  compiled?: {
    states?: Record<string, unknown>;
  };
  updated_at?: string;
}

const extractArrayData = <T,>(value: unknown): T[] => {
  let current: unknown = value;

  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(current)) {
      return current as T[];
    }

    if (!current || typeof current !== 'object' || !('data' in current)) {
      return [];
    }

    current = (current as { data?: unknown }).data;
  }

  return Array.isArray(current) ? (current as T[]) : [];
};

const extractNestedData = <T,>(value: unknown): T => {
  let current: unknown = value;

  for (let i = 0; i < 5; i += 1) {
    if (!current || typeof current !== 'object' || !('data' in current)) {
      return current as T;
    }

    current = (current as WorkflowResponseShape).data;
  }

  return current as T;
};

const extractDslDefinition = (dsl: BackendWorkflowShape['dsl']): string => {
  if (typeof dsl === 'string') {
    return dsl;
  }

  if (!dsl || typeof dsl !== 'object') {
    return '';
  }

  if (typeof dsl.dslDefinition === 'string') {
    return dsl.dslDefinition;
  }

  return JSON.stringify(dsl, null, 2);
};

const normalizeWorkflowType = (workflowCode?: string): WorkflowType => {
  const normalizedCode = workflowCode?.toUpperCase() ?? '';

  if (normalizedCode.includes('RFA')) {
    return 'RFA';
  }

  if (normalizedCode.includes('DRAWING')) {
    return 'DRAWING';
  }

  return 'CORRESPONDENCE';
};

const mapWorkflow = (backendObj: BackendWorkflowShape): Workflow => {
  if (!backendObj) throw new Error('Workflow not found');
  return {
    workflowId: backendObj.id ?? backendObj.workflow_code ?? '',
    workflowName:
      (typeof backendObj.dsl === 'object' ? backendObj.dsl?.workflowName : undefined) ||
      (typeof backendObj.dsl === 'object' ? backendObj.dsl?.workflow : undefined) ||
      backendObj.workflow_code ||
      '',
    description:
      backendObj.description ||
      (typeof backendObj.dsl === 'object' ? backendObj.dsl?.description : undefined) ||
      '',
    workflowType: normalizeWorkflowType(backendObj.workflow_code),
    version: backendObj.version || 1,
    isActive: backendObj.is_active ?? false,
    dslDefinition: extractDslDefinition(backendObj.dsl),
    stepCount: backendObj.compiled?.states ? Object.keys(backendObj.compiled.states).length : 0,
    updatedAt: backendObj.updated_at || new Date().toISOString(),
  };
};

export const workflowEngineService = {
  // --- Engine Execution (Low-Level) ---

  /**
   * ตรวจสอบ Action ที่ทำได้ ณ สถานะหนึ่งๆ (ถาม Engine)
   * POST /workflow-engine/available-actions
   */
  getAvailableActions: async (data: GetAvailableActionsDto) => {
    const response = await apiClient.post('/workflow-engine/available-actions', data);
    return response.data?.data || response.data; // string[] e.g. ['APPROVE', 'REJECT']
  },

  /**
   * ประมวลผล Transition (ถาม Engine ว่าถ้าทำ Action นี้แล้วจะไป State ไหน)
   * POST /workflow-engine/evaluate
   */
  evaluate: async (data: EvaluateWorkflowDto) => {
    const response = await apiClient.post('/workflow-engine/evaluate', data);
    return response.data?.data || response.data; // { nextState: '...', events: [...] }
  },

  // --- Definition Management (Admin / Workflow Editor) ---

  /**
   * ดึง Workflow Definition ทั้งหมด
   * GET /workflow-engine/definitions
   */
  getDefinitions: async (): Promise<Workflow[]> => {
    const response = await apiClient.get('/workflow-engine/definitions');
    return extractArrayData<BackendWorkflowShape>(response.data).map((workflow) => mapWorkflow(workflow));
  },

  /**
   * ดึง Workflow Definition ตาม ID
   * GET /workflow-engine/definitions/:id
   */
  getDefinitionById: async (id: string | number): Promise<Workflow> => {
    const response = await apiClient.get(`/workflow-engine/definitions/${id}`);
    const data = extractNestedData<BackendWorkflowShape>(response.data);
    return mapWorkflow(data);
  },

  /**
   * สร้าง Workflow Definition ใหม่
   * POST /workflow-engine/definitions
   */
  createDefinition: async (data: CreateWorkflowDefinitionDto) => {
    const response = await apiClient.post('/workflow-engine/definitions', data);
    return response.data?.data || response.data;
  },

  /**
   * อัปเดต Workflow Definition
   * PATCH /workflow-engine/definitions/:id
   */
  updateDefinition: async (id: string | number, data: UpdateWorkflowDefinitionDto) => {
    const response = await apiClient.patch(`/workflow-engine/definitions/${id}`, data);
    return response.data?.data || response.data;
  },

  /**
   * ลบ Workflow Definition
   * DELETE /workflow-engine/definitions/:id
   */
  deleteDefinition: async (id: string | number) => {
    const response = await apiClient.delete(`/workflow-engine/definitions/${id}`);
    return response.data?.data || response.data;
  },
};
