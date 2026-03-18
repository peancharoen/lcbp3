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
   * ดึงรายละเอียด Transmittal ตาม UUID (ADR-019)
   */
  getByUuid: async (uuid: string) => {
    // GET /transmittals/:uuid
    const response = await apiClient.get(`/transmittals/${uuid}`);
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
  update: async (uuid: string, data: UpdateTransmittalDto) => {
    // PUT /transmittals/:uuid (ADR-019)
    const response = await apiClient.put(`/transmittals/${uuid}`, data);
    return response.data;
  },

  /**
   * ลบเอกสาร (Soft Delete)
   */
  delete: async (uuid: string) => {
    // DELETE /transmittals/:uuid (ADR-019)
    const response = await apiClient.delete(`/transmittals/${uuid}`);
    return response.data;
  }
};
