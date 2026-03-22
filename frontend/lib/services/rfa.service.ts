// File: lib/services/rfa.service.ts
import apiClient from '@/lib/api/client';
import { CreateRfaDto, UpdateRfaDto, SearchRfaDto } from '@/types/dto/rfa/rfa.dto';

// DTO สำหรับการอนุมัติ (อาจจะย้ายไปไว้ใน folder dto/rfa/ ก็ได้ในอนาคต)
export interface WorkflowActionDto {
  action: 'APPROVE' | 'REJECT' | 'COMMENT' | 'ACKNOWLEDGE';
  comments?: string;
  stepNumber?: number; // อาจจะไม่จำเป็นถ้า Backend เช็ค state ปัจจุบันได้เอง
}

export const rfaService = {
  /**
   * ดึงรายการ RFA ทั้งหมด (รองรับ Search & Filter)
   */
  getAll: async (params: SearchRfaDto) => {
    // GET /rfas
    const response = await apiClient.get('/rfas', { params });
    return response.data;
  },

  /**
   * ดึงรายละเอียด RFA และประวัติ Workflow
   */
  getByUuid: async (uuid: string) => {
    // GET /rfas/:uuid (ADR-019)
    const response = await apiClient.get(`/rfas/${uuid}`);
    return response.data;
  },

  /**
   * สร้าง RFA ใหม่
   */
  create: async (data: CreateRfaDto) => {
    // POST /rfas
    const response = await apiClient.post('/rfas', data);
    return response.data;
  },

  /**
   * แก้ไข RFA (เฉพาะสถานะ Draft)
   */
  update: async (uuid: string, data: UpdateRfaDto) => {
    // PUT /rfas/:uuid (ADR-019)
    const response = await apiClient.put(`/rfas/${uuid}`, data);
    return response.data;
  },

  /**
   * ดำเนินการ Workflow (อนุมัติ / ตีกลับ / ส่งต่อ)
   */
  processWorkflow: async (uuid: string, actionData: WorkflowActionDto) => {
    // POST /rfas/:uuid/workflow (ADR-019)
    const response = await apiClient.post(`/rfas/${uuid}/workflow`, actionData);
    return response.data;
  },

  /**
   * (Optional) ลบ RFA (Soft Delete)
   */
  delete: async (uuid: string) => {
    // DELETE /rfas/:uuid (ADR-019)
    const response = await apiClient.delete(`/rfas/${uuid}`);
    return response.data;
  },
};
