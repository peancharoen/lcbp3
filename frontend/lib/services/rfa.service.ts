// File: lib/services/rfa.service.ts
import apiClient from "@/lib/api/client";
import { 
  CreateRfaDto, 
  UpdateRfaDto, 
  SearchRfaDto 
} from "@/types/dto/rfa/rfa.dto";

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
    const response = await apiClient.get("/rfas", { params });
    return response.data;
  },

  /**
   * ดึงรายละเอียด RFA และประวัติ Workflow
   */
  getById: async (id: string | number) => {
    // GET /rfas/:id
    const response = await apiClient.get(`/rfas/${id}`);
    return response.data;
  },

  /**
   * สร้าง RFA ใหม่
   */
  create: async (data: CreateRfaDto) => {
    // POST /rfas
    const response = await apiClient.post("/rfas", data);
    return response.data;
  },

  /**
   * แก้ไข RFA (เฉพาะสถานะ Draft)
   */
  update: async (id: string | number, data: UpdateRfaDto) => {
    // PUT /rfas/:id
    const response = await apiClient.put(`/rfas/${id}`, data);
    return response.data;
  },

  /**
   * ดำเนินการ Workflow (อนุมัติ / ตีกลับ / ส่งต่อ)
   */
  processWorkflow: async (id: string | number, actionData: WorkflowActionDto) => {
    // POST /rfas/:id/workflow
    const response = await apiClient.post(`/rfas/${id}/workflow`, actionData);
    return response.data;
  },

  /**
   * (Optional) ลบ RFA (Soft Delete)
   */
  delete: async (id: string | number) => {
    const response = await apiClient.delete(`/rfas/${id}`);
    return response.data;
  }
};