import apiClient from "@/lib/api/client";
import {
  CreateContractDto,
  UpdateContractDto,
  SearchContractDto,
} from "@/types/dto/contract/contract.dto";

export const contractService = {
  /**
   * Get all contracts (supports filtering by projectId)
   * GET /contracts?projectId=1
   */
  getAll: async (params?: SearchContractDto) => {
    const response = await apiClient.get("/contracts", { params });
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return response.data.data || response.data;
  },

  /**
   * Get contract by ID
   * GET /contracts/:id
   */
  getById: async (id: number) => {
    const response = await apiClient.get(`/contracts/${id}`);
    return response.data;
  },

  /**
   * Create new contract
   * POST /contracts
   */
  create: async (data: CreateContractDto) => {
    const response = await apiClient.post("/contracts", data);
    return response.data;
  },

  /**
   * Update contract
   * PATCH /contracts/:id
   */
  update: async (id: number, data: UpdateContractDto) => {
    const response = await apiClient.patch(`/contracts/${id}`, data);
    return response.data;
  },

  /**
   * Delete contract
   * DELETE /contracts/:id
   */
  delete: async (id: number) => {
    const response = await apiClient.delete(`/contracts/${id}`);
    return response.data;
  },
};
