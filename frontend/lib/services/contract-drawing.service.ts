// File: lib/services/contract-drawing.service.ts
import apiClient from "@/lib/api/client";
import { 
  CreateContractDrawingDto, 
  UpdateContractDrawingDto, 
  SearchContractDrawingDto 
} from "@/types/dto/drawing/contract-drawing.dto";

export const contractDrawingService = {
  /**
   * ดึงรายการแบบสัญญา (Contract Drawings)
   */
  getAll: async (params: SearchContractDrawingDto) => {
    // GET /contract-drawings?projectId=1&page=1...
    const response = await apiClient.get("/contract-drawings", { params });
    return response.data;
  },

  /**
   * ดึงรายละเอียดตาม ID
   */
  getById: async (id: string | number) => {
    const response = await apiClient.get(`/contract-drawings/${id}`);
    return response.data;
  },

  /**
   * สร้างแบบสัญญาใหม่
   */
  create: async (data: CreateContractDrawingDto) => {
    const response = await apiClient.post("/contract-drawings", data);
    return response.data;
  },

  /**
   * แก้ไขข้อมูลแบบสัญญา
   */
  update: async (id: string | number, data: UpdateContractDrawingDto) => {
    const response = await apiClient.put(`/contract-drawings/${id}`, data);
    return response.data;
  },

  /**
   * ลบแบบสัญญา (Soft Delete)
   */
  delete: async (id: string | number) => {
    const response = await apiClient.delete(`/contract-drawings/${id}`);
    return response.data;
  }
};