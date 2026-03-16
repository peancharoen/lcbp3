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
    // Handle paginated response
    if (response.data && Array.isArray(response.data.data)) {
        return response.data.data;
    }
    return response.data;
  },

  /** ดึงรายละเอียดโครงการตาม UUID */
  getByUuid: async (uuid: string) => {
    const response = await apiClient.get(`/projects/${uuid}`);
    return response.data;
  },

  /** สร้างโครงการใหม่ (Admin) */
  create: async (data: CreateProjectDto) => {
    const response = await apiClient.post("/projects", data);
    return response.data;
  },

  /** แก้ไขโครงการ */
  update: async (uuid: string, data: UpdateProjectDto) => {
    const response = await apiClient.put(`/projects/${uuid}`, data);
    return response.data;
  },

  /** ลบโครงการ (Soft Delete) */
  delete: async (uuid: string) => {
    const response = await apiClient.delete(`/projects/${uuid}`);
    return response.data;
  },

  // --- Related Data / Dropdown Helpers ---

  // --- Related Data / Dropdown Helpers ---
  // Organizations and Contracts should now be fetched via their respective services
  // organizationService.getAll({ projectId })
  // contractService.getAll({ projectId })
};
