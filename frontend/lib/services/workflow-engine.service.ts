// File: lib/services/workflow-engine.service.ts
import apiClient from '@/lib/api/client';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
  EvaluateWorkflowDto,
  GetAvailableActionsDto,
} from '@/types/dto/workflow-engine/workflow-engine.dto';

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
  getDefinitions: async () => {
    const response = await apiClient.get('/workflow-engine/definitions');
    return response.data?.data || response.data;
  },

  /**
   * ดึง Workflow Definition ตาม ID
   * GET /workflow-engine/definitions/:id
   */
  getDefinitionById: async (id: string | number) => {
    const response = await apiClient.get(`/workflow-engine/definitions/${id}`);
    return response.data?.data || response.data;
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
