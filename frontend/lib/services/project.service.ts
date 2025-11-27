// File: lib/services/project.service.ts
import apiClient from "@/lib/api/client";
import { 
  CreateProjectDto, 
  UpdateProjectDto, 
  SearchProjectDto 
} from "@/types/dto/project/project.dto";

export const projectService = {
  // --- Basic CRUD ---

  /**
   * ดึงรายการโครงการทั้งหมด (รองรับ Search & Pagination)
   * (เดิมคือ getAllProjects แต่ปรับให้รับ params ได้)
   */
  getAll: async (params?: SearchProjectDto) => {
    // GET /projects
    const response = await apiClient.get("/projects", { params });
    return response.data;
  },

  /** ดึงรายละเอียดโครงการตาม ID */
  getById: async (id: string | number) => {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },

  /** สร้างโครงการใหม่ (Admin) */
  create: async (data: CreateProjectDto) => {
    const response = await apiClient.post("/projects", data);
    return response.data;
  },

  /** แก้ไขโครงการ */
  update: async (id: string | number, data: UpdateProjectDto) => {
    const response = await apiClient.put(`/projects/${id}`, data);
    return response.data;
  },

  /** ลบโครงการ (Soft Delete) */
  delete: async (id: string | number) => {
    const response = await apiClient.delete(`/projects/${id}`);
    return response.data;
  },

  // --- Related Data / Dropdown Helpers ---

  /** * ดึงรายชื่อองค์กรในโครงการ (สำหรับ Dropdown 'To/From') 
   * GET /projects/:id/organizations
   */
  getOrganizations: async (projectId: string | number) => {
    const response = await apiClient.get(`/projects/${projectId}/organizations`);
    return response.data;
  },

  /** * ดึงรายชื่อสัญญาในโครงการ 
   * GET /projects/:id/contracts
   */
  getContracts: async (projectId: string | number) => {
    const response = await apiClient.get(`/projects/${projectId}/contracts`);
    return response.data;
  }
};