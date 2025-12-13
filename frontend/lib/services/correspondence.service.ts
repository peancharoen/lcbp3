// File: lib/services/correspondence.service.ts
import apiClient from "@/lib/api/client";
import { SearchCorrespondenceDto } from "@/types/dto/correspondence/search-correspondence.dto";
import { CreateCorrespondenceDto } from "@/types/dto/correspondence/create-correspondence.dto";
// Import DTO ใหม่
import { SubmitCorrespondenceDto } from "@/types/dto/correspondence/submit-correspondence.dto";
import { WorkflowActionDto } from "@/types/dto/correspondence/workflow-action.dto";
import { AddReferenceDto, RemoveReferenceDto } from "@/types/dto/correspondence/add-reference.dto";

export const correspondenceService = {
  // ... (getAll, getById, create, update, delete เดิมคงไว้) ...

  getAll: async (params?: SearchCorrespondenceDto) => {
    const response = await apiClient.get("/correspondences", { params });
    return response.data;
  },

  getById: async (id: string | number) => {
    const response = await apiClient.get(`/correspondences/${id}`);
    return response.data.data; // Unwrap NestJS Interceptor 'data' wrapper
  },

  create: async (data: CreateCorrespondenceDto) => {
    const response = await apiClient.post("/correspondences", data);
    return response.data;
  },

  update: async (id: string | number, data: any) => {
    const response = await apiClient.put(`/correspondences/${id}`, data);
    return response.data;
  },

  delete: async (id: string | number) => {
    const response = await apiClient.delete(`/correspondences/${id}`);
    return response.data;
  },

  // --- 🔥 New Methods ---

  /**
   * ส่งเอกสาร (Submit) เพื่อเริ่ม Workflow
   */
  submit: async (id: string | number, data: SubmitCorrespondenceDto) => {
    const response = await apiClient.post(`/correspondences/${id}/submit`, data);
    return response.data;
  },

  /**
   * ดำเนินการ Workflow (เช่น Approve, Reject) ในขั้นตอนปัจจุบัน
   */
  processWorkflow: async (id: string | number, data: WorkflowActionDto) => {
    const response = await apiClient.post(`/correspondences/${id}/workflow`, data);
    return response.data;
  },

  /**
   * เพิ่มเอกสารอ้างอิง
   */
  addReference: async (id: string | number, data: AddReferenceDto) => {
    const response = await apiClient.post(`/correspondences/${id}/references`, data);
    return response.data;
  },

  /**
   * ลบเอกสารอ้างอิง
   */
  removeReference: async (id: string | number, data: RemoveReferenceDto) => {
    // ใช้ DELETE method โดยส่ง body ไปด้วย (axios รองรับผ่าน config.data)
    const response = await apiClient.delete(`/correspondences/${id}/references`, {
      data: data
    });
    return response.data;
  },
  /**
   * Preview Document Number
   */
  previewNumber: async (data: Partial<CreateCorrespondenceDto>) => {
    const response = await apiClient.post("/correspondences/preview-number", data);
    return response.data;
  }
};
