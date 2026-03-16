import apiClient from "@/lib/api/client";
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  SearchOrganizationDto,
} from "@/types/dto/organization/organization.dto";

export const organizationService = {
  /**
   * Get all organizations (supports filtering by projectId)
   * GET /organizations?projectId=1
   */
  getAll: async (params?: SearchOrganizationDto) => {
    const response = await apiClient.get("/organizations", { params });
    // Normalize response if wrapped in data.data or direct data
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return response.data.data || response.data;
  },

  /**
   * Get organization by UUID
   * GET /organizations/:uuid
   */
  getByUuid: async (uuid: string) => {
    const response = await apiClient.get(`/organizations/${uuid}`);
    return response.data;
  },

  /**
   * Create new organization
   * POST /organizations
   */
  create: async (data: CreateOrganizationDto) => {
    const response = await apiClient.post("/organizations", data);
    return response.data;
  },

  /**
   * Update organization
   * PATCH /organizations/:uuid
   */
  update: async (uuid: string, data: UpdateOrganizationDto) => {
    const response = await apiClient.patch(`/organizations/${uuid}`, data);
    return response.data;
  },

  /**
   * Delete organization
   * DELETE /organizations/:uuid
   */
  delete: async (uuid: string) => {
    const response = await apiClient.delete(`/organizations/${uuid}`);
    return response.data;
  },
};
