// File: lib/services/transmittal.service.ts
import apiClient from "@/lib/api/client";
import { 
  CreateTransmittalDto, 
  UpdateTransmittalDto, 
  SearchTransmittalDto 
} from "@/types/dto/transmittal/transmittal.dto";

export const transmittalService = {
  /**
   * ดึงรายการ Transmittal ทั้งหมด (รองรับ Search & Filter)
   */
  getAll: async (params: SearchTransmittalDto) => {
    // GET /transmittals
    const response = await apiClient.get("/transmittals", { params });
    return response.data;
  },

  /**
   * ดึงรายละเอียด Transmittal ตาม ID
   */
  getById: async (id: string | number) => {
    // GET /transmittals/:id
    const response = await apiClient.get(`/transmittals/${id}`);
    return response.data;
  },

  /**
   * สร้างเอกสารนำส่งใหม่
   */
  create: async (data: CreateTransmittalDto) => {
    // POST /transmittals
    const response = await apiClient.post("/transmittals", data);
    return response.data;
  },

  /**
   * แก้ไขข้อมูล Transmittal (เฉพาะ Draft)
   */
  update: async (id: string | number, data: UpdateTransmittalDto) => {
    // PUT /transmittals/:id
    const response = await apiClient.put(`/transmittals/${id}`, data);
    return response.data;
  },

  /**
   * ลบเอกสาร (Soft Delete)
   */
  delete: async (id: string | number) => {
    // DELETE /transmittals/:id
    const response = await apiClient.delete(`/transmittals/${id}`);
    return response.data;
  }
};