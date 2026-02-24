// File: lib/services/json-schema.service.ts
import apiClient from "@/lib/api/client";
import {
  CreateJsonSchemaDto,
  UpdateJsonSchemaDto,
  SearchJsonSchemaDto
} from "@/types/dto/json-schema/json-schema.dto";

export const jsonSchemaService = {
  /**
   * ดึงรายการ Schema ทั้งหมด (สำหรับ Admin จัดการ Registry)
   */
  getAll: async (params?: SearchJsonSchemaDto) => {
    // GET /json-schemas
    const response = await apiClient.get("/json-schemas", { params });
    return response.data;
  },

  /**
   * ดึงรายละเอียด Schema ตาม ID
   */
  getById: async (id: number | string) => {
    // GET /json-schemas/:id
    const response = await apiClient.get(`/json-schemas/${id}`);
    return response.data;
  },

  /**
   * ดึง Schema ตาม "Code" (ใช้บ่อยที่สุดสำหรับ Dynamic Form)
   */
  getByCode: async (code: string) => {
    // GET /json-schemas/code/:code
    const response = await apiClient.get(`/json-schemas/code/${code}`);
    return response.data;
  },

  /**
   * สร้าง Schema ใหม่ (Admin)
   */
  create: async (data: CreateJsonSchemaDto) => {
    // POST /json-schemas
    const response = await apiClient.post("/json-schemas", data);
    return response.data;
  },

  /**
   * อัปเดต Schema (Admin)
   */
  update: async (id: number | string, data: UpdateJsonSchemaDto) => {
    // PUT /json-schemas/:id
    const response = await apiClient.put(`/json-schemas/${id}`, data);
    return response.data;
  },

  /**
   * ลบ Schema (Soft Delete)
   */
  delete: async (id: number | string) => {
    // DELETE /json-schemas/:id
    const response = await apiClient.delete(`/json-schemas/${id}`);
    return response.data;
  },

  /**
   * (Optional) ตรวจสอบความถูกต้องของข้อมูลกับ Schema ฝั่ง Server
   */
  validate: async (code: string, data: Record<string, unknown>) => {
    // POST /json-schemas/validate
    const response = await apiClient.post(`/json-schemas/validate`, {
      schemaCode: code,
      data: data
    });
    return response.data; // { valid: true, errors: [] }
  }
};
